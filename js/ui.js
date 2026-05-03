/**
 * StockPulse — UI Rendering Engine
 * All DOM manipulation, component rendering, and animations.
 */
const UI = (() => {
  // ── Selectors ────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── Watchlist (localStorage) ─────────────────────────────────
  const WL_KEY = 'stockpulse_watchlist';
  function _getWatchlist() {
    try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); } catch { return []; }
  }
  function _saveWatchlist(list) { localStorage.setItem(WL_KEY, JSON.stringify(list)); }
  function toggleWatchlist(symbol) {
    const wl = _getWatchlist();
    const idx = wl.indexOf(symbol);
    if (idx >= 0) wl.splice(idx, 1); else wl.push(symbol);
    _saveWatchlist(wl);
    return wl.includes(symbol);
  }
  function isWatched(symbol) { return _getWatchlist().includes(symbol); }

  // ── Formatting Helpers ───────────────────────────────────────
  function fmtPrice(val, currency, locale) {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency: currency === '₹' ? 'INR' : currency === '£' ? 'GBP' : 'USD',
      minimumFractionDigits: 2
    }).format(val);
  }
  function fmtPct(val) {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  }
  function changeClass(val) { return val >= 0 ? 'positive' : 'negative'; }

  // ── API Key Modal ────────────────────────────────────────────
  function showApiKeyModal(onSubmit) {
    const modal = $('#api-key-modal');
    modal.classList.add('visible');
    const form = $('#api-key-form');
    const input = $('#api-key-input');
    const errEl = $('#api-key-error');
    const btn = $('#api-key-submit');

    form.onsubmit = async (e) => {
      e.preventDefault();
      const key = input.value.trim();
      if (!key) { errEl.textContent = 'Please enter your API key'; return; }
      btn.disabled = true;
      btn.textContent = 'Validating...';
      errEl.textContent = '';
      API.setApiKey(key);
      const valid = await API.testKey();
      if (valid) {
        modal.classList.remove('visible');
        onSubmit();
      } else {
        errEl.textContent = 'Invalid key. Get a free one at finnhub.io';
        btn.disabled = false;
        btn.textContent = 'Connect';
      }
    };
  }
  function hideApiKeyModal() { $('#api-key-modal').classList.remove('visible'); }

  function renderHeader(market, countryCode, marketStatus) {
    $('#location-flag').textContent = market.flag;
    $('#location-name').textContent = `${market.name} · ${market.exchangeLabel}`;
    const dot = $('#market-status-dot');
    const label = $('#market-status-label');
    dot.className = 'status-dot ' + (marketStatus.isOpen ? 'open' : 'closed');
    label.textContent = marketStatus.label;
    $('#market-status-next').textContent = marketStatus.nextEvent;

    // Populate market selector
    const sel = $('#market-selector');
    sel.innerHTML = '';
    Location.getAvailableMarkets().forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.key;
      opt.textContent = `${m.flag} ${m.name}`;
      if (m.key === Location.getMarketKey(countryCode)) opt.selected = true;
      sel.appendChild(opt);
    });

    // Show data note banner if market has one
    const banner = $('#data-note-banner');
    if (market.dataNote) {
      banner.textContent = 'ℹ️ ' + market.dataNote;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  // ── Loading State ────────────────────────────────────────────
  function showLoading() {
    $('#loading-screen').classList.add('visible');
    $('#main-content').classList.remove('visible');
  }
  function hideLoading() {
    $('#loading-screen').classList.remove('visible');
    $('#main-content').classList.add('visible');
  }

  // ── Market Overview ──────────────────────────────────────────
  function renderMarketOverview(scoredStocks, market) {
    if (!scoredStocks.length) return;
    // Compute aggregate stats
    const avgChange = scoredStocks.reduce((s, st) => s + st._dp, 0) / scoredStocks.length;
    const gainers = scoredStocks.filter((s) => s._dp > 0).length;
    const losers = scoredStocks.filter((s) => s._dp < 0).length;
    const avgScore = Math.round(scoredStocks.reduce((s, st) => s + st.score, 0) / scoredStocks.length);

    // Sentiment
    let mood, moodIcon, moodClass;
    if (avgChange > 0.5) { mood = 'Bullish'; moodIcon = '📈'; moodClass = 'bullish'; }
    else if (avgChange < -0.5) { mood = 'Bearish'; moodIcon = '📉'; moodClass = 'bearish'; }
    else { mood = 'Neutral'; moodIcon = '📊'; moodClass = 'neutral'; }

    $('#overview-avg-change').textContent = fmtPct(avgChange);
    $('#overview-avg-change').className = 'stat-value ' + changeClass(avgChange);
    $('#overview-gainers').textContent = gainers;
    $('#overview-losers').textContent = losers;
    $('#overview-avg-score').textContent = avgScore;
    $('#sentiment-icon').textContent = moodIcon;
    $('#sentiment-label').textContent = mood;
    $('#sentiment-label').className = 'sentiment-label ' + moodClass;

    // Sentiment bar
    const pct = Math.round((gainers / scoredStocks.length) * 100);
    $('#sentiment-bar-fill').style.width = pct + '%';
    $('#sentiment-bar-fill').className = 'bar-fill ' + moodClass;
    $('#sentiment-ratio').textContent = `${pct}% positive`;
  }

  // ── Sector Heatmap ───────────────────────────────────────────
  function renderSectorHeatmap(scoredStocks) {
    const grid = $('#sector-grid');
    grid.innerHTML = '';
    const sectors = {};
    scoredStocks.forEach((s) => {
      if (!sectors[s.sector]) sectors[s.sector] = { sum: 0, n: 0 };
      sectors[s.sector].sum += s._dp;
      sectors[s.sector].n++;
    });

    CONFIG.SECTORS.forEach((sec) => {
      const data = sectors[sec];
      if (!data) return;
      const avg = data.sum / data.n;
      const card = document.createElement('div');
      card.className = 'sector-card ' + changeClass(avg);
      card.innerHTML = `
        <span class="sector-icon">${CONFIG.SECTOR_ICONS[sec] || '📦'}</span>
        <span class="sector-name">${sec}</span>
        <span class="sector-change ${changeClass(avg)}">${fmtPct(avg)}</span>
      `;
      grid.appendChild(card);
    });
  }

  // ── Helpers ──────────────────────────────────────────────────
  function _generateSparkline(data, colorClass) {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 100;
    const height = 30;
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' L ');

    return `
      <svg class="sparkline ${colorClass}" viewBox="-2 -2 104 34" preserveAspectRatio="none">
        <path d="M ${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  // ── Top Picks (Hero Cards) ───────────────────────────────────
  function renderTopPicks(scoredStocks, market) {
    const container = $('#picks-grid');
    container.innerHTML = '';
    const top = scoredStocks.slice(0, 5);

    top.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'pick-card';
      card.style.animationDelay = `${i * 0.1}s`;
      const watched = isWatched(s.symbol);
      
      // Determine overall trend color for the sparkline
      let sparkColor = 'neutral';
      if (s.sparklineData && s.sparklineData.length) {
        const start = s.sparklineData[0];
        const end = s.sparklineData[s.sparklineData.length - 1];
        if (end > start) sparkColor = 'positive';
        else if (end < start) sparkColor = 'negative';
      }

      card.innerHTML = `
        <div class="pick-header">
          <div class="pick-info">
            <div class="pick-symbol-row">
              <span class="pick-rank">#${i + 1}</span>
              <h3 class="pick-symbol">${s.symbol}</h3>
            </div>
            <p class="pick-name">${s.name}</p>
          </div>
          <button class="watchlist-btn ${watched ? 'active' : ''}" data-symbol="${s.symbol}" title="Add to watchlist">
            ${watched ? '★' : '☆'}
          </button>
        </div>
        <div class="pick-price-row">
          <span class="pick-price">${fmtPrice(s.quote.c, market.currency, market.currencyLocale)}</span>
          <span class="pick-change ${changeClass(s._dp)}">${fmtPct(s._dp)}</span>
        </div>
        <div class="pick-sparkline-wrap">
          ${_generateSparkline(s.sparklineData, sparkColor)}
        </div>
        <div class="pick-score-row">
          <div class="score-ring" data-score="${s.score}">
            <svg viewBox="0 0 36 36" class="score-svg">
              <path class="score-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="score-fg ${s.signal}" stroke-dasharray="${s.score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            </svg>
            <span class="score-text">${s.score}</span>
          </div>
          <span class="signal-badge ${s.signal}">${s.signalLabel}</span>
        </div>
        <p class="pick-reason">${s.reason}</p>
      `;
      container.appendChild(card);
    });

    // Watchlist button listeners
    container.querySelectorAll('.watchlist-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sym = btn.dataset.symbol;
        const now = toggleWatchlist(sym);
        btn.classList.toggle('active', now);
        btn.textContent = now ? '★' : '☆';
        // Re-render watchlist section
        document.dispatchEvent(new CustomEvent('watchlist-changed'));
      });
    });
  }

  // ── Full Rankings Table ──────────────────────────────────────
  let _sortCol = 'score';
  let _sortDesc = true;
  let _lastStocks = [];
  let _lastMarket = null;

  function renderRankingsTable(scoredStocks, market) {
    if (scoredStocks) _lastStocks = scoredStocks;
    if (market) _lastMarket = market;
    const stocks = scoredStocks || _lastStocks;
    const m = market || _lastMarket;

    const tbody = $('#rankings-tbody');
    tbody.innerHTML = '';
    const sectorFilter = $('#sector-filter');

    // Attach header listeners once
    const headers = $$('th.sortable');
    if (headers.length && !headers[0].dataset.bound) {
      headers.forEach(th => {
        th.dataset.bound = 'true';
        th.addEventListener('click', () => {
          const col = th.dataset.sort;
          if (_sortCol === col) {
            _sortDesc = !_sortDesc;
          } else {
            _sortCol = col;
            _sortDesc = (col === 'score' || col === 'change' || col === 'price'); // defaults
          }
          // Update classes
          headers.forEach(h => h.classList.remove('asc', 'desc'));
          th.classList.add(_sortDesc ? 'desc' : 'asc');
          renderRankingsTable(); // re-render
        });
      });
    }

    // Populate filter
    if (sectorFilter.children.length <= 1) {
      CONFIG.SECTORS.forEach((sec) => {
        const opt = document.createElement('option');
        opt.value = sec;
        opt.textContent = sec;
        sectorFilter.appendChild(opt);
      });
    }

    const filter = sectorFilter.value;
    let filtered = filter ? stocks.filter((s) => s.sector === filter) : [...stocks];

    // Apply sorting
    filtered.sort((a, b) => {
      let valA, valB;
      switch (_sortCol) {
        case 'rank': valA = stocks.indexOf(a); valB = stocks.indexOf(b); break;
        case 'symbol': valA = a.symbol; valB = b.symbol; break;
        case 'sector': valA = a.sector; valB = b.sector; break;
        case 'price': valA = a.quote.c; valB = b.quote.c; break;
        case 'change': valA = a._dp; valB = b._dp; break;
        case 'score': valA = a.score; valB = b.score; break;
        default: valA = a.score; valB = b.score;
      }
      if (valA < valB) return _sortDesc ? 1 : -1;
      if (valA > valB) return _sortDesc ? -1 : 1;
      return 0;
    });

    filtered.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.className = 'rank-row';
      tr.style.animationDelay = `${i * 0.03}s`;
      const watched = isWatched(s.symbol);
      tr.innerHTML = `
        <td class="rank-num">${i + 1}</td>
        <td>
          <div class="rank-stock">
            <span class="rank-symbol">${s.symbol}</span>
            <span class="rank-name">${s.name}</span>
          </div>
        </td>
        <td class="rank-sector">${s.sector}</td>
        <td class="rank-price">${fmtPrice(s.quote.c, m.currency, m.currencyLocale)}</td>
        <td class="rank-change ${changeClass(s._dp)}">${fmtPct(s._dp)}</td>
        <td class="rank-score"><span class="mini-score ${s.signal}">${s.score}</span></td>
        <td class="rank-signal"><span class="signal-badge small ${s.signal}">${s.signalLabel}</span></td>
        <td class="rank-action">
          <button class="watchlist-btn-sm ${watched ? 'active' : ''}" data-symbol="${s.symbol}" title="Add to watchlist">${watched ? '★' : '☆'}</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.watchlist-btn-sm').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sym = btn.dataset.symbol;
        const now = toggleWatchlist(sym);
        btn.classList.toggle('active', now);
        btn.textContent = now ? '★' : '☆';
        document.dispatchEvent(new CustomEvent('watchlist-changed'));
      });
    });
  }

  // ── Watchlist Section ────────────────────────────────────────
  function renderWatchlist(scoredStocks, market) {
    const container = $('#watchlist-items');
    const emptyMsg = $('#watchlist-empty');
    const wl = _getWatchlist();
    container.innerHTML = '';

    if (wl.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    wl.forEach((sym) => {
      const s = scoredStocks.find((st) => st.symbol === sym);
      if (!s) return;
      const chip = document.createElement('div');
      chip.className = 'watchlist-chip';
      chip.innerHTML = `
        <span class="wl-symbol">${s.symbol}</span>
        <span class="wl-price">${fmtPrice(s.quote.c, market.currency, market.currencyLocale)}</span>
        <span class="wl-change ${changeClass(s._dp)}">${fmtPct(s._dp)}</span>
        <button class="wl-remove" data-symbol="${sym}">✕</button>
      `;
      container.appendChild(chip);
    });

    container.querySelectorAll('.wl-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggleWatchlist(btn.dataset.symbol);
        document.dispatchEvent(new CustomEvent('watchlist-changed'));
      });
    });
  }

  // ── Error Display ────────────────────────────────────────────
  function showError(msg) {
    const el = $('#error-banner');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 8000);
  }

  // ── Last Updated ─────────────────────────────────────────────
  function renderTimestamp() {
    $('#last-updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  }

  return {
    showApiKeyModal, hideApiKeyModal, renderHeader, showLoading, hideLoading,
    renderMarketOverview, renderSectorHeatmap, renderTopPicks, renderRankingsTable,
    renderWatchlist, showError, renderTimestamp, toggleWatchlist, isWatched
  };
})();
