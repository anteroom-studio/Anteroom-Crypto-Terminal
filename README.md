# Anteroom Crypto Terminal

**Real-time crypto market intelligence interface for structure, liquidity, and execution research.**

Anteroom Crypto Terminal is a Vite-powered web dashboard for monitoring crypto market structure, orderbook conditions, liquidation pressure, event risk, and tradeability context in one focused interface.

> Built by **Anteroom Studio** as part of its market intelligence and research interface stack.

---

## Overview

The terminal is designed for fast market review, not automated trading. It combines live futures data, market scan context, news/event awareness, execution filters, and optional analyst summaries into a cinematic dashboard interface.

It helps answer practical research questions such as:

- Is the current setup clean enough to monitor?
- Is orderbook imbalance stable or noisy?
- Are spread, depth, and liquidity conditions acceptable?
- Is crowding or event risk making the setup dangerous?
- Which symbols currently deserve attention?

---

## Core Capabilities

- Live crypto futures market monitoring
- Focus-symbol dashboard for BTC, ETH, SOL, and other major assets
- Orderbook imbalance and stability tracking
- Spread, depth, funding, open-interest, and sentiment context
- Liquidation pressure mapping
- Market scan board
- News and event awareness panels
- Local rules-based interpretation
- Optional OpenRouter-powered analyst summaries using a user-supplied key
- GitHub Pages compatible static deployment

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + vanilla JavaScript |
| Styling | Custom CSS |
| Data | Public market/news/event endpoints where available |
| Optional summary layer | OpenRouter API with user-provided key |
| Deployment | GitHub Pages compatible |

---

## Run Locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Deploy to GitHub Pages:

```bash
npm run deploy
```

---

## Security Notes

The app does not require a server-side API key. Optional OpenRouter usage is user-supplied in the browser and stored locally for convenience. Do not commit private keys or secrets to the repository.

---

## Scope

Anteroom Crypto Terminal is a research and monitoring interface. It does not provide financial advice, investment advice, or automated trading signals. Outputs should be treated as informational context only.

---

## Studio

**Anteroom Studio**  
Research systems, intelligence interfaces, and experimental software.
