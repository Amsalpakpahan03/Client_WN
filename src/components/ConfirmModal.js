// components/ConfirmModal.js
import React, { useState } from "react";
import { X } from "lucide-react";

function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  totalPrice,
  foodTotal,
  drinkTotal,
  items,
  foodItems,
  drinkItems,
  activeOrder 
}) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsUpdating(true);
    try {
      await onConfirm(selectedCategory);
    } finally {
      setIsUpdating(false);
    }
  };

  const getButtonText = () => {
    if (isUpdating) return "Memproses...";
    
    if (activeOrder) {
      switch(selectedCategory) {
        case "food": return "Tambah Makanan";
        case "drink": return "Tambah Minuman";
        default: return "Tambah Semua";
      }
    } else {
      switch(selectedCategory) {
        case "food": return "Pesan Makanan";
        case "drink": return "Pesan Minuman";
        default: return "Pesan Semua";
      }
    }
  };

  const hasFood = foodItems.length > 0;
  const hasDrink = drinkItems.length > 0;

  // Clean white oval styles
  const styles = {
    overlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2000,
      padding: "16px",
      pointerEvents: "none",
    },
    modal: {
      backgroundColor: "white",
      borderRadius: "32px",
      width: "100%",
      maxWidth: "400px",
      maxHeight: "80vh",
      overflow: "hidden",
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05)",
      pointerEvents: "auto",
      animation: "floatUp 0.3s ease",
      border: "1px solid rgba(0, 0, 0, 0.02)",
    },
    header: {
      padding: "24px 24px 16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "white",
    },
    title: {
      margin: 0,
      fontSize: "16px",
      fontWeight: "400",
      color: "#1e293b",
      letterSpacing: "-0.01em",
    },
    closeBtn: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "8px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#94a3b8",
      transition: "all 0.2s",
      backgroundColor: "#f8fafc",
    },
    content: {
      padding: "0 24px 24px",
      overflowY: "auto",
      maxHeight: "calc(80vh - 80px)",
    },
    tableInfo: {
      backgroundColor: "#f8fafc",
      padding: "12px 16px",
      borderRadius: "24px",
      marginBottom: "20px",
      fontSize: "14px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      color: "#475569",
    },
    badge: {
      backgroundColor: "#f1f5f9",
      color: "#475569",
      padding: "4px 12px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "400",
    },
    categorySelector: {
      display: "flex",
      gap: "8px",
      marginBottom: "20px",
    },
    categoryBtn: (active) => ({
      flex: 1,
      padding: "12px 8px",
      borderRadius: "24px",
      border: active ? "1px solid #000" : "1px solid #e2e8f0",
      backgroundColor: active ? "#f8fafc" : "white",
      color: "#1e293b",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "4px",
      transition: "all 0.2s",
      fontSize: "13px",
      fontWeight: active ? "400" : "300",
    }),
    itemsList: {
      marginBottom: "20px",
      maxHeight: "250px",
      overflowY: "auto",
    },
    itemCard: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      backgroundColor: "#f8fafc",
      borderRadius: "24px",
      marginBottom: "6px",
    },
    itemInfo: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    itemCategory: {
      padding: "2px 10px",
      borderRadius: "20px",
      fontSize: "10px",
      fontWeight: "400",
      backgroundColor: "#f1f5f9",
      color: "#475569",
    },
    itemName: {
      fontSize: "14px",
      color: "#1e293b",
      fontWeight: "300",
    },
    itemQuantity: {
      backgroundColor: "#f1f5f9",
      color: "#475569",
      padding: "2px 12px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "400",
    },
    summary: {
      backgroundColor: "#f8fafc",
      padding: "16px",
      borderRadius: "24px",
      marginBottom: "16px",
    },
    summaryRow: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "8px",
      fontSize: "13px",
      color: "#475569",
      fontWeight: "300",
    },
    totalRow: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: "12px",
      paddingTop: "12px",
      borderTop: "1px solid #e2e8f0",
      fontSize: "14px",
      color: "#1e293b",
      fontWeight: "400",
    },
    actions: {
      display: "flex",
      gap: "10px",
    },
    cancelBtn: {
      flex: 1,
      padding: "14px",
      borderRadius: "28px",
      border: "1px solid #e2e8f0",
      backgroundColor: "white",
      color: "#64748b",
      fontWeight: "300",
      cursor: "pointer",
      transition: "all 0.2s",
      fontSize: "14px",
    },
    confirmBtn: {
      flex: 2,
      padding: "14px",
      borderRadius: "28px",
      border: "none",
      backgroundColor: "#1e293b",
      color: "white",
      fontWeight: "300",
      cursor: isUpdating ? "wait" : "pointer",
      opacity: isUpdating ? 0.7 : 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      fontSize: "14px",
      transition: "all 0.2s",
    },
    sectionTitle: {
      fontSize: "11px",
      fontWeight: "300",
      marginBottom: "8px",
      color: "#94a3b8",
      letterSpacing: "0.5px",
    },
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>
            {activeOrder ? "Tambah Pesanan" : "Konfirmasi Pesanan"}
          </h3>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={styles.content}>
          <div style={styles.tableInfo}>
            <span>Meja #{items[0]?.tableNumber || "-"}</span>
            <span style={styles.badge}>
              {new Date().toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div style={styles.categorySelector}>
            {(hasFood || hasDrink) && (
              <button
                style={styles.categoryBtn(selectedCategory === "all")}
                onClick={() => setSelectedCategory("all")}
              >
                <span>Semua</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Rp {totalPrice.toLocaleString()}
                </span>
              </button>
            )}

            {hasFood && (
              <button
                style={styles.categoryBtn(selectedCategory === "food")}
                onClick={() => setSelectedCategory("food")}
              >
                <span>Makanan</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Rp {foodTotal.toLocaleString()}
                </span>
              </button>
            )}

            {hasDrink && (
              <button
                style={styles.categoryBtn(selectedCategory === "drink")}
                onClick={() => setSelectedCategory("drink")}
              >
                <span>Minuman</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Rp {drinkTotal.toLocaleString()}
                </span>
              </button>
            )}
          </div>

          <div style={styles.itemsList}>
            {selectedCategory === "all" ? (
              <>
                {hasFood && (
                  <>
                    <div style={styles.sectionTitle}>MAKANAN</div>
                    {foodItems.map((item, index) => (
                      <div key={index} style={styles.itemCard}>
                        <div style={styles.itemInfo}>
                          <span style={styles.itemCategory}>
                            {item.category}
                          </span>
                          <span style={styles.itemName}>{item.name}</span>
                        </div>
                        <span style={styles.itemQuantity}>{item.quantity}x</span>
                      </div>
                    ))}
                  </>
                )}

                {hasDrink && (
                  <>
                    <div style={{...styles.sectionTitle, marginTop: hasFood ? "16px" : 0}}>
                      MINUMAN
                    </div>
                    {drinkItems.map((item, index) => (
                      <div key={index} style={styles.itemCard}>
                        <div style={styles.itemInfo}>
                          <span style={styles.itemCategory}>
                            {item.category}
                          </span>
                          <span style={styles.itemName}>{item.name}</span>
                        </div>
                        <span style={styles.itemQuantity}>{item.quantity}x</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            ) : (
              (selectedCategory === "food" ? foodItems : drinkItems).map((item, index) => (
                <div key={index} style={styles.itemCard}>
                  <div style={styles.itemInfo}>
                    <span style={styles.itemCategory}>
                      {item.category}
                    </span>
                    <span style={styles.itemName}>{item.name}</span>
                  </div>
                  <span style={styles.itemQuantity}>{item.quantity}x</span>
                </div>
              ))
            )}
          </div>

          <div style={styles.summary}>
            {hasFood && (
              <div style={styles.summaryRow}>
                <span>Makanan</span>
                <span>Rp {foodTotal.toLocaleString()}</span>
              </div>
            )}
            {hasDrink && (
              <div style={styles.summaryRow}>
                <span>Minuman</span>
                <span>Rp {drinkTotal.toLocaleString()}</span>
              </div>
            )}
            <div style={styles.totalRow}>
              <span>Total</span>
              <span>
                Rp {(
                  selectedCategory === "food" ? foodTotal :
                  selectedCategory === "drink" ? drinkTotal :
                  totalPrice
                ).toLocaleString()}
              </span>
            </div>
          </div>

          <div style={styles.actions}>
            <button 
              style={styles.cancelBtn} 
              onClick={onClose} 
              disabled={isUpdating}
            >
              Batal
            </button>
            <button
              style={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <div style={{
                    width: "14px",
                    height: "14px",
                    border: "1.5px solid white",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }} />
                  Memproses...
                </>
              ) : (
                getButtonText()
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ConfirmModal;