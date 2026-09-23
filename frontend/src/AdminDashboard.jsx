import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function formatCurrency(value) {
  return `₹${Number(value ?? 0).toFixed(2)}`;
}

function formatPercentage(value) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

function formatFeatureName(feature) {
  return String(feature ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(1);

  const [customer, setCustomer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [offer, setOffer] = useState(null);
  const [modelEvaluation, setModelEvaluation] = useState(null);
  const [offerModelEvaluation, setOfferModelEvaluation] = useState(null);
  const [recentBehavior, setRecentBehavior] = useState([]);

  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [orderPaymentAnalytics, setOrderPaymentAnalytics] = useState(null);

  async function fetchJson(endpoint) {
    const storedAuth = localStorage.getItem("foodai_auth");

    let accessToken = "";

    try {
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        accessToken = authData?.access_token || "";
      }
    } catch (error) {
      console.error("Unable to read FoodAI authentication data:", error);
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    });

    if (!response.ok) {
      throw new Error(`${endpoint} returned ${response.status}`);
    }

    return response.json();
  }

  async function loadSystemData() {
    const [
      summaryData,
      evaluationData,
      offerEvaluationData,
      orderPaymentAnalyticsData,
    ] = await Promise.all([
      fetchJson("/data-summary"),
      fetchJson("/ai/model-evaluation"),
      fetchJson("/ai/offer-model-evaluation"),
      fetchJson("/admin/order-payment-analytics"),
    ]);

    setSummary(summaryData);
    setModelEvaluation(evaluationData);
    setOfferModelEvaluation(offerEvaluationData);
    setOrderPaymentAnalytics(orderPaymentAnalyticsData);

    const customerCount = Number(summaryData?.customers ?? 0);

    setCustomers(
      Array.from({ length: customerCount }, (_, index) => ({
        id: index + 1,
        name: `Customer ${index + 1}`,
      }))
    );
  }

  async function loadCustomerData(id) {
    setCustomerLoading(true);

    try {
      const [
        customerData,
        profileData,
        predictionData,
        recommendationData,
        offerData,
      ] = await Promise.all([
        fetchJson(`/customer/${id}`),
        fetchJson(`/ai/customer/${id}`),
        fetchJson(`/ai/predict/${id}`),
        fetchJson(`/recommendations/${id}`),
        fetchJson(`/offers/${id}`),
      ]);

      setCustomer(customerData);
      setProfile(profileData);
      setPrediction(predictionData);
      setRecommendations(recommendationData);
      setOffer(offerData);
      setLastUpdated(new Date());
      setError("");

      try {
        const behaviorData = await fetchJson(`/behavior/${id}`);

        const behaviorEvents = Array.isArray(behaviorData)
          ? behaviorData
          : Array.isArray(behaviorData?.events)
            ? behaviorData.events
            : [];

        setRecentBehavior(
         behaviorEvents.slice(0, 10) 
        );
      } catch (err) {
        console.error(
          "Recent behavior loading error:",
          err
        );
        setRecentBehavior([]);
      }
    } catch (err) {
      console.error("Customer dashboard error:", err);

      setError(
        "Unable to load customer intelligence. Make sure the FoodAI backend is running."
      );
    } finally {
      setCustomerLoading(false);
      setLoading(false);
    }
  }

  async function refreshDashboard() {
    setError("");
    setLoading(true);

    try {
      await loadSystemData();
      await loadCustomerData(customerId);
    } catch (err) {
      console.error("Dashboard refresh error:", err);

      setError(
        "Unable to refresh the dashboard. Check that the FoodAI backend is running."
      );

      setLoading(false);
      setCustomerLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        await loadSystemData();
        await loadCustomerData(1);
      } catch (err) {
        console.error("Initial dashboard error:", err);

        setError(
          "Unable to connect to the FoodAI backend. Start the backend and refresh."
        );

        setLoading(false);
        setCustomerLoading(false);
      }
    }

    initialize();
  }, []);

  useEffect(() => {
    if (!loading && customers.length > 0) {
      loadCustomerData(customerId);
    }
  }, [customerId]);

  if (loading) {
    return (
      <div className="admin-loading">
        <div>
          <strong>FoodAI</strong>
          <p>Loading AI Intelligence Dashboard...</p>
        </div>
      </div>
    );
  }

  const recommendedRestaurants =
    recommendations?.recommendations?.slice(0, 5) ?? [];

  const discountOptions =
    offer?.discount_analysis ?? [];

  const featureImportance =
    modelEvaluation?.feature_importance ?? [];

  const offerDrivers =
    offerModelEvaluation?.coefficients ?? [];

  const customerName =
    customer?.name ||
    recommendations?.customer_name ||
    `Customer ${customerId}`;

  const predictedCuisine =
    prediction?.predicted_cuisine ||
    recommendations?.ai_predicted_cuisine ||
    "Unknown";

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <div className="admin-brand">FoodAI</div>

          <h1>AI Intelligence Dashboard</h1>

          <p>
            Customer behavior, machine learning insights and offer
            optimization
          </p>
        </div>

        <div className="admin-status">
          <span className="status-dot"></span>
          AI Systems Online
        </div>
      </header>

      {error && (
        <div
          className="dashboard-card"
          style={{
            marginBottom: "20px",
            border: "1px solid #ef4444",
            background: "#fff5f5",
          }}
        >
          <strong>Dashboard connection issue</strong>

          <p style={{ marginBottom: 0 }}>{error}</p>
        </div>
      )}

      <section className="dashboard-section">
        <div
          className="dashboard-card customer-selector"
          style={{ alignItems: "center" }}
        >
          <div>
            <div className="card-title">
              Company Control Center
            </div>

            <p>
              Analyze individual customer behavior and inspect the AI
              decision pipeline.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <select
              value={customerId}
              onChange={(event) =>
                setCustomerId(
                  Number(event.target.value)
                )
              }
              disabled={customerLoading}
              aria-label="Select customer"
            >
              {customers.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  Customer {item.id}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={refreshDashboard}
              disabled={customerLoading}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                cursor: customerLoading
                  ? "wait"
                  : "pointer",
                fontWeight: 600,
              }}
            >
              {customerLoading
                ? "Refreshing..."
                : "Refresh AI Data"}
            </button>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Order & Payment Analytics</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            marginBottom: "28px",
          }}
        >
          <div className="admin-card">
            <h3>Total Orders</h3>
            <div className="admin-metric">
              {Number(orderPaymentAnalytics?.total_orders ?? 0)}
            </div>
          </div>

          <div className="admin-card">
            <h3>Total Revenue</h3>
            <div className="admin-metric">
              {formatCurrency(orderPaymentAnalytics?.total_revenue)}
            </div>
          </div>

          <div className="admin-card">
            <h3>Paid Demo Orders</h3>
            <div className="admin-metric">
              {Number(orderPaymentAnalytics?.paid_demo_orders ?? 0)}
            </div>
          </div>

          <div className="admin-card">
            <h3>COD Orders</h3>
            <div className="admin-metric">
              {Number(orderPaymentAnalytics?.cod_orders ?? 0)}
            </div>
          </div>

          <div className="admin-card">
            <h3>Payment Pending</h3>
            <div className="admin-metric">
              {Number(orderPaymentAnalytics?.payment_pending_orders ?? 0)}
            </div>
          </div>

          <div className="admin-card">
            <h3>Pending Amount</h3>
            <div className="admin-metric">
              {formatCurrency(
                orderPaymentAnalytics?.payment_pending_amount
              )}
            </div>
          </div>

          <div className="admin-card">
            <h3>Active Orders</h3>
            <div className="admin-metric">
              {Number(orderPaymentAnalytics?.active_orders ?? 0)}
            </div>
          </div>

          <div className="admin-card">
            <h3>Delivered Orders</h3>
            <div className="admin-metric">
              {Number(orderPaymentAnalytics?.delivered_orders ?? 0)}
            </div>
          </div>

          <div className="admin-card">
            <h3>Cancelled Orders</h3>
            <div className="admin-metric">
              {Number(orderPaymentAnalytics?.cancelled_orders ?? 0)}
            </div>
          </div>

          <div className="admin-card">
            <h3>Average Order Value</h3>
            <div className="admin-metric">
              {formatCurrency(
                orderPaymentAnalytics?.average_order_value
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            marginTop: "20px",
            marginBottom: "28px",
          }}
        >
          <div className="dashboard-card">
            <div className="card-title">7-Day Revenue Trend</div>
            {(() => {
              const trends = Array.isArray(orderPaymentAnalytics?.daily_trends)
                ? orderPaymentAnalytics.daily_trends
                : [];
              const maxRevenue = Math.max(
                ...trends.map((day) => Number(day.revenue || 0)),
                1
              );

              return trends.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "10px",
                    height: "190px",
                    paddingTop: "18px",
                  }}
                >
                  {trends.map((day) => (
                    <div
                      key={day.date}
                      style={{
                        flex: 1,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "11px", fontWeight: 700 }}>
                        ₹{Math.round(Number(day.revenue || 0))}
                      </span>
                      <div
                        title={`${day.label}: ₹${Number(day.revenue || 0).toFixed(2)}`}
                        style={{
                          width: "100%",
                          maxWidth: "34px",
                          height: `${Math.max((Number(day.revenue || 0) / maxRevenue) * 120, 4)}px`,
                          borderRadius: "7px 7px 3px 3px",
                          background: "#111827",
                        }}
                      />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="prediction-note">No order data available for the last 7 days.</p>
              );
            })()}
          </div>

          <div className="dashboard-card">
            <div className="card-title">7-Day Order Trend</div>
            {(() => {
              const trends = Array.isArray(orderPaymentAnalytics?.daily_trends)
                ? orderPaymentAnalytics.daily_trends
                : [];
              const maxOrders = Math.max(
                ...trends.map((day) => Number(day.orders || 0)),
                1
              );

              return trends.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "10px",
                    height: "190px",
                    paddingTop: "18px",
                  }}
                >
                  {trends.map((day) => (
                    <div
                      key={day.date}
                      style={{
                        flex: 1,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "11px", fontWeight: 700 }}>
                        {Number(day.orders || 0)}
                      </span>
                      <div
                        title={`${day.label}: ${Number(day.orders || 0)} orders`}
                        style={{
                          width: "100%",
                          maxWidth: "34px",
                          height: `${Math.max((Number(day.orders || 0) / maxOrders) * 120, 4)}px`,
                          borderRadius: "7px 7px 3px 3px",
                          background: "#334155",
                        }}
                      />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="prediction-note">No order data available for the last 7 days.</p>
              );
            })()}
          </div>

          <div className="dashboard-card">
            <div className="card-title">Payment Mix</div>
            <div style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>Cash on Delivery</span>
                  <strong>{Number(orderPaymentAnalytics?.payment_breakdown?.cod ?? 0)}</strong>
                </div>
                <div style={{ height: "10px", background: "#e5e7eb", borderRadius: "999px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min((Number(orderPaymentAnalytics?.payment_breakdown?.cod ?? 0) / Math.max(Number(orderPaymentAnalytics?.total_orders ?? 0), 1)) * 100, 100)}%`,
                      background: "#111827",
                    }}
                  />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>Online Payment (Demo)</span>
                  <strong>{Number(orderPaymentAnalytics?.payment_breakdown?.online_demo ?? 0)}</strong>
                </div>
                <div style={{ height: "10px", background: "#e5e7eb", borderRadius: "999px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min((Number(orderPaymentAnalytics?.payment_breakdown?.online_demo ?? 0) / Math.max(Number(orderPaymentAnalytics?.total_orders ?? 0), 1)) * 100, 100)}%`,
                      background: "#475569",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-title">Order Status Breakdown</div>
            <div style={{ display: "grid", gap: "10px", marginTop: "14px" }}>
              {[
                ["Placed", "placed"],
                ["Preparing", "preparing"],
                ["Out for Delivery", "out_for_delivery"],
                ["Delivered", "delivered"],
                ["Cancelled", "cancelled"],
              ].map(([label, key]) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "9px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <span>{label}</span>
                  <strong>{Number(orderPaymentAnalytics?.status_breakdown?.[key] ?? 0)}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h2>System Overview</h2>

        <div className="stat-grid">
          <div className="stat-card">
            <span>Customers</span>
            <strong>
              {summary?.customers ?? 0}
            </strong>
          </div>

          <div className="stat-card">
            <span>Restaurants</span>
            <strong>
              {summary?.restaurants ?? 0}
            </strong>
          </div>

          <div className="stat-card">
            <span>Behavior Events</span>
            <strong>
              {summary?.behavior_events ?? 0}
            </strong>
          </div>

          <div className="stat-card">
            <span>AI Models</span>
            <strong>3</strong>
          </div>
        </div>

        <div
          className="dashboard-card"
          style={{
            marginTop: "16px",
            display: "flex",
            justifyContent: "space-between",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>AI system status</strong>

            <p style={{ marginBottom: 0 }}>
              Recommendation engine, cuisine classifier and offer-response
              model are connected to the backend.
            </p>
          </div>

          <div>
            <strong>Selected customer</strong>

            <p style={{ marginBottom: 0 }}>
              {customerName} · ID #
              {customer?.customer_id ??
                customerId}
            </p>
          </div>

          <div>
            <strong>Last data refresh</strong>

            <p style={{ marginBottom: 0 }}>
              {lastUpdated
                ? lastUpdated.toLocaleTimeString()
                : "Just now"}
            </p>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Customer Intelligence</h2>

        <div className="two-column">
          <div className="dashboard-card">
            <div className="card-title">
              Customer Profile
            </div>

            <div className="profile-name">
              {customerName}
            </div>

            <div className="profile-row">
              <span>Customer ID</span>
              <strong>
                #{customer?.customer_id ??
                  customerId}
              </strong>
            </div>

            <div className="profile-row">
              <span>Favorite Food</span>

              <strong>
                {customer?.favorite_food ||
                  predictedCuisine}
              </strong>
            </div>

            <div className="profile-row">
              <span>Average Order Value</span>

              <strong>
                {formatCurrency(
                  customer?.average_order_value
                )}
              </strong>
            </div>

            <div className="profile-row">
              <span>Total Orders</span>

              <strong>
                {customer?.orders ?? 0}
              </strong>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-title">
              AI Cuisine Prediction
            </div>

            <div className="prediction-food">
              {predictedCuisine}
            </div>

            <div className="confidence-label">
              Prediction Confidence
            </div>

            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{
                  width: `${Math.min(
                    Number(
                      prediction?.confidence_percentage ??
                        0
                    ),
                    100
                  )}%`,
                }}
              />
            </div>

            <div className="confidence-value">
              {formatPercentage(
                prediction?.confidence_percentage
              )}
            </div>

            <p className="prediction-note">
              Random Forest prediction based on customer behavior features.
            </p>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Behavioral Analytics</h2>

        <div className="stat-grid">
          <div className="metric-card">
            <span>Total Interactions</span>

            <strong>
              {profile?.total_interactions ?? 0}
            </strong>
          </div>

          <div className="metric-card">
            <span>Observed Orders</span>

            <strong>
              {profile?.observed_orders ?? 0}
            </strong>
          </div>

          <div className="metric-card">
            <span>Preference Confidence</span>

            <strong>
              {formatPercentage(
                profile?.preference_confidence
              )}
            </strong>
          </div>

          <div className="metric-card">
            <span>Observed Average Order Value</span>

            <strong>
              {formatCurrency(
                profile?.observed_average_order_value
              )}
            </strong>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Recent Customer Behavior</h2>

        <div className="dashboard-card">
          <div className="card-title">
            Latest 10 Behavior Events
          </div>

          {recentBehavior.length > 0 ? (
            <div
              style={{
                overflowX: "auto",
                marginTop: "16px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "760px",
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Action",
                      "Item",
                      "Restaurant",
                      "Cuisine",
                      "Order Value",
                      "Time",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: "left",
                          padding: "12px",
                          borderBottom:
                            "1px solid #e5e7eb",
                          fontSize: "13px",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {recentBehavior.map(
                    (event, index) => (
                      <tr
                        key={
                          event.id ??
                          `${event.timestamp}-${index}`
                        }
                      >
                        <td
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid #f1f5f9",
                            fontWeight: 600,
                          }}
                        >
                          {event.action ||
                            "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid #f1f5f9",
                          }}
                        >
                          {event.item || "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid #f1f5f9",
                          }}
                        >
                          {event.restaurant ||
                            "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid #f1f5f9",
                          }}
                        >
                          {event.cuisine || "-"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid #f1f5f9",
                          }}
                        >
                          {formatCurrency(
                            event.order_value
                          )}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid #f1f5f9",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {event.timestamp
                            ? new Date(
                                event.timestamp
                              ).toLocaleString()
                            : "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="prediction-note">
              No recent behavior events are available.
            </p>
          )}
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Recommendation Intelligence</h2>

        <div className="dashboard-card">
          <div className="recommendation-summary">
            <div>
              <span>AI Predicted Cuisine</span>

              <strong>
                {recommendations?.ai_predicted_cuisine ||
                  predictedCuisine}
              </strong>
            </div>

            <div>
              <span>AI Confidence</span>

              <strong>
                {formatPercentage(
                  recommendations?.ai_confidence
                )}
              </strong>
            </div>
          </div>

          <div className="restaurant-list">
            {recommendedRestaurants.map(
              (restaurant) => (
                <div
                  className="restaurant-row"
                  key={restaurant.restaurant_id}
                  style={{
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <strong>
                      {restaurant.restaurant}
                    </strong>

                    <span>
                      {restaurant.cuisine} · Rating{" "}
                      {restaurant.rating}
                    </span>

                    {Array.isArray(
                      restaurant.reasons
                    ) &&
                      restaurant.reasons.length >
                        0 && (
                        <div
                          style={{
                            marginTop: "8px",
                            display: "flex",
                            flexDirection:
                              "column",
                            gap: "4px",
                          }}
                        >
                          {restaurant.reasons.map(
                            (reason, index) => (
                              <span
                                key={`${restaurant.restaurant_id}-reason-${index}`}
                                style={{
                                  fontSize:
                                    "12px",
                                  color:
                                    "#64748b",
                                }}
                              >
                                ✓ {reason}
                              </span>
                            )
                          )}
                        </div>
                      )}
                  </div>

                  <div className="restaurant-score">
                    <strong>
                      {Number(
                        restaurant.score ?? 0
                      ).toFixed(2)}
                    </strong>

                    <span>AI Score</span>
                  </div>
                </div>
              )
            )}

            {recommendedRestaurants.length ===
              0 && (
              <p className="prediction-note">
                No recommendations are currently available.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Dynamic Offer Optimization</h2>

        <div className="offer-grid">
          <div className="dashboard-card">
            <div className="card-title">
              AI Offer Decision
            </div>

            <div className="offer-value">
              ₹{offer?.recommended_discount ?? 0}
            </div>

            <p>Recommended discount</p>

            <div className="offer-detail">
              <span>Predicted Conversion</span>

              <strong>
                {formatPercentage(
                  offer?.predicted_conversion_percentage
                )}
              </strong>
            </div>

            <div className="offer-detail">
              <span>Expected Business Value</span>

              <strong>
                {formatCurrency(
                  offer?.expected_value
                )}
              </strong>
            </div>

            <div className="offer-detail">
              <span>Incremental Business Value</span>

              <strong>
                {formatCurrency(
                  offer?.incremental_business_value
                )}
              </strong>
            </div>

            <div className="offer-detail">
              <span>Coupon Sensitivity</span>

              <strong>
                {formatPercentage(
                  offer?.customer_profile
                    ?.coupon_sensitivity_percentage
                )}
              </strong>
            </div>

            <div className="offer-reason">
              <span>AI Decision Reason</span>

              <p>
                {offer?.decision_reason ||
                  "Analyzing customer behavior..."}
              </p>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-title">
              Discount Analysis
            </div>

            <div className="discount-list">
              {discountOptions.map(
                (option) => (
                  <div
                    className={
                      "discount-row " +
                      (option.discount ===
                      offer?.recommended_discount
                        ? "selected"
                        : "")
                    }
                    key={option.discount}
                  >
                    <div>
                      <strong>
                        ₹{option.discount}
                      </strong>

                      <span>discount</span>
                    </div>

                    <div>
                      <strong>
                        {formatPercentage(
                          option.conversion_percentage
                        )}
                      </strong>

                      <span>conversion</span>
                    </div>

                    <div>
                      <strong>
                        {formatCurrency(
                          option.expected_contribution
                        )}
                      </strong>

                      <span>expected value</span>
                    </div>
                  </div>
                )
              )}

              {discountOptions.length ===
                0 && (
                <p className="prediction-note">
                  Discount analysis is unavailable.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Machine Learning Model Performance</h2>

        <div className="two-column">
          <div className="dashboard-card">
            <div className="card-title">
              Customer Cuisine Model
            </div>

            <div className="model-name">
              {modelEvaluation?.model ||
                "Random Forest"}
            </div>

            <p>
              {modelEvaluation?.task ||
                "Customer Cuisine Prediction"}
            </p>

            <div className="model-accuracy">
              {formatPercentage(
                modelEvaluation?.accuracy_percentage
              )}
            </div>

            <div className="confidence-label">
              Model Accuracy
            </div>

            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{
                  width: `${Math.min(
                    Number(
                      modelEvaluation?.accuracy_percentage ??
                        0
                    ),
                    100
                  )}%`,
                }}
              />
            </div>

            <p className="prediction-note">
              Evaluation is based on the project's synthetic test dataset.
              This should not be interpreted as real-world production
              accuracy.
            </p>

            <div className="model-dataset">
              <div>
                <span>Training Customers</span>

                <strong>
                  {modelEvaluation?.training_customers ??
                    0}
                </strong>
              </div>

              <div>
                <span>Testing Customers</span>

                <strong>
                  {modelEvaluation?.testing_customers ??
                    0}
                </strong>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-title">
              Feature Importance
            </div>

            <div className="feature-list">
              {featureImportance
                .slice(0, 8)
                .map((feature) => (
                  <div
                    className="feature-row"
                    key={feature.feature}
                  >
                    <div className="feature-name">
                      {formatFeatureName(
                        feature.feature
                      )}
                    </div>

                    <div className="feature-bar">
                      <div
                        className="feature-fill"
                        style={{
                          width: `${Math.min(
                            Number(
                              feature.importance ??
                                0
                            ) * 500,
                            100
                          )}%`,
                        }}
                      />
                    </div>

                    <strong>
                      {(
                        Number(
                          feature.importance ??
                            0
                        ) * 100
                      ).toFixed(2)}
                      %
                    </strong>
                  </div>
                ))}

              {featureImportance.length ===
                0 && (
                <p className="prediction-note">
                  Feature importance is unavailable.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>Offer Response Model Performance</h2>

        <div className="two-column">
          <div className="dashboard-card">
            <div className="card-title">
              Offer Acceptance Model
            </div>

            <div className="model-name">
              {offerModelEvaluation?.model ||
                "Logistic Regression"}
            </div>

            <p>
              {offerModelEvaluation?.task ||
                "Offer Acceptance Prediction"}
            </p>

            <div className="model-performance-grid">
              <div className="performance-metric">
                <span>Accuracy</span>

                <strong>
                  {formatPercentage(
                    offerModelEvaluation?.accuracy_percentage
                  )}
                </strong>
              </div>

              <div className="performance-metric">
                <span>ROC-AUC</span>

                <strong>
                  {Number(
                    offerModelEvaluation?.roc_auc ??
                      0
                  ).toFixed(3)}
                </strong>
              </div>
            </div>

            <div className="confidence-label">
              Classification Accuracy
            </div>

            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{
                  width: `${Math.min(
                    Number(
                      offerModelEvaluation?.accuracy_percentage ??
                        0
                    ),
                    100
                  )}%`,
                }}
              />
            </div>

            <p className="prediction-note">
              Logistic Regression estimates the probability that a
              customer will accept a given discount.
            </p>

            <div className="model-dataset">
              <div>
                <span>Training Customers</span>

                <strong>
                  {offerModelEvaluation?.training_customers ??
                    0}
                </strong>
              </div>

              <div>
                <span>Testing Customers</span>

                <strong>
                  {offerModelEvaluation?.testing_customers ??
                    0}
                </strong>
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <div className="card-title">
              Offer Response Drivers
            </div>

            <p className="prediction-note">
              Larger absolute coefficients indicate stronger influence
              on the model prediction. Positive values increase
              predicted acceptance; negative values decrease it.
            </p>

            <div className="feature-list">
              {offerDrivers
                .slice(0, 8)
                .map((feature) => (
                  <div
                    className="feature-row"
                    key={feature.feature}
                  >
                    <div className="feature-name">
                      {formatFeatureName(
                        feature.feature
                      )}
                    </div>

                    <div className="feature-bar">
                      <div
                        className="feature-fill"
                        style={{
                          width: `${Math.min(
                            Number(
                              feature.absolute_coefficient ??
                                0
                            ) * 50,
                            100
                          )}%`,
                        }}
                      />
                    </div>

                    <strong>
                      {Number(
                        feature.coefficient ??
                          0
                      ) >= 0
                        ? "+"
                        : ""}
                      {Number(
                        feature.coefficient ??
                          0
                      ).toFixed(3)}
                    </strong>
                  </div>
                ))}

              {offerDrivers.length ===
                0 && (
                <p className="prediction-note">
                  Offer model drivers are unavailable.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <h2>AI Decision Pipeline</h2>

        <div className="pipeline">
          <div className="pipeline-step">
            <span>01</span>

            <strong>
              Customer Behavior
            </strong>

            <small>
              Searches, views, carts and orders
            </small>
          </div>

          <div className="pipeline-arrow">
            →
          </div>

          <div className="pipeline-step">
            <span>02</span>

            <strong>
              Feature Engineering
            </strong>

            <small>
              Behavioral ML features
            </small>
          </div>

          <div className="pipeline-arrow">
            →
          </div>

          <div className="pipeline-step">
            <span>03</span>

            <strong>
              Cuisine Prediction
            </strong>

            <small>
              Random Forest classifier
            </small>
          </div>

          <div className="pipeline-arrow">
            →
          </div>

          <div className="pipeline-step">
            <span>04</span>

            <strong>
              Recommendations
            </strong>

            <small>
              Personalized restaurants
            </small>
          </div>

          <div className="pipeline-arrow">
            →
          </div>

          <div className="pipeline-step">
            <span>05</span>

            <strong>
              Offer Response
            </strong>

            <small>
              Acceptance probability
            </small>
          </div>

          <div className="pipeline-arrow">
            →
          </div>

          <div className="pipeline-step">
            <span>06</span>

            <strong>
              Offer Optimization
            </strong>

            <small>
              Conversion + business value
            </small>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-card">
          <div className="card-title">
            Production Architecture Status
          </div>

          <div
            className="model-dataset"
            style={{
              gridTemplateColumns:
                "repeat(3, 1fr)",
            }}
          >
            <div>
              <span>
                Customer Interface
              </span>

              <strong>
                Prototype Ready
              </strong>
            </div>

            <div>
              <span>
                AI Intelligence
              </span>

              <strong>
                Implemented
              </strong>
            </div>

            <div>
              <span>
                Authentication
              </span>

              <strong>
                Implemented
              </strong>
            </div>
          </div>

          <p className="prediction-note">
            FoodAI uses JWT authentication and role-based authorization.
            Customer and company access are separated, and protected
            backend endpoints prevent unauthorized access to company
            functionality.
          </p>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
