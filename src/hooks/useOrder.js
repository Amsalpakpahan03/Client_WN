// import { useState, useEffect, useCallback } from "react";
// import axios from "axios";

// export const useOrder = (tableNumber) => {
//   const [activeOrder, setActiveOrder] = useState(null);

//   /* ================= CREATE ORDER ================= */
//   const createOrder = async (payload) => {
//     const token = localStorage.getItem("order_token");

//     // const res = await axios.post(
//     //   "http://localhost:5000/api/orders",
//     //   payload,
//     //   { headers: { Authorization: `Bearer ${token}` } }
//     // );

//     const res = await axios.post(
//       "https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev/api/orders",
//       payload,
//       { headers: { Authorization: `Bearer ${token}` } },
//     );

//     setActiveOrder(res.data);
//     localStorage.setItem("activeOrderId", res.data._id);
//   };

//   /* ================= RESTORE ORDER (INI KUNCI UTAMA) ================= */
//   useEffect(() => {
//     if (!tableNumber) return;

//     const orderId = localStorage.getItem("activeOrderId");
//     if (!orderId) return;

//     axios
//       .get(
//         `https://d4aa1b22-168c-44e1-a9a4-b990fed0bf50-00-2u5l4uo2l2hlm.sisko.replit.dev/api/orders/${orderId}`,
//       )
//       .then((res) => {
//         // Jika order masih aktif → tampilkan status
//         if (res.data && res.data.status !== "paid") {
//           setActiveOrder(res.data);
//         } else {
//           localStorage.removeItem("activeOrderId");
//         }
//       })
//       .catch(() => {
//         localStorage.removeItem("activeOrderId");
//       });
//   }, [tableNumber]);

//   /* ================= SOCKET UPDATE ================= */
//   // const updateOrderFromSocket = useCallback((updatedOrder) => {
//   //   setActiveOrder((current) => {
//   //     if (!current) return current;
//   //     if (current._id !== updatedOrder._id) return current;

//   //     if (updatedOrder.status === "paid") {
//   //       localStorage.removeItem("activeOrderId");
//   //       return null;
//   //     }

//   //     return { ...current, ...updatedOrder };
//   //   });
//   // }, []);
//   const updateOrderFromSocket = useCallback((updatedOrder) => {
//     setActiveOrder((current) => {
//       // jika belum ada order → socket boleh set
//       if (!current) {
//         localStorage.setItem("activeOrderId", updatedOrder._id);
//         return updatedOrder;
//       }

//       // jika order berbeda → abaikan
//       if (current._id !== updatedOrder._id) return current;

//       // jika sudah dibayar → clear
//       if (updatedOrder.status === "paid") {
//         localStorage.removeItem("activeOrderId");
//         return null;
//       }

//       return { ...current, ...updatedOrder };
//     });
//   }, []);

//   return {
//     activeOrder,
//     createOrder,
//     updateOrderFromSocket,
//   };
// };

// hooks/useOrder.js
import { useState, useEffect, useCallback } from 'react';
import { OrderAPI } from '../api/order.api';
import socket from '../api/socket';

export const useOrder = (tableNumber) => {
  const [activeOrder, setActiveOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ================= CREATE ORDER ================= */
  const createOrder = useCallback(async (payload) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("[ORDER] Creating order for table:", tableNumber, payload);
      
      const res = await OrderAPI.create(payload);
      const newOrder = res.data.data || res.data;
      
      setActiveOrder(newOrder);
      localStorage.setItem("activeOrderId", newOrder._id);
      
      console.log("[ORDER] Order created:", newOrder._id);
      return newOrder;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      console.error("[ORDER] Create Error:", errMsg);
      setError(errMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tableNumber]);

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
          console.log("[ORDER] Restored:", resData._id);
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
    console.log("[ORDER] Socket Update:", updatedOrder);
    
    setActiveOrder((current) => {
      // jika belum ada order → socket boleh set
      if (!current) {
        localStorage.setItem("activeOrderId", updatedOrder._id);
        console.log("[ORDER] Socket set new order:", updatedOrder._id);
        return updatedOrder;
      }

      // jika order berbeda → abaikan
      if (current._id !== updatedOrder._id) {
        console.log("[ORDER] Ignoring different order");
        return current;
      }

      // jika sudah dibayar → clear
      if (updatedOrder.status === "paid") {
        localStorage.removeItem("activeOrderId");
        console.log("[ORDER] Order paid, cleared");
        return null;
      }

      console.log("[ORDER] Merged socket update");
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