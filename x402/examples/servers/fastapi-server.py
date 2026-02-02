"""
x402 FastAPI Server Example

This example demonstrates how to set up a FastAPI server with x402 payment middleware.
Supports both EVM (Base Sepolia) and SVM (Solana Devnet) networks.
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.mechanisms.svm.exact import ExactSvmServerScheme
from x402.schemas import Network
from x402.server import x402ResourceServer

load_dotenv()

# Configuration
EVM_ADDRESS = os.getenv("EVM_ADDRESS")
SVM_ADDRESS = os.getenv("SVM_ADDRESS")
EVM_NETWORK: Network = "eip155:84532"  # Base Sepolia
SVM_NETWORK: Network = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"  # Solana Devnet
FACILITATOR_URL = os.getenv("FACILITATOR_URL", "https://x402.org/facilitator")

if not EVM_ADDRESS or not SVM_ADDRESS:
    raise ValueError("Missing required environment variables: EVM_ADDRESS, SVM_ADDRESS")


# Response models
class WeatherReport(BaseModel):
    city: str
    weather: str
    temperature: int
    timestamp: str


class PremiumData(BaseModel):
    message: str
    insights: str
    timestamp: str


# Create FastAPI app
app = FastAPI(title="x402 FastAPI Server")

# Initialize x402 server
facilitator = HTTPFacilitatorClient(FacilitatorConfig(url=FACILITATOR_URL))
server = x402ResourceServer(facilitator)
server.register(EVM_NETWORK, ExactEvmServerScheme())
server.register(SVM_NETWORK, ExactSvmServerScheme())

# Define protected routes
routes = {
    # Weather endpoint - $0.001 USDC
    "GET /weather": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=EVM_ADDRESS,
                price="$0.001",
                network=EVM_NETWORK,
            ),
            PaymentOption(
                scheme="exact",
                pay_to=SVM_ADDRESS,
                price="$0.001",
                network=SVM_NETWORK,
            ),
        ],
        mime_type="application/json",
        description="Weather data for any city",
    ),
    # Premium data endpoint - $0.01 USDC
    "GET /premium/*": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=EVM_ADDRESS,
                price="$0.01",
                network=EVM_NETWORK,
            ),
        ],
        mime_type="application/json",
        description="Premium analytics data",
    ),
}

# Apply x402 middleware
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)


# Protected endpoints
@app.get("/weather", response_model=WeatherReport)
async def get_weather(city: str = "San Francisco") -> WeatherReport:
    """Get weather data (requires $0.001 USDC payment)"""
    from datetime import datetime
    return WeatherReport(
        city=city,
        weather="sunny",
        temperature=72,
        timestamp=datetime.utcnow().isoformat(),
    )


@app.get("/premium/data", response_model=PremiumData)
async def get_premium_data() -> PremiumData:
    """Get premium data (requires $0.01 USDC payment)"""
    from datetime import datetime
    return PremiumData(
        message="Premium content unlocked!",
        insights="Advanced analytics data",
        timestamp=datetime.utcnow().isoformat(),
    )


# Health check (no payment required)
@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint (no payment required)"""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    print(f"✅ x402 FastAPI server starting...")
    print(f"   Facilitator: {FACILITATOR_URL}")
    print(f"   EVM Address: {EVM_ADDRESS}")
    print(f"   SVM Address: {SVM_ADDRESS}")
    uvicorn.run(app, host="0.0.0.0", port=4021)
