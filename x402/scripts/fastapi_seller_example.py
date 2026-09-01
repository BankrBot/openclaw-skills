import os
from fastapi import FastAPI, Request, Response, HTTPException
from x402.core.server import HTTPFacilitatorClient
from x402.mechanisms.evm.exact.server import ExactEvmScheme
from x402.fastapi import payment_middleware, x402ResourceServer

app = FastAPI()

# Configuration
PAY_TO_ADDRESS = os.getenv("RECEIVING_WALLET_ADDRESS", "0xYourAddressHere")
# Use CDP Facilitator for Mainnet or x402.org for Testnet
FACILITATOR_URL = "https://x402.org/facilitator" 

# Initialize x402 Server
facilitator_client = HTTPFacilitatorClient(url=FACILITATOR_URL)
resource_server = x402ResourceServer(facilitator_client)
resource_server.register("eip155:84532", ExactEvmScheme()) # Base Sepolia

# Define Route Configuration
route_config = {
    "GET /paid-data": {
        "accepts": [
            {
                "scheme": "exact",
                "price": "$0.01",
                "network": "eip155:84532",
                "payTo": PAY_TO_ADDRESS,
            }
        ],
        "description": "Access premium data via x402 autonomous payment",
        "mimeType": "application/json",
        "extensions": {
            "bazaar": {
                "discoverable": True,
                "category": "data",
                "tags": ["premium", "ai-ready"],
            }
        },
    }
}

# Apply Middleware
app.add_middleware(
    payment_middleware,
    config=route_config,
    server=resource_server
)

@app.get("/paid-data")
async def get_paid_data():
    return {"message": "Success! You have paid for this premium content.", "data": "42"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
