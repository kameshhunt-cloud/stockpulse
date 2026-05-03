/**
 * StockPulse — Main Application Controller
 * Orchestrates location detection, data fetching, scoring, and rendering.
 */
const App = (() => {
  let _countryCode = 'US';
  let _marketKey = 'US';
  let _market = null;
  let _scoredStocks = [];

  async function init() {
    // 1. Check API key
    const key = API.getApiKey();
    if (!key) {
      UI.showApiKeyModal(() => boot());
      return;
    }
    boot();
  }

  async function boot() {
    UI.showLoading();

    try {
      // 2. Detect location
      _countryCode = await Location.detectCountry();
      _marketKey = Location.getMarketKey(_countryCode);
      _market = CONFIG.MARKETS[_marketKey];

      // 3. Render header
      const status = Location.getMarketStatus(_market);
      UI.renderHeader(_market, _countryCode, status);

      // 4. Fetch quotes & historical candles
      const symbols = _market.stocks.map((s) => s.symbol);
      const [quotesMap, candlesMap] = await Promise.all([
        API.getQuotes(symbols),
        API.getHistoricalCandlesBatched(symbols, 70) // ~50 trading days
      ]);

      if (quotesMap.size === 0) {
        UI.showError('No stock data received. The market may be closed or the API key may be invalid.');
        UI.hideLoading();
        return;
      }

      // 4b. Currency Conversion
      if (_market.targetCurrency && _market.targetCurrency !== 'USD') {
        const rates = await API.getExchangeRates();
        if (rates && rates[_market.targetCurrency]) {
          const rate = rates[_market.targetCurrency];
          // Scale current quotes
          quotesMap.forEach((q) => {
            q.c *= rate; q.h *= rate; q.l *= rate; q.o *= rate; q.pc *= rate;
          });
          // Scale historical candles
          candlesMap.forEach((c) => {
            if (c.c) c.c = c.c.map(p => p * rate);
            if (c.h) c.h = c.h.map(p => p * rate);
            if (c.l) c.l = c.l.map(p => p * rate);
            if (c.o) c.o = c.o.map(p => p * rate);
          });
        }
      }

      // 5. Score & rank
      _scoredStocks = Scoring.scoreAll(_market.stocks, quotesMap, candlesMap);

      // 6. Render everything
      _renderAll();
      UI.hideLoading();

    } catch (err) {
      console.error('Boot error:', err);
      UI.showError('Failed to load data. Please check your API key and try again.');
      UI.hideLoading();
    }
  }

  function _renderAll() {
    UI.renderMarketOverview(_scoredStocks, _market);
    UI.renderSectorHeatmap(_scoredStocks);
    UI.renderTopPicks(_scoredStocks, _market);
    UI.renderRankingsTable(_scoredStocks, _market);
    UI.renderWatchlist(_scoredStocks, _market);
    UI.renderTimestamp();
  }

  /** Switch to a different market (called from dropdown). */
  async function switchMarket(marketKey) {
    if (marketKey === _marketKey) return;
    _marketKey = marketKey;
    _market = CONFIG.MARKETS[_marketKey];
    UI.showLoading();
    API.clearCache();

    try {
      const status = Location.getMarketStatus(_market);
      UI.renderHeader(_market, _countryCode, status);

      const symbols = _market.stocks.map((s) => s.symbol);
      const quotesMap = await API.getQuotes(symbols);

      _scoredStocks = Scoring.scoreAll(_market.stocks, quotesMap);
      _renderAll();
    } catch (err) {
      console.error('Market switch error:', err);
      UI.showError('Failed to load market data.');
    }
    UI.hideLoading();
  }

  /** Refresh current market data. */
  async function refresh() {
    API.clearCache();
    await boot();
  }

  /** Expose state for local re-renders. */
  function getScoredStocks() { return _scoredStocks; }
  function getMarket() { return _market; }

  return { init, switchMarket, refresh, getScoredStocks, getMarket };
})();

// ── DOM Ready ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Market selector change
  document.getElementById('market-selector').addEventListener('change', (e) => {
    App.switchMarket(e.target.value);
  });

  // Sector filter change → re-render table locally (no API call)
  document.getElementById('sector-filter').addEventListener('change', () => {
    const stocks = App.getScoredStocks();
    const market = App.getMarket();
    if (stocks.length && market) UI.renderRankingsTable(stocks, market);
  });

  // Watchlist changes → re-render watchlist + picks locally (no API call)
  document.addEventListener('watchlist-changed', () => {
    const stocks = App.getScoredStocks();
    const market = App.getMarket();
    if (stocks.length && market) {
      UI.renderWatchlist(stocks, market);
      UI.renderTopPicks(stocks, market);
    }
  });

  // Refresh button
  document.getElementById('refresh-btn')?.addEventListener('click', () => App.refresh());

  // Settings button to re-enter API key
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    UI.showApiKeyModal(() => App.refresh());
  });
});
