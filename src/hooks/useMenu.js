// hooks/useMenu.js
import { useEffect, useState } from "react";
import { MenuAPI } from "../api/menu.api";

export function useMenu() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        setLoading(true);
        const response = await MenuAPI.getAll();
        console.log("[useMenu] API Response:", response);
        
        // Handle different response structures
        let menuData = [];
        if (response.data && Array.isArray(response.data)) {
          menuData = response.data;
        } else if (Array.isArray(response)) {
          menuData = response;
        } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
          menuData = response.data.data;
        } else {
          console.warn("[useMenu] Unexpected response structure:", response);
          menuData = [];
        }
        
        const visibleMenuData = menuData.filter((item) => item.isAvailable !== false);
        console.log("[useMenu] Menu data loaded:", visibleMenuData.length, "items");
        setMenuItems(visibleMenuData);
      } catch (err) {
        console.error("[useMenu] Error loading menu:", err);
        setError(err.message);
        setMenuItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
  }, []);

  return { menuItems, loading, error };
}