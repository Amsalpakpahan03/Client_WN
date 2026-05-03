// hooks/useOrder.js
import { useState, useEffect, useCallback } from 'react';
import { OrderAPI } from '../api/order.api';
import socket from '../api/socket';
import axios from 'axios';

export const useOrder = (tableNumber) => {
  const [activeOrder, setActiveOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper function untuk mendapatkan/generate token
  const getOrCreateToken = useCallback(async () => {
    let token = localStorage.getItem("order_token");
    
    if (!token && tableNumber) {
      console.log("[ORDER] No token found, generating for table:", tableNumber);
      try {
        // PERBAIKAN: Gunakan baseURL yang benar (tanpa /api di akhir)
        const baseURL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
        console.log("[ORDER] Fetching token from:", `${baseURL}/test-token/${tableNumber}`);
        
        const response = await axios.get(`${baseURL}/test-token/${tableNumber}`);
        token = response.data.token;
        localStorage.setItem("order_token", token);
        console.log("[ORDER] Token generated successfully:", token);
      } catch (err) {
        console.error("[ORDER] Failed to generate token:", err);
        throw new Error("Failed to generate table token");
      }
    }
    
    return token;
  }, [tableNumber]);

  /* ================= CREATE ORDER ================= */
  const createOrder = useCallback(async (payload) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("[ORDER] Starting order creation for table:", tableNumber);
      
      // Pastikan token ada sebelum membuat order
      const token = await getOrCreateToken();
      console.log("[ORDER] Token status:", token ? "Available" : "Not available");
      
      // Pastikan payload memiliki struktur yang benar
      const finalPayload = {
        tableNumber: String(tableNumber), // Pastikan string
        items: (payload.items || []).map(item => ({
          name: item.name,
          quantity: Number(item.quantity),
          price: Number(item.price),
          category: item.category,
          status: item.status || "pending"
        })),
        totalPrice: Number(payload.totalPrice || 0)
      };
      
      console.log("[ORDER] Final payload:", JSON.stringify(finalPayload, null, 2));
      
      const res = await OrderAPI.create(finalPayload);
      const newOrder = res.data.data || res.data;
      
      setActiveOrder(newOrder);
      localStorage.setItem("activeOrderId", newOrder._id);
      
      console.log("[ORDER] ✅ Order created successfully:", newOrder._id);
      return newOrder;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      console.error("[ORDER] ❌ Create Error:", errMsg);
      console.error("[ORDER] Error details:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
      
      setError(errMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tableNumber, getOrCreateToken]);

  /* ================= RESTORE ORDER ================= */
  useEffect(() => {
    if (!tableNumber) return;

    const restoreOrder = async () => {
      const orderId = localStorage.getItem("activeOrderId");
      if (!orderId) {
        console.log("[ORDER] No active order in localStorage");
        return;
      }

      try {
        console.log("[ORDER] Restoring order:", orderId);
        const res = await OrderAPI.getById(orderId);
        const resData = res.data.data || res.data;
        
        // Jika order masih aktif → tampilkan status
        if (resData && resData.status !== "paid") {
          setActiveOrder(resData);
          console.log("[ORDER] ✅ Restored order:", resData._id, "Status:", resData.status);
        } else {
          localStorage.removeItem("activeOrderId");
          console.log("[ORDER] Order already paid or not found, cleared");
        }
      } catch (err) {
        console.error("[ORDER] Restore Error:", err.message);
        localStorage.removeItem("activeOrderId");
      }
    };

    restoreOrder();
  }, [tableNumber]);

  /* ================= SOCKET UPDATE ================= */
  const updateOrderFromSocket = useCallback((updatedOrder) => {
    console.log("[ORDER] Socket Update received:", updatedOrder);
    
    setActiveOrder((current) => {
      // jika belum ada order → socket boleh set
      if (!current) {
        localStorage.setItem("activeOrderId", updatedOrder._id);
        console.log("[ORDER] Socket set new order:", updatedOrder._id);
        return updatedOrder;
      }

      // jika order berbeda → abaikan
      if (current._id !== updatedOrder._id) {
        console.log("[ORDER] Ignoring different order. Current:", current._id, "Received:", updatedOrder._id);
        return current;
      }

      // jika sudah dibayar → clear
      if (updatedOrder.status === "paid") {
        localStorage.removeItem("activeOrderId");
        console.log("[ORDER] Order paid, clearing local storage");
        return null;
      }

      console.log("[ORDER] Merging socket update");
      return { ...current, ...updatedOrder };
    });
  }, []);

  return {
    activeOrder,
    isLoading,
    error,
    createOrder,
    updateOrderFromSocket,
  };
};