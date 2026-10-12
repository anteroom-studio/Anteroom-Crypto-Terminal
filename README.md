# Anteroom Crypto Terminal

**A market research interface that asks whether the conditions behind a trade idea are actually stable.**

[**Open live demo**](https://anteroom-studio.github.io/Anteroom-Crypto-Terminal/) · [**Review active engineering challenge**](https://github.com/anteroom-studio/Anteroom-Crypto-Terminal/issues/5) · [**Discuss ideas**](https://github.com/anteroom-studio/Anteroom-Crypto-Terminal/discussions) · [**Explore the code**](src/)

Anteroom Crypto Terminal is a Vite-based, browser-run dashboard built within **Anteroom Studio**, the company founded by ZAI. It combines available crypto futures market data, stability checks, event/news context, and optional model-generated commentary. Its primary output is a **rule-based assessment of tradeability**, not an automated trade.

---

## The process: observations → checks → assessment

| Stage | Input / computation | What the interface shows |
| --- | --- | --- |
| Market observation | Binance Futures REST data for price, order-book levels, spread, funding, open interest, and candles | Current symbol and market context; status can be Live, Partial, or Unavailable |
| Stability across refreshes | Near-touch bid/ask imbalance, median of recent snapshots, sign flips, and drift | Whether apparent directional pressure persists rather than existing in one snapshot |
| Execution filters | Spread, depth, imbalance stability, and symbolic thresholds | A rule-based tradeability gate and a verdict such as WAIT or SKIP; other states appear when gates pass |
| Risk context | Funding, open interest, sentiment, future event timing, market scan and news | Crowding warnings, event context and research panels |
| Pressure estimates and stream | Heuristic liquidation-pressure estimates plus a separate exchange liquidation WebSocket feed | Indicative pressure levels and stream-dependent liquidation observations |
| Interpretation | Built-in rules, with optional browser-to-provider model calls | Local explanation or optional AI-generated analysis |
| Workspace | User-entered equity, risk, stop distance, and leverage | Illustrative position-notional and margin calculations; no orders placed |

These processes can be inspected in [market services](src/services/market.js), [tradeability and pressure logic](src/logic/zaiEngine.js), and [the dashboard](src/ui/app.js).

### What the verdict does—and does not—establish

The [tradeability function](src/logic/zaiEngine.js) checks several configurable-in-code thresholds. For example, unstable book-imbalance signs, too much drift, insufficient depth, or excessive spread can cause the system to withhold a positive assessment. An `ENTER`-style label is **a rule output**, not evidence of a profitable strategy or an instruction to transact.

Liquidation *estimates* are computed from heuristics and are not the same thing as actual observed liquidations. The source also connects to an exchange liquidation stream; users should distinguish these two sources rather than treat both numbers as measurements.

The code includes source-status indicators and uses cached or unavailable states for some feeds. A rendered market panel does not prove that all external sources are currently reachable.

---

## Try it yourself

**[Launch the browser demo →](https://anteroom-studio.github.io/Anteroom-Crypto-Terminal/)**

1. Choose a symbol and timeframe. Note whether each panel reports live, partial, cached, or unavailable information.
2. Compare the book-imbalance and tradeability assessment across several refreshes; note whether the conclusion changes.
3. Inspect spread, depth, funding, open interest, alerts, and event timing before interpreting the verdict.
4. Try the built-in local explanation without an API key. Optional model analysis is secondary to the source data and rules.
5. Document a disagreement, inconsistent data source, unclear label, or a test case that exposes a flawed threshold.

For local development:

```bash
git clone https://github.com/anteroom-studio/Anteroom-Crypto-Terminal.git
cd Anteroom-Crypto-Terminal
npm install
npm run dev
```

Build: `npm run build`. This project also includes GitHub Pages deployment configuration.

**Privacy note:** If you provide a model API key, the current interface stores it in browser `localStorage` and sends requests from your browser to the selected provider. Treat this as browser-local convenience, not secure secret storage; use a restricted key and avoid shared devices.

---

## Open engineering question

**When should the terminal refuse to recommend action, even if one market snapshot looks convincing?**

The strongest contribution here is a reproducible counterexample, not a generic feature request. Show the symbol, timeframe, timestamps, observed inputs, reported status/verdict, and a suggested correction. Remove secrets and sensitive data.

[**Review the active engineering issue →**](https://github.com/anteroom-studio/Anteroom-Crypto-Terminal/issues/5) · [**Join Discussions →**](https://github.com/anteroom-studio/Anteroom-Crypto-Terminal/discussions)  
[**Open a bug report →**](https://github.com/anteroom-studio/Anteroom-Crypto-Terminal/issues/new)

## Scope

Research and monitoring only. No order execution, proven forecasting accuracy, backtested profitability, or financial advice is claimed. Data depends on external providers and browser connectivity. Rule thresholds and derived estimates deserve independent validation.

---

**Anteroom Studio** · ZAI-founded company · Anteroom Crypto Terminal is one of its research programs.
