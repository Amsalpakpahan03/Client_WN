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
const COLORS = {
  orange: "#e65527",
  yellow: "#f3ca58",
  white: "#ffffff",
  textDark: "#2c3e50",
  textLight: "#7f8c8d"
};

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

  const handleSessionExpired = useCallback(() => {
    setShowSessionExpired(true);
    setTimeout(() => {
      navigate("/");
    }, 3000);
  }, [navigate]);

  useEffect(() => {
    const tokenFromUrl = query.get("token");
    if (tokenFromUrl) {
      if (isTokenExpired(tokenFromUrl)) {
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
      await createOrder({ tableNumber, items, totalPrice, token });
      setCart({});
    } catch (err) {
      if (err.response?.status === 401) handleSessionExpired();
      else alert(err.response?.data?.message || "Gagal membuat pesanan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const menuByCategory = useMemo(() => {
    const map = {};
    for (const item of menuItems) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return CATEGORIES.map((cat) => ({ name: cat, items: map[cat] || [] }));
  }, [menuItems]);

  const getStatusInfo = (status) => {
    switch (status) {
      case "pending": return { text: "Menunggu Konfirmasi", color: COLORS.orange, bg: "#fff5f2" };
      case "cooking": return { text: "Sedang Diproses", color: "#e67e22", bg: "#fdf2e9" };
      case "served": return { text: "Telah Diantar", color: "#27ae60", bg: "#e9f7ef" };
      case "paid": return { text: "Pembayaran Selesai", color: "#27ae60", bg: "#e9f7ef" };
      default: return { text: "Menunggu", color: "#7f8c8d", bg: "#f8f9fa" };
    }
  };

  if (showSessionExpired) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.expiredContainer}>
          <div style={styles.expiredCard}>
            <div style={{ fontSize: "64px", marginBottom: "20px" }}>✅</div>
            <h2 style={{ fontSize: "24px", color: "#27ae60", marginBottom: "12px" }}>Pesanan Selesai</h2>
            <p style={{ color: "#333", marginBottom: "30px" }}>Terima kasih telah memesan di Warung Ndeso!</p>
            <button 
              style={{ ...styles.orderButton, backgroundColor: COLORS.orange, width: "100%" }} 
              onClick={() => navigate("/")}
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLocked) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.lockedOverlay}>
          <div style={styles.lockedContent}>
            <div style={{ fontSize: "50px", marginBottom: "20px" }}>⚠️</div>
            <h2 style={{ color: COLORS.textDark }}>Meja Sedang Digunakan</h2>
            <p style={{ color: COLORS.textLight, fontSize: "14px", marginBottom: "20px" }}>
              Maaf, meja nomor <b>{tableNumber}</b> sedang diakses oleh pelanggan lain.
            </p>
            <button style={{ ...styles.orderButton, backgroundColor: COLORS.orange, width: "100%" }} onClick={() => window.location.reload()}>Cek Lagi</button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={styles.pageWrapper}>
      {/* HEADER KUNING FULL */}
      <div style={styles.yellowHeader}>
        <h2 style={styles.headerTableText}>Meja {tableNumber}</h2>
      </div>

      {/* KONTAINER MENU MELENGKUNG */}
      <div style={styles.contentContainer}>
        {showLockAlert && (
          <div style={styles.alertOverlay}>
            <div style={styles.alertBox}>🔒 Meja {tableNumber} sedang digunakan</div>
          </div>
        )}

        {activeOrder ? (
          <div style={{ padding: "0 20px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <div style={{ ...styles.statusChip, backgroundColor: getStatusInfo(activeOrder.status).bg, color: getStatusInfo(activeOrder.status).color }}>
                {getStatusInfo(activeOrder.status).text}
              </div>
            </div>
            {activeOrder.items.map((item, idx) => (
              <div key={idx} style={styles.orderItemRow}>
                <span>{item.quantity}x {item.name}</span>
                <span style={{ fontWeight: "bold", color: COLORS.orange }}>Rp {(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div style={styles.totalSection}>
              <span>TOTAL:</span>
              <span style={styles.totalValue}>Rp {(activeOrder.totalPrice || 0).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div style={{ padding: "0 20px 100px 20px" }}>
            {menuByCategory.map((cat) => cat.items.length > 0 && (
              <div key={cat.name} style={{ marginBottom: "25px" }}>
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
          </div>
        )}
      </div>

      {/* CART FLOATING BAR */}
      {!!Object.keys(cart).length && !activeOrder && (
        <div style={styles.cartBar}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "11px", color: "#888" }}>Total Pesanan</span>
            <b style={styles.cartTotal}>Rp {totalPrice.toLocaleString()}</b>
          </div>
          <button 
            style={{ ...styles.orderButton, backgroundColor: COLORS.orange, opacity: isSubmitting ? 0.7 : 1 }}
            onClick={handleOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? "..." : "PESAN SEKARANG"}
          </button>
        </div>
      )}
      <Footer />
    </div>
  );
}

const MenuItem = React.memo(function MenuItem({ item, qty, onAdd, onRemove }) {
  const ASSET_URL = process.env.REACT_APP_ASSET_URL;
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
            <button style={styles.qtyBtnSmall} onClick={() => onRemove(item)}>−</button>
            <span style={{ fontWeight: "bold", minWidth: "20px", textAlign: "center", fontSize: "14px" }}>{qty}</span>
            <button style={styles.qtyBtnSmall} onClick={() => onAdd(item)}>+</button>
          </div>
        ) : (
          <button style={{ ...styles.addButton, color: COLORS.orange, borderColor: COLORS.orange }} onClick={() => onAdd(item)}>
            Tambah
          </button>
        )}
      </div>
    </div>
  );
});

/* ================= STYLES ================= */
const styles = {
  pageWrapper: {
    backgroundColor: COLORS.white,
    minHeight: "100vh",
    maxWidth: "500px",
    margin: "0 auto",
    position: "relative",
    display: "flex",
    flexDirection: "column"
  },
  yellowHeader: {
    backgroundColor: COLORS.yellow,
    height: "160px", 
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "30px",
    position: "relative",
    zIndex: 1
  },
  headerTableText: {
    color: COLORS.white,
    fontSize: "26px",
    fontWeight: "800",
    margin: 0
  },
  contentContainer: {
    flex: 1,
    position: "relative",
    zIndex: 2,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: "35px",
    borderTopRightRadius: "35px",
    marginTop: "-60px", // Menarik kontainer putih ke atas header kuning
    paddingTop: "35px",
    minHeight: "600px",
    boxShadow: "0 -10px 20px rgba(0,0,0,0.05)"
  },
  categoryHeading: {
    borderLeft: `5px solid ${COLORS.orange}`,
    paddingLeft: "15px",
    color: COLORS.orange,
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "18px"
  },
  menuCard: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    background: "#fff",
    padding: "15px",
    borderRadius: "20px",
    marginBottom: "15px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.06)",
    border: "1px solid #f2f2f2"
  },
  menuImage: {
    width: "85px",
    height: "85px",
    borderRadius: "15px",
    objectFit: "cover"
  },
  menuInfo: { flex: 1 },
  menuName: { fontWeight: "bold", fontSize: "16px", color: "#333", marginBottom: "4px" },
  menuDesc: { fontSize: "11px", color: "#888", marginBottom: "6px", lineHeight: "1.4" },
  menuPrice: { fontWeight: "800", color: COLORS.orange, fontSize: "15px" },
  menuAction: { flexShrink: 0 },
  addButton: {
    padding: "7px 20px",
    borderRadius: "15px",
    border: "2px solid",
    background: "transparent",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "13px"
  },
  qtyWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#f9f9f9",
    padding: "5px",
    borderRadius: "12px",
    border: "1px solid #eee"
  },
  qtyBtnSmall: {
    width: "30px",
    height: "30px",
    border: "none",
    background: COLORS.orange,
    color: "#fff",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  cartBar: {
    position: "fixed",
    bottom: 25,
    left: "50%",
    transform: "translateX(-50%)",
    width: "92%",
    maxWidth: "460px",
    background: "#fff",
    padding: "15px 25px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: "22px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
    zIndex: 100,
    border: "1px solid #eee"
  },
  cartTotal: { fontSize: "18px", color: COLORS.orange, fontWeight: "800" },
  orderButton: {
    color: "#fff",
    border: "none",
    padding: "12px 25px",
    borderRadius: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "14px"
  },
  orderHeader: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "20px"
  },
  statusChip: {
    padding: "8px 20px",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: "600"
  },
  orderItemRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 0",
    borderBottom: "1px dashed #ddd",
    fontSize: "15px"
  },
  totalSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "25px",
    paddingTop: "20px",
    borderTop: `2px solid ${COLORS.yellow}`
  },
  totalValue: { fontSize: "22px", color: COLORS.orange, fontWeight: "900" },
  expiredContainer: { flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" },
  expiredCard: { background: "#fff", padding: "40px", borderRadius: "30px", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", width: "100%" },
  lockedOverlay: { flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" },
  lockedContent: { background: "#fff", padding: "40px", borderRadius: "30px", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", width: "100%" },
  alertOverlay: { position: "fixed", top: "20px", left: 0, right: 0, zIndex: 1000, display: "flex", justifyContent: "center" },
  alertBox: { background: "rgba(0,0,0,0.8)", color: "#fff", padding: "10px 20px", borderRadius: "12px", fontSize: "13px" }
};

export default OrderMenu;