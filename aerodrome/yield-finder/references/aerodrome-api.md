# Aerodrome Finance API Reference

This skill uses the **Aerodrome Sugar Helper** contract on Base to fetch real-time liquidity pool data. This contract is used by the official Aerodrome frontend and provides the most reliable data source.

## Contract Details

- **Network**: Base Mainnet
- **Contract Name**: Aerodrome Finance LP Sugar v3
- **Address**: `0x68c19e13618C41158fE4bAba1B8fb3A9c74bDb0A`

## Key Methods

### `all(uint256 limit, uint256 offset)`

Returns a list of liquidity pools with comprehensive data.

**Returns:**Array of `Lp` structs.

### `Lp` Struct Structure

- `address lp`: Pool address
- `string symbol`: Pool symbol (e.g., "vAMM-WETH/USDC")
- `uint8 decimals`: Pool decimals
- `uint256 liquidity`: Total liquidity (raw)
- `int24 type`: Pool type (0 = Volatile, 1 = Stable, >1 = CL tick spacing)
- `int24 tick`: Current tick
- `uint160 sqrt_ratio`: Square root price
- `address token0`: Address of token0
- `uint256 reserve0`: Reserve of token0
- `uint256 staked0`: Amount of token0 staked in gauge
- `address token1`: Address of token1
- `uint256 reserve1`: Reserve of token1
- `uint256 staked1`: Amount of token1 staked in gauge
- `address gauge`: Gauge address
- `uint256 gauge_liquidity`: Total staked liquidity
- `bool gauge_alive`: Is gauge active
- `address fee`: Fee distributor address
- `address bribe`: Bribe distributor address
- `address factory`: Factory address
- `uint256 emissions`: Emissions per second (in AERO)
- `address emissions_token`: Address of reward token (AERO)
- `uint256 emissions_cap`: Max emissions cap

## External APIs

### CoinGecko (Price Data)
Used to fetch AERO price for APR calculations.
- **Endpoint**: `https://api.coingecko.com/api/v3/simple/price?ids=aerodrome-finance&vs_currencies=usd`
