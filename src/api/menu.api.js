// api/menu.api.js
import api from "./axios";

export const MenuAPI = {
  getAll() {
    // ✅ PERBAIKI: tambahkan /api/ di depan
    return api.get("/api/menu");
  },

  // Optional: tambahkan method lain jika diperlukan
  getById(id) {
    return api.get(`/api/menu/${id}`);
  },

  create(data) {
    return api.post("/api/menu", data);
  },

  update(id, data) {
    return api.put(`/api/menu/${id}`, data);
  },

  delete(id) {
    return api.delete(`/api/menu/${id}`);
  }
};