import pandas as pd

from database import SessionLocal
from models import CustomerBehavior


def create_customer_features():

    db = SessionLocal()

    behaviors = db.query(CustomerBehavior).all()

    db.close()

    if not behaviors:
        print("No behavior data found.")
        return

    # Convert database records into a DataFrame
    data = []

    for behavior in behaviors:
        data.append({
            "customer_id": behavior.customer_id,
            "action": behavior.action,
            "cuisine": behavior.cuisine,
            "order_value": behavior.order_value
        })

    df = pd.DataFrame(data)

    print("\nRaw behavior data:")
    print(df.head())

    # --------------------------------------------------
    # CREATE CUSTOMER FEATURES
    # --------------------------------------------------

    features = df.groupby("customer_id").agg(

        total_interactions=("action", "count"),

        total_orders=(
            "action",
            lambda x: (x == "order").sum()
        ),

        total_searches=(
            "action",
            lambda x: (x == "search").sum()
        ),

        total_restaurant_views=(
            "action",
            lambda x: (x == "view_restaurant").sum()
        ),

        total_item_views=(
            "action",
            lambda x: (x == "view_item").sum()
        ),

        total_cart_additions=(
            "action",
            lambda x: (x == "add_to_cart").sum()
        ),

        coupon_usage=(
            "action",
            lambda x: (x == "coupon_used").sum()
        ),

        average_order_value=(
            "order_value",
            lambda x: x[x > 0].mean()
            if (x > 0).any()
            else 0
        )
    )

    # --------------------------------------------------
    # CUISINE FEATURES
    # --------------------------------------------------

    cuisine_counts = pd.crosstab(
        df["customer_id"],
        df["cuisine"]
    )

    cuisine_counts.columns = [
        f"cuisine_{column}"
        for column in cuisine_counts.columns
    ]

    # Combine customer features with cuisine features
    features = features.join(
        cuisine_counts,
        how="left"
    )

    features = features.fillna(0)

    # --------------------------------------------------
    # DISPLAY RESULT
    # --------------------------------------------------

    print("\nCustomer ML Features:")
    print(features.head())

    print("\nFeature dataset shape:")
    print(features.shape)

    print("\nFeature columns:")
    for column in features.columns:
        print("-", column)

    return features


if __name__ == "__main__":
    create_customer_features()