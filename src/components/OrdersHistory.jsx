import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { Calendar, Download, Loader, ChevronLeft, ChevronRight } from "lucide-react";

const OrdersHistory = () => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState("day");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
    setTimeout(() => setAlert({ show: false, type: "", message: "" }), 3000);
  };

  useEffect(() => {
    fetchOrdersHistory();
    fetchStats();
  }, [period, customStart, customEnd, page]);

  const fetchOrdersHistory = async () => {
    try {
      setIsLoading(true);
      const params = { period, page, limit: pageSize };
      if (customStart) params.startDate = customStart;
      if (customEnd) params.endDate = customEnd;

      const response = await api.get("/analytics/orders-history", { params });

      if (response.data.success) {
        setOrders(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      showAlert(
        "error",
        `Gagal mengambil riwayat pesanan: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = { period };
      if (customStart) params.startDate = customStart;
      if (customEnd) params.endDate = customEnd;

      const response = await api.get("/analytics/orders-stats", { params });

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const handleCustomDate = () => {
    if (!customStart || !customEnd) {
      showAlert("error", "Silakan isi tanggal mulai dan akhir");
      return;
    }
    if (new Date(customStart) > new Date(customEnd)) {
      showAlert("error", "Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
      return;
    }
    setPage(1);
    fetchOrdersHistory();
    fetchStats();
  };

  const exportToCSV = () => {
    if (orders.length === 0) {
      showAlert("error", "Tidak ada data untuk export");
      return;
    }

    const headers = [
      "No",
      "Meja",
      "Total Pesanan",
      "Total Harga",
      "Status",
      "Waktu",
    ];
    const data = orders.map((order, idx) => [
      idx + 1,
      order.tableNumber,
      order.items.length,
      order.totalPrice,
      order.status,
      new Date(order.createdAt).toLocaleString("id-ID"),
    ]);

    const csv = [
      headers.join(","),
      ...data.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showAlert("success", "Data berhasil di-export ke CSV");
  };

  const periodLabels = {
    day: "Hari Ini",
    week: "7 Hari Terakhir",
    month: "30 Hari Terakhir",
    custom: `${customStart} sampai ${customEnd}`,
  };

  const currentPeriod = customStart && customEnd ? "custom" : period;

  const getStatusBadgeStyle = (status) => {
    const styles = {
      pending: { bg: "#FFFBEB", color: "#B45309" },
      cooking: { bg: "#EFF6FF", color: "#1E40AF" },
      served: { bg: "#ECFDF5", color: "#065F46" },
      paid: { bg: "#F1F5F9", color: "#475569" },
    };

    const style = styles[status] || { bg: "#F3F4F6", color: "#6B7280" };
    return {
      backgroundColor: style.bg,
      color: style.color,
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "12px",
      fontWeight: "500",
      display: "inline-block",
    };
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "🔔 BARU",
      cooking: "👨‍🍳 MASAK",
      served: "✅ DIANTAR",
      paid: "💰 SELESAI",
    };
    return labels[status] || status.toUpperCase();
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
          <Calendar size={24} />
          <h1 style={styles.title}>Riwayat Pesanan</h1>
        </div>
        <button onClick={exportToCSV} style={styles.exportBtn}>
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && stats.overall && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Total Pesanan</p>
            <p style={styles.statValue}>{stats.overall.totalOrders}</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Total Pendapatan</p>
            <p style={styles.statValue}>
              Rp {stats.overall.totalRevenue.toLocaleString("id-ID")}
            </p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Rata-rata Per Pesanan</p>
            <p style={styles.statValue}>
              Rp {stats.overall.avgOrderValue.toLocaleString("id-ID")}
            </p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statLabel}>Total Item</p>
            <p style={styles.statValue}>{stats.overall.totalItems}</p>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {stats && stats.categoryBreakdown && stats.categoryBreakdown.length > 0 && (
        <div style={styles.categorySection}>
          <h3 style={styles.sectionSubtitle}>Penjualan per Kategori</h3>
          <div style={styles.categoryGrid}>
            {stats.categoryBreakdown.map((cat, idx) => (
              <div key={idx} style={styles.categoryCard}>
                <div style={styles.categoryName}>{cat.category}</div>
                <div style={styles.categoryStats}>
                  <div>
                    <span style={styles.statLabel}>Qty:</span>
                    <span style={styles.statBoldValue}>{cat.quantity}x</span>
                  </div>
                  <div>
                    <span style={styles.statLabel}>Revenue:</span>
                    <span style={styles.statBoldValue}>
                      Rp {cat.revenue.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filterSection}>
        <div style={styles.filterGroup}>
          <label style={styles.label}>Periode Predefined:</label>
          <select
            value={customStart || customEnd ? "custom" : period}
            onChange={(e) => {
              if (e.target.value !== "custom") {
                setPeriod(e.target.value);
                setCustomStart("");
                setCustomEnd("");
                setPage(1);
              }
            }}
            style={styles.select}
          >
            <option value="day">Hari Ini</option>
            <option value="week">7 Hari Terakhir</option>
            <option value="month">30 Hari Terakhir</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Tanggal Mulai:</label>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label}>Tanggal Akhir:</label>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            style={styles.input}
          />
        </div>

        <button onClick={handleCustomDate} style={styles.filterBtn}>
          Terapkan
        </button>
      </div>

      {/* Orders List */}
      <div style={styles.ordersSection}>
        <h2 style={styles.sectionTitle}>
          Daftar Pesanan - {periodLabels[currentPeriod]}
        </h2>

        {isLoading ? (
          <div style={styles.loadingContainer}>
            <Loader className="animate-spin" size={40} />
            <p>Memuat data...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={styles.emptyState}>
            <p>Belum ada pesanan untuk periode ini</p>
          </div>
        ) : (
          <>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead style={styles.tableHead}>
                  <tr>
                    <th style={styles.th}>No</th>
                    <th style={styles.th}>Meja</th>
                    <th style={styles.th}>Waktu</th>
                    <th style={styles.th}>Items</th>
                    <th style={styles.th}>Total Harga</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, idx) => (
                    <tr
                      key={order._id}
                      style={{
                        ...styles.tr,
                        ...(idx % 2 === 0 ? { backgroundColor: "#F9FAFB" } : {}),
                      }}
                    >
                      <td style={styles.td}>
                        {(pagination.currentPage - 1) * pagination.pageSize + idx + 1}
                      </td>
                      <td style={{ ...styles.td, fontWeight: "bold" }}>
                        {order.tableNumber}
                      </td>
                      <td style={styles.td}>
                        {new Date(order.createdAt).toLocaleString("id-ID", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td style={styles.td}>{order.items.length} item</td>
                      <td style={{ ...styles.td, fontWeight: "bold" }}>
                        Rp {order.totalPrice.toLocaleString("id-ID")}
                      </td>
                      <td style={styles.td}>
                        <span style={getStatusBadgeStyle(order.status)}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && (
              <div style={styles.paginationContainer}>
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  style={{
                    ...styles.paginationBtn,
                    ...(page === 1 ? { opacity: 0.5, cursor: "not-allowed" } : {}),
                  }}
                >
                  <ChevronLeft size={18} /> Sebelumnya
                </button>

                <div style={styles.pageInfo}>
                  Halaman {pagination.currentPage} dari {pagination.totalPages} (
                  {pagination.totalCount} pesanan)
                </div>

                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  style={{
                    ...styles.paginationBtn,
                    ...(page === pagination.totalPages
                      ? { opacity: 0.5, cursor: "not-allowed" }
                      : {}),
                  }}
                >
                  Selanjutnya <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
    maxWidth: "1400px",
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
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "15px",
    marginBottom: "30px",
  },
  statCard: {
    backgroundColor: "#F9FAFB",
    padding: "20px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
  },
  statLabel: {
    fontSize: "12px",
    color: "#6B7280",
    fontWeight: "500",
    margin: "0 0 8px 0",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#1F2937",
    margin: 0,
  },
  statBoldValue: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#1F2937",
    marginLeft: "8px",
  },
  categorySection: {
    marginBottom: "30px",
  },
  sectionSubtitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#374151",
    margin: "0 0 15px 0",
  },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "15px",
  },
  categoryCard: {
    backgroundColor: "#F9FAFB",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
  },
  categoryName: {
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: "10px",
    fontSize: "14px",
  },
  categoryStats: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "12px",
  },
  filterSection: {
    display: "flex",
    gap: "15px",
    marginBottom: "30px",
    flexWrap: "wrap",
    alignItems: "flex-end",
    backgroundColor: "#F9FAFB",
    padding: "20px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
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
  input: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #D1D5DB",
    backgroundColor: "white",
    fontSize: "14px",
  },
  filterBtn: {
    padding: "8px 16px",
    backgroundColor: "#3B82F6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  ordersSection: {
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
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHead: {
    backgroundColor: "#F3F4F6",
  },
  th: {
    padding: "12px 16px",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
    borderBottom: "2px solid #E5E7EB",
  },
  tr: {
    borderBottom: "1px solid #E5E7EB",
  },
  td: {
    padding: "12px 16px",
    fontSize: "14px",
    color: "#1F2937",
  },
  paginationContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "20px",
    padding: "20px",
    borderTop: "1px solid #E5E7EB",
  },
  paginationBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    backgroundColor: "#3B82F6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },
  pageInfo: {
    fontSize: "14px",
    color: "#6B7280",
  },
};

export default OrdersHistory;
