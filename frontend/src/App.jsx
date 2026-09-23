import { useEffect, useState } from "react";
import AdminDashboard from "./AdminDashboard";
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function getDistanceKm(latitude1, longitude1, latitude2, longitude2) {
  const lat1 = Number(latitude1);
  const lon1 = Number(longitude1);
  const lat2 = Number(latitude2);
  const lon2 = Number(longitude2);

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return null;
  }

  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const menuInputStyle = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#172033",
  boxSizing: "border-box",
  fontSize: "14px"
};

// ============================================================
// BEHAVIOR TRACKING
// ============================================================


function getDeliveryEta(distanceKm) {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(Number(distanceKm))) {
    return "30–40 min";
  }

  const distance = Number(distanceKm);

  if (distance <= 3) return "25–35 min";
  if (distance <= 6) return "30–40 min";
  if (distance <= 10) return "40–50 min";
  return "50–65 min";
}

async function trackBehavior({
  customerId,
  action,
  item = "",
  restaurant = "",
  cuisine = "",
  order_value = 0,
  token
}) {
  try {
    const params = new URLSearchParams();

    params.append("customer_id", customerId);
    params.append("action", action);

    if (item) params.append("item", item);
    if (restaurant) params.append("restaurant", restaurant);
    if (cuisine) params.append("cuisine", cuisine);

    params.append("order_value", order_value);

    const response = await fetch(
      `${API_URL}/behavior?${params.toString()}`,
      {
        method: "POST",
        headers: token
          ? {
              Authorization: `Bearer ${token}`
            }
          : {}
      }
    );

    if (!response.ok) {
      throw new Error(
        `Behavior request failed: ${response.status}`
      );
    }

    return true;
  } catch (error) {
    console.error("Behavior tracking error:", error);
    return false;
  }
}

// ============================================================
// LOGIN SCREEN
// ============================================================

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [resetPassword, setResetPassword] = useState("");
  const [name, setName] = useState("");
  const [favoriteFood, setFavoriteFood] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [restaurantLocation, setRestaurantLocation] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setLoginError("");
    setLoading(true);

    try {
      if (mode === "forgot") {
        const params = new URLSearchParams();
        params.append("username", username.trim());
        params.append("new_password", resetPassword);
        const response = await fetch(`${API_URL}/auth/reset-password?${params.toString()}`, { method: "POST" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Unable to reset password.");
        setMode("login");
        setPassword("");
        setResetPassword("");
        setLoginError("Password reset successfully. You can now login.");
        return;
      }

      if (mode === "customer") {
        const params = new URLSearchParams();
        params.append("username", username.trim());
        params.append("password", password);
        params.append("name", name.trim());
        params.append("favorite_food", favoriteFood.trim());

        const registerResponse = await fetch(
          `${API_URL}/auth/register-customer?${params.toString()}`,
          { method: "POST" }
        );

        const registerData = await registerResponse.json().catch(() => ({}));

        if (!registerResponse.ok) {
          throw new Error(
            registerData.detail || "Unable to create your account."
          );
        }

        const body = new URLSearchParams();
        body.append("username", username.trim());
        body.append("password", password);

        const loginResponse = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body
        });

        const loginData = await loginResponse.json().catch(() => ({}));

        if (!loginResponse.ok) {
          throw new Error(
            loginData.detail ||
              "Account created, but automatic login failed. Please login manually."
          );
        }

        onLogin(loginData);
        return;
      }

      if (mode === "restaurant") {
        const params = new URLSearchParams();
        params.append("username", username.trim());
        params.append("password", password);
        params.append("name", restaurantName.trim());
        params.append("cuisine", cuisine.trim());
        params.append("location", restaurantLocation.trim());

        const registerResponse = await fetch(
          `${API_URL}/auth/register-restaurant?${params.toString()}`,
          { method: "POST" }
        );

        const registerData = await registerResponse.json().catch(() => ({}));

        if (!registerResponse.ok) {
          throw new Error(
            registerData.detail || "Unable to create the restaurant account."
          );
        }

        const body = new URLSearchParams();
        body.append("username", username.trim());
        body.append("password", password);

        const loginResponse = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body
        });

        const loginData = await loginResponse.json().catch(() => ({}));

        if (!loginResponse.ok) {
          throw new Error(
            loginData.detail ||
              "Restaurant created, but automatic login failed. Please login manually."
          );
        }

        onLogin(loginData);
        return;
      }

      const body = new URLSearchParams();
      body.append("username", username.trim());
      body.append("password", password);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Invalid username or password.");
      }

      onLogin(data);
    } catch (error) {
      console.error("Authentication error:", error);
      setLoginError(error.message || "Unable to continue.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setName("");
    setFavoriteFood("");
    setRestaurantName("");
    setCuisine("");
    setRestaurantLocation("");
    setUsername("");
    setPassword("");
    setLoginError("");
  };

  const isRegistering = mode !== "login";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #fff7ed, #ffffff)"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          margin: "20px",
          padding: "40px",
          borderRadius: "20px",
          background: "#ffffff",
          boxShadow: "0 10px 40px rgba(0,0,0,0.10)"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <div
            style={{
              fontSize: "34px",
              fontWeight: "800",
              marginBottom: "10px",
              color: "#e85d04"
            }}
          >
            FoodAI
          </div>
          <p style={{ margin: 0, color: "#666" }}>
            AI-powered food discovery
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            marginBottom: "25px",
            padding: "5px",
            borderRadius: "12px",
            background: "#f1f5f9"
          }}
        >
          {[
            ["login", "Login"],
            ["customer", "Customer"],
            ["restaurant", "Restaurant"],
            ["forgot", "Forgot"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchMode(value)}
              style={{
                border: "none",
                borderRadius: "9px",
                padding: "10px 6px",
                background: mode === value ? "#111827" : "transparent",
                color: mode === value ? "#ffffff" : "#64748b",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <h2 style={{ marginBottom: "8px" }}>
          {mode === "login"
            ? "Welcome back"
            : mode === "customer"
              ? "Create customer account"
              : mode === "restaurant"
                ? "Register your restaurant"
                : "Reset your password"}
        </h2>

        <p style={{ color: "#666", marginBottom: "25px" }}>
          {mode === "login"
            ? "Login to continue to FoodAI."
            : mode === "customer"
              ? "Create a FoodAI customer account for personalized recommendations."
              : mode === "restaurant"
                ? "Create your restaurant account and start managing your FoodAI restaurant dashboard."
                : "Enter your account username and choose a new password."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "customer" && (
            <>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                required
                style={{ ...menuInputStyle, marginBottom: "18px", fontSize: "15px" }}
              />
            </>
          )}

          {mode === "restaurant" && (
            <>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Restaurant Name
              </label>
              <input
                type="text"
                value={restaurantName}
                onChange={(event) => setRestaurantName(event.target.value)}
                placeholder="e.g. Tanuj's Biryani House"
                required
                style={{ ...menuInputStyle, marginBottom: "18px", fontSize: "15px" }}
              />

              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Cuisine
              </label>
              <input
                type="text"
                value={cuisine}
                onChange={(event) => setCuisine(event.target.value)}
                placeholder="e.g. Indian, Biryani, Chinese"
                required
                style={{ ...menuInputStyle, marginBottom: "18px", fontSize: "15px" }}
              />

              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Restaurant Location <span style={{ color: "#94a3b8" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={restaurantLocation}
                onChange={(event) => setRestaurantLocation(event.target.value)}
                placeholder="e.g. Nagpur, Maharashtra"
                style={{ ...menuInputStyle, marginBottom: "18px", fontSize: "15px" }}
              />
            </>
          )}

          <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
            Email
          </label>
          <input
            type="email"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your email"
            required
            style={{ ...menuInputStyle, marginBottom: "18px", fontSize: "15px" }}
          />

          {mode !== "forgot" ? (
            <>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegistering ? "Minimum 6 characters" : "Enter your password"}
                minLength={isRegistering ? 6 : undefined}
                required
                style={{ ...menuInputStyle, marginBottom: "18px", fontSize: "15px" }}
              />
            </>
          ) : (
            <>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                New Password
              </label>
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
                required
                style={{ ...menuInputStyle, marginBottom: "18px", fontSize: "15px" }}
              />
            </>
          )}

          {mode === "customer" && (
            <>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                Favorite Food <span style={{ color: "#94a3b8" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={favoriteFood}
                onChange={(event) => setFavoriteFood(event.target.value)}
                placeholder="e.g. Biryani, Pizza, Burgers"
                style={{ ...menuInputStyle, marginBottom: "20px", fontSize: "15px" }}
              />
            </>
          )}

          {loginError && (
            <div
              style={{
                marginBottom: "18px",
                padding: "12px",
                borderRadius: "8px",
                background: "#fff1f2",
                color: "#b91c1c",
                fontSize: "14px"
              }}
            >
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              border: "none",
              borderRadius: "10px",
              background: "#111827",
              color: "#fff",
              fontSize: "16px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
                ? "Login"
                : mode === "customer"
                  ? "Create Customer Account"
                  : mode === "restaurant"
                ? "Create Restaurant Account"
                : "Reset Password"}
          </button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            onClick={() => switchMode("forgot")}
            style={{ width: "100%", marginTop: "14px", border: "none", background: "transparent", color: "#e85d04", fontWeight: "700", cursor: "pointer" }}
          >
            Forgot Password?
          </button>
        )}

        {mode === "forgot" && (
          <button
            type="button"
            onClick={() => switchMode("login")}
            style={{ width: "100%", marginTop: "14px", border: "none", background: "transparent", color: "#64748b", fontWeight: "700", cursor: "pointer" }}
          >
            Back to Login
          </button>
        )}


      </div>
    </div>
  );
}

// ============================================================
// RESTAURANT LOCATION PICKER
// ============================================================

function RestaurantLocationPicker({ position, onChange }) {
  useMapEvents({
    click(event) {
      onChange([event.latlng.lat, event.latlng.lng]);
    }
  });

  if (!position) {
    return null;
  }

  return (
    <CircleMarker
      center={position}
      radius={10}
    >
      <Popup>
        <strong>Restaurant location</strong>
        <br />
        Latitude: {Number(position[0]).toFixed(6)}
        <br />
        Longitude: {Number(position[1]).toFixed(6)}
      </Popup>
    </CircleMarker>
  );
}

// ============================================================
// CUSTOMER ADDRESS MAP PICKER
// ============================================================

function CustomerAddressLocationPicker({ position, onChange }) {
  useMapEvents({
    click(event) {
      onChange([event.latlng.lat, event.latlng.lng]);
    }
  });

  if (!position) {
    return null;
  }

  return (
    <CircleMarker
      center={position}
      radius={10}
    >
      <Popup>
        <strong>Delivery location</strong>
        <br />
        Latitude: {Number(position[0]).toFixed(6)}
        <br />
        Longitude: {Number(position[1]).toFixed(6)}
      </Popup>
    </CircleMarker>
  );
}

// ============================================================
// RESTAURANT DASHBOARD
// ============================================================

function RestaurantDashboard({ token, authData, onLogout }) {
  const [restaurant, setRestaurant] =
    useState(null);

  const [menu, setMenu] =
    useState([]);
    const [analytics, setAnalytics] =
  useState(null);
  const [aiInsights, setAiInsights] =
  useState([]);

  const [orders, setOrders] =
  useState([]);

  const [ordersLoading, setOrdersLoading] =
  useState(true);

  const [ordersError, setOrdersError] =
  useState("");

  const [updatingOrderId, setUpdatingOrderId] =
  useState(null);

  const [offerSettings, setOfferSettings] =
    useState({
      max_discount_amount: 50,
      max_discount_percent: 20,
      ai_offers_enabled: true
    });

  const [offerSettingsSaving, setOfferSettingsSaving] =
    useState(false);

  const [offerSettingsStatus, setOfferSettingsStatus] =
    useState("");

  const [restaurantLocation, setRestaurantLocation] =
    useState({
      latitude: null,
      longitude: null
    });

  const [profileForm, setProfileForm] =
    useState({
      name: "",
      cuisine: "",
      location: ""
    });

  const [profileSaving, setProfileSaving] =
    useState(false);

  const [profileStatus, setProfileStatus] =
    useState("");

  const [locationSaving, setLocationSaving] =
    useState(false);

  const [locationStatus, setLocationStatus] =
    useState("");

  const [menuForm, setMenuForm] =
    useState({
      name: "",
      category: "Other",
      cuisine: "Other",
      description: "",
      price: "",
      is_vegetarian: true,
      is_available: true,
      image: null
    });

  const [editingMenuItemId, setEditingMenuItemId] =
    useState(null);

  const [menuSaving, setMenuSaving] =
    useState(false);

  const [menuDeletingId, setMenuDeletingId] =
    useState(null);

  const [menuStatus, setMenuStatus] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const restaurantLatitude = Number(restaurantLocation.latitude);
  const restaurantLongitude = Number(restaurantLocation.longitude);

  // Treat 0,0 as an unset location. Leaflet interprets 0,0 as the
  // Gulf of Guinea, which is why an unsaved restaurant could appear
  // near Africa.
  const hasSavedRestaurantLocation =
    Number.isFinite(restaurantLatitude) &&
    Number.isFinite(restaurantLongitude) &&
    !(restaurantLatitude === 0 && restaurantLongitude === 0);

  const restaurantMapCenter = hasSavedRestaurantLocation
    ? [restaurantLatitude, restaurantLongitude]
    : [21.1458, 79.0882];

  const restaurantMapZoom = hasSavedRestaurantLocation
    ? 16
    : 12;

  const resetMenuForm = () => {
    setMenuForm({
      name: "",
      category: "Other",
      cuisine: "Other",
      description: "",
      price: "",
      is_vegetarian: true,
      is_available: true,
      image: null
    });
    setEditingMenuItemId(null);
  };

  const handleEditMenuItem = (item) => {
    setEditingMenuItemId(item.item_id);
    setMenuForm({
      name: item.name || "",
      category: item.category || "Other",
      cuisine: item.cuisine || "Other",
      description: item.description || "",
      price: item.price ?? "",
      is_vegetarian: Boolean(item.is_vegetarian),
      is_available: Boolean(item.is_available),
      image: null
    });
    setMenuStatus("");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const handleSaveMenuItem = async (event) => {
    event.preventDefault();
    setMenuSaving(true);
    setMenuStatus("");

    try {
      if (!menuForm.name.trim()) {
        throw new Error("Item name is required.");
      }
      if (menuForm.price === "" || Number(menuForm.price) < 0) {
        throw new Error("Enter a valid non-negative price.");
      }

      const formData = new FormData();
      formData.append("name", menuForm.name.trim());
      formData.append("category", menuForm.category.trim() || "Other");
      formData.append("cuisine", menuForm.cuisine.trim() || "Other");
      formData.append("description", menuForm.description.trim());
      formData.append("price", String(Number(menuForm.price)));
      formData.append("is_vegetarian", String(menuForm.is_vegetarian));
      formData.append("is_available", String(menuForm.is_available));
      if (menuForm.image) {
        formData.append("image", menuForm.image);
      }

      const url = editingMenuItemId
        ? `${API_URL}/restaurant/me/menu/${editingMenuItemId}`
        : `${API_URL}/restaurant/me/menu`;

      const response = await fetch(url, {
        method: editingMenuItemId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || "Unable to save menu item.");
      }

      await loadRestaurantData();
      setMenuStatus(editingMenuItemId ? "Menu item updated successfully." : "Menu item added successfully.");
      resetMenuForm();
    } catch (error) {
      console.error("Menu save error:", error);
      setMenuStatus(error?.message || "Unable to save menu item.");
    } finally {
      setMenuSaving(false);
    }
  };

  const handleToggleMenuAvailability = async (item) => {
    setMenuStatus("");
    try {
      const formData = new FormData();
      formData.append("is_available", String(!item.is_available));

      const response = await fetch(
        `${API_URL}/restaurant/me/menu/${item.item_id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || "Unable to change availability.");
      }

      setMenu((current) =>
        current.map((menuItem) =>
          menuItem.item_id === item.item_id
            ? { ...menuItem, is_available: !item.is_available }
            : menuItem
        )
      );
      setMenuStatus(`\"${item.name}\" is now ${!item.is_available ? "available" : "unavailable"}.`);
    } catch (error) {
      console.error("Menu availability error:", error);
      setMenuStatus(error?.message || "Unable to change availability.");
    }
  };

  const handleDeleteMenuItem = async (item) => {
    if (!window.confirm(`Remove \"${item.name}\" from your menu?`)) {
      return;
    }

    setMenuDeletingId(item.item_id);
    setMenuStatus("");
    try {
      const response = await fetch(
        `${API_URL}/restaurant/me/menu/${item.item_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || "Unable to delete menu item.");
      }

      setMenu((current) => current.filter((menuItem) => menuItem.item_id !== item.item_id));
      if (editingMenuItemId === item.item_id) {
        resetMenuForm();
      }
      setMenuStatus(`\"${item.name}\" removed successfully.`);
    } catch (error) {
      console.error("Menu delete error:", error);
      setMenuStatus(error?.message || "Unable to delete menu item.");
    } finally {
      setMenuDeletingId(null);
    }
  };

  const loadRestaurantData =
    async () => {
      setLoading(true);
      setError("");

      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };

        const [
  restaurantResponse,
  menuResponse,
  analyticsResponse,
  offerSettingsResponse,
  ordersResponse
] = await Promise.all([
  fetch(
    `${API_URL}/restaurant/me`,
    {
      headers
    }
  ),
  fetch(
    `${API_URL}/restaurant/me/menu`,
    {
      headers
    }
  ),
  fetch(
    `${API_URL}/restaurant/me/analytics`,
    {
      headers
    }
  ),
  fetch(
    `${API_URL}/restaurant/me/offer-settings`,
    {
      headers
    }
  ),
  fetch(
    `${API_URL}/restaurant/me/orders`,
    {
      headers
    }
  )
]);

        if (!restaurantResponse.ok) {
          throw new Error(
            "Unable to load restaurant profile."
          );
        }

        if (!menuResponse.ok) {
          throw new Error(
            "Unable to load restaurant menu."
          );
        }

        const restaurantData =
          await restaurantResponse.json();
const menuData =
  await menuResponse.json();

if (!analyticsResponse.ok) {
  throw new Error(
    "Unable to load restaurant analytics."
  );
}

if (!offerSettingsResponse.ok) {
  throw new Error(
    "Unable to load restaurant offer settings."
  );
}

if (!ordersResponse.ok) {
  throw new Error(
    "Unable to load restaurant orders."
  );
}

const analyticsData =
  await analyticsResponse.json();

const offerSettingsData =
  await offerSettingsResponse.json();

const ordersData =
  await ordersResponse.json();

setOrders(
  Array.isArray(ordersData)
    ? ordersData
    : []
);

setOrdersError("");

setRestaurant(
  restaurantData
);

setProfileForm({
  name: restaurantData.restaurant || "",
  cuisine: restaurantData.cuisine || "",
  location: restaurantData.location || ""
});

setRestaurantLocation({
  latitude:
    restaurantData.latitude ?? null,
  longitude:
    restaurantData.longitude ?? null
});

setOfferSettings({
  max_discount_amount:
    Number(
      offerSettingsData.max_discount_amount ?? 50
    ),
  max_discount_percent:
    Number(
      offerSettingsData.max_discount_percent ?? 20
    ),
  ai_offers_enabled:
    Boolean(
      offerSettingsData.ai_offers_enabled
    )
});

setMenu(
  Array.isArray(menuData)
    ? menuData
    : []
);

setAnalytics(
  analyticsData
);
const generatedInsights = [];

const summary =
  analyticsData?.summary || {};

const conversion =
  Number(
    summary.view_to_order_conversion || 0
  );

const views =
  Number(
    summary.restaurant_views || 0
  );

const uniqueCustomers =
  Number(
    summary.unique_customers || 0
  );

const cartEvents =
  Number(
    summary.cart_events || 0
  );

const orders =
  Number(
    summary.orders || 0
  );

const revenue =
  Number(
    summary.total_revenue || 0
  );

const averageOrderValue =
  Number(
    summary.average_order_value || 0
  );

const searches =
  Number(
    summary.searches || 0
  );

/*
 * 1. CONVERSION INTELLIGENCE
 */

if (conversion >= 60) {
  generatedInsights.push({
    type: "strength",
    icon: "🎯",
    title: "Strong Conversion",
    text:
      `Your restaurant converts ${conversion.toFixed(
        1
      )}% of tracked restaurant views into orders.`,
    action:
      "Increase visibility and discovery while maintaining your current customer experience."
  });
} else if (conversion >= 30) {
  generatedInsights.push({
    type: "opportunity",
    icon: "📈",
    title: "Conversion Opportunity",
    text:
      `Your current view-to-order conversion is ${conversion.toFixed(
        1
      )}%. There is room to turn more restaurant visitors into customers.`,
    action:
      "Improve menu presentation, pricing clarity and high-performing item visibility."
  });
} else if (views > 0) {
  generatedInsights.push({
    type: "warning",
    icon: "⚠️",
    title: "Low Conversion",
    text:
      `Your restaurant is receiving views, but only ${conversion.toFixed(
        1
      )}% are currently converting into orders.`,
    action:
      "Review menu pricing, item presentation and promotional strategy."
  });
}

/*
 * 2. CART ABANDONMENT
 */

if (cartEvents > orders) {
  const unfinishedCarts =
    cartEvents - orders;

  generatedInsights.push({
    type: "opportunity",
    icon: "🛒",
    title: "Cart Drop-off",
    text:
      `${unfinishedCarts} more cart events were recorded than completed orders.`,
    action:
      "Reduce checkout friction and test targeted offers for customers who show purchase intent."
  });
}

/*
 * 3. REVENUE / AOV
 */

if (
  orders > 0 &&
  averageOrderValue > 300
) {
  generatedInsights.push({
    type: "strength",
    icon: "💰",
    title: "Healthy Order Value",
    text:
      `Your average order value is ₹${Math.round(
        averageOrderValue
      )}.`,
    action:
      "Promote combinations and add-ons that preserve or increase basket value."
  });
} else if (
  orders > 0 &&
  averageOrderValue > 0
) {
  generatedInsights.push({
    type: "opportunity",
    icon: "💡",
    title: "Increase Order Value",
    text:
      `Your current average order value is ₹${Math.round(
        averageOrderValue
      )}.`,
    action:
      "Test meal combinations, add-ons and complementary items to increase basket size."
  });
}

/*
 * 4. CUSTOMER REACH
 */

if (
  views > 0 &&
  uniqueCustomers > 0
) {
  generatedInsights.push({
    type: "insight",
    icon: "👥",
    title: "Customer Reach",
    text:
      `${uniqueCustomers} unique customers have interacted with your restaurant.`,
    action:
      "Build repeat-order behavior by keeping popular items available and maintaining consistent quality."
  });
}

/*
 * 5. SEARCH / DISCOVERY
 */

if (searches > 0) {
  generatedInsights.push({
    type: "insight",
    icon: "🔎",
    title: "Discovery Activity",
    text:
      `${searches} search interactions are associated with your restaurant.`,
    action:
      "Keep your restaurant name, cuisine and menu items clearly represented to improve discovery."
  });
}

/*
 * 6. TOP CUISINE
 */

if (
  Array.isArray(
    analyticsData?.top_cuisines
  ) &&
  analyticsData.top_cuisines.length > 0
) {
  const topCuisine =
    analyticsData.top_cuisines[0];

  generatedInsights.push({
    type: "strength",
    icon: "🍽️",
    title: "Top Cuisine Signal",
    text:
      `${topCuisine.cuisine} is currently your strongest tracked cuisine signal with ${topCuisine.orders} recorded orders.`,
    action:
      "Keep your strongest cuisine items prominent and consider expanding successful variations."
  });
}

/*
 * 7. MENU AVAILABILITY
 */

const availableMenuItems =
  Array.isArray(menuData)
    ? menuData.filter(
        (item) =>
          item.is_available
      ).length
    : 0;

const unavailableMenuItems =
  Array.isArray(menuData)
    ? menuData.filter(
        (item) =>
          !item.is_available
      ).length
    : 0;

if (
  unavailableMenuItems > 0
) {
  generatedInsights.push({
    type: "warning",
    icon: "📋",
    title: "Unavailable Menu Items",
    text:
      `${unavailableMenuItems} menu item${
        unavailableMenuItems === 1
          ? ""
          : "s"
      } currently appear unavailable.`,
    action:
      "Review unavailable items so customers do not encounter unnecessary ordering friction."
  });
} else if (
  availableMenuItems > 0
) {
  generatedInsights.push({
    type: "strength",
    icon: "✅",
    title: "Menu Availability",
    text:
      `All ${availableMenuItems} registered menu items are currently available.`,
    action:
      "Maintain availability for your strongest-performing items during high-demand periods."
  });
}

/*
 * 8. GROWTH OPPORTUNITY
 */

if (
  conversion > 0 &&
  views > 0
) {
  generatedInsights.push({
    type: "opportunity",
    icon: "🚀",
    title: "Growth Opportunity",
    text:
      "Even a small increase in restaurant visibility could create additional ordering opportunities from your existing conversion performance.",
    action:
      "Focus on discovery, high-performing menu items and repeat-customer engagement before relying heavily on discounts."
  });
}

/*
 * 9. FALLBACK
 */

if (
  generatedInsights.length === 0
) {
  generatedInsights.push({
    type: "insight",
    icon: "🤖",
    title: "Learning From Your Data",
    text:
      "FoodAI is collecting enough restaurant activity to begin building partner intelligence.",
    action:
      "Continue operating normally so the system can identify stronger behavioral patterns."
  });
}

setAiInsights(
  generatedInsights.slice(0, 7)
);
      } catch (err) {
        console.error(
          "Restaurant dashboard error:",
          err
        );

        setError(
          err.message ||
            "Unable to load restaurant dashboard."
        );
      } finally {
        setLoading(false);
        setOrdersLoading(false);
      }
    };

  useEffect(() => {
    loadRestaurantData();
  }, []);

  const availableItems =
    menu.filter(
      (item) => item.is_available
    ).length;

  const handleUpdateOrderStatus = async (orderId, status) => {
    setUpdatingOrderId(orderId);
    setOrdersError("");

    try {
      const params = new URLSearchParams();
      params.append("status", status);

      const response = await fetch(
        `${API_URL}/restaurant/me/orders/${orderId}/status?${params.toString()}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.detail || "Unable to update order status."
        );
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.order_id === orderId
            ? {
                ...order,
                status: data.status || status
              }
            : order
        )
      );
    } catch (err) {
      console.error("Order status update error:", err);
      setOrdersError(
        err.message || "Unable to update order status."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSaveOfferSettings = async () => {
    setOfferSettingsSaving(true);
    setOfferSettingsStatus("");

    try {
      const maxDiscountAmount = Number(
        offerSettings.max_discount_amount
      );

      const maxDiscountPercent = Number(
        offerSettings.max_discount_percent
      );

      if (
        !Number.isFinite(maxDiscountAmount) ||
        maxDiscountAmount < 0
      ) {
        throw new Error(
          "Maximum discount amount must be 0 or greater."
        );
      }

      if (
        !Number.isFinite(maxDiscountPercent) ||
        maxDiscountPercent < 0 ||
        maxDiscountPercent > 100
      ) {
        throw new Error(
          "Maximum discount percentage must be between 0 and 100."
        );
      }

      const params = new URLSearchParams();

      params.append(
        "max_discount_amount",
        maxDiscountAmount
      );

      params.append(
        "max_discount_percent",
        maxDiscountPercent
      );

      params.append(
        "ai_offers_enabled",
        String(
          Boolean(
            offerSettings.ai_offers_enabled
          )
        )
      );

      const response = await fetch(
        `${API_URL}/restaurant/me/offer-settings?${params.toString()}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to save offer settings."
        );
      }

      setOfferSettings({
        max_discount_amount:
          Number(data.max_discount_amount),
        max_discount_percent:
          Number(data.max_discount_percent),
        ai_offers_enabled:
          Boolean(data.ai_offers_enabled)
      });

      setOfferSettingsStatus(
        "Offer settings saved successfully."
      );
    } catch (err) {
      console.error(
        "Offer settings save error:",
        err
      );

      setOfferSettingsStatus(
        err.message ||
          "Unable to save offer settings."
      );
    } finally {
      setOfferSettingsSaving(false);
    }
  };

  const handleSaveRestaurantProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    setProfileStatus("");

    try {
      const name = profileForm.name.trim();
      const cuisine = profileForm.cuisine.trim();
      const location = profileForm.location.trim();

      if (!name) throw new Error("Restaurant name is required.");
      if (!cuisine) throw new Error("Cuisine is required.");

      const params = new URLSearchParams();
      params.append("name", name);
      params.append("cuisine", cuisine);
      params.append("location", location);

      const response = await fetch(
        `${API_URL}/restaurant/me/profile?${params.toString()}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Unable to update restaurant profile.");
      }

      setRestaurant((current) =>
        current
          ? {
              ...current,
              restaurant: data.restaurant,
              cuisine: data.cuisine,
              location: data.location
            }
          : current
      );

      setProfileForm({
        name: data.restaurant || name,
        cuisine: data.cuisine || cuisine,
        location: data.location || location
      });

      setProfileStatus("Restaurant profile updated successfully.");
    } catch (err) {
      console.error("Restaurant profile update error:", err);
      setProfileStatus(err.message || "Unable to update restaurant profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveRestaurantLocation = async () => {
    setLocationSaving(true);
    setLocationStatus("");

    try {
      const latitude = Number(
        restaurantLocation.latitude
      );

      const longitude = Number(
        restaurantLocation.longitude
      );

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error(
          "Click on the map to select your restaurant location."
        );
      }

      const params = new URLSearchParams();
      params.append("latitude", latitude);
      params.append("longitude", longitude);

      const response = await fetch(
        `${API_URL}/restaurant/me/location?${params.toString()}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Unable to save restaurant location."
        );
      }

      setRestaurantLocation({
        latitude: Number(data.latitude),
        longitude: Number(data.longitude)
      });

      setRestaurant((current) =>
        current
          ? {
              ...current,
              latitude: Number(data.latitude),
              longitude: Number(data.longitude)
            }
          : current
      );

      setLocationStatus(
        "Restaurant location saved successfully."
      );
    } catch (err) {
      console.error(
        "Restaurant location save error:",
        err
      );

      setLocationStatus(
        err.message ||
          "Unable to save restaurant location."
      );
    } finally {
      setLocationSaving(false);
    }
  };

  const handleAiAction = (insight) => {
    const title = String(insight?.title || "").toLowerCase();

    let targetId = "restaurant-analytics";

    if (
      title.includes("menu") ||
      title.includes("order value") ||
      title.includes("top cuisine")
    ) {
      targetId = "restaurant-menu";
    }

    const target = document.getElementById(targetId);

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    setSearchStatus(
      `AI action selected: ${insight.action}`
    );
  };

  const vegetarianItems =
    menu.filter(
      (item) => item.is_vegetarian
    ).length;

  const aiMenuRecommendations = [...menu]
    .filter((item) => item && item.name)
    .map((item) => {
      const popularity = Number(item.popularity || 0);
      const rating = Number(item.rating || 0);
      const availabilityScore = item.is_available ? 10 : -20;
      const score = popularity + rating * 10 + availabilityScore;

      let reason = "This item has a useful combination of popularity and customer rating.";
      let action = "Keep this item visible and monitor its performance.";

      if (!item.is_available) {
        reason = "Customers cannot currently order this item.";
        action = "Review availability and restore the item if stock and operations allow.";
      } else if (popularity >= 70 && rating >= 4.5) {
        reason = `Popularity is ${popularity} with a ${rating.toFixed(1)} rating, making this a strong menu candidate.`;
        action = "Give this item prominent placement and consider using it as a hero item or combo anchor.";
      } else if (popularity >= 70) {
        reason = `The item has a popularity score of ${popularity}, indicating strong customer interest.`;
        action = "Keep this item highly visible and consider pairing it with complementary items.";
      } else if (rating >= 4.5) {
        reason = `The item has a strong ${rating.toFixed(1)} customer rating despite lower popularity.`;
        action = "Increase its visibility to test whether stronger discovery can convert its rating strength into more orders.";
      } else {
        reason = `The item currently has popularity ${popularity} and rating ${rating.toFixed(1)}.`;
        action = "Monitor this item and compare its performance with stronger menu items before changing its placement.";
      }

      return {
        ...item,
        aiScore: score,
        reason,
        action
      };
    })
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 3);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f8fafc"
        }}
      >
        <RestaurantNavbar
          restaurant={restaurant}
          username={authData.username}
          onLogout={onLogout}
        />

        <div
          style={{
            padding: "60px",
            textAlign: "center",
            color: "#64748b"
          }}
        >
          Loading restaurant dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f8fafc"
        }}
      >
        <RestaurantNavbar
          restaurant={restaurant}
          username={authData.username}
          onLogout={onLogout}
        />

        <div
          style={{
            maxWidth: "900px",
            margin: "60px auto",
            padding: "20px"
          }}
        >
          <div
            style={{
              padding: "20px",
              borderRadius: "12px",
              background: "#fff1f2",
              color: "#b91c1c"
            }}
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc"
      }}
    >
      <RestaurantNavbar
        restaurant={restaurant}
        username={authData.username}
        onLogout={onLogout}
      />

      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "35px 20px 60px"
        }}
      >
        {/* HEADER */}

        <div
          style={{
            marginBottom: "30px"
          }}
        >
          <div
            style={{
              color: "#e85d04",
              fontWeight: "700",
              fontSize: "14px",
              marginBottom: "8px"
            }}
          >
            RESTAURANT PARTNER
          </div>

          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "34px",
              color: "#172033"
            }}
          >
            {restaurant?.restaurant ||
              "Restaurant Dashboard"}
          </h1>

          <p
            style={{
              margin: 0,
              color: "#64748b"
            }}
          >
            Manage your restaurant information
            and menu through FoodAI.
          </p>
        </div>

        {/* RESTAURANT PROFILE */}

        <section
          id="restaurant-profile"
          style={{
            background: "linear-gradient(135deg, #fff7ed, #ffffff)",
            border: "1px solid #fed7aa",
            borderRadius: "18px",
            padding: "28px",
            marginBottom: "25px"
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <div style={{ color: "#e85d04", fontSize: "12px", fontWeight: "800", letterSpacing: "0.6px", marginBottom: "6px" }}>
              RESTAURANT PROFILE
            </div>
            <h2 style={{ margin: "0 0 6px", color: "#172033" }}>Manage Restaurant Profile</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Update the public information customers see for your restaurant.
            </p>
          </div>

          <form onSubmit={handleSaveRestaurantProfile}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "6px", color: "#334155", fontWeight: "700", fontSize: "13px" }}>Restaurant Name</label>
                <input
                  value={profileForm.name}
                  onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                  style={menuInputStyle}
                  placeholder="Restaurant name"
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "6px", color: "#334155", fontWeight: "700", fontSize: "13px" }}>Cuisine</label>
                <input
                  value={profileForm.cuisine}
                  onChange={(event) => setProfileForm((current) => ({ ...current, cuisine: event.target.value }))}
                  style={menuInputStyle}
                  placeholder="Indian, Chinese, Biryani..."
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", marginBottom: "6px", color: "#334155", fontWeight: "700", fontSize: "13px" }}>Address / Location</label>
                <input
                  value={profileForm.location}
                  onChange={(event) => setProfileForm((current) => ({ ...current, location: event.target.value }))}
                  style={menuInputStyle}
                  placeholder="Restaurant address or area"
                />
              </div>
            </div>

            <div style={{ marginTop: "18px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={profileSaving}
                style={{ padding: "11px 18px", border: "none", borderRadius: "9px", background: "#e85d04", color: "#ffffff", fontWeight: "800", cursor: profileSaving ? "not-allowed" : "pointer", opacity: profileSaving ? 0.7 : 1 }}
              >
                {profileSaving ? "Saving..." : "Save Profile"}
              </button>

              {profileStatus && (
                <span style={{ color: profileStatus.includes("successfully") ? "#047857" : "#b91c1c", fontSize: "13px", fontWeight: "600" }}>
                  {profileStatus}
                </span>
              )}
            </div>
          </form>

          <div style={{ marginTop: "22px", paddingTop: "20px", borderTop: "1px solid #fed7aa", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "14px", color: "#64748b" }}>Account username</div>
              <div style={{ fontWeight: "800", color: "#172033", marginTop: "4px" }}>{authData.username}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "28px", fontWeight: "800", color: "#e85d04" }}>₹{Math.round(restaurant?.average_price || 0)}</div>
              <div style={{ color: "#64748b", fontSize: "13px" }}>Average price</div>
            </div>
          </div>
        </section>

        {/* RESTAURANT ORDERS */}

        <section
          id="restaurant-orders"
          style={{
            marginBottom: "30px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "25px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "15px",
              flexWrap: "wrap",
              marginBottom: "18px"
            }}
          >
            <div>
              <div
                style={{
                  color: "#e85d04",
                  fontSize: "12px",
                  fontWeight: "800",
                  letterSpacing: "0.6px",
                  marginBottom: "6px"
                }}
              >
                ORDER MANAGEMENT
              </div>

              <h2 style={{ margin: "0 0 6px", color: "#172033" }}>
                Customer Orders
              </h2>

              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Orders placed at {restaurant?.restaurant || "your restaurant"}.
              </p>
            </div>

            <div
              style={{
                padding: "9px 13px",
                borderRadius: "999px",
                background: "#fff7ed",
                color: "#9a3412",
                fontSize: "13px",
                fontWeight: "800"
              }}
            >
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </div>
          </div>

          {ordersLoading ? (
            <div
              style={{
                padding: "20px",
                borderRadius: "12px",
                background: "#f8fafc",
                color: "#64748b"
              }}
            >
              Loading orders...
            </div>
          ) : ordersError ? (
            <div
              style={{
                padding: "14px",
                borderRadius: "10px",
                background: "#fff1f2",
                color: "#b91c1c"
              }}
            >
              {ordersError}
            </div>
          ) : orders.length === 0 ? (
            <div
              style={{
                padding: "25px",
                borderRadius: "12px",
                background: "#f8fafc",
                color: "#64748b",
                textAlign: "center"
              }}
            >
              No orders have been placed at this restaurant yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {orders.map((order) => (
                <div
                  key={order.order_id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "14px",
                    padding: "18px",
                    background: "#ffffff"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "15px",
                      flexWrap: "wrap",
                      marginBottom: "12px"
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "17px",
                          fontWeight: "800",
                          color: "#172033"
                        }}
                      >
                        Order #{order.order_id}
                      </div>
                      <div
                        style={{
                          marginTop: "4px",
                          color: "#64748b",
                          fontSize: "12px"
                        }}
                      >
                        {order.created_at
                          ? new Date(order.created_at).toLocaleString("en-IN")
                          : "Date unavailable"}
                      </div>
                    </div>

                    <select
                      value={order.status || "placed"}
                      onChange={(event) =>
                        handleUpdateOrderStatus(
                          order.order_id,
                          event.target.value
                        )
                      }
                      disabled={
                        updatingOrderId === order.order_id
                      }
                      style={{
                        padding: "8px 12px",
                        borderRadius: "999px",
                        border: "1px solid #bfdbfe",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: "12px",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        cursor:
                          updatingOrderId === order.order_id
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          updatingOrderId === order.order_id
                            ? 0.65
                            : 1
                      }}
                    >
                      <option value="placed">Placed</option>
                      <option value="preparing">Preparing</option>
                      <option value="out_for_delivery">
                        Out for Delivery
                      </option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "7px",
                      marginBottom: "14px"
                    }}
                  >
                    {(Array.isArray(order.items) ? order.items : []).map(
                      (item, index) => (
                        <div
                          key={`${order.order_id}-${index}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            color: "#334155",
                            fontSize: "14px"
                          }}
                        >
                          <span>
                            {item.quantity || 1} × {item.item || item.name || "Item"}
                          </span>
                          <strong>
                            ₹{Math.round(
                              Number(item.price || 0) *
                                Number(item.quantity || 1)
                            )}
                          </strong>
                        </div>
                      )
                    )}
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "15px",
                      flexWrap: "wrap"
                    }}
                  >
                    <div
                      style={{
                        color: "#64748b",
                        fontSize: "13px",
                        lineHeight: "1.6"
                      }}
                    >
                      <div>
                        📍 {order.delivery_address?.label || "Delivery"}:{" "}
                        {order.delivery_address?.address || "Address unavailable"}
                      </div>

                      {order.delivery_address?.landmark && (
                        <div>
                          Landmark: {order.delivery_address.landmark}
                        </div>
                      )}

                      {order.coupon_code && (
                        <div>
                          Coupon: {order.coupon_code}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: "right", minWidth: "120px" }}>
                      <div
                        style={{
                          color: "#64748b",
                          fontSize: "12px",
                          marginBottom: "3px"
                        }}
                      >
                        Order Total
                      </div>
                      <div
                        style={{
                          fontSize: "22px",
                          fontWeight: "800",
                          color: "#e85d04"
                        }}
                      >
                        ₹{Math.round(Number(order.grand_total || 0))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* AI OFFER CONTROLS */}

        <section
          id="restaurant-offer-settings"
          style={{
            marginBottom: "30px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "25px"
          }}
        >
          <div
            style={{
              marginBottom: "20px"
            }}
          >
            <div
              style={{
                color: "#e85d04",
                fontSize: "12px",
                fontWeight: "800",
                letterSpacing: "0.6px",
                marginBottom: "6px"
              }}
            >
              AI OFFER CONTROLS
            </div>

            <h2
              style={{
                margin: "0 0 6px",
                color: "#172033"
              }}
            >
              Control Your Customer Discounts
            </h2>

            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "14px",
                lineHeight: "1.5"
              }}
            >
              Set the maximum discount FoodAI can use for
              personalized customer offers at your restaurant.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px"
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "7px",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#334155"
                }}
              >
                Maximum discount amount (₹)
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={
                  offerSettings.max_discount_amount
                }
                onChange={(event) =>
                  setOfferSettings((current) => ({
                    ...current,
                    max_discount_amount:
                      event.target.value
                  }))
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px"
                }}
              />

              <div
                style={{
                  marginTop: "6px",
                  color: "#64748b",
                  fontSize: "12px"
                }}
              >
                Absolute rupee limit for an AI offer.
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "7px",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#334155"
                }}
              >
                Maximum discount (%)
              </label>

              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={
                  offerSettings.max_discount_percent
                }
                onChange={(event) =>
                  setOfferSettings((current) => ({
                    ...current,
                    max_discount_percent:
                      event.target.value
                  }))
                }
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px"
                }}
              />

              <div
                style={{
                  marginTop: "6px",
                  color: "#64748b",
                  fontSize: "12px"
                }}
              >
                Percentage limit applied to the order value.
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                background: "#f8fafc",
                border: "1px solid #e5e7eb"
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#334155",
                  marginBottom: "9px"
                }}
              >
                AI personalized offers
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  color: "#172033",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    Boolean(
                      offerSettings.ai_offers_enabled
                    )
                  }
                  onChange={(event) =>
                    setOfferSettings((current) => ({
                      ...current,
                      ai_offers_enabled:
                        event.target.checked
                    }))
                  }
                  style={{
                    width: "18px",
                    height: "18px"
                  }}
                />

                Allow FoodAI to generate offers
              </label>
            </div>
          </div>

          <div
            style={{
              marginTop: "18px",
              padding: "13px 15px",
              borderRadius: "10px",
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              fontSize: "13px",
              lineHeight: "1.5"
            }}
          >
            <strong>Important:</strong>{" "}
            FoodAI will personalize the discount for each
            customer, but it will never exceed the limits
            you set here.
          </div>

          <div
            style={{
              marginTop: "18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap"
            }}
          >
            <button
              type="button"
              onClick={handleSaveOfferSettings}
              disabled={offerSettingsSaving}
              style={{
                padding: "11px 17px",
                border: "none",
                borderRadius: "9px",
                background: "#111827",
                color: "#ffffff",
                fontWeight: "700",
                cursor: offerSettingsSaving
                  ? "not-allowed"
                  : "pointer",
                opacity: offerSettingsSaving
                  ? 0.7
                  : 1
              }}
            >
              {offerSettingsSaving
                ? "Saving..."
                : "Save Offer Settings"}
            </button>

            {offerSettingsStatus && (
              <span
                style={{
                  color:
                    offerSettingsStatus.includes(
                      "successfully"
                    )
                      ? "#047857"
                      : "#b91c1c",
                  fontSize: "13px",
                  fontWeight: "600"
                }}
              >
                {offerSettingsStatus}
              </span>
            )}
          </div>
        </section>

        {/* RESTAURANT LOCATION */}

        <section
          id="restaurant-location"
          style={{
            marginBottom: "30px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "25px"
          }}
        >
          <div
            style={{
              marginBottom: "18px"
            }}
          >
            <div
              style={{
                color: "#e85d04",
                fontSize: "12px",
                fontWeight: "800",
                letterSpacing: "0.6px",
                marginBottom: "6px"
              }}
            >
              RESTAURANT LOCATION
            </div>

            <h2
              style={{
                margin: "0 0 6px",
                color: "#172033"
              }}
            >
              Set Your Restaurant Location
            </h2>

            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "14px",
                lineHeight: "1.5"
              }}
            >
              Click on the map to place your restaurant. Customers will see this location on the restaurant page.
            </p>
          </div>

          <div
            style={{
              overflow: "hidden",
              borderRadius: "14px",
              border: "1px solid #e5e7eb"
            }}
          >
            <MapContainer
              key={hasSavedRestaurantLocation ? "saved-location" : "default-location"}
              center={restaurantMapCenter}
              zoom={restaurantMapZoom}
              scrollWheelZoom={true}
              style={{
                height: "360px",
                width: "100%"
              }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <RestaurantLocationPicker
                position={
                  hasSavedRestaurantLocation
                    ? [restaurantLatitude, restaurantLongitude]
                    : null
                }
                onChange={([latitude, longitude]) =>
                  setRestaurantLocation({
                    latitude,
                    longitude
                  })
                }
              />
            </MapContainer>
          </div>

          <div
            style={{
              marginTop: "15px",
              display: "flex",
              gap: "14px",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            <div
              style={{
                color: "#475569",
                fontSize: "13px",
                lineHeight: "1.6"
              }}
            >
              <strong>Latitude:</strong>{" "}
              {Number.isFinite(Number(restaurantLocation.latitude))
                ? Number(restaurantLocation.latitude).toFixed(6)
                : "Not selected"}
              <br />
              <strong>Longitude:</strong>{" "}
              {Number.isFinite(Number(restaurantLocation.longitude))
                ? Number(restaurantLocation.longitude).toFixed(6)
                : "Not selected"}
            </div>

            <button
              type="button"
              onClick={handleSaveRestaurantLocation}
              disabled={locationSaving}
              style={{
                padding: "11px 17px",
                border: "none",
                borderRadius: "9px",
                background: "#111827",
                color: "#ffffff",
                fontWeight: "700",
                cursor: locationSaving
                  ? "not-allowed"
                  : "pointer",
                opacity: locationSaving
                  ? 0.7
                  : 1
              }}
            >
              {locationSaving
                ? "Saving..."
                : "Save Restaurant Location"}
            </button>

            {locationStatus && (
              <span
                style={{
                  color:
                    locationStatus.includes(
                      "successfully"
                    )
                      ? "#047857"
                      : "#b91c1c",
                  fontSize: "13px",
                  fontWeight: "600"
                }}
              >
                {locationStatus}
              </span>
            )}
          </div>
        </section>

        {/* BUSINESS ANALYTICS */}

<section
  id="restaurant-analytics"
  style={{
    marginBottom: "30px"
  }}
>
  <div
    style={{
      marginBottom: "16px"
    }}
  >
    <h2
      style={{
        margin: "0 0 5px",
        color: "#172033"
      }}
    >
      Business Analytics
    </h2>

    <p
      style={{
        margin: 0,
        color: "#64748b",
        fontSize: "14px"
      }}
    >
      Real-time customer activity and business performance.
    </p>
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "18px"
    }}
  >
    <RestaurantStat
      title="Restaurant Views"
      value={
        analytics?.summary?.restaurant_views ?? 0
      }
      icon="👀"
    />

    <RestaurantStat
      title="Unique Customers"
      value={
        analytics?.summary?.unique_customers ?? 0
      }
      icon="👥"
    />

    <RestaurantStat
      title="Cart Events"
      value={
        analytics?.summary?.cart_events ?? 0
      }
      icon="🛒"
    />

    <RestaurantStat
      title="Orders"
      value={
        analytics?.summary?.orders ?? 0
      }
      icon="🧾"
    />

    <RestaurantStat
      title="Revenue"
      value={`₹${Math.round(
        analytics?.summary?.total_revenue ?? 0
      )}`}
      icon="💰"
    />

    <RestaurantStat
      title="Average Order Value"
      value={`₹${Math.round(
        analytics?.summary?.average_order_value ?? 0
      )}`}
      icon="📊"
    />

    <RestaurantStat
      title="View → Order"
      value={`${
        analytics?.summary?.view_to_order_conversion ?? 0
      }%`}
      icon="🎯"
    />

    <RestaurantStat
      title="Searches"
      value={
        analytics?.summary?.searches ?? 0
      }
      icon="🔎"
    />
  </div>
</section>

        {/* 7-DAY DEMAND TREND */}

        {(() => {
          const demandTrend = Array.isArray(
            analytics?.demand_last_7_days
          )
            ? analytics.demand_last_7_days
            : [];

          const maxOrders = Math.max(
            ...demandTrend.map(
              (day) => Number(day.orders || 0)
            ),
            1
          );

          const totalTrendOrders =
            demandTrend.reduce(
              (sum, day) =>
                sum + Number(day.orders || 0),
              0
            );

          const totalTrendRevenue =
            demandTrend.reduce(
              (sum, day) =>
                sum + Number(day.revenue || 0),
              0
            );

          const firstHalfOrders =
            demandTrend
              .slice(0, Math.max(1, Math.floor(demandTrend.length / 2)))
              .reduce(
                (sum, day) =>
                  sum + Number(day.orders || 0),
                0
              );

          const secondHalfOrders =
            demandTrend
              .slice(Math.floor(demandTrend.length / 2))
              .reduce(
                (sum, day) =>
                  sum + Number(day.orders || 0),
                0
              );

          let trendLabel = "Stable";
          let trendText =
            "Order demand is relatively stable across the tracked period.";

          if (secondHalfOrders > firstHalfOrders) {
            trendLabel = "Rising";
            trendText =
              "Recent order activity is higher than the earlier part of the tracked period.";
          } else if (secondHalfOrders < firstHalfOrders) {
            trendLabel = "Declining";
            trendText =
              "Recent order activity is lower than the earlier part of the tracked period.";
          }

          return (
            <section
              id="restaurant-demand-trend"
              style={{
                marginBottom: "30px",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "18px",
                padding: "25px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "15px",
                  flexWrap: "wrap",
                  marginBottom: "20px"
                }}
              >
                <div>
                  <div
                    style={{
                      color: "#e85d04",
                      fontSize: "12px",
                      fontWeight: "800",
                      letterSpacing: "0.6px",
                      marginBottom: "6px"
                    }}
                  >
                    AI DEMAND INTELLIGENCE
                  </div>

                  <h2
                    style={{
                      margin: "0 0 6px",
                      color: "#172033"
                    }}
                  >
                    7-Day Demand Trend
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color: "#64748b",
                      fontSize: "14px"
                    }}
                  >
                    FoodAI tracks actual customer activity over time to identify whether demand is rising, stable or declining.
                  </p>
                </div>

                <div
                  style={{
                    padding: "9px 13px",
                    borderRadius: "999px",
                    background:
                      trendLabel === "Rising"
                        ? "#ecfdf5"
                        : trendLabel === "Declining"
                          ? "#fff1f2"
                          : "#f8fafc",
                    color:
                      trendLabel === "Rising"
                        ? "#047857"
                        : trendLabel === "Declining"
                          ? "#b91c1c"
                          : "#475569",
                    fontSize: "12px",
                    fontWeight: "800"
                  }}
                >
                  {trendLabel.toUpperCase()} DEMAND
                </div>
              </div>

              {demandTrend.length === 0 ? (
                <div
                  style={{
                    padding: "18px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    color: "#64748b"
                  }}
                >
                  FoodAI needs timestamped customer activity before it can show a demand trend.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(170px, 1fr))",
                      gap: "12px",
                      marginBottom: "22px"
                    }}
                  >
                    <div
                      style={{
                        padding: "15px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px"
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          marginBottom: "5px"
                        }}
                      >
                        7-Day Orders
                      </div>
                      <strong
                        style={{
                          fontSize: "22px",
                          color: "#172033"
                        }}
                      >
                        {totalTrendOrders}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: "15px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px"
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          marginBottom: "5px"
                        }}
                      >
                        7-Day Revenue
                      </div>
                      <strong
                        style={{
                          fontSize: "22px",
                          color: "#172033"
                        }}
                      >
                        ₹{Math.round(totalTrendRevenue)}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: "15px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px"
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          marginBottom: "5px"
                        }}
                      >
                        Trend Signal
                      </div>
                      <strong
                        style={{
                          fontSize: "22px",
                          color: "#172033"
                        }}
                      >
                        {trendLabel}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(7, minmax(55px, 1fr))",
                      gap: "10px",
                      alignItems: "end",
                      minHeight: "220px"
                    }}
                  >
                    {demandTrend.map((day) => {
                      const orders = Number(
                        day.orders || 0
                      );

                      const barHeight =
                        Math.max(
                          8,
                          Math.round(
                            (orders / maxOrders) * 145
                          )
                        );

                      const dateLabel = new Date(
                        `${day.date}T00:00:00`
                      ).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short"
                        }
                      );

                      return (
                        <div
                          key={day.date}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            minWidth: 0,
                            height: "200px"
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: "800",
                              color: "#172033",
                              marginBottom: "6px"
                            }}
                          >
                            {orders}
                          </div>

                          <div
                            title={`${orders} order(s), ${Number(
                              day.interactions || 0
                            )} interaction(s), ₹${Math.round(
                              Number(day.revenue || 0)
                            )} revenue`}
                            style={{
                              width: "100%",
                              maxWidth: "52px",
                              height: `${barHeight}px`,
                              background: "#e85d04",
                              borderRadius: "8px 8px 3px 3px"
                            }}
                          />

                          <div
                            style={{
                              marginTop: "8px",
                              fontSize: "11px",
                              color: "#64748b",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {dateLabel}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: "18px",
                      padding: "13px 15px",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      color: "#475569",
                      fontSize: "13px"
                    }}
                  >
                    <strong>FoodAI interpretation:</strong>{" "}
                    {trendText}
                  </div>
                </>
              )}
            </section>
          );
        })()}

        {/* AI MENU RECOMMENDATIONS */}

        <section
          id="restaurant-menu-ai"
          style={{
            marginBottom: "30px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "25px"
          }}
        >
          <div style={{ marginBottom: "18px" }}>
            <div
              style={{
                color: "#e85d04",
                fontSize: "12px",
                fontWeight: "800",
                letterSpacing: "0.6px",
                marginBottom: "6px"
              }}
            >
              AI MENU INTELLIGENCE
            </div>
            <h2 style={{ margin: "0 0 6px", color: "#172033" }}>
              What FoodAI Recommends You Promote
            </h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Specific menu recommendations generated from availability, popularity and rating signals.
            </p>
          </div>

          {aiMenuRecommendations.length === 0 ? (
            <div
              style={{
                padding: "18px",
                borderRadius: "12px",
                background: "#f8fafc",
                color: "#64748b"
              }}
            >
              FoodAI needs menu data before it can recommend specific items.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "15px"
              }}
            >
              {aiMenuRecommendations.map((item, index) => (
                <div
                  key={item.item_id || item.id || item.name}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "14px",
                    padding: "18px",
                    background: "#f8fafc"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "flex-start"
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: "800",
                          color: "#e85d04",
                          marginBottom: "5px"
                        }}
                      >
                        #{index + 1} AI PRIORITY
                      </div>
                      <h3 style={{ margin: 0, color: "#172033" }}>
                        {item.name}
                      </h3>
                    </div>
                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: "20px",
                        background: item.is_available ? "#ecfdf5" : "#fff1f2",
                        color: item.is_available ? "#047857" : "#b91c1c",
                        fontSize: "11px",
                        fontWeight: "800"
                      }}
                    >
                      {item.is_available ? "AVAILABLE" : "UNAVAILABLE"}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "14px",
                      marginTop: "14px",
                      fontSize: "12px",
                      color: "#64748b"
                    }}
                  >
                    <span>Popularity: <strong>{item.popularity ?? 0}</strong></span>
                    <span>Rating: <strong>{item.rating ?? 0}</strong></span>
                    <span>₹{Math.round(item.price || 0)}</span>
                  </div>

                  <p
                    style={{
                      margin: "14px 0 10px",
                      color: "#475569",
                      fontSize: "13px",
                      lineHeight: "1.5"
                    }}
                  >
                    {item.reason}
                  </p>

                  <div
                    style={{
                      padding: "11px 12px",
                      borderRadius: "9px",
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      color: "#334155",
                      fontSize: "13px",
                      lineHeight: "1.5"
                    }}
                  >
                    <strong>AI Action:</strong> {item.action}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* OVERVIEW CARDS */}

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "18px",
            marginBottom: "30px"
          }}
        >
          <RestaurantStat
            title="Menu Items"
            value={menu.length}
            icon="🍽️"
          />

          <RestaurantStat
            title="Available Items"
            value={availableItems}
            icon="✅"
          />

          <RestaurantStat
            title="Vegetarian"
            value={vegetarianItems}
            icon="🥗"
          />

          <RestaurantStat
            title="Popularity"
            value={
              restaurant?.popularity ?? 0
            }
            icon="🔥"
          />
        </section>

        {/* MENU MANAGEMENT */}

        <section
          id="restaurant-menu-management"
          style={{
            marginBottom: "30px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "25px"
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                color: "#e85d04",
                fontSize: "12px",
                fontWeight: "800",
                letterSpacing: "0.6px",
                marginBottom: "6px"
              }}
            >
              MENU MANAGEMENT
            </div>
            <h2 style={{ margin: "0 0 6px", color: "#172033" }}>
              Manage Your Menu
            </h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Add, edit, remove and control availability of your restaurant's items.
            </p>
          </div>

          <form onSubmit={handleSaveMenuItem}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "14px"
              }}
            >
              <input
                value={menuForm.name}
                onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                placeholder="Item name"
                required
                style={menuInputStyle}
              />
              <input
                value={menuForm.category}
                onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                placeholder="Category"
                style={menuInputStyle}
              />
              <input
                value={menuForm.cuisine}
                onChange={(e) => setMenuForm({ ...menuForm, cuisine: e.target.value })}
                placeholder="Cuisine"
                style={menuInputStyle}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={menuForm.price}
                onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                placeholder="Price (₹)"
                required
                style={menuInputStyle}
              />
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(e) => setMenuForm({ ...menuForm, image: e.target.files?.[0] || null })}
                style={menuInputStyle}
              />
            </div>

            <textarea
              value={menuForm.description}
              onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
              placeholder="Description"
              rows={3}
              style={{ ...menuInputStyle, width: "100%", marginTop: "14px", resize: "vertical", boxSizing: "border-box" }}
            />

            <div
              style={{
                display: "flex",
                gap: "20px",
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: "14px"
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#334155", fontWeight: "600" }}>
                <input
                  type="checkbox"
                  checked={menuForm.is_vegetarian}
                  onChange={(e) => setMenuForm({ ...menuForm, is_vegetarian: e.target.checked })}
                />
                Vegetarian
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#334155", fontWeight: "600" }}>
                <input
                  type="checkbox"
                  checked={menuForm.is_available}
                  onChange={(e) => setMenuForm({ ...menuForm, is_available: e.target.checked })}
                />
                Available
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "18px" }}>
              <button
                type="submit"
                disabled={menuSaving}
                style={{
                  padding: "11px 18px",
                  border: "none",
                  borderRadius: "9px",
                  background: "#e85d04",
                  color: "#ffffff",
                  cursor: menuSaving ? "not-allowed" : "pointer",
                  fontWeight: "700",
                  opacity: menuSaving ? 0.7 : 1
                }}
              >
                {menuSaving ? "Saving..." : editingMenuItemId ? "Update Item" : "Add Item"}
              </button>

              {editingMenuItemId && (
                <button
                  type="button"
                  onClick={resetMenuForm}
                  style={{
                    padding: "11px 18px",
                    border: "1px solid #d1d5db",
                    borderRadius: "9px",
                    background: "#ffffff",
                    color: "#334155",
                    cursor: "pointer",
                    fontWeight: "700"
                  }}
                >
                  Cancel Edit
                </button>
              )}

              {menuStatus && (
                <span style={{ color: menuStatus.toLowerCase().includes("success") || menuStatus.toLowerCase().includes("now") || menuStatus.toLowerCase().includes("removed") ? "#047857" : "#b91c1c", fontSize: "14px", fontWeight: "600" }}>
                  {menuStatus}
                </span>
              )}
            </div>
          </form>

          <div style={{ marginTop: "25px", display: "grid", gap: "12px" }}>
            {menu.length === 0 ? (
              <div style={{ padding: "20px", borderRadius: "12px", background: "#f8fafc", color: "#64748b", textAlign: "center" }}>
                No menu items yet. Add your first item above.
              </div>
            ) : (
              menu.map((item) => (
                <div
                  key={`manage-${item.item_id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "15px",
                    flexWrap: "wrap",
                    padding: "15px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    background: "#f8fafc"
                  }}
                >
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
                    {item.image_url ? (
                      <img
                        src={`${API_URL}${item.image_url}`}
                        alt={item.name}
                        style={{ width: "64px", height: "64px", objectFit: "cover", borderRadius: "10px" }}
                      />
                    ) : (
                      <div style={{ width: "64px", height: "64px", borderRadius: "10px", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "25px" }}>🍽️</div>
                    )}
                    <div>
                      <strong style={{ color: "#172033", fontSize: "16px" }}>{item.name}</strong>
                      <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
                        {item.category || "Other"} • {item.cuisine || "Other"} • ₹{Math.round(Number(item.price || 0))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleToggleMenuAvailability(item)}
                      style={{ padding: "8px 11px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", color: item.is_available ? "#b91c1c" : "#047857", cursor: "pointer", fontWeight: "700" }}
                    >
                      {item.is_available ? "Mark Unavailable" : "Mark Available"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditMenuItem(item)}
                      style={{ padding: "8px 11px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", color: "#334155", cursor: "pointer", fontWeight: "700" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMenuItem(item)}
                      disabled={menuDeletingId === item.item_id}
                      style={{ padding: "8px 11px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", cursor: menuDeletingId === item.item_id ? "not-allowed" : "pointer", fontWeight: "700", opacity: menuDeletingId === item.item_id ? 0.6 : 1 }}
                    >
                      {menuDeletingId === item.item_id ? "Removing..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* MENU */}

        <section
          id="restaurant-menu"
          style={{
            background: "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: "18px",
            padding: "25px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              marginBottom: "20px",
              gap: "15px",
              flexWrap: "wrap"
            }}
          >
            <div>
              <h2
                style={{
                  margin: "0 0 5px",
                  color: "#172033"
                }}
              >
                Your Menu
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  fontSize: "14px"
                }}
              >
                Menu items currently registered
                with FoodAI.
              </p>
            </div>

            <button
              onClick={loadRestaurantData}
              style={{
                padding: "10px 15px",
                borderRadius: "9px",
                border:
                  "1px solid #d1d5db",
                background: "#ffffff",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {menu.length === 0 ? (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                color: "#64748b"
              }}
            >
              No menu items found.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "16px"
              }}
            >
              {menu.map((item) => (
                <div
                  key={item.item_id}
                  style={{
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: "14px",
                    padding: "18px",
                    background: "#ffffff"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "flex-start",
                      gap: "12px"
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin:
                            "0 0 7px",
                          color: "#172033"
                        }}
                      >
                        {item.name}
                      </h3>

                      <div
                        style={{
                          fontSize: "13px",
                          color: "#64748b"
                        }}
                      >
                        {item.is_vegetarian
                          ? "🟢 Vegetarian"
                          : "🔴 Non-Vegetarian"}
                        {" • "}
                        ⭐ {item.rating}
                      </div>
                    </div>

                    <strong
                      style={{
                        fontSize: "18px",
                        color: "#e85d04"
                      }}
                    >
                      ₹
                      {Math.round(
                        item.price
                      )}
                    </strong>
                  </div>

                  <p
                    style={{
                      color: "#64748b",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      minHeight: "42px"
                    }}
                  >
                    {item.description}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop:
                        "1px solid #f1f5f9"
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#64748b"
                      }}
                    >
                      Popularity:{" "}
                      {item.popularity}
                    </span>

                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        padding:
                          "5px 9px",
                        borderRadius: "20px",
                        background:
                          item.is_available
                            ? "#ecfdf5"
                            : "#fff1f2",
                        color:
                          item.is_available
                            ? "#047857"
                            : "#b91c1c"
                      }}
                    >
                      {item.is_available
                        ? "Available"
                        : "Unavailable"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* AI ROADMAP */}

        <section
          style={{
            marginTop: "25px",
            background: "linear-gradient(135deg, #172033, #263449)",
            color: "#ffffff",
            borderRadius: "18px",
            padding: "25px"
          }}
        >
          <div style={{ display: "flex", gap: "15px", alignItems: "flex-start" }}>
            <div style={{ fontSize: "28px" }}>🤖</div>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: "0 0 8px" }}>FoodAI Partner Intelligence</h2>
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: "14px" }}>
                AI-generated insights based on customer behavior, restaurant performance and menu activity.
              </p>

              <div style={{ display: "grid", gap: "12px", marginTop: "15px" }}>
                {aiInsights.length === 0 ? (
                  <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", color: "#cbd5e1" }}>
                    AI insights will appear as customer behavior data becomes available.
                  </div>
                ) : (
                  aiInsights.map((insight, index) => (
                    <div key={index} style={{ padding: "18px", borderRadius: "14px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", color: "#f8fafc", lineHeight: "1.5" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "15px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "22px" }}>{insight.icon}</span>
                          <strong style={{ fontSize: "16px" }}>{insight.title}</strong>
                        </div>
                        <span style={{ padding: "5px 9px", borderRadius: "20px", background: insight.type === "warning" ? "rgba(248,113,113,0.16)" : insight.type === "opportunity" ? "rgba(251,191,36,0.16)" : insight.type === "strength" ? "rgba(52,211,153,0.16)" : "rgba(147,197,253,0.16)", color: insight.type === "warning" ? "#fecaca" : insight.type === "opportunity" ? "#fde68a" : insight.type === "strength" ? "#a7f3d0" : "#bfdbfe", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {insight.type === "strength" ? "Strength" : insight.type === "opportunity" ? "Opportunity" : insight.type === "warning" ? "Attention" : "Insight"}
                        </span>
                      </div>

                      <div style={{ marginTop: "12px", marginBottom: "12px", color: "#e2e8f0", fontSize: "14px" }}>
                        {insight.text}
                      </div>

                      <div style={{ padding: "12px", borderRadius: "9px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "13px", color: "#cbd5e1" }}>
                        <div style={{ marginBottom: "10px" }}>
                          <strong style={{ color: "#ffffff" }}>Recommended Action</strong>
                        </div>
                        <div>{insight.action}</div>
                        <button type="button" onClick={() => handleAiAction(insight)} style={{ marginTop: "12px", padding: "9px 13px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.20)", background: "rgba(255,255,255,0.10)", color: "#ffffff", cursor: "pointer", fontWeight: "700", fontSize: "12px" }}>
                          ✓ Act on this
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function RestaurantNavbar({
  restaurant,
  username,
  onLogout
}) {
  return (
    <nav
      style={{
        height: "70px",
        padding: "0 30px",
        background: "#ffffff",
        borderBottom:
          "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "20px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "15px"
        }}
      >
        <div
          style={{
            fontSize: "24px",
            fontWeight: "800",
            color: "#e85d04"
          }}
        >
          FoodAI
        </div>

        <div
          style={{
            padding:
              "6px 10px",
            borderRadius: "20px",
            background: "#fff7ed",
            color: "#c2410c",
            fontSize: "12px",
            fontWeight: "700"
          }}
        >
          RESTAURANT PARTNER
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "15px"
        }}
      >
        <div
          style={{
            textAlign: "right"
          }}
        >
          <div
            style={{
              fontWeight: "700",
              color: "#172033",
              fontSize: "14px"
            }}
          >
            {restaurant?.restaurant ||
              "Restaurant"}
          </div>

          <div
            style={{
              color: "#64748b",
              fontSize: "12px"
            }}
          >
            {username}
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            padding: "9px 14px",
            borderRadius: "8px",
            border:
              "1px solid #d1d5db",
            background: "#ffffff",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

// ============================================================
// RESTAURANT STAT
// ============================================================

function RestaurantStat({
  title,
  value,
  icon
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border:
          "1px solid #e5e7eb",
        borderRadius: "15px",
        padding: "20px"
      }}
    >
      <div
        style={{
          fontSize: "24px",
          marginBottom: "10px"
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "800",
          color: "#172033"
        }}
      >
        {value}
      </div>

      <div
        style={{
          color: "#64748b",
          fontSize: "13px",
          marginTop: "4px"
        }}
      >
        {title}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

function App() {
  const [authData, setAuthData] =
    useState(() => {
      try {
        const saved =
          localStorage.getItem(
            "foodai_auth"
          );

        return saved
          ? JSON.parse(saved)
          : null;
      } catch {
        return null;
      }
    });

  const [authChecking, setAuthChecking] =
    useState(true);

  const [customerName, setCustomerName] =
    useState("Customer");

  const [customerProfile, setCustomerProfile] =
    useState(null);

  const [recommendations, setRecommendations] =
    useState([]);

  const [
    recommendationsLoading,
    setRecommendationsLoading
  ] = useState(true);

  const [searchText, setSearchText] =
    useState("");

  const [searchStatus, setSearchStatus] =
    useState("");

  const [searchResults, setSearchResults] =
    useState([]);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [showSearchResults, setShowSearchResults] =
    useState(false);

  const [showOrderHistory, setShowOrderHistory] =
    useState(false);

  const [orders, setOrders] =
    useState([]);

  const [ordersLoading, setOrdersLoading] =
    useState(false);

  const [ordersError, setOrdersError] =
    useState("");

  const [selectedRestaurant, setSelectedRestaurant] =
    useState(null);

  const [restaurantLoading, setRestaurantLoading] =
    useState(false);

  const [restaurantError, setRestaurantError] =
    useState("");

  const [cartItem, setCartItem] =
    useState(null);

  const [orderStatus, setOrderStatus] =
    useState("");

  const [aiOffer, setAiOffer] =
    useState(null);

  const [appliedCoupon, setAppliedCoupon] =
    useState(null);

  const [appliedDiscount, setAppliedDiscount] =
    useState(0);

  const [appliedGrandTotal, setAppliedGrandTotal] =
    useState(null);

  const [couponStatus, setCouponStatus] =
    useState("");

  const [couponApplying, setCouponApplying] =
    useState(false);

  const [offerLoading, setOfferLoading] =
    useState(true);

  const [profileLoading, setProfileLoading] =
    useState(true);

  const [allRestaurants, setAllRestaurants] =
    useState([]);

  const [customerAddresses, setCustomerAddresses] =
    useState([]);

  const [selectedDeliveryAddressId, setSelectedDeliveryAddressId] =
    useState(null);

  const [addressLoading, setAddressLoading] =
    useState(false);

  const [addressSaving, setAddressSaving] =
    useState(false);

  const [addressStatus, setAddressStatus] =
    useState("");

  const [showAddressForm, setShowAddressForm] =
    useState(false);

  const [editingAddressId, setEditingAddressId] =
    useState(null);

  const [addressForm, setAddressForm] =
    useState({
      label: "Home",
      address: "",
      landmark: "",
      latitude: 21.1458,
      longitude: 79.0882,
      is_default: false
    });

  const token =
    authData?.access_token || null;

  const customerId =
    authData?.customer_id || null;

  const defaultCustomerAddress =
    customerAddresses.find(
      (address) => Boolean(address.is_default)
    ) || customerAddresses[0] || null;

  const nearbyRestaurants = [...allRestaurants]
    .map((restaurant) => {
      const distance = getDistanceKm(
        defaultCustomerAddress?.latitude,
        defaultCustomerAddress?.longitude,
        restaurant?.latitude,
        restaurant?.longitude
      );

      return { ...restaurant, distanceKm: distance, deliveryEta: getDeliveryEta(distance) };
    })
    .filter((restaurant) => restaurant.distanceKm !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearbyMapCenter = defaultCustomerAddress
    ? [
        Number(defaultCustomerAddress.latitude),
        Number(defaultCustomerAddress.longitude)
      ]
    : [21.1458, 79.0882];

  const nearbyMapZoom = defaultCustomerAddress ? 12 : 11;

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: customerAddresses.length ? "Other" : "Home",
      address: "",
      landmark: "",
      latitude: 21.1458,
      longitude: 79.0882,
      is_default: customerAddresses.length === 0
    });
  };

  const loadCustomerAddresses = async () => {
    if (!token || !customerId || authData?.role !== "customer") {
      return;
    }

    setAddressLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/customer/me/addresses`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load addresses."
        );
      }

      setCustomerAddresses(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error("Address loading error:", error);
      setAddressStatus(
        error.message || "Unable to load addresses."
      );
    } finally {
      setAddressLoading(false);
    }
  };

  const openNewAddressForm = () => {
    setAddressStatus("");
    resetAddressForm();
    setShowAddressForm(true);
  };

  const openEditAddressForm = (address) => {
    setAddressStatus("");
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label || "Other",
      address: address.address || "",
      landmark: address.landmark || "",
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
      is_default: Boolean(address.is_default)
    });
    setShowAddressForm(true);
  };

  const handleSaveCustomerAddress = async (event) => {
    event.preventDefault();

    const latitude = Number(addressForm.latitude);
    const longitude = Number(addressForm.longitude);

    if (!addressForm.address.trim()) {
      setAddressStatus("Please enter the address.");
      return;
    }

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      (latitude === 0 && longitude === 0)
    ) {
      setAddressStatus(
        "Please select a valid location on the map."
      );
      return;
    }

    setAddressSaving(true);
    setAddressStatus("");

    try {
      const isEditing = Boolean(editingAddressId);
      const url = isEditing
        ? `${API_URL}/customer/me/addresses/${editingAddressId}`
        : `${API_URL}/customer/me/addresses`;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          label: addressForm.label.trim() || "Other",
          address: addressForm.address.trim(),
          landmark: addressForm.landmark.trim() || null,
          latitude,
          longitude,
          is_default: Boolean(addressForm.is_default)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to save address."
        );
      }

      setAddressStatus(
        data.message || "Address saved successfully."
      );
      setShowAddressForm(false);
      setEditingAddressId(null);
      await loadCustomerAddresses();
    } catch (error) {
      console.error("Address save error:", error);
      setAddressStatus(
        error.message || "Unable to save address."
      );
    } finally {
      setAddressSaving(false);
    }
  };

  const handleSetDefaultAddress = async (addressId) => {
    setAddressStatus("");

    try {
      const response = await fetch(
        `${API_URL}/customer/me/addresses/${addressId}/default`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to set default address."
        );
      }

      setAddressStatus(
        data.message || "Default address updated."
      );
      await loadCustomerAddresses();
    } catch (error) {
      console.error("Default address error:", error);
      setAddressStatus(
        error.message || "Unable to set default address."
      );
    }
  };

  const handleDeleteCustomerAddress = async (addressId) => {
    if (!window.confirm("Delete this saved address?")) {
      return;
    }

    setAddressStatus("");

    try {
      const response = await fetch(
        `${API_URL}/customer/me/addresses/${addressId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to delete address."
        );
      }

      setAddressStatus(
        data.message || "Address deleted successfully."
      );
      await loadCustomerAddresses();
    } catch (error) {
      console.error("Address delete error:", error);
      setAddressStatus(
        error.message || "Unable to delete address."
      );
    }
  };

  // ==========================================================
  // VERIFY AUTHENTICATION
  // ==========================================================

  useEffect(() => {
    async function verifyAuthentication() {
      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/auth/me`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(
            "Authentication expired."
          );
        }

        const profile =
          await response.json();

        const updatedAuth = {
          ...authData,
          user_id: profile.user_id,
          username: profile.username,
          role: profile.role,
          customer_id:
            profile.customer_id,
          restaurant_id:
            profile.restaurant_id
        };

        setAuthData(updatedAuth);

        localStorage.setItem(
          "foodai_auth",
          JSON.stringify(updatedAuth)
        );
      } catch (error) {
        console.error(
          "Authentication verification failed:",
          error
        );

        localStorage.removeItem(
          "foodai_auth"
        );

        setAuthData(null);
      } finally {
        setAuthChecking(false);
      }
    }

    verifyAuthentication();
  }, []);

  // ==========================================================
  // LOGIN
  // ==========================================================

  const handleLogin = (loginData) => {
    localStorage.setItem(
      "foodai_auth",
      JSON.stringify(loginData)
    );

    setAuthData(loginData);
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    localStorage.removeItem(
      "foodai_auth"
    );

    setAuthData(null);

    setCustomerProfile(null);
    setRecommendations([]);
    setAiOffer(null);
    setAppliedCoupon(null);
    setAppliedDiscount(0);
    setAppliedGrandTotal(null);
    setCouponStatus("");
    setCartItem(null);
    setOrderStatus("");
    setSearchStatus("");
    setSearchResults([]);
    setSelectedRestaurant(null);
    setSelectedDeliveryAddressId(null);
    setCustomerAddresses([]);
  };

  // ==========================================================
  // LOAD CUSTOMER AI DATA
  // ==========================================================

  useEffect(() => {
    if (
      !token ||
      !customerId ||
      authData?.role !== "customer"
    ) {
      return;
    }

    async function loadCustomerData() {
      try {
        setProfileLoading(true);
        setRecommendationsLoading(true);

        const authHeaders = {
          Authorization:
            `Bearer ${token}`
        };

        const [
          profileResponse,
          recommendationsResponse
        ] = await Promise.all([
          fetch(
            `${API_URL}/customer/${customerId}`,
            {
              headers: authHeaders
            }
          ),

          fetch(
            `${API_URL}/recommendations/${customerId}`,
            {
              headers: authHeaders
            }
          )
        ]);

        if (profileResponse.ok) {
          const profile =
            await profileResponse.json();

          setCustomerProfile(profile);

          setCustomerName(
            profile.name ||
              authData.username ||
              "Customer"
          );
        }

        if (
          recommendationsResponse.ok
        ) {
          const data =
            await recommendationsResponse.json();

          setRecommendations(
            data.recommendations ||
              []
          );
        }
      } catch (error) {
        console.error(
          "Customer AI loading error:",
          error
        );

        setCustomerProfile(null);
        setAiOffer(null);
        setRecommendations([]);
      } finally {
        setProfileLoading(false);
        setRecommendationsLoading(false);
      }
    }

    loadCustomerData();

    setCartItem(null);
    setAppliedCoupon(null);
    setCouponStatus("");
    setOrderStatus("");
    setSearchStatus("");
  }, [
    token,
    customerId,
    authData?.role
  ]);

  // ==========================================================
  // LOAD CUSTOMER ADDRESSES
  // ==========================================================

  useEffect(() => {
    if (!token || !customerId || authData?.role !== "customer") {
      return;
    }

    loadCustomerAddresses();
  }, [token, customerId, authData?.role]);

  // Keep the checkout address synchronized with saved addresses.
  useEffect(() => {
    if (customerAddresses.length === 0) {
      setSelectedDeliveryAddressId(null);
      return;
    }

    const currentSelectionExists = customerAddresses.some(
      (address) => Number(address.id) === Number(selectedDeliveryAddressId)
    );

    if (currentSelectionExists) {
      return;
    }

    const defaultAddress =
      customerAddresses.find((address) => Boolean(address.is_default)) ||
      customerAddresses[0];

    setSelectedDeliveryAddressId(defaultAddress.id);
  }, [customerAddresses, selectedDeliveryAddressId]);

  // ==========================================================
  // LOAD MY ORDERS
  // ==========================================================

  useEffect(() => {
    if (
      !showOrderHistory ||
      !token ||
      authData?.role !== "customer"
    ) {
      return;
    }

    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError("");

      try {
        const response = await fetch(
          `${API_URL}/orders`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(
            data?.detail || "Unable to load your orders."
          );
        }

        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Order history loading error:", error);
        setOrdersError(
          error?.message || "Unable to load your orders."
        );
      } finally {
        setOrdersLoading(false);
      }
    }

    loadOrders();
  }, [showOrderHistory, token, authData?.role]);

  const handleCancelCustomerOrder = async (orderId) => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this order?"
    );

    if (!confirmed) {
      return;
    }

    setOrdersError("");

    try {
      const response = await fetch(
        `${API_URL}/orders/${orderId}/cancel`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.detail || "Unable to cancel this order."
        );
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.order_id === orderId
            ? {
                ...order,
                status: data.status || "cancelled"
              }
            : order
        )
      );
    } catch (error) {
      console.error("Order cancellation error:", error);
      setOrdersError(
        error?.message || "Unable to cancel this order."
      );
    }
  };

  const handleRefreshCustomerOrders = async () => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const response = await fetch(
        `${API_URL}/orders`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(
          data?.detail || "Unable to refresh your orders."
        );
      }

      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Order refresh error:", error);
      setOrdersError(
        error?.message || "Unable to refresh your orders."
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  // ==========================================================
  // LOAD RESTAURANTS
  // ==========================================================

  useEffect(() => {
    if (
      !token ||
      authData?.role !== "customer"
    ) {
      return;
    }

    async function loadRestaurants() {
      try {
        const response =
          await fetch(
            `${API_URL}/restaurants`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        setAllRestaurants(
          Array.isArray(data)
            ? data
            : data.restaurants ||
              []
        );
      } catch (error) {
        console.error(
          "Restaurant loading error:",
          error
        );
      }
    }

    loadRestaurants();
  }, [
    token,
    authData?.role
  ]);

  // ==========================================================
  // LOAD RESTAURANT-SPECIFIC AI OFFER
  // ==========================================================

  useEffect(() => {
    if (
      !token ||
      !customerId ||
      authData?.role !== "customer"
    ) {
      return;
    }

    async function loadPersonalizedOffer() {
      setOfferLoading(true);

      try {
        const params = new URLSearchParams();

        const restaurantId =
          selectedRestaurant?.restaurant_id ??
          null;

        const cartOrderValue =
          cartItem
            ? getCartCharges(cartItem).subtotal
            : 0;

        if (restaurantId) {
          params.append(
            "restaurant_id",
            String(restaurantId)
          );
        }

        if (cartOrderValue > 0) {
          params.append(
            "order_value",
            String(cartOrderValue)
          );
        }

        const query = params.toString();

        const response = await fetch(
          `${API_URL}/offers/${customerId}${
            query ? `?${query}` : ""
          }`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Unable to load personalized offer."
          );
        }

        setAiOffer(data);
      } catch (error) {
        console.error(
          "Personalized offer loading error:",
          error
        );
        setAiOffer(null);
      } finally {
        setOfferLoading(false);
      }
    }

    loadPersonalizedOffer();
  }, [
    token,
    customerId,
    authData?.role,
    selectedRestaurant?.restaurant_id,
    cartItem
  ]);

  // ==========================================================
  // SEARCH
  // ==========================================================

  const handleSearch = async () => {
    const query =
      searchText.trim();

    if (!query || !customerId) {
      return;
    }

    setSearchLoading(true);
    setSearchStatus("");
    setShowSearchResults(true);
    setSelectedRestaurant(null);

    await trackBehavior({
      customerId,
      action: "search",
      item: query,
      token
    });

    try {
      let restaurants =
        allRestaurants;

      if (!restaurants.length) {
        const response =
          await fetch(
            `${API_URL}/restaurants`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        if (response.ok) {
          const data =
            await response.json();

          restaurants =
            Array.isArray(data)
              ? data
              : data.restaurants ||
                [];

          setAllRestaurants(
            restaurants
          );
        }
      }

      const normalizedQuery =
        query.toLowerCase();

      const directMatches =
        restaurants.filter(
          (restaurant) =>
            String(
              restaurant.name ||
                restaurant.restaurant ||
                ""
            )
              .toLowerCase()
              .includes(
                normalizedQuery
              ) ||
            String(
              restaurant.cuisine ||
                ""
            )
              .toLowerCase()
              .includes(
                normalizedQuery
              )
        );

      const details =
        await Promise.all(
          restaurants.map(
            async (restaurant) => {
              try {
                const id =
                  restaurant.id ??
                  restaurant.restaurant_id;

                const response =
                  await fetch(
                    `${API_URL}/restaurants/${id}`,
                    {
                      headers: {
                        Authorization:
                          `Bearer ${token}`
                      }
                    }
                  );

                if (!response.ok) {
                  return null;
                }

                return await response.json();
              } catch {
                return null;
              }
            }
          )
        );

      const menuMatches = [];

      details.forEach(
        (restaurant) => {
          if (!restaurant) return;

          const matchingItems =
            (
              restaurant.menu ||
              []
            ).filter(
              (item) =>
                String(
                  item.name || ""
                )
                  .toLowerCase()
                  .includes(
                    normalizedQuery
                  ) ||
                String(
                  item.cuisine || ""
                )
                  .toLowerCase()
                  .includes(
                    normalizedQuery
                  )
            );

          if (
            matchingItems.length
          ) {
            menuMatches.push({
              ...restaurant,
              matchingItems
            });
          }
        }
      );

      const resultMap =
        new Map();

      directMatches.forEach(
        (restaurant) => {
          const id =
            restaurant.id ??
            restaurant.restaurant_id;

          resultMap.set(id, {
            ...restaurant,
            matchingItems: []
          });
        }
      );

      menuMatches.forEach(
        (restaurant) => {
          const id =
            restaurant.restaurant_id;

          const existing =
            resultMap.get(id);

          if (existing) {
            resultMap.set(id, {
              ...existing,
              ...restaurant
            });
          } else {
            resultMap.set(
              id,
              restaurant
            );
          }
        }
      );

      const results =
        Array.from(
          resultMap.values()
        );

      setSearchResults(
        results
      );

      setSearchStatus(
        results.length
          ? `${results.length} restaurant${
              results.length === 1
                ? ""
                : "s"
            } found for "${query}".`
          : `No restaurants found for "${query}".`
      );
    } catch (error) {
      console.error(
        "Search error:",
        error
      );

      setSearchResults([]);

      setSearchStatus(
        "Unable to search restaurants right now."
      );
    } finally {
      setSearchLoading(false);
    }
  };

  // ==========================================================
  // CUISINE CLICK
  // ==========================================================

  const handleCuisineClick =
    async (cuisine) => {
      if (!customerId) return;

      await trackBehavior({
        customerId,
        action: "cuisine_view",
        cuisine,
        item: cuisine,
        token
      });

      setSearchText(cuisine);
      setShowSearchResults(true);
      setSelectedRestaurant(null);
      setSearchLoading(true);

      try {
        const matching =
          allRestaurants.filter(
            (restaurant) =>
              String(
                restaurant.cuisine ||
                  ""
              ).toLowerCase() ===
              cuisine.toLowerCase()
          );

        const detailed =
          await Promise.all(
            matching.map(
              async (restaurant) => {
                try {
                  const id =
                    restaurant.id ??
                    restaurant.restaurant_id;

                  const response =
                    await fetch(
                      `${API_URL}/restaurants/${id}`,
                      {
                        headers: {
                          Authorization:
                            `Bearer ${token}`
                        }
                      }
                    );

                  if (!response.ok) {
                    return restaurant;
                  }

                  return await response.json();
                } catch {
                  return restaurant;
                }
              }
            )
          );

        setSearchResults(
          detailed
        );

        setSearchStatus(
          `Showing ${cuisine} restaurants...`
        );
      } catch (error) {
        console.error(
          "Cuisine loading error:",
          error
        );

        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

  // ==========================================================
  // OPEN RESTAURANT
  // ==========================================================

  const handleRestaurantClick =
    async (
      restaurant,
      cuisine,
      restaurantId
    ) => {
      const id =
        restaurantId ??
        restaurant?.id ??
        restaurant?.restaurant_id;

      if (!id) return;

      setRestaurantLoading(true);
      setRestaurantError("");
      setSelectedRestaurant(null);
      setShowSearchResults(false);

      try {
        const response =
          await fetch(
            `${API_URL}/restaurants/${id}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`
              }
            }
          );

        if (!response.ok) {
          throw new Error(
            "Restaurant request failed."
          );
        }

        const data =
          await response.json();

        setSelectedRestaurant(
          data
        );

        await trackBehavior({
          customerId,
          action: "restaurant_view",
          restaurant:
            data.name ||
            restaurant ||
            "",
          cuisine:
            data.cuisine ||
            cuisine ||
            "",
          item:
            data.name ||
            restaurant ||
            "",
          token
        });
      } catch (error) {
        console.error(
          "Restaurant loading error:",
          error
        );

        setRestaurantError(
          "Unable to load this restaurant."
        );
      } finally {
        setRestaurantLoading(false);
      }
    };

  // ==========================================================
  // BACK HOME
  // ==========================================================

  const handleBackHome = () => {
    setSelectedRestaurant(null);
    setShowSearchResults(false);
    setShowOrderHistory(false);
    setSearchResults([]);
    setSearchStatus("");
    setRestaurantError("");
  };

  // ==========================================================
  // CART HELPERS
  // ==========================================================

  const RESTAURANT_CHARGE = 20;
  const BASE_DELIVERY_CHARGE = 30;
  const PLATFORM_FEE = 5;

  const getDistanceBasedDeliveryCharge = (distanceKm) => {
    if (!Number.isFinite(distanceKm)) {
      return BASE_DELIVERY_CHARGE;
    }

    if (distanceKm <= 3) return 30;
    if (distanceKm <= 6) return 40;
    if (distanceKm <= 10) return 55;
    return 70;
  };

  const getCartItemTotal = (cart) => {
    if (!cart) return 0;

    if (Array.isArray(cart.items)) {
      return cart.items.reduce(
        (total, line) =>
          total +
          Number(line.price || 0) *
          Number(line.quantity || 1),
        0
      );
    }

    return Number(cart.price || 0);
  };

  const getCartCharges = (cart) => {
    const itemTotal = getCartItemTotal(cart);
    const restaurantCharge = itemTotal > 0
      ? RESTAURANT_CHARGE
      : 0;
    let deliveryDistanceKm = null;

    const selectedDeliveryAddress =
      customerAddresses.find(
        (address) =>
          Number(address.id) ===
          Number(selectedDeliveryAddressId)
      ) ||
      defaultCustomerAddress ||
      null;

    const matchingRestaurant =
      allRestaurants.find((restaurant) =>
        Number(restaurant.id ?? restaurant.restaurant_id) ===
          Number(cart?.restaurant_id)
      ) ||
      allRestaurants.find((restaurant) =>
        String(restaurant.name || "").trim().toLowerCase() ===
          String(cart?.restaurant || "").trim().toLowerCase() &&
        String(restaurant.cuisine || "").trim().toLowerCase() ===
          String(cart?.cuisine || "").trim().toLowerCase()
      ) ||
      null;

    const restaurantLatitude =
      Number.isFinite(Number(cart?.restaurant_latitude))
        ? Number(cart.restaurant_latitude)
        : Number(matchingRestaurant?.latitude);

    const restaurantLongitude =
      Number.isFinite(Number(cart?.restaurant_longitude))
        ? Number(cart.restaurant_longitude)
        : Number(matchingRestaurant?.longitude);

    if (
      selectedDeliveryAddress &&
      Number.isFinite(restaurantLatitude) &&
      Number.isFinite(restaurantLongitude)
    ) {
      deliveryDistanceKm = getDistanceKm(
        selectedDeliveryAddress.latitude,
        selectedDeliveryAddress.longitude,
        restaurantLatitude,
        restaurantLongitude
      );
    }

    const deliveryCharge = itemTotal > 0
      ? getDistanceBasedDeliveryCharge(deliveryDistanceKm)
      : 0;
    const platformFee = itemTotal > 0
      ? PLATFORM_FEE
      : 0;
    const subtotal =
      itemTotal +
      restaurantCharge +
      deliveryCharge +
      platformFee;

    // The coupon discount is stored as its own numeric state.
    // This keeps the bill independent from the coupon API object.
    const couponDiscount = Number(appliedDiscount) || 0;

    const discount = appliedCoupon
      ? Math.min(
          Math.max(couponDiscount, 0),
          subtotal
        )
      : 0;

    const calculatedGrandTotal = Math.max(
      subtotal - discount,
      0
    );

    const grandTotal =
      appliedCoupon &&
      Number.isFinite(Number(appliedGrandTotal))
        ? Number(appliedGrandTotal)
        : calculatedGrandTotal;

    return {
      itemTotal,
      restaurantCharge,
      deliveryCharge,
      deliveryDistanceKm,
      platformFee,
      subtotal,
      discount,
      grandTotal
    };
  };

  // ==========================================================
  // ADD TO CART
  // ==========================================================

  const handleAddToCart =
    async (
      restaurant,
      cuisine,
      item,
      price
    ) => {
      if (!customerId) return;

      const currentRestaurant =
        cartItem?.restaurant || "";

      if (
        currentRestaurant &&
        currentRestaurant !== restaurant
      ) {
        setSearchStatus(
          `Your cart already contains items from ${currentRestaurant}. Please place that order before adding items from another restaurant.`
        );
        return;
      }

      const tracked =
        await trackBehavior({
          customerId,
          action: "cart",
          restaurant,
          cuisine,
          item,
          order_value: price,
          token
        });

      if (tracked) {
        setCartItem((previousCart) => {
          if (!previousCart) {
            return {
              restaurant,
              cuisine,
              restaurant_id:
                Number(
                  allRestaurants.find((r) =>
                    String(r.name || "").trim().toLowerCase() ===
                      String(restaurant || "").trim().toLowerCase() &&
                    String(r.cuisine || "").trim().toLowerCase() ===
                      String(cuisine || "").trim().toLowerCase()
                  )?.id
                ) || null,
              restaurant_latitude:
                allRestaurants.find((r) =>
                  String(r.name || "").trim().toLowerCase() ===
                    String(restaurant || "").trim().toLowerCase() &&
                  String(r.cuisine || "").trim().toLowerCase() ===
                    String(cuisine || "").trim().toLowerCase()
                )?.latitude ?? null,
              restaurant_longitude:
                allRestaurants.find((r) =>
                  String(r.name || "").trim().toLowerCase() ===
                    String(restaurant || "").trim().toLowerCase() &&
                  String(r.cuisine || "").trim().toLowerCase() ===
                    String(cuisine || "").trim().toLowerCase()
                )?.longitude ?? null,
              items: [
                {
                  item,
                  price: Number(price || 0),
                  quantity: 1
                }
              ],
              item: item,
              price: Number(price || 0)
            };
          }

          const existingItems =
            Array.isArray(previousCart.items)
              ? previousCart.items
              : [{
                  item: previousCart.item,
                  price: Number(previousCart.price || 0),
                  quantity: 1
                }];

          const existingIndex =
            existingItems.findIndex(
              (line) => line.item === item
            );

          let updatedItems;

          if (existingIndex >= 0) {
            updatedItems = existingItems.map(
              (line, index) =>
                index === existingIndex
                  ? {
                      ...line,
                      quantity:
                        Number(line.quantity || 1) + 1
                    }
                  : line
            );
          } else {
            updatedItems = [
              ...existingItems,
              {
                item,
                price: Number(price || 0),
                quantity: 1
              }
            ];
          }

          const updatedTotal =
            updatedItems.reduce(
              (total, line) =>
                total +
                Number(line.price || 0) *
                Number(line.quantity || 1),
              0
            );

          return {
            ...previousCart,
            items: updatedItems,
            item: item,
            price: updatedTotal
          };
        });

        setAppliedCoupon(null);
        setAppliedDiscount(0);
        setAppliedGrandTotal(null);
        setCouponStatus("");

        setSearchStatus(
          `${item} added to your cart.`
        );
      }
    };

  const handleChangeQuantity =
    (itemName, change) => {
      setCartItem((previousCart) => {
        if (!previousCart) return previousCart;

        const existingItems =
          Array.isArray(previousCart.items)
            ? previousCart.items
            : [{
                item: previousCart.item,
                price: Number(previousCart.price || 0),
                quantity: 1
              }];

        const updatedItems = existingItems
          .map((line) =>
            line.item === itemName
              ? {
                  ...line,
                  quantity:
                    Number(line.quantity || 1) + change
                }
              : line
          )
          .filter(
            (line) =>
              Number(line.quantity || 0) > 0
          );

        if (updatedItems.length === 0) {
          return null;
        }

        const updatedTotal =
          updatedItems.reduce(
            (total, line) =>
              total +
              Number(line.price || 0) *
              Number(line.quantity || 1),
            0
          );

        return {
          ...previousCart,
          items: updatedItems,
          item: updatedItems[0].item,
          price: updatedTotal
        };
      });

      setAppliedCoupon(null);
      setAppliedDiscount(0);
      setAppliedGrandTotal(null);
      setCouponStatus("");
    };

  // ==========================================================
  // COUPON + PLACE ORDER
  // ==========================================================

  const handleApplyCoupon =
    async () => {
      if (!cartItem || !customerId || !aiOffer?.coupon?.code) {
        return;
      }

      const { subtotal } =
        getCartCharges(cartItem);

      setCouponApplying(true);
      setCouponStatus("");

      // Apply the displayed AI coupon to the cart immediately.
      // The backend call below then records the application.
      const displayedDiscount = Number(
        aiOffer.coupon.discount_amount || 0
      );

      if (!Number.isFinite(displayedDiscount) || displayedDiscount <= 0) {
        setCouponApplying(false);
        setCouponStatus("This coupon does not contain a valid discount.");
        return;
      }

      setAppliedCoupon({
        coupon_code: aiOffer.coupon.code,
        discount_amount: displayedDiscount,
        min_order_value: Number(
          aiOffer.coupon.min_order_value || 0
        ),
        status: "applying"
      });
      setAppliedDiscount(displayedDiscount);

      try {
        const response = await fetch(
          `${API_URL}/coupons/apply?customer_id=${encodeURIComponent(customerId)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              coupon_code: aiOffer.coupon.code,
              order_value: subtotal
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Unable to apply coupon."
          );
        }

        const discountAmount = Number(
          data.discount_amount ?? aiOffer.coupon.discount_amount ?? 0
        );

        if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
          throw new Error(
            "Coupon was accepted but no valid discount amount was returned."
          );
        }

        // Store a clean, local coupon object and numeric discount.
        // The cart total updates immediately from these two states.
        setAppliedCoupon({
          coupon_id: data.coupon_id,
          coupon_code:
            data.coupon_code || aiOffer.coupon.code,
          discount_amount: discountAmount,
          min_order_value:
            Number(
              data.min_order_value ??
              aiOffer.coupon.min_order_value ??
              0
            ),
          status: data.status || "applied"
        });

        // Prefer the backend-calculated final total.
        // If an older running backend does not yet return final_order_value,
        // keep the accepted coupon applied and derive the same total locally
        // instead of throwing and resetting the coupon state.
        const backendFinalTotal = Number(
          data.final_order_value
        );

        const finalTotal =
          Number.isFinite(backendFinalTotal) &&
          backendFinalTotal >= 0
            ? backendFinalTotal
            : Math.max(
                subtotal - discountAmount,
                0
              );

        setAppliedDiscount(
          Math.max(subtotal - finalTotal, 0)
        );
        setAppliedGrandTotal(finalTotal);

        setCouponStatus(
          `Coupon ${data.coupon_code || aiOffer.coupon.code} applied successfully.`
        );
      } catch (error) {
        console.error("Coupon application error:", error);
        setAppliedCoupon(null);
        setAppliedDiscount(0);
        setAppliedGrandTotal(null);
        setCouponStatus(
          typeof error?.message === "string"
            ? error.message
            : "Unable to apply coupon."
        );
      } finally {
        setCouponApplying(false);
      }
    };

  const handlePlaceOrder =
    async () => {
      if (!cartItem || !customerId) return;

      const selectedDeliveryAddress =
        customerAddresses.find(
          (address) =>
            Number(address.id) ===
            Number(selectedDeliveryAddressId)
        ) || null;

      if (!selectedDeliveryAddress) {
        setOrderStatus(
          "Please select a delivery address before placing the order."
        );
        return;
      }

      const charges =
        getCartCharges(cartItem);

      const originalPrice =
        charges.subtotal;
      const discount =
        charges.discount;
      const finalPrice =
        charges.grandTotal;

      const cartLines =
        Array.isArray(cartItem.items)
          ? cartItem.items
          : [{
              item: cartItem.item,
              price: Number(cartItem.price || 0),
              quantity: 1
            }];

      // Resolve the restaurant ID from the current cart restaurant.
      // The backend uses the ID for ownership and persistent order records.
      let restaurantId =
        Number(cartItem.restaurant_id) ||
        Number(selectedRestaurant?.id) ||
        Number(selectedRestaurant?.restaurant_id) ||
        null;

      if (!restaurantId) {
        const matchingRestaurant =
          allRestaurants.find(
            (restaurant) =>
              String(restaurant.name || "").trim().toLowerCase() ===
                String(cartItem.restaurant || "").trim().toLowerCase() &&
              String(restaurant.cuisine || "").trim().toLowerCase() ===
                String(cartItem.cuisine || "").trim().toLowerCase()
          );

        restaurantId =
          Number(
            matchingRestaurant?.id ??
            matchingRestaurant?.restaurant_id
          ) || null;
      }

      // If the restaurant list was not loaded, fetch it once and resolve
      // the ID before creating the persistent order.
      if (!restaurantId) {
        try {
          const restaurantResponse =
            await fetch(
              `${API_URL}/restaurants`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            );

          if (restaurantResponse.ok) {
            const restaurantData =
              await restaurantResponse.json();

            const restaurantList =
              Array.isArray(restaurantData)
                ? restaurantData
                : restaurantData.restaurants || [];

            const matchingRestaurant =
              restaurantList.find(
                (restaurant) =>
                  String(restaurant.name || "").trim().toLowerCase() ===
                    String(cartItem.restaurant || "").trim().toLowerCase() &&
                  String(restaurant.cuisine || "").trim().toLowerCase() ===
                    String(cartItem.cuisine || "").trim().toLowerCase()
              );

            restaurantId =
              Number(
                matchingRestaurant?.id ??
                matchingRestaurant?.restaurant_id
              ) || null;
          }
        } catch (error) {
          console.error(
            "Restaurant lookup before order failed:",
            error
          );
        }
      }

      if (!restaurantId) {
        setOrderStatus(
          "Unable to identify this restaurant. Please reopen the restaurant and try again."
        );
        return;
      }

      setOrderStatus("Placing your order...");

      // Step 1: create the real persistent order first.
      // This is now the source of truth for a successful order.
      let createdOrder = null;

      try {
        const orderResponse =
          await fetch(
            `${API_URL}/orders`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                restaurant_id: restaurantId,
                restaurant: cartItem.restaurant,
                cuisine: cartItem.cuisine,
                selected_address_id: Number(
                  selectedDeliveryAddress.id
                ),
                items: cartLines.map(
                  (line) => ({
                    item: line.item,
                    price: Number(line.price || 0),
                    quantity: Number(line.quantity || 1)
                  })
                ),
                item_total: Number(charges.itemTotal),
                subtotal: Number(charges.subtotal),
                discount: Number(discount),
                grand_total: Number(finalPrice),
                coupon_code:
                  appliedCoupon?.coupon_code || null
              })
            }
          );

        const orderData =
          await orderResponse.json();

        if (!orderResponse.ok) {
          throw new Error(
            orderData.detail ||
            "Unable to create the order."
          );
        }

        createdOrder =
          orderData.order || null;

        if (!createdOrder?.order_id) {
          throw new Error(
            "The order was not created correctly."
          );
        }
      } catch (error) {
        console.error(
          "Order creation error:",
          error
        );
        setOrderStatus(
          error?.message ||
          "Unable to place the order. Please try again."
        );
        return;
      }

      // Step 2: preserve the existing AI feedback loop.
      // Behavior tracking no longer blocks the already-created order.
      const itemTotal =
        charges.itemTotal;

      for (const line of cartLines) {
        const lineTotal =
          Number(line.price || 0) *
          Number(line.quantity || 1);

        const lineShare =
          itemTotal > 0
            ? lineTotal / itemTotal
            : 0;

        const lineOrderValue =
          finalPrice * lineShare;

        const tracked = await trackBehavior({
          customerId,
          action: "order",
          restaurant: cartItem.restaurant,
          cuisine: cartItem.cuisine,
          item: line.item,
          order_value: lineOrderValue,
          token
        });

        if (!tracked) {
          console.warn(
            "Order behavior tracking failed for:",
            line.item
          );
        }
      }

      // Step 3: preserve coupon redemption.
      if (appliedCoupon?.coupon_code) {
        try {
          const redeemResponse = await fetch(
            `${API_URL}/coupons/redeem`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                coupon_code: appliedCoupon.coupon_code,
                order_value: originalPrice,
                order_item: cartLines
                  .map(
                    (line) =>
                      `${line.item} x${line.quantity}`
                  )
                  .join(", "),
                restaurant: cartItem.restaurant,
                cuisine: cartItem.cuisine
              })
            }
          );

          if (!redeemResponse.ok) {
            console.error(
              "Coupon redemption failed:",
              await redeemResponse.text()
            );
          }
        } catch (error) {
          console.error(
            "Coupon redemption error:",
            error
          );
        }
      }

      const itemCount =
        cartLines.reduce(
          (total, line) =>
            total + Number(line.quantity || 1),
          0
        );

      setOrderStatus(
        appliedCoupon?.coupon_code
          ? `Order #${createdOrder.order_id} placed successfully for ${itemCount} item${itemCount === 1 ? "" : "s"}! ₹${discount} coupon discount applied.`
          : `Order #${createdOrder.order_id} placed successfully for ${itemCount} item${itemCount === 1 ? "" : "s"}!`
      );

      setSearchStatus("");
      setCartItem(null);
      setAppliedCoupon(null);
      setAppliedDiscount(0);
      setAppliedGrandTotal(null);
      setCouponStatus("");

      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };

        const refresh = await fetch(
          `${API_URL}/ai/refresh-profile/${customerId}`,
          { method: "POST", headers }
        );

        if (!refresh.ok) {
          throw new Error("AI profile refresh failed.");
        }

        const [profileResponse, offerResponse, recommendationsResponse] =
          await Promise.all([
            fetch(`${API_URL}/customer/${customerId}`, { headers }),
            fetch(`${API_URL}/offers/${customerId}`, { headers }),
            fetch(`${API_URL}/recommendations/${customerId}`, { headers })
          ]);

        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          setCustomerProfile(profile);
          setCustomerName(
            profile.name || authData.username || "Customer"
          );
        }

        if (offerResponse.ok) {
          setAiOffer(await offerResponse.json());
        }

        if (recommendationsResponse.ok) {
          const data = await recommendationsResponse.json();
          setRecommendations(data.recommendations || []);
        }
      } catch (error) {
        console.error("AI refresh error:", error);
      }
    };

  // ==========================================================
  // HELPERS
  // ==========================================================

  const getCuisineEmoji =
    (cuisine) => {
      if (cuisine === "Pizza")
        return "🍕";

      if (cuisine === "Chinese")
        return "🍜";

      if (cuisine === "Biryani")
        return "🍛";

      if (cuisine === "South Indian")
        return "🥞";

      if (cuisine === "North Indian")
        return "🥘";

      if (cuisine === "Burgers")
        return "🍔";

      return "🍽️";
    };

  const getRestaurantId =
    (restaurant) =>
      restaurant?.id ??
      restaurant?.restaurant_id;

  // ==========================================================
  // AUTH CHECK
  // ==========================================================

  if (authChecking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        Checking FoodAI authentication...
      </div>
    );
  }

  if (!authData || !token) {
    return (
      <LoginScreen
        onLogin={handleLogin}
      />
    );
  }

  // ==========================================================
  // ADMIN
  // ==========================================================

  if (authData.role === "admin") {
    return (
      <>
        <AdminDashboard />

        <button
          onClick={handleLogout}
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            padding: "10px 16px",
            borderRadius: "8px",
            border:
              "1px solid #ddd",
            background: "#ffffff",
            color: "#172033",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          Logout
        </button>
      </>
    );
  }

  // ==========================================================
  // RESTAURANT PARTNER
  // ==========================================================

  if (
    authData.role ===
    "restaurant"
  ) {
    return (
      <RestaurantDashboard
        token={token}
        authData={authData}
        onLogout={handleLogout}
      />
    );
  }

  // ==========================================================
  // CUSTOMER WEBSITE
  // ==========================================================

  return (
    <div className="app">

      {/* NAVBAR */}

      <nav className="navbar">

        <div
          className="logo"
          onClick={handleBackHome}
          style={{
            cursor: "pointer"
          }}
        >
          FoodAI
        </div>

        <div
          className="nav-location"
          onClick={() => {
            if (!selectedRestaurant) {
              document
                .getElementById("customer-addresses")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start"
                });
            }
          }}
          style={{ cursor: "pointer" }}
        >
          📍 {
            defaultCustomerAddress
              ? defaultCustomerAddress.label
              : "Add address"
          }
        </div>

        <div className="nav-links">

          <span
            onClick={() => {
              setSelectedRestaurant(
                null
              );
              setShowSearchResults(
                false
              );

              window.scrollTo({
                top: 0,
                behavior: "smooth"
              });
            }}
            style={{
              cursor: "pointer"
            }}
          >
            Home
          </span>

          <span>
            Offers
          </span>

          <span
            onClick={() => {
              setSelectedRestaurant(null);
              setShowSearchResults(false);
              setShowOrderHistory(true);
              window.scrollTo({
                top: 0,
                behavior: "smooth"
              });
            }}
            style={{ cursor: "pointer" }}
          >
            Orders
          </span>

          <span>
            👤 {customerName}
          </span>

          <button
            className="admin-button"
            onClick={
              handleLogout
            }
          >
            Logout
          </button>

        </div>
      </nav>

      {!selectedRestaurant && showOrderHistory && (
        <section
          id="customer-orders"
          className="section"
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "26px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 5px 20px rgba(0,0,0,0.05)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px",
                flexWrap: "wrap"
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "800",
                    color: "#e85d04",
                    letterSpacing: "0.5px"
                  }}
                >
                  🧾 MY ORDERS
                </div>
                <h2 style={{ margin: "6px 0 0" }}>
                  Order History
                </h2>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap"
                }}
              >
                <button
                  className="admin-button"
                  onClick={handleRefreshCustomerOrders}
                  disabled={ordersLoading}
                  style={{
                    opacity: ordersLoading ? 0.65 : 1,
                    cursor: ordersLoading ? "not-allowed" : "pointer"
                  }}
                >
                  {ordersLoading ? "Refreshing..." : "↻ Refresh Orders"}
                </button>

                <button
                  className="admin-button"
                  onClick={() => setShowOrderHistory(false)}
                >
                  Back to Home
                </button>
              </div>
            </div>

            {ordersLoading ? (
              <p style={{ marginTop: "24px", color: "#64748b" }}>
                Loading your orders...
              </p>
            ) : ordersError ? (
              <div
                className="search-status"
                style={{
                  marginTop: "20px",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca"
                }}
              >
                {ordersError}
              </div>
            ) : orders.length === 0 ? (
              <div
                style={{
                  marginTop: "22px",
                  padding: "30px",
                  borderRadius: "14px",
                  background: "#f8fafc",
                  textAlign: "center",
                  color: "#64748b"
                }}
              >
                You haven't placed any orders yet.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "16px",
                  marginTop: "22px"
                }}
              >
                {orders.map((order) => {
                  const currentStatus = String(order.status || "placed").toLowerCase();

                  const statusSteps = [
                    { key: "placed", label: "Order Placed", icon: "🧾" },
                    { key: "preparing", label: "Preparing", icon: "👨‍🍳" },
                    { key: "out_for_delivery", label: "Out for Delivery", icon: "🛵" },
                    { key: "delivered", label: "Delivered", icon: "✅" }
                  ];

                  const cancelled = currentStatus === "cancelled";
                  const currentIndex = statusSteps.findIndex(
                    (step) => step.key === currentStatus
                  );

                  return (
                    <div
                      key={order.order_id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "16px",
                        padding: "20px",
                        background: "#ffffff"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "15px",
                          flexWrap: "wrap"
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "17px" }}>
                            Order #{order.order_id}
                          </strong>
                          <div
                            style={{
                              marginTop: "5px",
                              color: "#475569"
                            }}
                          >
                            {order.restaurant}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <strong>
                            ₹{Number(order.grand_total || 0).toFixed(0)}
                          </strong>
                          <div
                            style={{
                              marginTop: "5px",
                              color: cancelled ? "#b91c1c" : "#047857",
                              fontWeight: "700",
                              textTransform: "capitalize"
                            }}
                          >
                            {currentStatus.replaceAll("_", " ")}
                          </div>
                        </div>
                      </div>

                      {/* ORDER TRACKING TIMELINE */}
                      <div
                        style={{
                          marginTop: "22px",
                          padding: "18px",
                          borderRadius: "14px",
                          background: cancelled ? "#fff1f2" : "#f8fafc",
                          border: cancelled
                            ? "1px solid #fecaca"
                            : "1px solid #e2e8f0"
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: "800",
                            color: cancelled ? "#b91c1c" : "#e85d04",
                            letterSpacing: "0.5px",
                            marginBottom: "15px"
                          }}
                        >
                          {cancelled ? "ORDER CANCELLED" : "ORDER TRACKING"}
                        </div>

                        {cancelled ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              color: "#b91c1c",
                              fontWeight: "700"
                            }}
                          >
                            <span style={{ fontSize: "24px" }}>❌</span>
                            <span>Your order has been cancelled.</span>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(4, minmax(0, 1fr))",
                              gap: "8px"
                            }}
                          >
                            {statusSteps.map((step, index) => {
                              const completed =
                                currentIndex >= index;

                              return (
                                <div
                                  key={step.key}
                                  style={{
                                    position: "relative",
                                    textAlign: "center"
                                  }}
                                >
                                  {index < statusSteps.length - 1 && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "17px",
                                        left: "58%",
                                        width: "84%",
                                        height: "3px",
                                        background:
                                          currentIndex > index
                                            ? "#16a34a"
                                            : "#dbe3ec",
                                        zIndex: 0
                                      }}
                                    />
                                  )}

                                  <div
                                    style={{
                                      position: "relative",
                                      zIndex: 1,
                                      width: "36px",
                                      height: "36px",
                                      margin: "0 auto 8px",
                                      borderRadius: "50%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: completed
                                        ? "#16a34a"
                                        : "#e2e8f0",
                                      color: completed
                                        ? "#ffffff"
                                        : "#64748b",
                                      fontSize: "16px",
                                      boxShadow: completed
                                        ? "0 3px 10px rgba(22,163,74,0.22)"
                                        : "none"
                                    }}
                                  >
                                    {completed ? "✓" : step.icon}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: "11px",
                                      lineHeight: "1.3",
                                      fontWeight:
                                        currentStatus === step.key
                                          ? "800"
                                          : "600",
                                      color: completed
                                        ? "#166534"
                                        : "#64748b"
                                    }}
                                  >
                                    {step.label}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!cancelled && (
                          <div
                            style={{
                              marginTop: "15px",
                              textAlign: "center",
                              color: "#475569",
                              fontSize: "13px"
                            }}
                          >
                            {currentStatus === "placed" &&
                              "Your order has been received by the restaurant."}
                            {currentStatus === "preparing" &&
                              "The restaurant is preparing your food."}
                            {currentStatus === "out_for_delivery" &&
                              "Your order is on the way to you."}
                            {currentStatus === "delivered" &&
                              "Your order has been delivered. Enjoy your meal!"}
                          </div>
                        )}
                      </div>

                      {(currentStatus === "placed" ||
                        currentStatus === "preparing") && (
                        <div
                          style={{
                            marginTop: "16px",
                            display: "flex",
                            justifyContent: "flex-end"
                          }}
                        >
                          <button
                            className="admin-button"
                            onClick={() =>
                              handleCancelCustomerOrder(order.order_id)
                            }
                            style={{
                              background: "#fff1f2",
                              color: "#b91c1c",
                              border: "1px solid #fecaca"
                            }}
                          >
                            Cancel Order
                          </button>
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: "16px",
                          color: "#475569",
                          fontSize: "14px"
                        }}
                      >
                        {Array.isArray(order.items)
                          ? order.items.map((item, index) => (
                              <div key={`${order.order_id}-${index}`}>
                                {item.quantity || 1} × {item.item || "Item"} · ₹
                                {Number(item.price || 0).toFixed(0)}
                              </div>
                            ))
                          : null}
                      </div>

                      <div
                        style={{
                          marginTop: "14px",
                          paddingTop: "12px",
                          borderTop: "1px solid #f1f5f9",
                          color: "#64748b",
                          fontSize: "13px"
                        }}
                      >
                        📍 {order.delivery_address?.address || "Address unavailable"}
                        {order.delivery_address?.landmark
                          ? ` · ${order.delivery_address.landmark}`
                          : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {!selectedRestaurant && !showOrderHistory && (
        <section
          id="customer-addresses"
          className="section"
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "26px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 5px 20px rgba(0,0,0,0.05)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px",
                flexWrap: "wrap"
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: "800",
                    color: "#e85d04",
                    letterSpacing: "0.5px"
                  }}
                >
                  📍 DELIVERY ADDRESSES
                </div>
                <h2 style={{ margin: "7px 0 4px" }}>
                  Where should we deliver?
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: "#64748b",
                    fontSize: "14px"
                  }}
                >
                  Save your delivery locations and choose a default address.
                </p>
              </div>

              <button
                className="admin-button"
                onClick={openNewAddressForm}
              >
                + Add Address
              </button>
            </div>

            {addressStatus && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "11px 14px",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#334155",
                  fontSize: "13px"
                }}
              >
                {addressStatus}
              </div>
            )}

            {addressLoading ? (
              <p style={{ color: "#64748b", marginTop: "20px" }}>
                Loading saved addresses...
              </p>
            ) : customerAddresses.length === 0 ? (
              <div
                style={{
                  marginTop: "20px",
                  padding: "22px",
                  borderRadius: "14px",
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  color: "#9a3412"
                }}
              >
                No saved address yet. Add one before placing a real delivery order.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: "14px",
                  marginTop: "20px"
                }}
              >
                {customerAddresses.map((address) => (
                  <div
                    key={address.id}
                    style={{
                      padding: "17px",
                      borderRadius: "14px",
                      border: address.is_default
                        ? "2px solid #e85d04"
                        : "1px solid #e5e7eb",
                      background: address.is_default
                        ? "#fff7ed"
                        : "#ffffff"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px"
                      }}
                    >
                      <strong>{address.label}</strong>
                      {address.is_default && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "800",
                            color: "#9a3412",
                            background: "#fed7aa",
                            padding: "4px 8px",
                            borderRadius: "999px"
                          }}
                        >
                          DEFAULT
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: "10px",
                        color: "#334155",
                        lineHeight: "1.45",
                        fontSize: "14px"
                      }}
                    >
                      {address.address}
                    </div>

                    {address.landmark && (
                      <div
                        style={{
                          marginTop: "5px",
                          color: "#64748b",
                          fontSize: "13px"
                        }}
                      >
                        Landmark: {address.landmark}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "8px",
                        color: "#94a3b8",
                        fontSize: "11px"
                      }}
                    >
                      {Number(address.latitude).toFixed(5)}, {Number(address.longitude).toFixed(5)}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                        marginTop: "14px"
                      }}
                    >
                      {!address.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultAddress(address.id)}
                          style={{
                            padding: "8px 11px",
                            borderRadius: "8px",
                            border: "1px solid #fed7aa",
                            background: "#fff7ed",
                            color: "#9a3412",
                            cursor: "pointer",
                            fontWeight: "700"
                          }}
                        >
                          Make Default
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditAddressForm(address)}
                        style={{
                          padding: "8px 11px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#334155",
                          cursor: "pointer",
                          fontWeight: "700"
                        }}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCustomerAddress(address.id)}
                        style={{
                          padding: "8px 11px",
                          borderRadius: "8px",
                          border: "1px solid #fecaca",
                          background: "#fff",
                          color: "#b91c1c",
                          cursor: "pointer",
                          fontWeight: "700"
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAddressForm && (
              <div
                style={{
                  marginTop: "22px",
                  padding: "20px",
                  borderRadius: "16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px"
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    {editingAddressId ? "Edit Address" : "Add New Address"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddressForm(false);
                      setEditingAddressId(null);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: "22px",
                      cursor: "pointer",
                      color: "#64748b"
                    }}
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSaveCustomerAddress}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "14px"
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontSize: "13px",
                          fontWeight: "700"
                        }}
                      >
                        Label
                      </label>
                      <select
                        value={addressForm.label}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            label: event.target.value
                          }))
                        }
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "11px",
                          borderRadius: "9px",
                          border: "1px solid #cbd5e1",
                          background: "#fff"
                        }}
                      >
                        <option>Home</option>
                        <option>College</option>
                        <option>Work</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontSize: "13px",
                          fontWeight: "700"
                        }}
                      >
                        Address
                      </label>
                      <input
                        value={addressForm.address}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            address: event.target.value
                          }))
                        }
                        placeholder="House / building / street / area"
                        required
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "11px",
                          borderRadius: "9px",
                          border: "1px solid #cbd5e1"
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "6px",
                          fontSize: "13px",
                          fontWeight: "700"
                        }}
                      >
                        Landmark (optional)
                      </label>
                      <input
                        value={addressForm.landmark}
                        onChange={(event) =>
                          setAddressForm((current) => ({
                            ...current,
                            landmark: event.target.value
                          }))
                        }
                        placeholder="Near..."
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "11px",
                          borderRadius: "9px",
                          border: "1px solid #cbd5e1"
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "16px",
                      borderRadius: "14px",
                      overflow: "hidden",
                      border: "1px solid #cbd5e1"
                    }}
                  >
                    <MapContainer
                      center={[
                        Number(addressForm.latitude) || 21.1458,
                        Number(addressForm.longitude) || 79.0882
                      ]}
                      zoom={15}
                      scrollWheelZoom={true}
                      style={{ height: "320px", width: "100%" }}
                    >
                      <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <CustomerAddressLocationPicker
                        position={[
                          Number(addressForm.latitude),
                          Number(addressForm.longitude)
                        ]}
                        onChange={([latitude, longitude]) =>
                          setAddressForm((current) => ({
                            ...current,
                            latitude,
                            longitude
                          }))
                        }
                      />
                    </MapContainer>
                  </div>

                  <p
                    style={{
                      margin: "10px 0 0",
                      color: "#64748b",
                      fontSize: "12px"
                    }}
                  >
                    Click the map to place the delivery marker exactly where you want the order delivered.
                  </p>

                  <div
                    style={{
                      marginTop: "12px",
                      color: "#475569",
                      fontSize: "12px"
                    }}
                  >
                    Coordinates: {Number(addressForm.latitude).toFixed(6)}, {Number(addressForm.longitude).toFixed(6)}
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      marginTop: "15px",
                      color: "#334155",
                      fontWeight: "700",
                      fontSize: "13px"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(addressForm.is_default)}
                      onChange={(event) =>
                        setAddressForm((current) => ({
                          ...current,
                          is_default: event.target.checked
                        }))
                      }
                      style={{ width: "17px", height: "17px" }}
                    />
                    Set as default delivery address
                  </label>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "10px",
                      marginTop: "18px"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressForm(false);
                        setEditingAddressId(null);
                      }}
                      style={{
                        padding: "11px 16px",
                        borderRadius: "9px",
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#334155",
                        cursor: "pointer",
                        fontWeight: "700"
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="admin-button"
                      disabled={addressSaving}
                    >
                      {addressSaving
                        ? "Saving..."
                        : editingAddressId
                          ? "Update Address"
                          : "Save Address"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>
      )}

      {/* RESTAURANT DETAIL */}

      {selectedRestaurant ? (
        <>

          <section className="section">

            <button
              onClick={
                handleBackHome
              }
              style={{
                border: "none",
                background:
                  "transparent",
                color: "#e85d04",
                fontWeight: "700",
                cursor: "pointer",
                fontSize: "15px",
                marginBottom: "20px"
              }}
            >
              ← Back to restaurants
            </button>

            <div
              style={{
                background:
                  "linear-gradient(135deg, #fff7ed, #ffffff)",
                borderRadius: "20px",
                padding: "30px",
                border:
                  "1px solid #f1f1f1"
              }}
            >

              <div
                style={{
                  display: "flex",
                  gap: "22px",
                  alignItems:
                    "center",
                  flexWrap: "wrap"
                }}
              >

                <div
                  style={{
                    width: "100px",
                    height: "100px",
                    borderRadius:
                      "18px",
                    background:
                      "#fff",
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    fontSize: "48px",
                    boxShadow:
                      "0 5px 20px rgba(0,0,0,0.08)"
                  }}
                >
                  {getCuisineEmoji(
                    selectedRestaurant.cuisine
                  )}
                </div>

                <div>

                  <h1
                    style={{
                      margin:
                        "0 0 8px",
                      fontSize:
                        "32px"
                    }}
                  >
                    {
                      selectedRestaurant.name
                    }
                  </h1>

                  <p
                    style={{
                      margin:
                        "0 0 8px",
                      color: "#555"
                    }}
                  >
                    {
                      selectedRestaurant.cuisine
                    }
                    {" • "}
                    {
                      selectedRestaurant.rating
                    }
                    {" ⭐"}
                  </p>

                  <p
                    style={{
                      margin: 0,
                      color: "#666"
                    }}
                  >
                    📍{" "}
                    {
                      selectedRestaurant.location
                    }
                    {" • "}
                    ₹
                    {Math.round(
                      selectedRestaurant.average_price
                    )}
                    {" average price"}
                  </p>

                </div>
              </div>
            </div>
          </section>

          {/* MENU */}

          <section className="section">

            <div className="section-heading">

              <div>

                <h2>
                  Menu
                </h2>

                <p>
                  Choose from{" "}
                  {
                    selectedRestaurant.menu
                      ?.length || 0
                  }{" "}
                  items
                </p>

              </div>

            </div>

            {selectedRestaurant.menu?.length ? (

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "18px"
                }}
              >

                {selectedRestaurant.menu.map(
                  (item) => (

                    <div
                      key={
                        item.item_id
                      }
                      style={{
                        background:
                          "#ffffff",
                        border:
                          "1px solid #e8ebef",
                        borderRadius:
                          "16px",
                        padding:
                          "20px",
                        boxShadow:
                          "0 4px 15px rgba(0,0,0,0.04)"
                      }}
                    >

                      {item.image_url ? (
                        <img
                          src={`${API_URL}${item.image_url}`}
                          alt={item.name}
                          style={{
                            width: "100%",
                            height: "190px",
                            objectFit: "cover",
                            borderRadius: "12px",
                            marginBottom: "14px",
                            display: "block"
                          }}
                        />
                      ) : null}

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: "15px"
                        }}
                      >

                        <div>

                          <h3
                            style={{
                              margin:
                                "0 0 7px"
                            }}
                          >
                            {item.name}
                          </h3>

                          <div
                            style={{
                              color:
                                "#666",
                              fontSize:
                                "13px"
                            }}
                          >
                            {item.rating}
                            {" ⭐"}
                            {" • "}
                            {item.is_vegetarian
                              ? "🟢 Veg"
                              : "🔴 Non-Veg"}
                          </div>

                        </div>

                        <strong>
                          ₹
                          {Math.round(
                            item.price
                          )}
                        </strong>

                      </div>

                      <p
                        style={{
                          color:
                            "#666",
                          fontSize:
                            "14px",
                          lineHeight:
                            "1.5",
                          minHeight:
                            "42px"
                        }}
                      >
                        {
                          item.description
                        }
                      </p>

                      <button
                        onClick={() =>
                          handleAddToCart(
                            selectedRestaurant.name,
                            selectedRestaurant.cuisine,
                            item.name,
                            Math.round(
                              item.price
                            )
                          )
                        }
                        style={{
                          width:
                            "100%",
                          padding:
                            "11px",
                          border:
                            "none",
                          borderRadius:
                            "9px",
                          background:
                            "#e85d04",
                          color:
                            "#fff",
                          fontWeight:
                            "700",
                          cursor:
                            "pointer"
                        }}
                      >
                        Add to Cart
                      </button>

                    </div>
                  )
                )}

              </div>

            ) : (

              <div className="search-status">
                No menu items available.
              </div>

            )}

          </section>

          {/* CART */}

          {cartItem && (
            <section className="section">

              <div
                className="personalized-offer"
                style={{
                  display: "block",
                  color: "#1f2937"
                }}
              >

                <div>
                  <span className="offer-label">
                    🛒 CART
                  </span>

                  <h2 style={{ marginBottom: "6px" }}>
                    Your Order
                  </h2>

                  <p style={{ color: "#64748b" }}>
                    {cartItem.restaurant}
                    {" • "}
                    {cartItem.cuisine}
                  </p>

                  <div
                    style={{
                      marginTop: "18px",
                      marginBottom: "18px",
                      padding: "18px",
                      borderRadius: "12px",
                      background: "#fff7ed",
                      border: "1px solid #fed7aa"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap"
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "16px" }}>
                          📍 Delivery Address
                        </strong>
                        <div
                          style={{
                            marginTop: "5px",
                            color: "#64748b",
                            fontSize: "13px"
                          }}
                        >
                          Choose where this order should be delivered.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRestaurant(null);
                          document
                            .getElementById("customer-addresses")
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "start"
                            });
                        }}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #fed7aa",
                          background: "#ffffff",
                          color: "#9a3412",
                          cursor: "pointer",
                          fontWeight: "700"
                        }}
                      >
                        Manage Addresses
                      </button>
                    </div>

                    {customerAddresses.length === 0 ? (
                      <div
                        style={{
                          marginTop: "14px",
                          padding: "12px",
                          borderRadius: "9px",
                          background: "#ffffff",
                          color: "#9a3412",
                          border: "1px solid #fed7aa",
                          fontSize: "13px"
                        }}
                      >
                        No saved delivery address. Add one before placing the order.
                      </div>
                    ) : (
                      <select
                        value={selectedDeliveryAddressId ?? ""}
                        onChange={(event) =>
                          setSelectedDeliveryAddressId(
                            event.target.value
                              ? Number(event.target.value)
                              : null
                          )
                        }
                        style={{
                          width: "100%",
                          marginTop: "14px",
                          padding: "12px",
                          borderRadius: "9px",
                          border: "1px solid #fdba74",
                          background: "#ffffff",
                          color: "#111827",
                          fontSize: "14px",
                          fontWeight: "600"
                        }}
                      >
                        {customerAddresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {address.label}
                            {address.is_default ? " (Default)" : ""}
                            {" — "}
                            {address.address}
                          </option>
                        ))}
                      </select>
                    )}

                    {selectedDeliveryAddressId &&
                      customerAddresses.find(
                        (address) =>
                          Number(address.id) ===
                          Number(selectedDeliveryAddressId)
                      ) && (
                        <div
                          style={{
                            marginTop: "10px",
                            color: "#475569",
                            fontSize: "13px",
                            lineHeight: "1.45"
                          }}
                        >
                          {(() => {
                            const selected = customerAddresses.find(
                              (address) =>
                                Number(address.id) ===
                                Number(selectedDeliveryAddressId)
                            );
                            return (
                              <>
                                <strong>{selected.label}</strong> · {selected.address}
                                {selected.landmark
                                  ? ` · Landmark: ${selected.landmark}`
                                  : ""}
                              </>
                            );
                          })()}
                        </div>
                      )}
                  </div>

                  {(() => {
                    const charges = getCartCharges(cartItem);

                    return (
                      <div
                        style={{
                          marginTop: "18px",
                          marginBottom: "18px",
                          padding: "18px",
                          borderRadius: "12px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0"
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "12px"
                          }}
                        >
                          <strong style={{ fontSize: "17px" }}>Bill Summary</strong>
                          <strong style={{ fontSize: "20px" }}>₹{charges.grandTotal.toFixed(0)}</strong>
                        </div>

                        <div style={{ display: "grid", gap: "8px", fontSize: "14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Item total</span>
                            <span>₹{charges.itemTotal.toFixed(0)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Restaurant charges</span>
                            <span>₹{charges.restaurantCharge.toFixed(0)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>
                              Delivery charges
                              {charges.deliveryDistanceKm !== null
                                ? ` (${charges.deliveryDistanceKm < 1
                                    ? `${Math.round(charges.deliveryDistanceKm * 1000)} m`
                                    : `${charges.deliveryDistanceKm.toFixed(1)} km`})`
                                : ""}
                            </span>
                            <span>₹{charges.deliveryCharge.toFixed(0)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Platform fee</span>
                            <span>₹{charges.platformFee.toFixed(0)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #cbd5e1" }}>
                            <strong>Subtotal</strong>
                            <strong>₹{charges.subtotal.toFixed(0)}</strong>
                          </div>
                          {appliedCoupon && (
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#047857", fontWeight: "700" }}>
                              <span>AI Coupon discount</span>
                              <span>−₹{charges.discount.toFixed(0)}</span>
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px", marginTop: "3px", borderTop: "2px solid #111827", fontSize: "17px" }}>
                            <strong>Grand Total</strong>
                            <strong>₹{charges.grandTotal.toFixed(0)}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div
                    style={{
                      marginTop: "18px",
                      borderTop: "1px solid #e5e7eb",
                      borderBottom: "1px solid #e5e7eb",
                      background: "#ffffff",
                      color: "#111827"
                    }}
                  >
                    {(cartItem.items || []).map(
                      (line) => (
                        <div
                          key={line.item}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "15px",
                            padding: "14px 0",
                            borderBottom: "1px solid #f1f5f9"
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <strong>{line.item}</strong>
                            <div
                              style={{
                                marginTop: "4px",
                                color: "#64748b",
                                fontSize: "13px"
                              }}
                            >
                              ₹{Number(line.price).toFixed(0)} each
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px"
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleChangeQuantity(
                                  line.item,
                                  -1
                                )
                              }
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "7px",
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                color: "#111827",
                                cursor: "pointer",
                                fontWeight: "700"
                              }}
                            >
                              −
                            </button>

                            <strong
                              style={{
                                color: "#111827",
                                minWidth: "18px",
                                textAlign: "center"
                              }}
                            >
                              {line.quantity}
                            </strong>

                            <button
                              type="button"
                              onClick={() =>
                                handleAddToCart(
                                  cartItem.restaurant,
                                  cartItem.cuisine,
                                  line.item,
                                  line.price
                                )
                              }
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "7px",
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                color: "#111827",
                                cursor: "pointer",
                                fontWeight: "700"
                              }}
                            >
                              +
                            </button>
                          </div>

                          <strong style={{ minWidth: "75px", textAlign: "right" }}>
                            ₹{(
                              Number(line.price || 0) *
                              Number(line.quantity || 1)
                            ).toFixed(0)}
                          </strong>
                        </div>
                      )
                    )}
                  </div>

                  {aiOffer?.coupon && (
                    <div
                      style={{
                        marginTop: "15px",
                        padding: "14px",
                        borderRadius: "12px",
                        background: "#fff7ed",
                        border: "1px solid #fed7aa"
                      }}
                    >
                      <strong>
                        🎟️ AI Coupon: {aiOffer.coupon.code}
                      </strong>

                      <div
                        style={{
                          marginTop: "5px",
                          color: "#475569"
                        }}
                      >
                        ₹{aiOffer.coupon.discount_amount} OFF · Minimum order ₹{aiOffer.coupon.min_order_value}
                      </div>

                      <button
                        className="admin-button"
                        onClick={handleApplyCoupon}
                        disabled={
                          couponApplying ||
                          Boolean(appliedCoupon) ||
                          getCartItemTotal(cartItem) <
                            Number(aiOffer.coupon.min_order_value || 0)
                        }
                        style={{
                          marginTop: "10px",
                          opacity:
                            couponApplying ||
                            appliedCoupon ||
                            getCartItemTotal(cartItem) <
                              Number(aiOffer.coupon.min_order_value || 0)
                              ? 0.6
                              : 1
                        }}
                      >
                        {appliedCoupon
                          ? "Coupon Applied"
                          : couponApplying
                            ? "Applying..."
                            : getCartItemTotal(cartItem) <
                              Number(aiOffer.coupon.min_order_value || 0)
                              ? "Minimum Order Not Met"
                              : "Apply Coupon"}
                      </button>
                    </div>
                  )}

                  {couponStatus && (
                    <p style={{ color: "#475569" }}>
                      {typeof couponStatus === "string"
                        ? couponStatus
                        : String(couponStatus)}
                    </p>
                  )}

                  <div
                    style={{
                      marginTop: "20px",
                      display: "flex",
                      justifyContent: "flex-end"
                    }}
                  >
                    <button
                      className="admin-button"
                      onClick={handlePlaceOrder}
                      disabled={!selectedDeliveryAddressId}
                      style={{
                        opacity: selectedDeliveryAddressId ? 1 : 0.55,
                        cursor: selectedDeliveryAddressId ? "pointer" : "not-allowed"
                      }}
                    >
                      {selectedDeliveryAddressId
                        ? `Place Order · ₹${getCartCharges(cartItem).grandTotal.toFixed(0)}`
                        : "Select Delivery Address"}
                    </button>
                  </div>

                </div>

              </div>

            </section>
          )}

          {orderStatus && (
            <section className="section">

              <div
                className="search-status"
                style={{
                  background:
                    "#ecfdf5",
                  color:
                    "#047857",
                  border:
                    "1px solid #a7f3d0"
                }}
              >
                {orderStatus}
              </div>

            </section>
          )}

        </>
      ) : (

        <>

          {/* ACCOUNT */}

          <section className="section">

            <div className="personalized-offer">

              <div>

                <span className="offer-label">
                  👤 YOUR FOODAI ACCOUNT
                </span>

                <h2>
                  Welcome,{" "}
                  {customerName}
                </h2>

                <p>
                  Your food experience
                  is personalized around
                  your preferences and
                  activity.
                </p>

              </div>

            </div>

          </section>

          {/* HERO */}

          <section className="hero">

            <div className="hero-content">

              <div className="hero-badge">
                🤖 AI-Powered Food Discovery
              </div>

              <h1>
                What are you
                <br />
                craving today?
              </h1>

              <p>
                Discover restaurants
                and food personalized
                just for you.
              </p>

              <div className="search-box">

                <span>
                  🔍
                </span>

                <input
                  type="text"
                  placeholder="Search for food or restaurants"
                  value={
                    searchText
                  }
                  onChange={(
                    event
                  ) =>
                    setSearchText(
                      event.target
                        .value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      handleSearch();
                    }
                  }}
                />

                <button
                  onClick={
                    handleSearch
                  }
                  disabled={
                    searchLoading
                  }
                >
                  {searchLoading
                    ? "Searching..."
                    : "Search"}
                </button>

              </div>

              {searchStatus && (
                <div className="search-status">
                  {searchStatus}
                </div>
              )}

            </div>

          </section>

          {/* NEARBY RESTAURANTS */}

          {authData?.role === "customer" && (
            <section className="section">

              <div className="section-heading">
                <h2>Nearby restaurants</h2>
                <p>
                  Restaurants are sorted by distance from your default delivery address.
                </p>
              </div>

              {!defaultCustomerAddress ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#9a3412"
                  }}
                >
                  Add a delivery address to see restaurants near you.
                </div>
              ) : nearbyRestaurants.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#475569"
                  }}
                >
                  No restaurants with saved map locations yet.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      marginBottom: "18px",
                      overflow: "hidden",
                      borderRadius: "14px",
                      border: "1px solid #e5e7eb"
                    }}
                  >
                    <MapContainer
                      center={nearbyMapCenter}
                      zoom={nearbyMapZoom}
                      scrollWheelZoom={true}
                      style={{ height: "360px", width: "100%" }}
                    >
                      <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      <CircleMarker
                        center={nearbyMapCenter}
                        radius={9}
                        pathOptions={{
                          color: "#2563eb",
                          fillColor: "#2563eb",
                          fillOpacity: 0.85
                        }}
                      >
                        <Popup>Your default delivery address</Popup>
                      </CircleMarker>

                      {nearbyRestaurants.map((restaurant) => (
                        <CircleMarker
                          key={getRestaurantId(restaurant)}
                          center={[
                            Number(restaurant.latitude),
                            Number(restaurant.longitude)
                          ]}
                          radius={8}
                          pathOptions={{
                            color: "#e85d04",
                            fillColor: "#e85d04",
                            fillOpacity: 0.85
                          }}
                        >
                          <Popup>
                            <strong>{restaurant.name}</strong>
                            <br />
                            {restaurant.cuisine}
                            <br />
                            {restaurant.distanceKm < 1
                              ? `${Math.round(restaurant.distanceKm * 1000)} m away`
                              : `${restaurant.distanceKm.toFixed(1)} km away`}<br />🚴 {restaurant.deliveryEta}
                          </Popup>
                        </CircleMarker>
                      ))}
                    </MapContainer>
                  </div>

                  <div className="restaurant-grid">
                    {nearbyRestaurants.slice(0, 6).map((restaurant) => {
                      const restaurantId = getRestaurantId(restaurant);
                      return (
                        <div
                          className="restaurant-card"
                          key={`nearby-${restaurantId}`}
                          onClick={() =>
                            handleRestaurantClick(
                              restaurant.name || restaurant.restaurant,
                              restaurant.cuisine,
                              restaurantId
                            )
                          }
                        >
                          <div className="restaurant-image">
                            {getCuisineEmoji(restaurant.cuisine)}
                          </div>
                          <div className="restaurant-info">
                            <h3>{restaurant.name || restaurant.restaurant}</h3>
                            <p>
                              {restaurant.cuisine}
                              {" • "}
                              {restaurant.rating || 0}
                              {" ⭐"}
                            </p>
                            <span>
                              {restaurant.distanceKm < 1
                                ? `${Math.round(restaurant.distanceKm * 1000)} m away`
                                : `${restaurant.distanceKm.toFixed(1)} km away`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

            </section>
          )}

          {/* SEARCH RESULTS */}

          {showSearchResults && (

            <section className="section">

              <div
                className="section-heading"
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center"
                }}
              >

                <div>

                  <h2>
                    Search results
                  </h2>

                  <p>
                    Restaurants serving
                    what you're looking
                    for
                  </p>

                </div>

                <button
                  onClick={
                    handleBackHome
                  }
                  style={{
                    padding:
                      "9px 14px",
                    borderRadius:
                      "8px",
                    border:
                      "1px solid #ddd",
                    background:
                      "#fff",
                    cursor:
                      "pointer",
                    fontWeight:
                      "600"
                  }}
                >
                  Clear
                </button>

              </div>

              {searchLoading ? (

                <div className="search-status">
                  🔎 Searching restaurants
                  and menus...
                </div>

              ) : searchResults.length === 0 ? (

                <div className="search-status">
                  No matching restaurants
                  found.
                </div>

              ) : (

                <div className="restaurant-grid">

                  {searchResults.map(
                    (restaurant) => {

                      const restaurantId =
                        getRestaurantId(
                          restaurant
                        );

                      return (

                        <div
                          className="restaurant-card"
                          key={
                            restaurantId
                          }
                          onClick={() =>
                            handleRestaurantClick(
                              restaurant.name ||
                                restaurant.restaurant,
                              restaurant.cuisine,
                              restaurantId
                            )
                          }
                        >

                          <div className="restaurant-image">
                            {getCuisineEmoji(
                              restaurant.cuisine
                            )}
                          </div>

                          <div className="restaurant-info">

                            <h3>
                              {restaurant.name ||
                                restaurant.restaurant}
                            </h3>

                            <p>
                              {
                                restaurant.cuisine
                              }
                              {" • "}
                              {
                                restaurant.rating
                              }
                              {" ⭐"}
                            </p>

                            <span>
                              ₹
                              {Math.round(
                                restaurant.average_price ||
                                  0
                              )}
                              {" for two"}
                            </span>

                            {restaurant.matchingItems?.length >
                              0 && (

                              <div
                                style={{
                                  marginTop:
                                    "12px",
                                  padding:
                                    "10px",
                                  borderRadius:
                                    "8px",
                                  background:
                                    "#fff7ed",
                                  border:
                                    "1px solid #fed7aa",
                                  fontSize:
                                    "13px"
                                }}
                              >

                                <strong>
                                  Matching food
                                </strong>

                                {restaurant.matchingItems
                                  .slice(0, 3)
                                  .map(
                                    (
                                      item
                                    ) => (

                                      <div
                                        key={
                                          item.item_id
                                        }
                                        style={{
                                          marginTop:
                                            "5px"
                                        }}
                                      >
                                        🍽️{" "}
                                        {
                                          item.name
                                        }
                                        {" • "}
                                        ₹
                                        {Math.round(
                                          item.price
                                        )}
                                      </div>

                                    )
                                  )}

                              </div>
                            )}

                            <button
                              onClick={(
                                event
                              ) => {

                                event.stopPropagation();

                                handleRestaurantClick(
                                  restaurant.name ||
                                    restaurant.restaurant,
                                  restaurant.cuisine,
                                  restaurantId
                                );

                              }}
                              style={{
                                marginTop:
                                  "14px",
                                width:
                                  "100%",
                                padding:
                                  "10px",
                                border:
                                  "none",
                                borderRadius:
                                  "9px",
                                background:
                                  "#e85d04",
                                color:
                                  "#fff",
                                fontWeight:
                                  "700",
                                cursor:
                                  "pointer"
                              }}
                            >
                              View Menu
                            </button>

                          </div>

                        </div>

                      );
                    }
                  )}

                </div>

              )}

            </section>
          )}

          {restaurantLoading && (
            <section className="section">
              <div className="search-status">
                🍽️ Loading restaurant menu...
              </div>
            </section>
          )}

          {restaurantError && (
            <section className="section">
              <div
                className="search-status"
                style={{
                  color: "#b91c1c",
                  background: "#fff1f2"
                }}
              >
                {restaurantError}
              </div>
            </section>
          )}

          {/* AI PERSONALIZATION */}

          <section className="section">

            <div className="ai-banner">

              <div className="ai-icon">
                ✨
              </div>

              <div>

                <h2>
                  Picked by FoodAI for you
                </h2>

                <p>
                  Recommendations are
                  personalized using your
                  food preferences and
                  ordering behavior.
                </p>

              </div>

            </div>

          </section>

          {/* CUISINES */}

          <section className="section">

            <h2>
              Explore cuisines
            </h2>

            <div className="categories">

              {[
                ["🍛", "Biryani"],
                ["🍕", "Pizza"],
                ["🍜", "Chinese"],
                ["🥘", "North Indian"],
                ["🥞", "South Indian"],
                ["🍔", "Burgers"]
              ].map(
                ([emoji, cuisine]) => (

                  <div
                    key={cuisine}
                    className="category"
                    onClick={() =>
                      handleCuisineClick(
                        cuisine
                      )
                    }
                  >
                    {emoji}
                    <span>
                      {cuisine}
                    </span>
                  </div>

                )
              )}

            </div>

          </section>

          {/* RECOMMENDATIONS */}

          <section className="section">

            <div className="section-heading">

              <div>

                <h2>
                  Recommended restaurants
                </h2>

                <p>
                  Selected especially
                  for you
                </p>

              </div>

            </div>

            {recommendationsLoading ? (

              <div className="search-status">
                🤖 FoodAI is generating
                your personalized
                recommendations...
              </div>

            ) : recommendations.length ===
              0 ? (

              <div className="search-status">
                No personalized
                recommendations
                available.
              </div>

            ) : (

              <div className="restaurant-grid">

                {recommendations
                  .slice(0, 6)
                  .map(
                    (restaurant) => (

                      <div
                        className="restaurant-card"
                        key={
                          restaurant.restaurant_id
                        }
                        onClick={() =>
                          handleRestaurantClick(
                            restaurant.restaurant,
                            restaurant.cuisine,
                            restaurant.restaurant_id
                          )
                        }
                      >

                        <div className="restaurant-image">
                          {getCuisineEmoji(
                            restaurant.cuisine
                          )}
                        </div>

                        <div className="restaurant-info">

                          <h3>
                            {
                              restaurant.restaurant
                            }
                          </h3>

                          <p>
                            {
                              restaurant.cuisine
                            }
                            {" • "}
                            {
                              restaurant.rating
                            }
                            {" ⭐"}
                          </p>

                          <span>
                            ₹
                            {Math.round(
                              restaurant.average_price
                            )}
                            {" for two"}
                          </span>

                          {restaurant.reasons?.length >
                            0 && (

                            <div
                              style={{
                                marginTop:
                                  "12px",
                                padding:
                                  "10px",
                                borderRadius:
                                  "8px",
                                background:
                                  "#f8fafc",
                                border:
                                  "1px solid #e8ebef",
                                color:
                                  "#4b5563",
                                fontSize:
                                  "12px",
                                lineHeight:
                                  "1.5"
                              }}
                            >

                              <strong
                                style={{
                                  color:
                                    "#172033"
                                }}
                              >
                                Why you might
                                like it
                              </strong>

                              {restaurant.reasons.map(
                                (
                                  reason,
                                  index
                                ) => (

                                  <div
                                    key={
                                      index
                                    }
                                    style={{
                                      marginTop:
                                        "4px"
                                    }}
                                  >
                                    ✓ {reason}
                                  </div>

                                )
                              )}

                            </div>
                          )}

                          <button
                            onClick={(
                              event
                            ) => {

                              event.stopPropagation();

                              handleRestaurantClick(
                                restaurant.restaurant,
                                restaurant.cuisine,
                                restaurant.restaurant_id
                              );

                            }}
                            style={{
                              marginTop:
                                "14px",
                              width:
                                "100%",
                              padding:
                                "10px",
                              border:
                                "none",
                              borderRadius:
                                "9px",
                              background:
                                "#e85d04",
                              color:
                                "#fff",
                              fontWeight:
                                "700",
                              cursor:
                                "pointer"
                            }}
                          >
                            View Menu
                          </button>

                        </div>

                      </div>

                    )
                  )}

              </div>
            )}

          </section>

          {/* CART */}

          {cartItem && (
            <section className="section">

              <div
                className="personalized-offer"
                style={{
                  display: "block",
                  color: "#1f2937"
                }}
              >

                <div>
                  <span className="offer-label">
                    🛒 CART
                  </span>

                  <h2 style={{ marginBottom: "6px" }}>
                    Your Order
                  </h2>

                  <p style={{ color: "#64748b" }}>
                    {cartItem.restaurant}
                    {" • "}
                    {cartItem.cuisine}
                  </p>

                  <div
                    style={{
                      marginTop: "18px",
                      borderTop: "1px solid #e5e7eb",
                      borderBottom: "1px solid #e5e7eb"
                    }}
                  >
                    {(cartItem.items || []).map(
                      (line) => (
                        <div
                          key={line.item}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "15px",
                            padding: "14px 0",
                            borderBottom: "1px solid #f1f5f9"
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <strong>{line.item}</strong>
                            <div
                              style={{
                                marginTop: "4px",
                                color: "#64748b",
                                fontSize: "13px"
                              }}
                            >
                              ₹{Number(line.price).toFixed(0)} each
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px"
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleChangeQuantity(
                                  line.item,
                                  -1
                                )
                              }
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "7px",
                                border: "1px solid #d1d5db",
                                background: "#fff",
                                cursor: "pointer",
                                fontWeight: "700"
                              }}
                            >
                              −
                            </button>

                            <strong>
                              {line.quantity}
                            </strong>

                            <button
                              type="button"
                              onClick={() =>
                                handleAddToCart(
                                  cartItem.restaurant,
                                  cartItem.cuisine,
                                  line.item,
                                  line.price
                                )
                              }
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "7px",
                                border: "1px solid #d1d5db",
                                background: "#fff",
                                cursor: "pointer",
                                fontWeight: "700"
                              }}
                            >
                              +
                            </button>
                          </div>

                          <strong style={{ minWidth: "75px", textAlign: "right" }}>
                            ₹{(
                              Number(line.price || 0) *
                              Number(line.quantity || 1)
                            ).toFixed(0)}
                          </strong>
                        </div>
                      )
                    )}
                  </div>

                  {(() => {
                    const charges =
                      getCartCharges(cartItem);

                    return (
                      <div
                        style={{
                          marginTop: "20px",
                          padding: "18px",
                          borderRadius: "12px",
                          background: "#f8fafc",
                          color: "#111827"
                        }}
                      >
                        <h3 style={{ marginTop: 0 }}>
                          Bill Summary
                        </h3>

                        <div style={{ display: "grid", gap: "9px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Item total</span>
                            <span>₹{charges.itemTotal.toFixed(0)}</span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Restaurant charges</span>
                            <span>₹{charges.restaurantCharge.toFixed(0)}</span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>
                              Delivery charges
                              {charges.deliveryDistanceKm !== null
                                ? ` (${charges.deliveryDistanceKm < 1
                                    ? `${Math.round(charges.deliveryDistanceKm * 1000)} m`
                                    : `${charges.deliveryDistanceKm.toFixed(1)} km`})`
                                : ""}
                            </span>
                            <span>₹{charges.deliveryCharge.toFixed(0)}</span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>Platform fee</span>
                            <span>₹{charges.platformFee.toFixed(0)}</span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              paddingTop: "9px",
                              borderTop: "1px solid #e5e7eb"
                            }}
                          >
                            <strong>Subtotal</strong>
                            <strong>₹{charges.subtotal.toFixed(0)}</strong>
                          </div>

                          {appliedCoupon && (
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                color: "#047857",
                                fontWeight: "700"
                              }}
                            >
                              <span>AI Coupon discount</span>
                              <span>−₹{charges.discount.toFixed(0)}</span>
                            </div>
                          )}

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              paddingTop: "12px",
                              marginTop: "4px",
                              borderTop: "2px solid #111827",
                              fontSize: "18px"
                            }}
                          >
                            <strong>Grand Total</strong>
                            <strong>₹{charges.grandTotal.toFixed(0)}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {aiOffer?.coupon && (
                    <div
                      style={{
                        marginTop: "15px",
                        padding: "14px",
                        borderRadius: "12px",
                        background: "#fff7ed",
                        border: "1px solid #fed7aa"
                      }}
                    >
                      <strong>
                        🎟️ AI Coupon: {aiOffer.coupon.code}
                      </strong>

                      <div
                        style={{
                          marginTop: "5px",
                          color: "#475569"
                        }}
                      >
                        ₹{aiOffer.coupon.discount_amount} OFF · Minimum order ₹{aiOffer.coupon.min_order_value}
                      </div>

                      <button
                        className="admin-button"
                        onClick={handleApplyCoupon}
                        disabled={
                          couponApplying ||
                          Boolean(appliedCoupon) ||
                          getCartItemTotal(cartItem) <
                            Number(aiOffer.coupon.min_order_value || 0)
                        }
                        style={{
                          marginTop: "10px",
                          opacity:
                            couponApplying ||
                            appliedCoupon ||
                            getCartItemTotal(cartItem) <
                              Number(aiOffer.coupon.min_order_value || 0)
                              ? 0.6
                              : 1
                        }}
                      >
                        {appliedCoupon
                          ? "Coupon Applied"
                          : couponApplying
                            ? "Applying..."
                            : getCartItemTotal(cartItem) <
                              Number(aiOffer.coupon.min_order_value || 0)
                              ? "Minimum Order Not Met"
                              : "Apply Coupon"}
                      </button>
                    </div>
                  )}

                  {couponStatus && (
                    <p style={{ color: "#475569" }}>
                      {couponStatus}
                    </p>
                  )}

                  <div
                    style={{
                      marginTop: "20px",
                      display: "flex",
                      justifyContent: "flex-end"
                    }}
                  >
                    <button
                      className="admin-button"
                      onClick={handlePlaceOrder}
                    >
                      Place Order · ₹{getCartCharges(cartItem).grandTotal.toFixed(0)}
                    </button>
                  </div>

                </div>

              </div>

            </section>
          )}

          {/* OFFER */}

          <section className="section">

            <div className="personalized-offer">

              <div style={{ flex: 1 }}>

                <span className="offer-label">
                  🎯 PERSONALIZED FOR YOU
                </span>

                <h2>Your FoodAI offer</h2>

                <p>
                  A personalized offer based on your ordering preferences and AI offer optimization.
                </p>

                {aiOffer?.coupon ? (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "15px",
                      borderRadius: "12px",
                      background: "#fff7ed",
                      border: "1px solid #fed7aa"
                    }}
                  >
                    <div style={{ fontWeight: "800", fontSize: "18px" }}>
                      🎟️ {aiOffer.coupon.code}
                    </div>
                    <div style={{ marginTop: "5px", color: "#475569" }}>
                      ₹{aiOffer.coupon.discount_amount} OFF · Minimum order ₹{aiOffer.coupon.min_order_value}
                    </div>
                    <div style={{ marginTop: "8px", color: "#64748b", fontSize: "13px" }}>
                      {aiOffer.coupon.offer_reason}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "12px", color: "#64748b" }}>
                    FoodAI currently recommends ordering without a discount.
                  </div>
                )}

              </div>

              <div className="offer-amount">
                {offerLoading
                  ? "..."
                  : `₹${
                      aiOffer?.recommended_discount ??
                      0
                    } OFF`}
              </div>

            </div>

          </section>

          {/* FOOTER */}

          <footer>

            <div className="logo">
              FoodAI
            </div>

            <p>
              AI-powered personalized
              food discovery
            </p>

            <span>
              © 2026 FoodAI
            </span>

          </footer>

        </>
      )}

    </div>
  );
}

export default App;