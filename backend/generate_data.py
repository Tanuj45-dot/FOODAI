import random
from datetime import datetime, timedelta

from sqlalchemy import insert

from database import SessionLocal
from models import Customer, CustomerBehavior


NUMBER_OF_CUSTOMERS = 500

MIN_EVENTS_PER_CUSTOMER = 15
MAX_EVENTS_PER_CUSTOMER = 25


customer_profiles = [
    {
        "food": "Biryani",
        "aov_min": 250,
        "aov_max": 450,
        "sensitivity_min": 0.05,
        "sensitivity_max": 0.35
    },
    {
        "food": "Pizza",
        "aov_min": 300,
        "aov_max": 600,
        "sensitivity_min": 0.15,
        "sensitivity_max": 0.55
    },
    {
        "food": "Chinese",
        "aov_min": 250,
        "aov_max": 500,
        "sensitivity_min": 0.25,
        "sensitivity_max": 0.70
    },
    {
        "food": "North Indian",
        "aov_min": 300,
        "aov_max": 600,
        "sensitivity_min": 0.05,
        "sensitivity_max": 0.30
    },
    {
        "food": "South Indian",
        "aov_min": 150,
        "aov_max": 350,
        "sensitivity_min": 0.45,
        "sensitivity_max": 0.95
    },
    {
        "food": "Burgers",
        "aov_min": 200,
        "aov_max": 450,
        "sensitivity_min": 0.35,
        "sensitivity_max": 0.85
    }
]


restaurant_mapping = {
    "Biryani": [
        "Biryani House",
        "Royal Biryani",
        "The Biryani Hub",
        "Biryani Nation",
        "Dum Biryani Point",
        "Biryani Junction",
        "Hyderabadi Biryani",
        "Biryani Express"
    ],

    "North Indian": [
        "Spice Junction",
        "Tandoori Tales",
        "Punjab Rasoi",
        "Delhi Darbar",
        "Masala Kitchen",
        "Urban Tadka",
        "Curry Culture",
        "Mughlai House"
    ],

    "Chinese": [
        "Wok Express",
        "Dragon Wok",
        "Chopstick Express",
        "Shanghai Kitchen",
        "Wok Street",
        "Chinese Bowl",
        "Oriental Kitchen",
        "Szechuan House"
    ],

    "Pizza": [
        "Pizza Corner",
        "Pizza Planet",
        "Cheese Burst",
        "Pizza Palace",
        "Crust Cafe",
        "Italian Oven",
        "Pizza Studio",
        "The Pizza Hub"
    ],

    "South Indian": [
        "South Spice",
        "Dosa House",
        "Idli Express",
        "South Indian Hub",
        "Madras Kitchen",
        "Udupi Corner",
        "Chennai Tiffin",
        "Dosa Junction"
    ],

    "Burgers": [
        "Burger Lab",
        "Burger Singh",
        "Burger Street",
        "Burger Factory",
        "Big Bite Burgers",
        "Grill House",
        "Burger Garage",
        "The Burger Hub"
    ]
}


first_names = [
    "Aarav",
    "Vivaan",
    "Aditya",
    "Arjun",
    "Rohan",
    "Vivek",
    "Rahul",
    "Karan",
    "Ankit",
    "Rohit",
    "Priya",
    "Ananya",
    "Sneha",
    "Neha",
    "Kavya",
    "Pooja",
    "Isha",
    "Riya",
    "Simran",
    "Aditi"
]


print("Creating synthetic customers...")


customer_rows = []


for i in range(NUMBER_OF_CUSTOMERS):

    profile = random.choice(
        customer_profiles
    )

    # Generate sensitivity independently
    # for every customer.
    coupon_sensitivity = round(
        random.uniform(
            profile["sensitivity_min"],
            profile["sensitivity_max"]
        ),
        2
    )

    customer_rows.append({

        "name":
            f"{random.choice(first_names)}_{i + 1}",

        "favorite_food":
            profile["food"],

        "average_order_value":
            random.randint(
                profile["aov_min"],
                profile["aov_max"]
            ),

        "total_orders":
            random.randint(5, 40),

        "coupon_sensitivity":
            coupon_sensitivity
    })


db = SessionLocal()


# Insert customers.
db.execute(
    insert(Customer),
    customer_rows
)

db.commit()


customers = (
    db.query(Customer)
    .all()
)


print(
    f"Customers created: {len(customers)}"
)

print(
    "Generating realistic behavior events..."
)


behavior_rows = []


for customer in customers:

    preferred_food = (
        customer.favorite_food
    )

    preferred_restaurant = random.choice(
        restaurant_mapping[
            preferred_food
        ]
    )


    event_count = random.randint(
        MIN_EVENTS_PER_CUSTOMER,
        MAX_EVENTS_PER_CUSTOMER
    )


    for _ in range(event_count):

        # Most behavior is related to the
        # customer's preferred cuisine.
        if random.random() < 0.75:

            food = preferred_food

        else:

            food = random.choice(
                list(
                    restaurant_mapping.keys()
                )
            )


        if food == preferred_food:

            if random.random() < 0.70:

                restaurant = (
                    preferred_restaurant
                )

            else:

                restaurant = random.choice(
                    restaurant_mapping[food]
                )

        else:

            restaurant = random.choice(
                restaurant_mapping[food]
            )


        action = random.choices(

            [
                "search",
                "view_restaurant",
                "view_item",
                "add_to_cart",
                "order",
                "coupon_used"
            ],

            weights=[
                22,
                20,
                20,
                15,
                18,
                5
            ]

        )[0]


        # Coupon usage is now influenced by
        # the individual's sensitivity.
        if action == "coupon_used":

            if random.random() > (
                customer.coupon_sensitivity
            ):

                action = "search"


        if action == "order":

            order_value = random.randint(

                max(
                    100,
                    int(
                        customer.average_order_value
                        * 0.7
                    )
                ),

                int(
                    customer.average_order_value
                    * 1.3
                )

            )

        else:

            order_value = 0


        behavior_time = (

            datetime.utcnow()

            - timedelta(

                days=random.randint(
                    0,
                    90
                ),

                hours=random.randint(
                    0,
                    23
                ),

                minutes=random.randint(
                    0,
                    59
                )

            )

        )


        behavior_rows.append({

            "customer_id":
                customer.id,

            "action":
                action,

            "item":
                food,

            "restaurant":
                restaurant,

            "cuisine":
                food,

            "order_value":
                order_value,

            "timestamp":
                behavior_time

        })


db.execute(

    insert(CustomerBehavior),

    behavior_rows

)

db.commit()

db.close()


print("\n===================================")
print("Synthetic dataset generated!")
print("===================================")

print(
    f"Customers: {len(customers)}"
)

print(
    f"Behavior events: {len(behavior_rows)}"
)

print(
    "Coupon sensitivity is now individual "
    "for every customer."
)

print(
    "===================================")