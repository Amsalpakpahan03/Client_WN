// import axios from "axios";

// // const api = axios.create({
// //   baseURL: "http://localhost:5000/api",
// //   timeout: 10000,
// // });

// const api = axios.create({
//   baseURL: "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev/api",
//   timeout: 10000,
// });

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("order_token");
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// export default api;

import axios from "axios";

// Konfigurasi API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// Log konfigurasi saat startup
console.log("%c[AXIOS] Initializing...", "color: #0099ff; font-weight: bold");
console.log("%c[AXIOS] URL:", "color: #0099ff", API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// ========== Request Interceptor ==========
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("order_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    return Promise.reject(error);
  }
);

export default api;