// App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import OrderMenu from "./pages/OrderMenu";
import Kitchen from "./pages/Kitchen";
import AdminPage from "./pages/AdminPage";
import AdminLogin from "./pages/AdminLogin";
import ProtectedRoute from "./components/ProtectedRoute";
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/order" element={<OrderMenu />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        
        {/* Protected Route - gunakan element dengan children */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;