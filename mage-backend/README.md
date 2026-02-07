# MAGE Payment Backend

Flask server that creates Square checkout links for the MAGE website.

## Setup

### 1. Get Square Credentials

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Create an application named "MAGE"
3. Get your credentials:
   - **Access Token** (Credentials page)
   - **Location ID** (Locations page)

### 2. Local Development

```bash
cd mage-backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Set environment variables
set SQUARE_ACCESS_TOKEN=your_token
set SQUARE_LOCATION_ID=your_location_id
set SQUARE_ENVIRONMENT=sandbox

python app.py
```

Server runs at `http://localhost:8080`

### 3. Deploy to Render

1. Push this folder to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Create a new **Web Service**
4. Connect your GitHub repo
5. Set root directory to `mage-backend`
6. Add environment variables:
   - `SQUARE_ACCESS_TOKEN`
   - `SQUARE_LOCATION_ID`
   - `SQUARE_ENVIRONMENT` = `sandbox` (or `production`)

## API

### `POST /create-checkout`

Creates a Square payment link.

**Request:**
```json
{
  "cart": [
    {"sku": "signature", "name": "Signature Deck", "price": 10, "qty": 2}
  ],
  "shipping": 8,
  "gift_wrap": false,
  "customer": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response:**
```json
{
  "checkout_url": "https://checkout.square.site/..."
}
```

## Testing

Use Sandbox credentials first. Square provides test card numbers:
- **Card:** 4532 0123 4567 8901
- **Expiry:** Any future date
- **CVV:** Any 3 digits
