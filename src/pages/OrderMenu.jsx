import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  textLight: "#7f8c8d",
};

function OrderMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const tableNumber = query.get("table");

  const { menuItems = [] } = useMenu();
  const { activeOrder, createOrder, updateOrderFromSocket } =
    useOrder(tableNumber);

  const [orderToken, setOrderToken] = useState(null);
  const [cart, setCart] = useState({});
  const [isLocked, setIsLocked] = useState(false);
  const [showLockAlert, setShowLockAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [orderProgress, setOrderProgress] = useState(0);
  const [showOrderAnimation, setShowOrderAnimation] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [deliveredItems, setDeliveredItems] = useState({});
  const [activeCategory, setActiveCategory] = useState("Paket");

  // Refs untuk scroll ke kategori
  const categoryRefs = useRef({});

  const clientId = useMemo(() => {
    let id = localStorage.getItem("order_client_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("order_client_id", id);
    }
    return id;
  }, []);

  // Load saved cart from localStorage on mount
  useEffect(() => {
    if (tableNumber) {
      const savedCartKey = `cart_${tableNumber}`;
      const savedCart = localStorage.getItem(savedCartKey);
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          setCart(parsedCart);
        } catch (e) {
          console.error("Failed to parse saved cart", e);
        }
      }
    }
  }, [tableNumber]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (tableNumber && Object.keys(cart).length > 0) {
      const savedCartKey = `cart_${tableNumber}`;
      localStorage.setItem(savedCartKey, JSON.stringify(cart));
    } else if (tableNumber && Object.keys(cart).length === 0) {
      const savedCartKey = `cart_${tableNumber}`;
      localStorage.removeItem(savedCartKey);
    }
  }, [cart, tableNumber]);

  // Load saved delivered items from localStorage
  useEffect(() => {
    if (tableNumber && activeOrder?._id) {
      const savedDeliveredKey = `delivered_${tableNumber}_${activeOrder._id}`;
      const savedDelivered = localStorage.getItem(savedDeliveredKey);
      if (savedDelivered) {
        try {
          const parsedDelivered = JSON.parse(savedDelivered);
          setDeliveredItems(parsedDelivered);
        } catch (e) {
          console.error("Failed to parse saved delivered items", e);
        }
      }
    }
  }, [tableNumber, activeOrder?._id]);

  // Save delivered items to localStorage
  useEffect(() => {
    if (tableNumber && activeOrder?._id && Object.keys(deliveredItems).length > 0) {
      const savedDeliveredKey = `delivered_${tableNumber}_${activeOrder._id}`;
      localStorage.setItem(savedDeliveredKey, JSON.stringify(deliveredItems));
    }
  }, [deliveredItems, tableNumber, activeOrder?._id]);

  // Load saved progress from localStorage
  useEffect(() => {
    if (tableNumber && activeOrder?._id) {
      const savedProgressKey = `progress_${tableNumber}_${activeOrder._id}`;
      const savedProgress = localStorage.getItem(savedProgressKey);
      if (savedProgress) {
        setOrderProgress(parseInt(savedProgress));
      }
    }
  }, [tableNumber, activeOrder?._id]);

  // Save progress to localStorage
  useEffect(() => {
    if (tableNumber && activeOrder?._id && orderProgress > 0) {
      const savedProgressKey = `progress_${tableNumber}_${activeOrder._id}`;
      localStorage.setItem(savedProgressKey, orderProgress.toString());
    }
  }, [orderProgress, tableNumber, activeOrder?._id]);

  // Clear saved data when order is completed (paid)
  useEffect(() => {
    if (activeOrder?.status === "paid" && tableNumber && activeOrder?._id) {
      const savedCartKey = `cart_${tableNumber}`;
      const savedDeliveredKey = `delivered_${tableNumber}_${activeOrder._id}`;
      const savedProgressKey = `progress_${tableNumber}_${activeOrder._id}`;
      
      localStorage.removeItem(savedCartKey);
      localStorage.removeItem(savedDeliveredKey);
      localStorage.removeItem(savedProgressKey);
    }
  }, [activeOrder?.status, tableNumber, activeOrder?._id]);

  // Calculate statistics for delivered items
  const deliveredStats = useMemo(() => {
    const items =
      activeOrder?.items && Array.isArray(activeOrder.items)
        ? activeOrder.items
        : [];
    const totalItems = items.length;
    const deliveredCount = items.filter(
      (item) => item?.name && deliveredItems[item.name]?.delivered
    ).length;
    const drinkItems = items.filter((item) => item?.category === "Minuman");
    const drinkDelivered = drinkItems.filter(
      (item) => item?.name && deliveredItems[item.name]?.delivered
    ).length;

    return {
      totalItems,
      deliveredCount,
      drinkItems: drinkItems.length,
      drinkDelivered,
      hasPartialDelivery: deliveredCount > 0 && deliveredCount < totalItems,
    };
  }, [activeOrder, deliveredItems]);

  const isTokenExpired = (token) => {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
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
      if (
        String(data.tableId) === String(tableNumber) &&
        data.clientId !== clientId
      ) {
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
      updateProgressByStatus(updatedOrder.status);

      if (updatedOrder.items && Array.isArray(updatedOrder.items)) {
        const newDelivered = {};
        updatedOrder.items.forEach((item) => {
          if (item.status === "served" || item.isDelivered === true) {
            newDelivered[item.name] = {
              delivered: true,
              deliveredAt: item.deliveredAt || new Date().toISOString(),
              category: item.category,
            };
          } else if (deliveredItems[item.name]) {
            newDelivered[item.name] = deliveredItems[item.name];
          }
        });
        setDeliveredItems(newDelivered);
      }
    };

    const itemDeliveredHandler = (data) => {
      if (String(data.tableNumber) !== String(tableNumber)) return;
      setDeliveredItems((prev) => ({
        ...prev,
        [data.itemName]: {
          delivered: true,
          deliveredAt: data.deliveredAt || new Date().toISOString(),
          category: data.category,
        },
      }));
    };

    socket.on("orderStatusUpdated", handler);
    socket.on("itemDelivered", itemDeliveredHandler);

    return () => {
      socket.off("orderStatusUpdated", handler);
      socket.off("itemDelivered", itemDeliveredHandler);
      socket.emit("leaveTable", tableNumber);
    };
  }, [tableNumber, updateOrderFromSocket, deliveredItems]);

  const updateProgressByStatus = (status) => {
    let progress = 0;
    switch (status) {
      case "pending":
        progress = 25;
        break;
      case "cooking":
        progress = 60;
        break;
      case "served":
        progress = 100;
        break;
      case "paid":
        progress = 100;
        break;
      default:
        progress = 0;
    }
    setOrderProgress(progress);
  };

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
    if (!Array.isArray(menuItems) || menuItems.length === 0) return 0;
    return menuItems.reduce(
      (sum, item) => sum + (cart[item._id] || 0) * (item.price || 0),
      0
    );
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
        status: "pending",
      }));

    setIsSubmitting(true);
    setShowOrderAnimation(true);
    setAnimationProgress(0);

    try {
      await createOrder({ tableNumber, items, totalPrice, token });
      setCart({});
      
      const savedCartKey = `cart_${tableNumber}`;
      localStorage.removeItem(savedCartKey);

      for (let i = 0; i <= 100; i += 5) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        setAnimationProgress(i);
      }

      setTimeout(() => setShowOrderAnimation(false), 500);
    } catch (err) {
      setShowOrderAnimation(false);
      if (err.response?.status === 401) handleSessionExpired();
      else alert(err.response?.data?.message || "Gagal membuat pesanan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Scroll ke kategori tertentu
  const scrollToCategory = (category) => {
    setActiveCategory(category);
    const ref = categoryRefs.current[category];
    if (ref) {
      ref.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const menuByCategory = useMemo(() => {
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      return CATEGORIES.map((cat) => ({ name: cat, items: [] }));
    }
    const map = {};
    for (const item of menuItems) {
      if (item && item.category) {
        if (!map[item.category]) map[item.category] = [];
        map[item.category].push(item);
      }
    }
    return CATEGORIES.map((cat) => ({ name: cat, items: map[cat] || [] }));
  }, [menuItems]);

  const getStatusInfo = (status) => {
    switch (status) {
      case "pending":
        return {
          text: "Menunggu Konfirmasi",
          color: COLORS.orange,
          bg: "#fff5f2",
        };
      case "cooking":
        return { text: "Diproses", color: "#e67e22", bg: "#fdf2e9" };
      case "served":
        return { text: "Diantar", color: "#27ae60", bg: "#e9f7ef" };
      case "paid":
        return { text: "Pembayaran Selesai", color: "#27ae60", bg: "#e9f7ef" };
      default:
        return { text: "Menunggu", color: "#7f8c8d", bg: "#f8f9fa" };
    }
  };

  // Early returns after all hooks
  if (showSessionExpired) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.expiredContainer}>
          <div style={styles.expiredCard}>
            <div style={{ fontSize: "64px", marginBottom: "20px" }}>✓</div>
            <h2
              style={{
                fontSize: "24px",
                color: "#27ae60",
                marginBottom: "12px",
              }}
            >
              Pesanan Selesai
            </h2>
            <p style={{ color: "#333", marginBottom: "30px" }}>
              Terima kasih telah memesan di Warung Ndeso!
            </p>
            <button
              style={{
                ...styles.orderButton,
                backgroundColor: COLORS.orange,
                width: "100%",
              }}
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
            <div style={{ fontSize: "50px", marginBottom: "20px" }}>🔒</div>
            <h2 style={{ color: COLORS.textDark }}>Meja Sedang Digunakan</h2>
            <p
              style={{
                color: COLORS.textLight,
                fontSize: "14px",
                marginBottom: "20px",
              }}
            >
              Maaf, meja nomor <b>{tableNumber}</b> sedang diakses oleh
              pelanggan lain.
            </p>
            <button
              style={{
                ...styles.orderButton,
                backgroundColor: COLORS.orange,
                width: "100%",
              }}
              onClick={() => window.location.reload()}
            >
              Cek Lagi
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!tableNumber) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.yellowHeader}>
          <h2 style={styles.headerTableText}>Error</h2>
        </div>
        <div style={styles.contentContainer}>
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <h2 style={{ color: COLORS.textDark }}>Nomor Meja Tidak Valid</h2>
            <button
              style={{
                ...styles.orderButton,
                backgroundColor: COLORS.orange,
                marginTop: 20,
              }}
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

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.yellowHeader}>
        <h2 style={styles.headerTableText}>Meja {tableNumber}</h2>
      </div>

      <div style={styles.contentContainer}>
        {showLockAlert && (
          <div style={styles.alertOverlay}>
            <div style={styles.alertBox}>
              Meja {tableNumber} sedang digunakan
            </div>
          </div>
        )}

        {activeOrder ? (
          <div style={{ padding: "0 20px" }}>
            <div style={styles.statusContainer}>
              <div style={styles.statusHeader}>
                <div style={styles.statusTextContainer}>
                  <div
                    style={{
                      ...styles.statusChip,
                      backgroundColor: getStatusInfo(activeOrder.status)?.bg || "#f8f9fa",
                      color: getStatusInfo(activeOrder.status)?.color || "#7f8c8d",
                    }}
                  >
                    {getStatusInfo(activeOrder.status)?.text || "Menunggu"}
                  </div>
                </div>
              </div>

              <div style={styles.progressWrapper}>
                <div style={styles.progressSteps}>
                  {["pending", "cooking", "served"].map((stepStatus, idx) => {
                    const safeProgress = typeof orderProgress === 'number' ? orderProgress : 0;
                    const isActive = safeProgress >= (idx + 1) * 33;
                    const isCurrent = activeOrder.status === stepStatus;
                    const stepInfo = getStatusInfo(stepStatus);
                    return (
                      <div key={stepStatus} style={styles.progressStep}>
                        <div
                          style={{
                            ...styles.progressDot,
                            backgroundColor: isActive ? COLORS.orange : "#e0e0e0",
                            transform: isCurrent ? "scale(1.2)" : "scale(1)",
                            boxShadow: isCurrent ? `0 0 0 3px ${COLORS.orange}40` : "none",
                          }}
                        >
                          {isActive && <div style={styles.progressDotInner} />}
                        </div>
                        <div
                          style={{
                            ...styles.progressLabel,
                            color: isActive ? COLORS.orange : "#999",
                            fontWeight: isCurrent ? "600" : "400",
                          }}
                        >
                          {stepInfo?.text?.split(" ")[0] || "Menunggu"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={styles.progressBarContainer}>
                  <div
                    style={{
                      ...styles.progressBarFill,
                      width: `${typeof orderProgress === 'number' ? orderProgress : 0}%`,
                      transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    <div style={styles.progressGlow} />
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.orderItemsContainer}>
              {activeOrder.items &&
                Array.isArray(activeOrder.items) &&
                activeOrder.items.map((item, idx) => {
                  if (!item || typeof item !== "object") return null;

                  const isDelivered = deliveredItems[item.name]?.delivered === true;
                  const deliveredData = deliveredItems[item.name];
                  const isDrink = item.category === "Minuman";

                  return (
                    <div key={idx} style={styles.orderItemRow}>
                      <div style={styles.orderItemInfo}>
                        <span style={styles.orderItemQuantity}>
                          {item.quantity || 0}x
                        </span>
                        <span style={styles.orderItemName}>
                          {item.name || "Unknown"}
                          {isDelivered && (
                            <span style={styles.deliveredBadge}>
                              <span style={styles.checkIcon}>✓</span> Sudah Diantar
                            </span>
                          )}
                          {!isDelivered &&
                            isDrink &&
                            activeOrder.status === "cooking" && (
                              <span style={styles.preparingBadge}>
                                <span style={styles.clockIcon}>⏱️</span> Sedang Disiapkan
                              </span>
                            )}
                        </span>
                      </div>
                      <div style={styles.orderItemRight}>
                        <span style={{ fontWeight: "bold", color: COLORS.orange }}>
                          Rp {((item.price || 0) * (item.quantity || 0)).toLocaleString()}
                        </span>
                        {isDelivered && deliveredData?.deliveredAt && (
                          <div style={styles.deliveredTime}>
                            {new Date(deliveredData.deliveredAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div style={styles.totalSection}>
              <span>TOTAL:</span>
              <span style={styles.totalValue}>
                Rp {(activeOrder.totalPrice || 0).toLocaleString()}
              </span>
            </div>

            {deliveredStats.hasPartialDelivery &&
              deliveredStats.drinkDelivered < deliveredStats.drinkItems && (
                <div style={styles.deliveryProgress}>
                  <div style={styles.deliveryProgressText}>
                    Minuman sudah diantar, makanan masih dimasak...
                  </div>
                  <div style={styles.waveAnimation}>
                    <div style={styles.waveDot} />
                    <div style={styles.waveDot} />
                    <div style={styles.waveDot} />
                  </div>
                </div>
              )}
          </div>
        ) : (
          <>
            {/* TAB NAVIGATOR KATEGORI - SEPERTI GAMBAR */}
            <div style={styles.categoryTabs}>
              {CATEGORIES.map((cat) => {
                const hasItems = menuByCategory.find(c => c.name === cat)?.items.length > 0;
                return (
                  <button
                    key={cat}
                    onClick={() => scrollToCategory(cat)}
                    style={{
                      ...styles.categoryTab,
                      backgroundColor: activeCategory === cat ? COLORS.orange : "transparent",
                      color: activeCategory === cat ? "white" : COLORS.textDark,
                      borderBottom: activeCategory === cat ? `2px solid ${COLORS.orange}` : "2px solid transparent",
                      opacity: hasItems ? 1 : 0.5,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* MENU PER KATEGORI */}
            <div style={{ padding: "0 20px 100px 20px" }}>
              {menuByCategory.map(
                (cat) =>
                  cat.items.length > 0 && (
                    <div
                      key={cat.name}
                      ref={(el) => (categoryRefs.current[cat.name] = el)}
                      style={{ marginBottom: "30px" }}
                    >
                      <div style={styles.categoryHeaderWrapper}>
                        <div style={styles.categoryIcon}>
                          {cat.name === "Paket" && "📦"}
                          {cat.name === "Makanan" && "🍽️"}
                          {cat.name === "Minuman" && "🥤"}
                          {cat.name === "Cemilan" && "🍪"}
                        </div>
                        <h3 style={styles.categoryHeading}>{cat.name}</h3>
                        <div style={styles.categoryLine} />
                      </div>
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
                  )
              )}
            </div>
          </>
        )}
      </div>

      {showOrderAnimation && (
        <div style={styles.loadingOverlay}>
          <div style={styles.loadingCard}>
            <div style={styles.spinner}>
              <div style={styles.spinnerCircle} />
            </div>
            <h3 style={styles.loadingTitle}>Memproses Pesanan</h3>
            <div style={styles.loadingBar}>
              <div
                style={{
                  ...styles.loadingFill,
                  width: `${animationProgress}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {!!Object.keys(cart).length && !activeOrder && (
        <div style={styles.cartBar}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "11px", color: "#888" }}>
              Total Pesanan
            </span>
            <b style={styles.cartTotal}>Rp {totalPrice.toLocaleString()}</b>
          </div>
          <button
            style={{
              ...styles.orderButton,
              backgroundColor: COLORS.orange,
              opacity: isSubmitting ? 0.7 : 1,
            }}
            onClick={handleOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? <div style={styles.buttonSpinner} /> : "PESAN SEKARANG"}
          </button>
        </div>
      )}
      <Footer />
    </div>
  );
}

const MenuItem = React.memo(function MenuItem({ item, qty, onAdd, onRemove }) {
  const ASSET_URL = process.env.REACT_APP_ASSET_URL || "http://localhost:5000";

  if (!item) return null;

  const getImageUrl = () => {
    if (!item.image_url) return `${ASSET_URL}/uploads/no-image.png`;
    if (item.image_url.startsWith("http")) return item.image_url;
    return `${ASSET_URL}/uploads/${item.image_url}`;
  };

  return (
    <div style={styles.menuCard}>
      <img
        src={getImageUrl()}
        alt={item.name || "Menu item"}
        style={styles.menuImage}
        onError={(e) => {
          e.target.src = `${ASSET_URL}/uploads/no-image.png`;
        }}
      />
      <div style={styles.menuInfo}>
        <div style={styles.menuName}>{item.name || "Unknown"}</div>
        {item.description && <div style={styles.menuDesc}>{item.description}</div>}
        <div style={styles.menuPrice}>Rp {(item.price || 0).toLocaleString()}</div>
      </div>
      <div style={styles.menuAction}>
        {qty > 0 ? (
          <div style={styles.qtyWrapper}>
            <button style={styles.qtyBtnSmall} onClick={() => onRemove(item)}>−</button>
            <span
              style={{
                fontWeight: "bold",
                minWidth: "20px",
                textAlign: "center",
                fontSize: "14px",
              }}
            >
              {qty}
            </span>
            <button style={styles.qtyBtnSmall} onClick={() => onAdd(item)}>+</button>
          </div>
        ) : (
          <button
            style={{
              ...styles.addButton,
              color: COLORS.orange,
              borderColor: COLORS.orange,
            }}
            onClick={() => onAdd(item)}
          >
            Tambah
          </button>
        )}
      </div>
    </div>
  );
});

const styles = {
  pageWrapper: {
    backgroundColor: COLORS.white,
    minHeight: "100vh",
    maxWidth: "500px",
    margin: "0 auto",
    position: "relative",
    display: "flex",
    flexDirection: "column",
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
    zIndex: 1,
  },
  headerTableText: {
    color: COLORS.white,
    fontSize: "26px",
    fontWeight: "800",
    margin: 0,
  },
  contentContainer: {
    flex: 1,
    position: "relative",
    zIndex: 2,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: "35px",
    borderTopRightRadius: "35px",
    marginTop: "-60px",
    paddingTop: "20px",
    minHeight: "600px",
    boxShadow: "0 -10px 20px rgba(0,0,0,0.05)",
  },
  // ================= TAB NAVIGATOR STYLES =================
  categoryTabs: {
    display: "flex",
    justifyContent: "space-around",
    backgroundColor: "white",
    padding: "10px 16px",
    borderBottom: "1px solid #f0f0f0",
    position: "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "white",
  },
  categoryTab: {
    flex: 1,
    textAlign: "center",
    padding: "10px 0",
    fontSize: "15px",
    fontWeight: "600",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    transition: "all 0.2s ease",
    letterSpacing: "0.5px",
  },
  // ================= CATEGORY HEADER STYLES =================
  categoryHeaderWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "15px",
    marginTop: "10px",
  },
  categoryIcon: {
    fontSize: "22px",
  },
  categoryHeading: {
    color: COLORS.orange,
    fontSize: "18px",
    fontWeight: "bold",
    margin: 0,
  },
  categoryLine: {
    flex: 1,
    height: "2px",
    backgroundColor: "#f0f0f0",
    borderRadius: "2px",
  },
  // ================= MENU CARD STYLES =================
  menuCard: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    background: "#fff",
    padding: "15px",
    borderRadius: "20px",
    marginBottom: "15px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.06)",
    border: "1px solid #f2f2f2",
  },
  menuImage: {
    width: "85px",
    height: "85px",
    borderRadius: "15px",
    objectFit: "cover",
  },
  menuInfo: { flex: 1 },
  menuName: {
    fontWeight: "bold",
    fontSize: "16px",
    color: "#333",
    marginBottom: "4px",
  },
  menuDesc: {
    fontSize: "11px",
    color: "#888",
    marginBottom: "6px",
    lineHeight: "1.4",
  },
  menuPrice: { fontWeight: "800", color: COLORS.orange, fontSize: "15px" },
  menuAction: { flexShrink: 0 },
  addButton: {
    padding: "7px 20px",
    borderRadius: "15px",
    border: "2px solid",
    background: "transparent",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "13px",
  },
  qtyWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#f9f9f9",
    padding: "5px",
    borderRadius: "12px",
    border: "1px solid #eee",
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
    justifyContent: "center",
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
    border: "1px solid #eee",
  },
  cartTotal: { fontSize: "18px", color: COLORS.orange, fontWeight: "800" },
  orderButton: {
    color: "#fff",
    border: "none",
    padding: "12px 25px",
    borderRadius: "15px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "14px",
  },
  buttonSpinner: {
    width: "16px",
    height: "16px",
    border: "2px solid #fff",
    borderTop: "2px solid transparent",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto",
  },
  statusChip: {
    padding: "8px 20px",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: "600",
    display: "inline-block",
  },
  orderItemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 0",
    borderBottom: "1px dashed #ddd",
    fontSize: "15px",
  },
  orderItemInfo: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flex: 1,
  },
  orderItemQuantity: {
    fontWeight: "600",
    color: COLORS.orange,
    minWidth: "40px",
  },
  orderItemName: {
    color: "#555",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  orderItemRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
  },
  deliveredBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#e9f7ef",
    color: "#27ae60",
    padding: "2px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "500",
  },
  preparingBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#fdf2e9",
    color: "#e67e22",
    padding: "2px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "500",
  },
  checkIcon: { fontSize: "12px", fontWeight: "bold" },
  clockIcon: { fontSize: "11px" },
  deliveredTime: { fontSize: "10px", color: "#27ae60" },
  orderItemsContainer: {
    maxHeight: "400px",
    overflowY: "auto",
    marginBottom: "20px",
  },
  totalSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "25px",
    paddingTop: "20px",
    borderTop: `2px solid ${COLORS.yellow}`,
  },
  totalValue: { fontSize: "22px", color: COLORS.orange, fontWeight: "900" },
  statusContainer: {
    background: "linear-gradient(135deg, #fff 0%, #fafafa 100%)",
    borderRadius: "24px",
    padding: "20px",
    marginBottom: "30px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    border: "1px solid #f0f0f0",
  },
  statusHeader: {
    display: "flex",
    alignItems: "center",
    marginBottom: "24px",
  },
  statusTextContainer: { flex: 1 },
  progressWrapper: { marginTop: "16px" },
  progressSteps: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "12px",
    padding: "0 10px",
  },
  progressStep: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    flex: 1,
  },
  progressDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    transition: "all 0.3s ease",
    position: "relative",
  },
  progressDotInner: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "4px",
    height: "4px",
    backgroundColor: "#fff",
    borderRadius: "50%",
  },
  progressLabel: {
    fontSize: "10px",
    textAlign: "center",
    transition: "all 0.3s ease",
  },
  progressBarContainer: {
    height: "6px",
    backgroundColor: "#f0f0f0",
    borderRadius: "10px",
    overflow: "hidden",
    marginBottom: "10px",
    position: "relative",
  },
  progressBarFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${COLORS.orange}, #ff8c42)`,
    borderRadius: "10px",
    position: "relative",
    overflow: "hidden",
  },
  progressGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
    animation: "shimmer 2s infinite",
  },
  deliveryProgress: { marginTop: "20px", textAlign: "center" },
  deliveryProgressText: {
    fontSize: "12px",
    color: COLORS.orange,
    marginBottom: "12px",
  },
  waveAnimation: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    marginTop: "10px",
  },
  waveDot: {
    width: "8px",
    height: "8px",
    backgroundColor: COLORS.orange,
    borderRadius: "50%",
    animation: "wave 1.5s ease-in-out infinite",
  },
  loadingOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(8px)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: "32px",
    padding: "40px",
    textAlign: "center",
    minWidth: "280px",
    animation: "slideUp 0.3s ease",
  },
  spinner: { marginBottom: "24px", display: "flex", justifyContent: "center" },
  spinnerCircle: {
    width: "50px",
    height: "50px",
    border: "4px solid #f0f0f0",
    borderTop: `4px solid ${COLORS.orange}`,
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: "20px",
  },
  loadingBar: {
    height: "6px",
    backgroundColor: "#f0f0f0",
    borderRadius: "10px",
    overflow: "hidden",
    marginBottom: "12px",
  },
  loadingFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${COLORS.orange}, #ff8c42)`,
    transition: "width 0.3s ease",
  },
  expiredContainer: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },
  expiredCard: {
    background: "#fff",
    padding: "40px",
    borderRadius: "30px",
    textAlign: "center",
    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
    width: "100%",
  },
  lockedOverlay: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
  },
  lockedContent: {
    background: "#fff",
    padding: "40px",
    borderRadius: "30px",
    textAlign: "center",
    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
    width: "100%",
  },
  alertOverlay: {
    position: "fixed",
    top: "20px",
    left: 0,
    right: 0,
    zIndex: 1000,
    display: "flex",
    justifyContent: "center",
  },
  alertBox: {
    background: "rgba(0,0,0,0.8)",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "12px",
    fontSize: "13px",
  },
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  @keyframes wave {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50% { transform: translateY(-8px); opacity: 1; }
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(styleSheet);

export default OrderMenu;