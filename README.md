# StockPulse 📈

StockPulse is a premium, location-aware algorithmic stock suggestion dashboard built entirely in Vanilla JavaScript. It automatically detects the user's country, maps it to the relevant regional market (US, UK, or India), and ranks stocks using a custom multi-factor scoring engine powered by real-time Finnhub API data.

## ✨ Features

- **🌍 Location-Aware:** Uses IP geolocation (`ipapi.co`) to automatically serve the most relevant market data (US equities, UK ADRs, or India ADRs/ETFs).
- **🧠 Custom Scoring Algorithm (0-100):** Ranks stocks dynamically based on a composite weight system:
  - 50-Day Trend Confirmation (Moving Averages)
  - Daily Price Momentum
  - Intraday High/Low Positioning
  - Sector Strength
  - Market Cap Stability (Mega vs Large cap)
  - Gap Analysis (Open vs Previous Close)
- **📊 SVG Sparkline Charts:** Auto-generated, glowing mini-charts displaying the 30-day historical trend for US equities.
- **⚡ Real-Time Data:** Live quotes fetched efficiently with intelligent batching and local caching to respect API rate limits.
- **🎨 Premium Dark UI:** Built with raw CSS featuring glassmorphism, responsive CSS Grid layouts, and smooth micro-animations.
- **↕️ Interactive Sorting:** Clickable table headers for instant, client-side re-sorting by Price, Score, Change, etc.
- **⭐ Local Watchlist:** Persists user-selected stocks using `localStorage`.

## 🚀 Getting Started

Since StockPulse is a purely client-side application (no backend required), you can run it instantly on any static file server or directly in your browser.

### 1. Run Locally
You can use VS Code Live Server, Python's `http.server`, or simply open the `index.html` file in your browser:
```bash
# Using python
python -m http.server 3000
```

### 2. Enter your API Key
Upon opening the app, you will be greeted by a secure modal asking for a **Finnhub API Key**.
1. Go to [Finnhub.io](https://finnhub.io/) and create a free account.
2. Copy your API key and paste it into the StockPulse modal.
3. The key is securely saved to your browser's `localStorage` for future sessions.

## 📁 Project Structure

```text
├── index.html        # Main application structure
├── css/
│   └── styles.css    # Premium dark theme design system
├── assets/
│   └── favicon.svg   # Custom scalable vector icon
└── js/
    ├── app.js        # Core controller (orchestrates API, Scoring, and UI)
    ├── api.js        # Finnhub API handler (batching, caching, rate-limit protection)
    ├── config.js     # Market definitions, symbol lists, and scoring weights
    ├── location.js   # Geolocation IP-to-market mapping logic
    ├── scoring.js    # The mathematical ranking and trend analysis engine
    └── ui.js         # DOM manipulation, event listeners, and SVG generation
```

## ⚠️ Notes on Free Tier Limitations
- **Finnhub Free Tier:** The free tier of Finnhub does not support historical daily candles (`/stock/candle`) for ADRs and ETFs. As a result, sparkline charts will gracefully hide themselves when viewing the India or UK markets. To unlock historical charts for international markets, a premium Finnhub key is required.
- **Rate Limits:** The application safely batches requests and utilizes `localStorage` caching to ensure it never exceeds the 60 requests/minute limit.

## 📄 License
This project is open-source and available for personal or educational use.
