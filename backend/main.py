from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import inspect, text

from database import Base, engine, SessionLocal
import models

from datetime import datetime
import os
import secrets
import joblib

from ai_engine import analyze_customer_preferences
from recommendation_engine import get_recommendations
from ml_model import predict_customer_cuisine
from offer_optimizer import optimize_offer

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)


# ==================================================
# DATABASE INITIALIZATION
# ==================================================

Base.metadata.create_all(bind=engine)

# SQLite does not add new columns to an existing table when
# create_all() runs, so add the payment columns safely if this
# database was created before payment persistence was introduced.
with engine.begin() as connection:
    inspector = inspect(connection)
    order_columns = {
        column["name"]
        for column in inspector.get_columns("orders")
    }

    if "payment_method" not in order_columns:
        connection.execute(
            text(
                "ALTER TABLE orders "
                "ADD COLUMN payment_method VARCHAR "
                "NOT NULL DEFAULT 'cod'"
            )
        )

    if "payment_status" not in order_columns:
        connection.execute(
            text(
                "ALTER TABLE orders "
                "ADD COLUMN payment_status VARCHAR "
                "NOT NULL DEFAULT 'pending'"
            )
        )


# ==================================================
# FASTAPI APPLICATION
# ==================================================

app = FastAPI(
    title="FoodAI Backend"
)


# ==================================================
# CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ==================================================
# AUTHENTICATION SECURITY
# ==================================================

security = HTTPBearer()


# ==================================================
# HOME
# ==================================================

@app.get("/")
def home():

    return {
        "message": "FoodAI backend is running!"
    }


# ==================================================
# AUTHENTICATION - REGISTER CUSTOMER
# ==================================================

@app.post("/auth/register")
def register_user(
    username: str,
    password: str,
    customer_id: int
):

    db = SessionLocal()

    try:

        username = username.strip().lower()

        if not username:
            raise HTTPException(
                status_code=400,
                detail="Username is required."
            )

        if not password:
            raise HTTPException(
                status_code=400,
                detail="Password is required."
            )

        existing_user = (
            db.query(models.User)
            .filter(
                models.User.username == username
            )
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Username already exists."
            )

        customer = (
            db.query(models.Customer)
            .filter(
                models.Customer.id == customer_id
            )
            .first()
        )

        if customer is None:
            raise HTTPException(
                status_code=404,
                detail="Customer not found."
            )

        user = models.User(
            username=username,
            password_hash=hash_password(password),
            role="customer",
            customer_id=customer_id
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "message": "User registered successfully.",
            "user_id": user.id,
            "username": user.username,
            "role": user.role,
            "customer_id": user.customer_id
        }

    finally:

        db.close()


# ==================================================
# AUTHENTICATION - REGISTER RESTAURANT PARTNER
# ==================================================

@app.post("/auth/register-restaurant")
def register_restaurant_partner(
    username: str,
    password: str,
    restaurant_id: int
):

    db = SessionLocal()

    try:

        username = username.strip().lower()

        if not username:
            raise HTTPException(
                status_code=400,
                detail="Username is required."
            )

        if not password:
            raise HTTPException(
                status_code=400,
                detail="Password is required."
            )

        existing_user = (
            db.query(models.User)
            .filter(
                models.User.username == username
            )
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="Username already exists."
            )

        restaurant = (
            db.query(models.Restaurant)
            .filter(
                models.Restaurant.id == restaurant_id
            )
            .first()
        )

        if restaurant is None:
            raise HTTPException(
                status_code=404,
                detail="Restaurant not found."
            )

        existing_restaurant_user = (
            db.query(models.User)
            .filter(
                models.User.restaurant_id == restaurant_id,
                models.User.role == "restaurant"
            )
            .first()
        )

        if existing_restaurant_user:
            raise HTTPException(
                status_code=400,
                detail=(
                    "This restaurant already has "
                    "a partner account."
                )
            )

        user = models.User(
            username=username,
            password_hash=hash_password(password),
            role="restaurant",
            restaurant_id=restaurant_id
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "message": "Restaurant partner registered successfully.",
            "user_id": user.id,
            "username": user.username,
            "role": user.role,
            "restaurant_id": user.restaurant_id
        }

    finally:

        db.close()


# ==================================================
# AUTHENTICATION - LOGIN
# ==================================================

@app.post("/auth/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends()
):

    db = SessionLocal()

    try:

        username = form_data.username.strip().lower()

        user = (
            db.query(models.User)
            .filter(
                models.User.username == username
            )
            .first()
        )

        if user is None:

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password.",
                headers={
                    "WWW-Authenticate": "Bearer"
                }
            )

        if not verify_password(
            form_data.password,
            user.password_hash
        ):

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password.",
                headers={
                    "WWW-Authenticate": "Bearer"
                }
            )

        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "username": user.username,
                "role": user.role,
                "customer_id": user.customer_id,
                "restaurant_id": user.restaurant_id
            }
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.id,
            "username": user.username,
            "role": user.role,
            "customer_id": user.customer_id,
            "restaurant_id": user.restaurant_id
        }

    finally:

        db.close()


# ==================================================
# GET CURRENT LOGGED-IN USER
# ==================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    payload = decode_access_token(token)

    if payload is None:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={
                "WWW-Authenticate": "Bearer"
            }
        )

    user_id = payload.get("sub")

    if user_id is None:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token."
        )

    db = SessionLocal()

    try:

        user = (
            db.query(models.User)
            .filter(
                models.User.id == int(user_id)
            )
            .first()
        )

        if user is None:

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User no longer exists."
            )

        return user

    finally:

        db.close()


# ==================================================
# ADMIN AUTHORIZATION
# ==================================================

def get_current_admin(
    current_user: models.User = Depends(get_current_user)
):

    if current_user.role != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company dashboard access denied."
        )

    return current_user


# ==================================================
# CUSTOMER AUTHORIZATION
# ==================================================

def get_current_customer(
    current_user: models.User = Depends(get_current_user)
):

    if current_user.role != "customer":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customer access required."
        )

    return current_user


# ==================================================
# CUSTOMER ADDRESS SCHEMAS
# ==================================================

class CustomerAddressCreate(BaseModel):

    label: str = "Other"
    address: str
    landmark: str | None = None
    latitude: float
    longitude: float
    is_default: bool = False


class OrderCreate(BaseModel):

    restaurant_id: int
    restaurant: str
    cuisine: str | None = None
    selected_address_id: int
    items: list[dict]
    item_total: float = 0
    subtotal: float = 0
    discount: float = 0
    grand_total: float = 0
    coupon_code: str | None = None
    payment_method: str = "cod"
    payment_status: str = "pending"


class CustomerAddressUpdate(BaseModel):

    label: str | None = None
    address: str | None = None
    landmark: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool | None = None


# ==================================================
# CUSTOMER ADDRESS VALIDATION
# ==================================================

def validate_coordinates(latitude: float, longitude: float):

    if latitude < -90 or latitude > 90:
        raise HTTPException(
            status_code=400,
            detail="Invalid latitude."
        )

    if longitude < -180 or longitude > 180:
        raise HTTPException(
            status_code=400,
            detail="Invalid longitude."
        )


# ==================================================
# CUSTOMER ADDRESS AUTHORIZATION
# ==================================================

def get_customer_from_user(
    current_user: models.User = Depends(get_current_customer)
):

    if current_user.customer_id is None:
        raise HTTPException(
            status_code=403,
            detail="Customer account is not linked to a customer profile."
        )

    return current_user


# ==================================================
# CUSTOMER ADDRESSES
# ==================================================

@app.get("/customer/me/addresses")
def get_my_addresses(
    current_user: models.User = Depends(get_customer_from_user)
):

    db = SessionLocal()

    try:
        addresses = (
            db.query(models.CustomerAddress)
            .filter(
                models.CustomerAddress.customer_id ==
                current_user.customer_id
            )
            .order_by(
                models.CustomerAddress.is_default.desc(),
                models.CustomerAddress.id.desc()
            )
            .all()
        )

        return [
            {
                "id": address.id,
                "customer_id": address.customer_id,
                "label": address.label,
                "address": address.address,
                "landmark": address.landmark,
                "latitude": address.latitude,
                "longitude": address.longitude,
                "is_default": address.is_default,
                "created_at": address.created_at
            }
            for address in addresses
        ]

    finally:
        db.close()


@app.post("/customer/me/addresses")
def create_my_address(
    payload: CustomerAddressCreate,
    current_user: models.User = Depends(get_customer_from_user)
):

    validate_coordinates(payload.latitude, payload.longitude)

    if not payload.address.strip():
        raise HTTPException(
            status_code=400,
            detail="Address cannot be empty."
        )

    db = SessionLocal()

    try:
        existing_count = (
            db.query(models.CustomerAddress)
            .filter(
                models.CustomerAddress.customer_id ==
                current_user.customer_id
            )
            .count()
        )

        should_be_default = payload.is_default or existing_count == 0

        if should_be_default:
            db.query(models.CustomerAddress).filter(
                models.CustomerAddress.customer_id ==
                current_user.customer_id
            ).update(
                {"is_default": False},
                synchronize_session=False
            )

        address = models.CustomerAddress(
            customer_id=current_user.customer_id,
            label=(payload.label or "Other").strip() or "Other",
            address=payload.address.strip(),
            landmark=(payload.landmark.strip()
                      if payload.landmark else None),
            latitude=round(float(payload.latitude), 7),
            longitude=round(float(payload.longitude), 7),
            is_default=should_be_default
        )

        db.add(address)
        db.commit()
        db.refresh(address)

        return {
            "message": "Address saved successfully.",
            "address": {
                "id": address.id,
                "customer_id": address.customer_id,
                "label": address.label,
                "address": address.address,
                "landmark": address.landmark,
                "latitude": address.latitude,
                "longitude": address.longitude,
                "is_default": address.is_default,
                "created_at": address.created_at
            }
        }

    finally:
        db.close()


@app.put("/customer/me/addresses/{address_id}")
def update_my_address(
    address_id: int,
    payload: CustomerAddressUpdate,
    current_user: models.User = Depends(get_customer_from_user)
):

    db = SessionLocal()

    try:
        address = (
            db.query(models.CustomerAddress)
            .filter(
                models.CustomerAddress.id == address_id,
                models.CustomerAddress.customer_id ==
                current_user.customer_id
            )
            .first()
        )

        if address is None:
            raise HTTPException(
                status_code=404,
                detail="Address not found."
            )

        new_latitude = (
            payload.latitude
            if payload.latitude is not None
            else address.latitude
        )
        new_longitude = (
            payload.longitude
            if payload.longitude is not None
            else address.longitude
        )

        validate_coordinates(new_latitude, new_longitude)

        if payload.address is not None and not payload.address.strip():
            raise HTTPException(
                status_code=400,
                detail="Address cannot be empty."
            )

        if payload.label is not None:
            address.label = payload.label.strip() or "Other"

        if payload.address is not None:
            address.address = payload.address.strip()

        if payload.landmark is not None:
            address.landmark = payload.landmark.strip() or None

        address.latitude = round(float(new_latitude), 7)
        address.longitude = round(float(new_longitude), 7)

        if payload.is_default is True:
            db.query(models.CustomerAddress).filter(
                models.CustomerAddress.customer_id ==
                current_user.customer_id,
                models.CustomerAddress.id != address_id
            ).update(
                {"is_default": False},
                synchronize_session=False
            )
            address.is_default = True

        elif payload.is_default is False and address.is_default:
            # Do not allow a customer to end up with no default address.
            address.is_default = True

        db.commit()
        db.refresh(address)

        return {
            "message": "Address updated successfully.",
            "address": {
                "id": address.id,
                "customer_id": address.customer_id,
                "label": address.label,
                "address": address.address,
                "landmark": address.landmark,
                "latitude": address.latitude,
                "longitude": address.longitude,
                "is_default": address.is_default,
                "created_at": address.created_at
            }
        }

    finally:
        db.close()


@app.delete("/customer/me/addresses/{address_id}")
def delete_my_address(
    address_id: int,
    current_user: models.User = Depends(get_customer_from_user)
):

    db = SessionLocal()

    try:
        address = (
            db.query(models.CustomerAddress)
            .filter(
                models.CustomerAddress.id == address_id,
                models.CustomerAddress.customer_id ==
                current_user.customer_id
            )
            .first()
        )

        if address is None:
            raise HTTPException(
                status_code=404,
                detail="Address not found."
            )

        was_default = address.is_default
        db.delete(address)
        db.flush()

        if was_default:
            replacement = (
                db.query(models.CustomerAddress)
                .filter(
                    models.CustomerAddress.customer_id ==
                    current_user.customer_id
                )
                .order_by(models.CustomerAddress.id.desc())
                .first()
            )

            if replacement is not None:
                replacement.is_default = True

        db.commit()

        return {
            "message": "Address deleted successfully."
        }

    finally:
        db.close()


@app.put("/customer/me/addresses/{address_id}/default")
def set_default_address(
    address_id: int,
    current_user: models.User = Depends(get_customer_from_user)
):

    db = SessionLocal()

    try:
        address = (
            db.query(models.CustomerAddress)
            .filter(
                models.CustomerAddress.id == address_id,
                models.CustomerAddress.customer_id ==
                current_user.customer_id
            )
            .first()
        )

        if address is None:
            raise HTTPException(
                status_code=404,
                detail="Address not found."
            )

        db.query(models.CustomerAddress).filter(
            models.CustomerAddress.customer_id ==
            current_user.customer_id
        ).update(
            {"is_default": False},
            synchronize_session=False
        )

        address.is_default = True
        db.commit()
        db.refresh(address)

        return {
            "message": "Default address updated successfully.",
            "address_id": address.id
        }

    finally:
        db.close()


# ==================================================
# CREATE PERSISTENT ORDER
# ==================================================

@app.post("/orders")
def create_order(
    payload: OrderCreate,
    current_user: models.User = Depends(get_customer_from_user)
):

    db = SessionLocal()

    try:
        customer = (
            db.query(models.Customer)
            .filter(
                models.Customer.id == current_user.customer_id
            )
            .first()
        )

        if customer is None:
            raise HTTPException(
                status_code=404,
                detail="Customer profile not found."
            )

        address = (
            db.query(models.CustomerAddress)
            .filter(
                models.CustomerAddress.id == payload.selected_address_id,
                models.CustomerAddress.customer_id == current_user.customer_id
            )
            .first()
        )

        if address is None:
            raise HTTPException(
                status_code=404,
                detail="Selected delivery address not found."
            )

        restaurant = (
            db.query(models.Restaurant)
            .filter(
                models.Restaurant.id == payload.restaurant_id
            )
            .first()
        )

        if restaurant is None:
            raise HTTPException(
                status_code=404,
                detail="Restaurant not found."
            )

        if not payload.items:
            raise HTTPException(
                status_code=400,
                detail="Order must contain at least one item."
            )

        normalized_payment_method = (
            str(payload.payment_method or "cod")
            .strip()
            .lower()
        )

        if normalized_payment_method not in {"cod", "online_demo"}:
            raise HTTPException(
                status_code=400,
                detail="Invalid payment method."
            )

        normalized_payment_status = (
            "paid_demo"
            if normalized_payment_method == "online_demo"
            else "pending"
        )

        if payload.item_total < 0 or payload.subtotal < 0 or payload.discount < 0 or payload.grand_total < 0:
            raise HTTPException(
                status_code=400,
                detail="Order amounts cannot be negative."
            )

        # Store the delivery address as a snapshot. This protects
        # historical orders if the customer edits/deletes the saved address later.
        order = models.Order(
            customer_id=current_user.customer_id,
            restaurant_id=restaurant.id,
            items_json=__import__("json").dumps(payload.items, ensure_ascii=False),
            restaurant=restaurant.name,
            cuisine=payload.cuisine or restaurant.cuisine,
            address_label=address.label,
            delivery_address=address.address,
            delivery_landmark=address.landmark,
            delivery_latitude=address.latitude,
            delivery_longitude=address.longitude,
            item_total=float(payload.item_total),
            subtotal=float(payload.subtotal),
            discount=float(payload.discount),
            grand_total=float(payload.grand_total),
            coupon_code=payload.coupon_code,
            payment_method=normalized_payment_method,
            payment_status=normalized_payment_status,
            status="placed"
        )

        db.add(order)
        db.commit()
        db.refresh(order)

        return {
            "message": "Order created successfully.",
            "order": {
                "order_id": order.id,
                "customer_id": order.customer_id,
                "restaurant_id": order.restaurant_id,
                "restaurant": order.restaurant,
                "cuisine": order.cuisine,
                "items": payload.items,
                "delivery_address": {
                    "address_id": address.id,
                    "label": order.address_label,
                    "address": order.delivery_address,
                    "landmark": order.delivery_landmark,
                    "latitude": order.delivery_latitude,
                    "longitude": order.delivery_longitude
                },
                "item_total": order.item_total,
                "subtotal": order.subtotal,
                "discount": order.discount,
                "grand_total": order.grand_total,
                "coupon_code": order.coupon_code,
                "payment_method": getattr(order, "payment_method", "cod"),
                "payment_status": getattr(order, "payment_status", "pending"),
                "status": order.status,
                "created_at": order.created_at
            }
        }

    finally:
        db.close()


# ==================================================
# GET MY ORDERS
# ==================================================

@app.get("/orders")
def get_my_orders(
    current_user: models.User = Depends(get_customer_from_user)
):
    db = SessionLocal()

    try:
        orders = (
            db.query(models.Order)
            .filter(
                models.Order.customer_id == current_user.customer_id
            )
            .order_by(
                models.Order.created_at.desc(),
                models.Order.id.desc()
            )
            .all()
        )

        result = []

        for order in orders:
            try:
                items = __import__("json").loads(
                    order.items_json or "[]"
                )
            except Exception:
                items = []

            result.append({
                "order_id": order.id,
                "customer_id": order.customer_id,
                "restaurant_id": order.restaurant_id,
                "restaurant": order.restaurant,
                "cuisine": order.cuisine,
                "items": items,
                "delivery_address": {
                    "label": order.address_label,
                    "address": order.delivery_address,
                    "landmark": order.delivery_landmark,
                    "latitude": order.delivery_latitude,
                    "longitude": order.delivery_longitude
                },
                "item_total": order.item_total,
                "subtotal": order.subtotal,
                "discount": order.discount,
                "grand_total": order.grand_total,
                "coupon_code": order.coupon_code,
                "payment_method": getattr(order, "payment_method", "cod"),
                "payment_status": getattr(order, "payment_status", "pending"),
                "status": order.status,
                "created_at": order.created_at
            })

        return result

    finally:
        db.close()


# ==================================================
# RESTAURANT AUTHORIZATION
# ==================================================

def get_current_restaurant(
    current_user: models.User = Depends(get_current_user)
):

    if current_user.role != "restaurant":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restaurant partner access required."
        )

    if current_user.restaurant_id is None:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restaurant account is not linked to a restaurant."
        )

    return current_user



# ==================================================
# RESTAURANT ORDER HISTORY
# ==================================================

@app.get("/restaurant/me/orders")
def get_restaurant_orders(
    current_user: models.User = Depends(get_current_restaurant)
):

    db = SessionLocal()

    try:

        orders = (
            db.query(models.Order)
            .filter(
                models.Order.restaurant_id ==
                current_user.restaurant_id
            )
            .order_by(
                models.Order.created_at.desc(),
                models.Order.id.desc()
            )
            .all()
        )

        result = []

        for order in orders:

            try:
                items = __import__("json").loads(
                    order.items_json or "[]"
                )
            except Exception:
                items = []

            result.append({
                "order_id": order.id,
                "customer_id": order.customer_id,
                "restaurant_id": order.restaurant_id,
                "restaurant": order.restaurant,
                "cuisine": order.cuisine,
                "items": items,
                "delivery_address": {
                    "label": order.address_label,
                    "address": order.delivery_address,
                    "landmark": order.delivery_landmark,
                    "latitude": order.delivery_latitude,
                    "longitude": order.delivery_longitude
                },
                "item_total": order.item_total,
                "subtotal": order.subtotal,
                "discount": order.discount,
                "grand_total": order.grand_total,
                "coupon_code": order.coupon_code,
                "payment_method": getattr(order, "payment_method", "cod"),
                "payment_status": getattr(order, "payment_status", "pending"),
                "status": order.status,
                "created_at": order.created_at
            })

        return result

    finally:
        db.close()


@app.put("/restaurant/me/orders/{order_id}/status")
def update_restaurant_order_status(
    order_id: int,
    status: str,
    current_user: models.User = Depends(get_current_restaurant)
):

    allowed_statuses = {
        "placed",
        "preparing",
        "out_for_delivery",
        "delivered",
        "cancelled"
    }

    normalized_status = status.strip().lower()

    if normalized_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid order status. Allowed statuses: "
                "placed, preparing, out_for_delivery, delivered, cancelled."
            )
        )

    db = SessionLocal()

    try:

        order = (
            db.query(models.Order)
            .filter(
                models.Order.id == order_id,
                models.Order.restaurant_id == current_user.restaurant_id
            )
            .first()
        )

        if not order:
            raise HTTPException(
                status_code=404,
                detail="Order not found for this restaurant."
            )

        order.status = normalized_status

        db.commit()
        db.refresh(order)

        return {
            "message": "Order status updated successfully.",
            "order_id": order.id,
            "status": order.status
        }

    finally:
        db.close()


# ==================================================
# AUTHORIZED CUSTOMER ACCESS
# ==================================================

def get_authorized_customer(
    customer_id: int,
    current_user: models.User = Depends(get_current_user)
):

    if current_user.role == "admin":
        return current_user

    if (
        current_user.role == "customer"
        and current_user.customer_id == customer_id
    ):
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You are not authorized to access this customer data."
    )


# ==================================================
# CURRENT USER PROFILE
# ==================================================

@app.get("/auth/me")
def get_my_profile(
    current_user: models.User = Depends(get_current_user)
):

    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "customer_id": current_user.customer_id,
        "restaurant_id": current_user.restaurant_id
    }


# ==================================================
# CUSTOMER
# ==================================================

@app.get("/customer/{customer_id}")
def get_customer(
    customer_id: int,
    authorized_user: models.User =
        Depends(get_authorized_customer)
):

    db = SessionLocal()

    customer = (
        db.query(models.Customer)
        .filter(
            models.Customer.id == customer_id
        )
        .first()
    )

    db.close()

    if customer is None:

        return {
            "message": "Customer not found"
        }

    return {
        "customer_id": customer.id,
        "name": customer.name,
        "favorite_food": customer.favorite_food,
        "average_order_value": customer.average_order_value,
        "orders": customer.total_orders
    }


# ==================================================
# RESTAURANTS
# ==================================================

@app.get("/restaurants")
def get_restaurants():

    db = SessionLocal()

    restaurants = (
        db.query(models.Restaurant)
        .all()
    )

    db.close()

    return [
        {
            "restaurant_id": restaurant.id,
            "name": restaurant.name,
            "cuisine": restaurant.cuisine,
            "rating": restaurant.rating,
            "average_price": restaurant.average_price,
            "location": restaurant.location,
            "popularity": restaurant.popularity
        }
        for restaurant in restaurants
    ]


# ==================================================
# RESTAURANT DETAILS + MENU
# ==================================================

@app.get("/restaurants/{restaurant_id}")
def get_restaurant_details(
    restaurant_id: int
):

    db = SessionLocal()

    try:

        restaurant = (
            db.query(models.Restaurant)
            .filter(
                models.Restaurant.id == restaurant_id
            )
            .first()
        )

        if restaurant is None:

            raise HTTPException(
                status_code=404,
                detail="Restaurant not found."
            )

        menu_items = (
            db.query(models.MenuItem)
            .filter(
                models.MenuItem.restaurant_id == restaurant.id,
                models.MenuItem.is_available == True
            )
            .order_by(
                models.MenuItem.popularity.desc()
            )
            .all()
        )

        return {
            "restaurant_id": restaurant.id,
            "name": restaurant.name,
            "cuisine": restaurant.cuisine,
            "rating": restaurant.rating,
            "average_price": restaurant.average_price,
            "location": restaurant.location,
            "popularity": restaurant.popularity,
            "menu": [
                {
                    "item_id": item.id,
                    "name": item.name,
                    "cuisine": item.cuisine,
                    "description": item.description,
                    "price": item.price,
                    "is_vegetarian": item.is_vegetarian,
                    "rating": item.rating,
                    "popularity": item.popularity
                }
                for item in menu_items
            ]
        }

    finally:

        db.close()


# ==================================================
# RESTAURANT PARTNER PROFILE
# ==================================================

@app.get("/restaurant/me")
def get_restaurant_profile(
    current_user: models.User =
        Depends(get_current_restaurant)
):

    db = SessionLocal()

    try:

        restaurant = (
            db.query(models.Restaurant)
            .filter(
                models.Restaurant.id ==
                current_user.restaurant_id
            )
            .first()
        )

        if restaurant is None:

            raise HTTPException(
                status_code=404,
                detail="Linked restaurant not found."
            )

        return {
            "user_id": current_user.id,
            "username": current_user.username,
            "role": current_user.role,
            "restaurant_id": restaurant.id,
            "restaurant": restaurant.name,
            "cuisine": restaurant.cuisine,
            "rating": restaurant.rating,
            "average_price": restaurant.average_price,
            "location": restaurant.location,
            "popularity": restaurant.popularity
        }

    finally:

        db.close()
# ==================================================
# RESTAURANT PARTNER OFFER SETTINGS
# ==================================================

@app.get("/restaurant/me/offer-settings")
def get_restaurant_offer_settings(
    current_user: models.User =
        Depends(get_current_restaurant)
):

    db = SessionLocal()

    try:

        restaurant = (
            db.query(models.Restaurant)
            .filter(
                models.Restaurant.id ==
                current_user.restaurant_id
            )
            .first()
        )

        if restaurant is None:

            raise HTTPException(
                status_code=404,
                detail="Linked restaurant not found."
            )

        return {
            "restaurant_id": restaurant.id,
            "restaurant": restaurant.name,
            "max_discount_amount": restaurant.max_discount_amount,
            "max_discount_percent": restaurant.max_discount_percent,
            "ai_offers_enabled": restaurant.ai_offers_enabled
        }

    finally:

        db.close()


@app.put("/restaurant/me/offer-settings")
def update_restaurant_offer_settings(
    max_discount_amount: float,
    max_discount_percent: float,
    ai_offers_enabled: bool,
    current_user: models.User =
        Depends(get_current_restaurant)
):

    if max_discount_amount < 0:

        raise HTTPException(
            status_code=400,
            detail="Maximum discount amount cannot be negative."
        )

    if (
        max_discount_percent < 0
        or max_discount_percent > 100
    ):

        raise HTTPException(
            status_code=400,
            detail="Maximum discount percentage must be between 0 and 100."
        )

    db = SessionLocal()

    try:

        restaurant = (
            db.query(models.Restaurant)
            .filter(
                models.Restaurant.id ==
                current_user.restaurant_id
            )
            .first()
        )

        if restaurant is None:

            raise HTTPException(
                status_code=404,
                detail="Linked restaurant not found."
            )

        restaurant.max_discount_amount = round(
            float(max_discount_amount),
            2
        )

        restaurant.max_discount_percent = round(
            float(max_discount_percent),
            2
        )

        restaurant.ai_offers_enabled = bool(
            ai_offers_enabled
        )

        db.commit()
        db.refresh(restaurant)

        return {
            "message": "Restaurant offer settings updated successfully.",
            "restaurant_id": restaurant.id,
            "restaurant": restaurant.name,
            "max_discount_amount": restaurant.max_discount_amount,
            "max_discount_percent": restaurant.max_discount_percent,
            "ai_offers_enabled": restaurant.ai_offers_enabled
        }

    finally:

        db.close()

# ==================================================
# RESTAURANT PARTNER MENU
# ==================================================

@app.get("/restaurant/me/menu")
def get_restaurant_partner_menu(
    current_user: models.User =
        Depends(get_current_restaurant)
):

    db = SessionLocal()

    try:

        menu_items = (
            db.query(models.MenuItem)
            .filter(
                models.MenuItem.restaurant_id ==
                current_user.restaurant_id
            )
            .order_by(
                models.MenuItem.popularity.desc()
            )
            .all()
        )

        return [
            {
                "item_id": item.id,
                "name": item.name,
                "cuisine": item.cuisine,
                "description": item.description,
                "price": item.price,
                "is_vegetarian": item.is_vegetarian,
                "rating": item.rating,
                "popularity": item.popularity,
                "is_available": item.is_available
            }
            for item in menu_items
        ]

    finally:

        db.close()


# ==================================================
# RECORD CUSTOMER BEHAVIOR
# ==================================================

@app.post("/behavior")
def record_behavior(
    customer_id: int,
    action: str,
    item: str = "",
    restaurant: str = "",
    cuisine: str = "",
    order_value: float = 0,
    current_user: models.User =
        Depends(get_current_user)
):

    if current_user.role == "customer":

        if current_user.customer_id != customer_id:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You can record behavior only "
                    "for your own customer account."
                )
            )

    elif current_user.role != "admin":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Behavior recording access denied."
        )

    db = SessionLocal()

    behavior = models.CustomerBehavior(
        customer_id=customer_id,
        action=action,
        item=item,
        restaurant=restaurant,
        cuisine=cuisine,
        order_value=order_value,
        timestamp=datetime.utcnow()
    )

    db.add(behavior)
    db.commit()
    db.refresh(behavior)
    db.close()

    profile = refresh_customer_profile(customer_id)

    return {
        "message": "Customer behavior recorded successfully!",
        "behavior_id": behavior.id,
        "profile_updated": profile is not None
    }


# ==================================================
# REFRESH CUSTOMER AI PROFILE
# ==================================================

def refresh_customer_profile(customer_id: int):

    db = SessionLocal()

    try:

        customer = (
            db.query(models.Customer)
            .filter(
                models.Customer.id == customer_id
            )
            .first()
        )

        if customer is None:
            return None

        behaviors = (
            db.query(models.CustomerBehavior)
            .filter(
                models.CustomerBehavior.customer_id ==
                customer_id
            )
            .order_by(
                models.CustomerBehavior.timestamp.asc()
            )
            .all()
        )

        if not behaviors:

            return {
                "customer_id": customer_id,
                "favorite_food": customer.favorite_food,
                "average_order_value": customer.average_order_value,
                "total_orders": customer.total_orders,
                "coupon_sensitivity": customer.coupon_sensitivity,
                "behavior_events_used": 0,
                "cuisine_scores": {}
            }

        cuisine_scores = {}
        order_values = []
        order_count = 0
        coupon_events = 0

        action_weight = {
            "search": 1.0,
            "view item": 1.5,
            "view restaurant": 1.25,
            "add to cart": 2.0,
            "cart": 2.0,
            "order": 4.0,
            "coupon used": 2.5
        }

        meaningful_actions = set(
            action_weight.keys()
        )

        for behavior in behaviors:

            cuisine = (
                behavior.cuisine or ""
            ).strip()

            action = (
                behavior.action or ""
            ).strip().lower()

            weight = action_weight.get(
                action,
                1.0
            )

            if cuisine:

                cuisine_scores[cuisine] = (
                    cuisine_scores.get(
                        cuisine,
                        0
                    ) + weight
                )

            if action == "order":

                order_count += 1

                if (
                    behavior.order_value
                    and behavior.order_value > 0
                ):

                    order_values.append(
                        float(
                            behavior.order_value
                        )
                    )

            if action == "coupon used":

                coupon_events += 1

        if cuisine_scores:

            customer.favorite_food = max(
                cuisine_scores,
                key=cuisine_scores.get
            )

        if order_values:

            customer.average_order_value = round(
                sum(order_values) /
                len(order_values),
                2
            )

        meaningful_events = sum(
            1
            for behavior in behaviors
            if (
                behavior.action or ""
            ).strip().lower()
            in meaningful_actions
        )

        if coupon_events > 0 and meaningful_events > 0:

            observed_coupon_sensitivity = (
                coupon_events /
                meaningful_events
            )

            historical_sensitivity = float(
                customer.coupon_sensitivity or 0
            )

            customer.coupon_sensitivity = round(
                min(
                    1.0,
                    (
                        historical_sensitivity * 0.70
                        + observed_coupon_sensitivity * 0.30
                    )
                ),
                2
            )

        db.commit()
        db.refresh(customer)

        return {
            "customer_id": customer.id,
            "favorite_food": customer.favorite_food,
            "average_order_value": customer.average_order_value,
            "total_orders": customer.total_orders,
            "coupon_sensitivity": customer.coupon_sensitivity,
            "behavior_events_used": len(behaviors),
            "cuisine_scores": {
                cuisine: round(
                    score,
                    2
                )
                for cuisine, score in sorted(
                    cuisine_scores.items(),
                    key=lambda entry: entry[1],
                    reverse=True
                )
            }
        }

    finally:

        db.close()


# ==================================================
# REFRESH CUSTOMER PROFILE ENDPOINT
# ==================================================

@app.post("/ai/refresh-profile/{customer_id}")
def refresh_ai_profile(
    customer_id: int,
    authorized_user: models.User =
        Depends(get_authorized_customer)
):

    profile = refresh_customer_profile(
        customer_id
    )

    if profile is None:

        raise HTTPException(
            status_code=404,
            detail="Customer not found."
        )

    return profile


# ==================================================
# RESTAURANT PARTNER ANALYTICS
# ==================================================

@app.get("/restaurant/me/analytics")
def get_restaurant_analytics(
    current_user: models.User =
        Depends(get_current_restaurant)
):

    db = SessionLocal()

    try:

        restaurant = (
            db.query(models.Restaurant)
            .filter(
                models.Restaurant.id ==
                current_user.restaurant_id
            )
            .first()
        )

        if restaurant is None:

            raise HTTPException(
                status_code=404,
                detail="Linked restaurant not found."
            )

        restaurant_name = restaurant.name

        behaviors = (
            db.query(models.CustomerBehavior)
            .filter(
                models.CustomerBehavior.restaurant ==
                restaurant_name
            )
            .order_by(
                models.CustomerBehavior.timestamp.desc()
            )
            .all()
        )

        total_interactions = len(behaviors)

        total_orders = sum(
            1
            for behavior in behaviors
            if (
                behavior.action or ""
            ).strip().lower() == "order"
        )

        total_cart_events = sum(
            1
            for behavior in behaviors
            if (
                behavior.action or ""
            ).strip().lower()
            in {"cart", "add to cart","add_to_cart"}
        )

        # IMPORTANT:
        # The customer frontend records restaurant visits
        # using "restaurant_view".
        # "view restaurant" is also accepted for compatibility.
        total_restaurant_views = sum(
            1
            for behavior in behaviors
            if (
                behavior.action or ""
            ).strip().lower()
            in {
                "restaurant_view",
                "view_restaurant",
                "view restaurant"
            }
        )

        total_searches = sum(
            1
            for behavior in behaviors
            if (
                behavior.action or ""
            ).strip().lower() == "search"
        )

        order_values = [
            float(behavior.order_value)
            for behavior in behaviors
            if (
                behavior.action or ""
            ).strip().lower() == "order"
            and behavior.order_value
            and behavior.order_value > 0
        ]

        total_revenue = round(
            sum(order_values),
            2
        )

        average_order_value = round(
            sum(order_values) /
            len(order_values),
            2
        ) if order_values else 0

        unique_customers = len(
            set(
                behavior.customer_id
                for behavior in behaviors
                if behavior.customer_id is not None
            )
        )

        # ==================================================
        # ITEM-LEVEL ANALYTICS
        # ==================================================

        item_stats = {}

        for behavior in behaviors:

            if (
                behavior.item
                and (
                    behavior.action or ""
                ).strip().lower()
                in {
                    "view item",
                    "cart",
                    "add to cart",
                    "order"
                }
            ):

                item_name = behavior.item

                if item_name not in item_stats:

                    item_stats[item_name] = {
                        "item": item_name,
                        "interactions": 0,
                        "orders": 0,
                        "cart_adds": 0
                    }

                item_stats[item_name][
                    "interactions"
                ] += 1

                action = (
                    behavior.action or ""
                ).strip().lower()

                if action == "order":

                    item_stats[item_name][
                        "orders"
                    ] += 1

                if action in {"cart", "add to cart"}:

                    item_stats[item_name][
                        "cart_adds"
                    ] += 1

        top_items = sorted(
            item_stats.values(),
            key=lambda item: (
                item["orders"],
                item["cart_adds"],
                item["interactions"]
            ),
            reverse=True
        )[:10]

        # ==================================================
        # CUISINE ANALYTICS
        # ==================================================

        cuisine_stats = {}

        for behavior in behaviors:

            if not behavior.cuisine:
                continue

            cuisine_name = (
                behavior.cuisine.strip()
            )

            if cuisine_name not in cuisine_stats:

                cuisine_stats[cuisine_name] = {
                    "cuisine": cuisine_name,
                    "interactions": 0,
                    "orders": 0
                }

            cuisine_stats[cuisine_name][
                "interactions"
            ] += 1

            if (
                behavior.action or ""
            ).strip().lower() == "order":

                cuisine_stats[cuisine_name][
                    "orders"
                ] += 1

        top_cuisines = sorted(
            cuisine_stats.values(),
            key=lambda cuisine: (
                cuisine["orders"],
                cuisine["interactions"]
            ),
            reverse=True
        )

        # ==================================================
        # 7-DAY DEMAND TREND
        # ==================================================
        #
        # This is calculated from the timestamped behavior
        # events instead of static menu popularity values.
        # Each day contains the actual tracked interactions,
        # orders and revenue for this restaurant.
        # ==================================================

        today = datetime.utcnow().date()

        daily_activity = {}

        for offset in range(6, -1, -1):
            day = today.fromordinal(
                today.toordinal() - offset
            )
            day_key = day.isoformat()

            daily_activity[day_key] = {
                "date": day_key,
                "interactions": 0,
                "orders": 0,
                "revenue": 0
            }

        for behavior in behaviors:
            if behavior.timestamp is None:
                continue

            behavior_day = behavior.timestamp.date()
            day_key = behavior_day.isoformat()

            if day_key not in daily_activity:
                continue

            daily_activity[day_key]["interactions"] += 1

            action = (
                behavior.action or ""
            ).strip().lower()

            if action == "order":
                daily_activity[day_key]["orders"] += 1

                if (
                    behavior.order_value
                    and behavior.order_value > 0
                ):
                    daily_activity[day_key]["revenue"] += float(
                        behavior.order_value
                    )

        demand_last_7_days = [
            {
                "date": day["date"],
                "interactions": day["interactions"],
                "orders": day["orders"],
                "revenue": round(day["revenue"], 2)
            }
            for day in daily_activity.values()
        ]

        # ==================================================
        # ACTION BREAKDOWN
        # ==================================================

        action_breakdown = {}

        for behavior in behaviors:

            action = (
                behavior.action or "unknown"
            ).strip().lower()

            action_breakdown[action] = (
                action_breakdown.get(action, 0) + 1
            )

        # ==================================================
        # CONVERSION
        # ==================================================

        conversion_rate = round(
            (
                total_orders /
                total_restaurant_views
            ) * 100,
            2
        ) if total_restaurant_views > 0 else 0

        # ==================================================
        # RESPONSE
        # ==================================================

        return {
            "restaurant_id":
                restaurant.id,

            "restaurant":
                restaurant.name,

            "cuisine":
                restaurant.cuisine,

            "rating":
                restaurant.rating,

            "summary": {

                "total_interactions":
                    total_interactions,

                "unique_customers":
                    unique_customers,

                "restaurant_views":
                    total_restaurant_views,

                "searches":
                    total_searches,

                "cart_events":
                    total_cart_events,

                "orders":
                    total_orders,

                "total_revenue":
                    total_revenue,

                "average_order_value":
                    average_order_value,

                "view_to_order_conversion":
                    conversion_rate
            },

            "action_breakdown":
                action_breakdown,

            "top_items":
                top_items,

            "top_cuisines":
                top_cuisines,

            "demand_last_7_days":
                demand_last_7_days
        }

    finally:

        db.close()


# ==================================================
# CUSTOMER BEHAVIOR
# ==================================================

@app.get("/behavior/{customer_id}")
def get_customer_behavior(
    customer_id: int,
    authorized_user: models.User =
        Depends(get_authorized_customer)
):

    db = SessionLocal()

    behaviors = (
        db.query(models.CustomerBehavior)
        .filter(
            models.CustomerBehavior.customer_id ==
            customer_id
        )
        .order_by(
            models.CustomerBehavior.timestamp.desc()
        )
        .all()
    )

    db.close()

    return [
        {
            "behavior_id": behavior.id,
            "customer_id": behavior.customer_id,
            "action": behavior.action,
            "item": behavior.item,
            "restaurant": behavior.restaurant,
            "cuisine": behavior.cuisine,
            "order_value": behavior.order_value,
            "timestamp": behavior.timestamp
        }
        for behavior in behaviors
    ]


# ==================================================
# DATA SUMMARY - ADMIN ONLY
# ==================================================

@app.get("/data-summary")
def data_summary(
    current_admin: models.User =
        Depends(get_current_admin)
):

    db = SessionLocal()

    customer_count = (
        db.query(models.Customer)
        .count()
    )

    restaurant_count = (
        db.query(models.Restaurant)
        .count()
    )

    behavior_count = (
        db.query(models.CustomerBehavior)
        .count()
    )

    db.close()

    return {
        "customers": customer_count,
        "restaurants": restaurant_count,
        "behavior_events": behavior_count
    }


# ==================================================
# CUSTOMER AI ANALYSIS
# ==================================================

@app.get("/ai/customer/{customer_id}")
def analyze_customer(
    customer_id: int,
    authorized_user: models.User =
        Depends(get_authorized_customer)
):

    return analyze_customer_preferences(
        customer_id
    )


# ==================================================
# RECOMMENDATIONS
# ==================================================

@app.get("/recommendations/{customer_id}")
def recommendations(
    customer_id: int,
    authorized_user: models.User =
        Depends(get_authorized_customer)
):

    return get_recommendations(
        customer_id
    )


# ==================================================
# CUISINE PREDICTION
# ==================================================

@app.get("/ai/predict/{customer_id}")
def predict_cuisine(
    customer_id: int,
    authorized_user: models.User =
        Depends(get_authorized_customer)
):

    return predict_customer_cuisine(
        customer_id
    )


# ==================================================
# CUSTOMER MODEL EVALUATION - ADMIN ONLY
# ==================================================

@app.get("/ai/model-evaluation")
def model_evaluation(
    current_admin: models.User =
        Depends(get_current_admin)
):

    model_file = "customer_cuisine_model.pkl"

    if not os.path.exists(model_file):

        return {
            "message":
                "Customer cuisine model has not been trained yet."
        }

    try:

        model_data = joblib.load(
            model_file
        )

        evaluation = model_data.get(
            "evaluation"
        )

        if evaluation is None:

            return {
                "message":
                    "Model evaluation data is not available."
            }

        return {
            "model": "Random Forest",
            "task": "Customer Cuisine Prediction",
            "accuracy": evaluation.get(
                "accuracy",
                0
            ),
            "accuracy_percentage": round(
                evaluation.get(
                    "accuracy",
                    0
                ) * 100,
                2
            ),
            "training_customers": evaluation.get(
                "training_customers",
                0
            ),
            "testing_customers": evaluation.get(
                "testing_customers",
                0
            ),
            "classification_report": evaluation.get(
                "classification_report",
                {}
            ),
            "feature_importance": evaluation.get(
                "feature_importance",
                []
            )
        }

    except Exception as error:

        return {
            "message":
                "Unable to load model evaluation.",
            "error":
                str(error)
        }


# ==================================================
# OFFER RESPONSE MODEL EVALUATION - ADMIN ONLY
# ==================================================

@app.get("/ai/offer-model-evaluation")
def offer_model_evaluation(
    current_admin: models.User =
        Depends(get_current_admin)
):

    model_file = "offer_response_model.pkl"

    if not os.path.exists(model_file):

        return {
            "message":
                "Offer response model has not been trained yet."
        }

    try:

        model_data = joblib.load(
            model_file
        )

        evaluation = model_data.get(
            "evaluation"
        )

        if evaluation is None:

            return {
                "message":
                    "Offer response model evaluation "
                    "is not available."
            }

        model = model_data.get(
            "model"
        )

        feature_columns = model_data.get(
            "feature_columns",
            []
        )

        coefficients = []

        if (
            model is not None
            and hasattr(model, "coef_")
            and len(feature_columns)
            == len(model.coef_[0])
        ):

            for feature, coefficient in zip(
                feature_columns,
                model.coef_[0]
            ):

                coefficients.append({
                    "feature": feature,
                    "coefficient": float(
                        coefficient
                    ),
                    "absolute_coefficient": float(
                        abs(coefficient)
                    )
                })

            coefficients.sort(
                key=lambda item:
                    item["absolute_coefficient"],
                reverse=True
            )

        return {
            "model": "Logistic Regression",
            "task": "Offer Acceptance Prediction",
            "accuracy": evaluation.get(
                "accuracy",
                0
            ),
            "accuracy_percentage": round(
                evaluation.get(
                    "accuracy",
                    0
                ) * 100,
                2
            ),
            "roc_auc": evaluation.get(
                "roc_auc",
                0
            ),
            "training_customers": evaluation.get(
                "training_customers",
                0
            ),
            "testing_customers": evaluation.get(
                "testing_customers",
                0
            ),
            "feature_columns": feature_columns,
            "coefficients": coefficients
        }

    except Exception as error:

        return {
            "message":
                "Unable to load offer response model evaluation.",
            "error":
                str(error)
        }


# ==================================================
# PERSONALIZED OFFER
# ==================================================

@app.get("/offers/{customer_id}")
def personalized_offer(
    customer_id: int,
    restaurant_id: int = None,
    order_value: float = 0,
    authorized_user: models.User =
        Depends(get_authorized_customer)
):

    db = SessionLocal()

    try:

        customer = (
            db.query(models.Customer)
            .filter(
                models.Customer.id == customer_id
            )
            .first()
        )

        if customer is None:

            return {
                "message": "Customer not found"
            }

        # --------------------------------------------------
        # TARGET RESTAURANT
        # --------------------------------------------------
        # restaurant_id is optional for backward compatibility
        # with the existing frontend. The next frontend step
        # will always provide it for restaurant-specific offers.
        restaurant = None

        if restaurant_id is not None:

            restaurant = (
                db.query(models.Restaurant)
                .filter(
                    models.Restaurant.id == restaurant_id
                )
                .first()
            )

            if restaurant is None:

                raise HTTPException(
                    status_code=404,
                    detail="Target restaurant not found."
                )

            # A restaurant partner controls whether AI offers
            # are allowed for that restaurant.
            if not restaurant.ai_offers_enabled:

                return {
                    "customer_id": customer.id,
                    "customer_name": customer.name,
                    "restaurant_id": restaurant.id,
                    "restaurant": restaurant.name,
                    "coupon": None,
                    "recommended_discount": 0,
                    "decision_reason":
                        "AI offers are disabled by this restaurant."
                }

        # --------------------------------------------------
        # RESTAURANT-CONTROLLED AI DECISION
        # --------------------------------------------------
        # The restaurant defines the maximum amount the AI is
        # allowed to discount. The optimizer can personalize
        # the actual offer only inside that restaurant-defined
        # ceiling.
        optimizer_discount_ceiling = None

        if restaurant is not None:

            requested_order_value = float(
                order_value or 0
            )

            estimated_order_value_for_ai = (
                requested_order_value
                if requested_order_value > 0
                else float(
                    customer.average_order_value or 0
                )
            )

            restaurant_max_amount_for_ai = max(
                float(
                    restaurant.max_discount_amount or 0
                ),
                0
            )

            restaurant_max_percent_for_ai = min(
                max(
                    float(
                        restaurant.max_discount_percent or 0
                    ),
                    0
                ),
                100
            )

            if estimated_order_value_for_ai > 0:

                optimizer_discount_ceiling = min(
                    restaurant_max_amount_for_ai,
                    estimated_order_value_for_ai *
                    restaurant_max_percent_for_ai /
                    100
                )

            else:

                optimizer_discount_ceiling = (
                    restaurant_max_amount_for_ai
                )

        else:

            # No restaurant context means retain the existing
            # safe standalone optimizer ceiling.
            optimizer_discount_ceiling = 50

        offer = optimize_offer(
            customer_id,
            max_discount_amount=optimizer_discount_ceiling
        )

        recommended_discount = float(
            offer.get(
                "recommended_discount",
                0
            ) or 0
        )

        # --------------------------------------------------
        # RESTAURANT-SPECIFIC CUSTOMER BEHAVIOR
        # --------------------------------------------------
        restaurant_order_count = 0
        restaurant_interaction_count = 0

        # Item/food affinity for the target restaurant.
        # This is deliberately calculated from CustomerBehavior so
        # the offer system learns from real customer activity.
        restaurant_item_orders = {}
        restaurant_item_interactions = {}
        restaurant_cuisine_interactions = {}

        if restaurant is not None:

            restaurant_behaviors = (
                db.query(models.CustomerBehavior)
                .filter(
                    models.CustomerBehavior.customer_id ==
                    customer_id,
                    models.CustomerBehavior.restaurant ==
                    restaurant.name
                )
                .all()
            )

            restaurant_interaction_count = len(
                restaurant_behaviors
            )

            restaurant_order_count = sum(
                1
                for behavior in restaurant_behaviors
                if (
                    behavior.action or ""
                ).strip().lower() == "order"
            )

            for behavior in restaurant_behaviors:

                action = (
                    behavior.action or ""
                ).strip().lower()

                item_name = (
                    behavior.item or ""
                ).strip()

                cuisine_name = (
                    behavior.cuisine or ""
                ).strip()

                if item_name:

                    restaurant_item_interactions[
                        item_name
                    ] = (
                        restaurant_item_interactions.get(
                            item_name,
                            0
                        ) + 1
                    )

                    if action == "order":

                        restaurant_item_orders[
                            item_name
                        ] = (
                            restaurant_item_orders.get(
                                item_name,
                                0
                            ) + 1
                        )

                if cuisine_name:

                    restaurant_cuisine_interactions[
                        cuisine_name
                    ] = (
                        restaurant_cuisine_interactions.get(
                            cuisine_name,
                            0
                        ) + 1
                    )

            # Existing restaurant loyalty is now represented as
            # affinity data instead of automatically increasing the
            # discount. A customer who already orders here should
            # not receive an unnecessary extra discount.
            if (
                recommended_discount > 0
                and restaurant_order_count == 0
            ):

                recommended_discount += 10

            elif (
                recommended_discount > 0
                and restaurant_order_count == 1
            ):

                recommended_discount += 5

            # The target restaurant's strongest previously ordered
            # item/cuisine becomes explicit offer context.
            top_ordered_item = (
                max(
                    restaurant_item_orders,
                    key=restaurant_item_orders.get
                )
                if restaurant_item_orders
                else None
            )

            top_item_interactions = (
                max(
                    restaurant_item_interactions,
                    key=restaurant_item_interactions.get
                )
                if restaurant_item_interactions
                else None
            )

            top_cuisine = (
                max(
                    restaurant_cuisine_interactions,
                    key=restaurant_cuisine_interactions.get
                )
                if restaurant_cuisine_interactions
                else None
            )

            offer["restaurant_item_orders"] = (
                restaurant_item_orders
            )

            offer["restaurant_item_interactions"] = (
                restaurant_item_interactions
            )

            offer["restaurant_cuisine_interactions"] = (
                restaurant_cuisine_interactions
            )

            offer["top_ordered_item"] = top_ordered_item
            offer["top_item_interactions"] = top_item_interactions
            offer["top_restaurant_cuisine"] = top_cuisine

            affinity_parts = []

            if top_ordered_item:
                affinity_parts.append(
                    f"frequently ordered {top_ordered_item}"
                )

            elif top_item_interactions:
                affinity_parts.append(
                    f"frequently viewed/selected {top_item_interactions}"
                )

            if top_cuisine:
                affinity_parts.append(
                    f"interacts with {top_cuisine} food"
                )

            if affinity_parts:

                offer["affinity_reason"] = (
                    "Customer affinity: "
                    + " and ".join(affinity_parts)
                    + "."
                )

        # --------------------------------------------------
        # RESTAURANT DISCOUNT LIMITS
        # --------------------------------------------------
        if restaurant is not None:

            requested_order_value = float(
                order_value or 0
            )

            estimated_order_value = (
                requested_order_value
                if requested_order_value > 0
                else float(
                    customer.average_order_value or 0
                )
            )

            max_amount = max(
                float(
                    restaurant.max_discount_amount or 0
                ),
                0
            )

            max_percent = min(
                max(
                    float(
                        restaurant.max_discount_percent or 0
                    ),
                    0
                ),
                100
            )

            if estimated_order_value > 0:

                max_percent_amount = (
                    estimated_order_value *
                    max_percent /
                    100
                )

                max_allowed_discount = min(
                    max_amount,
                    max_percent_amount
                )

            else:

                # There is no historical order value yet,
                # so the percentage limit cannot be converted
                # into a rupee value. The absolute restaurant
                # limit remains the safe fallback.
                max_allowed_discount = max_amount

            recommended_discount = min(
                max(
                    recommended_discount,
                    0
                ),
                max_allowed_discount
            )

            recommended_discount = round(
                recommended_discount,
                2
            )

            offer["restaurant_id"] = restaurant.id
            offer["restaurant"] = restaurant.name
            offer["restaurant_order_count"] = (
                restaurant_order_count
            )
            offer["restaurant_interaction_count"] = (
                restaurant_interaction_count
            )
            offer["restaurant_max_discount_amount"] = (
                max_amount
            )
            offer["restaurant_max_discount_percent"] = (
                max_percent
            )
            offer["max_allowed_discount"] = round(
                max_allowed_discount,
                2
            )

            if recommended_discount > 0:

                offer["decision_reason"] = (
                    offer.get(
                        "decision_reason",
                        "AI personalized offer"
                    )
                    + f" Targeted for {restaurant.name} "
                    "using customer behavior and restaurant limits."
                )

                if offer.get("affinity_reason"):

                    offer["decision_reason"] += (
                        " "
                        + offer["affinity_reason"]
                    )

        offer["recommended_discount"] = (
            recommended_discount
        )

        # If the optimizer or restaurant rules result in no
        # discount, do not manufacture a zero-value coupon.
        if recommended_discount <= 0:

            return {
                "customer_id": customer.id,
                "customer_name": customer.name,
                "coupon": None,
                **offer
            }

        # --------------------------------------------------
        # REUSE ONLY A MATCHING CURRENT COUPON
        # --------------------------------------------------
        coupon_query = (
            db.query(models.Coupon)
            .filter(
                models.Coupon.customer_id == customer_id,
                models.Coupon.status.in_([
                    "offered",
                    "viewed",
                    "applied"
                ])
            )
        )

        if restaurant is not None:

            coupon_query = coupon_query.filter(
                models.Coupon.restaurant ==
                restaurant.name
            )

        else:

            coupon_query = coupon_query.filter(
                models.Coupon.restaurant.is_(None)
                |
                (models.Coupon.restaurant == "")
            )

        existing_coupon = (
            coupon_query
            .order_by(
                models.Coupon.created_at.desc()
            )
            .first()
        )

        if existing_coupon is None:

            coupon_code = (
                f"FOODAI-{customer_id}-"
                f"{secrets.token_hex(3).upper()}"
            )

            min_order_value = max(
                float(customer.average_order_value or 0),
                recommended_discount
            )

            existing_coupon = models.Coupon(
                customer_id=customer_id,
                code=coupon_code,
                discount_amount=recommended_discount,
                min_order_value=min_order_value,
                status="offered",
                offer_reason=offer.get(
                    "decision_reason",
                    "AI personalized offer"
                ),
                restaurant=(
                    restaurant.name
                    if restaurant is not None
                    else None
                ),
                cuisine=(
                    restaurant.cuisine
                    if restaurant is not None
                    else None
                ),
                created_at=datetime.utcnow()
            )

            db.add(existing_coupon)
            db.commit()
            db.refresh(existing_coupon)

        else:

            # Refresh an existing active coupon when the AI makes a
            # different recommendation. This prevents an old coupon
            # (for example ₹20) from permanently masking a newer
            # AI decision (for example ₹50).
            #
            # The restaurant cap is still enforced before this point,
            # so the refreshed coupon can never exceed the restaurant's
            # configured maximum.
            existing_coupon.discount_amount = min(
                float(recommended_discount),
                float(
                    offer.get(
                        "max_allowed_discount",
                        recommended_discount
                    )
                )
            )

            existing_coupon.offer_reason = offer.get(
                "decision_reason",
                existing_coupon.offer_reason or
                "AI personalized offer"
            )

            # Keep the minimum order requirement aligned with the
            # customer's current profile and the current offer.
            existing_coupon.min_order_value = max(
                float(customer.average_order_value or 0),
                float(existing_coupon.discount_amount or 0)
            )

            db.commit()
            db.refresh(existing_coupon)

        coupon_data = {
            "id": existing_coupon.id,
            "code": existing_coupon.code,
            "discount_amount": existing_coupon.discount_amount,
            "min_order_value": existing_coupon.min_order_value,
            "status": existing_coupon.status,
            "offer_reason": existing_coupon.offer_reason,
            "restaurant": existing_coupon.restaurant,
            "cuisine": existing_coupon.cuisine,
            "created_at": existing_coupon.created_at.isoformat()
            if existing_coupon.created_at
            else None
        }

        return {
            "customer_id": customer.id,
            "customer_name": customer.name,
            "coupon": coupon_data,
            **offer
        }

    finally:

        db.close()



# ==================================================
# COUPON APPLICATION
# ==================================================

@app.post("/coupons/apply")
def apply_coupon(
    payload: dict,
    authorized_user: models.User =
        Depends(get_authorized_customer)
):

    coupon_code = str(
        payload.get("coupon_code", "")
    ).strip().upper()

    order_value = float(
        payload.get("order_value", 0) or 0
    )

    if not coupon_code:
        raise HTTPException(
            status_code=400,
            detail="Coupon code is required."
        )

    if order_value <= 0:
        raise HTTPException(
            status_code=400,
            detail="Order value must be greater than zero."
        )

    db = SessionLocal()

    try:
        coupon = (
            db.query(models.Coupon)
            .filter(
                models.Coupon.code == coupon_code,
                models.Coupon.customer_id == authorized_user.customer_id
            )
            .first()
        )

        if coupon is None:
            raise HTTPException(
                status_code=404,
                detail="Coupon not found for this customer."
            )

        if coupon.status == "redeemed":
            raise HTTPException(
                status_code=400,
                detail="This coupon has already been redeemed."
            )

        if coupon.status not in ["offered", "viewed", "applied"]:
            raise HTTPException(
                status_code=400,
                detail="This coupon is not available for application."
            )

        if order_value < float(coupon.min_order_value or 0):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Minimum order value is ₹{coupon.min_order_value:.0f}."
                )
            )

        coupon.status = "applied"
        coupon.applied_at = datetime.utcnow()

        db.commit()

        discount_amount = min(
            max(float(coupon.discount_amount or 0), 0),
            order_value
        )

        final_order_value = max(
            order_value - discount_amount,
            0
        )

        return {
            "coupon_id": coupon.id,
            "coupon_code": coupon.code,
            "discount_amount": discount_amount,
            "min_order_value": float(coupon.min_order_value),
            "order_value": order_value,
            "final_order_value": final_order_value,
            "status": coupon.status
        }

    finally:
        db.close()


# ==================================================
# ADMIN PAYMENT + ORDER ANALYTICS
# ==================================================

@app.get("/admin/order-payment-analytics")
def admin_order_payment_analytics(
    current_admin: models.User = Depends(get_current_admin)
):
    db = SessionLocal()

    try:
        orders = db.query(models.Order).all()

        total_orders = len(orders)

        total_revenue = sum(
            float(order.grand_total or 0)
            for order in orders
            if (order.status or "").lower() != "cancelled"
        )

        paid_demo_orders = sum(
            1
            for order in orders
            if getattr(order, "payment_status", None) == "paid_demo"
        )

        cod_orders = sum(
            1
            for order in orders
            if getattr(order, "payment_method", None) == "cod"
        )

        payment_pending_orders = sum(
            1
            for order in orders
            if getattr(order, "payment_status", None) in {
                None,
                "",
                "pending"
            }
        )

        active_orders = sum(
            1
            for order in orders
            if (order.status or "").lower() in {
                "placed",
                "preparing",
                "out_for_delivery"
            }
        )

        delivered_orders = sum(
            1
            for order in orders
            if (order.status or "").lower() == "delivered"
        )

        cancelled_orders = sum(
            1
            for order in orders
            if (order.status or "").lower() == "cancelled"
        )

        non_cancelled_orders = [
            order
            for order in orders
            if (order.status or "").lower() != "cancelled"
        ]

        average_order_value = (
            total_revenue / len(non_cancelled_orders)
            if non_cancelled_orders
            else 0
        )

        payment_pending_amount = sum(
            float(order.grand_total or 0)
            for order in orders
            if getattr(order, "payment_status", None)
            in {None, "", "pending"}
            and (order.status or "").lower() != "cancelled"
        )

        # Build a real 7-day trend from persisted orders.
        # Cancelled orders are excluded from revenue but retained in order counts.
        today = datetime.utcnow().date()
        daily_trends = []

        for offset in range(6, -1, -1):
            trend_date = today - __import__("datetime").timedelta(days=offset)
            day_orders = [
                order
                for order in orders
                if order.created_at
                and order.created_at.date() == trend_date
            ]

            day_revenue = sum(
                float(order.grand_total or 0)
                for order in day_orders
                if (order.status or "").lower() != "cancelled"
            )

            daily_trends.append({
                "date": trend_date.isoformat(),
                "label": trend_date.strftime("%d %b"),
                "orders": len(day_orders),
                "revenue": round(day_revenue, 2)
            })

        payment_breakdown = {
            "cod": cod_orders,
            "online_demo": paid_demo_orders
        }

        status_breakdown = {
            "placed": sum(1 for order in orders if (order.status or "").lower() == "placed"),
            "preparing": sum(1 for order in orders if (order.status or "").lower() == "preparing"),
            "out_for_delivery": sum(1 for order in orders if (order.status or "").lower() == "out_for_delivery"),
            "delivered": delivered_orders,
            "cancelled": cancelled_orders
        }

        return {
            "total_orders": total_orders,
            "total_revenue": round(total_revenue, 2),
            "paid_demo_orders": paid_demo_orders,
            "cod_orders": cod_orders,
            "payment_pending_orders": payment_pending_orders,
            "payment_pending_amount": round(payment_pending_amount, 2),
            "active_orders": active_orders,
            "delivered_orders": delivered_orders,
            "cancelled_orders": cancelled_orders,
            "average_order_value": round(average_order_value, 2),
            "daily_trends": daily_trends,
            "payment_breakdown": payment_breakdown,
            "status_breakdown": status_breakdown
        }

    finally:
        db.close()




# ==================================================
# COUPON REDEMPTION + LEARNING EVENT
# ==================================================

@app.post("/coupons/redeem")
def redeem_coupon(
    payload: dict,
    authorized_user: models.User =
        Depends(get_authorized_customer)
):

    coupon_code = str(
        payload.get("coupon_code", "")
    ).strip().upper()

    order_value = float(
        payload.get("order_value", 0) or 0
    )

    order_item = str(
        payload.get("order_item", "") or ""
    )

    restaurant = str(
        payload.get("restaurant", "") or ""
    )

    cuisine = str(
        payload.get("cuisine", "") or ""
    )

    if not coupon_code:
        raise HTTPException(
            status_code=400,
            detail="Coupon code is required."
        )

    if order_value <= 0:
        raise HTTPException(
            status_code=400,
            detail="Order value must be greater than zero."
        )

    db = SessionLocal()

    try:
        coupon = (
            db.query(models.Coupon)
            .filter(
                models.Coupon.code == coupon_code,
                models.Coupon.customer_id == authorized_user.customer_id
            )
            .first()
        )

        if coupon is None:
            raise HTTPException(
                status_code=404,
                detail="Coupon not found for this customer."
            )

        if coupon.status == "redeemed":
            raise HTTPException(
                status_code=400,
                detail="This coupon has already been redeemed."
            )

        if coupon.status != "applied":
            raise HTTPException(
                status_code=400,
                detail="Coupon must be applied before redemption."
            )

        if order_value < float(coupon.min_order_value or 0):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Minimum order value is ₹{coupon.min_order_value:.0f}."
                )
            )

        coupon.status = "redeemed"
        coupon.redeemed_at = datetime.utcnow()
        coupon.order_value = order_value
        coupon.redeemed_discount = float(
            coupon.discount_amount or 0
        )
        coupon.order_item = order_item
        coupon.restaurant = restaurant
        coupon.cuisine = cuisine

        behavior = models.CustomerBehavior(
            customer_id=authorized_user.customer_id,
            action="coupon used",
            item=order_item,
            restaurant=restaurant,
            cuisine=cuisine,
            order_value=order_value,
            timestamp=datetime.utcnow()
        )

        db.add(behavior)
        db.commit()

        # The redemption is now a real observed coupon response.
        # Recalculate customer intelligence using that event.
        db.close()

        try:
            refresh_customer_profile(
                authorized_user.customer_id
            )
        except Exception as error:
            print(
                "Coupon redemption profile refresh error:",
                error
            )

        return {
            "coupon_id": coupon.id,
            "coupon_code": coupon.code,
            "status": coupon.status,
            "discount_amount": float(coupon.discount_amount),
            "order_value": order_value,
            "final_order_value": max(
                order_value - float(coupon.discount_amount),
                0
            )
        }

    finally:
        try:
            db.close()
        except Exception:
            pass


# ==================================================
# ADMIN-ONLY TEST ENDPOINT
# ==================================================

@app.get("/admin/test")
def admin_test(
    current_admin: models.User =
        Depends(get_current_admin)
):

    return {
        "message":
            "Company authentication successful.",
        "user_id":
            current_admin.id,
        "username":
            current_admin.username,
        "role":
            current_admin.role
    }