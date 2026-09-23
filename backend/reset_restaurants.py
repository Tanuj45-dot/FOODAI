from database import SessionLocal
from models import Restaurant


print("Resetting restaurant data...")


db = SessionLocal()


# Delete existing restaurants

deleted = db.query(
    Restaurant
).delete()


db.commit()


print(
    f"Old restaurants deleted: {deleted}"
)


db.close()


print(
    "Restaurant table is now empty."
)