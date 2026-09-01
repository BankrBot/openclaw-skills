/**
 * x402 Express Server Example
 * 
 * This example demonstrates how to set up an Express.js server with x402 payment middleware.
 * Supports both EVM (Base Sepolia) and SVM (Solana Devnet) networks.
 */

import { config } from "dotenv";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

config();

// Environment variables
const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
const svmAddress = process.env.SVM_ADDRESS;
const facilitatorUrl = process.env.FACILITATOR_URL || "https://x402.org/facilitator";

if (!evmAddress || !svmAddress) {
  console.error("❌ Missing required environment variables: EVM_ADDRESS, SVM_ADDRESS");
  process.exit(1);
}

// Initialize facilitator client
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

// Create Express app
const app = express();

// Apply x402 payment middleware
app.use(
  paymentMiddleware(
    {
      // Weather endpoint - $0.001 USDC
      "GET /weather": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:84532", // Base Sepolia
            payTo: evmAddress,
          },
          {
            scheme: "exact",
            price: "$0.001",
            network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana Devnet
            payTo: svmAddress,
          },
        ],
        description: "Weather data for any city",
        mimeType: "application/json",
      },
      // Premium data endpoint - $0.01 USDC
      "GET /premium/*": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: "eip155:84532",
            payTo: evmAddress,
          },
        ],
        description: "Premium data access",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(facilitatorClient)
      .register("eip155:84532", new ExactEvmScheme())
      .register("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", new ExactSvmScheme()),
  ),
);

// Protected endpoints
app.get("/weather", (req, res) => {
  const city = req.query.city || "San Francisco";
  res.json({
    city,
    weather: "sunny",
    temperature: 72,
    timestamp: new Date().toISOString(),
  });
});

app.get("/premium/data", (req, res) => {
  res.json({
    message: "Premium content unlocked!",
    data: {
      insights: "Advanced analytics data",
      timestamp: new Date().toISOString(),
    },
  });
});

// Health check (no payment required)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
const PORT = process.env.PORT || 4021;
app.listen(PORT, () => {
  console.log(`✅ x402 Express server listening on http://localhost:${PORT}`);
  console.log(`   Facilitator: ${facilitatorUrl}`);
  console.log(`   EVM Address: ${evmAddress}`);
  console.log(`   SVM Address: ${svmAddress}`);
});
