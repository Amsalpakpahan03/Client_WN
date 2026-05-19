import React, { useEffect } from "react";

const ReceiptModal = ({ order, onClose, autoPrint = true }) => {
  const orderItems = order?.items || [];
  const orderTableNumber = order?.tableNumber ?? "-";

  const formatDate = (timestamp) => {
    const date = new Date(timestamp || Date.now());
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("id-ID").format(Number(value) || 0);

  const subtotal = orderItems.reduce(
    (sum, item) =>
      sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0,
  );
  const tax = 0;
  const total = Number(order?.totalPrice ?? subtotal);
  const orderCode = order?._id ? `#${order._id.slice(-6).toUpperCase()}` : "";

  const buildPrintHtml = () => {
    const itemRows = orderItems
      .map((item) => {
        const unitPrice = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const lineTotal = unitPrice * quantity;
        return `
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <div style="flex:1; white-space:pre-wrap; word-break:break-word;">${item.name}</div>
            <div style="width:45px; text-align:right;">${quantity}</div>
            <div style="width:90px; text-align:right;">Rp ${formatCurrency(lineTotal)}</div>
          </div>
        `;
      })
      .join("");

    return `<!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>Nota Warung Ndeso</title>
          <style>
            body { font-family: monospace; margin: 0; padding: 20px; color: #111; }
            .receipt { width: 320px; max-width: 100%; }
            .divider { border-top: 1px dashed #333; margin: 8px 0; }
            .center { text-align: center; }
            .small { font-size: 12px; }
            .line { display:flex; justify-content:space-between; margin:4px 0; }
            .line span:last-child { text-align: right; }
            .total-line { font-weight: bold; margin-top: 8px; }
            .footer { margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <div style="font-size:16px; font-weight:bold;">WARUNG NDESO</div>
              <div style="margin-top:4px;">Alamat Warung</div>
              <div style="margin-top:2px;">Telp: 0812-3456-7890</div>
            </div>
            <div class="divider"></div>
            <div class="small">Tanggal: ${formatDate(order?.createdAt)}</div>
            <div class="small">Meja: ${orderTableNumber}</div>
            <div class="small">Order ID: ${orderCode}</div>
            <div class="divider"></div>
            <div class="line" style="font-weight:bold;">
              <span style="flex:1;">Item</span>
              <span style="width:45px; text-align:right;">Qty</span>
              <span style="width:90px; text-align:right;">Harga</span>
            </div>
            <div class="divider"></div>
            ${itemRows}
            <div class="divider"></div>
            <div class="line small">
              <span>Subtotal:</span>
              <span>Rp ${formatCurrency(subtotal)}</span>
            </div>
            <div class="line small">
              <span>Pajak:</span>
              <span>Rp ${formatCurrency(tax)}</span>
            </div>
            <div class="line total-line">
              <span>TOTAL:</span>
              <span>Rp ${formatCurrency(total)}</span>
            </div>
            <div class="divider"></div>
            <div class="footer center small">
              Terima kasih!<br />Silakan datang kembali
            </div>
            <div class="divider"></div>
          </div>
        </body>
      </html>`;
  };

  useEffect(() => {
    if (!autoPrint) return;

    const printWindow = window.open("", "_blank", "width=420,height=620");
    if (!printWindow) return;

    printWindow.document.write(buildPrintHtml());
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [order, autoPrint, buildPrintHtml]);

  if (!order) return null;

  const handleReprint = () => {
    const printWindow = window.open("", "_blank", "width=420,height=620");
    if (!printWindow) return;
    printWindow.document.write(buildPrintHtml());
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Preview Nota</h2>
          <button onClick={onClose} style={styles.closeButton}>Tutup</button>
        </div>

        <div style={styles.previewBox}>
          <div style={styles.previewHeader}>WARUNG NDESO</div>
          <div style={styles.previewText}>Alamat Warung</div>
          <div style={styles.previewText}>Telp: 0812-3456-7890</div>
          <div style={styles.previewDivider} />
          <div style={styles.previewLine}>
            <span>Tanggal:</span>
            <span>{formatDate(order?.createdAt)}</span>
          </div>
          <div style={styles.previewLine}>
            <span>Meja:</span>
            <span>{orderTableNumber}</span>
          </div>
          <div style={styles.previewLine}>
            <span>Order ID:</span>
            <span>{orderCode}</span>
          </div>
          <div style={styles.previewDivider} />
          <div style={styles.previewLineHeader}>
            <span style={{ flex: 1 }}>Item</span>
            <span style={{ width: 40, textAlign: "right" }}>Qty</span>
            <span style={{ width: 90, textAlign: "right" }}>Harga</span>
          </div>
          <div style={styles.previewDivider} />
          {orderItems.map((item, idx) => {
            const quantity = Number(item.quantity) || 0;
            const lineTotal = (Number(item.price) || 0) * quantity;
            return (
              <div key={`${item.name}-${idx}`}>
                <div style={styles.previewLine}>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <span style={{ width: 40, textAlign: "right" }}>{quantity}</span>
                  <span style={{ width: 90, textAlign: "right" }}>
                    Rp {formatCurrency(lineTotal)}
                  </span>
                </div>
              </div>
            );
          })}
          <div style={styles.previewDivider} />
          <div style={styles.previewLine}>
            <span>Subtotal:</span>
            <span>Rp {formatCurrency(subtotal)}</span>
          </div>
          <div style={styles.previewLine}>
            <span>Pajak:</span>
            <span>Rp {formatCurrency(tax)}</span>
          </div>
          <div style={{ ...styles.previewLine, fontWeight: 700, marginTop: 6 }}>
            <span>TOTAL:</span>
            <span>Rp {formatCurrency(total)}</span>
          </div>
          <div style={styles.previewDivider} />
          <div style={styles.previewFooter}>Terima kasih! Silakan datang kembali</div>
        </div>

        <div style={styles.modalFooter}>
          <button style={styles.printBtn} onClick={handleReprint}>
            Cetak Ulang
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    zIndex: 1200,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    width: 380,
    maxWidth: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    boxShadow: "0 18px 45px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e5e7eb",
    padding: "16px 18px",
  },
  modalTitle: {
    fontSize: 18,
    margin: 0,
  },
  closeButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 14,
    color: "#374151",
  },
  previewBox: {
    padding: "16px 18px",
    fontFamily: "monospace, monospace",
    fontSize: 13,
    color: "#111827",
    lineHeight: 1.4,
  },
  previewHeader: {
    textAlign: "center",
    fontWeight: 700,
    marginBottom: 6,
  },
  previewText: {
    textAlign: "center",
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 2,
  },
  previewDivider: {
    height: 1,
    backgroundColor: "#d1d5db",
    margin: "10px 0",
  },
  previewLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  previewLineHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontWeight: 700,
    marginBottom: 4,
  },
  previewFooter: {
    textAlign: "center",
    marginTop: 10,
    fontSize: 12,
    color: "#4b5563",
  },
  modalFooter: {
    borderTop: "1px solid #e5e7eb",
    padding: "14px 18px",
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
  },
  printBtn: {
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 600,
  },
};

export default ReceiptModal;
