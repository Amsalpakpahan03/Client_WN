import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

console.log("%c[AXIOS] Initializing...", "color: #0099ff; font-weight: bold");
console.log("%c[AXIOS] Base URL:", "color: #0099ff", API_BASE_URL);

// ========== INSTANCE UNTUK API BIASA ==========
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 detik
  headers: {
    "Content-Type": "application/json",
  },
});

// ========== INSTANCE KHUSUS UPLOAD GAMBAR ==========
export const uploadApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 120 detik untuk upload file
  headers: {
    "Content-Type": "multipart/form-data",
  },
});

// ========== Request Interceptor untuk api biasa ==========
api.interceptors.request.use(
  async (config) => {
    let token = localStorage.getItem("order_token");
    
    if (!token && config.url === "/api/orders" && config.method === "post") {
      console.log("%c[AXIOS] No token found for order creation", "color: #ff6600");
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("%c[AXIOS] Token attached to request", "color: #00ff00");
    }
    
    console.log("%c[AXIOS] Request", "color: #0099ff", `${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error("%c[AXIOS] Request Error", "color: #ff0000", error);
    return Promise.reject(error);
  }
);

// ========== Request Interceptor untuk uploadApi ==========
uploadApi.interceptors.request.use(
  async (config) => {
    // Untuk admin, ambil token dari sessionStorage
    const adminToken = sessionStorage.getItem("admin_token");
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
      console.log("%c[UPLOAD] Token attached", "color: #00ff00");
    }
    
    console.log("%c[UPLOAD] Request", "color: #ff6600", `${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("%c[UPLOAD] Request Error", "color: #ff0000", error);
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
    
    if (status === 500) {
      console.error("%c[AXIOS] Server Error Details:", "color: #ff0000", error.response?.data);
    }
    
    return Promise.reject(error);
  }
);

uploadApi.interceptors.response.use(
  (response) => {
    console.log("%c[UPLOAD] Response", "color: #00ff00", `${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    const status = error.response?.status || "Network Error";
    const msg = error.response?.data?.message || error.message;
    console.error("%c[UPLOAD] Response Error", "color: #ff0000", `${status}: ${msg}`);
    
    if (error.code === "ECONNABORTED") {
      console.error("%c[UPLOAD] Timeout! File terlalu besar", "color: #ff0000");
    }
    
    return Promise.reject(error);
  }
);

export default api;