"""
x402 Dynamic Pricing Example

This example demonstrates how to implement dynamic pricing based on:
- User authentication/authorization
- Resource consumption
- Time of day
- Request parameters
"""

import os
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, Request
from pydantic import BaseModel

from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.schemas import Network
from x402.server import x402ResourceServer

load_dotenv()

# Configuration
EVM_ADDRESS = os.getenv("EVM_ADDRESS")
EVM_NETWORK: Network = "eip155:84532"
FACILITATOR_URL = os.getenv("FACILITATOR_URL", "https://x402.org/facilitator")

if not EVM_ADDRESS:
    raise ValueError("Missing required EVM_ADDRESS environment variable")


class AnalyticsData(BaseModel):
    query: str
    results: list
    timestamp: str
    pricing_tier: str


app = FastAPI(title="x402 Dynamic Pricing Example")

# Initialize x402 server
facilitator = HTTPFacilitatorClient(FacilitatorConfig(url=FACILITATOR_URL))
server = x402ResourceServer(facilitator)
server.register(EVM_NETWORK, ExactEvmServerScheme())


def get_dynamic_price(request: Request, authorization: Optional[str] = None) -> str:
    """
    Calculate dynamic price based on various factors:
    - Authenticated users get a discount
    - Peak hours cost more
    - Complex queries cost more
    """
    base_price = 0.01
    
    # Discount for authenticated users
    if authorization and authorization.startswith("Bearer "):
        base_price *= 0.5  # 50% discount for authenticated users
    
    # Peak hours (9 AM - 5 PM UTC) cost more
    current_hour = datetime.utcnow().hour
    if 9 <= current_hour < 17:
        base_price *= 1.5  # 50% surcharge during peak hours
    
    # Complex queries cost more
    query = request.query_params.get("query", "")
    if len(query) > 100:
        base_price *= 2.0  # Double price for complex queries
    
    return f"${base_price:.3f}"


# Dynamic route configuration
# Note: In a real implementation, you'd use hooks to calculate prices dynamically
routes = {
    "GET /analytics": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=EVM_ADDRESS,
                price="$0.01",  # Base price, can be overridden by hooks
                network=EVM_NETWORK,
            ),
        ],
        description="Analytics data with dynamic pricing",
        mime_type="application/json",
    ),
    # Premium tier - fixed high price
    "GET /analytics/premium": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=EVM_ADDRESS,
                price="$0.10",  # Premium tier
                network=EVM_NETWORK,
            ),
        ],
        description="Premium analytics data (no rate limits)",
        mime_type="application/json",
    ),
}

app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)


@app.get("/analytics", response_model=AnalyticsData)
async def get_analytics(
    request: Request,
    query: str = "default",
    authorization: Optional[str] = Header(None),
) -> AnalyticsData:
    """
    Get analytics data with dynamic pricing.
    
    Pricing:
    - Base: $0.01
    - Authenticated users: 50% discount
    - Peak hours (9 AM - 5 PM UTC): 50% surcharge
    - Complex queries (>100 chars): 2x multiplier
    """
    # Calculate what the price would have been
    calculated_price = get_dynamic_price(request, authorization)
    tier = "premium" if authorization else "standard"
    
    return AnalyticsData(
        query=query,
        results=["result1", "result2", "result3"],
        timestamp=datetime.utcnow().isoformat(),
        pricing_tier=f"{tier} - {calculated_price}",
    )


@app.get("/analytics/premium", response_model=AnalyticsData)
async def get_premium_analytics(query: str = "premium") -> AnalyticsData:
    """Get premium analytics data (no rate limits, fixed price)"""
    return AnalyticsData(
        query=query,
        results=["premium_result1", "premium_result2", "premium_result3"],
        timestamp=datetime.utcnow().isoformat(),
        pricing_tier="premium - $0.10",
    )


@app.get("/pricing-info")
async def get_pricing_info() -> dict:
    """Get information about dynamic pricing (no payment required)"""
    return {
        "tiers": {
            "standard": {
                "base_price": "$0.01",
                "discount_authenticated": "50%",
                "peak_hour_surcharge": "50%",
                "complex_query_multiplier": "2x",
            },
            "premium": {
                "fixed_price": "$0.10",
                "features": ["No rate limits", "Priority processing"],
            },
        },
        "peak_hours": "9 AM - 5 PM UTC",
        "note": "Prices are calculated dynamically based on authentication, time, and query complexity",
    }


if __name__ == "__main__":
    import uvicorn
    print("✅ x402 Dynamic Pricing server starting...")
    print("   Base price: $0.01")
    print("   Authenticated users: 50% discount")
    print("   Peak hours (9-17 UTC): 50% surcharge")
    print("   Complex queries: 2x multiplier")
    uvicorn.run(app, host="0.0.0.0", port=4021)
