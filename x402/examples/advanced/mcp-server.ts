/**
 * x402 MCP (Model Context Protocol) Server Example
 * 
 * This example demonstrates how to create an MCP server that makes paid API requests
 * using x402. Compatible with Claude Desktop and other MCP clients.
 * 
 * MCP allows AI assistants to discover and use tools dynamically. Combined with x402,
 * this enables AI agents to autonomously pay for and use external APIs.
 */

import { config } from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

config();

// Environment variables
const evmPrivateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;

if (!evmPrivateKey) {
  console.error("❌ Missing EVM_PRIVATE_KEY environment variable");
  process.exit(1);
}

// Initialize x402 client
const evmSigner = privateKeyToAccount(evmPrivateKey);
const client = new x402Client();
registerExactEvmScheme(client, { signer: evmSigner });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Create MCP server
const server = new Server(
  {
    name: "x402-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

/**
 * List available tools that make x402-protected API calls
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_weather",
        description: "Get weather data for a city (costs $0.001 USDC)",
        inputSchema: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "Name of the city",
            },
            serverUrl: {
              type: "string",
              description: "URL of the weather API server",
              default: "http://localhost:4021",
            },
          },
          required: ["city"],
        },
      },
      {
        name: "get_premium_data",
        description: "Get premium analytics data (costs $0.01 USDC)",
        inputSchema: {
          type: "object",
          properties: {
            serverUrl: {
              type: "string",
              description: "URL of the API server",
              default: "http://localhost:4021",
            },
          },
        },
      },
    ],
  };
});

/**
 * Handle tool calls with automatic x402 payments
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_weather") {
      const { city, serverUrl = "http://localhost:4021" } = args as {
        city: string;
        serverUrl?: string;
      };

      console.error(`Making paid request for weather in ${city}...`);
      const response = await fetchWithPayment(`${serverUrl}/weather?city=${city}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } else if (name === "get_premium_data") {
      const { serverUrl = "http://localhost:4021" } = args as {
        serverUrl?: string;
      };

      console.error("Making paid request for premium data...");
      const response = await fetchWithPayment(`${serverUrl}/premium/data`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the MCP server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ x402 MCP Server started");
  console.error(`   EVM Address: ${evmSigner.address}`);
  console.error("   Ready to handle tool calls with automatic x402 payments");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
