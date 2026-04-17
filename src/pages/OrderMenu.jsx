// pages/OrderMenu.jsx - Token Expired langsung ke halaman selesai
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import socket from "../api/socket";
import { useMenu } from "../hooks/useMenu";
import { useOrder } from "../hooks/useOrder";
import Footer from "../components/Footer";

/* ================= CONSTANT ================= */
const CATEGORIES = ["Paket", "Makanan", "Minuman", "Cemilan"];

function OrderMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const tableNumber = query.get("table");

  const { menuItems = [] } = useMenu();
  const { activeOrder, createOrder, updateOrderFromSocket } = useOrder(tableNumber);

  const [orderToken, setOrderToken] = useState(null);
  const [cart, setCart] = useState({});
  const [isLocked, setIsLocked] = useState(false);
  const [showLockAlert, setShowLockAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  const clientId = useMemo(() => {
    let id = localStorage.getItem("order_client_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("order_client_id", id);
    }
    return id;
  }, []);

  /* ================= CEK TOKEN EXPIRED ================= */
  const isTokenExpired = (token) => {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      return Date.now() >= exp;
    } catch (err) {
      return true;
    }
  };

  /* ================= HANDLE TOKEN EXPIRED - LANGSUNG KE PESANAN SELESAI ================= */
  const handleSessionExpired = useCallback(() => {
    setShowSessionExpired(true);
    // Redirect ke halaman utama setelah 3 detik
    setTimeout(() => {
      navigate("/");
    }, 3000);
  }, [navigate]);

  /* ================= TOKEN HANDLING ================= */
  useEffect(() => {
    const tokenFromUrl = query.get("token");
    
    if (tokenFromUrl) {
      if (isTokenExpired(tokenFromUrl)) {
        console.log("[ORDER] Token expired, redirecting to home");
        handleSessionExpired();
        return;
      }
      localStorage.setItem("order_token", tokenFromUrl);
      setOrderToken(tokenFromUrl);
    } else {
      const savedToken = localStorage.getItem("order_token");
      if (savedToken) {
        if (isTokenExpired(savedToken)) {
          localStorage.removeItem("order_token");
          handleSessionExpired();
        } else {
          setOrderToken(savedToken);
        }
      } else {
        handleSessionExpired();
      }
    }
  }, [query, handleSessionExpired]);

  /* ================= TABLE LOCK ================= */
  useEffect(() => {
    if (!tableNumber) return;

    socket.emit("tryAccessTable", { tableId: tableNumber, clientId });

    const denyHandler = () => {
      setIsLocked(true);
      setShowLockAlert(true);
      setTimeout(() => setShowLockAlert(false), 5000);
    };

    const lockedHandler = (data) => {
      if (String(data.tableId) === String(tableNumber) && data.clientId !== clientId) {
        setIsLocked(true);
        setShowLockAlert(true);
        setTimeout(() => setShowLockAlert(false), 5000);
      }
    };

    socket.on("accessDenied", denyHandler);
    socket.on("tableLocked", lockedHandler);

    const heartbeat = setInterval(() => {
      socket.emit("heartbeat", { tableId: tableNumber, clientId });
    }, 5000);

    return () => {
      clearInterval(heartbeat);
      socket.off("accessDenied", denyHandler);
      socket.off("tableLocked", lockedHandler);
    };
  }, [tableNumber, clientId]);

  /* ================= REALTIME ORDER UPDATE ================= */
  useEffect(() => {
    if (!tableNumber) return;

    socket.emit("joinTable", tableNumber);

    const handler = (updatedOrder) => {
      if (String(updatedOrder.tableNumber) !== String(tableNumber)) return;
      updateOrderFromSocket(updatedOrder);
    };

    socket.on("orderStatusUpdated", handler);

    return () => {
      socket.off("orderStatusUpdated", handler);
      socket.emit("leaveTable", tableNumber);
    };
  }, [tableNumber, updateOrderFromSocket]);

  /* ================= CART ACTION ================= */
  const addToCart = useCallback((item) => {
    setCart((prev) => ({ ...prev, [item._id]: (prev[item._id] || 0) + 1 }));
  }, []);

  const removeFromCart = useCallback((item) => {
    setCart((prev) => {
      const qty = prev[item._id] || 0;
      if (qty <= 1) {
        const copy = { ...prev };
        delete copy[item._id];
        return copy;
      }
      return { ...prev, [item._id]: qty - 1 };
    });
  }, []);

  const totalPrice = useMemo(() => {
    return menuItems.reduce((sum, item) => sum + (cart[item._id] || 0) * (item.price || 0), 0);
  }, [cart, menuItems]);

  /* ================= CREATE ORDER ================= */
  const handleOrder = async () => {
    const token = localStorage.getItem("order_token");
    
    if (!token || isTokenExpired(token)) {
      handleSessionExpired();
      return;
    }
    
    if (Object.keys(cart).length === 0) {
      alert("Silakan pilih menu terlebih dahulu");
      return;
    }

    const items = menuItems
      .filter((m) => cart[m._id])
      .map((m) => ({
        name: m.name,
        description: m.description,
        quantity: cart[m._id],
        price: m.price,
        category: m.category,
      }));

    setIsSubmitting(true);
    
    try {
      await createOrder({ 
        tableNumber, 
        items, 
        totalPrice, 
        token: token
      });
      setCart({});
    } catch (err) {
      console.error("[ORDER] Gagal membuat pesanan:", err);
      if (err.response?.status === 401) {
        handleSessionExpired();
      } else {
        alert(err.response?.data?.message || "Gagal membuat pesanan. Silakan coba lagi.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= MENU GROUPING ================= */
  const menuByCategory = useMemo(() => {
    const map = {};
    for (const item of menuItems) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return CATEGORIES.map((cat) => ({ name: cat, items: map[cat] || [] }));
  }, [menuItems]);

  /* ================= STATUS INFO ================= */
  const getStatusInfo = (status) => {
    switch (status) {
      case "pending":
        return { text: "Menunggu Konfirmasi", color: "#c0392b", bg: "#fdecea" };
      case "cooking":
        return { text: "Sedang Diproses", color: "#e67e22", bg: "#fdf2e9" };
      case "served":
        return { text: "Telah Diantar", color: "#27ae60", bg: "#e9f7ef" };
      case "paid":
        return { text: "Pembayaran Selesai", color: "#27ae60", bg: "#e9f7ef" };
      default:
        return { text: "Menunggu", color: "#7f8c8d", bg: "#f8f9fa" };
    }
  };

  const getDrinkItems = (items) => items.filter(item => item.category === "Minuman");

  // ================= SESSION EXPIRED COMPONENT =================
  if (showSessionExpired) {
    return (
      <>
        <div style={styles.expiredContainer}>
          <div style={styles.expiredCard}>
            <div style={styles.expiredIcon}>✅</div>
            <h2 style={styles.expiredTitle}>Pesanan Selesai</h2>
            <p style={styles.expiredMessage}>
              Terima kasih telah memesan di Warung Ndeso!
            </p>
            <p style={styles.expiredSubMessage}>
              Silakan scan QR Code lagi untuk pesanan berikutnya
            </p>
            <button 
              style={styles.expiredButton}
              onClick={() => navigate("/")}
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const LockAlert = () => (
    <div style={styles.alertOverlay}>
      <div style={styles.alertBox}>
        <div style={styles.alertIcon}>🔒</div>
        <div style={styles.alertContent}>
          <h4 style={styles.alertTitle}>Meja Sedang Digunakan</h4>
          <p style={styles.alertMessage}>Meja {tableNumber} sedang digunakan oleh pelanggan lain.</p>
        </div>
      </div>
    </div>
  );

  // ================= LOCKED STATE =================
  if (isLocked) {
    return (
      <>
        <div style={styles.lockedOverlay}>
          <div style={styles.lockedContent}>
            <div style={{ fontSize: "50px", marginBottom: "20px" }}>⚠️</div>
            <h2 style={{ color: "#2c3e50" }}>Meja Sedang Digunakan</h2>
            <p style={{ color: "#7f8c8d", lineHeight: "1.5", fontSize: "14px" }}>
              Maaf, meja nomor <b>{tableNumber}</b> sedang diakses oleh pelanggan lain.
            </p>
            <button style={styles.refreshBtn} onClick={() => window.location.reload()}>Cek Lagi</button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ================= ACTIVE ORDER STATE =================
  if (activeOrder) {
    const status = getStatusInfo(activeOrder.status);
    const drinkItems = getDrinkItems(activeOrder.items);
    const foodItems = activeOrder.items.filter(item => 
      item.category === "Makanan" || item.category === "Paket" || item.category === "Cemilan"
    );
    const totalPrice = activeOrder.totalPrice || activeOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
      <>
        <div style={styles.container}>
          {showLockAlert && <LockAlert />}
          
          <div style={styles.orderHeader}>
            <h2 style={styles.tableTitle}>Meja {tableNumber}</h2>
            <div style={{ ...styles.statusChip, backgroundColor: status.bg, color: status.color }}>
              {status.text}
            </div>
          </div>

          {drinkItems.length > 0 && (
            <div style={styles.categoryBlock}>
              <div style={styles.categoryTitle}>Minuman</div>
              {drinkItems.map((item, idx) => (
                <div key={idx} style={styles.orderItemRow}>
                  <span>{item.quantity}x {item.name}</span>
                  <span style={{
                    ...styles.itemStatus,
                    color: item.status === "served" ? "#27ae60" : "#0EA5E9"
                  }}>
                    {item.status === "served" ? "Diantar" : "Siap"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {foodItems.length > 0 && (
            <div style={styles.categoryBlock}>
              <div style={styles.categoryTitle}>Makanan</div>
              {foodItems.map((item, idx) => (
                <div key={idx} style={styles.orderItemRow}>
                  <span>{item.quantity}x {item.name}</span>
                </div>
              ))}
            </div>
          )}

          <div style={styles.totalSection}>
            <span style={styles.totalLabel}>TOTAL:</span>
            <span style={styles.totalValue}>Rp {totalPrice.toLocaleString()}</span>
          </div>

          <p style={styles.infoNote}>
            Minuman akan langsung diantar ketika siap
          </p>
        </div>
        <Footer />
      </>
    );
  }

  // ================= MENU STATE (ORDER FORM) =================
  return (
    <>
      <div style={styles.container}>
        {showLockAlert && <LockAlert />}
        
        <h2 style={styles.pageTitle}>Warung Ndeso – Meja {tableNumber}</h2>

        {menuByCategory.map((cat) => cat.items.length > 0 && (
          <div key={cat.name}>
            <h3 style={styles.categoryHeading}>{cat.name}</h3>
            {cat.items.map((item) => (
              <MenuItem
                key={item._id}
                item={item}
                qty={cart[item._id] || 0}
                onAdd={addToCart}
                onRemove={removeFromCart}
              />
            ))}
          </div>
        ))}

        {!!Object.keys(cart).length && (
          <div style={styles.cartBar}>
            <b style={styles.cartTotal}>Rp {totalPrice.toLocaleString()}</b>
            <button 
              style={{
                ...styles.orderButton,
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? "wait" : "pointer"
              }}
              onClick={handleOrder}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Memproses..." : "PESAN"}
            </button>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}

/* ================= MENU ITEM COMPONENT ================= */
const ASSET_URL = process.env.REACT_APP_ASSET_URL;

const MenuItem = React.memo(function MenuItem({ item, qty, onAdd, onRemove }) {
  return (
    <div style={styles.menuCard}>
      <img
        src={item.image_url?.startsWith("http") ? item.image_url : `${ASSET_URL}/uploads/${item.image_url || "no-image.png"}`}
        alt={item.name}
        style={styles.menuImage}
      />
      <div style={styles.menuInfo}>
        <div style={styles.menuName}>{item.name}</div>
        {item.description && <div style={styles.menuDesc}>{item.description}</div>}
        <div style={styles.menuPrice}>Rp {item.price.toLocaleString()}</div>
      </div>
      <div style={styles.menuAction}>
        {qty ? (
          <div style={styles.qtyWrapper}>
            <button style={styles.qtyButton} onClick={() => onRemove(item)}>−</button>
            <span>{qty}</span>
            <button style={styles.qtyButton} onClick={() => onAdd(item)}>+</button>
          </div>
        ) : (
          <button style={styles.addButton} onClick={() => onAdd(item)}>Tambah</button>
        )}
      </div>
    </div>
  );
});

/* ================= STYLES ================= */
const styles = {
  container: { 
    padding: "20px", 
    maxWidth: "500px", 
    margin: "0 auto",
    minHeight: "calc(100vh - 80px)",
    backgroundColor: "#f8f9fa"
  },
  
  pageTitle: { 
    textAlign: "center", 
    color: "#2c3e50", 
    marginBottom: "20px",
    fontSize: "20px",
    fontWeight: "500"
  },
  
  orderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    paddingBottom: "10px",
    borderBottom: "1px solid #e0e0e0"
  },
  tableTitle: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#333",
    margin: 0
  },
  statusChip: {
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "500"
  },
  
  categoryBlock: {
    marginBottom: "24px"
  },
  categoryTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#c0392b",
    marginBottom: "10px",
    paddingLeft: "8px",
    borderLeft: "3px solid #c0392b"
  },
  orderItemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #f0f0f0",
    fontSize: "14px",
    color: "#333"
  },
  itemStatus: {
    fontSize: "12px",
    fontWeight: "500"
  },
  
  totalSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "16px",
    paddingTop: "12px",
    borderTop: "2px solid #e0e0e0"
  },
  totalLabel: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#333"
  },
  totalValue: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#c0392b"
  },
  
  infoNote: {
    textAlign: "center",
    fontSize: "11px",
    color: "#7f8c8d",
    marginTop: "20px",
    padding: "10px",
    backgroundColor: "#fff",
    borderRadius: "8px"
  },
  
  categoryHeading: { 
    borderLeft: "4px solid #c0392b", 
    paddingLeft: "10px", 
    color: "#c0392b", 
    marginBottom: "15px",
    fontSize: "16px",
    fontWeight: "500"
  },
  
  menuCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "#fff",
    padding: "12px",
    borderRadius: "12px",
    marginBottom: "10px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
  },
  menuImage: {
    width: "60px",
    height: "60px",
    borderRadius: "10px",
    objectFit: "cover"
  },
  menuInfo: {
    flex: 1
  },
  menuName: {
    fontWeight: "600",
    fontSize: "14px",
    marginBottom: "2px",
    color: "#2c3e50"
  },
  menuDesc: {
    fontSize: "11px",
    color: "#999",
    marginBottom: "4px"
  },
  menuPrice: {
    fontSize: "13px",
    fontWeight: "bold",
    color: "#c0392b"
  },
  menuAction: {
    flexShrink: 0
  },
  
  qtyWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#f0f0f0",
    borderRadius: "20px",
    padding: "4px 10px"
  },
  qtyButton: {
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    border: "none",
    background: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "16px",
    color: "#c0392b"
  },
  addButton: {
    padding: "6px 14px",
    borderRadius: "20px",
    border: "1px solid #c0392b",
    background: "#fff",
    color: "#c0392b",
    fontSize: "12px",
    cursor: "pointer"
  },
  
  cartBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fff",
    padding: "12px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
    borderTop: "1px solid #eee"
  },
  cartTotal: {
    color: "#c0392b",
    fontSize: "16px"
  },
  orderButton: {
    background: "#c0392b",
    color: "#fff",
    border: "none",
    padding: "10px 24px",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer"
  },
  
  // Session Expired / Pesanan Selesai styles
  expiredContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "calc(100vh - 80px)",
    padding: "20px",
    backgroundColor: "#f8f9fa"
  },
  expiredCard: {
    backgroundColor: "white",
    borderRadius: "20px",
    padding: "40px 30px",
    textAlign: "center",
    maxWidth: "400px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)"
  },
  expiredIcon: {
    fontSize: "64px",
    marginBottom: "20px"
  },
  expiredTitle: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#27ae60",
    marginBottom: "12px"
  },
  expiredMessage: {
    fontSize: "16px",
    color: "#333",
    marginBottom: "8px"
  },
  expiredSubMessage: {
    fontSize: "13px",
    color: "#666",
    marginBottom: "30px"
  },
  expiredButton: {
    backgroundColor: "#c0392b",
    color: "white",
    border: "none",
    padding: "12px 24px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer"
  },
  
  lockedOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(255,255,255,0.98)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    textAlign: "center"
  },
  lockedContent: {
    background: "#fff",
    padding: "30px 20px",
    borderRadius: "16px",
    maxWidth: "300px"
  },
  refreshBtn: {
    marginTop: "20px",
    padding: "10px 20px",
    borderRadius: "25px",
    border: "none",
    background: "#c0392b",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%"
  },
  
  alertOverlay: {
    position: "fixed",
    top: "20px",
    left: "20px",
    right: "20px",
    zIndex: 10000,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none"
  },
  alertBox: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    maxWidth: "350px",
    border: "1px solid #fdecea",
    pointerEvents: "auto",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
  },
  alertIcon: {
    fontSize: "20px",
    background: "#fdecea",
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  alertTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: "600",
    color: "#c0392b"
  },
  alertMessage: {
    margin: 0,
    fontSize: "12px",
    color: "#7f8c8d"
  }
};

export default OrderMenu;