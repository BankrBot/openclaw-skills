// x402 Gin Server Example
//
// This example demonstrates how to set up a Gin server with x402 payment middleware.
// Supports both EVM (Base Sepolia) and SVM (Solana Devnet) networks.

package main

import (
	"fmt"
	"net/http"
	"os"
	"time"

	x402 "github.com/coinbase/x402/go"
	x402http "github.com/coinbase/x402/go/http"
	ginmw "github.com/coinbase/x402/go/http/gin"
	evm "github.com/coinbase/x402/go/mechanisms/evm/exact/server"
	svm "github.com/coinbase/x402/go/mechanisms/svm/exact/server"
	ginfw "github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

const DefaultPort = "4021"

func main() {
	// Load environment variables
	godotenv.Load()

	evmAddress := os.Getenv("EVM_ADDRESS")
	svmAddress := os.Getenv("SVM_ADDRESS")
	facilitatorURL := os.Getenv("FACILITATOR_URL")

	// Validate required environment variables
	if evmAddress == "" || svmAddress == "" {
		fmt.Println("❌ Missing required environment variables: EVM_ADDRESS, SVM_ADDRESS")
		os.Exit(1)
	}
	if facilitatorURL == "" {
		facilitatorURL = "https://x402.org/facilitator"
	}

	// Network configuration
	evmNetwork := x402.Network("eip155:84532")                             // Base Sepolia
	svmNetwork := x402.Network("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1") // Solana Devnet

	fmt.Printf("✅ Starting x402 Gin server...\n")
	fmt.Printf("   Facilitator: %s\n", facilitatorURL)
	fmt.Printf("   EVM Address: %s\n", evmAddress)
	fmt.Printf("   SVM Address: %s\n", svmAddress)

	// Create Gin router
	r := ginfw.Default()

	// Create HTTP facilitator client
	facilitatorClient := x402http.NewHTTPFacilitatorClient(&x402http.FacilitatorConfig{
		URL: facilitatorURL,
	})

	// Configure x402 payment middleware
	routes := x402http.RoutesConfig{
		// Weather endpoint - $0.001 USDC
		"GET /weather": {
			Accepts: x402http.PaymentOptions{
				{
					Scheme:  "exact",
					Price:   "$0.001",
					Network: "eip155:84532",
					PayTo:   evmAddress,
				},
				{
					Scheme:  "exact",
					Price:   "$0.001",
					Network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
					PayTo:   svmAddress,
				},
			},
			Description: "Weather data for any city",
			MimeType:    "application/json",
		},
		// Premium data endpoint - $0.01 USDC
		"GET /premium/*": {
			Accepts: x402http.PaymentOptions{
				{
					Scheme:  "exact",
					Price:   "$0.01",
					Network: "eip155:84532",
					PayTo:   evmAddress,
				},
			},
			Description: "Premium analytics data",
			MimeType:    "application/json",
		},
	}

	// Apply x402 payment middleware
	r.Use(ginmw.X402Payment(ginmw.Config{
		Routes:      routes,
		Facilitator: facilitatorClient,
		Schemes: []ginmw.SchemeConfig{
			{Network: "eip155:84532", Server: evm.NewExactEvmScheme()},
			{Network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", Server: svm.NewExactSvmScheme()},
		},
		Timeout: 30 * time.Second,
	}))

	// Protected endpoints
	r.GET("/weather", func(c *ginfw.Context) {
		city := c.DefaultQuery("city", "San Francisco")
		c.JSON(http.StatusOK, ginfw.H{
			"city":        city,
			"weather":     "sunny",
			"temperature": 72,
			"timestamp":   time.Now().Format(time.RFC3339),
		})
	})

	r.GET("/premium/data", func(c *ginfw.Context) {
		c.JSON(http.StatusOK, ginfw.H{
			"message":   "Premium content unlocked!",
			"insights":  "Advanced analytics data",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	// Health check (no payment required)
	r.GET("/health", func(c *ginfw.Context) {
		c.JSON(http.StatusOK, ginfw.H{
			"status": "ok",
		})
	})

	fmt.Printf("   Server listening on http://localhost:%s\n\n", DefaultPort)

	if err := r.Run(":" + DefaultPort); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
		os.Exit(1)
	}
}
