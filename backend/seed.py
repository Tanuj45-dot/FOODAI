from database import SessionLocal
from models import Customer

db = SessionLocal()

customer = Customer(
    name="Rahul",
    favorite_food="Biryani",
    average_order_value=320,
    total_orders=12
)

db.add(customer)
db.commit()
db.close()

print("Customer added successfully!")