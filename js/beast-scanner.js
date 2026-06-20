'use strict';

/* ===================================================
   TRADOCTORY — NIFTY BEAST AI SCANNER PAGE CONTROLLER
   (beast-scanner.js)
   =================================================== */

import { guardRoute, signOutAndRedirect } from './route-guard.js';
import { MultiSymbolScanner } from './scanner/multi-symbol-scanner.js';
import { ChartWidgetProvider } from './scanner/chart-widget-provider.js';
import { PRIMARY_CHART_ASSETS } from './scanner/symbol-database.js';
import { getMarketMoodEmoji } from './scanner/market-regime-engine.js';
import { getTierForScore } from './scanner/scoring-engine.js';

/* ── Auth guard ───────────────────────────────────── */
const user = guardRoute('login.html');
if (!user) throw new Error('Unauthenticated.');

/* ── User UI ──────────────────────────────────────── */
const nameEl    = document.getElementById('userDisplayName');
const planEl    = document.getElementById('userDisplayPlan');
const avatarEl  = document.getElementById('userAvatarInitial');
if (nameEl)   nameEl.textContent   = user.name ?? user.email;
if (planEl)   planEl.textContent   = user.plan === 'free' ? 'Free plan' : 'Pro plan';
if (avatarEl) avatarEl.textContent = (user.name ?? user.email).charAt(0).toUpperCase();

document.getElementById('signOutBtn')?.addEventListener('click', () => signOutAndRedirect('index.html'));
document.getElementById('menuToggle')?.addEventListener('click', () =>
  document.getElementById('sidebar')?.classList.toggle('open')
);

/* ── Engine instances ─────────────────────────────── */
const scanner      = new MultiSymbolScanner({ fetchImpl: globalThis.fetch?.bind(globalThis) });
const chartProvider = new ChartWidgetProvider({ chartGlobal: window.Chart });

/* ── State ────────────────────────────────────────── */
let currentResult   = null;
let currentFilter   = 'top10';
let selectedSetup   = null;
let currentInterval = '15m';

/* ── Utility ──────────────────────────────────────── */
function esc(v) {
  const el = document.createElement('span');
  el.textContent = String(v ?? '');
  return el.innerHTML;
}
function px(v, dec = 2) { return Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: dec }); }
function fmtTime(iso) {
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso || Date.now()));
}
function getFactorLabel(score) {
  if (score >= 70) return 'high';
  if (score >= 45) return 'mid';
  return 'low';
}
function formatFactorKey(key) {
  const MAP = { trend:'Trend', volume:'Volume', momentum:'Momentum', breakout:'Breakout',
    relativeStrength:'Rel. Strength', riskReward:'Risk/Reward', marketAlignment:'Mkt Align',
    sectorStrength:'Sector', mtfAlignment:'MTF' };
  return MAP[key] || key;
}

/* ══════════════════════════════════════════════════
   MOOD BAR
══════════════════════════════════════════════════ */
function renderMoodBar(result) {
  const { regime, sectorRanking, niftySnapshot, totalScanned, acceptedCount, sTierCount, aTierCount, bTierCount, isLiveData, isoTime } = result;

  /* Regime */
  const regimeEmoji = document.getElementById('regimeEmoji');
  const regimeLabel = document.getElementById('regimeLabel');
  const regimeDesc  = document.getElementById('regimeDesc');
  if (regimeEmoji) regimeEmoji.textContent = getMarketMoodEmoji(regime?.mood || 'Neutral');
  if (regimeLabel) regimeLabel.textContent = regime?.label || 'Unknown';
  if (regimeDesc)  regimeDesc.textContent  = regime?.tradingBias || '—';

  const moodCards = document.querySelectorAll('.mood-card');
  if (moodCards[0]) moodCards[0].style.setProperty('--mood-color', regime?.color || '#8090a8');

  /* Mood */
  const moodEmoji = document.getElementById('moodEmoji');
  const moodLabel = document.getElementById('moodLabel');
  const moodBias  = document.getElementById('moodBias');
  const mood = regime?.mood || 'Neutral';
  if (moodEmoji) moodEmoji.textContent = getMarketMoodEmoji(mood);
  if (moodLabel) moodLabel.textContent = mood;
  if (moodBias)  moodBias.textContent  = `Direction: ${regime?.direction || '—'}`;
  if (moodCards[1]) moodCards[1].style.setProperty('--mood-color', regime?.color || '#8090a8');

  /* Nifty price */
  const niftyChg  = Number(niftySnapshot?.changePercent || 0);
  const priceDisp = document.getElementById('niftyPriceDisplay');
  const changeSub = document.getElementById('niftyChangeSub');
  if (priceDisp) {
    priceDisp.innerHTML = `<span style="color:${niftyChg >= 0 ? 'var(--accent)' : 'var(--red)'};">
      ${px(niftySnapshot?.price, 0)}
    </span>`;
  }
  if (changeSub) {
    changeSub.innerHTML = `<span style="color:${niftyChg >= 0 ? 'var(--accent)' : 'var(--red)'};">
      ${niftyChg >= 0 ? '+' : ''}${niftyChg.toFixed(2)}%
    </span>`;
  }
  if (moodCards[2]) moodCards[2].style.setProperty('--mood-color', niftyChg >= 0 ? 'var(--accent)' : 'var(--red)');

  /* Strongest sector */
  const strongestEl = document.getElementById('strongestSector');
  const weakestEl   = document.getElementById('weakestSector');
  const s = sectorRanking?.strongest;
  const w = sectorRanking?.weakest;
  if (strongestEl && s) strongestEl.innerHTML = `${s.icon} ${esc(s.label)} <span style="color:var(--accent);font-size:13px;">${s.score}</span>`;
  if (weakestEl && w)   weakestEl.textContent  = `Weakest: ${w.icon} ${w.label} (${w.score})`;
  if (moodCards[3]) moodCards[3].style.setProperty('--mood-color', s?.color || '#8090a8');

  /* Scan summary */
  const summaryVal = document.getElementById('scanSummaryValue');
  const summarySub = document.getElementById('scanSummarySub');
  if (summaryVal) summaryVal.innerHTML = `<span style="color:var(--s-tier);">🔥${sTierCount}</span>&nbsp;<span style="color:var(--a-tier);">✅${aTierCount}</span>&nbsp;<span style="color:var(--b-tier);">📊${bTierCount}</span>`;
  if (summarySub) summarySub.textContent = `${acceptedCount} of ${totalScanned} assets qualified`;
  if (moodCards[4]) moodCards[4].style.setProperty('--mood-color', sTierCount > 0 ? 'var(--s-tier)' : 'var(--b-tier)');

  /* Data badge */
  const dataBadge = document.getElementById('dataBadge');
  if (dataBadge) {
    dataBadge.textContent = isLiveData ? `Live Data · ${fmtTime(isoTime)}` : `Fallback Model · ${fmtTime(isoTime)}`;
    dataBadge.className = `scanner-data-badge ${isLiveData ? 'live' : 'fallback'}`;
  }

  /* Scan stats row */
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('statScanned',  totalScanned);
  set('statAccepted', acceptedCount);
  set('statSTier',    sTierCount);
  set('statATier',    aTierCount);
  set('statBTier',    bTierCount);
  set('statUpdated',  fmtTime(isoTime));
}

/* ══════════════════════════════════════════════════
   LIVE CHARTS
══════════════════════════════════════════════════ */
function renderCharts(result) {
  const grid = document.getElementById('chartsGrid');
  if (!grid) return;

  grid.innerHTML = PRIMARY_CHART_ASSETS.map(asset => `
    <div class="chart-tile" id="tile_${asset.symbol}">
      <div class="chart-tile-header">
        <div>
          <div class="chart-tile-name">${esc(asset.name)}</div>
          <div class="chart-tile-meta">${esc(asset.category)} · ${esc(currentInterval)}</div>
        </div>
        <div class="chart-tile-price" id="tilePrice_${asset.symbol}">
          <span>—</span>
        </div>
      </div>
      <div class="chart-tile-body" id="chartBody_${asset.symbol}">
        <div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">Loading…</div>
      </div>
    </div>
  `).join('');

  PRIMARY_CHART_ASSETS.forEach(asset => {
    const container = document.getElementById(`chartBody_${asset.symbol}`);
    const priceEl   = document.getElementById(`tilePrice_${asset.symbol}`);

    const scanMatch = result?.top10?.find(s => s.symbol === asset.symbol);
    const niftySnap = result?.niftySnapshot;

    let snapshot = null;
    if (asset.symbol === 'NIFTY' && niftySnap) {
      snapshot = niftySnap;
    } else if (scanMatch?.snapshot) {
      snapshot = scanMatch.snapshot;
    }

    if (snapshot && priceEl) {
      const chg = Number(snapshot.changePercent || 0);
      const col = chg >= 0 ? 'var(--accent)' : 'var(--red)';
      const sign = chg >= 0 ? '+' : '';
      priceEl.innerHTML = `
        <span style="color:${col};">${px(snapshot.price, asset.assetType === 'index' ? 0 : 4)}</span>
        <span class="chart-tile-change ${chg >= 0 ? 'up' : 'down'}">${sign}${chg.toFixed(2)}%</span>`;
    }

    if (container) {
      chartProvider.mountChart(container, asset, snapshot || {}, currentInterval);
    }
  });
}

function updateChartIntervals(interval) {
  currentInterval = interval;
  PRIMARY_CHART_ASSETS.forEach(asset => {
    const container = document.getElementById(`chartBody_${asset.symbol}`);
    if (container) chartProvider.changeInterval(container, asset, interval);
    const metaEl = document.querySelector(`#tile_${asset.symbol} .chart-tile-meta`);
    if (metaEl) metaEl.textContent = `${asset.category} · ${interval}`;
  });
}

/* ── Timeframe tabs ──────────────────────────────── */
document.getElementById('timeframeTabs')?.addEventListener('click', e => {
  const btn = e.target.closest('.tf-tab');
  if (!btn) return;
  document.querySelectorAll('.tf-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  updateChartIntervals(btn.dataset.tf);
});

/* ══════════════════════════════════════════════════
   BEST SETUP CARD
══════════════════════════════════════════════════ */
function renderBestSetupCard(setup) {
  const container = document.getElementById('bestSetupCard');
  if (!container) return;

  if (!setup) {
    container.innerHTML = `
      <div class="best-setup-card no-trade">
        <div class="best-setup-inner">
          <div class="no-trade-state">
            <div class="no-trade-icon">🚫</div>
            <div class="no-trade-title">NO HIGH QUALITY SETUP AVAILABLE</div>
            <div class="no-trade-sub">
              The scanner did not find any setups above the minimum threshold (7.0/10).
              This is the correct response — quality over quantity. Check back later.
            </div>
          </div>
        </div>
      </div>`;
    return;
  }

  const { symbol, name, direction, score, tier, tierLabel, tierColor, tierGlow, tierEmoji,
          entry, stopLoss, target1, target2, rrRatio, confidence } = setup;

  const tierClass = tier === 'R' ? 'no-trade' : `${tier.toLowerCase()}-tier`;
  const dirColor  = direction === 'Bullish' ? 'var(--accent)' : direction === 'Bearish' ? 'var(--red)' : 'var(--blue)';

  container.innerHTML = `
    <div class="best-setup-card ${tierClass}" style="--setup-color:${tierColor};--setup-glow:${tierGlow};">
      <div class="best-setup-glow"></div>
      <div class="best-setup-inner">

        <div class="best-setup-top">
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);font-weight:600;margin-bottom:4px;">Best Setup</div>
            <div class="best-setup-symbol">${esc(symbol)}</div>
            <div class="best-setup-name">${esc(name || symbol)}</div>
          </div>
          <div class="best-setup-tier-badge">
            <span class="tier-pill ${tier}">${tierEmoji} ${tierLabel}</span>
          </div>
        </div>

        <div class="best-setup-score-row">
          <div>
            <div class="best-setup-score-num">${score}</div>
            <div class="best-setup-score-label">out of 10</div>
          </div>
          <div style="flex:1;margin:0 12px;">
            <div class="setup-confidence">
              <div class="setup-confidence-label">
                <span>Confidence</span><span>${confidence}%</span>
              </div>
              <div class="setup-confidence-track">
                <div class="setup-confidence-fill" style="width:${confidence}%;"></div>
              </div>
            </div>
          </div>
          <div class="best-setup-direction ${direction}">${direction}</div>
        </div>

        <div class="setup-levels">
          <div class="setup-level">
            <div class="setup-level-label">Entry</div>
            <div class="setup-level-value">${px(entry)}</div>
          </div>
          <div class="setup-level sl">
            <div class="setup-level-label">Stop Loss</div>
            <div class="setup-level-value">${px(stopLoss)}</div>
          </div>
          <div class="setup-level t1">
            <div class="setup-level-label">Target 1</div>
            <div class="setup-level-value">${px(target1)}</div>
          </div>
          <div class="setup-level t2">
            <div class="setup-level-label">Target 2</div>
            <div class="setup-level-value">${px(target2)}</div>
          </div>
          <div class="setup-level">
            <div class="setup-level-label">Sector</div>
            <div class="setup-level-value" style="font-size:11px;">${esc(setup.snapshot?.sector || 'Global')}</div>
          </div>
          <div class="setup-level rr">
            <div class="setup-level-label">Risk : Reward</div>
            <div class="setup-level-value">1 : ${rrRatio}</div>
          </div>
        </div>

        <button class="btn-copy" style="width:100%;" onclick="document.getElementById('analysisSection').style.display='';" >
          View Full AI Analysis ↓
        </button>

      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════
   OPPORTUNITIES LIST
══════════════════════════════════════════════════ */
function getFilteredSetups(result, filter) {
  if (!result) return [];
  if (filter === 's-tier') return result.top10.filter(s => s.tier === 'S');
  if (filter === 'top3')   return result.top3;
  if (filter === 'top5')   return result.top5;
  return result.top10;
}

function renderOpportunities(result, filter) {
  const listEl   = document.getElementById('oppList');
  const countEl  = document.getElementById('oppCountBadge');
  if (!listEl) return;

  const setups = getFilteredSetups(result, filter);
  if (countEl) countEl.textContent = setups.length;

  if (!setups.length) {
    listEl.innerHTML = `
      <div class="no-trade-state" style="padding:32px;">
        <div class="no-trade-icon">🚫</div>
        <div class="no-trade-title">NO HIGH QUALITY SETUP AVAILABLE</div>
        <div class="no-trade-sub">No setups meet the current filter criteria. The market favors patience.</div>
      </div>`;
    return;
  }

  listEl.innerHTML = setups.map((setup, i) => {
    const isSelected = selectedSetup?.symbol === setup.symbol;
    return `
      <div class="opp-row ${isSelected ? 'selected' : ''}" data-symbol="${esc(setup.symbol)}" role="button" tabindex="0"
           aria-label="${esc(setup.symbol)} — ${esc(setup.tierLabel)} — score ${setup.score}">
        <div class="opp-rank">${i + 1}</div>
        <div class="opp-info">
          <div class="opp-symbol">
            <span>${esc(setup.symbol)}</span>
            <span class="tier-pill ${setup.tier}" style="font-size:9px;padding:1px 6px;">${setup.tierEmoji} ${esc(setup.tierLabel)}</span>
          </div>
          <div class="opp-name">${esc(setup.name || setup.symbol)}</div>
        </div>
        <span class="opp-category">${esc(setup.snapshot?.category || 'Asset')}</span>
        <span class="opp-direction ${setup.direction}">${esc(setup.direction)}</span>
        <div class="opp-score">${setup.score}<small>/10</small></div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.opp-row').forEach(row => {
    const activate = () => {
      const sym = row.dataset.symbol;
      const setup = result.top10.find(s => s.symbol === sym);
      if (setup) selectSetup(setup, result);
    };
    row.addEventListener('click', activate);
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
  });
}

/* ── Opportunity filter tabs ─────────────────────── */
document.getElementById('oppFilterTabs')?.addEventListener('click', e => {
  const btn = e.target.closest('.opp-tab');
  if (!btn || !currentResult) return;
  document.querySelectorAll('.opp-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  renderOpportunities(currentResult, currentFilter);
});

/* ══════════════════════════════════════════════════
   SELECT SETUP → AI EXPLANATION + TELEGRAM
══════════════════════════════════════════════════ */
function selectSetup(setup, result) {
  selectedSetup = setup;
  document.getElementById('analysisSection').style.display = '';
  renderOpportunities(result, currentFilter);
  renderExplanation(setup);
  renderTelegramAlert(setup);
  document.getElementById('analysisSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderExplanation(setup) {
  const body   = document.getElementById('explanationBody');
  const label  = document.getElementById('explanationSymbolLabel');
  if (!body || !setup) return;

  const { explanation, mtfAnalysis, factors, score, tierEmoji, tierLabel } = setup;
  if (label) label.textContent = `${setup.symbol} · ${tierEmoji} ${tierLabel} · ${score}/10`;

  const factorHtml = Object.entries(factors || {}).map(([key, val]) => {
    const cls  = getFactorLabel(val);
    const pct  = Math.round(val);
    return `
      <div class="factor-item">
        <div class="factor-label">${esc(formatFactorKey(key))}</div>
        <div class="factor-bar-wrap">
          <div class="factor-bar"><div class="factor-bar-fill ${cls}" style="width:${pct}%"></div></div>
          <span class="factor-val">${pct}</span>
        </div>
      </div>`;
  }).join('');

  const mtfHtml = mtfAnalysis?.timeframes?.map(tf => `
    <div class="mtf-pill ${tf.aligned ? 'aligned' : tf.conflicting ? 'conflict' : ''}">
      <span class="mtf-label">${esc(tf.label)}</span>
      <span class="mtf-bias ${tf.bias}">${tf.bias}</span>
      <span class="mtf-icon">${tf.aligned ? '✅' : tf.conflicting ? '❌' : '➖'}</span>
    </div>`).join('') || '';

  const listHtml = (items, cls = '') => items?.length
    ? `<ul class="explanation-list ${cls}">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`
    : '<div style="color:var(--text-muted);font-size:12px;">—</div>';

  body.innerHTML = `
    <div class="explanation-section">
      <div class="explanation-section-title">Why Selected</div>
      ${listHtml(explanation?.whySelected)}
    </div>
    <div class="explanation-section">
      <div class="explanation-section-title">Why Strong</div>
      ${listHtml(explanation?.whyStrong)}
    </div>
    <div class="explanation-section">
      <div class="explanation-section-title">Factor Scores (out of 100)</div>
      <div class="factor-grid">${factorHtml}</div>
    </div>
    <div class="explanation-section">
      <div class="explanation-section-title">Multi-Timeframe Alignment</div>
      <div class="mtf-grid">${mtfHtml}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${esc(mtfAnalysis?.summary || '—')}</div>
    </div>
    <div class="explanation-section">
      <div class="explanation-section-title">Risk Factors</div>
      ${listHtml(explanation?.riskFactors, 'risk')}
    </div>
    <div class="explanation-section">
      <div class="explanation-section-title">Invalidation Conditions</div>
      ${listHtml(explanation?.invalidationConditions, 'invalidation')}
    </div>
    <div class="explanation-section">
      <div class="explanation-section-title">Market Context</div>
      ${listHtml(explanation?.marketContext, 'context')}
    </div>
    <div style="font-size:10px;color:var(--text-muted);padding-top:4px;line-height:1.5;">${esc(explanation?.disclaimer || '')}</div>
  `;
}

function renderTelegramAlert(setup) {
  const body       = document.getElementById('telegramBody');
  const gateStatus = document.getElementById('telegramGateStatus');
  if (!body || !setup) return;

  const gateResult = setup.alertGate || { pass: false, reason: 'Not evaluated' };
  const gates = [
    { label: 'Score ≥ 9.0 (S-Tier)',       pass: setup.score >= 9.0 },
    { label: 'Trend confirmed',             pass: (setup.factors?.trend || 0) >= 60 },
    { label: 'Volume confirmed',            pass: (setup.factors?.volume || 0) >= 55 },
    { label: 'R:R ≥ 1:2',                  pass: setup.rrRatio >= 2 },
    { label: 'Market regime safe',          pass: currentResult?.regime?.mood !== 'High Risk' },
    { label: 'No major MTF conflict',       pass: !setup.mtfAnalysis?.majorConflict },
    { label: 'Directional bias confirmed',  pass: setup.direction !== 'Neutral' },
  ];

  if (gateStatus) {
    gateStatus.textContent = gateResult.pass ? '✅ Alert Ready' : '🔕 No Alert';
    gateStatus.className = `telegram-gate-status ${gateResult.pass ? 'pass' : 'fail'}`;
  }

  const gateListHtml = `
    <div class="telegram-gate-list">
      ${gates.map(g => `
        <div class="telegram-gate-item">
          <span class="gate-dot ${g.pass ? 'pass' : 'fail'}"></span>
          <span>${esc(g.label)}</span>
        </div>`).join('')}
    </div>`;

  if (gateResult.pass && setup.telegramAlert) {
    body.innerHTML = `
      <div class="telegram-text-box" id="telegramTextBox">${esc(setup.telegramAlert)}</div>
      <div class="telegram-actions">
        <button class="btn-copy" id="copyAlertBtn">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy Alert
        </button>
        <button class="btn-outline-sm" id="compactAlertBtn">Compact Format</button>
      </div>
      ${gateListHtml}`;

    document.getElementById('copyAlertBtn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(setup.telegramAlert).then(() => {
        const btn = document.getElementById('copyAlertBtn');
        if (btn) { btn.textContent = '✅ Copied!'; btn.classList.add('copied'); }
        setTimeout(() => {
          const btn2 = document.getElementById('copyAlertBtn');
          if (btn2) { btn2.innerHTML = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Alert'; btn2.classList.remove('copied'); }
        }, 2500);
      });
    });

    let showingCompact = false;
    document.getElementById('compactAlertBtn')?.addEventListener('click', () => {
      const box = document.getElementById('telegramTextBox');
      if (!box) return;
      showingCompact = !showingCompact;
      box.textContent = showingCompact ? (setup.compactAlert || setup.telegramAlert) : setup.telegramAlert;
      const btn = document.getElementById('compactAlertBtn');
      if (btn) btn.textContent = showingCompact ? 'Full Format' : 'Compact Format';
    });

  } else {
    body.innerHTML = `
      <div class="telegram-no-alert">
        <div class="telegram-no-alert-icon">🔕</div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">No Alert Generated</div>
        <div style="font-size:12px;color:var(--text-muted);">${esc(gateResult.reason)}</div>
      </div>
      ${gateListHtml}`;
  }
}

/* ══════════════════════════════════════════════════
   SECTOR LEADERBOARD
══════════════════════════════════════════════════ */
function renderSectorLeaderboard(sectorRanking) {
  const el      = document.getElementById('sectorLeaderboard');
  const timeEl  = document.getElementById('sectorTime');
  if (!el) return;

  const top5 = sectorRanking?.leaderboard || [];
  if (timeEl) timeEl.textContent = fmtTime(sectorRanking?.timestamp);

  el.innerHTML = top5.map((sector, i) => `
    <div class="sector-row">
      <span class="sector-rank">${i + 1}</span>
      <span class="sector-icon">${esc(sector.icon)}</span>
      <span class="sector-label">${esc(sector.label)}</span>
      <div class="sector-bar-wrap">
        <div class="sector-bar">
          <div class="sector-bar-fill" style="width:${sector.score}%;background:${esc(sector.color)};"></div>
        </div>
        <span class="sector-score">${sector.score}</span>
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════
   WATCHLIST
══════════════════════════════════════════════════ */
function renderWatchlist(watchlist) {
  const body  = document.getElementById('watchlistBody');
  const count = document.getElementById('watchlistCount');
  if (!body) return;
  if (count) count.textContent = `${watchlist.length} asset${watchlist.length === 1 ? '' : 's'}`;

  if (!watchlist.length) {
    body.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px;">No qualified assets yet.</div>';
    return;
  }

  body.innerHTML = watchlist.map(item => {
    const col = item.tier === 'S' ? 'var(--s-tier)' : item.tier === 'A' ? 'var(--a-tier)' : 'var(--b-tier)';
    return `
      <div class="watchlist-item">
        <div>
          <div class="watchlist-item-sym">${esc(item.symbol)}</div>
          <div class="watchlist-item-cat">${esc(item.category)}</div>
        </div>
        <div class="watchlist-item-score" style="color:${col};">${item.score}</div>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════
   FULL RENDER
══════════════════════════════════════════════════ */
function renderAll(result) {
  currentResult = result;
  renderMoodBar(result);
  renderCharts(result);
  renderBestSetupCard(result.bestSetup);
  renderOpportunities(result, currentFilter);
  renderSectorLeaderboard(result.sectorRanking);
  renderWatchlist(result.watchlist);

  if (result.bestSetup) {
    selectedSetup = result.bestSetup;
    renderExplanation(result.bestSetup);
    renderTelegramAlert(result.bestSetup);
    document.getElementById('analysisSection').style.display = '';
  }
}

/* ══════════════════════════════════════════════════
   SCAN ORCHESTRATION
══════════════════════════════════════════════════ */
let isScanning = false;

async function runScan({ forceRefresh = false } = {}) {
  if (isScanning) return;
  isScanning = true;

  const btn = document.getElementById('scannerRefreshBtn');
  if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }

  try {
    const result = await scanner.scanAll({ forceRefresh });
    renderAll(result);
  } catch (err) {
    console.error('[Tradoctory] Scanner failed:', err);
    const bestCard = document.getElementById('bestSetupCard');
    if (bestCard) bestCard.innerHTML = `
      <div class="best-setup-card no-trade">
        <div class="best-setup-inner">
          <div class="no-trade-state">
            <div class="no-trade-icon">⚠️</div>
            <div class="no-trade-title">Scanner Temporarily Unavailable</div>
            <div class="no-trade-sub">Using cached data. Click Refresh to try again.</div>
          </div>
        </div>
      </div>`;
  } finally {
    isScanning = false;
    if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); }
  }
}

/* ── Auto-refresh every 60 seconds ─────────────── */
runScan();
setInterval(() => runScan({ forceRefresh: true }), 60 * 1000);
document.getElementById('scannerRefreshBtn')?.addEventListener('click', () => runScan({ forceRefresh: true }));
