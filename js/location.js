/**
 * StockPulse — Location Detection
 * Detects user's country via IP and maps it to a stock market.
 */

const Location = (() => {
  const STORAGE_KEY = 'stockpulse_location';
  const STORAGE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Detect user's country code.
   * Priority: localStorage cache → ipapi.co → default 'US'.
   * @returns {Promise<string>} ISO country code (e.g. 'US', 'IN')
   */
  async function detectCountry() {
    // 1. Check cache
    const cached = _getCached();
    if (cached) return cached;

    // 2. Call ipapi.co (no key required)
    try {
      const res = await fetch(CONFIG.IPAPI_URL, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const code = (data.country_code || 'US').toUpperCase();
        _setCache(code);
        return code;
      }
    } catch (err) {
      console.warn('Location detection failed, defaulting to US:', err.message);
    }

    return 'US';
  }

  /**
   * Map a country code to the best matching market key in CONFIG.MARKETS.
   * @param {string} countryCode
   * @returns {string} Market key (e.g. 'US', 'IN', 'GB')
   */
  function getMarketKey(countryCode) {
    return CONFIG.COUNTRY_TO_MARKET[countryCode] || 'US';
  }

  /**
   * Get the full market config for a country code.
   * @param {string} countryCode
   * @returns {object} Market config from CONFIG.MARKETS
   */
  function getMarketConfig(countryCode) {
    const key = getMarketKey(countryCode);
    return CONFIG.MARKETS[key];
  }

  /**
   * Check if a market is currently open based on its timezone and hours.
   * @param {object} market - Market config object
   * @returns {{ isOpen: boolean, label: string, nextEvent: string }}
   */
  function getMarketStatus(market) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: market.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === 'hour').value);
    const minute = parseInt(parts.find((p) => p.type === 'minute').value);
    const currentDecimal = hour + minute / 60;

    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: market.timezone,
      weekday: 'short',
    });
    const day = dayFormatter.format(now);
    const isWeekday = !['Sat', 'Sun'].includes(day);

    const isOpen =
      isWeekday &&
      currentDecimal >= market.marketHours.open &&
      currentDecimal < market.marketHours.close;

    const openH = Math.floor(market.marketHours.open);
    const openM = Math.round((market.marketHours.open % 1) * 60);
    const closeH = Math.floor(market.marketHours.close);
    const closeM = Math.round((market.marketHours.close % 1) * 60);
    const pad = (n) => String(n).padStart(2, '0');

    let label, nextEvent;
    if (isOpen) {
      label = 'Market Open';
      nextEvent = `Closes at ${pad(closeH)}:${pad(closeM)}`;
    } else {
      label = 'Market Closed';
      nextEvent = `Opens at ${pad(openH)}:${pad(openM)}`;
    }

    return { isOpen, label, nextEvent };
  }

  /**
   * Get all available market keys for the market selector dropdown.
   * @returns {Array<{ key: string, name: string, flag: string }>}
   */
  function getAvailableMarkets() {
    return Object.entries(CONFIG.MARKETS).map(([key, m]) => ({
      key,
      name: m.name,
      flag: m.flag,
    }));
  }

  // ── Private helpers ──────────────────────────────────────────

  function _getCached() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const { code, ts } = JSON.parse(raw);
      if (Date.now() - ts > STORAGE_TTL) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return code;
    } catch {
      return null;
    }
  }

  function _setCache(code) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, ts: Date.now() }));
  }

  return {
    detectCountry,
    getMarketKey,
    getMarketConfig,
    getMarketStatus,
    getAvailableMarkets,
  };
})();
