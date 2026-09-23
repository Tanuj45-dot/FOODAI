import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report
)

from database import SessionLocal
from models import Customer, CustomerBehavior


# --------------------------------------------------
# MODEL FILE
# --------------------------------------------------

MODEL_FILE = "customer_cuisine_model.pkl"


# --------------------------------------------------
# LOAD BEHAVIOR DATA
# --------------------------------------------------

def load_data():

    db = SessionLocal()

    behaviors = db.query(
        CustomerBehavior
    ).all()

    customers = db.query(
        Customer
    ).all()

    db.close()

    behavior_data = []

    for behavior in behaviors:

        behavior_data.append({

            "customer_id":
                behavior.customer_id,

            "action":
                behavior.action,

            "cuisine":
                behavior.cuisine,

            "order_value":
                behavior.order_value

        })

    customer_data = []

    for customer in customers:

        customer_data.append({

            "customer_id":
                customer.id,

            "favorite_food":
                customer.favorite_food

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

        total_interactions=(
            "action",
            "count"
        ),

        total_orders=(
            "action",
            lambda x:
                (x == "order").sum()
        ),

        total_searches=(
            "action",
            lambda x:
                (x == "search").sum()
        ),

        total_restaurant_views=(
            "action",
            lambda x:
                (x == "view_restaurant").sum()
        ),

        total_item_views=(
            "action",
            lambda x:
                (x == "view_item").sum()
        ),

        total_cart_additions=(
            "action",
            lambda x:
                (x == "add_to_cart").sum()
        ),

        coupon_usage=(
            "action",
            lambda x:
                (x == "coupon_used").sum()
        ),

        average_order_value=(
            "order_value",
            lambda x:
                x[x > 0].mean()
                if (x > 0).any()
                else 0
        )

    )

    # --------------------------------------------------
    # CUISINE INTERACTION FEATURES
    # --------------------------------------------------

    cuisine_counts = pd.crosstab(
        behavior_df["customer_id"],
        behavior_df["cuisine"]
    )

    cuisine_counts.columns = [

        f"cuisine_{column}"

        for column
        in cuisine_counts.columns

    ]

    features = features.join(
        cuisine_counts,
        how="left"
    )

    features = features.fillna(0)

    return features


# --------------------------------------------------
# TRAIN MODEL
# --------------------------------------------------

def train_model():

    print("\nLoading data...")

    behavior_df, customer_df = load_data()

    if behavior_df.empty:

        print(
            "No behavior data found."
        )

        return

    print(
        f"Behavior records: "
        f"{len(behavior_df)}"
    )

    print(
        f"Customers: "
        f"{len(customer_df)}"
    )

    # --------------------------------------------------
    # CREATE FEATURES
    # --------------------------------------------------

    features = create_features(
        behavior_df
    )

    # --------------------------------------------------
    # ADD TARGET LABEL
    # --------------------------------------------------

    dataset = features.merge(
        customer_df,
        on="customer_id"
    )

    print(
        f"ML dataset shape: "
        f"{dataset.shape}"
    )

    # --------------------------------------------------
    # FEATURES AND TARGET
    # --------------------------------------------------

    feature_columns = list(
        features.columns
    )

    X = dataset[
        feature_columns
    ]

    y = dataset[
        "favorite_food"
    ]

    print(
        "\nFeatures used by model:"
    )

    for column in feature_columns:

        print(
            "-",
            column
        )

    print(
        "\nTarget classes:"
    )

    print(
        sorted(
            y.unique()
        )
    )

    # --------------------------------------------------
    # TRAIN / TEST SPLIT
    # --------------------------------------------------

    X_train, X_test, y_train, y_test = (
        train_test_split(

            X,

            y,

            test_size=0.20,

            random_state=42,

            stratify=y

        )
    )

    print(
        "\nTraining customers:",
        len(X_train)
    )

    print(
        "Testing customers:",
        len(X_test)
    )

    # --------------------------------------------------
    # RANDOM FOREST
    # --------------------------------------------------

    print(
        "\nTraining Random Forest model..."
    )

    model = RandomForestClassifier(

        n_estimators=100,

        random_state=42

    )

    model.fit(
        X_train,
        y_train
    )

    # --------------------------------------------------
    # EVALUATION
    # --------------------------------------------------

    predictions = model.predict(
        X_test
    )

    accuracy = accuracy_score(
        y_test,
        predictions
    )

    report = classification_report(
        y_test,
        predictions,
        output_dict=True
    )

    report_text = classification_report(
        y_test,
        predictions
    )

    print(
        "\n=============================="
    )

    print(
        "MODEL RESULTS"
    )

    print(
        "=============================="
    )

    print(
        f"Accuracy: "
        f"{accuracy * 100:.2f}%"
    )

    print(
        "\nClassification Report:"
    )

    print(
        report_text
    )

    # --------------------------------------------------
    # FEATURE IMPORTANCE
    # --------------------------------------------------

    print(
        "\nFeature Importance:"
    )

    importance = pd.DataFrame({

        "feature":
            feature_columns,

        "importance":
            model.feature_importances_

    })

    importance = importance.sort_values(

        "importance",

        ascending=False

    )

    print(
        importance.to_string(
            index=False
        )
    )

    # --------------------------------------------------
    # SAMPLE PREDICTIONS
    # --------------------------------------------------

    print(
        "\nSample Predictions:"
    )

    sample_ids = X_test.index[:10]

    sample = X_test.loc[
        sample_ids
    ]

    sample_predictions = model.predict(
        sample
    )

    for customer_id, prediction in zip(

        sample.index,

        sample_predictions

    ):

        actual = dataset.loc[
            customer_id,
            "favorite_food"
        ]

        print(

            f"Customer {customer_id} "
            f"-> Predicted: {prediction} "
            f"| Actual: {actual}"

        )

    # --------------------------------------------------
    # PREPARE EVALUATION DATA
    # --------------------------------------------------

    feature_importance_data = []

    for _, row in importance.iterrows():

        feature_importance_data.append({

            "feature":
                row["feature"],

            "importance":
                float(
                    row["importance"]
                )

        })

    evaluation = {

        "accuracy":
            float(accuracy),

        "training_customers":
            int(len(X_train)),

        "testing_customers":
            int(len(X_test)),

        "classification_report":
            report,

        "feature_importance":
            feature_importance_data

    }

    # --------------------------------------------------
    # SAVE MODEL
    # --------------------------------------------------

    model_data = {

        "model":
            model,

        "feature_columns":
            feature_columns,

        "evaluation":
            evaluation

    }

    joblib.dump(
        model_data,
        MODEL_FILE
    )

    print(
        "\n=============================="
    )

    print(
        "MODEL SAVED"
    )

    print(
        "=============================="
    )

    print(
        f"Saved to: "
        f"{MODEL_FILE}"
    )

    print(
        "\nML model training "
        "completed successfully!"
    )


# --------------------------------------------------
# RUN
# --------------------------------------------------

if __name__ == "__main__":

    train_model()