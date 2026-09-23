from database import SessionLocal
from models import Customer, CustomerBehavior


print("Resetting customer behavior data...")


db = SessionLocal()


# Delete behavior events first
behavior_deleted = db.query(
    CustomerBehavior
).delete()


# Delete customers
customers_deleted = db.query(
    Customer
).delete()


db.commit()

db.close()


print("===================================")
print("Customer data reset successfully!")
print("===================================")
print(
    f"Customers deleted: {customers_deleted}"
)
print(
    f"Behavior events deleted: {behavior_deleted}"
)
print("Restaurants were NOT changed.")
print("===================================")
