import joblib

from database import SessionLocal
import models


MODEL_FILE = "offer_response_model.pkl"

def build_discount_options(max_discount_amount):
    """Build AI discount candidates strictly within the restaurant's cap."""
    cap = max(float(max_discount_amount or 0), 0.0)

    if cap <= 0:
        return [0.0]

    options = [
        float(discount)
        for discount in range(0, int(cap) + 1, 10)
    ]

    # Include the exact restaurant cap when it is not a multiple of ₹10.
    if cap not in options:
        options.append(cap)

    return sorted(set(options))


# Estimated contribution margin after
# food, operations and platform costs.
#
# This is a business assumption for the
# simulation, not a learned ML parameter.
CONTRIBUTION_MARGIN = 0.25


# Minimum percentage of the maximum expected
# contribution that an offer must achieve
# to be considered economically effective.
#
# The optimizer then chooses the SMALLEST
# discount meeting this threshold.
MIN_EFFECTIVE_VALUE_RATIO = 0.99


def load_model():

    model_data = joblib.load(
        MODEL_FILE
    )

    return (
        model_data["model"],
        model_data["feature_columns"]
    )


def load_customer(customer_id):

    db = SessionLocal()

    try:

        customer = db.query(
            models.Customer
        ).filter(
            models.Customer.id == customer_id
        ).first()

        if customer is None:

            raise ValueError(
                f"Customer {customer_id} not found."
            )

        return {
            "customer_id": customer.id,
            "favorite_food": customer.favorite_food,
            "average_order_value": float(
                customer.average_order_value or 0
            ),
            "coupon_sensitivity": float(
                customer.coupon_sensitivity or 0
            )
        }

    finally:

        db.close()


def predict_conversion(
    model,
    feature_columns,
    customer,
    discount
):

    row = {

        "average_order_value":
            float(
                customer[
                    "average_order_value"
                ]
            ),

        "coupon_sensitivity":
            float(
                customer[
                    "coupon_sensitivity"
                ]
            ),

        "discount":
            discount
    }


    # Recreate the one-hot cuisine
    # features used during training.

    for column in feature_columns:

        if column.startswith(
            "favorite_food_"
        ):

            cuisine = column.replace(
                "favorite_food_",
                ""
            )

            row[column] = int(

                customer[
                    "favorite_food"
                ] == cuisine

            )


    # Keep exactly the same feature order
    # used by the trained model.

    import pandas as pd

    X = pd.DataFrame(
        [row]
    )[feature_columns]


    probability = model.predict_proba(
        X
    )[0][1]


    return probability



def load_behavior_profile(customer_id):
    """Build historical discount-response signals without changing ML features."""
    db = SessionLocal()

    try:
        behaviors = (
            db.query(models.CustomerBehavior)
            .filter(models.CustomerBehavior.customer_id == customer_id)
            .order_by(models.CustomerBehavior.timestamp.asc())
            .all()
        )

        coupons = (
            db.query(models.Coupon)
            .filter(models.Coupon.customer_id == customer_id)
            .order_by(models.Coupon.created_at.asc())
            .all()
        )

        order_events = [
            b for b in behaviors
            if (b.action or "").lower() == "order"
        ]

        cart_events = [
            b for b in behaviors
            if (b.action or "").lower() in {
                "cart", "add_to_cart", "cart_add"
            }
        ]

        abandonment_events = [
            b for b in behaviors
            if (b.action or "").lower() in {
                "cart_abandon", "cart_abandoned", "abandon_cart"
            }
        ]

        coupon_events = [
            c for c in coupons
            if (c.status or "").lower() in {"applied", "redeemed"}
        ]

        redeemed_events = [
            c for c in coupons
            if (c.status or "").lower() == "redeemed"
        ]

        historical_discounts = [
            float(c.discount_amount or 0)
            for c in coupon_events
            if float(c.discount_amount or 0) > 0
        ]

        average_historical_discount = (
            sum(historical_discounts) / len(historical_discounts)
            if historical_discounts else 0.0
        )

        coupon_order_response_rate = (
            len(redeemed_events) / len(coupon_events)
            if coupon_events else 0.0
        )

        abandonment_rate = (
            len(abandonment_events) / max(len(cart_events), 1)
        )

        restaurant_counts = {}
        food_counts = {}

        for behavior in behaviors:
            restaurant = (behavior.restaurant or "").strip().lower()
            item = (behavior.item or "").strip().lower()

            if restaurant:
                restaurant_counts[restaurant] = (
                    restaurant_counts.get(restaurant, 0) + 1
                )

            if item:
                food_counts[item] = food_counts.get(item, 0) + 1

        return {
            "order_count": len(order_events),
            "coupon_events": len(coupon_events),
            "redeemed_coupon_events": len(redeemed_events),
            "average_historical_discount": average_historical_discount,
            "coupon_order_response_rate": coupon_order_response_rate,
            "abandonment_rate": min(max(abandonment_rate, 0.0), 1.0),
            "restaurant_counts": restaurant_counts,
            "food_counts": food_counts
        }

    finally:
        db.close()


def apply_behavioral_adjustment(
    results,
    behavior_profile,
    coupon_sensitivity
):
    """
    Use historical behavior as a secondary decision signal.
    The trained ML model remains unchanged.
    """
    sensitivity = min(max(float(coupon_sensitivity or 0), 0.0), 1.0)

    average_discount = float(
        behavior_profile["average_historical_discount"] or 0
    )

    response_rate = min(
        max(float(
            behavior_profile["coupon_order_response_rate"] or 0
        ), 0.0),
        1.0
    )

    abandonment_rate = min(
        max(float(
            behavior_profile["abandonment_rate"] or 0
        ), 0.0),
        1.0
    )

    for result in results:
        discount = float(result["discount"])

        if average_discount > 0:
            distance = abs(discount - average_discount)
            historical_fit = max(
                0.0,
                1.0 - (distance / max(average_discount, 10.0))
            )
        else:
            historical_fit = 0.0

        behavioral_factor = (
            1.0
            + (0.12 * sensitivity * historical_fit)
            + (0.08 * response_rate * historical_fit)
            + (0.05 * abandonment_rate * (
                1.0 if discount > 0 else 0.0
            ))
        )

        if discount == 0:
            behavioral_factor = 1.0

        result["behavioral_factor"] = behavioral_factor
        result["behavior_adjusted_contribution"] = (
            result["expected_contribution"] * behavioral_factor
        )

    return results


def optimize_offer(customer_id, max_discount_amount=50):

    model, feature_columns = (
        load_model()
    )


    customer = load_customer(
        customer_id
    )

    behavior_profile = load_behavior_profile(
        customer_id
    )


    average_order_value = float(
        customer[
            "average_order_value"
        ]
    )


    coupon_sensitivity = float(
        customer[
            "coupon_sensitivity"
        ]
    )


    print("\n==============================")
    print("DYNAMIC OFFER OPTIMIZER")
    print("==============================")


    print("\nCustomer Profile:")

    print({

        "favorite_food":
            customer[
                "favorite_food"
            ],

        "average_order_value":
            average_order_value,

        "coupon_sensitivity":
            coupon_sensitivity,

        "coupon_sensitivity_percentage":
            round(
                coupon_sensitivity * 100,
                2
            ),

        "historical_coupon_count":
            behavior_profile["coupon_events"],

        "historical_redeemed_coupon_count":
            behavior_profile["redeemed_coupon_events"],

        "average_historical_discount":
            round(
                behavior_profile["average_historical_discount"],
                2
            ),

        "coupon_order_response_rate":
            round(
                behavior_profile["coupon_order_response_rate"] * 100,
                2
            ),

        "abandonment_rate":
            round(
                behavior_profile["abandonment_rate"] * 100,
                2
            ),

        "contribution_margin":
            f"{CONTRIBUTION_MARGIN * 100:.0f}%"

    })


    # ------------------------------------------
    # BASELINE
    # ------------------------------------------

    baseline_probability = (
        predict_conversion(

            model,

            feature_columns,

            customer,

            0

        )
    )


    baseline_contribution = (

        baseline_probability

        * average_order_value

        * CONTRIBUTION_MARGIN

    )


    print(
        f"\nBaseline conversion "
        f"without discount: "
        f"{baseline_probability * 100:.2f}%"
    )


    print(
        f"Baseline expected contribution: "
        f"₹{baseline_contribution:.2f}"
    )


    results = []

    discount_options = build_discount_options(
        max_discount_amount
    )

    print(
        f"\nRestaurant discount ceiling supplied to AI: "
        f"₹{float(max_discount_amount or 0):.2f}"
    )

    print("\nDiscount Analysis:")


    # ------------------------------------------
    # EVALUATE EVERY DISCOUNT
    # ------------------------------------------

    for discount in discount_options:

        conversion_probability = (
            predict_conversion(

                model,

                feature_columns,

                customer,

                discount

            )
        )


        # Contribution generated by an
        # order after applying the coupon.

        contribution_per_order = (

            max(

                average_order_value
                - discount,

                0

            )

            * CONTRIBUTION_MARGIN

        )


        # Expected contribution from
        # this offer.

        expected_contribution = (

            conversion_probability

            * contribution_per_order

        )


        # Compare against the customer's
        # expected contribution without
        # a discount.

        incremental_contribution = (

            expected_contribution
            - baseline_contribution

        )


        result = {

            "discount":
                discount,

            "conversion_probability":
                conversion_probability,

            "conversion_percentage":
                conversion_probability * 100,

            "expected_contribution":
                expected_contribution,

            "incremental_contribution":
                incremental_contribution

        }


        results.append(
            result
        )


    results = apply_behavioral_adjustment(
        results,
        behavior_profile,
        coupon_sensitivity
    )


    print(

            f"₹{discount} off -> "

            f"{conversion_probability * 100:.2f}% "

            "conversion | "

            f"Expected contribution: "

            f"₹{expected_contribution:.2f} | "

            f"Behavior-adjusted value: "
            f"₹{result['behavior_adjusted_contribution']:.2f} | "

            f"Incremental contribution: "

            f"₹{incremental_contribution:.2f}"

        )


    # ------------------------------------------
    # FIND BEST ECONOMIC OUTCOME
    # ------------------------------------------

    maximum_contribution = max(

        item[
            "behavior_adjusted_contribution"
        ]

        for item in results

    )


    # ------------------------------------------
    # NO-OFFER DECISION
    #
    # If the best discounted option does not
    # improve expected business contribution
    # over the natural baseline, the system
    # explicitly chooses NO OFFER.
    # ------------------------------------------

    best_discounted_offer = max(

        results,

        key=lambda item:
            item[
                "behavior_adjusted_contribution"
            ]

    )


    best_discounted_incremental = (

        best_discounted_offer[
            "incremental_contribution"
        ]

    )


    if best_discounted_incremental <= 0:

        recommended_discount = 0

        predicted_conversion = (
            baseline_probability * 100
        )

        expected_contribution = (
            baseline_contribution
        )

        incremental_contribution = 0


        reason = (

            "The ML model predicts that "
            "the customer is better served "
            "without a discount because no "
            "available offer increases expected "
            "business contribution. The system "
            "therefore recommends no offer."

        )


    else:

        # --------------------------------------
        # MINIMUM EFFECTIVE DISCOUNT
        # --------------------------------------

        minimum_effective_contribution = (

            maximum_contribution

            * MIN_EFFECTIVE_VALUE_RATIO

        )


        effective_offers = [

            item

            for item in results

            if (

                item[
                    "behavior_adjusted_contribution"
                ]

                >=

                minimum_effective_contribution

            )

            and

            item[
                "incremental_contribution"
            ] > 0

        ]


        best_offer = min(

            effective_offers,

            key=lambda item:
                item[
                    "discount"
                ]

        )


        recommended_discount = (

            best_offer[
                "discount"
            ]

        )


        predicted_conversion = (

            best_offer[
                "conversion_percentage"
            ]

        )


        expected_contribution = (

            best_offer[
                "expected_contribution"
            ]

        )


        incremental_contribution = (

            best_offer[
                "incremental_contribution"
            ]

        )


        if (

            recommended_discount
            < best_discounted_offer[
                "discount"
            ]

        ):

            reason = (

                f"The ML model predicts that "
                f"₹{best_discounted_offer['discount']} "
                f"off has the highest expected "
                f"business contribution, but "
                f"₹{recommended_discount} off achieves "
                f"at least "
                f"{MIN_EFFECTIVE_VALUE_RATIO * 100:.0f}% "
                f"of that value. The system therefore "
                f"selects the minimum effective discount "
                f"to reduce unnecessary discount cost."

            )

        else:

            reason = (

                f"The ML model predicts that "
                f"₹{recommended_discount} off produces "
                f"the highest expected business "
                f"contribution after accounting for "
                f"the {CONTRIBUTION_MARGIN * 100:.0f}% "
                f"contribution margin and discount cost."

            )


    # ------------------------------------------
    # FINAL DECISION
    # ------------------------------------------

    print("\n==============================")
    print("FINAL OFFER DECISION")
    print("==============================")


    if recommended_discount == 0:

        print(
            "Recommended offer: NO OFFER"
        )

    else:

        print(
            f"Recommended discount: "
            f"₹{recommended_discount}"
        )


    print(

        f"Predicted conversion: "
        f"{predicted_conversion:.2f}%"

    )


    print(

        f"Expected contribution: "
        f"₹{expected_contribution:.2f}"

    )


    print(

        f"Incremental contribution: "
        f"₹{incremental_contribution:.2f}"

    )


    print("\nReason:")

    print(reason)


    return {

        "customer_id":
            int(customer_id),

        "customer_profile": {

            "favorite_food":
                customer[
                    "favorite_food"
                ],

            "average_order_value":
                average_order_value,

            "restaurant_max_discount_amount":
                float(max_discount_amount or 0),

            "coupon_sensitivity":
                coupon_sensitivity,

            "coupon_sensitivity_percentage":
                round(
                    coupon_sensitivity * 100,
                    2
                ),

            "contribution_margin":
                f"{CONTRIBUTION_MARGIN * 100:.0f}%",

            "restaurant_max_discount_amount":
                float(max_discount_amount or 0)

        },

        "recommended_discount":
            recommended_discount,

        "predicted_conversion_percentage":
            predicted_conversion,

        "expected_value":
            expected_contribution,

        "incremental_business_value":
            incremental_contribution,

        "discount_analysis":
            results,

        "behavior_profile":
            behavior_profile,

        "decision_reason":
            reason

    }


if __name__ == "__main__":

    optimize_offer(
        customer_id=1
    )