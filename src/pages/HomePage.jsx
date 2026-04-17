// pages/HomePage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

function HomePage() {
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch menu
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await axios.get(`${API_BASE}/menu`);
        const data = res.data.data || res.data;
        setMenuItems(data);
      } catch (err) {
        console.error("Gagal fetch menu:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenu();
  }, []);

  // Categories
  const categories = ["all", "Paket", "Makanan", "Minuman", "Cemilan"];
  
  const filteredItems = selectedCategory === "all" 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  // Handle order button
  const handleOrder = () => {
    navigate("/order-menu?table=1");
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Warung Ndeso</h1>
      </div>

      {/* Category Filter */}
      <div style={styles.categoryFilter}>
        {categories.map(cat => (
          <button
            key={cat}
            style={{
              ...styles.categoryBtn,
              ...(selectedCategory === cat ? styles.categoryBtnActive : {})
            }}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat === "all" ? "Semua" : cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      {isLoading ? (
        <div style={styles.loading}>Memuat menu...</div>
      ) : filteredItems.length === 0 ? (
        <div style={styles.empty}>Tidak ada menu</div>
      ) : (
        <div style={styles.menuGrid}>
          {filteredItems.map(item => (
            <div key={item._id} style={styles.menuCard}>
              <img 
                src={item.image_url?.startsWith("http") ? item.image_url : `/uploads/${item.image_url || "no-image.png"}`}
                alt={item.name}
                style={styles.menuImage}
                onError={(e) => { e.target.src = "/no-image.png" }}
              />
              <div style={styles.menuInfo}>
                <div style={styles.menuName}>{item.name}</div>
                <div style={styles.menuPrice}>Rp {item.price?.toLocaleString()}</div>
                {item.description && (
                  <div style={styles.menuDesc}>{item.description}</div>
                )}
                {item.category === "Paket" && item.packageItems && (
                  <div style={styles.packageBadge}>📦 Paket</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer style={styles.footer}>
        <p>Warung Ndeso - Pesan mudah, makan enak</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "#f8f9fa",
    minHeight: "100vh",
  },
  
  // Header
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
    paddingBottom: "20px",
    borderBottom: "1px solid #e0e0e0",
  },
  title: {
    fontSize: "28px",
    margin: 0,
    color: "#c0392b",
  },
  orderBtn: {
    backgroundColor: "#c0392b",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  
  // Category Filter
  categoryFilter: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginBottom: "30px",
    flexWrap: "wrap",
  },
  categoryBtn: {
    padding: "8px 20px",
    border: "1px solid #ddd",
    backgroundColor: "white",
    borderRadius: "25px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.3s",
  },
  categoryBtnActive: {
    backgroundColor: "#c0392b",
    color: "white",
    borderColor: "#c0392b",
  },
  
  // Menu Grid
  menuGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
  },
  menuCard: {
    display: "flex",
    gap: "15px",
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "15px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    transition: "transform 0.2s, box-shadow 0.2s",
    cursor: "pointer",
  },
  menuImage: {
    width: "80px",
    height: "80px",
    borderRadius: "8px",
    objectFit: "cover",
  },
  menuInfo: {
    flex: 1,
  },
  menuName: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#333",
    marginBottom: "5px",
  },
  menuPrice: {
    fontSize: "14px",
    color: "#c0392b",
    fontWeight: "bold",
    marginBottom: "5px",
  },
  menuDesc: {
    fontSize: "12px",
    color: "#666",
    marginBottom: "5px",
  },
  packageBadge: {
    display: "inline-block",
    backgroundColor: "#f39c12",
    color: "white",
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "12px",
    marginTop: "5px",
  },
  
  // States
  loading: {
    textAlign: "center",
    padding: "60px",
    color: "#666",
  },
  empty: {
    textAlign: "center",
    padding: "60px",
    color: "#999",
  },
  
  // Footer
  footer: {
    marginTop: "40px",
    paddingTop: "20px",
    textAlign: "center",
    borderTop: "1px solid #e0e0e0",
    color: "#999",
    fontSize: "12px",
  },
};

export default HomePage;