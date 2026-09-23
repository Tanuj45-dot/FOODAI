from datetime import datetime

from database import SessionLocal
from models import Customer, Restaurant, CustomerBehavior
from ml_model import predict_customer_cuisine


# --------------------------------------------------
# GET PERSONALIZED RECOMMENDATIONS
# --------------------------------------------------

def get_recommendations(customer_id):

    db = SessionLocal()

    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id)
        .first()
    )

    restaurants = (
        db.query(Restaurant)
        .all()
    )

    behaviors = (
        db.query(CustomerBehavior)
        .filter(
            CustomerBehavior.customer_id == customer_id
        )
        .order_by(
            CustomerBehavior.timestamp.desc()
        )
        .all()
    )

    db.close()

    if customer is None:
        return {
            "message": "Customer not found"
        }

    # --------------------------------------------------
    # GET AI CUISINE PREDICTION
    # --------------------------------------------------

    ai_prediction = predict_customer_cuisine(
        customer_id
    )

    predicted_cuisine = ai_prediction.get(
        "predicted_cuisine"
    )

    confidence = ai_prediction.get(
        "confidence_percentage",
        0
    )

    probabilities = ai_prediction.get(
        "probabilities",
        {}
    )

    # --------------------------------------------------
    # CUSTOMER BEHAVIOR
    # --------------------------------------------------

    cuisine_counts = {}
    restaurant_counts = {}

    recent_order_cuisines = {}
    recent_order_restaurants = {}

    # Short-term order signal for detecting emerging preferences.
    recent_7d_order_cuisines = {}

    # Explicit lifetime order counts.
    # This is kept separate from recency-weighted orders
    # so repeated historical purchases still matter.
    order_cuisine_counts = {}
    order_restaurant_counts = {}

    now = datetime.utcnow()

    for behavior in behaviors:

        if behavior.cuisine:

            cuisine_counts[behavior.cuisine] = (
                cuisine_counts.get(
                    behavior.cuisine,
                    0
                ) + 1
            )

        if behavior.restaurant:

            restaurant_counts[behavior.restaurant] = (
                restaurant_counts.get(
                    behavior.restaurant,
                    0
                ) + 1
            )

        # --------------------------------------------------
        # ORDERS
        # --------------------------------------------------

        if behavior.action in ["order", "purchase"]:

            if behavior.cuisine:

                order_cuisine_counts[
                    behavior.cuisine
                ] = (
                    order_cuisine_counts.get(
                        behavior.cuisine,
                        0
                    ) + 1
                )

            if behavior.restaurant:

                order_restaurant_counts[
                    behavior.restaurant
                ] = (
                    order_restaurant_counts.get(
                        behavior.restaurant,
                        0
                    ) + 1
                )

            # --------------------------------------------------
            # SHORT-TERM ORDER SIGNAL
            # --------------------------------------------------
            # Orders from the last 7 days are used to detect
            # a newly emerging cuisine preference.
            # --------------------------------------------------

            if behavior.timestamp:

                order_age_days = (
                    now - behavior.timestamp
                ).total_seconds() / 86400

                if (
                    0 <= order_age_days <= 7
                    and behavior.cuisine
                ):

                    recent_7d_order_cuisines[
                        behavior.cuisine
                    ] = (
                        recent_7d_order_cuisines.get(
                            behavior.cuisine,
                            0
                        ) + 1
                    )

            # --------------------------------------------------
            # RECENCY-WEIGHTED ORDERS
            # --------------------------------------------------

            if behavior.timestamp:

                age_days = (
                    now - behavior.timestamp
                ).total_seconds() / 86400

            else:

                age_days = 30

            recency_weight = 0.5 ** (
                max(age_days, 0) / 30
            )

            if behavior.cuisine:

                recent_order_cuisines[
                    behavior.cuisine
                ] = (
                    recent_order_cuisines.get(
                        behavior.cuisine,
                        0
                    ) + recency_weight
                )

            if behavior.restaurant:

                recent_order_restaurants[
                    behavior.restaurant
                ] = (
                    recent_order_restaurants.get(
                        behavior.restaurant,
                        0
                    ) + recency_weight
                )

    max_cuisine_interactions = max(
        cuisine_counts.values(),
        default=1
    )

    max_restaurant_interactions = max(
        restaurant_counts.values(),
        default=1
    )

    max_recent_order_cuisine = max(
        recent_order_cuisines.values(),
        default=1
    )

    max_recent_order_restaurant = max(
        recent_order_restaurants.values(),
        default=1
    )

    max_order_cuisine_count = max(
        order_cuisine_counts.values(),
        default=1
    )

    max_order_restaurant_count = max(
        order_restaurant_counts.values(),
        default=1
    )

    # --------------------------------------------------
    # NORMALIZATION
    # --------------------------------------------------

    max_popularity = max(
        [
            restaurant.popularity
            for restaurant in restaurants
        ],
        default=1
    )

    # --------------------------------------------------
    # SCORE RESTAURANTS
    # --------------------------------------------------

    recommendations = []

    for restaurant in restaurants:

        score = 0
        reasons = []

        # ==============================================
        # 1. AI CUISINE PROBABILITY
        # ==============================================

        ai_probability = float(
            probabilities.get(
                restaurant.cuisine,
                0
            )
        )

        ai_score = ai_probability * 35

        score += ai_score

        if restaurant.cuisine == predicted_cuisine:

            reasons.append(
                "Matches AI-predicted cuisine"
            )

        # ==============================================
        # 2. AI PREDICTED CUISINE BOOST
        # ==============================================
        #
        # Give the model's final predicted cuisine an
        # additional boost.
        #
        # This prevents a cuisine with strong historical
        # browsing activity from completely overpowering
        # the AI prediction.
        #
        # The boost is confidence-aware.
        #
        # Example:
        # Pizza prediction with 25% confidence gets a
        # smaller boost than a 70% confidence prediction.
        # ==============================================

        if restaurant.cuisine == predicted_cuisine:

            confidence_value = float(
                confidence or 0
            )

            # Normalize confidence to 0-1.
            confidence_ratio = min(
                max(confidence_value / 100, 0),
                1
            )

            # Maximum additional AI prediction boost = 15.
            predicted_cuisine_boost = (
                confidence_ratio * 15
            )

            score += predicted_cuisine_boost

        # ==============================================
        # 3. CUSTOMER BEHAVIOR
        # ==============================================

        cuisine_interactions = cuisine_counts.get(
            restaurant.cuisine,
            0
        )

        behavior_score = (
            cuisine_interactions
            / max_cuisine_interactions
        ) * 20

        score += behavior_score

        if cuisine_interactions > 0:

            reasons.append(
                "Based on your food preferences"
            )

        # ==============================================
        # 4. ORDER FREQUENCY
        # ==============================================
        #
        # Repeated actual purchases are a stronger signal
        # than simple browsing/search interactions.
        #
        # Maximum = 15 points.
        # ==============================================

        cuisine_order_count = order_cuisine_counts.get(
            restaurant.cuisine,
            0
        )

        if cuisine_order_count > 0:

            order_frequency_score = (
                cuisine_order_count
                / max_order_cuisine_count
            ) * 15

            score += order_frequency_score

            reasons.append(
                "Based on your order history"
            )

        # ==============================================
        # 5. RECENCY-WEIGHTED ORDER SIGNAL
        # ==============================================

        recent_order_cuisine_score = (
            recent_order_cuisines.get(
                restaurant.cuisine,
                0
            )
        )

        if recent_order_cuisine_score > 0:

            normalized_recent_order_score = (
                recent_order_cuisine_score
                / max_recent_order_cuisine
            ) * 20

            score += normalized_recent_order_score

            # --------------------------------------------------
            # EMERGING CUISINE SIGNAL
            # --------------------------------------------------
            # Give a short-term cuisine preference an additional
            # boost without inflating every cuisine that has old
            # orders. This is based only on the last 7 days.
            # Maximum additional score = 15.
            # --------------------------------------------------

            total_recent_7d_orders = sum(
                recent_7d_order_cuisines.values()
            )

            recent_7d_order_count = (
                recent_7d_order_cuisines.get(
                    restaurant.cuisine,
                    0
                )
            )

            # Only treat a cuisine as an emerging preference when
            # the customer has made at least 2 recent orders in it.
            # The score is based on its actual share of recent orders,
            # rather than comparing every cuisine to the maximum.
            if (
                total_recent_7d_orders > 0
                and recent_7d_order_count >= 2
            ):

                recent_preference_ratio = (
                    recent_7d_order_count
                    / total_recent_7d_orders
                )

                emerging_cuisine_score = (
                    recent_preference_ratio * 25
                )

                score += emerging_cuisine_score

                if recent_preference_ratio >= 0.50:
                    reasons.append(
                        "Strong recent cuisine preference"
                    )

            reasons.append(
                "Based on your recent orders"
            )

        # ==============================================
        # 6. PREVIOUS RESTAURANT INTERACTION
        # ==============================================

        previous_interactions = restaurant_counts.get(
            restaurant.name,
            0
        )

        restaurant_score = (
            previous_interactions
            / max_restaurant_interactions
        ) * 5

        score += restaurant_score

        if previous_interactions > 0:

            reasons.append(
                "You interacted with this restaurant before"
            )

        # ==============================================
        # 7. RECENT ORDER AT THIS RESTAURANT
        # ==============================================

        recent_order_restaurant_score = (
            recent_order_restaurants.get(
                restaurant.name,
                0
            )
        )

        if recent_order_restaurant_score > 0:

            normalized_restaurant_order_score = (
                recent_order_restaurant_score
                / max_recent_order_restaurant
            ) * 10

            score += normalized_restaurant_order_score

            reasons.append(
                "You ordered from this restaurant recently"
            )

        # ==============================================
        # 8. ORDER FREQUENCY AT THIS RESTAURANT
        # ==============================================

        restaurant_order_count = (
            order_restaurant_counts.get(
                restaurant.name,
                0
            )
        )

        if restaurant_order_count > 0:

            restaurant_order_frequency_score = (
                restaurant_order_count
                / max_order_restaurant_count
            ) * 5

            score += restaurant_order_frequency_score

        # ==============================================
        # 9. RESTAURANT RATING
        # ==============================================

        rating = float(
            restaurant.rating or 0
        )

        rating_score = (
            min(rating, 5) / 5
        ) * 10

        score += rating_score

        # ==============================================
        # 10. RESTAURANT POPULARITY
        # ==============================================

        popularity = float(
            restaurant.popularity or 0
        )

        popularity_score = (
            popularity
            / max_popularity
        ) * 5

        score += popularity_score

        # ==============================================
        # 11. PRICE COMPATIBILITY
        # ==============================================

        average_order_value = float(
            customer.average_order_value or 0
        )

        average_price = float(
            restaurant.average_price or 0
        )

        if average_order_value > 0:

            price_difference = abs(
                average_price
                - average_order_value
            )

            if price_difference <= 50:

                score += 15

                reasons.append(
                    "Price closely matches your usual spending"
                )

            elif price_difference <= 100:

                score += 10

                reasons.append(
                    "Price matches your usual spending"
                )

            elif price_difference <= 200:

                score += 5

        # ==============================================
        # DEFAULT REASON
        # ==============================================

        if not reasons:

            reasons.append(
                "Popular restaurant recommendation"
            )

        recommendations.append({

            "restaurant_id":
                restaurant.id,

            "restaurant":
                restaurant.name,

            "cuisine":
                restaurant.cuisine,

            "rating":
                restaurant.rating,

            "average_price":
                restaurant.average_price,

            "score":
                round(score, 2),

            "reasons":
                reasons
        })

    # --------------------------------------------------
    # SORT BY PERSONALIZATION SCORE
    # --------------------------------------------------

    recommendations.sort(
        key=lambda x: x["score"],
        reverse=True
    )

    # --------------------------------------------------
    # DIVERSITY-AWARE TOP 10
    # --------------------------------------------------
    #
    # Keep the strongest recommendation first.
    # Then avoid showing more than 3 restaurants
    # from the same cuisine in the first 10.
    #
    # This preserves personalization while providing
    # useful alternatives.
    # --------------------------------------------------

    diverse_recommendations = []
    cuisine_slots = {}

    # First pass: select highly relevant restaurants
    # while limiting each cuisine to 3 slots.

    for recommendation in recommendations:

        cuisine = recommendation["cuisine"]

        current_count = cuisine_slots.get(
            cuisine,
            0
        )

        if current_count >= 3:
            continue

        diverse_recommendations.append(
            recommendation
        )

        cuisine_slots[cuisine] = (
            current_count + 1
        )

        if len(diverse_recommendations) == 10:
            break

    # --------------------------------------------------
    # FALLBACK
    # --------------------------------------------------
    #
    # If fewer than 10 restaurants were selected because
    # of unusual data, fill remaining positions from the
    # original ranking.
    # --------------------------------------------------

    if len(diverse_recommendations) < 10:

        selected_ids = {
            item["restaurant_id"]
            for item in diverse_recommendations
        }

        for recommendation in recommendations:

            if recommendation["restaurant_id"] in selected_ids:
                continue

            diverse_recommendations.append(
                recommendation
            )

            if len(diverse_recommendations) == 10:
                break

    # --------------------------------------------------
    # RETURN RESULTS
    # --------------------------------------------------

    return {

        "customer_id":
            customer_id,

        "customer_name":
            customer.name,

        "ai_predicted_cuisine":
            predicted_cuisine,

        "ai_confidence":
            confidence,

        "recommendations":
            diverse_recommendations
    }