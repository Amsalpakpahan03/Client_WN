// src/components/FrequentlyBought.jsx
import React, { useState, useEffect, useRef } from "react";
import api from "../api/axios";

const FrequentlyBought = ({ onAddToCart, menuItems = [] }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef(null);
  const ASSET_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  useEffect(() => {
    fetchFrequentlyBought();
  }, []);

  const fetchFrequentlyBought = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/analytics/best-selling", {
        params: { period: "week", limit: 10 },
      });

      if (response.data.success) {
        const itemsWithImages = response.data.data.map(item => {
          const menuItem = menuItems.find(m => m.name === item.name);
          return {
            ...item,
            image_url: menuItem?.image_url || null,
            _id: menuItem?._id || item._id,
          };
        });
        setItems(itemsWithImages);
      }
    } catch (err) {
      console.error("Error fetching frequently bought:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (item) => {
    if (onAddToCart) {
      onAddToCart({
        _id: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        category: item.category,
        image_url: item.image_url,
      });
    }
  };

  const getImageUrl = (imageUrl) => {
    const timestamp = new Date().getTime();
    if (!imageUrl) {
      return `${ASSET_URL}/uploads/no-image.png?t=${timestamp}`;
    }
    if (imageUrl.startsWith("http")) {
      const baseUrl = imageUrl.split("?")[0];
      return `${baseUrl}?t=${timestamp}`;
    }
    return `${ASSET_URL}/uploads/${imageUrl}?t=${timestamp}`;
  };

  if (loading) {
    return <div style={styles.loading}>Memuat...</div>;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span style={styles.pipe}>|</span> Sering dipesan
        </h3>
      </div>

      <div 
        ref={scrollContainerRef} 
        style={styles.scrollContainer}
        className="hide-scrollbar"
      >
        {items.map((item, idx) => (
          <div 
            key={idx} 
            style={styles.card}
            onClick={() => handleCardClick(item)}
          >
            <img
              src={getImageUrl(item.image_url)}
              alt={item.name}
              style={styles.image}
              onError={(e) => {
                e.target.src = `${ASSET_URL}/uploads/no-image.png?t=${Date.now()}`;
              }}
            />
            <div style={styles.name}>{item.name}</div>
            <div style={styles.price}>Rp {item.price.toLocaleString("id-ID")}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  wrapper: {
    marginBottom: "20px",
    padding: "0 16px",
  },
  header: {
    marginBottom: "12px",
    paddingLeft: "4px",
  },
  title: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#E65527",
    margin: 0,
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
  },
  pipe: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#E65527",
    marginRight: "8px",
  },
  scrollContainer: {
    display: "flex",
    overflowX: "auto",
    overflowY: "hidden",
    scrollBehavior: "smooth",
    gap: "12px",
    WebkitOverflowScrolling: "touch",
    msOverflowStyle: "none",
    scrollbarWidth: "none",
  },
  card: {
    flexShrink: 0,
    width: "140px",
    backgroundColor: "#f3ca58",
    borderRadius: "12px",
    overflow: "hidden",
    cursor: "pointer",
  },
  image: {
    width: "100%",
    height: "140px",
    objectFit: "cover",
    display: "block",
  },
  name: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#333",
    padding: "8px 8px 4px 8px",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontFamily: "inherit",
  },
  price: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "#E65527",
    padding: "0 8px 8px 8px",
    textAlign: "center",
    fontFamily: "inherit",
  },
  loading: {
    padding: "20px",
    textAlign: "center",
    color: "#999",
    fontSize: "13px",
  },
};

// Tambahkan style global untuk hide scrollbar
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
`;
if (!document.head.querySelector("#freq-scroll-style")) {
  styleSheet.id = "freq-scroll-style";
  document.head.appendChild(styleSheet);
}

export default FrequentlyBought;