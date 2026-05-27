import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./lib/socket.js";
import { humanizeText } from "./lib/humanizeText.js";
import HomePage from "./pages/HomePage.jsx";
import EditorPage from "./pages/EditorPage.jsx";

const INITIAL_STATUS = socket.connected ? "connected" : "disconnected";
const TYPING_STOP_DELAY = 1200;
const REQUEST_TIMEOUT = 8000;

export default function App() {
  const [view, setView] = useState("home");
  const [roomCode, setRoomCode] = useState("");
  const [note, setNote] = useState("");
  const [usersCount, setUsersCount] = useState(0);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState(INITIAL_STATUS);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isHumanizing, setIsHumanizing] = useState(false);
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

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("note-sync", handleNoteSync);
    socket.on("room-users", handleRoomUsers);
    socket.on("typing-users", handleTypingUsers);

    return () => {
      window.clearTimeout(typingTimeoutRef.current);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("note-sync", handleNoteSync);
      socket.off("room-users", handleRoomUsers);
      socket.off("typing-users", handleTypingUsers);
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

  const humanizeNote = useCallback(async () => {
    const textToHumanize = note.trim();

    if (!textToHumanize || isHumanizing) {
      return;
    }

    setError("");
    setIsHumanizing(true);

    try {
      const response = await fetch("/api/humanize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: note
        })
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Humanize failed.");
      }

      if (result.text && result.text !== note) {
        updateNote(result.text);
      }
    } catch (requestError) {
      const fallbackText = humanizeText(note);

      if (fallbackText && fallbackText !== note) {
        updateNote(fallbackText);
        setError("Gemini humanizer was unavailable, so LinkPad used a basic local rewrite.");
      } else {
        setError(requestError.message || "Could not humanize that text right now.");
      }
    } finally {
      setIsHumanizing(false);
    }
  }, [isHumanizing, note, updateNote]);

  const leaveRoom = useCallback(() => {
    window.location.reload();
  }, []);

  const appState = useMemo(
    () => ({
      roomCode,
      note,
      users,
      currentUser,
      typingUsers,
      usersCount,
      connectionStatus,
      error,
      isBusy,
      isHumanizing
    }),
    [
      roomCode,
      note,
      users,
      currentUser,
      typingUsers,
      usersCount,
      connectionStatus,
      error,
      isBusy,
      isHumanizing
    ]
  );

  if (view === "editor") {
    return (
      <EditorPage
        state={appState}
        onNoteChange={updateNote}
        onHumanizeNote={humanizeNote}
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
