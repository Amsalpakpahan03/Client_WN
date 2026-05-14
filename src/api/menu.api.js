// api/menu.api.js
import api from "./axios";

export const MenuAPI = {
  getAll: async () => {
    const response = await api.get("/api/menu");
    console.log("[MenuAPI] Full response:", response);
    console.log("[MenuAPI] response.data:", response.data);
    
    // Response dari server: { success: true, data: [...], message: "..." }
    if (response.data && response.data.success === true && response.data.data) {
      console.log("[MenuAPI] Extracted data array length:", response.data.data.length);
      return response.data.data; // ✅ KEMBALIKAN ARRAY LANGSUNG
    }
    
    // Fallback jika response.data langsung array
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    
    // Fallback jika response langsung array
    if (Array.isArray(response)) {
      return response;
    }
    
    console.warn("[MenuAPI] Unexpected response structure:", response);
    return [];
  },

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