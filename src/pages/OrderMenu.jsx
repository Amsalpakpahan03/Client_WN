// src/pages/OrderMenu.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import socket from "../api/socket";
import { useMenu } from "../hooks/useMenu";
import { useOrder } from "../hooks/useOrder";
import Footer from "../components/Footer";
// import FrequentlyBought from "../components/FrequentlyBought"; // 🔥 DINONAKTIFKAN SEMENTARA

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
    [location.search],
  );
  const tableNumber = query.get("table");

  const { menuItems = [] } = useMenu();
  const { activeOrder, createOrder, addItemsToOrder, updateOrderFromSocket } =
    useOrder(tableNumber);

  const [orderToken, setOrderToken] = useState(null);
  const [cart, setCart] = useState({});
  const [itemOptions, setItemOptions] = useState({});
  const [isLocked, setIsLocked] = useState(false);
  const [showLockAlert, setShowLockAlert] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [hasShownOrderCompleteAlert, setHasShownOrderCompleteAlert] = useState(false);
  const [orderProgress, setOrderProgress] = useState(0);
  const [showOrderAnimation, setShowOrderAnimation] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [deliveredItems, setDeliveredItems] = useState({});
  const [activeCategory, setActiveCategory] = useState("Paket");
  
  // ============ STATE UNTUK FITUR PESAN LAGI ============
  const [showAddToOrderModal, setShowAddToOrderModal] = useState(false);
  const [additionalCart, setAdditionalCart] = useState({});
  const [isAddingToOrder, setIsAddingToOrder] = useState(false);
  const [notes, setNotes] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Ref untuk scroll ke kategori
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

  // Load additional cart from localStorage
  useEffect(() => {
    if (tableNumber && activeOrder?._id) {
      const savedAdditionalCartKey = `additional_cart_${tableNumber}_${activeOrder._id}`;
      const savedCart = localStorage.getItem(savedAdditionalCartKey);
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          setAdditionalCart(parsedCart);
        } catch (e) {
          console.error("Failed to parse saved additional cart", e);
        }
      }
    }
  }, [tableNumber, activeOrder?._id]);

  // Save additional cart to localStorage
  useEffect(() => {
    if (tableNumber && activeOrder?._id && Object.keys(additionalCart).length > 0) {
      const savedAdditionalCartKey = `additional_cart_${tableNumber}_${activeOrder._id}`;
      localStorage.setItem(savedAdditionalCartKey, JSON.stringify(additionalCart));
    } else if (tableNumber && activeOrder?._id && Object.keys(additionalCart).length === 0) {
      const savedAdditionalCartKey = `additional_cart_${tableNumber}_${activeOrder._id}`;
      localStorage.removeItem(savedAdditionalCartKey);
    }
  }, [additionalCart, tableNumber, activeOrder?._id]);

  useEffect(() => {
    if (!Array.isArray(menuItems) || menuItems.length === 0) return;

    setItemOptions((prev) => {
      const next = { ...prev };
      menuItems.forEach((item) => {
        if (!next[item._id]) {
          next[item._id] = {
            temperature: item.hasTemperature ? "Hangat" : null,
            variantIndex:
              item.hasVariants && Array.isArray(item.variants) && item.variants.length > 0
                ? 0
                : -1,
          };
        }
      });
      return next;
    });
  }, [menuItems]);

  // ============ FUNGSI GET SELECTED OPTION ============
  const getSelectedOption = useCallback(
    (item) => {
      const option = itemOptions[item._id] || {};
      const temperature = item.hasTemperature
        ? option.temperature || "Hangat"
        : null;
      const variantIndex = item.hasVariants
        ? typeof option.variantIndex === "number"
          ? option.variantIndex
          : 0
        : -1;
      const variant = item.hasVariants
        ? item.variants?.[variantIndex] || null
        : null;
      const extraTempPrice = item.hasTemperature && temperature === "Es"
        ? Number(item.extraPriceForIce || 0)
        : 0;
      const extraVariantPrice = variant ? Number(variant.extraPrice || 0) : 0;
      const optionLabelParts = [];
      if (variant?.name) optionLabelParts.push(variant.name);
      if (temperature) optionLabelParts.push(temperature);
      return {
        temperature,
        variant,
        variantIndex,
        extraPrice: extraTempPrice + extraVariantPrice,
        optionLabel: optionLabelParts.join(" / "),
      };
    },
    [itemOptions],
  );

  // ============ SINKRONISASI HARGA CART DENGAN OPSI ============
  useEffect(() => {
    if (Object.keys(cart).length === 0) return;
    
    setCart((prevCart) => {
      let hasChanges = false;
      const updatedCart = { ...prevCart };
      
      Object.keys(updatedCart).forEach((cartKey) => {
        const cartItem = updatedCart[cartKey];
        const menuItem = menuItems.find(m => m._id === cartItem.itemId);
        
        if (menuItem) {
          const selectedOption = getSelectedOption(menuItem);
          const newPrice = Number(menuItem.price || 0) + Number(selectedOption.extraPrice || 0);
          const newOptionLabel = selectedOption.optionLabel;
          const newItemName = newOptionLabel ? `${menuItem.name} (${newOptionLabel})` : menuItem.name;
          const newCartKey = `${menuItem._id}::${newOptionLabel || "default"}`;
          
          // Jika harga atau optionLabel berubah
          if (cartItem.price !== newPrice || cartItem.optionLabel !== newOptionLabel) {
            // Hapus item lama
            delete updatedCart[cartKey];
            // Tambah item baru dengan key dan harga update
            updatedCart[newCartKey] = {
              ...cartItem,
              cartKey: newCartKey,
              name: newItemName,
              price: newPrice,
              optionLabel: newOptionLabel,
              temperature: selectedOption.temperature,
              variantName: selectedOption.variant?.name || null,
            };
            hasChanges = true;
          }
        }
      });
      
      return hasChanges ? updatedCart : prevCart;
    });
  }, [itemOptions, menuItems, getSelectedOption, cart]);
  
  // ============ SINKRONISASI HARGA ADDITIONAL CART DENGAN OPSI ============
  useEffect(() => {
    if (Object.keys(additionalCart).length === 0) return;
    
    setAdditionalCart((prevCart) => {
      let hasChanges = false;
      const updatedCart = { ...prevCart };
      
      Object.keys(updatedCart).forEach((cartKey) => {
        const cartItem = updatedCart[cartKey];
        const menuItem = menuItems.find(m => m._id === cartItem.itemId);
        
        if (menuItem) {
          const selectedOption = getSelectedOption(menuItem);
          const newPrice = Number(menuItem.price || 0) + Number(selectedOption.extraPrice || 0);
          const newOptionLabel = selectedOption.optionLabel;
          const newItemName = newOptionLabel ? `${menuItem.name} (${newOptionLabel})` : menuItem.name;
          const newCartKey = `${menuItem._id}::${newOptionLabel || "default"}`;
          
          // Jika harga atau optionLabel berubah
          if (cartItem.price !== newPrice || cartItem.optionLabel !== newOptionLabel) {
            // Hapus item lama
            delete updatedCart[cartKey];
            // Tambah item baru dengan key dan harga update
            updatedCart[newCartKey] = {
              ...cartItem,
              cartKey: newCartKey,
              name: newItemName,
              price: newPrice,
              optionLabel: newOptionLabel,
              temperature: selectedOption.temperature,
              variantName: selectedOption.variant?.name || null,
            };
            hasChanges = true;
          }
        }
      });
      
      return hasChanges ? updatedCart : prevCart;
    });
  }, [itemOptions, menuItems, getSelectedOption, additionalCart]);

  const handleOptionChange = (itemId, key, value) => {
    setItemOptions((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [key]: value,
      },
    }));
  };

  const getItemQuantity = useCallback(
    (itemId) =>
      Object.values(cart).reduce(
        (sum, entry) => (entry.itemId === itemId ? sum + entry.quantity : sum),
        0,
      ),
    [cart],
  );

  const getCartKey = (item, optionLabel) => {
    return `${item._id}::${optionLabel || "default"}`;
  };

  const addToCart = useCallback(
    (item) => {
      const selectedOption = getSelectedOption(item);
      const cartKey = getCartKey(item, selectedOption.optionLabel);
      const unitPrice = Number(item.price || 0) + Number(selectedOption.extraPrice || 0);
      const itemName = selectedOption.optionLabel
        ? `${item.name} (${selectedOption.optionLabel})`
        : item.name;

      setCart((prev) => {
        const existing = prev[cartKey];
        return {
          ...prev,
          [cartKey]: {
            cartKey,
            itemId: item._id,
            name: itemName,
            category: item.category,
            quantity: existing ? existing.quantity + 1 : 1,
            price: unitPrice,
            basePrice: Number(item.price || 0),
            optionLabel: selectedOption.optionLabel,
            temperature: selectedOption.temperature,
            variantName: selectedOption.variant?.name || null,
            description: item.description || "",
          },
        };
      });
    },
    [getSelectedOption],
  );

  const removeFromCart = useCallback(
    (item) => {
      const selectedOption = getSelectedOption(item);
      const cartKey = getCartKey(item, selectedOption.optionLabel);
      setCart((prev) => {
        const existing = prev[cartKey];
        if (!existing) return prev;
        if (existing.quantity <= 1) {
          const next = { ...prev };
          delete next[cartKey];
          return next;
        }
        return {
          ...prev,
          [cartKey]: {
            ...existing,
            quantity: existing.quantity - 1,
          },
        };
      });
    },
    [getSelectedOption],
  );

  // ============ FUNGSI UNTUK ADDITIONAL CART (PESAN LAGI) ============
  const addToAdditionalCart = useCallback((item) => {
    const selectedOption = getSelectedOption(item);
    const cartKey = getCartKey(item, selectedOption.optionLabel);
    const unitPrice = Number(item.price || 0) + Number(selectedOption.extraPrice || 0);
    const itemName = selectedOption.optionLabel
      ? `${item.name} (${selectedOption.optionLabel})`
      : item.name;

    setAdditionalCart((prev) => {
      const existing = prev[cartKey];
      return {
        ...prev,
        [cartKey]: {
          cartKey,
          itemId: item._id,
          name: itemName,
          category: item.category,
          quantity: existing ? existing.quantity + 1 : 1,
          price: unitPrice,
          basePrice: Number(item.price || 0),
          optionLabel: selectedOption.optionLabel,
          temperature: selectedOption.temperature,
          variantName: selectedOption.variant?.name || null,
          description: item.description || "",
        },
      };
    });
  }, [getSelectedOption]);

  const removeFromAdditionalCart = useCallback((item) => {
    const selectedOption = getSelectedOption(item);
    const cartKey = getCartKey(item, selectedOption.optionLabel);
    setAdditionalCart((prev) => {
      const existing = prev[cartKey];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[cartKey];
        return next;
      }
      return {
        ...prev,
        [cartKey]: {
          ...existing,
          quantity: existing.quantity - 1,
        },
      };
    });
  }, [getSelectedOption]);

  const getAdditionalItemQuantity = useCallback(
    (itemId) =>
      Object.values(additionalCart).reduce(
        (sum, entry) => (entry.itemId === itemId ? sum + entry.quantity : sum),
        0,
      ),
    [additionalCart],
  );

  const additionalTotalPrice = useMemo(() => {
    return Object.values(additionalCart).reduce(
      (sum, entry) => sum + entry.price * entry.quantity,
      0,
    );
  }, [additionalCart]);

  const totalPrice = useMemo(() => {
    return Object.values(cart).reduce(
      (sum, entry) => sum + entry.price * entry.quantity,
      0,
    );
  }, [cart]);

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

    const items = Object.values(cart)
      .filter(entry => entry.quantity > 0 && entry.name && entry.name !== "Unknown")
      .map((entry) => ({
        productId: entry.itemId,
        name: entry.name,
        description: entry.description || "",
        quantity: entry.quantity,
        price: entry.price,
        category: entry.category,
        status: "pending",
      }));

    if (items.length === 0) {
      alert("Tidak ada item valid untuk dipesan");
      return;
    }

    setIsSubmitting(true);
    setShowOrderAnimation(true);
    setAnimationProgress(0);

    try {
      if (activeOrder && activeOrder._id) {
        await addItemsToOrder(activeOrder._id, {
          items,
          totalPrice,
          notes: additionalNotes.trim(),
        });
      } else {
        await createOrder({
          tableNumber,
          items,
          totalPrice,
          notes: notes.trim(),
          token,
        });
      }

      setCart({});
      setNotes("");
      setAdditionalNotes("");
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

  // ============ FUNGSI HANDLE TAMBAH KE PESANAN AKTIF ============
  const handleAddToExistingOrder = async () => {
    const token = localStorage.getItem("order_token");
    if (!token || isTokenExpired(token)) {
      handleSessionExpired();
      return;
    }
    if (Object.keys(additionalCart).length === 0) {
      alert("Silakan pilih menu terlebih dahulu");
      return;
    }

    const newItems = Object.values(additionalCart)
      .filter(entry => entry.quantity > 0 && entry.name && entry.name !== "Unknown")
      .map((entry) => ({
        productId: entry.itemId,
        name: entry.name,
        description: entry.description || "",
        quantity: entry.quantity,
        price: entry.price,
        category: entry.category,
        status: "pending",
      }));

    setIsAddingToOrder(true);
    setShowOrderAnimation(true);
    setAnimationProgress(0);

    try {
      await addItemsToOrder(activeOrder._id, {
        items: newItems,
        totalPrice: additionalTotalPrice,
        notes: additionalNotes.trim(),
      });
      
      setAdditionalCart({});
      setAdditionalNotes("");
      setShowAddToOrderModal(false);
      
      const savedAdditionalCartKey = `additional_cart_${tableNumber}_${activeOrder._id}`;
      localStorage.removeItem(savedAdditionalCartKey);

      for (let i = 0; i <= 100; i += 5) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        setAnimationProgress(i);
      }

      setTimeout(() => setShowOrderAnimation(false), 500);
      alert("Menu berhasil ditambahkan ke pesanan!");
    } catch (err) {
      setShowOrderAnimation(false);
      console.error("Error adding items:", err);
      alert(err.response?.data?.message || "Gagal menambahkan menu.");
    } finally {
      setIsAddingToOrder(false);
    }
  };

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
    if (
      tableNumber &&
      activeOrder?._id &&
      Object.keys(deliveredItems).length > 0
    ) {
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

  // Clear saved data when order is completed (paid) and redirect customer
  useEffect(() => {
    if (activeOrder?.status === "paid" && tableNumber && activeOrder?._id) {
      const savedCartKey = `cart_${tableNumber}`;
      const savedDeliveredKey = `delivered_${tableNumber}_${activeOrder._id}`;
      const savedProgressKey = `progress_${tableNumber}_${activeOrder._id}`;
      const savedAdditionalCartKey = `additional_cart_${tableNumber}_${activeOrder._id}`;

      localStorage.removeItem(savedCartKey);
      localStorage.removeItem(savedDeliveredKey);
      localStorage.removeItem(savedProgressKey);
      localStorage.removeItem(savedAdditionalCartKey);
      localStorage.removeItem("order_token");

      if (!hasShownOrderCompleteAlert) {
        setHasShownOrderCompleteAlert(true);
        alert("Pesanan selesai, terima kasih!");
        setTimeout(() => {
          navigate("/");
        }, 2000);
      }
    }
  }, [activeOrder?.status, tableNumber, activeOrder?._id, hasShownOrderCompleteAlert, navigate]);

  // Calculate statistics for delivered items
  const deliveredStats = useMemo(() => {
    const items =
      activeOrder?.items && Array.isArray(activeOrder.items)
        ? activeOrder.items
        : [];
    const totalItems = items.length;
    const deliveredCount = items.filter(
      (item) => item?.name && deliveredItems[item.name]?.delivered,
    ).length;
    const drinkItems = items.filter((item) => item?.category === "Minuman");
    const drinkDelivered = drinkItems.filter(
      (item) => item?.name && deliveredItems[item.name]?.delivered,
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

  // Fungsi untuk mendapatkan minuman dari paket
  const getPackageDrinks = (packageItem) => {
    if (
      !packageItem.includesDrinks ||
      !packageItem.includedDrinkIds ||
      !Array.isArray(packageItem.includedDrinkIds)
    ) {
      return [];
    }
    return menuItems.filter(
      (item) =>
        item.category === "Minuman" &&
        packageItem.includedDrinkIds.includes(item._id),
    );
  };

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
            <h2 style={{ fontSize: "24px", color: "#27ae60", marginBottom: "12px" }}>
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
            <p style={{ color: COLORS.textLight, fontSize: "14px", marginBottom: "20px" }}>
              Maaf, meja nomor <b>{tableNumber}</b> sedang diakses oleh pelanggan lain.
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
            <div style={styles.alertBox}>Meja {tableNumber} sedang digunakan</div>
          </div>
        )}

        {/* 🔥 KOMPONEN FREQUENTLY BOUGHT DINONAKTIFKAN SEMENTARA */}
        {/* <FrequentlyBought onAddToCart={addToCart} menuItems={menuItems} /> */}

        {activeOrder && (
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

              {activeOrder.notes ? (
                <div style={styles.activeOrderNotes}>
                  <strong>Catatan Pesanan:</strong> {activeOrder.notes}
                </div>
              ) : null}

              <div style={styles.progressWrapper}>
                <div style={styles.progressSteps}>
                  {["pending", "cooking", "served"].map((stepStatus, idx) => {
                    const safeProgress = typeof orderProgress === "number" ? orderProgress : 0;
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
                      width: `${typeof orderProgress === "number" ? orderProgress : 0}%`,
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
                        <span style={styles.orderItemName}>
                          {item.name || "Unknown"}
                          <span style={styles.orderItemQuantity}> x{item.quantity || 0}</span>
                          {isDelivered && (
                            <span style={styles.deliveredBadge}>
                              <span style={styles.checkIcon}>✓</span> Sudah Diantar
                            </span>
                          )}
                          {!isDelivered && isDrink && activeOrder.status === "cooking" && (
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
              <span style={styles.totalValue}>Rp {(activeOrder.totalPrice || 0).toLocaleString()}</span>
            </div>

            {deliveredStats.hasPartialDelivery && deliveredStats.drinkDelivered < deliveredStats.drinkItems && (
              <div style={styles.deliveryProgress}>
                <div style={styles.deliveryProgressText}>Minuman sudah diantar, makanan masih dimasak...</div>
                <div style={styles.waveAnimation}>
                  <div style={styles.waveDot} />
                  <div style={styles.waveDot} />
                  <div style={styles.waveDot} />
                </div>
              </div>
            )}

            {/* TOMBOL PESAN LAGI */}
            <div style={styles.addMoreButtonContainer}>
              <button
                style={styles.addMoreButton}
                onClick={() => setShowAddToOrderModal(true)}
              >
                + Pesan Lagi
              </button>
            </div>
          </div>
        )}
        
        {/* 🔥 HANYA TAMPILKAN MENU KETIKA TIDAK ADA ACTIVE ORDER */}
        {!activeOrder && (
          <>
            <div style={styles.categoryNav}>
              {CATEGORIES.map((cat) => {
                const hasItems = menuByCategory.find((c) => c.name === cat)?.items.length > 0;
                if (!hasItems) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => scrollToCategory(cat)}
                    style={{
                      ...styles.navButton,
                      backgroundColor: activeCategory === cat ? COLORS.orange : "#f5f5f5",
                      color: activeCategory === cat ? "#fff" : COLORS.textDark,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "0 20px 100px 20px" }}>
              {menuByCategory.map(
                (cat) =>
                  cat.items.length > 0 && (
                    <div
                      key={cat.name}
                      ref={(el) => (categoryRefs.current[cat.name] = el)}
                      style={{ marginBottom: "25px" }}
                    >
                      <h3 style={styles.categoryHeading}>{cat.name}</h3>
                      {cat.items.map((item) => (
                        <MenuItem
                          key={item._id}
                          item={item}
                          qty={getItemQuantity(item._id)}
                          selectedOption={itemOptions[item._id] || {}}
                          onOptionChange={handleOptionChange}
                          onAdd={addToCart}
                          onRemove={removeFromCart}
                        />
                      ))}
                    </div>
                  ),
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
              <div style={{ ...styles.loadingFill, width: `${animationProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {!!Object.keys(cart).length && !activeOrder && (
        <div style={styles.cartBar}>
          <textarea
            style={styles.cartNotes}
            placeholder="Catatan tambahan (opsional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div>
              <span style={{ fontSize: "11px", color: "#888" }}>Total Pesanan</span>
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
        </div>
      )}

      {/* MODAL UNTUK PESAN LAGI */}
      {showAddToOrderModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddToOrderModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Tambah Menu ke Pesanan</h3>
              <button style={styles.modalClose} onClick={() => setShowAddToOrderModal(false)}>✕</button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.modalCategoryNav}>
                {CATEGORIES.map((cat) => {
                  const hasItems = menuByCategory.find((c) => c.name === cat)?.items.length > 0;
                  if (!hasItems) return null;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        const ref = categoryRefs.current[cat];
                        if (ref) {
                          ref.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                      style={styles.modalNavButton}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
              
              <div style={{ maxHeight: "400px", overflowY: "auto", padding: "0 10px" }}>
                {menuByCategory.map(
                  (cat) =>
                    cat.items.length > 0 && (
                      <div key={cat.name} style={{ marginBottom: "25px" }}>
                        <h3 style={styles.categoryHeading}>{cat.name}</h3>
                        {cat.items.map((item) => (
                          <MenuItem
                            key={item._id}
                            item={item}
                            qty={getAdditionalItemQuantity(item._id)}
                            selectedOption={itemOptions[item._id] || {}}
                            onOptionChange={handleOptionChange}
                            onAdd={addToAdditionalCart}
                            onRemove={removeFromAdditionalCart}
                          />
                        ))}
                      </div>
                    ),
                )}
              </div>
            </div>
            
            <div style={{ padding: "14px 0" }}>
              <label style={styles.label}>Catatan Tambahan (opsional)</label>
              <textarea
                style={styles.input}
                placeholder="Tambahkan catatan khusus untuk pesanan tambahan..."
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows="3"
              />
            </div>
            <div style={styles.modalFooter}>
              <div style={styles.modalTotal}>
                <span>Total Tambahan:</span>
                <span style={{ color: COLORS.orange, fontWeight: "bold", fontSize: "18px" }}>
                  Rp {additionalTotalPrice.toLocaleString()}
                </span>
              </div>
              <button
                style={{
                  ...styles.orderButton,
                  backgroundColor: COLORS.orange,
                  opacity: isAddingToOrder || Object.keys(additionalCart).length === 0 ? 0.7 : 1,
                }}
                onClick={handleAddToExistingOrder}
                disabled={isAddingToOrder || Object.keys(additionalCart).length === 0}
              >
                {isAddingToOrder ? <div style={styles.buttonSpinner} /> : `Tambah ke Pesanan (Rp ${additionalTotalPrice.toLocaleString()})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

// ================= MENU ITEM COMPONENT =================
const MenuItem = React.memo(function MenuItem({ item, qty, selectedOption, onOptionChange, onAdd, onRemove }) {
  const ASSET_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
  const [imgError, setImgError] = useState(false);

  const temperature = item.hasTemperature
    ? selectedOption?.temperature || "Hangat"
    : null;
  const variantIndex = item.hasVariants
    ? typeof selectedOption?.variantIndex === "number"
      ? selectedOption.variantIndex
      : 0
    : -1;
  const variant = item.hasVariants
    ? item.variants?.[variantIndex] || null
    : null;
  const extraTempPrice = item.hasTemperature && temperature === "Es"
    ? Number(item.extraPriceForIce || 0)
    : 0;
  const extraVariantPrice = variant ? Number(variant.extraPrice || 0) : 0;
  const displayPrice = Number(item.price || 0) + extraTempPrice + extraVariantPrice;
  const optionLabelParts = [];
  if (variant?.name) optionLabelParts.push(variant.name);
  if (temperature) optionLabelParts.push(temperature);
  const optionLabel = optionLabelParts.join(" / ");

  const getImageUrl = () => {
    if (imgError) {
      return `${ASSET_URL}/uploads/no-image.png`;
    }
    if (!item.image_url) {
      return `${ASSET_URL}/uploads/no-image.png`;
    }
    if (item.image_url.startsWith("http")) {
      const baseUrl = item.image_url.split("?")[0];
      return baseUrl;
    }
    return `${ASSET_URL}/uploads/${item.image_url}`;
  };

  if (!item) return null;

  return (
    <div style={styles.menuCard}>
      <img
        src={getImageUrl()}
        alt={item.name || "Menu item"}
        style={styles.menuImage}
        loading="eager"
        onError={() => {
          if (!imgError) setImgError(true);
        }}
      />
      <div style={styles.menuInfo}>
        <div style={styles.menuName}>{item.name || "Unknown"}</div>
        {item.description && <div style={styles.menuDesc}>{item.description}</div>}
        <div style={styles.menuPrice}>Rp {displayPrice.toLocaleString()}</div>
        {item.hasTemperature && item.category === "Minuman" && (
          <div style={styles.optionSection}>
            <div style={styles.optionRow}>
              {[
                { label: "Hangat", value: "Hangat" },
                { label: "Es", value: "Es" },
              ].map((option) => (
                <label key={option.value} style={styles.optionRadioLabel}>
                  <input
                    type="radio"
                    name={`temperature-${item._id}`}
                    value={option.value}
                    checked={temperature === option.value}
                    onChange={() =>
                      onOptionChange(item._id, "temperature", option.value)
                    }
                    style={styles.radioInput}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        )}
        {item.hasVariants && item.category === "Makanan" && Array.isArray(item.variants) && item.variants.length > 0 && (
          <div style={styles.optionSection}>
            <label style={styles.optionLabel}>Varian</label>
            <select
              style={styles.optionSelect}
              value={variantIndex}
              onChange={(e) =>
                onOptionChange(item._id, "variantIndex", Number(e.target.value))
              }
            >
              {item.variants.map((variantItem, idx) => (
                <option key={variantItem.name + idx} value={idx}>
                  {variantItem.name} {variantItem.extraPrice ? `(+Rp ${variantItem.extraPrice.toLocaleString()})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div style={styles.menuAction}>
        {qty > 0 ? (
          <div style={styles.qtyWrapper}>
            <button style={styles.qtyBtnSmall} onClick={() => onRemove(item)}>−</button>
            <span style={{ fontWeight: "bold", minWidth: "20px", textAlign: "center", fontSize: "14px" }}>
              {qty}
            </span>
            <button style={styles.qtyBtnSmall} onClick={() => onAdd(item)}>+</button>
          </div>
        ) : (
          <button
            style={{ ...styles.addButton, color: COLORS.orange, borderColor: COLORS.orange }}
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
    paddingTop: "35px",
    minHeight: "600px",
    boxShadow: "0 -10px 20px rgba(0,0,0,0.05)",
  },
  categoryNav: {
    display: "flex",
    justifyContent: "space-around",
    padding: "0 16px",
    marginBottom: "20px",
    gap: "10px",
    position: "sticky",
    top: 0,
    backgroundColor: COLORS.white,
    zIndex: 10,
    paddingTop: "10px",
    paddingBottom: "10px",
  },
  navButton: {
    flex: 1,
    padding: "10px 0",
    borderRadius: "25px",
    border: "none",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textAlign: "center",
  },
  categoryHeading: {
    borderLeft: `5px solid ${COLORS.orange}`,
    paddingLeft: "15px",
    color: COLORS.orange,
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "18px",
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
    border: "1px solid #f2f2f2",
  },
  menuImage: {
    width: "85px",
    height: "85px",
    borderRadius: "15px",
    objectFit: "cover",
    backgroundColor: "#f5f5f5",
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
  optionSection: {
    marginTop: "10px",
  },
  optionLabel: {
    fontSize: "12px",
    color: "#555",
    marginBottom: "8px",
    fontWeight: "600",
  },
  optionRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  optionRadioLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #E5E7EB",
    borderRadius: "9999px",
    padding: "8px 12px",
    fontSize: "12px",
    cursor: "pointer",
    backgroundColor: "#fbfbfb",
  },
  radioInput: {
    cursor: "pointer",
  },
  optionSelect: {
    width: "100%",
    border: "1px solid #E5E7EB",
    borderRadius: "12px",
    padding: "10px",
    outline: "none",
    fontSize: "13px",
    color: "#333",
    backgroundColor: "#fff",
  },
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
    flexDirection: "column",
    gap: "10px",
    borderRadius: "22px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
    zIndex: 100,
    border: "1px solid #eee",
  },
  cartTotal: { fontSize: "18px", color: COLORS.orange, fontWeight: "800" },
  cartNotes: {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #ddd",
    fontSize: "12px",
    resize: "vertical",
    fontFamily: "inherit",
    marginBottom: "8px",
    boxSizing: "border-box",
  },
  label: {
    fontSize: "13px",
    fontWeight: "500",
    color: COLORS.textDark,
    marginBottom: "6px",
    display: "block",
  },
  input: {
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #ddd",
    fontSize: "13px",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
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
  activeOrderNotes: {
    marginBottom: "18px",
    padding: "14px 16px",
    borderRadius: "16px",
    backgroundColor: "#FFFBEB",
    color: "#92400E",
    border: "1px solid #FDE68A",
    fontSize: "14px",
    lineHeight: "1.7",
  },
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
    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
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
  addMoreButtonContainer: {
    marginTop: "20px",
    marginBottom: "20px",
  },
  addMoreButton: {
    width: "100%",
    padding: "14px",
    backgroundColor: "#f5f5f5",
    border: `2px dashed ${COLORS.orange}`,
    borderRadius: "15px",
    color: COLORS.orange,
    fontWeight: "bold",
    fontSize: "16px",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    zIndex: 1000,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "30px",
    width: "90%",
    maxWidth: "500px",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px",
    borderBottom: "1px solid #eee",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: COLORS.textDark,
    margin: 0,
  },
  modalClose: {
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    color: "#999",
  },
  modalBody: {
    flex: 1,
    overflowY: "auto",
    padding: "10px 0",
  },
  modalFooter: {
    padding: "20px",
    borderTop: "1px solid #eee",
    backgroundColor: "#fff",
  },
  modalTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
    fontSize: "16px",
  },
  modalCategoryNav: {
    display: "flex",
    justifyContent: "space-around",
    padding: "0 16px",
    marginBottom: "20px",
    gap: "10px",
    flexWrap: "wrap",
  },
  modalNavButton: {
    flex: 1,
    padding: "8px 0",
    borderRadius: "20px",
    border: "none",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
    backgroundColor: "#f5f5f5",
    color: COLORS.textDark,
    textAlign: "center",
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