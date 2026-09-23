from database import SessionLocal
from models import Restaurant, MenuItem

import random


# ==================================================
# FOOD CATALOG
# ==================================================

MENU_DATA = {

    "Biryani": [

        {
            "name": "Chicken Biryani",
            "description": "Fragrant basmati rice cooked with spiced chicken and aromatic herbs.",
            "price": 280,
            "is_vegetarian": False
        },
        {
            "name": "Mutton Biryani",
            "description": "Slow-cooked mutton layered with aromatic basmati rice and traditional spices.",
            "price": 340,
            "is_vegetarian": False
        },
        {
            "name": "Veg Biryani",
            "description": "Aromatic basmati rice cooked with fresh vegetables and Indian spices.",
            "price": 220,
            "is_vegetarian": True
        },
        {
            "name": "Egg Biryani",
            "description": "Spiced basmati rice served with boiled eggs and aromatic masala.",
            "price": 240,
            "is_vegetarian": False
        },
        {
            "name": "Hyderabadi Chicken Biryani",
            "description": "Traditional Hyderabadi-style dum biryani with tender chicken.",
            "price": 300,
            "is_vegetarian": False
        }

    ],


    "North Indian": [

        {
            "name": "Butter Chicken",
            "description": "Tender chicken cooked in a rich creamy tomato gravy.",
            "price": 320,
            "is_vegetarian": False
        },
        {
            "name": "Paneer Tikka",
            "description": "Grilled cottage cheese marinated with spices and yogurt.",
            "price": 240,
            "is_vegetarian": True
        },
        {
            "name": "Dal Makhani",
            "description": "Slow-cooked black lentils finished with butter and cream.",
            "price": 190,
            "is_vegetarian": True
        },
        {
            "name": "Chole Bhature",
            "description": "Spiced chickpea curry served with fluffy fried bhature.",
            "price": 180,
            "is_vegetarian": True
        },
        {
            "name": "Kadai Paneer",
            "description": "Paneer cooked with bell peppers, onions and aromatic spices.",
            "price": 230,
            "is_vegetarian": True
        },
        {
            "name": "Chicken Tikka",
            "description": "Char-grilled chicken pieces marinated in yogurt and spices.",
            "price": 280,
            "is_vegetarian": False
        },
        {
            "name": "Garlic Naan",
            "description": "Soft tandoori naan topped with garlic and butter.",
            "price": 90,
            "is_vegetarian": True
        },
        {
            "name": "Tandoori Chicken",
            "description": "Chicken marinated in traditional spices and roasted in a tandoor.",
            "price": 300,
            "is_vegetarian": False
        }

    ],


    "Chinese": [

        {
            "name": "Veg Hakka Noodles",
            "description": "Stir-fried noodles tossed with fresh vegetables and Chinese sauces.",
            "price": 180,
            "is_vegetarian": True
        },
        {
            "name": "Chicken Hakka Noodles",
            "description": "Wok-tossed noodles with chicken, vegetables and savory sauces.",
            "price": 230,
            "is_vegetarian": False
        },
        {
            "name": "Veg Fried Rice",
            "description": "Wok-fried rice with vegetables and aromatic Chinese seasoning.",
            "price": 170,
            "is_vegetarian": True
        },
        {
            "name": "Chicken Fried Rice",
            "description": "Wok-fried rice with chicken, vegetables and soy seasoning.",
            "price": 220,
            "is_vegetarian": False
        },
        {
            "name": "Veg Manchurian",
            "description": "Crispy vegetable dumplings tossed in a spicy Manchurian sauce.",
            "price": 190,
            "is_vegetarian": True
        },
        {
            "name": "Chilli Paneer",
            "description": "Crispy paneer tossed with peppers, onions and chilli sauce.",
            "price": 220,
            "is_vegetarian": True
        },
        {
            "name": "Chilli Chicken",
            "description": "Crispy chicken tossed with peppers, onions and spicy chilli sauce.",
            "price": 260,
            "is_vegetarian": False
        },
        {
            "name": "Spring Rolls",
            "description": "Crispy rolls filled with seasoned vegetables.",
            "price": 160,
            "is_vegetarian": True
        }

    ],


    "Pizza": [

        {
            "name": "Margherita Pizza",
            "description": "Classic pizza topped with tomato sauce, mozzarella and herbs.",
            "price": 220,
            "is_vegetarian": True
        },
        {
            "name": "Farmhouse Pizza",
            "description": "Pizza loaded with onions, capsicum, mushrooms and fresh vegetables.",
            "price": 300,
            "is_vegetarian": True
        },
        {
            "name": "Paneer Tikka Pizza",
            "description": "Pizza topped with spicy paneer tikka, onions and capsicum.",
            "price": 320,
            "is_vegetarian": True
        },
        {
            "name": "Chicken Tikka Pizza",
            "description": "Pizza topped with grilled chicken tikka and mozzarella.",
            "price": 350,
            "is_vegetarian": False
        },
        {
            "name": "Cheese Burst Pizza",
            "description": "Loaded cheese pizza with a rich cheese-filled crust.",
            "price": 330,
            "is_vegetarian": True
        },
        {
            "name": "Pepperoni Pizza",
            "description": "Classic pizza topped with pepperoni and melted mozzarella.",
            "price": 380,
            "is_vegetarian": False
        }

    ],


    "South Indian": [

        {
            "name": "Masala Dosa",
            "description": "Crispy dosa filled with spiced potato masala and served with chutneys.",
            "price": 140,
            "is_vegetarian": True
        },
        {
            "name": "Plain Dosa",
            "description": "Crispy South Indian dosa served with sambar and chutneys.",
            "price": 110,
            "is_vegetarian": True
        },
        {
            "name": "Idli Sambar",
            "description": "Soft steamed idlis served with hot sambar and coconut chutney.",
            "price": 100,
            "is_vegetarian": True
        },
        {
            "name": "Medu Vada",
            "description": "Crispy lentil fritters served with sambar and chutney.",
            "price": 110,
            "is_vegetarian": True
        },
        {
            "name": "Masala Uttapam",
            "description": "Thick rice-lentil pancake topped with vegetables and spices.",
            "price": 150,
            "is_vegetarian": True
        },
        {
            "name": "Sambar Rice",
            "description": "Steamed rice served with flavorful South Indian sambar.",
            "price": 130,
            "is_vegetarian": True
        },
        {
            "name": "Curd Rice",
            "description": "Creamy yogurt rice tempered with traditional South Indian spices.",
            "price": 120,
            "is_vegetarian": True
        },
        {
            "name": "Rava Dosa",
            "description": "Thin and crispy semolina dosa served with chutneys and sambar.",
            "price": 150,
            "is_vegetarian": True
        }

    ],


    "Burgers": [

        {
            "name": "Classic Veg Burger",
            "description": "Crispy vegetable patty with lettuce, tomato and signature sauce.",
            "price": 150,
            "is_vegetarian": True
        },
        {
            "name": "Cheese Burger",
            "description": "Juicy burger topped with melted cheese and fresh vegetables.",
            "price": 190,
            "is_vegetarian": True
        },
        {
            "name": "Paneer Burger",
            "description": "Spiced grilled paneer patty with fresh vegetables and creamy sauce.",
            "price": 210,
            "is_vegetarian": True
        },
        {
            "name": "Chicken Burger",
            "description": "Crispy chicken patty with lettuce, onions and signature sauce.",
            "price": 230,
            "is_vegetarian": False
        },
        {
            "name": "Spicy Chicken Burger",
            "description": "Crispy spicy chicken patty with jalapenos and spicy sauce.",
            "price": 250,
            "is_vegetarian": False
        },
        {
            "name": "Double Cheese Burger",
            "description": "Double patty burger layered with cheese and signature sauce.",
            "price": 280,
            "is_vegetarian": False
        }

    ]
}


# ==================================================
# CREATE MENU ITEMS
# ==================================================

db = SessionLocal()

try:

    restaurants = (
        db.query(Restaurant)
        .order_by(Restaurant.id)
        .all()
    )

    if not restaurants:

        print("No restaurants found.")
        print("Run seed_restaurants.py first.")

    else:

        created_count = 0
        skipped_count = 0

        for restaurant in restaurants:

            cuisine = restaurant.cuisine

            dishes = MENU_DATA.get(
                cuisine,
                []
            )

            if not dishes:

                continue

            for dish in dishes:

                # Prevent duplicate menu items if this
                # script is accidentally run again.
                existing_item = (
                    db.query(MenuItem)
                    .filter(
                        MenuItem.restaurant_id
                        == restaurant.id,

                        MenuItem.name
                        == dish["name"]
                    )
                    .first()
                )

                if existing_item:

                    skipped_count += 1

                    continue

                # Slight restaurant-to-restaurant
                # price variation.
                price_variation = random.randint(
                    -20,
                    30
                )

                final_price = max(
                    50,
                    dish["price"] + price_variation
                )

                rating = round(
                    random.uniform(
                        3.8,
                        min(5.0, restaurant.rating + 0.2)
                    ),
                    1
                )

                popularity = random.randint(
                    40,
                    100
                )

                menu_item = MenuItem(

                    restaurant_id=restaurant.id,

                    name=dish["name"],

                    cuisine=cuisine,

                    description=dish["description"],

                    price=final_price,

                    is_vegetarian=dish["is_vegetarian"],

                    rating=rating,

                    popularity=popularity,

                    is_available=True
                )

                db.add(menu_item)

                created_count += 1

        db.commit()

        print("===================================")
        print("FoodAI menu dataset created!")
        print("===================================")
        print(
            f"Menu items added: {created_count}"
        )
        print(
            f"Existing items skipped: {skipped_count}"
        )
        print(
            f"Restaurants processed: {len(restaurants)}"
        )
        print("===================================")

finally:

    db.close()