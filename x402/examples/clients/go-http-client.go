// x402 Go HTTP Client Example
//
// This example demonstrates how to use x402 with Go's HTTP client to make requests
// to x402-protected endpoints. Supports both EVM and SVM networks.

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/coinbase/x402/go"
	x402http "github.com/coinbase/x402/go/http"
	evmclient "github.com/coinbase/x402/go/mechanisms/evm/exact/client"
	svmclient "github.com/coinbase/x402/go/mechanisms/svm/exact/client"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	godotenv.Load()

	evmPrivateKey := os.Getenv("EVM_PRIVATE_KEY")
	svmPrivateKey := os.Getenv("SVM_PRIVATE_KEY")
	baseURL := os.Getenv("RESOURCE_SERVER_URL")
	if baseURL == "" {
		baseURL = "http://localhost:4021"
	}

	// Create x402 client
	client := x402.NewClient()

	// Register EVM scheme if private key provided
	if evmPrivateKey != "" {
		evmSigner, err := evmclient.NewPrivateKeySigner(evmPrivateKey)
		if err != nil {
			fmt.Printf("❌ Error creating EVM signer: %v\n", err)
			os.Exit(1)
		}
		evmclient.RegisterExactEvmClient(client, evmSigner)
		fmt.Printf("✅ Initialized EVM account: %s\n", evmSigner.Address())
	}

	// Register SVM scheme if private key provided
	if svmPrivateKey != "" {
		svmSigner, err := svmclient.NewPrivateKeySigner(svmPrivateKey)
		if err != nil {
			fmt.Printf("❌ Error creating SVM signer: %v\n", err)
			os.Exit(1)
		}
		svmclient.RegisterExactSvmClient(client, svmSigner)
		fmt.Printf("✅ Initialized SVM account: %s\n", svmSigner.Address())
	}

	// Create HTTP client with x402 support
	httpClient := x402http.NewHTTPClient(client, &http.Client{})

	// Example 1: Request weather data
	fmt.Printf("\n📡 Making request to: %s/weather\n", baseURL)
	weatherResp, err := httpClient.Get(baseURL + "/weather?city=Tokyo")
	if err != nil {
		fmt.Printf("❌ Error making request: %v\n", err)
		os.Exit(1)
	}
	defer weatherResp.Body.Close()

	weatherBody, _ := io.ReadAll(weatherResp.Body)
	fmt.Printf("Status: %d\n", weatherResp.StatusCode)
	fmt.Printf("Response: %s\n", string(weatherBody))

	if weatherResp.StatusCode == http.StatusOK {
		if settleResp := x402http.GetPaymentSettleResponse(weatherResp); settleResp != nil {
			settleJSON, _ := json.MarshalIndent(settleResp, "", "  ")
			fmt.Printf("Payment settled: %s\n", string(settleJSON))
		}
	}

	// Example 2: Request premium data
	fmt.Printf("\n📡 Making request to: %s/premium/data\n", baseURL)
	premiumResp, err := httpClient.Get(baseURL + "/premium/data")
	if err != nil {
		fmt.Printf("❌ Error making request: %v\n", err)
		os.Exit(1)
	}
	defer premiumResp.Body.Close()

	premiumBody, _ := io.ReadAll(premiumResp.Body)
	fmt.Printf("Status: %d\n", premiumResp.StatusCode)
	fmt.Printf("Response: %s\n", string(premiumBody))

	if premiumResp.StatusCode == http.StatusOK {
		if settleResp := x402http.GetPaymentSettleResponse(premiumResp); settleResp != nil {
			settleJSON, _ := json.MarshalIndent(settleResp, "", "  ")
			fmt.Printf("Payment settled: %s\n", string(settleJSON))
		}
	}
}
