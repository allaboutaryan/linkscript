import express from "express";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { Server } from "socket.io";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const ROOM_CODE_LENGTH = 4;
const ROOM_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EMPTY_ROOM_TTL_MS = 1000 * 60 * 60;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, "../../client/dist");
const USER_COLORS = [
  "#67e8f9",
  "#a7f3d0",
  "#fde68a",
  "#f9a8d4",
  "#c4b5fd",
  "#fdba74",
  "#93c5fd",
  "#fca5a5"
];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());
app.use(express.static(clientDistPath));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: "LinkPad",
    rooms: rooms.size
  });
});

app.get("/api/network", (_req, res) => {
  const addresses = getLocalIPv4Addresses();

  res.json({
    port: Number(PORT),
    localUrl: `http://localhost:${PORT}`,
    lanUrls: addresses.map((address) => `http://${address}:${PORT}`)
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

io.on("connection", (socket) => {
  socket.data.roomCode = null;
  socket.data.user = createGuestUser(socket.id);

  socket.on("create-room", (payload, callback) => {
    socket.data.user = createUser(socket.id, payload?.name);

    const roomCode = createUniqueRoomCode();

    rooms.set(roomCode, {
      note: "",
      users: new Map(),
      typingUsers: new Set(),
      emptyRoomTimer: null
    });

    joinRoom(socket, roomCode);

    callback?.({
      ok: true,
      roomCode,
      note: "",
      currentUser: getRoomUser(roomCode, socket.id),
      users: getRoomUsers(roomCode),
      usersCount: getUsersCount(roomCode)
    });
  });

  socket.on("join-room", (payload, callback) => {
    const normalizedRoomCode = normalizeRoomCode(payload?.roomCode);
    const room = rooms.get(normalizedRoomCode);

    socket.data.user = createUser(socket.id, payload?.name);

    if (!room) {
      callback?.({
        ok: false,
        error: "Room not found. Check the code and try again."
      });
      return;
    }

    joinRoom(socket, normalizedRoomCode);

    callback?.({
      ok: true,
      roomCode: normalizedRoomCode,
      note: room.note,
      currentUser: getRoomUser(normalizedRoomCode, socket.id),
      users: getRoomUsers(normalizedRoomCode),
      usersCount: getUsersCount(normalizedRoomCode)
    });
  });

  socket.on("note-update", ({ roomCode, note }) => {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = rooms.get(normalizedRoomCode);

    if (!room || socket.data.roomCode !== normalizedRoomCode) {
      return;
    }

    room.note = typeof note === "string" ? note : "";

    socket.to(normalizedRoomCode).emit("note-sync", {
      roomCode: normalizedRoomCode,
      note: room.note
    });
  });

  socket.on("typing-update", ({ roomCode, isTyping }) => {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = rooms.get(normalizedRoomCode);

    if (!room || socket.data.roomCode !== normalizedRoomCode) {
      return;
    }

    if (isTyping) {
      room.typingUsers.add(socket.id);
    } else {
      room.typingUsers.delete(socket.id);
    }

    emitTypingUsers(normalizedRoomCode);
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`LinkPad server running on http://localhost:${PORT}`);
  getLocalIPv4Addresses().forEach((address) => {
    console.log(`Local network: http://${address}:${PORT}`);
  });
});

function joinRoom(socket, roomCode) {
  leaveCurrentRoom(socket);

  const room = rooms.get(roomCode);
  if (!room) {
    return;
  }

  socket.join(roomCode);
  socket.data.roomCode = roomCode;
  clearEmptyRoomTimer(room);
  room.users.set(socket.id, {
    ...socket.data.user,
    color: pickRoomColor(room)
  });

  emitRoomUsers(roomCode);
}

function leaveCurrentRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) {
    return;
  }

  const room = rooms.get(roomCode);
  if (room) {
    room.users.delete(socket.id);
    room.typingUsers.delete(socket.id);

    if (room.users.size === 0) {
      scheduleEmptyRoomCleanup(roomCode, room);
    } else {
      emitRoomUsers(roomCode);
      emitTypingUsers(roomCode);
    }
  }

  socket.leave(roomCode);
  socket.data.roomCode = null;
}

function emitRoomUsers(roomCode) {
  io.to(roomCode).emit("room-users", {
    roomCode,
    users: getRoomUsers(roomCode),
    usersCount: getUsersCount(roomCode)
  });
}

function scheduleEmptyRoomCleanup(roomCode, room) {
  clearEmptyRoomTimer(room);

  room.emptyRoomTimer = setTimeout(() => {
    const latestRoom = rooms.get(roomCode);

    if (latestRoom && latestRoom.users.size === 0) {
      rooms.delete(roomCode);
    }
  }, EMPTY_ROOM_TTL_MS);
}

function clearEmptyRoomTimer(room) {
  if (!room.emptyRoomTimer) {
    return;
  }

  clearTimeout(room.emptyRoomTimer);
  room.emptyRoomTimer = null;
}

function getUsersCount(roomCode) {
  return rooms.get(roomCode)?.users.size ?? 0;
}

function getRoomUsers(roomCode) {
  return Array.from(rooms.get(roomCode)?.users.values() ?? []);
}

function getRoomUser(roomCode, socketId) {
  return rooms.get(roomCode)?.users.get(socketId) ?? null;
}

function emitTypingUsers(roomCode) {
  const room = rooms.get(roomCode);
  const users = Array.from(room?.typingUsers ?? [])
    .map((socketId) => room.users.get(socketId))
    .filter(Boolean);

  io.to(roomCode).emit("typing-users", {
    roomCode,
    users
  });
}

function createUniqueRoomCode() {
  let roomCode = createRoomCode();

  while (rooms.has(roomCode)) {
    roomCode = createRoomCode();
  }

  return roomCode;
}

function createRoomCode() {
  let code = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const characterIndex = Math.floor(Math.random() * ROOM_CHARACTERS.length);
    code += ROOM_CHARACTERS[characterIndex];
  }

  return code;
}

function normalizeRoomCode(roomCode) {
  return String(roomCode || "")
    .trim()
    .toUpperCase();
}

function getLocalIPv4Addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((network) => network?.family === "IPv4" && !network.internal)
    .map((network) => network.address);
}

function createGuestUser(socketId) {
  return createUser(socketId);
}

function createUser(socketId, name) {
  const shortId = socketId.replace(/\W/g, "").slice(0, 4).toUpperCase();
  const cleanName = sanitizeName(name);

  return {
    id: socketId,
    name: cleanName || `Guest ${shortId || Math.floor(Math.random() * 900 + 100)}`,
    color: USER_COLORS[0]
  };
}

function sanitizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function pickRoomColor(room) {
  const usedColors = new Set(Array.from(room.users.values()).map((user) => user.color));
  const availableColor = USER_COLORS.find((color) => !usedColors.has(color));

  if (availableColor) {
    return availableColor;
  }

  return USER_COLORS[room.users.size % USER_COLORS.length];
}
