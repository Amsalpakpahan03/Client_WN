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
    return api.get("/orders");
  },

  /**
   * Get order by ID
   */
  getById(id) {
    return api.get(`/orders/${id}`);
  },

  /**
   * Create order baru
   */
  create(payload) {
    return api.post("/orders", payload);
  },

  /**
   * Update overall order status
   */
  updateStatus(id, status) {
    return api.put(`/orders/${id}/status`, { status });
  },

  /**
   * Update status untuk items dalam kategori tertentu
   */
  updateCategoryStatus(orderId, category, status) {
    return api.put(`/orders/${orderId}/category-status`, {
      category,
      status
    });
  },

  /**
   * Update status individual item
   */
  updateItemStatus(orderId, itemId, status) {
    return api.put(`/orders/${orderId}/items/${itemId}/status`, {
      status
    });
  },

  /**
   * Delete order
   */
  delete(id) {
    return api.delete(`/orders/${id}`);
  }
};