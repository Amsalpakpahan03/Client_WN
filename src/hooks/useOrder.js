// hooks/useOrder.js
import { useState, useEffect, useCallback } from 'react';
import { OrderAPI } from '../api/order.api';
import axios from 'axios';

export const useOrder = (tableNumber) => {
  const [activeOrder, setActiveOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Validasi tableNumber
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
      // VALIDASI AWAL: Pastikan tableNumber ada
      if (!validateTableNumber()) {
        throw new Error("Table number is required. Please scan QR code again.");
      }
      
      console.log("[ORDER] Starting order creation for table:", tableNumber);
      console.log("[ORDER] Payload received from component:", payload);
      
      // Get token
      const token = await getOrCreateToken();
      console.log("[ORDER] Token obtained:", token ? "Yes (length: " + token.length + ")" : "No");
      
      // PASTIKAN: tableNumber dikirim sebagai string
      const finalTableNumber = String(tableNumber).trim();
      console.log("[ORDER] Final tableNumber value:", finalTableNumber);
      
      // 🔥 PERBAIKAN: Format payload dengan productId
      const items = (payload.items || []).map(item => ({
        productId: item.productId || null,  // ← INI YANG PENTING!
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
        totalPrice: Number(payload.totalPrice || 0)
      };
      
      console.log("[ORDER] ========== FINAL PAYLOAD ==========");
      console.log("[ORDER] tableNumber:", finalPayload.tableNumber);
      console.log("[ORDER] items count:", finalPayload.items.length);
      console.log("[ORDER] Items with productId:", JSON.stringify(finalPayload.items, null, 2));
      console.log("[ORDER] totalPrice:", finalPayload.totalPrice);
      
      // Panggil API create order
      const res = await OrderAPI.create(finalPayload);
      console.log("[ORDER] Create order response status:", res.status);
      console.log("[ORDER] Response data:", res.data);
      
      // Handle response (bisa dalam berbagai format)
      const newOrder = res.data?.data || res.data;
      
      if (!newOrder || !newOrder._id) {
        throw new Error("Invalid response: missing order ID");
      }
      
      setActiveOrder(newOrder);
      localStorage.setItem("activeOrderId", newOrder._id);
      
      console.log("[ORDER] ✅ Order created successfully. ID:", newOrder._id);
      console.log("[ORDER] Order status:", newOrder.status);
      
      return newOrder;
      
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Unknown error";
      const errStatus = err.response?.status;
      
      console.error("[ORDER] ❌ ========== ERROR DETAILS ==========");
      console.error("[ORDER] Error message:", errMsg);
      console.error("[ORDER] Error status:", errStatus);
      console.error("[ORDER] Full error object:", err);
      
      if (err.response?.data) {
        console.error("[ORDER] Server error response:", err.response.data);
      }
      
      // Tampilkan pesan error yang lebih jelas
      if (errStatus === 404) {
        setError("Endpoint order tidak ditemukan. Periksa URL backend.");
      } else if (errStatus === 400) {
        setError("Data order tidak valid: " + errMsg);
      } else if (errStatus === 401) {
        setError("Token tidak valid. Silakan scan ulang QR code.");
      } else if (errStatus === 500) {
        setError("Server error. Coba lagi nanti.");
      } else if (errMsg === "Table number is required. Please scan QR code again.") {
        setError(errMsg);
      } else {
        setError(errMsg);
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tableNumber, getOrCreateToken, validateTableNumber]);

  // Restore order from localStorage
  useEffect(() => {
    if (!tableNumber) {
      console.log("[ORDER] No tableNumber, skipping restore");
      return;
    }

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