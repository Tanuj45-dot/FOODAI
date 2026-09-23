import os
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

from database import SessionLocal
from models import CustomerBehavior, Customer


# --------------------------------------------------
# MODEL FILE
# --------------------------------------------------

MODEL_FILE = "customer_cuisine_model.pkl"


# --------------------------------------------------
# LOAD DATA
# --------------------------------------------------

def load_data():

    db = SessionLocal()

    behaviors = db.query(CustomerBehavior).all()
    customers = db.query(Customer).all()

    db.close()

    behavior_data = []

    for behavior in behaviors:
        behavior_data.append({
            "customer_id": behavior.customer_id,
            "action": behavior.action,
            "cuisine": behavior.cuisine,
            "order_value": behavior.order_value
        })

    customer_data = []

    for customer in customers:
        customer_data.append({
            "customer_id": customer.id,
            "favorite_food": customer.favorite_food
        })

    return (
        pd.DataFrame(behavior_data),
        pd.DataFrame(customer_data)
    )


# --------------------------------------------------
# CREATE FEATURES
# --------------------------------------------------

def create_features(behavior_df):

    features = behavior_df.groupby(
        "customer_id"
    ).agg(

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

    # Cuisine interaction counts

    cuisine_counts = pd.crosstab(
        behavior_df["customer_id"],
        behavior_df["cuisine"]
    )

    cuisine_counts.columns = [
        f"cuisine_{column}"
        for column in cuisine_counts.columns
    ]

    features = features.join(
        cuisine_counts,
        how="left"
    )

    features = features.fillna(0)

    return features


# --------------------------------------------------
# TRAIN AND SAVE MODEL
# --------------------------------------------------

def train_and_save_model():

    print("Training customer cuisine model...")

    behavior_df, customer_df = load_data()

    if behavior_df.empty:
        raise Exception(
            "No behavior data found."
        )

    features = create_features(
        behavior_df
    )

    dataset = features.merge(
        customer_df,
        on="customer_id"
    )

    feature_columns = list(
        features.columns
    )

    X = dataset[feature_columns]

    y = dataset["favorite_food"]

    # Train model

    model = RandomForestClassifier(
        n_estimators=100,
        random_state=42
    )

    model.fit(
        X,
        y
    )

    # Save model and feature names

    model_data = {
        "model": model,
        "feature_columns": feature_columns
    }

    joblib.dump(
        model_data,
        MODEL_FILE
    )

    print(
        f"Model saved to: {MODEL_FILE}"
    )

    return model_data


# --------------------------------------------------
# LOAD MODEL
# --------------------------------------------------

def load_model():

    if not os.path.exists(
        MODEL_FILE
    ):

        return train_and_save_model()

    return joblib.load(
        MODEL_FILE
    )


# --------------------------------------------------
# GET CUSTOMER FEATURES
# --------------------------------------------------

def get_customer_features(customer_id):

    db = SessionLocal()

    behaviors = (
        db.query(CustomerBehavior)
        .filter(
            CustomerBehavior.customer_id
            == customer_id
        )
        .all()
    )

    db.close()

    if not behaviors:
        return None

    data = []

    for behavior in behaviors:

        data.append({
            "customer_id": behavior.customer_id,
            "action": behavior.action,
            "cuisine": behavior.cuisine,
            "order_value": behavior.order_value
        })

    behavior_df = pd.DataFrame(
        data
    )

    return create_features(
        behavior_df
    )


# --------------------------------------------------
# PREDICT CUSTOMER CUISINE
# --------------------------------------------------

def predict_customer_cuisine(
    customer_id
):

    model_data = load_model()

    model = model_data["model"]

    feature_columns = model_data[
        "feature_columns"
    ]

    features = get_customer_features(
        customer_id
    )

    if features is None:

        return {
            "customer_id": customer_id,
            "message": "No behavior data found"
        }

    # Make sure every training feature exists

    for column in feature_columns:

        if column not in features.columns:

            features[column] = 0

    # Keep the exact training column order

    features = features[
        feature_columns
    ]

    # Prediction

    prediction = model.predict(
        features
    )[0]

    # Prediction probabilities

    probabilities = model.predict_proba(
        features
    )[0]

    classes = model.classes_

    probability_data = {}

    for cuisine, probability in zip(
        classes,
        probabilities
    ):

        probability_data[cuisine] = round(
            float(probability),
            4
        )

    confidence = max(
        probabilities
    )

    return {
        "customer_id": customer_id,
        "predicted_cuisine": prediction,
        "confidence": round(
            float(confidence),
            4
        ),
        "confidence_percentage": round(
            float(confidence * 100),
            2
        ),
        "probabilities": probability_data
    }