// components/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Cek authentication di sini, tidak di render
    const checkAuth = () => {
      const auth = sessionStorage.getItem("admin_auth") === "true";
      const loginTime = sessionStorage.getItem("admin_login_time");
      const isSessionValid = loginTime && (Date.now() - parseInt(loginTime) < 8 * 60 * 60 * 1000);
      
      const isValid = auth && isSessionValid;
      
      setIsAuthenticated(isValid);
      setIsChecking(false);
      
      // Hapus data yang tidak valid
      if (!isValid && auth) {
        sessionStorage.removeItem("admin_auth");
        sessionStorage.removeItem("admin_username");
        sessionStorage.removeItem("admin_login_time");
      }
    };
    
    checkAuth();
  }, []); // Dependency array kosong, hanya dijalankan sekali

  // Tampilkan loading saat mengecek autentikasi
  if (isChecking) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  // Jika tidak authenticated, redirect ke login
  if (!isAuthenticated) {
    return <Navigate to="/admin-login" replace />;
  }

  // Jika authenticated, tampilkan children
  return children;
};

const styles = {
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#F8F9FA",
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #E5E7EB",
    borderTop: "4px solid #c0392b",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "16px",
  },
};

// Add keyframes
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
if (!document.head.querySelector("#protected-route-styles")) {
  styleSheet.id = "protected-route-styles";
  document.head.appendChild(styleSheet);
}

export default ProtectedRoute;