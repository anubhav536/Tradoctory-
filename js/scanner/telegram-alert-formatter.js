'use strict';

/* ===================================================
   TRADOCTORY — TELEGRAM ALERT FORMATTER
   Generates Telegram-ready alert text.
   Only fires when ALL gates are passed:
   - Score >= 9.0 (S-Tier)
   - Trend confirmed
   - Volume confirmed
   - Market regime confirmed
   - MTF confirmed
   - R:R >= 1:2
   =================================================== */

function px(v, decimals = 2) {
  return Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

function pct(v) {
  return `${Number(v || 0).toFixed(2)}%`;
}

function ts() {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date()) + ' IST';
}

/**
 * Check whether a scored setup passes ALL alert gates.
 * @param {object} scored        - scoreSetup() output
 * @param {object} options
 * @param {object} options.regime      - detectMarketRegime() output
 * @param {object} options.mtfAnalysis - analyseMultiTimeframe() output
 * @returns {{ pass: boolean, reason: string }}
 */
export function checkAlertGates(scored, options = {}) {
  const { regime = null, mtfAnalysis = null } = options;
  const { score, factors, rrRatio, direction } = scored;

  if (score < 9.0) return { pass: false, reason: `Score ${score} < 9.0 (S-Tier required)` };
  if (factors.trend < 60) return { pass: false, reason: `Trend score ${Math.round(factors.trend)} < 60 (trend not confirmed)` };
  if (factors.volume < 55) return { pass: false, reason: `Volume score ${Math.round(factors.volume)} < 55 (volume not confirmed)` };
  if (rrRatio < 2) return { pass: false, reason: `R:R ${rrRatio} < 1:2 (minimum R:R not met)` };
  if (regime && regime.mood === 'High Risk') return { pass: false, reason: 'Market regime is High Risk — alert suppressed' };
  if (mtfAnalysis && mtfAnalysis.majorConflict) return { pass: false, reason: `MTF conflict on higher timeframe — alert suppressed` };
  if (direction === 'Neutral') return { pass: false, reason: 'No directional bias — alert suppressed' };

  return { pass: true, reason: 'All gates passed' };
}

/**
 * Format a Telegram-ready alert string.
 * Only call this after checkAlertGates() returns { pass: true }.
 * @param {object} scored       - scoreSetup() output
 * @param {object} explanation  - explainSetup() output
 * @param {object} options
 * @returns {string}
 */
export function formatTelegramAlert(scored, explanation = {}, options = {}) {
  const { regime = null } = options;
  const {
    symbol, name, direction, score, tierLabel, tierEmoji,
    entry, stopLoss, target1, target2, rrRatio, confidence,
    factors,
  } = scored;

  const reasons = (explanation.whySelected || []).slice(0, 3).join('\n  ');
  const topRisks = (explanation.riskFactors || []).slice(0, 2).join('\n  ');
  const moodLine = regime ? `🌍 Market Mood: ${regime.mood} (${regime.label})` : '';

  const text = [
    `${tierEmoji} ${tierLabel.toUpperCase()} SETUP — NIFTY BEAST AI SCANNER`,
    ``,
    `📌 Symbol:     ${symbol}${name && name !== symbol ? ` (${name})` : ''}`,
    `📍 Direction:  ${direction}`,
    `⭐ Score:      ${score}/10 — ${tierLabel}`,
    ``,
    `🎯 Entry:      ${px(entry)}`,
    `🛑 Stop Loss:  ${px(stopLoss)}`,
    `✅ Target 1:   ${px(target1)}`,
    `✅ Target 2:   ${px(target2)}`,
    `📊 Risk-Reward: 1:${rrRatio}`,
    `💪 Confidence: ${confidence}%`,
    ``,
    moodLine,
    ``,
    `🧠 Reasons:`,
    `  ${reasons}`,
    ``,
    `⚠️ Risk Notes:`,
    `  ${topRisks}`,
    ``,
    `🕐 Time: ${ts()}`,
    ``,
    `—`,
    `Tradoctory · AI Scanner · Educational Use Only`,
    `Not financial advice. Always use risk management.`,
  ].filter(line => line !== undefined).join('\n');

  return text;
}

/**
 * Format a compact Telegram alert (for secondary display).
 */
export function formatCompactAlert(scored) {
  const { symbol, direction, score, entry, stopLoss, target1, rrRatio, tierEmoji } = scored;
  return `${tierEmoji} ${symbol} | ${direction} | ${score}/10 | Entry: ${px(entry)} | SL: ${px(stopLoss)} | T1: ${px(target1)} | R:R 1:${rrRatio} | ${ts()}`;
}
