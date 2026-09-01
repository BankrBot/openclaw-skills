# AutoBoy Projects

Launch your Bankr with maximum trading volume and distribution

## Workflow

1. **Create a key** — `POST /api-keys` with a unique `label`. The `201` carries the plaintext `apiKey` — stored nowhere and returned only once — plus the `autoboyWalletAddress` provisioned for it. That one address works on every supported chain.
2. **Register your project** — `POST /projects`. This step is reviewed by hand:
   Jeffrey (Computer Operator) reads each submission and responds via the
   contact you provide. A `202` means it's in the queue, not yet live.
3. **Share your AutoBoy project URL** — Community demand turns into buy orders and distribution:
4. **AutoBoy amplifies your launch** — AutoBoy and its users drive distribution for you
   ([read more](https://docs.thefirm.biz/why-launch)).
5. **Monitor demand** — `GET /projects/{slug}` and
   `GET /projects/{slug}/buyers`.
6. _Launch — deploy your Bankr token as normal; AutoBoy executes users' buy
   orders automatically._

## Which chains are supported

AutoBoy supports Base and Robinhood Chain

## Buyer data is sensitive

`GET /projects/{slug}/buyers` exposes who will buy, how much, and at what
price, sortable by follower count. Treat it as private market data: use it
for the project's own planning, and don't share, post, or summarize buyer
identities or order details externally without the user's explicit go-ahead.

## Relevant endpoints

### API Reference

- **OpenApi JSON Schema** → [`thefirm.biz/api/public/v1/openapi.json`](https://thefirm.biz/api/public/v1/openapi.json)

### Base URL

```text
https://thefirm.biz/api/public/v1
```

### Authorization

- **Create an API key** (no auth required, instant) → [`POST /api/public/v1/api-keys`](https://docs.thefirm.biz/api-reference/api-keys/create-an-api-key)

### Registration

- **Register a project** (reviewed by hand) → [`POST /api/public/v1/projects`](https://docs.thefirm.biz/api-reference/projects/register-a-project)

### Identity

- **Get project slugs owned by your API key** → [`GET /api/public/v1/me`](https://docs.thefirm.biz/api-reference/identity/get-current-identity)

### Projects

- **Get your project's profile data** → [`GET /api/public/v1/projects/{slug}`](https://docs.thefirm.biz/api-reference/projects/get-a-project)
- **List your project's buyers** → [`GET /api/public/v1/projects/{slug}/buyers`](https://docs.thefirm.biz/api-reference/projects/list-a-projects-buyers)

## Feedback or questions?

- Contact [@firmjeff](https://t.me/firmjeff) on Telegram, or:
- Send via the REST API → [`POST /api/public/v1/feedback`](https://docs.thefirm.biz/api-reference/feedback/send-feedback)

## Full docs for projects

Full docs for projects are available here: [docs.thefirm.biz/why-launch](https://docs.thefirm.biz/why-launch)
