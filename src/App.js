import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import OrderMenu from "./pages/OrderMenu";
import Kitchen from "./pages/Kitchen";
import AdminPage from "./pages/AdminPage";
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/order" element={<OrderMenu />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Router>
  );
}

export default App;