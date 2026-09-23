import pandas as pd

from database import SessionLocal
from models import CustomerBehavior


def analyze_customer_preferences(customer_id):
    db = SessionLocal()

    behaviors = (
        db.query(CustomerBehavior)
        .filter(CustomerBehavior.customer_id == customer_id)
        .all()
    )

    db.close()

    if not behaviors:
        return {
            "customer_id": customer_id,
            "message": "No behavior data found"
        }

    data = []

    for behavior in behaviors:
        data.append({
            "action": behavior.action,
            "item": behavior.item,
            "restaurant": behavior.restaurant,
            "cuisine": behavior.cuisine,
            "order_value": behavior.order_value
        })

    df = pd.DataFrame(data)

    # --------------------------------------------------
    # Cuisine preference
    # --------------------------------------------------

    cuisine_counts = (
        df["cuisine"]
        .replace("", pd.NA)
        .dropna()
        .value_counts()
    )

    if cuisine_counts.empty:
        favorite_cuisine = "Unknown"
        confidence = 0
    else:
        favorite_cuisine = cuisine_counts.index[0]

        total_interactions = cuisine_counts.sum()

        confidence = round(
            (
                cuisine_counts.iloc[0]
                / total_interactions
            ) * 100,
            2
        )

    # --------------------------------------------------
    # Observed orders from behavior events
    # --------------------------------------------------

    order_count = int(
        (
            df["action"]
            .fillna("")
            .str.lower()
            == "order"
        ).sum()
    )

    # --------------------------------------------------
    # Average value of observed orders
    # --------------------------------------------------

    order_values = df.loc[
        (
            df["action"]
            .fillna("")
            .str.lower()
            == "order"
        ),
        "order_value"
    ]

    if not order_values.empty:

        average_order_value = round(
            order_values.mean(),
            2
        )

    else:

        average_order_value = 0

    return {

        "customer_id":
            customer_id,

        "favorite_cuisine":
            favorite_cuisine,

        "preference_confidence":
            confidence,

        "total_interactions":
            len(df),

        # These are behavior events observed
        # by the AI system, not lifetime orders.
        "observed_orders":
            order_count,

        "observed_average_order_value":
            average_order_value
    }