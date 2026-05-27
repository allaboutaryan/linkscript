import { io } from "socket.io-client";

const isViteDevServer = window.location.port === "5173";
const serverUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (isViteDevServer
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : window.location.origin);

export const socket = io(serverUrl, {
  autoConnect: true,
  transports: ["websocket", "polling"]
});
