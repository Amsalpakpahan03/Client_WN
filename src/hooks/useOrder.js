// hooks/useOrder.js
import { useState, useEffect, useCallback } from 'react';
import { OrderAPI } from '../api/order.api';
import axios from 'axios';

export const useOrder = (tableNumber) => {
  const [activeOrder, setActiveOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const getOrCreateToken = useCallback(async () => {
    let token = localStorage.getItem("order_token");
    
    if (!token && tableNumber) {
      console.log("[ORDER] No token found, generating for table:", tableNumber);
      try {
        const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";
        const cleanBaseURL = baseURL.replace(/\/$/, '');
        const url = `${cleanBaseURL}/test-token/${tableNumber}`;
        
        console.log("[ORDER] Fetching token from:", url);
        
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        console.log("[ORDER] Token response:", response.data);
        
        if (!response.data || !response.data.token) {
          throw new Error("Invalid token response");
        }
        
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
      console.log("[ORDER] Starting order creation for table:", tableNumber);
      console.log("[ORDER] Payload received:", payload);
      
      // Get token
      const token = await getOrCreateToken();
      console.log("[ORDER] Token obtained:", token ? "Yes" : "No");
      
      // Format payload untuk backend
      const finalPayload = {
        tableNumber: String(tableNumber),
        items: (payload.items || []).map(item => ({
          name: item.name || "Unknown",
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0,
          category: item.category || "Lainnya",
          status: item.status || "pending"
        })),
        totalPrice: Number(payload.totalPrice || 0)
      };
      
      console.log("[ORDER] Final payload being sent:", JSON.stringify(finalPayload, null, 2));
      
      // Panggil API create order
      const res = await OrderAPI.create(finalPayload);
      console.log("[ORDER] Create order response:", res);
      
      // Handle response (bisa dalam berbagai format)
      const newOrder = res.data?.data || res.data;
      
      if (!newOrder || !newOrder._id) {
        throw new Error("Invalid response: missing order ID");
      }
      
      setActiveOrder(newOrder);
      localStorage.setItem("activeOrderId", newOrder._id);
      
      console.log("[ORDER] ✅ Order created successfully:", newOrder._id);
      return newOrder;
      
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Unknown error";
      const errStatus = err.response?.status;
      
      console.error("[ORDER] ❌ Create Error:", errMsg);
      console.error("[ORDER] Error status:", errStatus);
      console.error("[ORDER] Full error:", err);
      
      // Tampilkan pesan error yang lebih jelas
      if (errStatus === 404) {
        setError("Endpoint order tidak ditemukan. Periksa URL backend.");
      } else if (errStatus === 400) {
        setError("Data order tidak valid: " + errMsg);
      } else if (errStatus === 500) {
        setError("Server error. Coba lagi nanti.");
      } else {
        setError(errMsg);
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tableNumber, getOrCreateToken]);

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

  const updateOrderFromSocket = useCallback((updatedOrder) => {
    console.log("[ORDER] Socket Update received:", updatedOrder);
    
    setActiveOrder((current) => {
      if (!current) {
        localStorage.setItem("activeOrderId", updatedOrder._id);
        return updatedOrder;
      }

      if (current._id !== updatedOrder._id) {
        return current;
      }

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
    updateOrderFromSocket,
  };
};