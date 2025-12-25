# Smart Wallet Optimizer

Smart Wallet Optimizer is a dynamic wallet orchestration service that uses AI-driven scoring to pick the best card for every transaction. It works across mobile (Apple/Android) and desktop by exposing a fast API, a PWA-ready UI, and a recommendation engine that can react to merchant apps (Amazon, Uber, transit turnstiles), GPS confidence, utilization, and mandatory spend deadlines.

## Why this exists
- **Default wallet experience**: simulate OS-level default wallet routing so tap-to-pay can auto-select the best card without opening the app.
- **AI-driven optimization**: infer category from merchant apps, location, or receipts and score cards with configurable reward rules.
- **Low-latency routing**: recommendations are cached and served through lightweight APIs for sub-second response (useful for subway/turnstile scenarios).
- **Cross-platform**: PWA frontend works on Apple, Android, and desktop devices and can integrate with browser autofill.

## AI + performance strategy
The recommendation engine blends deterministic rules with AI-ready signals:
- **Merchant intelligence**: map merchant apps (e.g., Uber, Amazon, Subway Turnstile) to categories and boost relevant cards.
- **Signal fusion**: combine location confidence, utilization thresholds, APR sensitivity, and mandatory spend windows.
- **Autofill routing**: produce autofill-ready card metadata (masked PAN, expiry) for app checkout flows.
- **Edge performance**: the server caches recommendations for short TTL windows and caches portfolio/rule data to avoid disk reads.

For production deployments, you can extend this with:
- **Edge caching** (Cloudflare Workers, Fastly Compute@Edge) for global low-latency routing.
- **Streaming inference** (gRPC/HTTP2) to ingest real-time merchant signals.
- **Model serving** (Vertex AI, AWS SageMaker, Azure ML) for reward optimization based on historical spend.

## Installation

### Prerequisites
- Node.js 18+

### Install & run
```bash
# from the repo root
node src/server.js
```

Open the app at: `http://localhost:3000`

### Run tests
```bash
npm test
```

## Architecture

```mermaid
flowchart LR
  subgraph Client
    UI[PWA UI (Web/Mobile/Desktop)]
    Autofill[OS Autofill / Browser Extension]
  end

  subgraph Server
    API[HTTP API]
    Cache[Recommendation Cache]
    Engine[Scoring & AI Rules Engine]
    Store[Card + Rule Store]
  end

  UI -->|Recommendation Request| API
  Autofill -->|Card Prefill Request| API
  API --> Cache
  Cache -->|Hit| API
  Cache -->|Miss| Engine
  Engine --> Store
  Store --> Engine
  Engine --> API
  API --> UI
```

## API overview
- `GET /api/cards` - list stored cards
- `POST /api/cards` - add a card
- `GET /api/apps` - merchant app presets
- `POST /api/recommendation` - get best card + autofill details

## Notes
This repository is a functional prototype to demonstrate how AI-powered card selection can work with wallet handoff, app checkout, and offline-ready PWA delivery.
