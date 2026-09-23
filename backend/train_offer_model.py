import pandas as pd
import joblib

from sklearn.model_selection import GroupShuffleSplit
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    roc_auc_score
)


DATA_FILE = "offer_response_data.csv"
MODEL_FILE = "offer_response_model.pkl"


def train_model():

    print("\nLoading offer-response data...")

    df = pd.read_csv(DATA_FILE)

    print(
        f"Offer interactions: {len(df)}"
    )

    print(
        f"Unique customers: "
        f"{df['customer_id'].nunique()}"
    )


    # Convert cuisine into numerical
    # one-hot encoded columns.
    df = pd.get_dummies(
        df,
        columns=["favorite_food"],
        dtype=int
    )


    # Features used by the model.
    feature_columns = [

        column

        for column in df.columns

        if column not in [
            "customer_id",
            "accepted",
            "conversion_probability"
        ]

    ]


    X = df[feature_columns]

    y = df["accepted"]

    groups = df["customer_id"]


    print("\nFeatures used by model:")

    for column in feature_columns:

        print(
            "-",
            column
        )


    print("\nTarget:")

    print(
        "accepted = 0 -> Offer rejected"
    )

    print(
        "accepted = 1 -> Offer accepted"
    )


    # --------------------------------------------------
    # CUSTOMER-LEVEL TRAIN / TEST SPLIT
    # --------------------------------------------------
    #
    # Important:
    # Records belonging to the same customer must not
    # appear in both training and testing data.
    #
    # This gives us a more realistic evaluation of how
    # the model performs on customers it has not seen.
    #

    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=0.20,
        random_state=42
    )


    train_indices, test_indices = next(

        splitter.split(
            X,
            y,
            groups=groups
        )

    )


    X_train = X.iloc[train_indices]

    X_test = X.iloc[test_indices]

    y_train = y.iloc[train_indices]

    y_test = y.iloc[test_indices]


    train_customers = (
        df.iloc[train_indices]["customer_id"]
        .nunique()
    )

    test_customers = (
        df.iloc[test_indices]["customer_id"]
        .nunique()
    )


    print(
        "\nTraining records:",
        len(X_train)
    )

    print(
        "Testing records:",
        len(X_test)
    )

    print(
        "Training customers:",
        train_customers
    )

    print(
        "Testing customers:",
        test_customers
    )


    print(
        "\nTraining Logistic Regression "
        "offer-response model..."
    )


    model = LogisticRegression(

        max_iter=1000,

        random_state=42

    )


    model.fit(
        X_train,
        y_train
    )


    predictions = model.predict(
        X_test
    )


    probabilities = model.predict_proba(
        X_test
    )[:, 1]


    accuracy = accuracy_score(
        y_test,
        predictions
    )


    auc = roc_auc_score(
        y_test,
        probabilities
    )


    print("\n==============================")
    print("OFFER MODEL RESULTS")
    print("==============================")


    print(
        f"Accuracy: "
        f"{accuracy * 100:.2f}%"
    )


    print(
        f"ROC-AUC: "
        f"{auc:.4f}"
    )


    print(
        "\nClassification Report:"
    )


    print(
        classification_report(
            y_test,
            predictions
        )
    )


    print(
        "\nModel Coefficients:"
    )


    coefficients = pd.DataFrame({

        "feature":
            feature_columns,

        "coefficient":
            model.coef_[0]

    })


    coefficients[
        "absolute_coefficient"
    ] = coefficients[
        "coefficient"
    ].abs()


    coefficients = coefficients.sort_values(

        "absolute_coefficient",

        ascending=False

    )


    print(

        coefficients[

            [
                "feature",
                "coefficient"
            ]

        ].to_string(
            index=False
        )

    )


    # Save model and feature information.
    model_data = {

        "model":
            model,

        "feature_columns":
            feature_columns,

        "evaluation": {

            "accuracy":
                float(accuracy),

            "roc_auc":
                float(auc),

            "training_customers":
                int(train_customers),

            "testing_customers":
                int(test_customers)

        }

    }


    joblib.dump(

        model_data,

        MODEL_FILE

    )


    print("\n==============================")
    print("MODEL SAVED")
    print("==============================")


    print(
        f"Saved to: {MODEL_FILE}"
    )


    print(
        "\nOffer-response model training "
        "completed successfully!"
    )


if __name__ == "__main__":

    train_model()