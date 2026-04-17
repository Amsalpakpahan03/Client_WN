# 🔍 Debugging Checklist - Socket.IO & Realtime Sync

## ✅ Setup Files (SUDAH DIBUAT)
- [x] `.env` file di root `/client` folder dengan variabel yang benar
- [x] `socket.js` dengan logging lengkap
- [x] `axios.js` dengan interceptor dan logging
- [x] `OrderMenu.jsx` menghapus hardcoded production URL
- [x] `useOrder.js` dengan error handling lengkap
- [x] `order.api.js` dengan dokumentasi

## 🚀 Step-by-Step Testing

### 1️⃣ Verifikasi Environment Variables
```bash
# Pastikan file .env ada di:
client/.env

# Isi seharusnya:
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_ENV=development
```

### 2️⃣ Start Backend (Jika belum jalan)
```bash
cd server
npm run dev
# atau
node index.js

# Backend harusnya berjalan di: http://localhost:5000
```

### 3️⃣ Start Frontend (Jika belum jalan)
```bash
cd client
npm start

# Frontend harusnya berjalan di: http://localhost:3000
```

### 4️⃣ Buka Browser Console & Check Koneksi
Buka `http://localhost:3000` lalu buka DevTools (F12) → Console

**Cari log berikut (berwarna hijau ✓):**
```
[SOCKET] Initializing...
[SOCKET] URL: http://localhost:5000
[SOCKET] Environment: development
✓ Socket Connected [socket-id-abcd...]

[AXIOS] Initializing...
[AXIOS] URL: http://localhost:5000/api
[AXIOS] Request GET http://localhost:5000/api/menu
[AXIOS] Response 200 http://localhost:5000/api/menu
```

**Jika melihat:**
```
[SOCKET] URL: https://d4aa1b22-... ← MASALAH!
```
→ Berarti `.env` file belum dibaca. Coba:
   1. Restart development server
   2. Clear browser cache (Ctrl+Shift+Delete)
   3. Hard refresh (Ctrl+F5)

### 5️⃣ Test Flow: Admin Klik "Antar Minuman"

**Admin Side (Kitchen.jsx):**
1. Klik tombol "Antar Minuman" untuk order tertentu
2. Harusnya kirim socket event ke Admin page
3. Cek console: `socket.emit("updateCategoryStatus", ...)`

**Client Side (OrderMenu.jsx):**
1. Terima socket event `orderStatusUpdated`
2. Status minuman berubah ke "delivered"/"ready"
3. Cek console: `[ORDER] Socket Update: {...}`

### 6️⃣ Test Pembayaran

**Client Side:**
1. Klik "Bayar Sekarang"
2. Cek console: 
   ```
   [PAYMENT] Processing... [order-id]
   [AXIOS] Request PUT http://localhost:5000/api/orders/[id]/status
   [PAYMENT] Payment Success
   ```

**Admin Side:**
1. Harusnya order hilang dari list (sudah dibayar)
2. Meja dirilis untuk client lain

## 🐛 Common Issues & Solutions

### Issue 1: Socket URL masih menunjuk ke production
**Gejala:** Console log menunjuk https://d4aa1b22-...
**Solusi:**
```bash
# 1. Pastikan .env file ada
cat client/.env

# 2. Hapus node_modules dan reinstall
cd client
rm -rf node_modules
npm install

# 3. Restart development server
npm start
```

### Issue 2: CORS Error pada API calls
**Gejala:** Cross-Origin Request Blocked error
**Solusi:** Pastikan backend `index.js` punya CORS config:
```javascript
// backend/index.js
const cors = require('cors');
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
```

### Issue 3: Socket tidak connect
**Gejala:** Console log `connect_error`
**Solusi:**
1. Pastikan backend berjalan di port 5000
2. Pastikan Socket.IO enabled di backend
3. Cek Network tab (DevTools) → WS connection ke localhost:5000

### Issue 4: Pembayaran tidak work
**Gejala:** "Gagal memproses pembayaran"
**Solusi:**
1. Cek console log untuk error detail
2. Pastikan backend endpoint PUT /orders/:id/status ada
3. Pastikan token valid di localStorage

## 📊 Expected Console Output

### Normal Flow:
```
[SOCKET] Initializing...
[SOCKET] URL: http://localhost:5000
✓ Socket Connected: abc123xyz
[AXIOS] Initializing...
[AXIOS] URL: http://localhost:5000/api
[AXIOS] Request GET .../menu
[AXIOS] Response 200 .../menu
[ORDER] Restoring... orderId123
[ORDER] Restored: orderId123
[ORDER] Socket Update: {_id: '...', status: 'processing', ...}
```

### Payment Flow:
```
[PAYMENT] Processing... orderId123
[AXIOS] Request PUT .../orders/orderId123/status
[AXIOS] Response 200 .../orders/orderId123/status
[PAYMENT] Payment Success
```

## ✨ Tips Debugging

1. **Gunakan DevTools Tabs:**
   - Console: Lihat logs
   - Network: Lihat HTTP requests dan WebSocket connection
   - Application → Local Storage: Cek token dan order ID

2. **Format Log Styling:**
   - 🟢 = Success (hijau)
   - 🔴 = Error (merah)
   - 🟡 = Warning (kuning)
   - 🔵 = Info (biru)

3. **Clear Everything Jika Stuck:**
   ```bash
   # 1. Clear browser cache
   Ctrl+Shift+Delete → Clear All
   
   # 2. Clear localStorage
   # Di console: localStorage.clear()
   
   # 3. Restart servers (both frontend & backend)
   ```

## 📧 Questions atau Issues?

Jika masih ada masalah:
1. Share screenshot dari console log
2. Share error message lengkap
3. Pastikan sudah follow semua steps di atas
