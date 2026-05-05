// pages/AdminPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import socket from "../api/socket";
import {
  Loader,
  Boxes,
  Plus,
  Trash,
  Image as ImageIcon,
  ClipboardList,
  Clock,
  Coffee,
  Utensils,
  LogOut,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Menu,
  Pizza,
  Beer,
  Cookie,
  Gift,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // State untuk alert notifications
  const [alert, setAlert] = useState({
    show: false,
    type: "",
    message: "",
  });

  // State untuk modal konfirmasi delete
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    productId: null,
    productName: "",
  });

  // Function to show alert
  const showAlert = (type, message) => {
    setAlert({
      show: true,
      type,
      message,
    });
    
    setTimeout(() => {
      setAlert({ show: false, type: "", message: "" });
    }, 3000);
  };

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
    
    const interval = setInterval(checkSession, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    sessionStorage.removeItem("admin_username");
    sessionStorage.removeItem("admin_login_time");
    navigate("/admin-login");
  };

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/orders");
      let data =
        res.data.data && Array.isArray(res.data.data)
          ? res.data.data
          : res.data;
      data = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(data);
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
      const res = await api.get("/api/menu");
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

  const handleUpdateStatus = async (id, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o._id === id ? { ...o, status: newStatus } : o)),
    );

    try {
      await api.put(`/api/orders/${id}/status`, { status: newStatus });
      showAlert("success", `Status pesanan berhasil diupdate menjadi ${newStatus.toUpperCase()}`);
    } catch (err) {
      showAlert("error", `Gagal update status: ${err.response?.data?.message || err.message}`);
      fetchOrders();
    }
  };

  // Fungsi untuk antar minuman
  const handleAntarAllMinuman = async (orderId) => {
    try {
      await api.put(`/api/orders/${orderId}/update-category-status`, {
        category: "Minuman",
        status: "served",
      });
      
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
      
      showAlert("success", "Semua minuman berhasil diantar ke pelanggan!");
    } catch (err) {
      showAlert("error", `Gagal mengantar minuman: ${err.response?.data?.message || err.message}`);
      fetchOrders();
    }
  };

  // Cek apakah order memiliki minuman yang belum diantar
  const hasUndeliveredDrinks = (order) => {
    return order.items.some(
      (item) => item.category === "Minuman" && item.status !== "served"
    );
  };

  // Fungsi untuk mengelompokkan item berdasarkan kategori
  const groupItemsByCategory = (items) => {
    const categories = ["Makanan", "Minuman", "Cemilan", "Paket"];
    const grouped = {};
    
    categories.forEach(cat => {
      grouped[cat] = items.filter(item => item.category === cat);
    });
    
    // Hanya return kategori yang memiliki item
    return Object.fromEntries(
      Object.entries(grouped).filter(([_, items]) => items.length > 0)
    );
  };

  // Dapatkan icon berdasarkan kategori
  const getCategoryIcon = (category) => {
    switch (category) {
      case "Makanan":
        return <Utensils size={14} />;
      case "Minuman":
        return <Coffee size={14} />;
      case "Cemilan":
        return <Cookie size={14} />;
      case "Paket":
        return <Gift size={14} />;
      default:
        return <Pizza size={14} />;
    }
  };

  // Dapatkan warna background berdasarkan kategori
  const getCategoryColor = (category) => {
    switch (category) {
      case "Makanan":
        return { bg: "#FEF3C7", color: "#D97706", border: "#FDE68A" };
      case "Minuman":
        return { bg: "#DBEAFE", color: "#2563EB", border: "#BFDBFE" };
      case "Cemilan":
        return { bg: "#FCE7F3", color: "#DB2777", border: "#FBCFE8" };
      case "Paket":
        return { bg: "#D1FAE5", color: "#059669", border: "#A7F3D0" };
      default:
        return { bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" };
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
      {/* Alert Notification */}
      {alert.show && (
        <div style={styles.alertContainer}>
          <div style={styles.alert(alert.type)}>
            <div style={styles.alertContent}>
              {alert.type === "success" ? (
                <CheckCircle size={20} style={styles.alertIconSuccess} />
              ) : (
                <XCircle size={20} style={styles.alertIconError} />
              )}
              <span style={styles.alertMessage}>{alert.message}</span>
            </div>
            <button
              onClick={() => setAlert({ show: false, type: "", message: "" })}
              style={styles.alertCloseBtn}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div style={styles.modalOverlay} onClick={closeDeleteModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalIconWrapper}>
                <AlertTriangle size={24} color="#EF4444" />
              </div>
              <button onClick={closeDeleteModal} style={styles.modalCloseBtn}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalBody}>
              <h3 style={styles.modalTitle}>Konfirmasi Hapus Menu</h3>
              <p style={styles.modalMessage}>
                Apakah Anda yakin ingin menghapus menu <strong>"{deleteModal.productName}"</strong>?
              </p>
              <p style={styles.modalWarning}>
                Tindakan ini tidak dapat dibatalkan dan akan menghapus menu secara permanen dari sistem.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={closeDeleteModal} style={styles.modalCancelBtn}>
                Batal
              </button>
              <button onClick={confirmDeleteProduct} style={styles.modalDeleteBtn}>
                <Trash size={16} /> Hapus Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <button onClick={handleLogout} style={styles.mobileLogoutBtn}>
            <LogOut size={20} />
          </button>

          <div style={styles.logoArea}>
            <div>
              <h1 style={styles.logoText}>Admin Dashboard</h1>
              <div style={styles.liveIndicator}>
                <span style={styles.pulseDot}></span>
                <span style={styles.liveText}>Live System</span>
              </div>
            </div>
          </div>
          
          <button 
            style={styles.mobileMenuBtn} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu size={24} />
          </button>

          <div style={styles.tabWrapperDesktop}>
            <button
              onClick={() => setActiveTab("orders")}
              style={styles.tabBtn(activeTab === "orders")}
            >
              <ClipboardList size={18} /> Pesanan
            </button>
            <button
              onClick={() => setActiveTab("products")}
              style={styles.tabBtn(activeTab === "products")}
            >
              <Boxes size={18} /> Menu
            </button>
            <button onClick={handleLogout} style={styles.desktopLogoutBtn}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div style={styles.mobileMenu}>
          <button
            onClick={() => {
              setActiveTab("orders");
              setMobileMenuOpen(false);
            }}
            style={styles.mobileTabBtn(activeTab === "orders")}
          >
            <ClipboardList size={20} /> Pesanan
          </button>
          <button
            onClick={() => {
              setActiveTab("products");
              setMobileMenuOpen(false);
            }}
            style={styles.mobileTabBtn(activeTab === "products")}
          >
            <Boxes size={20} /> Menu
          </button>
        </div>
      )}

      <div style={styles.container}>
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
              orders.map((o) => {
                const groupedItems = groupItemsByCategory(o.items);
                const categories = Object.keys(groupedItems);
                
                return (
                  <div key={o._id} style={styles.orderCard}>
                    <div style={styles.orderCardContent}>
                      <div style={{ flex: 1 }}>
                        {/* Header Order */}
                        <div style={styles.orderHeader}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Clock size={14} />
                            <span style={{ fontSize: 12, color: "#6B7280" }}>
                              {new Date(o.createdAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <span style={styles.tableBadge}>Meja {o.tableNumber}</span>
                          <span style={{ ...styles.statusBadge, ...getStatusStyle(o.status) }}>
                            {o.status === "pending" ? "🔔 BARU" : o.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Items Grouped by Category */}
                        <div style={styles.categoriesContainer}>
                          {categories.map((category) => {
                            const items = groupedItems[category];
                            const categoryStyle = getCategoryColor(category);
                            const hasUndeliveredDrinksInCategory = category === "Minuman" && 
                              items.some(item => item.status !== "served");
                            
                            return (
                              <div key={category} style={styles.categorySection}>
                                <div style={{
                                  ...styles.categoryHeader,
                                  backgroundColor: categoryStyle.bg,
                                  borderBottom: `2px solid ${categoryStyle.border}`,
                                }}>
                                  {getCategoryIcon(category)}
                                  <span style={{ ...styles.categoryTitle, color: categoryStyle.color }}>
                                    {category}
                                  </span>
                                  <span style={{
                                    ...styles.categoryCount,
                                    backgroundColor: categoryStyle.color,
                                  }}>
                                    {items.length}
                                  </span>
                                </div>
                                
                                <div style={styles.categoryItems}>
                                  {items.map((item, idx) => (
                                    <div key={idx} style={styles.categoryItemRow}>
                                      <div style={styles.categoryItemInfo}>
                                        <span style={styles.categoryItemQuantity}>
                                          {item.quantity}x
                                        </span>
                                        <span style={styles.categoryItemName}>
                                          {item.name}
                                        </span>
                                        {item.category === "Minuman" && (
                                          <span style={{
                                            ...styles.itemStatusBadge,
                                            backgroundColor: item.status === "served" ? "#D1FAE5" : "#FEF3C7",
                                            color: item.status === "served" ? "#065F46" : "#D97706",
                                          }}>
                                            {item.status === "served" ? "✓ Diantar" : "⏳ Siap"}
                                          </span>
                                        )}
                                      </div>
                                      <div style={styles.categoryItemPrice}>
                                        Rp {(item.price * item.quantity).toLocaleString()}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Tombol Antar Semua Minuman */}
                        {hasUndeliveredDrinks(o) && o.status !== "served" && o.status !== "paid" && (
                          <button 
                            onClick={() => handleAntarAllMinuman(o._id)} 
                            style={styles.antarAllMinumanBtn}
                          >
                            <Coffee size={18} /> Antar Semua Minuman
                          </button>
                        )}

                        {/* Footer Order */}
                        <div style={styles.orderFooter}>
                          <span style={styles.orderId}>#{o._id.slice(-6).toUpperCase()}</span>
                          <span style={styles.orderTotal}>Rp {o.totalPrice?.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={styles.orderActions}>
                        <button
                          disabled={o.status !== "pending"}
                          style={styles.actionBtn(o.status === "pending", "#F59E0B")}
                          onClick={() => handleUpdateStatus(o._id, "cooking")}
                        >
                          <Utensils size={16} /> Masak
                        </button>
                        <button
                          disabled={o.status !== "cooking"}
                          style={styles.actionBtn(o.status === "cooking", "#3B82F6")}
                          onClick={() => handleUpdateStatus(o._id, "served")}
                        >
                          Antar Semua
                        </button>
                        <button
                          disabled={o.status !== "served"}
                          style={styles.actionBtn(o.status === "served", "#10B981")}
                          onClick={() => handleUpdateStatus(o._id, "paid")}
                        >
                          Lunas
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
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
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
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
                        onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Kategori</label>
                      <select
                        style={styles.input}
                        value={newProduct.category}
                        onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
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
                      onChange={(e) => setNewProduct({ ...newProduct, desc: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Foto Produk</label>
                    <label style={styles.fileLabel}>
                      <input type="file" hidden accept="image/*" onChange={handleSelectImage} />
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8 }} />
                      ) : (
                        <>
                          <ImageIcon size={24} color="#9CA3AF" />
                          <span style={{ fontSize: 12, color: "#9CA3AF", marginTop: 5 }}>Klik untuk upload</span>
                        </>
                      )}
                    </label>
                  </div>
                  <button type="submit" style={styles.submitBtn}>Simpan Menu</button>
                </form>
              </div>
            </div>
            <div style={styles.productListSide}>
              <div style={styles.productGrid}>
                {products.map((p) => (
                  <div key={p._id} style={styles.productCard}>
                    <div style={styles.productImageWrapper}>
                      <img src={p.image_url || "/no-image.png"} style={styles.productImage} alt={p.name} onError={(e) => { e.target.src = "/no-image.png"; }} />
                    </div>
                    <div style={{ padding: 15 }}>
                      <h4 style={{ margin: 0, fontSize: 14 }}>{p.name}</h4>
                      <p style={styles.productPrice}>Rp {p.price?.toLocaleString()}</p>
                      <button 
                        style={styles.deleteBtn} 
                        onClick={() => openDeleteModal(p._id, p.name)}
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
  page: { backgroundColor: "#F8F9FA", minHeight: "100vh", fontFamily: "sans-serif", position: "relative" },
  
  alertContainer: {
    position: "fixed",
    top: "20px",
    right: "20px",
    zIndex: 9999,
    animation: "slideIn 0.3s ease-out",
  },
  alert: (type) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: "250px",
    maxWidth: "350px",
    padding: "12px 16px",
    borderRadius: "12px",
    backgroundColor: type === "success" ? "#D1FAE5" : "#FEE2E2",
    borderLeft: `4px solid ${type === "success" ? "#10B981" : "#EF4444"}`,
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  }),
  alertContent: { display: "flex", alignItems: "center", gap: "12px" },
  alertIconSuccess: { color: "#10B981" },
  alertIconError: { color: "#EF4444" },
  alertMessage: { fontSize: "14px", fontWeight: "500", color: "#1F2937" },
  alertCloseBtn: { background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center", padding: "4px" },
  
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
  },
  modal: {
    backgroundColor: "white",
    borderRadius: "16px",
    width: "90%",
    maxWidth: "450px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0 24px" },
  modalIconWrapper: { width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" },
  modalCloseBtn: { background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px" },
  modalBody: { padding: "20px 24px" },
  modalTitle: { margin: "0 0 8px 0", fontSize: "20px", fontWeight: "bold", color: "#111827" },
  modalMessage: { margin: "0 0 12px 0", fontSize: "14px", color: "#4B5563", lineHeight: "1.5" },
  modalWarning: { margin: 0, fontSize: "12px", color: "#EF4444", backgroundColor: "#FEF2F2", padding: "8px 12px", borderRadius: "8px", border: "1px solid #FEE2E2" },
  modalFooter: { display: "flex", gap: "12px", padding: "0 24px 24px 24px" },
  modalCancelBtn: { flex: 1, padding: "10px", backgroundColor: "#F3F4F6", color: "#374151", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer" },
  modalDeleteBtn: { flex: 1, padding: "10px", backgroundColor: "#EF4444", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  
  container: { maxWidth: 1200, margin: "0 auto", padding: "0 16px" },
  header: { backgroundColor: "white", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 10, padding: "12px 0" },
  headerContent: { maxWidth: 1200, margin: "0 auto", padding: "0 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  logoArea: { display: "flex", alignItems: "center", gap: 12 },
  logoText: { margin: 0, fontSize: "clamp(18px, 5vw, 24px)", fontWeight: "bold", color: "#c0392b" },
  liveIndicator: { display: "flex", alignItems: "center", gap: 5 },
  pulseDot: { width: 8, height: 8, backgroundColor: "#22C55E", borderRadius: "50%", animation: "pulse 2s infinite" },
  liveText: { fontSize: 10, color: "#9CA3AF", fontWeight: "bold", textTransform: "uppercase" },
  
  mobileLogoutBtn: {
    display: "none",
    backgroundColor: "#EF4444",
    color: "white",
    border: "none",
    borderRadius: "10px",
    padding: "10px",
    cursor: "pointer",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileMenuBtn: {
    display: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    color: "#c0392b",
  },
  
  tabWrapperDesktop: { display: "flex", gap: 8, alignItems: "center" },
  tabBtn: (active) => ({ 
    padding: "10px 24px", 
    borderRadius: "10px", 
    border: "none", 
    cursor: "pointer", 
    fontWeight: "bold", 
    fontSize: "14px", 
    backgroundColor: active ? "#c0392b" : "#F3F4F6", 
    color: active ? "white" : "#6B7280", 
    display: "flex", 
    alignItems: "center", 
    gap: 8,
    transition: "all 0.2s",
  }),
  desktopLogoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 20px",
    backgroundColor: "#EF4444",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "bold",
  },
  
  mobileMenu: {
    display: "none",
    position: "absolute",
    top: "70px",
    right: "16px",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    padding: "8px",
    zIndex: 20,
    flexDirection: "column",
    gap: "8px",
    minWidth: "160px",
  },
  mobileTabBtn: (active) => ({
    padding: "12px 20px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
    backgroundColor: active ? "#c0392b" : "transparent",
    color: active ? "white" : "#374151",
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
  }),
  
  ordersGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20 },
  orderCard: { backgroundColor: "white", borderRadius: 16, border: "1px solid #E5E7EB", overflow: "hidden" },
  orderCardContent: { padding: 16, display: "flex", flexDirection: "column", gap: 16 },
  orderHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  tableBadge: { backgroundColor: "#c0392b", color: "white", padding: "4px 12px", borderRadius: 8, fontWeight: "bold", fontSize: 12 },
  statusBadge: { fontSize: 10, fontWeight: "900", padding: "4px 12px", borderRadius: 20 },
  
  // Category Styles
  categoriesContainer: { display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 },
  categorySection: { 
    border: "1px solid #E5E7EB", 
    borderRadius: 12, 
    overflow: "hidden",
    backgroundColor: "#FAFAFA",
  },
  categoryHeader: { 
    display: "flex", 
    alignItems: "center", 
    gap: 8, 
    padding: "10px 12px",
    fontWeight: "bold",
    fontSize: "13px",
  },
  categoryTitle: { flex: 1, fontWeight: "bold", fontSize: "14px" },
  categoryCount: { 
    padding: "2px 8px", 
    borderRadius: "20px", 
    color: "white", 
    fontSize: "11px", 
    fontWeight: "bold",
  },
  categoryItems: { padding: "8px 12px" },
  categoryItemRow: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    padding: "8px 0",
    borderBottom: "1px solid #F3F4F6",
  },
  categoryItemInfo: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1 },
  categoryItemQuantity: { fontWeight: "bold", color: "#c0392b", minWidth: "35px", fontSize: "13px" },
  categoryItemName: { color: "#374151", fontSize: "13px", flex: 1 },
  itemStatusBadge: { 
    padding: "2px 8px", 
    borderRadius: "12px", 
    fontSize: "10px", 
    fontWeight: "bold",
  },
  categoryItemPrice: { fontWeight: "bold", color: "#EA580C", fontSize: "13px", minWidth: "90px", textAlign: "right" },
  
  orderFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 12, borderTop: "1px solid #E5E7EB" },
  orderId: { fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" },
  orderTotal: { fontSize: 18, fontWeight: "bold", color: "#EA580C" },
  orderActions: { display: "flex", flexDirection: "row", gap: 10, flexWrap: "wrap" },
  
  actionBtn: (active, color) => ({
    backgroundColor: active ? color : "#F3F4F6",
    color: active ? "white" : "#9CA3AF",
    border: "none",
    padding: "12px 20px",
    borderRadius: "12px",
    fontWeight: "bold",
    fontSize: "14px",
    cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.6,
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    flex: 1,
    transition: "all 0.2s",
  }),
  
  antarAllMinumanBtn: {
    backgroundColor: "#3B82F6",
    color: "white",
    border: "none",
    padding: "12px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    width: "100%",
    marginTop: "8px",
    transition: "all 0.2s",
  },
  
  productFlex: { display: "flex", gap: 20, flexDirection: "column" },
  productFormSide: { width: "100%" },
  formCard: { backgroundColor: "white", padding: 20, borderRadius: 16, border: "1px solid #E5E7EB" },
  formTitle: { margin: "0 0 20px 0", color: "#c0392b", display: "flex", alignItems: "center", gap: 8, fontSize: "18px" },
  form: { display: "flex", flexDirection: "column", gap: 15 },
  label: { fontSize: 14, fontWeight: "bold", color: "#4B5563", marginBottom: 5, display: "block" },
  input: { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #D1D5DB", boxSizing: "border-box", fontSize: "14px" },
  inputRow: { display: "flex", gap: 12, flexDirection: "row" },
  fileLabel: { border: "2px dashed #E5E7EB", padding: 15, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" },
  submitBtn: { backgroundColor: "#c0392b", color: "white", padding: 14, borderRadius: 12, border: "none", fontWeight: "bold", cursor: "pointer", fontSize: "16px" },
  productListSide: { width: "100%" },
  productGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 15 },
  productCard: { backgroundColor: "white", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" },
  productImageWrapper: { height: 130, backgroundColor: "#F3F4F6" },
  productImage: { width: "100%", height: "100%", objectFit: "cover" },
  productPrice: { color: "#c0392b", fontWeight: "bold", margin: "5px 0" },
  deleteBtn: { width: "100%", border: "1px solid #FEE2E2", color: "#EF4444", backgroundColor: "#FEF2F2", padding: 10, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: "bold", fontSize: "13px" },
  emptyState: { textAlign: "center", padding: "60px", backgroundColor: "white", borderRadius: 16, color: "#9CA3AF" },
};

// CSS Animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
    100% { opacity: 1; transform: scale(1); }
  }
  
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  button:hover {
    transform: translateY(-2px);
  }
  
  button:active {
    transform: translateY(0);
  }
  
  /* Mobile Responsive */
  @media (max-width: 768px) {
    .mobileLogoutBtn, .mobileMenuBtn {
      display: flex !important;
    }
    .tabWrapperDesktop {
      display: none !important;
    }
    .mobileMenu {
      display: flex !important;
    }
    .orderActions {
      flex-direction: column !important;
    }
    .inputRow {
      flex-direction: column !important;
    }
    .ordersGrid {
      grid-template-columns: 1fr !important;
    }
  }
`;
document.head.appendChild(styleSheet);

// Fix untuk function yang belum didefinisikan
const openDeleteModal = (id, name) => {
  // This will be called from the component
  window.dispatchEvent(new CustomEvent('openDeleteModal', { detail: { id, name } }));
};

const closeDeleteModal = () => {
  window.dispatchEvent(new CustomEvent('closeDeleteModal'));
};

const confirmDeleteProduct = async () => {
  window.dispatchEvent(new CustomEvent('confirmDeleteProduct'));
};

export default AdminPage;