import random
import csv

from database import SessionLocal
from models import Customer


OUTPUT_FILE = "offer_response_data.csv"

DISCOUNTS = [0, 10, 20, 30, 40, 50]

OFFERS_PER_CUSTOMER = 30


def calculate_conversion_probability(
    base_probability,
    discount,
    customer_aov,
    coupon_sensitivity
):
    """
    Simulate the probability that a customer
    accepts an offer and places an order.

    Higher coupon sensitivity means the customer
    responds more strongly to discounts.

    The effect is based on the discount as a
    percentage of the customer's average order value.
    """

    discount_ratio = (
        discount / max(customer_aov, 1)
    )

    # Normalize sensitivity into a stronger
    # behavioral signal for the simulation.
    #
    # A sensitivity of 0.20 represents a customer
    # who is relatively resistant to discounts.
    #
    # A sensitivity of 0.80 represents a customer
    # who is highly responsive to discounts.

    sensitivity_effect = (
        0.5
        + coupon_sensitivity * 2.0
    )

    discount_effect = (
        discount_ratio
        * 2.5
        * sensitivity_effect
    )

    probability = (
        base_probability
        + discount_effect
    )

    # Keep probabilities realistic.
    probability = max(
        probability,
        0.03
    )

    probability = min(
        probability,
        0.90
    )

    return probability


print(
    "Generating synthetic offer-response data..."
)


db = SessionLocal()

customers = (
    db.query(Customer)
    .all()
)

db.close()


if not customers:

    print(
        "No customers found."
    )

    raise SystemExit


rows = []


for customer in customers:

    sensitivity = (
        float(
            customer.coupon_sensitivity
        )
    )

    # Natural probability of ordering
    # without a discount.
    #
    # Customers with higher coupon sensitivity
    # are slightly more likely to respond to offers,
    # but they do not automatically receive a discount.

    base_probability = (
        0.12
        + sensitivity * 0.18
    )

    for _ in range(
        OFFERS_PER_CUSTOMER
    ):

        discount = random.choice(
            DISCOUNTS
        )

        conversion_probability = (
            calculate_conversion_probability(

                base_probability,

                discount,

                customer.average_order_value,

                sensitivity
            )
        )

        # Add a small amount of randomness so that
        # the model does not learn a perfectly
        # deterministic relationship.

        random_adjustment = random.uniform(
            -0.025,
            0.025
        )

        observed_probability = (
            conversion_probability
            + random_adjustment
        )

        observed_probability = max(
            observed_probability,
            0.03
        )

        observed_probability = min(
            observed_probability,
            0.90
        )

        accepted = (

            1

            if random.random()
            < observed_probability

            else 0
        )

        rows.append({

            "customer_id":
                customer.id,

            "favorite_food":
                customer.favorite_food,

            "average_order_value":
                customer.average_order_value,

            "coupon_sensitivity":
                sensitivity,

            "discount":
                discount,

            "conversion_probability":
                round(
                    conversion_probability,
                    4
                ),

            "accepted":
                accepted
        })


with open(
    OUTPUT_FILE,
    "w",
    newline="",
    encoding="utf-8"
) as file:

    writer = csv.DictWriter(

        file,

        fieldnames=rows[0].keys()
    )

    writer.writeheader()

    writer.writerows(rows)


print(
    "\n==================================="
)

print(
    "Offer-response dataset generated!"
)

print(
    "==================================="
)

print(
    f"Customers: {len(customers)}"
)

print(
    f"Offer interactions: {len(rows)}"
)

print(
    f"Offers per customer: "
    f"{OFFERS_PER_CUSTOMER}"
)

print(
    f"Discount options: {DISCOUNTS}"
)

print(
    "Coupon sensitivity comes from "
    "individual customer profiles."
)

print(
    "Discount response includes "
    "customer-level behavioral variation."
)

print(
    f"Saved to: {OUTPUT_FILE}"
)

print(
    "==================================="
)