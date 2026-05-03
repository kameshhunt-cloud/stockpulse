/**
 * StockPulse — Stock Scoring Engine
 * Computes a composite 0-100 score for each stock.
 */
const Scoring = (() => {
  function scoreAll(stockList, quotesMap, candlesMap = new Map()) {
    const enriched = stockList
      .filter((s) => quotesMap.has(s.symbol))
      .map((s) => {
        const q = quotesMap.get(s.symbol);
        const candleData = candlesMap.get(s.symbol);
        let sma50 = null;
        let trendScore = 50;
        let sparkline = [];

        if (candleData && candleData.c && candleData.c.length > 0) {
          const closes = candleData.c;
          // Calculate SMA50 if we have enough data, else average what we have
          const period = Math.min(50, closes.length);
          const recent = closes.slice(-period);
          sma50 = recent.reduce((sum, p) => sum + p, 0) / period;
          
          // Trend Score logic:
          // If current price is significantly above SMA50, it's a strong trend (up to 100)
          // If below, it's a weak trend (down to 0)
          const pctDiff = (q.c - sma50) / sma50;
          trendScore = _normTrend(pctDiff);

          // Prepare sparkline data (last 21 trading days ~ 1 month)
          sparkline = closes.slice(-21);
        }

        return { 
          ...s, 
          quote: q, 
          _dp: q.dp || 0, 
          _intradayPos: _iPos(q), 
          _gapPct: _gapPct(q),
          _sma50: sma50,
          _trendScore: trendScore,
          sparklineData: sparkline
        };
      });

    if (!enriched.length) return [];
    const sAvg = _sectorAvg(enriched);
    const W = CONFIG.SCORING;
    
    enriched.forEach((s) => {
      s.score = Math.round(
        W.trend50Day * s._trendScore +
        W.momentum * _normMom(s._dp) +
        W.intradayPos * s._intradayPos * 100 +
        W.sectorStrength * _secScore(s, sAvg) +
        W.stability * _capScore(s.capTier) +
        W.gapSignal * _normGap(s._gapPct)
      );
      s.score = Math.max(0, Math.min(100, s.score));
      if (s.score >= CONFIG.SIGNALS.STRONG_BUY) { s.signal = 'strong-buy'; s.signalLabel = 'Strong Buy'; }
      else if (s.score >= CONFIG.SIGNALS.WATCH) { s.signal = 'watch'; s.signalLabel = 'Watch'; }
      else { s.signal = 'stable'; s.signalLabel = 'Stable Pick'; }
      s.reason = _reason(s, sAvg);
    });
    enriched.sort((a, b) => b.score - a.score);
    return enriched;
  }

  function _iPos(q) { const r = q.h - q.l; return r <= 0 ? 0.5 : (q.c - q.l) / r; }
  function _gapPct(q) { return q.pc ? ((q.o - q.pc) / q.pc) * 100 : 0; }

  function _normMom(dp) {
    if (dp >= 1 && dp <= 3) return 90 + (dp - 1) * 5;
    if (dp > 3 && dp <= 5) return 90 - (dp - 3) * 10;
    if (dp > 5) return Math.max(30, 70 - (dp - 5) * 10);
    if (dp >= 0) return 60 + dp * 30;
    if (dp >= -1) return 50 + dp * 10;
    if (dp >= -3) return 40 + (dp + 1) * 10;
    return Math.max(5, 20 + dp * 3);
  }

  function _normTrend(pctDiff) {
    if (pctDiff > 0.1) return 100;       // >10% above 50-day SMA is max score
    if (pctDiff > 0) return 60 + pctDiff * 400; // 0% to 10% -> 60 to 100
    if (pctDiff > -0.05) return 40 + (pctDiff + 0.05) * 400; // -5% to 0% -> 40 to 60
    return Math.max(0, 40 + pctDiff * 400); // Below -5%, drop towards 0
  }

  function _sectorAvg(stocks) {
    const m = {};
    stocks.forEach((s) => { if (!m[s.sector]) m[s.sector] = { sum: 0, n: 0 }; m[s.sector].sum += s._dp; m[s.sector].n++; });
    const a = {};
    Object.entries(m).forEach(([k, v]) => { a[k] = v.n ? v.sum / v.n : 0; });
    return a;
  }

  function _secScore(s, avg) {
    const a = avg[s.sector] || 0;
    const base = _normMom(a);
    const bonus = Math.max(-20, Math.min(20, (s._dp - a) * 10));
    return Math.max(0, Math.min(100, base + bonus));
  }

  function _capScore(t) { return t === 'mega' ? 90 : t === 'large' ? 70 : 50; }

  function _normGap(g) {
    if (g >= 0.5 && g <= 2) return 85 + g * 5;
    if (g > 2 && g <= 4) return 80;
    if (g > 4) return 60;
    if (g >= 0) return 60 + g * 40;
    if (g >= -1) return 50 + g * 10;
    return Math.max(10, 40 + g * 5);
  }

  function _reason(s, sAvg) {
    const p = [], dp = s._dp, a = sAvg[s.sector] || 0;
    
    if (s._trendScore > 80) p.push('Strong 50-day uptrend');
    else if (s._trendScore < 30) p.push('Trading below 50-day average');

    if (dp >= 2) p.push('Strong upward momentum');
    else if (dp >= 0.5) p.push('Positive movement');
    else if (dp <= -2) p.push('Significant dip — potential entry');
    else if (dp < 0) p.push('Slight pullback');
    if (a > 0.5 && dp > a) p.push(`outperforming ${s.sector}`);
    else if (a > 0.5) p.push(`${s.sector} trending up`);
    else if (a < -0.5) p.push(`${s.sector} under pressure`);
    if (s.capTier === 'mega') p.push('blue-chip stability');
    if (s._intradayPos > 0.8) p.push("near day's high");
    else if (s._intradayPos < 0.2) p.push("near day's low");
    if (!p.length) p.push('Balanced profile');
    const r = p.join(' · ');
    return r.charAt(0).toUpperCase() + r.slice(1);
  }

  return { scoreAll };
})();
