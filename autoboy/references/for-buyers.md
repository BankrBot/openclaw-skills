# AutoBoy Buyers

Choose pre-token projects, auto-buy their tokens the instant they launch

## Workflow

1. **Create a key** — `POST /api-keys` with a unique `label`. The `201` carries the plaintext `apiKey` — stored nowhere and returned only once — plus the `autoboyWalletAddress` provisioned for it. That one address works on every supported chain.
2. **Browse projects** — `GET /projects`, `GET /projects/{slug}`. Works immediately with the new key.
3. **Fund your wallet** — send the spend currency for the chain you're buying on
   to `autoboyWalletAddress`: **USDC on Base, USDG on Robinhood**. Auto-buys
   spend that balance. `GET /wallet` re-reads the address and returns balances
   keyed by chain any time.
4. **Place buy orders** — `POST /orders` with one item per project.
5. **Monitor and adjust orders** — `GET /orders`, `PATCH /orders`, `DELETE /orders`.
6. _AutoBoy auto-buys on launch — AutoBoy fills your buy orders automatically when the project launches._
7. **Withdraw** — `POST /wallet/withdrawals` to pull a stablecoin, token, or
   native ETH out. Pass `chain` to say which chain to withdraw from; it
   defaults to `base`.

## Custody and confirmations

- **Creating a key risks nothing.** `POST /api-keys` moves no funds and needs no
  approval — the wallet it provisions starts empty. Funding is the step that puts money at stake.
- **The AutoBoy wallet is third-party custody.** The smart wallet is managed
  by Privy, with signer authority delegated to The Firm — The Firm can spend
  anything sent to it, on any supported chain, until the user withdraws. Make
  sure the user understands this before they fund it.
- **Fund a bounded amount.** Recommend sending only what the user is willing
  to commit to pre-launch buys, never their full balance.
- **Confirm before acting.** Get the user's explicit confirmation before
  funding the wallet, creating, updating, or cancelling orders, or enabling
  any auto-buy behavior. Never do these unprompted.
- **Orders are visible to the project.** Placing a buy order exposes the
  user's identity, order size, and price to the project team via its buyers
  list — make sure the user knows this before their first order.

### Before creating or updating orders

Before any `POST /orders` or `PATCH /orders`, show the user and get their
confirmation on:

- the project each order targets, and which chain it launches on,
- the spend amount and max market cap per order, named in that chain's spend
  currency (USDC or USDG) rather than always saying "USDC",
- the balance on that chain (`GET /wallet`) — a funded Base balance does not
  cover a Robinhood order,
- the way out — orders cancel via `DELETE /orders`, funds can be withdrawn via
  `POST /wallet/withdrawals`.

### Before withdrawing

Before any `POST /wallet/withdrawals`:

- confirm the chain, destination address, token, and amount with the user.
  **`chain` defaults to `base` when omitted** — pass it explicitly for a
  Robinhood withdrawal, or the API reads the Base balance instead,
- state the amount in human units (withdrawal amounts are atomic-unit strings:
  `"2500000"` is 2.5 USDC or 2.5 USDG — both have 6 decimals). `"max"` sends
  the entire on-chain balance of that asset,
- validate the destination is an EVM address (`0x…`, 42 hex chars) the user
  controls **and can access on that chain**,
- get a final explicit confirmation — a withdrawal to the wrong address or the
  wrong chain is irreversible.

## Relevant endpoints

### Base URL

```text
https://thefirm.biz/api/public/v1
```

### Authorization

- **Get an API key** → [`POST /api/public/v1/api-keys`](https://docs.thefirm.biz/api-reference/api-keys/create-an-api-key)
- **Check whose key you hold** → [`GET /api/public/v1/me`](https://docs.thefirm.biz/api-reference/identity/get-current-identity)

### Projects

- **List projects** → [`GET /api/public/v1/projects`](https://docs.thefirm.biz/api-reference/projects/list-projects)
- **Get a project** → [`GET /api/public/v1/projects/{slug}`](https://docs.thefirm.biz/api-reference/projects/get-a-project)
- **List a project's buyers** → [`GET /api/public/v1/projects/{slug}/buyers`](https://docs.thefirm.biz/api-reference/projects/list-a-projects-buyers)

### Buy orders

- **List buy orders** → [`GET /api/public/v1/orders`](https://docs.thefirm.biz/api-reference/buy-orders/list-buy-orders)
- **Create buy orders** → [`POST /api/public/v1/orders`](https://docs.thefirm.biz/api-reference/buy-orders/create-buy-orders)
- **Update buy orders** → [`PATCH /api/public/v1/orders`](https://docs.thefirm.biz/api-reference/buy-orders/update-buy-orders)
- **Delete buy orders** → [`DELETE /api/public/v1/orders`](https://docs.thefirm.biz/api-reference/buy-orders/delete-buy-orders)

### AutoBoy wallet

- **Get AutoBoy wallet** → [`GET /api/public/v1/wallet`](https://docs.thefirm.biz/api-reference/autoboy-wallet/get-autoboy-wallet)
- **Withdraw an asset** → [`POST /api/public/v1/wallet/withdrawals`](https://docs.thefirm.biz/api-reference/autoboy-wallet/withdraw-an-asset)

## Feedback or questions?

- Contact [@firmjeff](https://t.me/firmjeff) on Telegram, or:
- Send via the REST API → [`POST /api/public/v1/feedback`](https://docs.thefirm.biz/api-reference/feedback/send-feedback)

## Full docs for buyers

Full docs for buyers are available here: [docs.thefirm.biz/buylisting](https://docs.thefirm.biz/buylisting)
