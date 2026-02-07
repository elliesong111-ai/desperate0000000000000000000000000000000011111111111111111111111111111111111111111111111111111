"""
MAGE Payment Backend
Flask server that creates Square checkout links for the MAGE website.
"""

import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from square.client import Client

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from GitHub Pages

# Square credentials from environment variables
SQUARE_ACCESS_TOKEN = os.environ.get("SQUARE_ACCESS_TOKEN", "")
SQUARE_LOCATION_ID = os.environ.get("SQUARE_LOCATION_ID", "")
SQUARE_ENVIRONMENT = os.environ.get("SQUARE_ENVIRONMENT", "sandbox")  # "sandbox" or "production"

# Initialize Square client
square_client = Client(
    access_token=SQUARE_ACCESS_TOKEN,
    environment=SQUARE_ENVIRONMENT,
)


@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "ok", "service": "MAGE Payment Backend"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})


@app.route("/create-checkout", methods=["POST"])
def create_checkout():
    """
    Create a Square checkout link from the cart.
    
    Request body:
    {
        "cart": [
            {"sku": "signature", "name": "Signature Deck", "price": 10, "qty": 2},
            ...
        ],
        "shipping": 8,
        "gift_wrap": false,
        "customer": {
            "name": "...",
            "email": "...",
            "address": "..."
        }
    }
    
    Response:
    {
        "checkout_url": "https://checkout.square.site/..."
    }
    """
    try:
        data = request.get_json() or {}
        cart = data.get("cart", [])
        shipping = data.get("shipping", 0)
        gift_wrap = data.get("gift_wrap", False)
        customer = data.get("customer", {})

        if not cart:
            return jsonify({"error": "Cart is empty"}), 400

        # Build line items for Square
        line_items = []
        for item in cart:
            name = item.get("name", "Product")
            price = int(float(item.get("price", 0)) * 100)  # Convert to cents
            qty = str(item.get("qty", 1))
            
            line_items.append({
                "name": name,
                "quantity": qty,
                "base_price_money": {
                    "amount": price,
                    "currency": "USD"
                }
            })

        # Add shipping as a line item if applicable
        if shipping > 0:
            line_items.append({
                "name": "Shipping",
                "quantity": "1",
                "base_price_money": {
                    "amount": int(shipping * 100),
                    "currency": "USD"
                }
            })

        # Add gift wrap if selected
        if gift_wrap:
            line_items.append({
                "name": "Gift Packaging",
                "quantity": "1",
                "base_price_money": {
                    "amount": 500,  # $5
                    "currency": "USD"
                }
            })

        # Create checkout using Square Checkout API
        checkout_api = square_client.checkout
        
        # Generate unique idempotency key
        idempotency_key = str(uuid.uuid4())

        # Build the order
        order = {
            "order": {
                "location_id": SQUARE_LOCATION_ID,
                "line_items": line_items,
            },
            "idempotency_key": idempotency_key,
            "redirect_url": "https://elliesong111-ai.github.io/MAGE/?payment=success",
        }

        # Add customer email if provided
        if customer.get("email"):
            order["pre_populate_buyer_email"] = customer["email"]

        result = checkout_api.create_payment_link(body=order)

        if result.is_success():
            checkout_url = result.body.get("payment_link", {}).get("url", "")
            return jsonify({"checkout_url": checkout_url})
        else:
            errors = result.errors
            return jsonify({"error": "Failed to create checkout", "details": errors}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
