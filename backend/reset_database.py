import os

from database import Base, engine
import models


print("Resetting FoodAI database...")

# Remove existing database file
if os.path.exists("foodai.db"):
    os.remove("foodai.db")
    print("Old database deleted.")

# Create all database tables
Base.metadata.create_all(bind=engine)

print("New database created successfully!")
print("Customers table created.")
print("Restaurants table created.")
print("Customer behavior table created.")