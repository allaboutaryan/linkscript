import express from "express";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { Server } from "socket.io";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const ROOM_CODE_LENGTH = 4;
const ROOM_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EMPTY_ROOM_TTL_MS = 1000 * 60 * 60;
const HUMANIZE_MAX_CHARS = 12000;
const HUMANIZE_WINDOW_MS = 1000 * 60;
const HUMANIZE_MAX_REQUESTS = 12;
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
const humanizeRequests = new Map();

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "128kb" }));
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

app.post("/api/humanize", async (req, res) => {
  const clientKey = req.ip || req.socket.remoteAddress || "unknown";

  if (!canUseHumanizer(clientKey)) {
    res.status(429).json({
      ok: false,
      error: "Too many humanize requests. Wait a minute and try again."
    });
    return;
  }

  const text = String(req.body?.text || "").trim();

  if (!text) {
    res.status(400).json({
      ok: false,
      error: "Add some text before using Humanize."
    });
    return;
  }

  if (text.length > HUMANIZE_MAX_CHARS) {
    res.status(400).json({
      ok: false,
      error: `Humanize supports up to ${HUMANIZE_MAX_CHARS} characters at a time.`
    });
    return;
  }

  if (!GEMINI_API_KEY) {
    res.status(503).json({
      ok: false,
      error: "Gemini API key is not configured on the server."
    });
    return;
  }

  try {
    const humanizedText = await humanizeWithGemini(text);

    res.json({
      ok: true,
      text: humanizedText
    });
  } catch (error) {
    console.error("Humanize failed:", error);
    res.status(502).json({
      ok: false,
      error: "Could not humanize that text right now. Try again in a moment."
    });
  }
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

function canUseHumanizer(clientKey) {
  const now = Date.now();
  const entry = humanizeRequests.get(clientKey);

  if (!entry || now - entry.startedAt > HUMANIZE_WINDOW_MS) {
    humanizeRequests.set(clientKey, {
      count: 1,
      startedAt: now
    });
    return true;
  }

  if (entry.count >= HUMANIZE_MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

async function humanizeWithGemini(text) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Rewrite the text below so it reads like a real person wrote it, while keeping the exact meaning.",
                  "Keep every fact, name, number, example, and intent unchanged.",
                  "Do not add new information. Do not remove important details.",
                  "Do not make it sound over-polished, generic, motivational, or like a formal essay.",
                  "Keep a natural human rhythm: some short sentences, some normal sentences, and simple wording.",
                  "Avoid common AI-style transitions and filler phrases such as 'moreover', 'furthermore', 'in conclusion', 'it is important to note', 'delve', 'leverage', 'robust', 'seamless', and 'unlock'.",
                  "Preserve the writer's original tone as much as possible. If the text is casual, keep it casual. If it is professional, keep it professional but still natural.",
                  "Use contractions where they fit, but do not force them into every sentence.",
                  "Do not use headings, bullet points, markdown, notes, or explanations unless they already exist in the original text.",
                  "Return only the rewritten text.",
                  "",
                  text
                ].join("\n")
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.55,
          topP: 0.82,
          maxOutputTokens: 4096
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const output = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!output) {
    throw new Error("Gemini returned an empty response.");
  }

  return output;
}
