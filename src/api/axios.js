// api/axios.js
import axios from "axios";

// Konfigurasi API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

console.log("%c[AXIOS] Initializing...", "color: #0099ff; font-weight: bold");
console.log("%c[AXIOS] URL:", "color: #0099ff", API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ========== Request Interceptor ==========
api.interceptors.request.use(
  async (config) => {
    // Ambil token dari localStorage
    let token = localStorage.getItem("order_token");
    
    // Jika tidak ada token untuk POST /orders, coba generate
    if (!token && config.url === "/orders" && config.method === "post") {
      console.log("%c[AXIOS] No token found for order creation", "color: #ff6600");
      // Token akan digenerate di useOrder, biarkan saja dulu
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("%c[AXIOS] Token attached to request", "color: #00ff00");
    } else {
      console.log("%c[AXIOS] No token available", "color: #ff6600");
    }
    
    console.log("%c[AXIOS] Request", "color: #0099ff", `${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("%c[AXIOS] Request Error", "color: #ff0000", error);
    return Promise.reject(error);
  }
);

// ========== Response Interceptor ==========
api.interceptors.response.use(
  (response) => {
    console.log("%c[AXIOS] Response", "color: #00ff00", `${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    const status = error.response?.status || "Network Error";
    const msg = error.response?.data?.message || error.message;
    console.error("%c[AXIOS] Response Error", "color: #ff0000", `${status}: ${msg}`);
    
    // Log detail untuk error 500
    if (status === 500) {
      console.error("%c[AXIOS] Server Error Details:", "color: #ff0000", error.response?.data);
    }
    
    return Promise.reject(error);
  }
);

export default api;