import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./lib/socket.js";
import HomePage from "./pages/HomePage.jsx";
import EditorPage from "./pages/EditorPage.jsx";

const INITIAL_STATUS = socket.connected ? "connected" : "disconnected";
const TYPING_STOP_DELAY = 1200;
const REQUEST_TIMEOUT = 8000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export default function App() {
  const [view, setView] = useState("home");
  const [roomCode, setRoomCode] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState(INITIAL_STATUS);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const latestRoomCode = useRef("");
  const currentUserRef = useRef(null);
  const displayNameRef = useRef("");
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    function handleConnect() {
      setConnectionStatus("connected");

      if (!latestRoomCode.current || !displayNameRef.current) {
        return;
      }

      socket.timeout(REQUEST_TIMEOUT).emit(
        "join-room",
        { roomCode: latestRoomCode.current, name: displayNameRef.current },
        (requestError, response) => {
          if (requestError || !response?.ok) {
            setError("Reconnected, but could not rejoin the room. Create a new room if needed.");
            return;
          }

          currentUserRef.current = response.currentUser;
          setCurrentUser(response.currentUser);
          setNote(response.note);
          setImages(response.images || []);
          setUsers(response.users || []);
          setUsersCount(response.usersCount);
        }
      );
    }

    function handleDisconnect() {
      setConnectionStatus("disconnected");
    }

    function handleNoteSync(payload) {
      if (payload.roomCode !== latestRoomCode.current) {
        return;
      }

      setNote(payload.note);
    }

    function handleRoomUsers(payload) {
      if (payload.roomCode !== latestRoomCode.current) {
        return;
      }

      setUsers(payload.users || []);
      setUsersCount(payload.usersCount);
    }

    function handleTypingUsers(payload) {
      if (payload.roomCode !== latestRoomCode.current) {
        return;
      }

      setTypingUsers(
        (payload.users || []).filter((user) => user.id !== currentUserRef.current?.id)
      );
    }

    function handleImagesSync(payload) {
      if (payload.roomCode !== latestRoomCode.current) {
        return;
      }

      setImages(payload.images || []);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("note-sync", handleNoteSync);
    socket.on("room-users", handleRoomUsers);
    socket.on("typing-users", handleTypingUsers);
    socket.on("images-sync", handleImagesSync);

    return () => {
      window.clearTimeout(typingTimeoutRef.current);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("note-sync", handleNoteSync);
      socket.off("room-users", handleRoomUsers);
      socket.off("typing-users", handleTypingUsers);
      socket.off("images-sync", handleImagesSync);
    };
  }, []);

  const createSession = useCallback((name) => {
    setError("");
    setIsBusy(true);
    displayNameRef.current = name;

    if (!socket.connected) {
      setIsBusy(false);
      setError("Socket is disconnected. Refresh the page and try again.");
      return;
    }

    socket.timeout(REQUEST_TIMEOUT).emit("create-room", { name }, (requestError, response) => {
      setIsBusy(false);

      if (requestError) {
        setError("Server did not respond. Wait a few seconds and try again.");
        return;
      }

      if (!response?.ok) {
        setError(response?.error || "Could not create a room.");
        return;
      }

      latestRoomCode.current = response.roomCode;
      currentUserRef.current = response.currentUser;
      setRoomCode(response.roomCode);
      setNote(response.note);
      setImages(response.images || []);
      setCurrentUser(response.currentUser);
      setUsers(response.users || []);
      setUsersCount(response.usersCount);
      setView("editor");
    });
  }, []);

  const joinSession = useCallback((requestedRoomCode, name) => {
    setError("");
    const cleanRoomCode = requestedRoomCode.trim().toUpperCase();

    if (cleanRoomCode.length !== 4) {
      setError("Room code must be exactly 4 characters.");
      return;
    }

    setIsBusy(true);
    displayNameRef.current = name;

    if (!socket.connected) {
      setIsBusy(false);
      setError("Socket is disconnected. Refresh the page and try again.");
      return;
    }

    socket.timeout(REQUEST_TIMEOUT).emit(
      "join-room",
      { roomCode: cleanRoomCode, name },
      (requestError, response) => {
        setIsBusy(false);

        if (requestError) {
          setError("Server did not respond. Check the room code and try again.");
          return;
        }

        if (!response?.ok) {
          setError(response?.error || "Could not join that room.");
          return;
        }

        latestRoomCode.current = response.roomCode;
        currentUserRef.current = response.currentUser;
        setRoomCode(response.roomCode);
        setNote(response.note);
        setImages(response.images || []);
        setCurrentUser(response.currentUser);
        setUsers(response.users || []);
        setUsersCount(response.usersCount);
        setView("editor");
      }
    );
  }, []);

  const updateNote = useCallback(
    (nextNote) => {
      setNote(nextNote);

      if (!roomCode) {
        return;
      }

      socket.emit("note-update", {
        roomCode,
        note: nextNote
      });

      socket.emit("typing-update", {
        roomCode,
        isTyping: true
      });

      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        socket.emit("typing-update", {
          roomCode,
          isTyping: false
        });
      }, TYPING_STOP_DELAY);
    },
    [roomCode]
  );

  const addImages = useCallback(
    async (files) => {
      if (!roomCode) {
        return;
      }

      const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));

      if (!imageFiles.length) {
        return;
      }

      setError("");

      for (const file of imageFiles) {
        if (file.size > MAX_IMAGE_BYTES) {
          setError("Each photo must be 2 MB or smaller.");
          continue;
        }

        const dataUrl = await readFileAsDataUrl(file);

        socket.timeout(REQUEST_TIMEOUT).emit(
          "image-add",
          {
            roomCode,
            image: {
              name: file.name,
              type: file.type,
              dataUrl
            }
          },
          (requestError, response) => {
            if (requestError || !response?.ok) {
              setError(response?.error || "Could not share that photo.");
              return;
            }

            setImages(response.images || []);
          }
        );
      }
    },
    [roomCode]
  );

  const removeImage = useCallback(
    (imageId) => {
      if (!roomCode) {
        return;
      }

      socket.timeout(REQUEST_TIMEOUT).emit(
        "image-remove",
        {
          roomCode,
          imageId
        },
        (requestError, response) => {
          if (requestError || !response?.ok) {
            setError(response?.error || "Could not remove that photo.");
            return;
          }

          setImages(response.images || []);
        }
      );
    },
    [roomCode]
  );

  const leaveRoom = useCallback(() => {
    window.location.reload();
  }, []);

  const appState = useMemo(
    () => ({
      roomCode,
      note,
      images,
      users,
      currentUser,
      typingUsers,
      usersCount,
      connectionStatus,
      error,
      isBusy
    }),
    [
      roomCode,
      note,
      images,
      users,
      currentUser,
      typingUsers,
      usersCount,
      connectionStatus,
      error,
      isBusy
    ]
  );

  if (view === "editor") {
    return (
      <EditorPage
        state={appState}
        onNoteChange={updateNote}
        onImagesAdd={addImages}
        onImageRemove={removeImage}
        onLeaveRoom={leaveRoom}
      />
    );
  }

  return (
    <HomePage
      state={appState}
      onCreateSession={createSession}
      onJoinSession={joinSession}
    />
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
