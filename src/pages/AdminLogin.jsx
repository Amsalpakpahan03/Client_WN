// pages/AdminLogin.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Credentials statis
  const ADMIN_CREDENTIALS = {
    username: "admin",
    password: "admin123"
  };

  // Cek session di tab ini
  useEffect(() => {
    const isAuth = sessionStorage.getItem("admin_auth") === "true";
    if (isAuth) {
      navigate("/admin");
    }
  }, [navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    setTimeout(() => {
      if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        // Gunakan sessionStorage
        sessionStorage.setItem("admin_auth", "true");
        sessionStorage.setItem("admin_username", username);
        sessionStorage.setItem("admin_login_time", Date.now().toString());
        
        navigate("/admin");
      } else {
        setError("Username atau password salah!");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Admin</h1>
          <p style={styles.subtitle}>Manajemen Sistem Warung Ndeso</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <div style={styles.inputWrapper}>
              <input
                type="text"
                style={styles.input}
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <input
                type="password"
                style={styles.input}
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div style={styles.errorAlert}>
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            style={styles.button}
            disabled={loading}
          >
            {loading ? "Memproses..." : "Login"}
          </button>

          <div style={styles.infoBox}>
            <p style={styles.infoText}>
              <strong>Info Demo:</strong><br />
              Username: admin<br />
              Password: admin123
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3ca58", // WARNA KUNING SEPERTI YELLOW HEADER
    padding: "20px",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "20px",
    padding: "40px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    animation: "fadeInUp 0.5s ease",
  },
  header: {
    textAlign: "center",
    marginBottom: "30px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#c0392b",
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#666",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#333",
  },
  inputWrapper: {
    position: "relative",
  },
  input: {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid #ddd",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    transition: "all 0.3s",
    boxSizing: "border-box",
  },
  button: {
    backgroundColor: "#c0392b",
    color: "white",
    border: "none",
    padding: "14px",
    borderRadius: "10px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s",
    marginTop: "10px",
  },
  errorAlert: {
    backgroundColor: "#fee",
    color: "#c0392b",
    padding: "10px",
    borderRadius: "8px",
    fontSize: "13px",
    textAlign: "center",
  },
  infoBox: {
    backgroundColor: "#f8f9fa",
    padding: "12px",
    borderRadius: "8px",
    textAlign: "center",
    fontSize: "12px",
    color: "#666",
  },
  infoText: {
    margin: 0,
    lineHeight: "1.5",
  },
};

// Add animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  input:focus {
    border-color: #c0392b;
    box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.1);
  }
  
  button:hover {
    background-color: #a82315;
    transform: translateY(-2px);
  }
  
  button:active {
    transform: translateY(0);
  }
`;
document.head.appendChild(styleSheet);

export default AdminLogin;