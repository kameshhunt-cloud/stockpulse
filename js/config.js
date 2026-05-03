/**
 * StockPulse Configuration
 * Market mappings, curated stock lists, and scoring parameters.
 */

const CONFIG = {
  // ── API Endpoints ──────────────────────────────────────────────
  FINNHUB_BASE: 'https://finnhub.io/api/v1',
  IPAPI_URL: 'https://ipapi.co/json/',

  // ── Rate Limiting ─────────────────────────────────────────────
  BATCH_SIZE: 12,            // Parallel requests per batch
  BATCH_DELAY_MS: 1200,      // Delay between batches (ms)
  CACHE_TTL_MS: 5 * 60 * 1000,  // 5 minute cache

  // ── Scoring Weights (must sum to 1.0) ─────────────────────────
  SCORING: {
    trend50Day:     0.25,   // Price vs 50-Day Simple Moving Average
    momentum:       0.20,   // Daily price change %
    intradayPos:    0.15,   // Position within day's high-low range
    sectorStrength: 0.15,   // Sector's average performance
    stability:      0.15,   // Market cap tier bonus
    gapSignal:      0.10,   // Open vs previous close gap
  },

  // ── Signal Thresholds ─────────────────────────────────────────
  SIGNALS: {
    STRONG_BUY:  75,
    WATCH:       55,
    // Below WATCH = "Stable Pick"
  },

  // ── Market Definitions ────────────────────────────────────────
  MARKETS: {

    // ─── United States ───────────────────────────────────────────
    US: {
      name: 'United States',
      flag: '🇺🇸',
      currency: '$',
      currencyLocale: 'en-US',
      exchangeLabel: 'NYSE / NASDAQ',
      timezone: 'America/New_York',
      marketHours: { open: 9.5, close: 16 }, // 9:30 AM – 4:00 PM ET
      stocks: [
        // ── Technology ──
        { symbol: 'AAPL',  name: 'Apple Inc.',           sector: 'Technology',         capTier: 'mega'  },
        { symbol: 'MSFT',  name: 'Microsoft Corp.',      sector: 'Technology',         capTier: 'mega'  },
        { symbol: 'GOOGL', name: 'Alphabet Inc.',        sector: 'Technology',         capTier: 'mega'  },
        { symbol: 'AMZN',  name: 'Amazon.com Inc.',      sector: 'Technology',         capTier: 'mega'  },
        { symbol: 'NVDA',  name: 'NVIDIA Corp.',         sector: 'Technology',         capTier: 'mega'  },
        { symbol: 'META',  name: 'Meta Platforms',       sector: 'Technology',         capTier: 'mega'  },
        { symbol: 'TSLA',  name: 'Tesla Inc.',           sector: 'Technology',         capTier: 'mega'  },
        { symbol: 'AMD',   name: 'Advanced Micro Devices', sector: 'Technology',       capTier: 'large' },
        { symbol: 'CRM',   name: 'Salesforce Inc.',      sector: 'Technology',         capTier: 'large' },
        { symbol: 'INTC',  name: 'Intel Corp.',          sector: 'Technology',         capTier: 'large' },
        // ── Financials ──
        { symbol: 'JPM',   name: 'JPMorgan Chase',       sector: 'Financials',        capTier: 'mega'  },
        { symbol: 'BAC',   name: 'Bank of America',      sector: 'Financials',        capTier: 'mega'  },
        { symbol: 'GS',    name: 'Goldman Sachs',        sector: 'Financials',        capTier: 'large' },
        { symbol: 'V',     name: 'Visa Inc.',            sector: 'Financials',        capTier: 'mega'  },
        { symbol: 'MA',    name: 'Mastercard Inc.',      sector: 'Financials',        capTier: 'mega'  },
        // ── Healthcare ──
        { symbol: 'JNJ',   name: 'Johnson & Johnson',    sector: 'Healthcare',        capTier: 'mega'  },
        { symbol: 'UNH',   name: 'UnitedHealth Group',   sector: 'Healthcare',        capTier: 'mega'  },
        { symbol: 'PFE',   name: 'Pfizer Inc.',          sector: 'Healthcare',        capTier: 'large' },
        { symbol: 'ABBV',  name: 'AbbVie Inc.',          sector: 'Healthcare',        capTier: 'large' },
        { symbol: 'MRK',   name: 'Merck & Co.',          sector: 'Healthcare',        capTier: 'mega'  },
        // ── Energy ──
        { symbol: 'XOM',   name: 'Exxon Mobil',          sector: 'Energy',            capTier: 'mega'  },
        { symbol: 'CVX',   name: 'Chevron Corp.',        sector: 'Energy',            capTier: 'mega'  },
        { symbol: 'COP',   name: 'ConocoPhillips',       sector: 'Energy',            capTier: 'large' },
        // ── Consumer ──
        { symbol: 'WMT',   name: 'Walmart Inc.',         sector: 'Consumer',          capTier: 'mega'  },
        { symbol: 'KO',    name: 'Coca-Cola Co.',        sector: 'Consumer',          capTier: 'mega'  },
        { symbol: 'PEP',   name: 'PepsiCo Inc.',         sector: 'Consumer',          capTier: 'mega'  },
        { symbol: 'MCD',   name: "McDonald's Corp.",     sector: 'Consumer',          capTier: 'mega'  },
        { symbol: 'NKE',   name: 'Nike Inc.',            sector: 'Consumer',          capTier: 'large' },
        // ── Industrials ──
        { symbol: 'CAT',   name: 'Caterpillar Inc.',     sector: 'Industrials',       capTier: 'large' },
        { symbol: 'BA',    name: 'Boeing Co.',           sector: 'Industrials',       capTier: 'large' },
        { symbol: 'HON',   name: 'Honeywell Intl.',      sector: 'Industrials',       capTier: 'large' },
      ],
    },

    // ─── India (US-listed ADRs + India ETFs) ─────────────────────
    // Finnhub free tier only supports US-listed tickers.
    // These are Indian companies traded on NYSE/NASDAQ + India-focused ETFs.
    IN: {
      name: 'India',
      flag: '🇮🇳',
      currency: '₹',
      currencyLocale: 'en-IN',
      targetCurrency: 'INR',
      exchangeLabel: 'US-listed ADRs',
      dataNote: 'Showing Indian companies via US ADRs & India ETFs. Prices converted to INR.',
      timezone: 'Asia/Kolkata',
      marketHours: { open: 9.25, close: 15.5 }, // IST (ADRs trade US hours)
      stocks: [
        // ── Technology (ADRs) ──
        { symbol: 'INFY',  name: 'Infosys Ltd.',          sector: 'Technology',   capTier: 'mega'  },
        { symbol: 'WIT',   name: 'Wipro Ltd.',            sector: 'Technology',   capTier: 'large' },
        { symbol: 'WNS',   name: 'WNS Holdings',          sector: 'Technology',   capTier: 'large' },
        { symbol: 'MMYT',  name: 'MakeMyTrip Ltd.',       sector: 'Technology',   capTier: 'large' },
        // ── Financials (ADRs) ──
        { symbol: 'HDB',   name: 'HDFC Bank',             sector: 'Financials',   capTier: 'mega'  },
        { symbol: 'IBN',   name: 'ICICI Bank',            sector: 'Financials',   capTier: 'mega'  },
        // ── Industrials (ADRs) ──
        { symbol: 'TTM',   name: 'Tata Motors',           sector: 'Industrials',  capTier: 'large' },
        { symbol: 'VEDL',  name: 'Vedanta Ltd.',          sector: 'Industrials',  capTier: 'large' },
        // ── Healthcare (ADRs) ──
        { symbol: 'RDY',   name: "Dr. Reddy's Labs",      sector: 'Healthcare',   capTier: 'large' },
        // ── India ETFs (broad market exposure) ──
        { symbol: 'INDA',  name: 'iShares MSCI India',    sector: 'Financials',   capTier: 'mega'  },
        { symbol: 'EPI',   name: 'WisdomTree India Earn.', sector: 'Financials',  capTier: 'large' },
        { symbol: 'SMIN',  name: 'iShares India SmallCap', sector: 'Industrials', capTier: 'large' },
        { symbol: 'INCO',  name: 'Columbia India Consumer', sector: 'Consumer',   capTier: 'large' },
      ],
    },

    // ─── United Kingdom (US-listed ADRs + UK ETFs) ───────────────
    GB: {
      name: 'United Kingdom',
      flag: '🇬🇧',
      currency: '£',
      currencyLocale: 'en-GB',
      targetCurrency: 'GBP',
      exchangeLabel: 'US-listed ADRs',
      dataNote: 'Showing UK companies via US ADRs. Prices converted to GBP.',
      timezone: 'Europe/London',
      marketHours: { open: 8, close: 16.5 },
      stocks: [
        { symbol: 'SHEL',  name: 'Shell PLC',             sector: 'Energy',       capTier: 'mega'  },
        { symbol: 'AZN',   name: 'AstraZeneca',           sector: 'Healthcare',   capTier: 'mega'  },
        { symbol: 'HSBC',  name: 'HSBC Holdings',         sector: 'Financials',   capTier: 'mega'  },
        { symbol: 'UL',    name: 'Unilever',              sector: 'Consumer',     capTier: 'mega'  },
        { symbol: 'BP',    name: 'BP PLC',                sector: 'Energy',       capTier: 'mega'  },
        { symbol: 'GSK',   name: 'GSK PLC',               sector: 'Healthcare',   capTier: 'mega'  },
        { symbol: 'RIO',   name: 'Rio Tinto',             sector: 'Industrials',  capTier: 'large' },
        { symbol: 'DEO',   name: 'Diageo',                sector: 'Consumer',     capTier: 'large' },
        { symbol: 'BCS',   name: 'Barclays',              sector: 'Financials',   capTier: 'large' },
        { symbol: 'EWU',   name: 'iShares MSCI UK ETF',   sector: 'Financials',   capTier: 'large' },
      ],
    },
  },

  // ── Country code → Market key fallback mapping ────────────────
  COUNTRY_TO_MARKET: {
    US: 'US', CA: 'US',                      // North America → US market
    IN: 'IN', LK: 'IN', NP: 'IN', BD: 'IN', // South Asia → India market
    GB: 'GB', IE: 'GB',                      // British Isles → UK market
    // Everything else defaults to US
  },

  // ── Sector display config ─────────────────────────────────────
  SECTORS: ['Technology', 'Financials', 'Healthcare', 'Energy', 'Consumer', 'Industrials'],

  SECTOR_ICONS: {
    Technology:  '💻',
    Financials:  '🏦',
    Healthcare:  '🏥',
    Energy:      '⚡',
    Consumer:    '🛒',
    Industrials: '🏗️',
  },
};
