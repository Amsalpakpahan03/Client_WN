// pages/AdminPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import socket from "../api/socket";
import {
  Loader,
  Package,
  Boxes,
  Plus,
  Trash,
  Image as ImageIcon,
  ClipboardList,
  Clock,
  Coffee,
  Utensils,
  LogOut,
  TrendingUp,
  DollarSign,
} from "lucide-react";

const AdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    desc: "",
    category: "Makanan",
    imageFile: null,
  });
  const [imagePreview, setImagePreview] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    const isAuth = sessionStorage.getItem("admin_auth") === "true";
    const username = sessionStorage.getItem("admin_username");
    
    if (!isAuth) {
      navigate("/admin-login");
      return;
    }
    
    setAdminName(username || "Admin");
  }, [navigate]);

  // Auto logout if session expired (8 hours)
  useEffect(() => {
    const checkSession = () => {
      const loginTime = sessionStorage.getItem("admin_login_time");
      if (loginTime && (Date.now() - parseInt(loginTime) >= 8 * 60 * 60 * 1000)) {
        handleLogout();
      }
    };
    
    const interval = setInterval(checkSession, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    sessionStorage.removeItem("admin_username");
    sessionStorage.removeItem("admin_login_time");
    navigate("/admin-login");
  };

  // Urutkan orders dari yang terbaru ke yang lama
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/orders");
      let data =
        res.data.data && Array.isArray(res.data.data)
          ? res.data.data
          : res.data;
      data = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(data);
      console.log("[ADMIN] Orders fetched:", data.length, "orders");
    } catch (err) {
      console.error("[ADMIN] Gagal mengambil data pesanan", err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/menu");
      setProducts(
        res.data.data && Array.isArray(res.data.data)
          ? res.data.data
          : res.data,
      );
    } catch (err) {
      console.error("[ADMIN] Gagal mengambil data menu:", err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchProducts();

    socket.on("newOrder", fetchOrders);
    socket.on("orderStatusUpdated", fetchOrders);

    return () => {
      socket.off("newOrder", fetchOrders);
      socket.off("orderStatusUpdated", fetchOrders);
    };
  }, [fetchOrders, fetchProducts]);

  // Update status global
  const handleUpdateStatus = async (id, newStatus) => {
    console.log("[ADMIN] Updating global status:", id, "→", newStatus);

    setOrders((prev) =>
      prev.map((o) => (o._id === id ? { ...o, status: newStatus } : o)),
    );

    try {
      await api.put(`/orders/${id}/status`, { status: newStatus });
      console.log("[ADMIN] Status global berhasil diupdate");
    } catch (err) {
      console.error("[ADMIN] Gagal update status", err);
      alert(
        `Gagal update status: ${err.response?.data?.message || err.message}`,
      );
      fetchOrders();
    }
  };

  // Update status minuman (ANTAR MINUMAN)
  const handleAntarMinuman = async (orderId) => {
    console.log("[ADMIN] Mengantar minuman untuk order:", orderId);

    setOrders((prev) =>
      prev.map((order) => {
        if (order._id === orderId) {
          const updatedItems = order.items.map((item) =>
            item.category === "Minuman" ? { ...item, status: "served" } : item,
          );
          return { ...order, items: updatedItems };
        }
        return order;
      }),
    );

    try {
      const response = await api.put(
        `/orders/${orderId}/update-category-status`,
        {
          category: "Minuman",
          status: "served",
        },
      );
      console.log("[ADMIN] Response antar minuman:", response.data);
    } catch (err) {
      console.error("[ADMIN] Gagal antar minuman", err);
      alert(
        `Gagal mengantar minuman: ${err.response?.data?.message || err.message}`,
      );
      fetchOrders();
    }
  };

  const handleSelectImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNewProduct({ ...newProduct, imageFile: file });
    setImagePreview(URL.createObjectURL(file));
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", newProduct.name);
    formData.append("price", newProduct.price);
    formData.append("description", newProduct.desc);
    formData.append("category", newProduct.category);
    if (newProduct.imageFile) formData.append("image", newProduct.imageFile);

    try {
      await api.post("/menu", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Produk berhasil ditambahkan!");
      setNewProduct({
        name: "",
        price: "",
        desc: "",
        category: "Makanan",
        imageFile: null,
      });
      setImagePreview(null);
      fetchProducts();
    } catch (err) {
      alert(
        `Gagal menambah produk: ${err.response?.data?.message || err.message}`,
      );
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Yakin ingin menghapus produk ini?")) return;
    try {
      await api.delete(`/menu/${id}`);
      fetchProducts();
      alert("Produk berhasil dihapus");
    } catch (err) {
      alert(`Gagal menghapus: ${err.response?.data?.message || err.message}`);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "pending":
        return {
          backgroundColor: "#FFFBEB",
          color: "#B45309",
          border: "1px solid #FDE68A",
        };
      case "cooking":
        return {
          backgroundColor: "#EFF6FF",
          color: "#1E40AF",
          border: "1px solid #BFDBFE",
        };
      case "served":
        return {
          backgroundColor: "#ECFDF5",
          color: "#065F46",
          border: "1px solid #A7F3D0",
        };
      case "paid":
        return {
          backgroundColor: "#F1F5F9",
          color: "#475569",
          border: "1px solid #E2E8F0",
        };
      default:
        return { backgroundColor: "#F3F4F6", color: "#374151" };
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logoArea}>
            <div>
              <h1 style={styles.logoText}>Admin Dashboard</h1>
              <div style={styles.liveIndicator}>
                <span style={styles.pulseDot}></span>
                <span style={styles.liveText}>Live System</span>
              </div>
            </div>
          </div>
          
          <div style={styles.adminInfo}>
            <span style={styles.adminName}>👋 Halo, {adminName}</span>
            <button onClick={handleLogout} style={styles.logoutBtn}>
              <LogOut size={16} /> Logout
            </button>
          </div>
          
          <div style={styles.tabWrapper}>
            <button
              onClick={() => setActiveTab("orders")}
              style={styles.tabBtn(activeTab === "orders")}
            >
              <ClipboardList size={16} /> Pesanan
            </button>
            <button
              onClick={() => setActiveTab("products")}
              style={styles.tabBtn(activeTab === "products")}
            >
              <Boxes size={16} /> Menu
            </button>
          </div>
        </div>
      </div>

      <div style={styles.container}>
        {/* <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                color: "#F97316",
                backgroundColor: "#FFF7ED",
              }}
            >
              <TrendingUp size={20} />
            </div>
            <div>
              <p style={styles.statLabel}>Total Pesanan</p>
              <p style={styles.statValue}>{orders.length}</p>
            </div>
          </div>
          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                color: "#16A34A",
                backgroundColor: "#F0FDF4",
              }}
            >
              <DollarSign size={20} />
            </div>
            <div>
              <p style={styles.statLabel}>Estimasi Omzet</p>
              <p style={styles.statValue}>
                Rp{" "}
                {orders
                  .reduce((a, c) => a + (c.totalPrice || 0), 0)
                  .toLocaleString()}
              </p>
            </div>
          </div>
          <div style={styles.statCard}>
            <div
              style={{
                ...styles.statIcon,
                color: "#7C3AED",
                backgroundColor: "#F5F3FF",
              }}
            >
              <Package size={20} />
            </div>
            <div>
              <p style={styles.statLabel}>Total Menu</p>
              <p style={styles.statValue}>{products.length}</p>
            </div>
          </div>
        </div> */}

        {activeTab === "orders" ? (
          <div style={styles.ordersGrid}>
            {isLoading && orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <Loader className="animate-spin" size={40} />
              </div>
            ) : orders.length === 0 ? (
              <div style={styles.emptyState}>
                <p>Belum ada pesanan</p>
              </div>
            ) : (
              orders.map((o) => (
                <div key={o._id} style={styles.orderCard}>
                  <div style={styles.orderCardContent}>
                    <div style={{ flex: 1 }}>
                      <div style={styles.orderHeader}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <Clock size={14} />
                          <span style={{ fontSize: 12, color: "#6B7280" }}>
                            {new Date(o.createdAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <span style={styles.tableBadge}>
                          Meja {o.tableNumber}
                        </span>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...getStatusStyle(o.status),
                          }}
                        >
                          {o.status === "pending"
                            ? "🔔 BARU"
                            : o.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={styles.itemList}>
                        {o.items.map((item, idx) => (
                          <div key={idx} style={styles.itemRow}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%",
                              }}
                            >
                              <div>
                                <b style={{ color: "#c0392b" }}>
                                  {item.quantity}x
                                </b>{" "}
                                {item.name}
                                {item.category === "Minuman" && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      marginLeft: 8,
                                      color:
                                        item.status === "served"
                                          ? "#10B981"
                                          : "#F59E0B",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    (
                                    {item.status === "served"
                                      ? "✓ Diantar"
                                      : "⏳ Siap"}
                                    )
                                  </span>
                                )}
                              </div>
                              {item.category === "Minuman" &&
                                item.status !== "served" && (
                                  <button
                                    onClick={() => handleAntarMinuman(o._id)}
                                    style={styles.antarMinumanBtn}
                                  >
                                    <Coffee size={12} /> Antar Minuman
                                  </button>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={styles.orderFooter}>
                        <span style={styles.orderId}>
                          #{o._id.slice(-6).toUpperCase()}
                        </span>
                        <span style={styles.orderTotal}>
                          Rp {o.totalPrice?.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div style={styles.orderActions}>
                      <button
                        disabled={o.status !== "pending"}
                        style={styles.actionBtnDisabled(o.status === "pending")}
                        onClick={() => handleUpdateStatus(o._id, "cooking")}
                      >
                        <Utensils size={12} /> Masak
                      </button>
                      <button
                        disabled={o.status !== "cooking"}
                        style={styles.actionBtnDisabled(o.status === "cooking")}
                        onClick={() => handleUpdateStatus(o._id, "served")}
                      >
                        Antar Semua
                      </button>
                      <button
                        disabled={o.status !== "served"}
                        style={styles.actionBtnDisabled(o.status === "served")}
                        onClick={() => handleUpdateStatus(o._id, "paid")}
                      >
                        Lunas
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div style={styles.productFlex}>
            <div style={styles.productFormSide}>
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>
                  <Plus size={20} /> Tambah Menu
                </h3>
                <form onSubmit={handleAddProduct} style={styles.form}>
                  <div>
                    <label style={styles.label}>Nama Menu</label>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="Contoh: Nasi Goreng"
                      value={newProduct.name}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div style={styles.inputRow}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Harga (Rp)</label>
                      <input
                        style={styles.input}
                        type="number"
                        placeholder="15000"
                        value={newProduct.price}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            price: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Kategori</label>
                      <select
                        style={styles.input}
                        value={newProduct.category}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            category: e.target.value,
                          })
                        }
                      >
                        <option value="Makanan">Makanan</option>
                        <option value="Cemilan">Cemilan</option>
                        <option value="Minuman">Minuman</option>
                        <option value="Paket">Paket</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={styles.label}>Deskripsi</label>
                    <textarea
                      style={{ ...styles.input, height: 80, resize: "none" }}
                      placeholder="Penjelasan singkat menu..."
                      value={newProduct.desc}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, desc: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Foto Produk</label>
                    <label style={styles.fileLabel}>
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleSelectImage}
                      />
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          style={{
                            width: "100%",
                            height: 100,
                            objectFit: "cover",
                            borderRadius: 8,
                          }}
                        />
                      ) : (
                        <>
                          <ImageIcon size={24} color="#9CA3AF" />
                          <span
                            style={{
                              fontSize: 12,
                              color: "#9CA3AF",
                              marginTop: 5,
                            }}
                          >
                            Klik untuk upload
                          </span>
                        </>
                      )}
                    </label>
                  </div>

                  <button type="submit" style={styles.submitBtn}>
                    Simpan Menu
                  </button>
                </form>
              </div>
            </div>

            <div style={styles.productListSide}>
              <div style={styles.productGrid}>
                {products.map((p) => (
                  <div key={p._id} style={styles.productCard}>
                    <div style={styles.productImageWrapper}>
                      <img
                        src={p.image_url || "/no-image.png"}
                        style={styles.productImage}
                        alt={p.name}
                        onError={(e) => {
                          e.target.src = "/no-image.png";
                        }}
                      />
                    </div>
                    <div style={{ padding: 15 }}>
                      <h4 style={{ margin: 0, fontSize: 14 }}>{p.name}</h4>
                      <p style={styles.productPrice}>
                        Rp {p.price?.toLocaleString()}
                      </p>
                      <button
                        style={styles.deleteBtn}
                        onClick={() => handleDeleteProduct(p._id)}
                      >
                        <Trash size={14} /> Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    backgroundColor: "#F8F9FA",
    minHeight: "100vh",
    fontFamily: "sans-serif",
  },
  container: { maxWidth: 1200, margin: "0 auto", padding: "0 20px" },
  header: {
    backgroundColor: "white",
    borderBottom: "1px solid #E5E7EB",
    position: "sticky",
    top: 0,
    zIndex: 10,
    padding: "15px 0",
  },
  headerContent: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 15,
  },
  logoArea: { display: "flex", alignItems: "center", gap: 12 },
  logoText: { margin: 0, fontSize: 24, fontWeight: "bold", color: "#c0392b" },
  liveIndicator: { display: "flex", alignItems: "center", gap: 5 },
  pulseDot: {
    width: 8,
    height: 8,
    backgroundColor: "#22C55E",
    borderRadius: "50%",
    animation: "pulse 2s infinite",
  },
  liveText: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  adminInfo: {
    display: "flex",
    alignItems: "center",
    gap: 15,
    backgroundColor: "#F3F4F6",
    padding: "8px 16px",
    borderRadius: 12,
  },
  adminName: {
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    backgroundColor: "#EF4444",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    transition: "all 0.3s",
  },
  tabWrapper: {
    display: "flex",
    backgroundColor: "#F3F4F6",
    padding: 4,
    borderRadius: 12,
  },
  tabBtn: (active) => ({
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 14,
    backgroundColor: active ? "white" : "transparent",
    color: active ? "#c0392b" : "#6B7280",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
    transition: "0.3s",
    display: "flex",
    alignItems: "center",
    gap: 6,
  }),
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 20,
    margin: "30px 0",
  },
  statCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 16,
    border: "1px solid #F3F4F6",
    display: "flex",
    alignItems: "center",
    gap: 15,
  },
  statIcon: { padding: 12, borderRadius: "50%" },
  statLabel: {
    margin: 0,
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  statValue: { margin: 0, fontSize: 24, fontWeight: "bold", color: "#1F2937" },
  ordersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
    gap: 20,
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    overflow: "hidden",
  },
  orderCardContent: { padding: 20, display: "flex", gap: 20 },
  orderHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
    flexWrap: "wrap",
  },
  tableBadge: {
    backgroundColor: "#c0392b",
    color: "white",
    padding: "4px 12px",
    borderRadius: 8,
    fontWeight: "bold",
    fontSize: 12,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "900",
    padding: "4px 12px",
    borderRadius: 20,
  },
  itemList: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottom: "1px solid #F3F4F6",
  },
  itemRow: { fontSize: 14, color: "#4B5563", marginBottom: 8 },
  orderFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderId: { fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" },
  orderTotal: { fontSize: 18, fontWeight: "bold", color: "#EA580C" },
  orderActions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 100,
  },
  antarMinumanBtn: {
    backgroundColor: "#3B82F6",
    color: "white",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  productFlex: { display: "flex", gap: 30, flexWrap: "wrap" },
  productFormSide: { flex: 1, minWidth: 300 },
  formCard: {
    backgroundColor: "white",
    padding: 25,
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    position: "sticky",
    top: 100,
  },
  formTitle: {
    margin: "0 0 20px 0",
    color: "#c0392b",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  form: { display: "flex", flexDirection: "column", gap: 15 },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4B5563",
    marginBottom: 5,
    display: "block",
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #D1D5DB",
    boxSizing: "border-box",
  },
  inputRow: { display: "flex", gap: 15 },
  fileLabel: {
    border: "2px dashed #E5E7EB",
    padding: 15,
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
  },
  submitBtn: {
    backgroundColor: "#c0392b",
    color: "white",
    padding: 12,
    borderRadius: 8,
    border: "none",
    fontWeight: "bold",
    cursor: "pointer",
  },
  productListSide: { flex: 2, minWidth: 400 },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 15,
  },
  productCard: {
    backgroundColor: "white",
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    overflow: "hidden",
  },
  productImageWrapper: { height: 150, backgroundColor: "#F3F4F6" },
  productImage: { width: "100%", height: "100%", objectFit: "cover" },
  productPrice: { color: "#c0392b", fontWeight: "bold", margin: "5px 0" },
  deleteBtn: {
    width: "100%",
    border: "1px solid #FEE2E2",
    color: "#EF4444",
    backgroundColor: "#FEF2F2",
    padding: 8,
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnDisabled: (active) => ({
    backgroundColor: active ? "#E5E7EB" : "#F3F4F6",
    color: active ? "#1F2937" : "#9CA3AF",
    border: "none",
    padding: 8,
    borderRadius: 8,
    fontWeight: "bold",
    fontSize: 10,
    cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.6,
    display: "flex",
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
  }),
  emptyState: {
    textAlign: "center",
    padding: "60px",
    backgroundColor: "white",
    borderRadius: 16,
    color: "#9CA3AF",
  },
};

// Add keyframes for pulse animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;
document.head.appendChild(styleSheet);

export default AdminPage;