import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export const useOrder = (tableNumber) => {
  const [activeOrder, setActiveOrder] = useState(null);

  /* ================= CREATE ORDER ================= */
  const createOrder = async (payload) => {
    const token = localStorage.getItem("order_token");

    const res = await axios.post(
      "http://localhost:5000/api/orders",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setActiveOrder(res.data);
    localStorage.setItem("activeOrderId", res.data._id);
  };

  /* ================= RESTORE ORDER (INI KUNCI UTAMA) ================= */
  useEffect(() => {
    if (!tableNumber) return;

    const orderId = localStorage.getItem("activeOrderId");
    if (!orderId) return;

    axios
      .get(`http://localhost:5000/api/orders/${orderId}`)
      .then((res) => {
        // Jika order masih aktif → tampilkan status
        if (res.data && res.data.status !== "paid") {
          setActiveOrder(res.data);
        } else {
          localStorage.removeItem("activeOrderId");
        }
      })
      .catch(() => {
        localStorage.removeItem("activeOrderId");
      });
  }, [tableNumber]);

  /* ================= SOCKET UPDATE ================= */
  const updateOrderFromSocket = useCallback((updatedOrder) => {
    setActiveOrder((current) => {
      if (!current) return current;
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
    createOrder,
    updateOrderFromSocket,
  };
};
