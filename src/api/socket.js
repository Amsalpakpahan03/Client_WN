import { io } from "socket.io-client";


const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

const socket = io(SOCKET_URL, {
  transports: ["websocket"], // Websocket lebih stabil untuk Vercel & Replit
  withCredentials: true,
  autoConnect: true,
  reconnection: true,
});

// Debugging koneksi (bisa dihapus jika sudah lancar)
socket.on("connect", () => console.log("Socket Connected:", socket.id));
socket.on("connect_error", (err) => console.error(" Socket Error:", err));

export default socket;