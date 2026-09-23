from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Boolean,
    ForeignKey,
    Text
)

from sqlalchemy.orm import relationship

from database import Base

from datetime import datetime


# --------------------------------------------------
# CUSTOMER
# --------------------------------------------------

class Customer(Base):

    __tablename__ = "customers"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String
    )

    favorite_food = Column(
        String
    )

    average_order_value = Column(
        Float
    )

    total_orders = Column(
        Integer
    )

    # Individual customer's coupon sensitivity.
    coupon_sensitivity = Column(
        Float
    )

    # Saved delivery addresses.
    addresses = relationship(
        "CustomerAddress",
        back_populates="customer",
        cascade="all, delete-orphan"
    )


# --------------------------------------------------
# CUSTOMER ADDRESS
# --------------------------------------------------

class CustomerAddress(Base):

    __tablename__ = "customer_addresses"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Customer who owns this saved address.
    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False,
        index=True
    )

    # Label shown to the customer.
    # Examples: Home, College, Work.
    label = Column(
        String,
        nullable=False,
        default="Other"
    )

    # Human-readable address.
    address = Column(
        String,
        nullable=False
    )

    # Optional additional address details.
    landmark = Column(
        String,
        nullable=True
    )

    # Geographic coordinates.
    latitude = Column(
        Float,
        nullable=False
    )

    longitude = Column(
        Float,
        nullable=False
    )

    # Whether this is the customer's default delivery address.
    is_default = Column(
        Boolean,
        nullable=False,
        default=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    customer = relationship(
        "Customer",
        back_populates="addresses"
    )


# --------------------------------------------------
# RESTAURANT
# --------------------------------------------------

class Restaurant(Base):

    __tablename__ = "restaurants"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String
    )

    cuisine = Column(
        String
    )

    rating = Column(
        Float
    )

    average_price = Column(
        Float
    )

    location = Column(
        String
    )

    # Geographic coordinates used for maps,
    # nearby-restaurant search and distance calculation.
    latitude = Column(
        Float,
        nullable=True
    )

    longitude = Column(
        Float,
        nullable=True
    )

    popularity = Column(
        Integer
    )

    # --------------------------------------------------
    # AI OFFER CONTROLS
    # --------------------------------------------------

    # Maximum fixed discount that FoodAI can give
    # on this restaurant.
    #
    # Example:
    # 80 = AI can never recommend more than ₹80.
    max_discount_amount = Column(
        Float,
        nullable=False,
        default=50.0
    )

    # Maximum percentage discount that FoodAI can give
    # on this restaurant.
    #
    # Example:
    # 25 = maximum 25% discount.
    max_discount_percent = Column(
        Float,
        nullable=False,
        default=20.0
    )

    # Restaurant can completely disable
    # AI personalized offers.
    ai_offers_enabled = Column(
        Boolean,
        nullable=False,
        default=True
    )

    # Every restaurant can have
    # multiple menu items.
    menu_items = relationship(
        "MenuItem",
        back_populates="restaurant",
        cascade="all, delete-orphan"
    )


# --------------------------------------------------
# MENU ITEM / FOOD ITEM
# --------------------------------------------------

class MenuItem(Base):

    __tablename__ = "menu_items"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Restaurant that owns this dish.
    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id"),
        nullable=False,
        index=True
    )

    # Dish name.
    name = Column(
        String,
        nullable=False,
        index=True
    )

    # Cuisine/category of the dish.
    cuisine = Column(
        String,
        nullable=False,
        index=True
    )

    # Menu category shown to customers.
    category = Column(
        String,
        nullable=True,
        index=True
    )

    # Short description shown to customers.
    description = Column(
        String
    )

    # Uploaded image path/URL for this dish.
    image_url = Column(
        String,
        nullable=True
    )

    # Dish price.
    price = Column(
        Float,
        nullable=False
    )

    # Vegetarian / non-vegetarian.
    is_vegetarian = Column(
        Boolean,
        default=True
    )

    # Dish rating.
    rating = Column(
        Float,
        default=4.0
    )

    # Synthetic popularity score.
    popularity = Column(
        Integer,
        default=50
    )

    # Whether the restaurant currently
    # has this dish available.
    is_available = Column(
        Boolean,
        default=True
    )

    # Relationship back to restaurant.
    restaurant = relationship(
        "Restaurant",
        back_populates="menu_items"
    )


# --------------------------------------------------
# CUSTOMER BEHAVIOR
# --------------------------------------------------

class CustomerBehavior(Base):

    __tablename__ = "customer_behaviors"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    customer_id = Column(
        Integer
    )

    action = Column(
        String
    )

    item = Column(
        String
    )

    restaurant = Column(
        String
    )

    cuisine = Column(
        String
    )

    order_value = Column(
        Float
    )

    timestamp = Column(
        DateTime,
        default=datetime.utcnow
    )


# --------------------------------------------------
# USER / AUTHENTICATION
# --------------------------------------------------

class User(Base):

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Login username / email.
    username = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    # Securely hashed password.
    password_hash = Column(
        String,
        nullable=False
    )

    # customer = normal food-delivery user
    # admin = company dashboard user
    # restaurant = restaurant partner
    role = Column(
        String,
        nullable=False,
        default="customer"
    )

    # Existing synthetic customer link.
    customer_id = Column(
        Integer,
        nullable=True
    )

    # Future restaurant partner link.
    restaurant_id = Column(
        Integer,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )


# --------------------------------------------------
# COUPON
# --------------------------------------------------
#
# A real personalized FoodAI offer.
#
# Lifecycle:
#
# offered -> applied -> redeemed
#
# The same coupon can also remain:
#
# offered -> expired
#
# This allows FoodAI to measure whether customers
# actually respond to AI-generated offers.
# --------------------------------------------------

class Coupon(Base):

    __tablename__ = "coupons"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    # Customer receiving the personalized coupon.
    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False,
        index=True
    )

    # Unique coupon code shown to the customer.
    code = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    # AI-recommended discount amount in rupees.
    discount_amount = Column(
        Float,
        nullable=False,
        default=0
    )

    # Minimum cart/order value required.
    min_order_value = Column(
        Float,
        nullable=False,
        default=0
    )

    # Coupon lifecycle status.
    #
    # offered  = generated by FoodAI
    # applied  = customer applied it
    # redeemed = customer completed an order using it
    # expired  = coupon was not used
    status = Column(
        String,
        nullable=False,
        default="offered",
        index=True
    )

    # Optional context for explaining the offer.
    offer_reason = Column(
        String
    )

    # When FoodAI generated the coupon.
    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    # When customer viewed the coupon.
    viewed_at = Column(
        DateTime,
        nullable=True
    )

    # When customer applied the coupon.
    applied_at = Column(
        DateTime,
        nullable=True
    )

    # When the coupon resulted in a completed order.
    redeemed_at = Column(
        DateTime,
        nullable=True
    )

    # Actual order value before discount.
    order_value = Column(
        Float,
        nullable=True
    )

    # Actual discount used during redemption.
    redeemed_discount = Column(
        Float,
        nullable=True
    )

    # Item purchased using the coupon.
    order_item = Column(
        String,
        nullable=True
    )

    # Restaurant where coupon was redeemed.
    restaurant = Column(
        String,
        nullable=True
    )

    # Cuisine associated with the redeemed order.
    cuisine = Column(
        String,
        nullable=True
    )

    # Relationship back to customer.
    customer = relationship(
        "Customer"
    )


# --------------------------------------------------
# ORDER
# --------------------------------------------------
#
# A persistent snapshot of a completed customer order.
# Delivery address details are copied into the order so the
# order remains historically accurate even if the customer
# later edits or deletes the saved address.
# --------------------------------------------------

class Order(Base):

    __tablename__ = "orders"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False,
        index=True
    )

    restaurant_id = Column(
        Integer,
        ForeignKey("restaurants.id"),
        nullable=False,
        index=True
    )

    # Snapshot of the cart at the time the order was placed.
    # Stored as JSON text to keep the existing SQLite setup simple.
    items_json = Column(
        Text,
        nullable=False
    )

    restaurant = Column(
        String,
        nullable=False
    )

    cuisine = Column(
        String,
        nullable=True
    )

    # Delivery address snapshot.
    address_label = Column(
        String,
        nullable=False
    )

    delivery_address = Column(
        String,
        nullable=False
    )

    delivery_landmark = Column(
        String,
        nullable=True
    )

    delivery_latitude = Column(
        Float,
        nullable=False
    )

    delivery_longitude = Column(
        Float,
        nullable=False
    )

    # Financial snapshot.
    item_total = Column(
        Float,
        nullable=False,
        default=0
    )

    subtotal = Column(
        Float,
        nullable=False,
        default=0
    )

    discount = Column(
        Float,
        nullable=False,
        default=0
    )

    grand_total = Column(
        Float,
        nullable=False,
        default=0
    )

    coupon_code = Column(
        String,
        nullable=True
    )

    payment_method = Column(
        String,
        nullable=False,
        default="cod"
    )

    payment_status = Column(
        String,
        nullable=False,
        default="pending"
    )

    status = Column(
        String,
        nullable=False,
        default="placed",
        index=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        index=True
    )
