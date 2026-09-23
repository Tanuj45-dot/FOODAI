from database import SessionLocal
from models import Restaurant


# --------------------------------------------------
# RESTAURANT DATA
# --------------------------------------------------

restaurants = [

    # ---------------- BIRYANI ----------------

    {
        "name": "Biryani House",
        "cuisine": "Biryani"
    },
    {
        "name": "Royal Biryani",
        "cuisine": "Biryani"
    },
    {
        "name": "The Biryani Hub",
        "cuisine": "Biryani"
    },
    {
        "name": "Biryani Nation",
        "cuisine": "Biryani"
    },
    {
        "name": "Dum Biryani Point",
        "cuisine": "Biryani"
    },
    {
        "name": "Biryani Junction",
        "cuisine": "Biryani"
    },
    {
        "name": "Hyderabadi Biryani",
        "cuisine": "Biryani"
    },
    {
        "name": "Biryani Express",
        "cuisine": "Biryani"
    },

    # ---------------- NORTH INDIAN ----------------

    {
        "name": "Spice Junction",
        "cuisine": "North Indian"
    },
    {
        "name": "Tandoori Tales",
        "cuisine": "North Indian"
    },
    {
        "name": "Punjab Rasoi",
        "cuisine": "North Indian"
    },
    {
        "name": "Delhi Darbar",
        "cuisine": "North Indian"
    },
    {
        "name": "Masala Kitchen",
        "cuisine": "North Indian"
    },
    {
        "name": "Urban Tadka",
        "cuisine": "North Indian"
    },
    {
        "name": "Curry Culture",
        "cuisine": "North Indian"
    },
    {
        "name": "Mughlai House",
        "cuisine": "North Indian"
    },

    # ---------------- CHINESE ----------------

    {
        "name": "Wok Express",
        "cuisine": "Chinese"
    },
    {
        "name": "Dragon Wok",
        "cuisine": "Chinese"
    },
    {
        "name": "Chopstick Express",
        "cuisine": "Chinese"
    },
    {
        "name": "Shanghai Kitchen",
        "cuisine": "Chinese"
    },
    {
        "name": "Wok Street",
        "cuisine": "Chinese"
    },
    {
        "name": "Chinese Bowl",
        "cuisine": "Chinese"
    },
    {
        "name": "Oriental Kitchen",
        "cuisine": "Chinese"
    },
    {
        "name": "Szechuan House",
        "cuisine": "Chinese"
    },

    # ---------------- PIZZA ----------------

    {
        "name": "Pizza Corner",
        "cuisine": "Pizza"
    },
    {
        "name": "Pizza Planet",
        "cuisine": "Pizza"
    },
    {
        "name": "Cheese Burst",
        "cuisine": "Pizza"
    },
    {
        "name": "Pizza Palace",
        "cuisine": "Pizza"
    },
    {
        "name": "Crust Cafe",
        "cuisine": "Pizza"
    },
    {
        "name": "Italian Oven",
        "cuisine": "Pizza"
    },
    {
        "name": "Pizza Studio",
        "cuisine": "Pizza"
    },
    {
        "name": "The Pizza Hub",
        "cuisine": "Pizza"
    },

    # ---------------- SOUTH INDIAN ----------------

    {
        "name": "South Spice",
        "cuisine": "South Indian"
    },
    {
        "name": "Dosa House",
        "cuisine": "South Indian"
    },
    {
        "name": "Idli Express",
        "cuisine": "South Indian"
    },
    {
        "name": "South Indian Hub",
        "cuisine": "South Indian"
    },
    {
        "name": "Madras Kitchen",
        "cuisine": "South Indian"
    },
    {
        "name": "Udupi Corner",
        "cuisine": "South Indian"
    },
    {
        "name": "Chennai Tiffin",
        "cuisine": "South Indian"
    },
    {
        "name": "Dosa Junction",
        "cuisine": "South Indian"
    },

    # ---------------- BURGERS ----------------

    {
        "name": "Burger Lab",
        "cuisine": "Burgers"
    },
    {
        "name": "Burger Singh",
        "cuisine": "Burgers"
    },
    {
        "name": "Burger Street",
        "cuisine": "Burgers"
    },
    {
        "name": "Burger Factory",
        "cuisine": "Burgers"
    },
    {
        "name": "Big Bite Burgers",
        "cuisine": "Burgers"
    },
    {
        "name": "Grill House",
        "cuisine": "Burgers"
    },
    {
        "name": "Burger Garage",
        "cuisine": "Burgers"
    },
    {
        "name": "The Burger Hub",
        "cuisine": "Burgers"
    }
]


# --------------------------------------------------
# CREATE RESTAURANTS
# --------------------------------------------------

db = SessionLocal()


restaurant_objects = []


for restaurant in restaurants:

    cuisine = restaurant["cuisine"]

    # Cuisine-specific price ranges

    if cuisine == "South Indian":

        average_price = 150

    elif cuisine == "Burgers":

        average_price = 250

    elif cuisine == "Chinese":

        average_price = 300

    elif cuisine == "Biryani":

        average_price = 320

    elif cuisine == "North Indian":

        average_price = 400

    else:

        average_price = 400


    # Slight variation around base price

    import random

    price = random.randint(
        max(100, average_price - 70),
        average_price + 100
    )

    rating = round(
        random.uniform(3.8, 4.8),
        1
    )

    popularity = random.randint(
        50,
        100
    )


    restaurant_objects.append(
        Restaurant(

            name=restaurant["name"],

            cuisine=cuisine,

            rating=rating,

            average_price=price,

            location="Nagpur",

            popularity=popularity
        )
    )


# --------------------------------------------------
# INSERT
# --------------------------------------------------

db.add_all(
    restaurant_objects
)

db.commit()

db.close()


# --------------------------------------------------
# RESULT
# --------------------------------------------------

print("===================================")
print("Restaurant dataset created!")
print("===================================")
print(
    f"Restaurants added: {len(restaurant_objects)}"
)
print("Location: Nagpur")
print("===================================")