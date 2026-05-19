// hooks/useOrder.js
import { useState, useEffect, useCallback } from 'react';
import { OrderAPI } from '../api/order.api';
import axios from 'axios';

export const useOrder = (tableNumber) => {
  const [activeOrder, setActiveOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const validateTableNumber = useCallback(() => {
    if (!tableNumber) {
      console.error("[ORDER] ❌ tableNumber is undefined or null!");
      return false;
    }
    console.log("[ORDER] ✅ tableNumber from param:", tableNumber);
    return true;
  }, [tableNumber]);

  const getOrCreateToken = useCallback(async () => {
    let token = localStorage.getItem("order_token");
    
    if (!token && tableNumber) {
      console.log("[ORDER] No token found, generating for table:", tableNumber);
      try {
        const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";
        const cleanBaseURL = baseURL.replace(/\/$/, '');
        const url = `${cleanBaseURL}/test-token/${tableNumber}`;
        
        const response = await axios.get(url, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        });
        
        token = response.data.token;
        localStorage.setItem("order_token", token);
        console.log("[ORDER] Token generated successfully");
      } catch (err) {
        console.error("[ORDER] Failed to generate token:", err.message);
        throw new Error("Failed to generate table token");
      }
    }
    return token;
  }, [tableNumber]);

  const createOrder = useCallback(async (payload) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!validateTableNumber()) {
        throw new Error("Table number is required. Please scan QR code again.");
      }
      
      console.log("[ORDER] Starting order creation for table:", tableNumber);
      console.log("[ORDER] Payload received from component:", payload);
      
      const token = await getOrCreateToken();
      console.log("[ORDER] Token obtained:", token ? "Yes (length: " + token.length + ")" : "No");
      
      const finalTableNumber = String(tableNumber).trim();
      
      // 🔥 PERBAIKAN: Format payload DENGAN productId
      const items = (payload.items || []).map(item => ({
        productId: item.productId || null,  // ← INI KUNCINYA!
        name: item.name || "Unknown",
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
        category: item.category || "Lainnya",
        status: item.status || "pending",
        description: item.description || "",
        isIncludedInPackage: item.isIncludedInPackage || false,
        packageName: item.packageName || null
      }));
      
      const finalPayload = {
        tableNumber: finalTableNumber,
        items: items,
        totalPrice: Number(payload.totalPrice || 0),
        notes: payload.notes || ""  // ✅ TAMBAHKAN INI
      };
      
      console.log("[ORDER] ========== FINAL PAYLOAD ==========");
      console.log("[ORDER] Items with productId:", JSON.stringify(finalPayload.items, null, 2));
      
      const res = await OrderAPI.create(finalPayload);
      
      const newOrder = res.data?.data || res.data;
      
      if (!newOrder || !newOrder._id) {
        throw new Error("Invalid response: missing order ID");
      }
      
      setActiveOrder(newOrder);
      localStorage.setItem("activeOrderId", newOrder._id);
      
      console.log("[ORDER] ✅ Order created successfully. ID:", newOrder._id);
      
      return newOrder;
      
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Unknown error";
      const errStatus = err.response?.status;
      
      console.error("[ORDER] ❌ Error message:", errMsg);
      console.error("[ORDER] Error status:", errStatus);
      
      if (err.response?.data) {
        console.error("[ORDER] Server error response:", err.response.data);
      }
      
      setError(errMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tableNumber, getOrCreateToken, validateTableNumber]);

  const addItemsToOrder = useCallback(async (orderId, payload) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!validateTableNumber()) {
        throw new Error("Table number is required. Please scan QR code again.");
      }

      if (!orderId) {
        throw new Error("Order ID is required to add items to an existing order.");
      }

      const items = (payload.items || []).map(item => ({
        productId: item.productId || null,
        name: item.name || "Unknown",
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
        category: item.category || "Lainnya",
        status: item.status || "pending",
        description: item.description || "",
        isIncludedInPackage: item.isIncludedInPackage || false,
        packageName: item.packageName || null
      }));

      const finalPayload = {
        items,
        totalPrice: Number(payload.totalPrice || 0),
        notes: payload.notes || ""  // ✅ TAMBAHKAN INI
      };

      const res = await OrderAPI.addItems(orderId, finalPayload);
      const updatedOrder = res.data?.data || res.data;

      if (!updatedOrder || !updatedOrder._id) {
        throw new Error("Invalid response: missing updated order data");
      }

      setActiveOrder(updatedOrder);
      localStorage.setItem("activeOrderId", updatedOrder._id);
      return updatedOrder;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Unknown error";
      const errStatus = err.response?.status;

      console.error("[ORDER] ❌ Add items error:", errMsg);
      console.error("[ORDER] Error status:", errStatus);

      if (err.response?.data) {
        console.error("[ORDER] Server error response:", err.response.data);
      }

      setError(errMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [validateTableNumber]);

  // Restore order from localStorage
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
        const resData = res.data?.data || res.data;
        
        if (resData && resData.status !== "paid") {
          setActiveOrder(resData);
          console.log("[ORDER] ✅ Restored order:", resData._id);
        } else {
          localStorage.removeItem("activeOrderId");
        }
      } catch (err) {
        console.error("[ORDER] Restore Error:", err.message);
        localStorage.removeItem("activeOrderId");
      }
    };

    restoreOrder();
  }, [tableNumber]);

  const updateOrderFromSocket = useCallback((updatedOrder) => {
    console.log("[ORDER] Socket Update received:", updatedOrder);
    
    setActiveOrder((current) => {
      if (!current) {
        localStorage.setItem("activeOrderId", updatedOrder._id);
        return updatedOrder;
      }
      if (current._id !== updatedOrder._id) return current;
      if (updatedOrder.status === "paid") {
        localStorage.removeItem("activeOrderId");
        return null;
      }
      return { ...current, ...updatedOrder };
    });
  }, []);

  return {
    activeOrder,
    isLoading,
    error,
    createOrder,
    addItemsToOrder,
    updateOrderFromSocket,
  };
};