// pages/Kitchen.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import socket from "../api/socket";

function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingButtons, setLoadingButtons] = useState({});

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/orders");
      // Filter hanya order yang belum paid
      const activeOrders = res.data.data && Array.isArray(res.data.data) 
        ? res.data.data.filter((order) => order.status !== "paid")
        : res.data.filter((order) => order.status !== "paid");
      setOrders(activeOrders);
    } catch (err) {
      console.error("[KITCHEN] Gagal fetch orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    socket.on("newOrder", (order) => {
      if (order.status !== "paid") {
        setOrders((prev) => [order, ...prev]);
      }
    });

    socket.on("orderStatusUpdated", (updatedOrder) => {
      if (updatedOrder.status === "paid") {
        setOrders((prev) => prev.filter((o) => o._id !== updatedOrder._id));
      } else {
        setOrders((prev) =>
          prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o))
        );
      }
    });

    return () => {
      socket.off("newOrder");
      socket.off("orderStatusUpdated");
    };
  }, []);

  // Update status berdasarkan kategori
  const updateCategoryStatus = async (orderId, category, action) => {
    const buttonId = `${orderId}-${category}-${action}`;
    setLoadingButtons(prev => ({ ...prev, [buttonId]: true }));

    try {
      // Tentukan next status berdasarkan aksi
      let nextStatus = "";
      if (category === "Makanan") {
        if (action === "masak") nextStatus = "cooking";
        else if (action === "antar") nextStatus = "served";
      } else if (category === "Minuman") {
        if (action === "antar") nextStatus = "served";
      }

      console.log(
        `[KITCHEN] Updating category: ${category} to status: ${nextStatus} for order: ${orderId}`
      );

      // PERBAIKAN: Gunakan endpoint yang benar: /category-status (bukan /update-category-status)
      const response = await api.put(`/orders/${orderId}/category-status`, {
        category: category,
        status: nextStatus,
      });
      
      console.log("[KITCHEN] Update berhasil:", response.data);
      // Tidak perlu fetch ulang karena akan update via socket
    } catch (err) {
      console.error("[KITCHEN] Gagal update status:", err);
      console.error("[KITCHEN] Error response:", err.response?.data);
      alert(`Gagal memperbarui status: ${err.response?.data?.message || err.message}`);
    } finally {
      // Hapus loading state setelah 300ms
      setTimeout(() => {
        setLoadingButtons(prev => ({ ...prev, [buttonId]: false }));
      }, 300);
    }
  };

  // Helper functions
  const getFoodItems = (items) => {
    return items.filter(item => 
      item.category === "Makanan" || item.category === "Paket" || item.category === "Cemilan"
    );
  };

  const getDrinkItems = (items) => {
    return items.filter(item => item.category === "Minuman");
  };

  // Cek apakah semua makanan sudah served
  const isAllFoodServed = (items) => {
    const foodItems = getFoodItems(items);
    if (foodItems.length === 0) return false;
    return foodItems.every(item => item.status === "served");
  };

  // Cek apakah ada makanan yang sedang cooking
  const hasCookingFood = (items) => {
    const foodItems = getFoodItems(items);
    return foodItems.some(item => item.status === "cooking");
  };

  // Cek apakah ada makanan yang pending
  const hasPendingFood = (items) => {
    const foodItems = getFoodItems(items);
    return foodItems.some(item => item.status === "pending");
  };

  // Cek apakah semua minuman sudah served
  const isAllDrinkServed = (items) => {
    const drinkItems = getDrinkItems(items);
    if (drinkItems.length === 0) return false;
    return drinkItems.every(item => item.status === "served");
  };

  // Cek apakah ada minuman yang pending
  const hasPendingDrink = (items) => {
    const drinkItems = getDrinkItems(items);
    return drinkItems.some(item => item.status === "pending");
  };

  // Format waktu
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}.${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Hitung total harga
  const calculateTotal = (items) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Dapur</h1>
        <a href="/admin" style={styles.backLink}>← Admin</a>
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <div style={styles.statBox}>
          <span style={styles.statNumber}>
            {orders.reduce((acc, order) => {
              const food = getFoodItems(order.items);
              return acc + food.filter(i => i.status === "pending" || i.status === "cooking").length;
            }, 0)}
          </span>
          <span style={styles.statLabel}>Antrian Makanan</span>
        </div>
        <div style={styles.statBox}>
          <span style={styles.statNumber}>
            {orders.reduce((acc, order) => {
              const drinks = getDrinkItems(order.items);
              return acc + drinks.filter(i => i.status === "pending").length;
            }, 0)}
          </span>
          <span style={styles.statLabel}>Antrian Minuman</span>
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div style={styles.loading}>Memuat...</div>
      ) : orders.length === 0 ? (
        <div style={styles.empty}>
          <p>Tidak ada pesanan</p>
        </div>
      ) : (
        <div style={styles.orderList}>
          {orders.map((order) => {
            const foodItems = getFoodItems(order.items);
            const drinkItems = getDrinkItems(order.items);
            const totalPrice = calculateTotal(order.items);
            
            // Status untuk makanan
            const allFoodServed = isAllFoodServed(order.items);
            const hasCooking = hasCookingFood(order.items);
            const hasPending = hasPendingFood(order.items);
            
            // Status untuk minuman
            const allDrinkServed = isAllDrinkServed(order.items);
            const hasPendingDrinkItems = hasPendingDrink(order.items);

            return (
              <div key={order._id} style={styles.orderCard}>
                {/* Header Order */}
                <div style={styles.orderHeader}>
                  <span style={styles.tableNumber}>Meja {order.tableNumber}</span>
                  <span style={styles.orderTime}>{formatTime(order.createdAt)}</span>
                </div>

                {/* Daftar Item Makanan */}
                {foodItems.map((item, idx) => (
                  <div key={`food-${idx}`} style={styles.menuItem}>
                    {item.quantity}X {item.name}
                  </div>
                ))}

                {/* Daftar Item Minuman */}
                {drinkItems.map((item, idx) => (
                  <div key={`drink-${idx}`} style={styles.menuItem}>
                    {item.quantity}X {item.name}
                  </div>
                ))}

                {/* Total Harga */}
                <div style={styles.totalPrice}>
                  Rp {totalPrice.toLocaleString()}
                </div>

                {/* Tombol Aksi */}
                <div style={styles.buttonContainer}>
                  {/* Tombol untuk Makanan */}
                  {foodItems.length > 0 && (
                    <>
                      {hasPending && !hasCooking && !allFoodServed && (
                        <button
                          style={{
                            ...styles.button,
                            ...styles.buttonOrange,
                            opacity: loadingButtons[`${order._id}-Makanan-masak`] ? 0.7 : 1,
                            cursor: loadingButtons[`${order._id}-Makanan-masak`] ? "wait" : "pointer",
                          }}
                          onClick={() => updateCategoryStatus(order._id, "Makanan", "masak")}
                          disabled={loadingButtons[`${order._id}-Makanan-masak`]}
                        >
                          {loadingButtons[`${order._id}-Makanan-masak`] ? "..." : "MASAK"}
                        </button>
                      )}
                      
                      {hasCooking && !allFoodServed && (
                        <button
                          style={{
                            ...styles.button,
                            ...styles.buttonGreen,
                            opacity: loadingButtons[`${order._id}-Makanan-antar`] ? 0.7 : 1,
                            cursor: loadingButtons[`${order._id}-Makanan-antar`] ? "wait" : "pointer",
                          }}
                          onClick={() => updateCategoryStatus(order._id, "Makanan", "antar")}
                          disabled={loadingButtons[`${order._id}-Makanan-antar`]}
                        >
                          {loadingButtons[`${order._id}-Makanan-antar`] ? "..." : "ANTAR"}
                        </button>
                      )}
                      
                      {allFoodServed && (
                        <span style={styles.statusText}>DIANTAR</span>
                      )}
                    </>
                  )}

                  {/* Tombol untuk Minuman */}
                  {drinkItems.length > 0 && (
                    <>
                      {hasPendingDrinkItems && !allDrinkServed && (
                        <button
                          style={{
                            ...styles.button,
                            ...styles.buttonBlue,
                            opacity: loadingButtons[`${order._id}-Minuman-antar`] ? 0.7 : 1,
                            cursor: loadingButtons[`${order._id}-Minuman-antar`] ? "wait" : "pointer",
                          }}
                          onClick={() => updateCategoryStatus(order._id, "Minuman", "antar")}
                          disabled={loadingButtons[`${order._id}-Minuman-antar`]}
                        >
                          {loadingButtons[`${order._id}-Minuman-antar`] ? "..." : "ANTAR"}
                        </button>
                      )}
                      
                      {allDrinkServed && (
                        <span style={styles.statusText}>DIANTAR</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 600,
    margin: "0 auto",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "#f5f5f5",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    margin: 0,
    color: "#333",
  },
  backLink: {
    color: "#666",
    textDecoration: "none",
    fontSize: 14,
  },
  stats: {
    display: "flex",
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: "white",
    padding: "12px",
    borderRadius: 8,
    textAlign: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  statNumber: {
    display: "block",
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  loading: {
    textAlign: "center",
    padding: 40,
    color: "#666",
  },
  empty: {
    textAlign: "center",
    padding: 60,
    backgroundColor: "white",
    borderRadius: 8,
    color: "#999",
  },
  orderList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: "16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  orderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tableNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  orderTime: {
    fontSize: 14,
    color: "#999",
  },
  menuItem: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  totalPrice: {
    fontSize: 14,
    fontWeight: "500",
    color: "#e67e22",
    marginTop: 8,
    marginBottom: 12,
    paddingTop: 8,
    borderTop: "1px solid #eee",
  },
  buttonContainer: {
    display: "flex",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  button: {
    flex: 1,
    padding: "10px",
    borderRadius: 4,
    border: "none",
    fontSize: 13,
    fontWeight: "500",
    cursor: "pointer",
    color: "white",
    minWidth: "80px",
    transition: "all 0.2s",
  },
  buttonOrange: {
    backgroundColor: "#f39c12",
  },
  buttonGreen: {
    backgroundColor: "#27ae60",
  },
  buttonBlue: {
    backgroundColor: "#3498db",
  },
  statusText: {
    flex: 1,
    padding: "10px",
    borderRadius: 4,
    backgroundColor: "#ecf0f1",
    color: "#7f8c8d",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    minWidth: "80px",
  },
};

export default KitchenPage;