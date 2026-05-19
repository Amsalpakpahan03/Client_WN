// pages/AdminPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { uploadApi } from "../api/axios";
import socket from "../api/socket";
import ReceiptModal from "../components/ReceiptModal";
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
    includesDrinks: false,
    includedDrinkIds: [],
    hasTemperature: false,
    extraPriceForIce: 1000,
    hasVariants: true,
    variants: [
      { name: "Dengan Telur", extraPrice: 3000 },
      { name: "Tanpa Telur", extraPrice: 0 },
    ],
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [availableDrinks, setAvailableDrinks] = useState([]);
  const [isUpdatingProductId, setIsUpdatingProductId] = useState(null);
  const [printReceiptEnabled, setPrintReceiptEnabled] = useState(true);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [reportPeriod, setReportPeriod] = useState("daily");
  const [reportData, setReportData] = useState({
    summary: {
      totalOrders: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
      totalItems: 0,
    },
    bestSelling: [],
    categoryBreakdown: [],
  });
  const [reportLoading, setReportLoading] = useState(false);

  const [recentOrderIds, setRecentOrderIds] = useState([]);
  const [socketNotification, setSocketNotification] = useState("");
  const [orderItemsNotification, setOrderItemsNotification] = useState(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState(null);
  const [selectedEditOrder, setSelectedEditOrder] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editBatchProductId, setEditBatchProductId] = useState("");
  const [editBatchQuantity, setEditBatchQuantity] = useState(1);
  const [pendingAddItems, setPendingAddItems] = useState([]);
  const [isSavingOrderEdit, setIsSavingOrderEdit] = useState(false);

  const [alert, setAlert] = useState({
    show: false,
    type: "",
    message: "",
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    productId: null,
    productName: "",
  });

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => {
      setAlert({ show: false, type: "", message: "" });
    }, 3000);
  };

  const showSocketNotice = (message) => {
    if (!message) return;
    setSocketNotification(message);
    setTimeout(() => {
      setSocketNotification("");
    }, 4000);
  };

  const handleOrderItemsNotificationClick = (orderId) => {
    if (!orderId) return;
    const orderElement = document.getElementById(orderId);
    if (orderElement) {
      orderElement.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedOrderId(orderId);
      setTimeout(() => {
        setHighlightedOrderId((prev) => (prev === orderId ? null : prev));
      }, 3000);
    }
    setOrderItemsNotification(null);
  };

  const markOrderAsRecent = (orderId) => {
    setRecentOrderIds((prev) => {
      if (prev.includes(orderId)) return prev;
      return [orderId, ...prev].slice(0, 10);
    });
    setTimeout(() => {
      setRecentOrderIds((prev) => prev.filter((id) => id !== orderId));
    }, 10000);
  };

  const openEditOrderModal = (order) => {
    setSelectedEditOrder(order);
    setEditNotes(order.notes || "");
    setEditBatchProductId(products?.[0]?._id || "");
    setEditBatchQuantity(1);
    setPendingAddItems([]);
  };

  const closeEditOrderModal = () => {
    setSelectedEditOrder(null);
    setEditNotes("");
    setEditBatchProductId("");
    setEditBatchQuantity(1);
    setPendingAddItems([]);
  };

  const addPendingItem = () => {
    if (!editBatchProductId) return;
    const product = products.find((menu) => menu._id === editBatchProductId);
    if (!product) return;

    setPendingAddItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === editBatchProductId,
      );
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + Number(editBatchQuantity || 1),
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          quantity: Number(editBatchQuantity || 1),
          price: Number(product.price || 0),
          category: product.category || "Lainnya",
          description: product.description || "",
          status: "pending",
        },
      ];
    });
  };

  const removePendingItem = (productId) => {
    setPendingAddItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const submitOrderEdit = async () => {
    if (!selectedEditOrder) return;
    setIsSavingOrderEdit(true);
    try {
      if (pendingAddItems.length > 0) {
        await api.put(`/api/orders/${selectedEditOrder._id}/items`, {
          items: pendingAddItems,
          totalPrice: pendingAddItems.reduce(
            (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
            0,
          ),
          notes: editNotes.trim(),
        });
      } else if (editNotes.trim() !== (selectedEditOrder.notes || "")) {
        await api.put(`/api/admin/orders/${selectedEditOrder._id}`, {
          notes: editNotes.trim(),
        });
      }

      showAlert("success", "Perubahan order berhasil disimpan.");
      fetchOrders();
      closeEditOrderModal();
    } catch (err) {
      showAlert(
        "error",
        `Gagal menyimpan perubahan: ${err.response?.data?.message || err.message}`,
      );
    } finally {
      setIsSavingOrderEdit(false);
    }
  };

  useEffect(() => {
    const isAuth = sessionStorage.getItem("admin_auth") === "true";
    const username = sessionStorage.getItem("admin_username");

    if (!isAuth) {
      navigate("/admin-login");
      return;
    }

    setAdminName(username || "Admin");
  }, [navigate]);

  useEffect(() => {
    const checkSession = () => {
      const loginTime = sessionStorage.getItem("admin_login_time");
      if (loginTime && Date.now() - parseInt(loginTime) >= 8 * 60 * 60 * 1000) {
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
      data = data
        .map((order) => ({ ...order, newItemIds: order.newItemIds || [] }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
      const res = await api.get("/api/admin/menu");
      setProducts(
        res.data.data && Array.isArray(res.data.data)
          ? res.data.data
          : res.data,
      );
    } catch (err) {
      if (err.response?.status === 404) {
        try {
          const res = await api.get("/api/menu");
          setProducts(
            res.data.data && Array.isArray(res.data.data)
              ? res.data.data
              : res.data,
          );
          return;
        } catch (fallbackErr) {
          console.error("[ADMIN] Fallback fetch menu gagal:", fallbackErr);
        }
      }

      console.error("[ADMIN] Gagal mengambil data menu:", err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  }, []);

  const fetchDrinks = useCallback(async () => {
    try {
      const res = await api.get("/api/menu");
      let allMenus =
        res.data.data && Array.isArray(res.data.data)
          ? res.data.data
          : res.data;
      const drinks = allMenus.filter(
        (menu) => menu.category === "Minuman" && menu.isAvailable !== false,
      );
      setAvailableDrinks(drinks);
    } catch (err) {
      console.error("Gagal mengambil data minuman:", err);
    }
  }, []);

  const fetchOrderReport = useCallback(
    async (period = reportPeriod) => {
      setReportLoading(true);
      try {
        const res = await api.get("/api/analytics/order-report", {
          params: { period },
        });

        const data = res.data?.data || {};
        setReportData({
          summary: data.summary || {
            totalOrders: 0,
            totalRevenue: 0,
            avgOrderValue: 0,
            totalItems: 0,
          },
          bestSelling: Array.isArray(data.bestSelling) ? data.bestSelling : [],
          categoryBreakdown: Array.isArray(data.categoryBreakdown)
            ? data.categoryBreakdown
            : [],
        });
      } catch (err) {
        console.error("Gagal mengambil laporan pesanan:", err);
        showAlert(
          "error",
          `Gagal memuat laporan: ${err.response?.data?.message || err.message}`,
        );
      } finally {
        setReportLoading(false);
      }
    },
    [reportPeriod],
  );

  useEffect(() => {
    fetchOrders();
    fetchProducts();
    fetchDrinks();

    if (activeTab === "report") {
      fetchOrderReport(reportPeriod);
    }

    const handleNewOrder = (order) => {
      showSocketNotice(`Pesanan baru masuk: Meja ${order.tableNumber}`);
      markOrderAsRecent(order._id);
      fetchOrders();
    };

    const handleOrderUpdated = (order) => {
      showSocketNotice(`Pesanan di meja ${order.tableNumber} diperbarui`);
      markOrderAsRecent(order._id);
      fetchOrders();
    };

    const handleOrderItemsAdded = (payload) => {
      const { orderId, newItemNames, tableNumber } = payload;
      if (!orderId || !Array.isArray(newItemNames)) return;

      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          if (order._id !== orderId) return order;
          const currentNewItemIds = Array.isArray(order.newItemIds)
            ? order.newItemIds
            : [];
          return {
            ...order,
            newItemIds: Array.from(new Set([...currentNewItemIds, ...newItemNames])),
          };
        }),
      );

      setOrderItemsNotification({
        orderId,
        message: `Item baru ditambahkan ke Meja ${tableNumber}`,
      });

      setTimeout(() => {
        setOrderItemsNotification((prev) =>
          prev?.orderId === orderId ? null : prev,
        );
      }, 5000);

      setTimeout(() => {
        setOrders((prevOrders) =>
          prevOrders.map((order) => {
            if (order._id !== orderId) return order;
            return {
              ...order,
              newItemIds: (order.newItemIds || []).filter(
                (itemName) => !newItemNames.includes(itemName),
              ),
            };
          }),
        );
      }, 10000);
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderStatusUpdated", handleOrderUpdated);
    socket.on("orderItemsAdded", handleOrderItemsAdded);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderStatusUpdated", handleOrderUpdated);
      socket.off("orderItemsAdded", handleOrderItemsAdded);
    };
  }, [fetchOrders, fetchProducts, fetchDrinks, activeTab, fetchOrderReport, reportPeriod]);

  const handleUpdateStatus = async (id, newStatus) => {
    const orderToPrint = orders.find((o) => o._id === id);

    setOrders((prev) =>
      prev.map((o) => (o._id === id ? { ...o, status: newStatus } : o)),
    );

    try {
      await api.put(`/api/orders/${id}/status`, { status: newStatus });
      showAlert("success", `${newStatus.toUpperCase()}`);

      if (newStatus === "paid" && printReceiptEnabled && orderToPrint) {
        setReceiptOrder({ ...orderToPrint, status: newStatus });
      }
    } catch (err) {
      showAlert(
        "error",
        `Gagal update status: ${err.response?.data?.message || err.message}`,
      );
      fetchOrders();
    }
  };

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
              item.category === "Minuman"
                ? { ...item, status: "served" }
                : item,
            );
            return { ...order, items: updatedItems };
          }
          return order;
        }),
      );

      showAlert("success", "Semua minuman berhasil diantar ke pelanggan!");
    } catch (err) {
      showAlert(
        "error",
        `Gagal mengantar minuman: ${err.response?.data?.message || err.message}`,
      );
      fetchOrders();
    }
  };

  const hasUndeliveredDrinks = (order) => {
    return order.items.some(
      (item) => item.category === "Minuman" && item.status !== "served",
    );
  };

  const toggleProductAvailability = async (product) => {
    setIsUpdatingProductId(product._id);
    const actionLabel =
      product.isAvailable === false ? "diaktifkan" : "dinonaktifkan";

    try {
      try {
        await api.patch(`/api/admin/menu/${product._id}/toggle-availability`);
      } catch (err) {
        if (err.response?.status === 404) {
          await api.patch(`/api/menu/${product._id}/toggle-availability`);
        } else {
          throw err;
        }
      }

      showAlert("success", `Menu ${actionLabel} berhasil!`);
      fetchProducts();
    } catch (err) {
      console.error("[ADMIN] Gagal toggle availability:", err);
      showAlert(
        "error",
        `Gagal mengubah status menu: ${err.response?.data?.message || err.message}`,
      );
    } finally {
      setIsUpdatingProductId(null);
    }
  };

  const expandPackageItems = (items) => {
    const expandedItems = [];

    items.forEach((item) => {
      expandedItems.push(item);

      if (
        item.category === "Paket" &&
        item.includesDrinks &&
        item.includedDrinkIds
      ) {
        item.includedDrinkIds.forEach((drinkId) => {
          const drink = availableDrinks.find((d) => d._id === drinkId);
          if (drink) {
            expandedItems.push({
              ...drink,
              quantity: item.quantity,
              price: 0,
              isIncludedInPackage: true,
              packageName: item.name,
              status: item.status,
            });
          }
        });
      }
    });

    return expandedItems;
  };

  const groupItemsByCategory = (items) => {
    const categories = ["Makanan", "Minuman", "Cemilan", "Paket"];
    const grouped = {};

    categories.forEach((cat) => {
      grouped[cat] = items.filter((item) => item.category === cat);
    });

    return Object.fromEntries(
      Object.entries(grouped).filter(([_, items]) => items.length > 0),
    );
  };

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

  const getOrderCardStyle = (status, isRecent = false, isHighlighted = false) => {
    if (status === "paid") {
      return {
        ...styles.orderCard,
        opacity: 0.6,
        filter: "grayscale(0.7)",
        backgroundColor: "#F3F4F6",
        border: "1px solid #D1D5DB",
        transition: "all 0.3s",
        ...(isHighlighted && {
          border: "2px solid #F59E0B",
          boxShadow: "0 0 0 3px rgba(245,158,11,0.3)",
        }),
      };
    }

    const baseStyle = {
      ...styles.orderCard,
      transition: "all 0.3s",
    };

    if (isRecent) {
      baseStyle.border = "2px solid #F59E0B";
      baseStyle.boxShadow = "0 10px 25px rgba(245, 158, 11, 0.12)";
    }

    if (isHighlighted) {
      baseStyle.border = "2px solid #F59E0B";
      baseStyle.boxShadow = "0 0 0 3px rgba(245,158,11,0.3)";
    }

    return baseStyle;
  };

  const handleSelectImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNewProduct({ ...newProduct, imageFile: file });
    setImagePreview(URL.createObjectURL(file));
  };

  const handleAddVariant = () => {
    setNewProduct((prev) => ({
      ...prev,
      hasVariants: true,
      variants: [...prev.variants, { name: "", extraPrice: 0 }],
    }));
  };

  const handleVariantChange = (index, field, value) => {
    setNewProduct((prev) => {
      const variants = [...prev.variants];
      variants[index] = { ...variants[index], [field]: value };
      return { ...prev, variants };
    });
  };

  const handleRemoveVariant = (index) => {
    setNewProduct((prev) => {
      const variants = prev.variants.filter((_, idx) => idx !== index);
      return { ...prev, variants };
    });
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();

    if (newProduct.imageFile && newProduct.imageFile.size > 10 * 1024 * 1024) {
      showAlert("error", "Ukuran file terlalu besar! Maksimal 10MB");
      return;
    }

    const formData = new FormData();
    formData.append("name", newProduct.name);
    formData.append("price", newProduct.price);
    formData.append("description", newProduct.desc);
    formData.append("category", newProduct.category);
    formData.append("hasTemperature", newProduct.hasTemperature);
    formData.append("extraPriceForIce", newProduct.extraPriceForIce);
    formData.append("hasVariants", newProduct.hasVariants);
    if (newProduct.hasVariants && Array.isArray(newProduct.variants)) {
      formData.append("variants", JSON.stringify(newProduct.variants));
    }
    if (newProduct.imageFile) formData.append("image", newProduct.imageFile);

    if (newProduct.category === "Paket") {
      formData.append("includesDrinks", newProduct.includesDrinks);
      if (newProduct.includesDrinks && newProduct.includedDrinkIds.length > 0) {
        formData.append(
          "includedDrinkIds",
          JSON.stringify(newProduct.includedDrinkIds),
        );
      }
    }

    try {
      await uploadApi.post("/api/menu", formData);
      showAlert("success", "Menu berhasil ditambahkan!");
      setNewProduct({
        name: "",
        price: "",
        desc: "",
        category: "Makanan",
        imageFile: null,
        includesDrinks: false,
        includedDrinkIds: [],
        hasTemperature: false,
        extraPriceForIce: 1000,
        hasVariants: true,
        variants: [
          { name: "Dengan Telur", extraPrice: 3000 },
          { name: "Tanpa Telor", extraPrice: 0 },
        ],
      });
      setImagePreview(null);
      fetchProducts();
    } catch (err) {
      console.error("Upload error:", err);
      if (err.code === "ECONNABORTED") {
        showAlert(
          "error",
          "Upload timeout! File terlalu besar atau koneksi lambat. Coba kompres gambar.",
        );
      } else {
        showAlert(
          "error",
          `Gagal menambah menu: ${err.response?.data?.message || err.message}`,
        );
      }
    }
  };

  const openDeleteModal = (id, name) => {
    setDeleteModal({
      isOpen: true,
      productId: id,
      productName: name,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      productId: null,
      productName: "",
    });
  };

  const confirmDeleteProduct = async () => {
    const { productId, productName } = deleteModal;
    try {
      await api.delete(`/api/menu/${productId}`);
      fetchProducts();
      showAlert("success", `Menu "${productName}" berhasil dihapus!`);
      closeDeleteModal();
    } catch (err) {
      showAlert(
        "error",
        `Gagal menghapus menu: ${err.response?.data?.message || err.message}`,
      );
      closeDeleteModal();
    }
  };

  return (
    <div style={styles.page}>
      {/* ── Alert ── */}
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

      {/* ── Delete Confirmation Modal ── */}
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
                Apakah Anda yakin ingin menghapus menu{" "}
                <strong>"{deleteModal.productName}"</strong>?
              </p>
              <p style={styles.modalWarning}>
                Tindakan ini tidak dapat dibatalkan dan akan menghapus menu
                secara permanen dari sistem.
              </p>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={closeDeleteModal} style={styles.modalCancelBtn}>
                Batal
              </button>
              <button
                onClick={confirmDeleteProduct}
                style={styles.modalDeleteBtn}
              >
                <Trash size={16} /> Hapus Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Order Modal ── */}
      {selectedEditOrder && (
        <div style={styles.modalOverlay} onClick={closeEditOrderModal}>
          <div style={styles.editOrderModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeaderTop}>
              <div>
                <h3 style={styles.modalTitle}>
                  Edit Pesanan Meja {selectedEditOrder.tableNumber}
                </h3>
                <p style={styles.modalSubtitle}>
                  Tambah menu baru atau perbarui catatan pesanan.
                </p>
              </div>
              <button style={styles.modalClose} onClick={closeEditOrderModal}>
                ✕
              </button>
            </div>

            <div style={styles.modalBodySection}>
              <label style={styles.modalLabel}>Catatan Pelanggan</label>
              <textarea
                style={styles.modalTextarea}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Catatan tambahan untuk pesanan..."
              />
            </div>

            <div style={styles.modalBodySection}>
              <label style={styles.modalLabel}>Tambah Menu</label>
              <div style={styles.modalAddRow}>
                <select
                  value={editBatchProductId}
                  onChange={(e) => setEditBatchProductId(e.target.value)}
                  style={styles.modalSelect}
                >
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} - Rp{" "}
                      {Number(product.price || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={editBatchQuantity}
                  onChange={(e) =>
                    setEditBatchQuantity(Number(e.target.value || 1))
                  }
                  style={styles.modalQuantityInput}
                />
                <button
                  type="button"
                  style={styles.modalAddButton}
                  onClick={addPendingItem}
                >
                  Tambah
                </button>
              </div>

              {pendingAddItems.length > 0 && (
                <div style={styles.pendingList}>
                  {pendingAddItems.map((item) => (
                    <div key={item.productId} style={styles.pendingItemRow}>
                      <div>
                        <strong>{item.name}</strong>
                        <div style={styles.pendingItemMeta}>
                          {item.quantity} x Rp{" "}
                          {Number(item.price || 0).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        style={styles.pendingRemoveBtn}
                        onClick={() => removePendingItem(item.productId)}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.modalFooterRow}>
              <button
                style={styles.modalCancelBtn}
                type="button"
                onClick={closeEditOrderModal}
              >
                Batal
              </button>
              <button
                style={{
                  ...styles.modalSaveBtn,
                  opacity: isSavingOrderEdit ? 0.7 : 1,
                }}
                type="button"
                onClick={submitOrderEdit}
                disabled={isSavingOrderEdit}
              >
                {isSavingOrderEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
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
            <button
              onClick={() => setActiveTab("report")}
              style={styles.tabBtn(activeTab === "report")}
            >
              <Gift size={18} /> Laporan
            </button>
            <button onClick={handleLogout} style={styles.desktopLogoutBtn}>
              <LogOut size={16} /> Logout
            </button>
          </div>

          <div style={styles.printToggleContainer}>
            <label style={styles.printToggleLabel}>
              <input
                type="checkbox"
                checked={printReceiptEnabled}
                onChange={(e) => setPrintReceiptEnabled(e.target.checked)}
                style={styles.printToggleCheckbox}
              />
              Cetak Nota Otomatis
            </label>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu Dropdown ── */}
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
          <button
            onClick={() => {
              setActiveTab("report");
              setMobileMenuOpen(false);
            }}
            style={styles.mobileTabBtn(activeTab === "report")}
          >
            <Gift size={20} /> Laporan
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      <div style={styles.container}>
        {socketNotification && (
          <div style={styles.socketNotification}>{socketNotification}</div>
        )}

        {orderItemsNotification && (
          <div
            style={styles.socketNotification}
            onClick={() => handleOrderItemsNotificationClick(orderItemsNotification.orderId)}
          >
            {orderItemsNotification.message}
            <div style={{ marginTop: 6, opacity: 0.85, fontSize: 12 }}>
              Klik untuk lihat pesanan
            </div>
          </div>
        )}

        {receiptOrder && (
          <ReceiptModal
            order={receiptOrder}
            onClose={() => setReceiptOrder(null)}
            autoPrint={printReceiptEnabled}
          />
        )}

        {/* ════════════════════════════════════════
            TAB: ORDERS
        ════════════════════════════════════════ */}
        {activeTab === "orders" && (
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
                const expandedItems = expandPackageItems(o.items || []);
                const groupedItems = groupItemsByCategory(expandedItems);
                const categories = Object.keys(groupedItems);
                const isPaid = o.status === "paid";

                return (
                  <div
                    id={o._id}
                    key={o._id}
                    style={getOrderCardStyle(
                      o.status,
                      recentOrderIds.includes(o._id),
                      highlightedOrderId === o._id,
                    )}
                  >
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
                              {new Date(o.createdAt).toLocaleTimeString(
                                "id-ID",
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>

                          <div
                            style={
                              isPaid
                                ? styles.tableNumberWrapperDisabled
                                : styles.tableNumberWrapper
                            }
                          >
                            <span style={styles.tableNumberLabel}>Meja</span>
                            <span style={styles.tableNumberValue}>
                              {o.tableNumber}
                            </span>
                          </div>

                          <div style={styles.badgeRow}>
                            {recentOrderIds.includes(o._id) && (
                              <span style={styles.recentBadge}>BARU</span>
                            )}
                            <span
                              style={{
                                ...styles.statusBadge,
                                ...getStatusStyle(o.status),
                              }}
                            >
                              {o.status === "pending"
                                ? "🔔 BARU"
                                : o.status === "paid"
                                  ? "✅ SELESAI"
                                  : o.status.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div style={styles.categoriesContainer}>
                          {categories.map((category) => {
                            const items = groupedItems[category];
                            const categoryStyle = getCategoryColor(category);

                            return (
                              <div
                                key={category}
                                style={{
                                  ...styles.categorySection,
                                  opacity: isPaid ? 0.7 : 1,
                                }}
                              >
                                <div
                                  style={{
                                    ...styles.categoryHeader,
                                    backgroundColor: categoryStyle.bg,
                                    borderBottom: `2px solid ${categoryStyle.border}`,
                                  }}
                                >
                                  <span
                                    style={{
                                      ...styles.categoryTitle,
                                      color: categoryStyle.color,
                                    }}
                                  >
                                    {category}
                                  </span>
                                  <span
                                    style={{
                                      ...styles.categoryCount,
                                      backgroundColor: categoryStyle.color,
                                    }}
                                  >
                                    {items.length}
                                  </span>
                                </div>

                                <div style={styles.categoryItems}>
                                  {items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        ...styles.categoryItemRow,
                                        backgroundColor:
                                          item.isIncludedInPackage
                                            ? "#FEFCE8"
                                            : "transparent",
                                      }}
                                    >
                                      <div style={styles.categoryItemInfo}>
                                        <span
                                          style={styles.categoryItemQuantity}
                                        >
                                          {item.quantity}x
                                        </span>
                                        <span style={styles.categoryItemName}>
                                          {item.name}
                                          {o.newItemIds?.includes(item.name) && (
                                            <span style={styles.newItemBadge}>
                                              🆕 BARU
                                            </span>
                                          )}
                                          {item.isIncludedInPackage && (
                                            <span style={styles.packageBadge}>
                                              dari {item.packageName}
                                            </span>
                                          )}
                                        </span>
                                        {item.category === "Minuman" && (
                                          <span
                                            style={{
                                              ...styles.itemStatusBadge,
                                              backgroundColor:
                                                item.status === "served"
                                                  ? "#D1FAE5"
                                                  : "#FEF3C7",
                                              color:
                                                item.status === "served"
                                                  ? "#065F46"
                                                  : "#D97706",
                                            }}
                                          >
                                            {item.status === "served"
                                              ? "✓ Diantar"
                                              : "Siap"}
                                          </span>
                                        )}
                                      </div>
                                      <div style={styles.categoryItemPrice}>
                                        Rp{" "}
                                        {(
                                          item.price * item.quantity
                                        ).toLocaleString()}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {o.notes && (
                          <div style={styles.orderNoteWrapper}>
                            <strong>Catatan Pelanggan:</strong> {o.notes}
                          </div>
                        )}

                        {!isPaid &&
                          hasUndeliveredDrinks(o) &&
                          o.status !== "served" &&
                          o.status !== "paid" && (
                            <button
                              onClick={() => handleAntarAllMinuman(o._id)}
                              style={styles.antarAllMinumanBtn}
                            >
                              <Coffee size={18} /> Antar Semua Minuman
                            </button>
                          )}

                        <div style={styles.orderFooter}>
                          <span style={styles.orderId}>
                            #{o._id.slice(-6).toUpperCase()}
                          </span>
                          <span
                            style={
                              isPaid
                                ? styles.orderTotalPaid
                                : styles.orderTotal
                            }
                          >
                            Rp {o.totalPrice?.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {!isPaid && (
                        <div style={styles.orderActions}>
                          <button
                            onClick={() => openEditOrderModal(o)}
                            style={styles.actionBtn(true, "#8B5CF6")}
                          >
                            <ImageIcon size={16} /> Edit
                          </button>
                          <button
                            disabled={o.status !== "pending"}
                            style={styles.actionBtn(
                              o.status === "pending",
                              "#F59E0B",
                            )}
                            onClick={() =>
                              handleUpdateStatus(o._id, "cooking")
                            }
                          >
                            <Utensils size={16} /> Masak
                          </button>
                          <button
                            disabled={o.status !== "cooking"}
                            style={styles.actionBtn(
                              o.status === "cooking",
                              "#3B82F6",
                            )}
                            onClick={() =>
                              handleUpdateStatus(o._id, "served")
                            }
                          >
                            Antar Semua
                          </button>
                          <button
                            disabled={o.status !== "served"}
                            style={styles.actionBtn(
                              o.status === "served",
                              "#10B981",
                            )}
                            onClick={() => handleUpdateStatus(o._id, "paid")}
                          >
                            Lunas
                          </button>
                        </div>
                      )}

                      {isPaid && (
                        <div style={styles.completedBadge}>
                          <CheckCircle size={16} />
                          <span>Pesanan Selesai</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            TAB: PRODUCTS
        ════════════════════════════════════════ */}
        {activeTab === "products" && (
          <div style={styles.productFlex}>
            {/* ── Form Tambah Menu ── */}
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
                        onChange={(e) => {
                          const category = e.target.value;
                          setNewProduct({
                            ...newProduct,
                            category,
                            includesDrinks:
                              category === "Paket"
                                ? newProduct.includesDrinks
                                : false,
                            includedDrinkIds:
                              category === "Paket"
                                ? newProduct.includedDrinkIds
                                : [],
                            hasTemperature:
                              category === "Minuman"
                                ? newProduct.hasTemperature
                                : false,
                            extraPriceForIce:
                              category === "Minuman"
                                ? newProduct.extraPriceForIce
                                : 1000,
                            hasVariants:
                              category === "Makanan"
                                ? newProduct.hasVariants
                                : false,
                          });
                        }}
                      >
                        <option value="Makanan">Makanan</option>
                        <option value="Cemilan">Cemilan</option>
                        <option value="Minuman">Minuman</option>
                        <option value="Paket">Paket</option>
                      </select>
                    </div>
                  </div>

                  {/* Opsi Minuman */}
                  {newProduct.category === "Minuman" && (
                    <div style={styles.checkboxGroup}>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={newProduct.hasTemperature}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              hasTemperature: e.target.checked,
                            })
                          }
                          style={styles.checkbox}
                        />
                        <span>Gunakan opsi Es / Hangat</span>
                      </label>
                      {newProduct.hasTemperature && (
                        <div style={styles.inputRow}>
                          <div style={{ flex: 1 }}>
                            <label style={styles.label}>
                              Biaya tambahan Es (Rp)
                            </label>
                            <input
                              style={styles.input}
                              type="number"
                              min="0"
                              value={newProduct.extraPriceForIce}
                              onChange={(e) =>
                                setNewProduct({
                                  ...newProduct,
                                  extraPriceForIce: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Opsi Makanan - Varian */}
                  {newProduct.category === "Makanan" && (
                    <div style={styles.checkboxGroup}>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={newProduct.hasVariants}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              hasVariants: e.target.checked,
                            })
                          }
                          style={styles.checkbox}
                        />
                        <span>Tambahkan varian makanan</span>
                      </label>

                      {newProduct.hasVariants && (
                        <div style={styles.variantSection}>
                          {newProduct.variants.map((variant, idx) => (
                            <div
                              key={`${variant.name}-${idx}`}
                              style={styles.variantRow}
                            >
                              <input
                                type="text"
                                placeholder="Nama varian"
                                style={{
                                  ...styles.input,
                                  flex: 2,
                                  marginRight: 8,
                                }}
                                value={variant.name}
                                onChange={(e) =>
                                  handleVariantChange(
                                    idx,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                required
                              />
                              <input
                                type="number"
                                min="0"
                                placeholder="Harga tambahan"
                                style={{
                                  ...styles.input,
                                  flex: 1,
                                  marginRight: 8,
                                }}
                                value={variant.extraPrice}
                                onChange={(e) =>
                                  handleVariantChange(
                                    idx,
                                    "extraPrice",
                                    Number(e.target.value),
                                  )
                                }
                                required
                              />
                              <button
                                type="button"
                                style={styles.removeVariantBtn}
                                onClick={() => handleRemoveVariant(idx)}
                              >
                                Hapus
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            style={styles.addVariantBtn}
                            onClick={handleAddVariant}
                          >
                            Tambah Varian
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Opsi Paket */}
                  {newProduct.category === "Paket" && (
                    <div style={styles.checkboxGroup}>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={newProduct.includesDrinks}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              includesDrinks: e.target.checked,
                            })
                          }
                          style={styles.checkbox}
                        />
                        <span>✓ Include Minuman dalam Paket (Gratis)</span>
                      </label>

                      {newProduct.includesDrinks && (
                        <div style={styles.drinksSelection}>
                          <label style={styles.label}>
                            Pilih Minuman yang Termasuk:
                          </label>
                          <div style={styles.drinksList}>
                            {availableDrinks.map((drink) => (
                              <label
                                key={drink._id}
                                style={styles.drinkCheckbox}
                              >
                                <input
                                  type="checkbox"
                                  value={drink._id}
                                  checked={newProduct.includedDrinkIds.includes(
                                    drink._id,
                                  )}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewProduct({
                                        ...newProduct,
                                        includedDrinkIds: [
                                          ...newProduct.includedDrinkIds,
                                          drink._id,
                                        ],
                                      });
                                    } else {
                                      setNewProduct({
                                        ...newProduct,
                                        includedDrinkIds:
                                          newProduct.includedDrinkIds.filter(
                                            (id) => id !== drink._id,
                                          ),
                                      });
                                    }
                                  }}
                                />
                                <span>{drink.name}</span>
                                <small style={{ color: "#888" }}>
                                  (Rp {drink.price?.toLocaleString()})
                                </small>
                              </label>
                            ))}
                          </div>
                          {availableDrinks.length === 0 && (
                            <p style={styles.warningText}>
                              Belum ada menu minuman, tambahkan minuman terlebih
                              dahulu
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

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

            {/* ── Daftar Produk ── */}
            <div style={styles.productListSide}>
              <div style={styles.productGrid}>
                {products.map((p) => {
                  const ASSET_URL =
                    process.env.REACT_APP_API_URL || "http://localhost:5000";
                  let imageUrl = "/no-image.png";

                  if (p.image_url) {
                    if (p.image_url.startsWith("http")) {
                      imageUrl = p.image_url;
                    } else {
                      imageUrl = `${ASSET_URL}/uploads/${p.image_url}`;
                    }
                  }

                  return (
                    <div
                      key={p._id}
                      style={{
                        ...styles.productCard,
                        opacity: p.isAvailable === false ? 0.5 : 1,
                        filter:
                          p.isAvailable === false
                            ? "grayscale(0.75)"
                            : "none",
                      }}
                    >
                      <div style={styles.productImageWrapper}>
                        <img
                          src={imageUrl}
                          style={styles.productImage}
                          alt={p.name}
                          onError={(e) => {
                            e.target.src = "/no-image.png";
                          }}
                        />
                      </div>
                      <div style={{ padding: "12px" }}>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            fontWeight: "600",
                            color: "#1F2937",
                          }}
                        >
                          {p.name}
                        </h4>
                        <p style={styles.productPrice}>
                          Rp {p.price?.toLocaleString()}
                        </p>
                        {p.category === "Paket" && p.includesDrinks && (
                          <p
                            style={{
                              fontSize: 10,
                              color: "#10B981",
                              margin: "4px 0 8px 0",
                              fontWeight: "500",
                            }}
                          >
                            ✓ Include minuman
                          </p>
                        )}
                        {p.isAvailable === false && (
                          <p style={styles.disabledLabel}>Nonaktif</p>
                        )}
                        <button
                          style={styles.deleteBtn}
                          onClick={() => openDeleteModal(p._id, p.name)}
                        >
                          <Trash size={14} /> Hapus
                        </button>
                        <button
                          style={{
                            ...styles.toggleBtn,
                            ...(p.isAvailable === false
                              ? styles.activateBtn
                              : styles.deactivateBtn),
                          }}
                          onClick={() => toggleProductAvailability(p)}
                          disabled={isUpdatingProductId === p._id}
                        >
                          {p.isAvailable === false
                            ? "Aktifkan"
                            : "Nonaktifkan"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            TAB: REPORT
        ════════════════════════════════════════ */}
        {activeTab === "report" && (
          <div style={styles.reportSectionWrapper}>
            <div style={styles.reportHeader}>
              <div>
                <h2 style={styles.reportTitle}>Laporan Penjualan</h2>
              </div>
              <div style={styles.reportControls}>
                <label style={styles.reportSelectLabel}>
                  <select
                    style={styles.reportSelect}
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value)}
                  >
                    <option value="daily">Harian</option>
                    <option value="weekly">Mingguan</option>
                    <option value="monthly">Bulanan</option>
                  </select>
                </label>
                <button
                  type="button"
                  style={styles.refreshBtn}
                  onClick={() => fetchOrderReport(reportPeriod)}
                >
                  Segarkan
                </button>
              </div>
            </div>

            {reportLoading ? (
              <div style={styles.loadingWrapper}>
                <Loader className="animate-spin" size={40} />
              </div>
            ) : (
              <>
                <div style={styles.reportGrid}>
                  <div style={styles.reportCard}>
                    <div style={styles.reportCardHeader}>Total Pesanan</div>
                    <div style={styles.reportMetric}>
                      {reportData.summary.totalOrders}
                    </div>
                    <div style={styles.reportMetricLabel}>
                      Pesanan lunas dalam periode terpilih
                    </div>
                  </div>
                  <div style={styles.reportCard}>
                    <div style={styles.reportCardHeader}>Total Pendapatan</div>
                    <div style={styles.reportMetric}>
                      Rp{" "}
                      {reportData.summary.totalRevenue?.toLocaleString()}
                    </div>
                    <div style={styles.reportMetricLabel}>
                      Total penjualan bersih dari pesanan paid
                    </div>
                  </div>
                  <div style={styles.reportCard}>
                    <div style={styles.reportCardHeader}>
                      Rata-rata Pesanan
                    </div>
                    <div style={styles.reportMetric}>
                      Rp{" "}
                      {reportData.summary.avgOrderValue?.toLocaleString()}
                    </div>
                    <div style={styles.reportMetricLabel}>
                      Nilai rata-rata per pesanan lunas
                    </div>
                  </div>
                  <div style={styles.reportCard}>
                    <div style={styles.reportCardHeader}>Total Item</div>
                    <div style={styles.reportMetric}>
                      {reportData.summary.totalItems}
                    </div>
                    <div style={styles.reportMetricLabel}>
                      Jumlah item yang terjual dari pesanan paid
                    </div>
                  </div>
                </div>

                <div style={styles.reportCardsRow}>
                  <div style={styles.reportCardWide}>
                    <div style={styles.reportCardHeader}>
                      Top 5 Menu Terlaris
                    </div>
                    <table style={styles.reportTable}>
                      <thead>
                        <tr>
                          <th style={styles.reportTableHeader}>Menu</th>
                          <th style={styles.reportTableHeader}>Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.bestSelling.length === 0 ? (
                          <tr style={styles.reportTableRow}>
                            <td
                              style={styles.reportTableCell}
                              colSpan={2}
                            >
                              Tidak ada data untuk periode ini.
                            </td>
                          </tr>
                        ) : (
                          reportData.bestSelling.map((item) => (
                            <tr
                              key={item.name}
                              style={styles.reportTableRow}
                            >
                              <td style={styles.reportTableCell}>
                                {item.name}
                              </td>
                              <td style={styles.reportTableCell}>
                                {item.totalQuantity}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={styles.reportCardWide}>
                    <div style={styles.reportCardHeader}>
                      Breakdown Kategori
                    </div>
                    <table style={styles.reportTable}>
                      <thead>
                        <tr>
                          <th style={styles.reportTableHeader}>Kategori</th>
                          <th style={styles.reportTableHeader}>Qty</th>
                          <th style={styles.reportTableHeader}>
                            Pendapatan
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.categoryBreakdown.length === 0 ? (
                          <tr style={styles.reportTableRow}>
                            <td
                              style={styles.reportTableCell}
                              colSpan={3}
                            >
                              Tidak ada data untuk periode ini.
                            </td>
                          </tr>
                        ) : (
                          reportData.categoryBreakdown.map((item) => (
                            <tr
                              key={item.category}
                              style={styles.reportTableRow}
                            >
                              <td style={styles.reportTableCell}>
                                {item.category}
                              </td>
                              <td style={styles.reportTableCell}>
                                {item.quantity}
                              </td>
                              <td style={styles.reportTableCell}>
                                Rp {item.revenue?.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    backgroundColor: "#f3ca58",
    minHeight: "100vh",
    fontFamily: "sans-serif",
    position: "relative",
  },

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
  alertCloseBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9CA3AF",
    display: "flex",
    alignItems: "center",
    padding: "4px",
  },

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
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px 0 24px",
  },
  modalIconWrapper: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "#FEF2F2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9CA3AF",
    padding: "4px",
  },
  modalBody: { padding: "20px 24px" },
  modalTitle: {
    margin: "0 0 8px 0",
    fontSize: "20px",
    fontWeight: "bold",
    color: "#111827",
  },
  modalSubtitle: {
    margin: "6px 0 0",
    color: "#6B7280",
    fontSize: "14px",
    lineHeight: "1.6",
  },
  modalMessage: {
    margin: "0 0 8px 0",
    fontSize: "14px",
    color: "#374151",
    lineHeight: "1.6",
  },
  modalWarning: {
    margin: 0,
    fontSize: "13px",
    color: "#6B7280",
    lineHeight: "1.6",
  },
  modalHeaderTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    padding: "20px 24px 0 24px",
  },
  modalClose: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#374151",
    fontSize: "20px",
    lineHeight: 1,
  },
  modalBodySection: {
    padding: "14px 24px",
    borderTop: "1px solid #E5E7EB",
  },
  modalLabel: {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#111827",
  },
  modalTextarea: {
    width: "100%",
    borderRadius: "12px",
    border: "1px solid #D1D5DB",
    padding: "12px",
    fontSize: "14px",
    resize: "vertical",
    minHeight: "80px",
    boxSizing: "border-box",
  },
  modalAddRow: {
    display: "grid",
    gridTemplateColumns: "2fr 0.8fr 0.9fr",
    gap: "10px",
    alignItems: "center",
  },
  modalSelect: {
    width: "100%",
    borderRadius: "12px",
    border: "1px solid #D1D5DB",
    padding: "10px 12px",
    fontSize: "14px",
  },
  modalQuantityInput: {
    width: "100%",
    minWidth: "70px",
    borderRadius: "12px",
    border: "1px solid #D1D5DB",
    padding: "10px 12px",
    fontSize: "14px",
  },
  modalAddButton: {
    border: "1px solid #8B5CF6",
    borderRadius: "12px",
    backgroundColor: "#8B5CF6",
    color: "white",
    padding: "10px 14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  pendingList: {
    marginTop: "14px",
    borderRadius: "14px",
    backgroundColor: "#F8FAFC",
    border: "1px solid #E5E7EB",
    padding: "12px",
  },
  pendingItemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #E5E7EB",
  },
  pendingItemMeta: {
    marginTop: "4px",
    color: "#6B7280",
    fontSize: "13px",
  },
  pendingRemoveBtn: {
    background: "none",
    border: "none",
    color: "#EF4444",
    cursor: "pointer",
    fontSize: "13px",
  },
  modalFooterRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "20px 24px 24px 24px",
    borderTop: "1px solid #E5E7EB",
  },
  modalCancelBtn: {
    padding: "10px 18px",
    borderRadius: "12px",
    border: "1px solid #D1D5DB",
    backgroundColor: "white",
    cursor: "pointer",
    fontWeight: "600",
  },
  modalSaveBtn: {
    padding: "10px 18px",
    borderRadius: "12px",
    border: "none",
    backgroundColor: "#10B981",
    color: "white",
    cursor: "pointer",
    fontWeight: "600",
  },
  modalFooter: {
    display: "flex",
    gap: "12px",
    padding: "0 24px 24px 24px",
  },
  modalDeleteBtn: {
    flex: 1,
    padding: "10px",
    backgroundColor: "#EF4444",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  editOrderModal: {
    backgroundColor: "white",
    borderRadius: "20px",
    width: "90%",
    maxWidth: "550px",
    maxHeight: "85vh",
    overflowY: "auto",
    boxShadow: "0 25px 40px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
  },

  variantSection: {
    marginTop: "12px",
    padding: "8px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid #E5E7EB",
  },
  variantRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "12px",
    alignItems: "center",
  },
  removeVariantBtn: {
    padding: "8px 12px",
    backgroundColor: "#FEE2E2",
    color: "#EF4444",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
  },
  addVariantBtn: {
    padding: "8px 12px",
    backgroundColor: "#E5E7EB",
    color: "#374151",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    marginTop: "8px",
  },

  socketNotification: {
    position: "fixed",
    top: "90px",
    right: "20px",
    zIndex: 9998,
    minWidth: "240px",
    padding: "14px 18px",
    borderRadius: "14px",
    backgroundColor: "#1D4ED8",
    color: "white",
    boxShadow: "0 20px 35px rgba(30, 64, 175, 0.18)",
    fontWeight: "600",
    letterSpacing: "0.01em",
    cursor: "pointer",
  },

  badgeRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  recentBadge: {
    fontSize: "11px",
    backgroundColor: "#FDE68A",
    color: "#92400E",
    padding: "4px 10px",
    borderRadius: "9999px",
    fontWeight: "700",
    letterSpacing: "0.01em",
  },
  orderNoteWrapper: {
    margin: "12px 0",
    padding: "12px 14px",
    borderRadius: "14px",
    backgroundColor: "#FEF3C7",
    border: "1px solid #FDE68A",
    color: "#92400E",
    fontSize: "14px",
    lineHeight: "1.6",
  },

  disabledLabel: {
    margin: "8px 0 0 0",
    fontSize: "12px",
    color: "#9CA3AF",
    fontWeight: "600",
  },
  toggleBtn: {
    width: "100%",
    padding: "10px",
    marginTop: "8px",
    borderRadius: "8px",
    border: "none",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  activateBtn: { backgroundColor: "#10B981" },
  deactivateBtn: { backgroundColor: "#F97316" },

  container: { maxWidth: 1200, margin: "0 auto", padding: "0 16px" },
  header: {
    backgroundColor: "white",
    borderBottom: "1px solid #E5E7EB",
    position: "sticky",
    top: 0,
    zIndex: 10,
    padding: "12px 0",
  },
  headerContent: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  logoArea: { display: "flex", alignItems: "center", gap: 12 },
  logoText: {
    margin: 0,
    fontSize: "clamp(18px, 5vw, 24px)",
    fontWeight: "bold",
    color: "#c0392b",
  },
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
    display: "flex",
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

  ordersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
    gap: 20,
    paddingTop: 20,
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    overflow: "hidden",
  },
  orderCardContent: {
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  orderHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  tableNumberWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#c0392b",
    padding: "6px 14px",
    borderRadius: "30px",
    boxShadow: "0 2px 8px rgba(192, 57, 43, 0.3)",
  },
  tableNumberWrapperDisabled: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#9CA3AF",
    padding: "6px 14px",
    borderRadius: "30px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  tableNumberLabel: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: "0.5px",
  },
  tableNumberValue: {
    fontSize: "20px",
    fontWeight: "800",
    color: "white",
    lineHeight: 1,
    minWidth: "30px",
    textAlign: "center",
  },

  statusBadge: {
    fontSize: 10,
    fontWeight: "900",
    padding: "4px 12px",
    borderRadius: 20,
  },

  categoriesContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginBottom: 16,
  },
  categorySection: {
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FAFAFA",
  },
  categoryHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    fontWeight: "bold",
    fontSize: "13px",
  },
  categoryTitle: {
    fontWeight: "bold",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
  },
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
    padding: "10px 8px",
    marginBottom: "4px",
    borderRadius: "8px",
    transition: "all 0.2s",
  },
  categoryItemInfo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    flex: 1,
  },
  categoryItemQuantity: {
    fontWeight: "bold",
    color: "#c0392b",
    minWidth: "35px",
    fontSize: "13px",
  },
  categoryItemName: { color: "#374151", fontSize: "13px", flex: 1 },
  packageBadge: {
    display: "inline-block",
    backgroundColor: "#FEF3C7",
    color: "#D97706",
    fontSize: "10px",
    fontWeight: "bold",
    padding: "2px 6px",
    borderRadius: "8px",
    marginLeft: "6px",
    border: "1px solid #FDE68A",
  },
  newItemBadge: {
    backgroundColor: "#10B981",
    color: "white",
    fontSize: "10px",
    borderRadius: "999px",
    padding: "2px 8px",
    marginLeft: "8px",
    fontWeight: "700",
    display: "inline-flex",
    alignItems: "center",
  },
  itemStatusBadge: {
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "10px",
    fontWeight: "bold",
  },
  categoryItemPrice: {
    fontWeight: "bold",
    color: "#EA580C",
    fontSize: "13px",
    minWidth: "90px",
    textAlign: "right",
  },

  orderFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 12,
    borderTop: "1px solid #E5E7EB",
  },
  orderId: { fontSize: 10, color: "#9CA3AF", fontFamily: "monospace" },
  orderTotal: { fontSize: 18, fontWeight: "bold", color: "#EA580C" },
  orderTotalPaid: { fontSize: 18, fontWeight: "bold", color: "#9CA3AF" },
  printToggleContainer: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  printToggleLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "#374151",
    cursor: "pointer",
  },
  printToggleCheckbox: {
    width: 16,
    height: 16,
    accentColor: "#2563eb",
  },
  orderActions: {
    display: "flex",
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },

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

  completedBadge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px",
    backgroundColor: "#D1FAE5",
    borderRadius: "12px",
    color: "#065F46",
    fontSize: "14px",
    fontWeight: "bold",
    marginTop: "8px",
  },

  productFlex: {
    display: "flex",
    flexDirection: "column",
    gap: 30,
    paddingTop: 20,
  },
  productFormSide: { width: "100%" },
  productListSide: { width: "100%" },
  formCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 16,
    border: "1px solid #E5E7EB",
  },
  formTitle: {
    margin: "0 0 20px 0",
    color: "#c0392b",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: "18px",
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
    padding: 12,
    borderRadius: 10,
    border: "1px solid #D1D5DB",
    boxSizing: "border-box",
    fontSize: "14px",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  inputRow: { display: "flex", gap: 12, flexDirection: "row" },
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
    padding: 14,
    borderRadius: 12,
    border: "none",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "16px",
  },

  checkboxGroup: {
    marginTop: "10px",
    padding: "12px",
    backgroundColor: "#F9FAFB",
    borderRadius: "10px",
    border: "1px solid #E5E7EB",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    color: "#374151",
  },
  checkbox: { width: "18px", height: "18px", cursor: "pointer" },
  drinksSelection: {
    marginTop: "12px",
    paddingLeft: "20px",
    borderLeft: "2px solid #E5E7EB",
  },
  drinksList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
    maxHeight: "200px",
    overflowY: "auto",
  },
  drinkCheckbox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    cursor: "pointer",
    fontSize: "13px",
    padding: "6px",
    borderRadius: "6px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5E7EB",
  },
  warningText: { fontSize: "12px", color: "#EF4444", marginTop: "8px" },

  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 20,
  },

  reportSectionWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    paddingTop: 20,
  },
  reportHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  reportTitle: {
    margin: 0,
    fontSize: "clamp(22px, 3vw, 28px)",
    color: "#1F2937",
  },
  reportControls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  reportSelectLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 14,
    color: "#374151",
  },
  reportSelect: {
    minWidth: 160,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #D1D5DB",
    fontSize: 14,
    outline: "none",
    marginTop: 4,
  },
  refreshBtn: {
    backgroundColor: "#c0392b",
    color: "white",
    border: "none",
    borderRadius: 12,
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  loadingWrapper: { display: "flex", justifyContent: "center", padding: 40 },
  reportGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 20,
  },
  reportCard: {
    backgroundColor: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    padding: 20,
    minHeight: 140,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  reportCardWide: {
    backgroundColor: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    padding: 20,
    width: "100%",
  },
  reportCardHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
  },
  reportMetric: { fontSize: 28, fontWeight: "bold", color: "#c0392b" },
  reportMetricLabel: { color: "#6B7280", fontSize: 13, lineHeight: 1.5 },
  reportCardsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  reportTable: { width: "100%", borderCollapse: "collapse" },
  reportTableHeader: {
    textAlign: "left",
    padding: "12px",
    fontSize: 13,
    color: "#6B7280",
    borderBottom: "1px solid #E5E7EB",
  },
  reportTableRow: { borderBottom: "1px solid #E5E7EB" },
  reportTableCell: { padding: "12px", fontSize: 14, color: "#374151" },

  productCard: {
    backgroundColor: "white",
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    overflow: "hidden",
    transition: "all 0.2s ease",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
  },
  productImageWrapper: {
    height: 160,
    backgroundColor: "#F9FAFB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transition: "transform 0.2s ease",
  },
  productPrice: {
    color: "#c0392b",
    fontWeight: "bold",
    margin: "8px 0 4px 0",
    fontSize: "15px",
  },
  deleteBtn: {
    width: "100%",
    border: "1px solid #FEE2E2",
    color: "#EF4444",
    backgroundColor: "#FEF2F2",
    padding: "8px 12px",
    borderRadius: "10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontWeight: "bold",
    fontSize: "13px",
    marginTop: "8px",
    transition: "all 0.2s",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px",
    backgroundColor: "white",
    borderRadius: 16,
    color: "#9CA3AF",
  },
  optionBadge: {
    display: "inline-block",
    fontSize: "10px",
    fontWeight: "bold",
    padding: "2px 8px",
    borderRadius: "20px",
    marginLeft: "8px",
    border: "1px solid rgba(0,0,0,0.05)",
  },
};

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

export default AdminPage;