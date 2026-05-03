/**
 * StockPulse — API Layer
 * Handles all Finnhub API calls with batching, rate-limiting, and caching.
 */

const API = (() => {
  // ── Private State ────────────────────────────────────────────
  let _apiKey = '';
  const _cache = new Map();

  // ── Helpers ──────────────────────────────────────────────────

  /** Retrieve or set the Finnhub API key (persists in localStorage). */
  function getApiKey() {
    if (_apiKey) return _apiKey;
    _apiKey = localStorage.getItem('stockpulse_api_key') || '';
    return _apiKey;
  }

  function setApiKey(key) {
    _apiKey = key.trim();
    localStorage.setItem('stockpulse_api_key', _apiKey);
  }

  /** Build a Finnhub URL with the API token appended. */
  function buildUrl(path, params = {}) {
    const url = new URL(`${CONFIG.FINNHUB_BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('token', getApiKey());
    return url.toString();
  }

  /** Check cache. Returns cached value or null. */
  function getCached(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CONFIG.CACHE_TTL_MS) {
      _cache.delete(key);
      return null;
    }
    return entry.data;
  }

  function setCache(key, data) {
    _cache.set(key, { data, ts: Date.now() });
  }

  /** Sleep helper. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── Core Fetch ───────────────────────────────────────────────

  /** Single API call with caching. */
  async function fetchEndpoint(path, params = {}) {
    const cacheKey = path + JSON.stringify(params);
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const url = buildUrl(path, params);
    const res = await fetch(url);

    if (res.status === 429) {
      // Rate limited – wait and retry once
      await sleep(2000);
      const retry = await fetch(url);
      if (!retry.ok) throw new Error(`API error ${retry.status}`);
      const data = await retry.json();
      setCache(cacheKey, data);
      return data;
    }

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
  }

  // ── Batched Fetch ────────────────────────────────────────────

  /**
   * Fire an array of fetch-functions in batches.
   * Each item in `tasks` should be () => fetchEndpoint(...)
   * Returns an array of { status, value?, reason? } (like Promise.allSettled).
   */
  async function fetchBatched(tasks) {
    const results = [];
    for (let i = 0; i < tasks.length; i += CONFIG.BATCH_SIZE) {
      const batch = tasks.slice(i, i + CONFIG.BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map((fn) => fn()));
      results.push(...settled);
      // Pause between batches to respect rate limits
      if (i + CONFIG.BATCH_SIZE < tasks.length) {
        await sleep(CONFIG.BATCH_DELAY_MS);
      }
    }
    return results;
  }

  // ── Public API Methods ───────────────────────────────────────

  /** Fetch a real-time quote for a single symbol. */
  function getQuote(symbol) {
    return fetchEndpoint('/quote', { symbol });
  }

  /** Fetch quotes for many symbols (batched). Returns Map<symbol, quoteData>. */
  async function getQuotes(symbols) {
    const tasks = symbols.map((sym) => () => getQuote(sym));
    const results = await fetchBatched(tasks);
    const map = new Map();
    symbols.forEach((sym, i) => {
      if (results[i].status === 'fulfilled' && results[i].value.c > 0) {
        map.set(sym, results[i].value);
      }
    });
    return map;
  }

  /** Fetch company profile. */
  function getProfile(symbol) {
    return fetchEndpoint('/stock/profile2', { symbol });
  }

  /** Fetch basic financials / metrics. */
  function getMetrics(symbol) {
    return fetchEndpoint('/stock/metric', { symbol, metric: 'all' });
  }

  /** Fetch general market news. */
  function getMarketNews() {
    return fetchEndpoint('/news', { category: 'general', minId: 0 });
  }

  /** Fetch company-specific news (last 7 days). */
  function getCompanyNews(symbol) {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    return fetchEndpoint('/company-news', { symbol, from, to });
  }

  /** Test if the API key is valid by making a simple call. */
  async function testKey() {
    try {
      const data = await fetchEndpoint('/quote', { symbol: 'AAPL' });
      return data && typeof data.c === 'number';
    } catch {
      return false;
    }
  }

  /** Clear all cached data. */
  function clearCache() {
    _cache.clear();
  }

  // ── LocalStorage Cache (For long-lived data like daily candles) ──
  function getLocalCache(key, ttlMs) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      const parsed = JSON.parse(item);
      if (Date.now() - parsed.ts > ttlMs) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch { return null; }
  }

  function setLocalCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* ignore quota errors */ }
  }

  /** Fetch live exchange rates from public API. */
  async function getExchangeRates() {
    const cacheKey = 'exchange_rates';
    const cached = getLocalCache(cacheKey, 12 * 60 * 60 * 1000); // 12 hours
    if (cached) return cached;
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!res.ok) throw new Error('Failed to fetch rates');
      const data = await res.json();
      setLocalCache(cacheKey, data.rates);
      return data.rates;
    } catch (e) {
      console.warn('Exchange rate error:', e);
      return null;
    }
  }

  /** Fetch historical daily candles (persisted in localStorage for 12 hours) */
  async function getHistoricalCandles(symbol, days) {
    const cacheKey = `stockpulse_candle_${symbol}_${days}`;
    const cached = getLocalCache(cacheKey, 12 * 60 * 60 * 1000); // 12 hour TTL
    if (cached) return cached;

    const to = Math.floor(Date.now() / 1000);
    const from = to - (days * 86400);
    
    try {
      const url = buildUrl('/stock/candle', { symbol, resolution: 'D', from, to });
      const res = await fetch(url);
      if (res.status === 429) {
        await sleep(2000);
        const retry = await fetch(url);
        if (!retry.ok) return null;
        const data = await retry.json();
        if (data.s === 'ok') setLocalCache(cacheKey, data);
        return data;
      }
      if (!res.ok) return null;
      const data = await res.json();
      if (data.s === 'ok') setLocalCache(cacheKey, data);
      return data;
    } catch {
      return null;
    }
  }

  /** Batched wrapper for historical candles */
  async function getHistoricalCandlesBatched(symbols, days) {
    const tasks = symbols.map((sym) => () => getHistoricalCandles(sym, days));
    const results = await fetchBatched(tasks);
    const map = new Map();
    symbols.forEach((sym, i) => {
      if (results[i].status === 'fulfilled' && results[i].value && results[i].value.s === 'ok') {
        map.set(sym, results[i].value);
      }
    });
    return map;
  }

  // ── Expose ───────────────────────────────────────────────────
  return {
    getApiKey,
    setApiKey,
    testKey,
    getQuote,
    getQuotes,
    getProfile,
    getMetrics,
    getMarketNews,
    getCompanyNews,
    getHistoricalCandles,
    getHistoricalCandlesBatched,
    getExchangeRates,
    clearCache,
  };
})();
