import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { TrendingUp, Calendar, Download, Loader } from "lucide-react";

const BestSellingMenu = () => {
  const [bestSelling, setBestSelling] = useState([]);
  const [salesSummary, setSalesSummary] = useState(null);
  const [period, setPeriod] = useState("day");
  const [limit, setLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: "", message: "" }), 3000);
  };

  useEffect(() => {
    fetchBestSelling();
    fetchSalesSummary();
  }, [period, limit]);

  const fetchBestSelling = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/analytics/best-selling", {
        params: { period, limit },
      });

      if (response.data.success) {
        setBestSelling(response.data.data);
      }
    } catch (err) {
      showAlert(
        "error",
        `Gagal mengambil menu terlaris: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSalesSummary = async () => {
    try {
      const response = await api.get("/analytics/sales-summary", { params: { period } });
      if (response.data.success) {
        setSalesSummary(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching sales summary:", err);
    }
  };

  const exportToCSV = () => {
    if (bestSelling.length === 0) {
      showAlert("error", "Tidak ada data untuk export");
      return;
    }

    const headers = ["No", "Nama Menu", "Kategori", "Quantity Terjual", "Total Pendapatan"];
    const data = bestSelling.map((item, idx) => [
      idx + 1,
      item.name,
      item.category,
      item.totalQuantity,
      item.totalRevenue,
    ]);

    const csv = [
      headers.join(","),
      ...data.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `best-selling-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showAlert("success", "Data berhasil di-export ke CSV");
  };

  const periodLabels = {
    day: "Hari Ini",
    week: "7 Hari Terakhir",
    month: "30 Hari Terakhir",
  };

  return (
    <div style={styles.container}>
      {/* Alert */}
      {alert.show && (
        <div
          style={{
            ...styles.alert,
            ...(alert.type === "error" ? styles.alertError : styles.alertSuccess),
          }}
        >
          {alert.message}
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <TrendingUp size={24} />
          <h1 style={styles.title}>Menu Terlaris</h1>
        </div>
        <button onClick={exportToCSV} style={styles.exportBtn}>
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Sales Summary Cards */}
      {salesSummary && (
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <p style={styles.summaryLabel}>Total Pesanan</p>
            <p style={styles.summaryValue}>{salesSummary.totalOrders}</p>
          </div>
          <div style={styles.summaryCard}>
            <p style={styles.summaryLabel}>Total Pendapatan</p>
            <p style={styles.summaryValue}>
              Rp {salesSummary.totalRevenue.toLocaleString("id-ID")}
            </p>
          </div>
          <div style={styles.summaryCard}>
            <p style={styles.summaryLabel}>Rata-rata Per Pesanan</p>
            <p style={styles.summaryValue}>
              Rp {salesSummary.avgOrderValue.toLocaleString("id-ID")}
            </p>
          </div>
          <div style={styles.summaryCard}>
            <p style={styles.summaryLabel}>Total Item</p>
            <p style={styles.summaryValue}>{salesSummary.totalItems}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filterSection}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Periode:</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={styles.select}
          >
            <option value="day">Hari Ini</option>
            <option value="week">7 Hari Terakhir</option>
            <option value="month">30 Hari Terakhir</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Tampilkan Top:</label>
          <select
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            style={styles.select}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
        </div>
      </div>

      {/* Best Selling List */}
      <div style={styles.listSection}>
        <h2 style={styles.sectionTitle}>
          Top {limit} Menu Terlaris - {periodLabels[period]}
        </h2>

        {isLoading ? (
          <div style={styles.loadingContainer}>
            <Loader className="animate-spin" size={40} />
            <p>Memuat data...</p>
          </div>
        ) : bestSelling.length === 0 ? (
          <div style={styles.emptyState}>
            <p>Belum ada data penjualan untuk periode ini</p>
          </div>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={{ ...styles.tableCell, flex: 0.5 }}>No</div>
              <div style={{ ...styles.tableCell, flex: 2 }}>Nama Menu</div>
              <div style={{ ...styles.tableCell, flex: 1 }}>Kategori</div>
              <div style={{ ...styles.tableCell, flex: 1 }}>Quantity</div>
              <div style={{ ...styles.tableCell, flex: 1.5 }}>Total Pendapatan</div>
            </div>

            {bestSelling.map((item, idx) => (
              <div key={idx} style={styles.tableRow}>
                <div style={{ ...styles.tableCell, flex: 0.5, fontWeight: "bold" }}>
                  {idx + 1}
                </div>
                <div style={{ ...styles.tableCell, flex: 2 }}>{item.name}</div>
                <div style={{ ...styles.tableCell, flex: 1 }}>
                  <span style={getCategoryBadgeStyle(item.category)}>
                    {item.category}
                  </span>
                </div>
                <div style={{ ...styles.tableCell, flex: 1, fontWeight: "bold" }}>
                  {item.totalQuantity}x
                </div>
                <div style={{ ...styles.tableCell, flex: 1.5 }}>
                  Rp {item.totalRevenue.toLocaleString("id-ID")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
    flexWrap: "wrap",
    gap: "15px",
  },
  titleSection: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#1F2937",
    margin: 0,
  },
  exportBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    backgroundColor: "#10B981",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "background-color 0.2s",
  },
  alert: {
    padding: "12px 16px",
    borderRadius: "8px",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  alertSuccess: {
    backgroundColor: "#ECFDF5",
    color: "#065F46",
    border: "1px solid #A7F3D0",
  },
  alertError: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
    border: "1px solid #FECACA",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "15px",
    marginBottom: "30px",
  },
  summaryCard: {
    backgroundColor: "#F9FAFB",
    padding: "20px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
  },
  summaryLabel: {
    fontSize: "12px",
    color: "#6B7280",
    fontWeight: "500",
    margin: "0 0 8px 0",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#1F2937",
    margin: 0,
  },
  filterSection: {
    display: "flex",
    gap: "20px",
    marginBottom: "30px",
    flexWrap: "wrap",
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  label: {
    fontWeight: "500",
    color: "#374151",
    fontSize: "14px",
  },
  select: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #D1D5DB",
    backgroundColor: "white",
    fontSize: "14px",
    cursor: "pointer",
  },
  listSection: {
    backgroundColor: "white",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#1F2937",
    padding: "20px",
    margin: 0,
    borderBottom: "1px solid #E5E7EB",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 20px",
    color: "#6B7280",
  },
  emptyState: {
    padding: "60px 20px",
    textAlign: "center",
    color: "#6B7280",
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "0.5fr 2fr 1fr 1fr 1.5fr",
    backgroundColor: "#F3F4F6",
    borderBottom: "2px solid #E5E7EB",
    fontWeight: "bold",
    color: "#374151",
    fontSize: "13px",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "0.5fr 2fr 1fr 1fr 1.5fr",
    borderBottom: "1px solid #E5E7EB",
    alignItems: "center",
    "&:hover": {
      backgroundColor: "#F9FAFB",
    },
  },
  tableCell: {
    padding: "16px",
    fontSize: "14px",
    color: "#1F2937",
  },
};

const getCategoryBadgeStyle = (category) => {
  const colors = {
    Makanan: { bg: "#FEF3C7", color: "#D97706" },
    Minuman: { bg: "#DBEAFE", color: "#2563EB" },
    Cemilan: { bg: "#FCE7F3", color: "#DB2777" },
    Paket: { bg: "#D1FAE5", color: "#059669" },
  };

  const categoryColor = colors[category] || { bg: "#F3F4F6", color: "#6B7280" };

  return {
    backgroundColor: categoryColor.bg,
    color: categoryColor.color,
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "500",
  };
};

export default BestSellingMenu;
