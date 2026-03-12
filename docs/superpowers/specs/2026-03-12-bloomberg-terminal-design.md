# Bloomberg Crypto Terminal — Design Spec

## Overview

A functional crypto market terminal built incrementally, modeled after Bloomberg's panel-based architecture. The terminal provides real-time market data through a tiling panel system where every feature is a composable, independent panel.

**Not in scope for this spec:** Visual design, UI components, colors, typography, layout styling. All frontend design is handled via Pencil.dev.

---

## Architecture: Panel System

The core of the application is a tiling window manager. Every piece of content — watchlist, chart, order book — is a "panel" rendered inside a shared layout engine.

### Panel Grid

- Root layout component managing a tree of panels arranged in rows and columns.
- Panels can be split horizontally or vertically (like splitting a terminal pane).
- Draggable dividers between panels for resizing.
- Layout state serialized to `localStorage` for workspace persistence across sessions.
- Layout is represented as a recursive tree:

```ts
type PanelConfig = Record<string, unknown>  // per-panel persistent state (e.g. watchlist symbols)

type LayoutNode =
  | { type: "panel"; panelId: string; panelType: string; linkColor?: LinkColor; config?: PanelConfig }
  | { type: "row" | "column"; children: LayoutNode[]; sizes: number[] }
```

Per-panel state (like which symbols are in a watchlist) is stored in the `config` bag on the panel's `LayoutNode` and persists with the layout to `localStorage`.

`sizes` are **fractional values (0-1)** that must sum to 1.0 for each row/column. Example: a 30/70 split is `[0.3, 0.7]`. The layout engine converts these to CSS `flex` values. Floating-point drift from divider dragging is normalized (sizes are recalculated to sum to exactly 1.0 after each resize).

**Minimum panel size:** 120px width, 80px height. Divider dragging is clamped to prevent panels from going below these thresholds.

**Panel close behavior:**
- Closing a panel removes it from the parent row/column. The remaining siblings' sizes are renormalized to fill the space.
- If a row/column is left with a single child, it collapses — the child replaces the parent node in the tree.
- The last panel in the terminal cannot be closed (close button is hidden/disabled).

**Panel drag-and-drop reordering** is out of scope for Phase 1. Panels can only be resized via dividers and added/removed. Reordering may be added in Phase 5.

**New panel placement:** When a panel is opened from the command bar, it splits the rightmost panel vertically (50/50). This can be refined in future phases.

### Panel Shell

- Every panel is wrapped in a shell that provides:
  - Title bar with panel type name (e.g. `WATCHLIST`, `CHART BTC/USDT`)
  - Toolbar area for panel-specific controls
  - Close button
  - Link color indicator (see Panel Linking below)
- The shell is a generic container — it renders whatever panel type is registered.

### Panel Registry

- A map of panel type identifiers to React components:

```ts
const registry: Record<string, React.ComponentType<PanelProps>> = {
  watchlist: WatchlistPanel,
  chart: ChartPanel,
}
```

- Adding a new panel type = creating a component and adding one entry to the registry.
- No other changes required — the panel system, command bar, and layout engine all work automatically.

**PanelProps interface** (passed to every panel component by the shell):

```ts
interface PanelProps {
  panelId: string
  linkedSymbol: string | null   // active symbol from link group, or null if unlinked
  onSymbolSelect: (symbol: string) => void  // broadcast symbol to link group
}
```

### Command Bar

- Persistent input bar at the top of the terminal.
- Keyboard-activated (press `/` to focus, `Escape` to blur back to panels).
- `/` keypress is only captured when no other input element has focus. If a panel contains a focused input, `/` types normally.
- Phase 1: dropdown/autocomplete for opening panel types.
- Future: full command system (e.g. `BTC/USDT CHART <GO>`, `ALERT BTC > 100000`).
- Commands are registered alongside panel types — extensible by convention.

### Panel Linking

- Panels can be linked by color (amber, green, blue, red).
- All panels sharing a link color respond to the same active symbol.
- Clicking ETH in a watchlist (amber-linked) switches an amber-linked chart to ETH.
- Unlinked panels remain independent.
- Link state is managed globally in the layout store.

```ts
type LinkColor = "amber" | "green" | "blue" | "red"

type LinkGroup = {
  color: LinkColor
  activeSymbol: string | null  // null until first symbol is broadcast to this group
}
```

Link groups are created lazily — a group only exists once a panel is assigned that color. The `activeSymbol` starts as `null`. When a panel receives `linkedSymbol: null`, it falls back to its own default (e.g. Chart defaults to BTC/USDT).

**Default layout:** Both panels start **amber-linked**. The link group is initialized with `activeSymbol: null`, so the Chart defaults to BTC/USDT until the user clicks a row in the Watchlist.

Each panel node in the layout tree has an optional `linkColor` field (see `LayoutNode` definition above). If `linkColor` is absent or `undefined`, the panel is unlinked and manages its own symbol independently.

### Default Layout (Phase 1)

Two panels: Watchlist (30% width) and Chart (70% width). User can resize and rearrange from there.

---

## Data Layer

### Provider Interface

Every data source implements a common interface. Panels never interact with APIs directly — they consume data through providers.

```ts
interface MarketDataProvider {
  subscribeTicker(symbol: string, callback: (tick: Tick) => void): Unsubscribe
  getOHLCV(symbol: string, timeframe: Timeframe, limit?: number): Promise<Candle[]>  // default: 500 candles
  subscribeKline(symbol: string, timeframe: Timeframe, callback: (candle: Candle) => void): Unsubscribe
}
```

The interface is minimal for Phase 1 — only what Phase 1 panels consume. Methods like `getOrderBook()` will be added in Phase 2 when the Order Book panel is built. This avoids dead code and scope confusion.

`subscribeTicker` returns an `Unsubscribe` function handle. Consumers call this handle to unsubscribe — there is no separate `unsubscribe()` method. This is the standard React cleanup pattern (return from `useEffect`).

### Phase 1 Providers

**BinanceProvider**
- WebSocket streams for real-time ticker data.
- REST API for historical OHLCV candle data.
- Endpoint: `wss://stream.binance.com:9443/ws`. Multiplexing is done by sending `SUBSCRIBE`/`UNSUBSCRIBE` JSON frames on a single connection (not the `/stream` combined-stream endpoint).
- Supports subscribing to multiple symbols on a single connection via dynamic subscribe frames.

**CoinGeckoProvider**
- REST API for metadata: coin logos, descriptions, market cap, 24h stats.
- Requires a free "Demo API key" (CoinGecko deprecated fully keyless access). Key is stored as a `VITE_COINGECKO_API_KEY` environment variable (loaded via Vite's `.env` file). Since this is a client-side app, the key is visible in the bundle — this is acceptable for a free/demo key. For premium keys in future phases, a lightweight proxy server would be needed.
- Free/demo tier rate limit: ~10-30 calls/minute. Metadata is fetched once on load and cached — not polled continuously.
- Used as supplementary data, not primary price source.

### REST Error Handling

- All REST calls (`getOHLCV`, CoinGecko metadata) use retry with backoff: 1 attempt, then retry after 1s, then 3s, then fail.
- On failure, panels display an error state (e.g. "Failed to load candles — Retry" button).
- CoinGecko rate limits are handled gracefully: batch requests where possible, cache aggressively, degrade to showing data without metadata (no logo/description) rather than blocking.

### State Management (Zustand)

```ts
// MarketStore — read-only view of market state. WebSocketManager pushes updates here.
// Subscription management (refcounting, subscribe/unsubscribe) lives in WebSocketManager, not this store.
{
  tickers: Record<string, Tick>         // latest tick data by symbol (price, 24h change, volume, etc.)
  connectionStatus: "connected" | "disconnected" | "reconnecting"
}

// MetadataStore
{
  coins: Record<string, CoinMetadata>   // logos, descriptions, market cap by symbol
  loading: boolean
  error: string | null
}

// LayoutStore
{
  layout: LayoutNode                    // panel tree
  linkGroups: LinkGroup[]               // color-linked symbol groups
  saveLayout(): void
  loadLayout(): void
}

// SettingsStore
{
  defaultCoins: string[]                // watchlist defaults
  defaultTimeframe: Timeframe
}
```

`localStorage` persistence is acceptable for Phase 1. If storage is full or cleared, the app falls back to the default layout. A more robust solution (IndexedDB or server-side) is deferred to Phase 5 with multi-workspace support.

### WebSocket Strategy

- **Single shared connection**, multiplexed across all panels.
- Multiple panels watching the same symbol share one subscription.
- **Reference counting** lives in `WebSocketManager.ts`. Each `subscribeTicker()` call increments a refcount for that symbol; each returned `Unsubscribe` call decrements it. The WebSocket stream for a symbol is torn down only when the refcount hits zero.
- Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s... max 30s).
- **Heartbeat:** Binance sends server-initiated pings; `WebSocketManager` responds with pongs automatically. Additionally, if no message of any kind is received for 60s, the manager assumes the connection is dead and triggers reconnect.
- **Reconnect subscription restoration:** On successful reconnect, `WebSocketManager` automatically re-subscribes to all symbols tracked in its internal refcount map. Panels do not need to re-subscribe manually.
- Connection status reflected in global store and visible in the UI.
- **Prolonged disconnection:** If the connection has been in `"reconnecting"` state for over 2 minutes, panels display a "Connection lost — retrying..." banner. Reconnect attempts continue indefinitely (capped at 30s intervals) — the terminal does not give up, since the user may be offline temporarily.

### WebSocket Error Handling

- Subscription failures (e.g. invalid symbol) are caught and surfaced to the requesting panel as an error state.
- The `connectionStatus` field in MarketStore is the single source of truth for WS health. Panels read this to decide whether to show stale-data indicators.

### Data Flow

```
Binance WS ──> BinanceProvider ──> MarketStore (Zustand) ──> Panels
                                        ^
CoinGecko REST ─> CoinGeckoProvider ────┘ (metadata, logos, 24h stats)
```

---

## Phase 1 Panel Types

### Watchlist Panel

**Purpose:** Dense, real-time overview of tracked crypto pairs.

**Functionality:**
- Displays a table of tracked symbols.
- Columns: Symbol, Last Price, 24h Change (%), 24h High, 24h Low, Volume.
- Prices update in real-time via WebSocket subscription.
- Visual tick indicators: flash on uptick (positive) and downtick (negative).
- Clicking a row broadcasts that symbol to linked panels.
- Default symbols: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT, ADA/USDT, DOGE/USDT, AVAX/USDT.
- User can add/remove symbols.
- Sortable columns (click header to sort).

**Data dependencies:**
- `BinanceProvider.subscribeTicker()` for each symbol.
- `CoinGeckoProvider` for metadata (optional enrichment).

### Chart Panel

**Purpose:** Candlestick price chart for a single symbol.

**Functionality:**
- Renders candlestick chart using TradingView lightweight-charts.
- Timeframe selector: 1m, 5m, 15m, 1h, 4h, 1d, 1w (UI labels may display uppercase; the `Timeframe` type values are lowercase for Binance API compatibility).
- Volume bars displayed below candles.
- Current price overlay.
- Receives symbol from: linked panel group OR command bar.
- **Default symbol on initial load:** BTC/USDT. If the panel is linked and the link group has an active symbol, it uses that instead.
- Auto-updates with new candles via kline WebSocket stream (Binance `<symbol>@kline_<interval>`).
- Crosshair with price/time tooltip on hover.

**Data dependencies:**
- `BinanceProvider.getOHLCV()` for historical candles on initial load.
- `BinanceProvider.subscribeKline()` for live candle updates as they form/close.
- `BinanceProvider.subscribeTicker()` for current price overlay.

---

## Core Data Types

```ts
type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w"
// Lowercase to match Binance API format directly. No normalization needed.

type Tick = {
  symbol: string          // normalized format: "BTC/USDT"
  price: number
  change24h: number       // percentage
  high24h: number
  low24h: number
  volume24h: number
  timestamp: number
}

type Candle = {
  time: number            // unix timestamp (seconds, for lightweight-charts)
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type CoinMetadata = {
  symbol: string
  name: string
  logoUrl: string | null
  marketCap: number | null
  description: string | null
}

type Unsubscribe = () => void
```

**Symbol normalization:** The app uses `"BTC/USDT"` format internally (human-readable). Each provider converts to/from its native format in its own layer (e.g. BinanceProvider converts `"BTC/USDT"` ↔ `"btcusdt"` for API calls). Panels and stores never see API-native formats.

**No separate `Price` type.** `Tick` is the canonical real-time data type — it contains the last price plus 24h stats. The MarketStore holds `Record<string, Tick>`, which serves both the Watchlist (needs all fields) and Chart (needs `price` for overlay).

---

## Tech Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | Vite + React 18 | Fast dev server, no SSR overhead, client-side app |
| Language | TypeScript | Type safety for complex data flows |
| State | Zustand | Lightweight, no boilerplate, selector-based re-renders |
| Charts | TradingView lightweight-charts | Free, performant, purpose-built for financial data |
| WebSocket | Native browser API | No extra dependency needed |
| Styling | Pencil.dev output | Visual design handled externally |

---

## Project Structure

```
src/
  panel-system/        # Core tiling engine
    PanelGrid.tsx       # Root layout renderer (recursive tree)
    Panel.tsx           # Panel shell (title bar, toolbar, close, link dot)
    Splitter.tsx        # Draggable divider between panels
    registry.ts         # Panel type registry
    CommandBar.tsx       # Top command input bar

  panels/              # Panel type implementations
    watchlist/
      WatchlistPanel.tsx
      useWatchlist.ts    # Hook: subscribes to symbols, returns rows
    chart/
      ChartPanel.tsx
      useChart.ts        # Hook: fetches candles, manages timeframe

  providers/           # Data provider implementations
    types.ts            # MarketDataProvider interface
    BinanceProvider.ts  # WebSocket + REST implementation
    CoinGeckoProvider.ts # REST metadata provider

  services/            # Infrastructure
    WebSocketManager.ts # Shared WS connection, multiplexing, reconnect
    apiClient.ts        # HTTP client wrapper for REST calls

  stores/              # Zustand stores
    marketStore.ts      # Prices, subscriptions, connection status
    metadataStore.ts    # Coin metadata from CoinGecko (logos, market cap)
    layoutStore.ts      # Panel tree, link groups, persistence
    settingsStore.ts    # User preferences

  types/               # Shared TypeScript types
    market.ts           # Price, Tick, Candle, OrderBook, Timeframe
    layout.ts           # LayoutNode, LinkGroup, PanelProps
```

---

## Phase Roadmap

| Phase | Scope | Key Functionality |
|-------|-------|-------------------|
| 1 | Core terminal | Panel system, Watchlist, Chart, Command bar, Binance WS |
| 2 | Depth | Order book panel, trade feed panel, price alerts |
| 3 | Portfolio | Holdings tracker, P&L calculation, allocation breakdown |
| 4 | Intelligence | News feed panel, on-chain data, social sentiment |
| 5 | Power user | Full keyboard navigation, multi-workspace, layout export/import |

Each phase is self-contained and usable on its own. No phase depends on a future phase to deliver value.

---

## Key Design Decisions

1. **Panel system is the foundation.** Every feature is a panel. No exceptions. This is what makes it feel like Bloomberg.
2. **Provider abstraction from day one.** Swapping Binance for Coinbase or a premium API should be a single file change.
3. **Single WebSocket, multiplexed.** Performance and rate-limit discipline.
4. **Layout persistence.** The user's workspace arrangement survives page reloads.
5. **Link groups for panel coordination.** Panels communicate through shared symbol state, not direct coupling.
6. **Visual design is external.** All UI/styling decisions are made in Pencil.dev — this spec covers functionality only.
7. **Tab visibility:** When the browser tab is hidden (`document.visibilityState === "hidden"`), WebSocket stays connected but UI updates are paused (no re-renders). Updates resume immediately when the tab becomes visible again. This prevents unnecessary rendering overhead.
