// import { io } from "socket.io-client";


// // const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

// const socket = io(
//   "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev",
//   {
//     transports: ["websocket"], // Websocket lebih stabil untuk Vercel & Replit
//     withCredentials: true,
//     autoConnect: true,
//   reconnection: true,
// });

// // Debugging koneksi (bisa dihapus jika sudah lancar)
// socket.on("connect", () => console.log("Socket Connected:", socket.id));
// socket.on("connect_error", (err) => console.error(" Socket Error:", err));

// export default socket;

import { io } from "socket.io-client";

// Konfigurasi Socket URL
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

// Log konfigurasi saat startup
console.log("%c[SOCKET] Initializing...", "color: #00ff00; font-weight: bold");
console.log("%c[SOCKET] URL:", "color: #00ff00", SOCKET_URL);
console.log("%c[SOCKET] Environment:", "color: #00ff00", process.env.NODE_ENV);

const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],
  withCredentials: true,
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

// ========== Connection Events ==========
socket.on("connect", () => {
  console.log("%c✓ Socket Connected", "color: #00ff00; font-weight: bold", socket.id);
});

socket.on("disconnect", (reason) => {
  console.warn("%c✗ Socket Disconnected", "color: #ff0000; font-weight: bold", reason);
});

socket.on("connect_error", (err) => {
  console.error("%c✗ Socket Error", "color: #ff0000; font-weight: bold", err.message || err);
});

socket.on("reconnect_attempt", () => {
  console.log("%c⟳ Socket Reconnecting...", "color: #ffaa00");
});

export default socket;