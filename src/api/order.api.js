// api/order.api.js
import api from "./axios";

/**
 * OrderAPI - REST API client untuk Order endpoints
 * Semua method menggunakan axios instance dengan konfigurasi yang benar
 */
export const OrderAPI = {
  /**
   * Get semua orders
   */
  getAll() {
    // ✅ Tambahkan /api/ prefix
    return api.get("/api/orders");
  },

  /**
   * Get order by ID
   */
  getById(id) {
    // ✅ Tambahkan /api/ prefix
    return api.get(`/api/orders/${id}`);
  },

  /**
   * Create order baru
   */
  create(payload) {
    console.log('📝 Creating order at:', '/api/orders');
    console.log('📦 Payload:', payload);
    // ✅ Tambahkan /api/ prefix
    return api.post("/api/orders", payload);
  },

  /**
   * Update overall order status
   */
  updateStatus(id, status) {
    // ✅ Tambahkan /api/ prefix
    return api.put(`/api/orders/${id}/status`, { status });
  },

  /**
   * Add new items to an existing order
   */
  addItems(orderId, payload) {
    return api.put(`/api/orders/${orderId}/items`, payload);
  },

  /**
   * Update status untuk items dalam kategori tertentu
   */
  updateCategoryStatus(orderId, category, status) {
    // ✅ Tambahkan /api/ prefix
    return api.put(`/api/orders/${orderId}/category-status`, {
      category,
      status
    });
  },

  /**
   * Update status individual item
   */
  updateItemStatus(orderId, itemId, status) {
    // ✅ Tambahkan /api/ prefix
    return api.put(`/api/orders/${orderId}/items/${itemId}/status`, {
      status
    });
  },

  /**
   * Delete order
   */
  delete(id) {
    // ✅ Tambahkan /api/ prefix
    return api.delete(`/api/orders/${id}`);
  }
};