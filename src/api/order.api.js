// api/order.api.js
import api from "./axios";

export const OrderAPI = {
  getAll() {
    return api.get("/api/orders");
  },

  getById(id) {
    return api.get(`/api/orders/${id}`);
  },

  // ✅ Pastikan endpoint create order benar
  create(payload) {
    console.log('📝 Creating order with payload:', payload);
    return api.post("/api/orders", payload);
  },

  updateStatus(id, status) {
    return api.put(`/api/orders/${id}/status`, { status });
  },

  updateCategoryStatus(orderId, category, status) {
    return api.put(`/api/orders/${orderId}/category-status`, {
      category,
      status
    });
  },

  updateItemStatus(orderId, itemId, status) {
    return api.put(`/api/orders/${orderId}/items/${itemId}/status`, {
      status
    });
  },

  delete(id) {
    return api.delete(`/api/orders/${id}`);
  }
};