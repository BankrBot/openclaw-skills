/**
 * x402 Fetch Client Example
 * 
 * This example demonstrates how to use @x402/fetch to make requests to x402-protected endpoints.
 * Supports both EVM and SVM networks with automatic payment handling.
 */

import { config } from "dotenv";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";

config();

// Environment variables
const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
const svmPrivateKey = process.env.SVM_PRIVATE_KEY as string;
const baseURL = process.env.RESOURCE_SERVER_URL || "http://localhost:4021";

/**
 * Main function demonstrating x402 client usage
 */
async function main(): Promise<void> {
  // Initialize signers
  const evmSigner = privateKeyToAccount(evmPrivateKey);
  const svmSigner = await createKeyPairSignerFromBytes(base58.decode(svmPrivateKey));

  console.log(`✅ Initialized signers:`);
  console.log(`   EVM Address: ${evmSigner.address}`);
  console.log(`   SVM Address: ${svmSigner.address}`);

  // Create x402 client and register schemes
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: evmSigner });
  registerExactSvmScheme(client, { signer: svmSigner });

  // Wrap fetch with payment capability
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  // Example 1: Request weather data
  console.log(`\n📡 Making request to: ${baseURL}/weather`);
  const weatherResponse = await fetchWithPayment(`${baseURL}/weather?city=Tokyo`, {
    method: "GET",
  });
  const weatherData = await weatherResponse.json();
  console.log("Weather response:", weatherData);

  if (weatherResponse.ok) {
    const httpClient = new x402HTTPClient(client);
    const paymentResponse = httpClient.getPaymentSettleResponse(name =>
      weatherResponse.headers.get(name),
    );
    console.log("Payment settled:", JSON.stringify(paymentResponse, null, 2));
  }

  // Example 2: Request premium data
  console.log(`\n📡 Making request to: ${baseURL}/premium/data`);
  const premiumResponse = await fetchWithPayment(`${baseURL}/premium/data`, {
    method: "GET",
  });
  const premiumData = await premiumResponse.json();
  console.log("Premium response:", premiumData);

  if (premiumResponse.ok) {
    const httpClient = new x402HTTPClient(client);
    const paymentResponse = httpClient.getPaymentSettleResponse(name =>
      premiumResponse.headers.get(name),
    );
    console.log("Payment settled:", JSON.stringify(paymentResponse, null, 2));
  }
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});
