"""
x402 Bazaar Discovery Extension Example

This example demonstrates how to register your x402-protected endpoints
with the Bazaar discovery layer, making them discoverable by AI agents.
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

from x402.extensions.bazaar import (
    OutputConfig,
    bazaar_resource_server_extension,
    declare_discovery_extension,
)
from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
from x402.http.middleware.fastapi import PaymentMiddlewareASGI
from x402.http.types import RouteConfig
from x402.mechanisms.evm.exact import ExactEvmServerScheme
from x402.schemas import Network
from x402.server import x402ResourceServer

load_dotenv()

# Configuration
EVM_ADDRESS = os.getenv("EVM_ADDRESS")
EVM_NETWORK: Network = "eip155:84532"  # Base Sepolia
FACILITATOR_URL = os.getenv("FACILITATOR_URL", "https://x402.org/facilitator")

if not EVM_ADDRESS:
    raise ValueError("Missing required EVM_ADDRESS environment variable")


# Response models
class WeatherReport(BaseModel):
    city: str
    weather: str
    temperature: int


class MarketData(BaseModel):
    symbol: str
    price: float
    volume: int
    change_24h: float


# Create FastAPI app
app = FastAPI(title="x402 Bazaar Discovery Example")

# Initialize x402 server with Bazaar extension
facilitator = HTTPFacilitatorClient(FacilitatorConfig(url=FACILITATOR_URL))
server = x402ResourceServer(facilitator)
server.register(EVM_NETWORK, ExactEvmServerScheme())
server.register_extension(bazaar_resource_server_extension)

# Define routes with Bazaar discovery metadata
routes = {
    "GET /weather": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=EVM_ADDRESS,
                price="$0.001",
                network=EVM_NETWORK,
            ),
        ],
        description="Get real-time weather data for any city worldwide",
        mime_type="application/json",
        extensions={
            **declare_discovery_extension(
                # Input schema for AI agents
                input_schema={
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string",
                            "description": "Name of the city",
                        }
                    },
                    "required": ["city"],
                },
                # Output schema and example
                output=OutputConfig(
                    example={"city": "San Francisco", "weather": "sunny", "temperature": 72},
                    schema={
                        "type": "object",
                        "properties": {
                            "city": {"type": "string"},
                            "weather": {"type": "string"},
                            "temperature": {"type": "number"},
                        },
                        "required": ["city", "weather", "temperature"],
                    },
                ),
                # Discovery metadata
                tags=["weather", "real-time", "api"],
                category="data",
            )
        },
    ),
    "GET /market": RouteConfig(
        accepts=[
            PaymentOption(
                scheme="exact",
                pay_to=EVM_ADDRESS,
                price="$0.005",
                network=EVM_NETWORK,
            ),
        ],
        description="Get real-time cryptocurrency market data",
        mime_type="application/json",
        extensions={
            **declare_discovery_extension(
                input_schema={
                    "type": "object",
                    "properties": {
                        "symbol": {
                            "type": "string",
                            "description": "Cryptocurrency symbol (e.g., BTC, ETH)",
                        }
                    },
                    "required": ["symbol"],
                },
                output=OutputConfig(
                    example={
                        "symbol": "BTC",
                        "price": 45000.00,
                        "volume": 1234567890,
                        "change_24h": 2.5,
                    },
                    schema={
                        "type": "object",
                        "properties": {
                            "symbol": {"type": "string"},
                            "price": {"type": "number"},
                            "volume": {"type": "integer"},
                            "change_24h": {"type": "number"},
                        },
                        "required": ["symbol", "price", "volume", "change_24h"],
                    },
                ),
                tags=["crypto", "market-data", "real-time"],
                category="finance",
            )
        },
    ),
}

# Apply middleware
app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)


@app.get("/weather", response_model=WeatherReport)
async def get_weather(city: str = "San Francisco") -> WeatherReport:
    """Get weather data (discoverable via Bazaar)"""
    return WeatherReport(city=city, weather="sunny", temperature=72)


@app.get("/market", response_model=MarketData)
async def get_market_data(symbol: str = "BTC") -> MarketData:
    """Get market data (discoverable via Bazaar)"""
    return MarketData(
        symbol=symbol,
        price=45000.00,
        volume=1234567890,
        change_24h=2.5,
    )


if __name__ == "__main__":
    import uvicorn
    print("✅ x402 Bazaar Discovery server starting...")
    print(f"   Your services will be discoverable by AI agents via the Bazaar!")
    print(f"   Facilitator: {FACILITATOR_URL}")
    uvicorn.run(app, host="0.0.0.0", port=4021)
