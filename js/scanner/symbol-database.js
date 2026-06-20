'use strict';

/* ===================================================
   TRADOCTORY — SYMBOL DATABASE  (symbol-database.js)

   Built-in, auto-loaded. No user setup required.
   Contains:
   - NIFTY 50 stocks (symbol, company, sector)
   - Indian Indices (NIFTY, SENSEX, BANKNIFTY)
   - Forex pairs
   - Commodities
   - Crypto
   =================================================== */

export const SECTORS = Object.freeze({
  BANKING:           'Banking',
  IT:                'Information Technology',
  AUTO:              'Automobile',
  ENERGY:            'Energy',
  PHARMA:            'Pharmaceuticals',
  FMCG:              'FMCG',
  FINANCIAL:         'Financial Services',
  METALS:            'Metals & Mining',
  TELECOM:           'Telecom',
  INFRA:             'Infrastructure',
  CONSUMER:          'Consumer Goods',
  REALTY:            'Realty',
});

/* NIFTY 50 Constituent Database */
export const NIFTY50_STOCKS = Object.freeze([
  { symbol: 'RELIANCE.NS',     name: 'Reliance Industries',      sector: SECTORS.ENERGY,     yahooSymbol: 'RELIANCE.NS' },
  { symbol: 'TCS.NS',          name: 'Tata Consultancy Services', sector: SECTORS.IT,         yahooSymbol: 'TCS.NS' },
  { symbol: 'HDFCBANK.NS',     name: 'HDFC Bank',                sector: SECTORS.BANKING,    yahooSymbol: 'HDFCBANK.NS' },
  { symbol: 'INFY.NS',         name: 'Infosys',                  sector: SECTORS.IT,         yahooSymbol: 'INFY.NS' },
  { symbol: 'ICICIBANK.NS',    name: 'ICICI Bank',               sector: SECTORS.BANKING,    yahooSymbol: 'ICICIBANK.NS' },
  { symbol: 'HINDUNILVR.NS',   name: 'Hindustan Unilever',       sector: SECTORS.FMCG,       yahooSymbol: 'HINDUNILVR.NS' },
  { symbol: 'ITC.NS',          name: 'ITC Ltd',                  sector: SECTORS.FMCG,       yahooSymbol: 'ITC.NS' },
  { symbol: 'SBIN.NS',         name: 'State Bank of India',      sector: SECTORS.BANKING,    yahooSymbol: 'SBIN.NS' },
  { symbol: 'BHARTIARTL.NS',   name: 'Bharti Airtel',            sector: SECTORS.TELECOM,    yahooSymbol: 'BHARTIARTL.NS' },
  { symbol: 'KOTAKBANK.NS',    name: 'Kotak Mahindra Bank',      sector: SECTORS.BANKING,    yahooSymbol: 'KOTAKBANK.NS' },
  { symbol: 'LT.NS',           name: 'Larsen & Toubro',          sector: SECTORS.INFRA,      yahooSymbol: 'LT.NS' },
  { symbol: 'HCLTECH.NS',      name: 'HCL Technologies',         sector: SECTORS.IT,         yahooSymbol: 'HCLTECH.NS' },
  { symbol: 'AXISBANK.NS',     name: 'Axis Bank',                sector: SECTORS.BANKING,    yahooSymbol: 'AXISBANK.NS' },
  { symbol: 'MARUTI.NS',       name: 'Maruti Suzuki',            sector: SECTORS.AUTO,       yahooSymbol: 'MARUTI.NS' },
  { symbol: 'SUNPHARMA.NS',    name: 'Sun Pharmaceutical',       sector: SECTORS.PHARMA,     yahooSymbol: 'SUNPHARMA.NS' },
  { symbol: 'WIPRO.NS',        name: 'Wipro Ltd',                sector: SECTORS.IT,         yahooSymbol: 'WIPRO.NS' },
  { symbol: 'ULTRACEMCO.NS',   name: 'UltraTech Cement',         sector: SECTORS.INFRA,      yahooSymbol: 'ULTRACEMCO.NS' },
  { symbol: 'TITAN.NS',        name: 'Titan Company',            sector: SECTORS.CONSUMER,   yahooSymbol: 'TITAN.NS' },
  { symbol: 'BAJFINANCE.NS',   name: 'Bajaj Finance',            sector: SECTORS.FINANCIAL,  yahooSymbol: 'BAJFINANCE.NS' },
  { symbol: 'ONGC.NS',         name: 'ONGC',                     sector: SECTORS.ENERGY,     yahooSymbol: 'ONGC.NS' },
  { symbol: 'NTPC.NS',         name: 'NTPC Ltd',                 sector: SECTORS.ENERGY,     yahooSymbol: 'NTPC.NS' },
  { symbol: 'POWERGRID.NS',    name: 'Power Grid Corp',          sector: SECTORS.ENERGY,     yahooSymbol: 'POWERGRID.NS' },
  { symbol: 'M&M.NS',          name: 'Mahindra & Mahindra',      sector: SECTORS.AUTO,       yahooSymbol: 'M%26M.NS' },
  { symbol: 'BAJAJFINSV.NS',   name: 'Bajaj Finserv',            sector: SECTORS.FINANCIAL,  yahooSymbol: 'BAJAJFINSV.NS' },
  { symbol: 'TATAMOTORS.NS',   name: 'Tata Motors',              sector: SECTORS.AUTO,       yahooSymbol: 'TATAMOTORS.NS' },
  { symbol: 'ADANIENTS.NS',    name: 'Adani Enterprises',        sector: SECTORS.INFRA,      yahooSymbol: 'ADANIENTS.NS' },
  { symbol: 'JSWSTEEL.NS',     name: 'JSW Steel',                sector: SECTORS.METALS,     yahooSymbol: 'JSWSTEEL.NS' },
  { symbol: 'TATASTEEL.NS',    name: 'Tata Steel',               sector: SECTORS.METALS,     yahooSymbol: 'TATASTEEL.NS' },
  { symbol: 'COALINDIA.NS',    name: 'Coal India',               sector: SECTORS.ENERGY,     yahooSymbol: 'COALINDIA.NS' },
  { symbol: 'HINDALCO.NS',     name: 'Hindalco Industries',      sector: SECTORS.METALS,     yahooSymbol: 'HINDALCO.NS' },
  { symbol: 'DRREDDY.NS',      name: 'Dr Reddy\'s Laboratories', sector: SECTORS.PHARMA,     yahooSymbol: 'DRREDDY.NS' },
  { symbol: 'CIPLA.NS',        name: 'Cipla Ltd',                sector: SECTORS.PHARMA,     yahooSymbol: 'CIPLA.NS' },
  { symbol: 'EICHERMOT.NS',    name: 'Eicher Motors',            sector: SECTORS.AUTO,       yahooSymbol: 'EICHERMOT.NS' },
  { symbol: 'HEROMOTOCO.NS',   name: 'Hero MotoCorp',            sector: SECTORS.AUTO,       yahooSymbol: 'HEROMOTOCO.NS' },
  { symbol: 'APOLLOHOSP.NS',   name: 'Apollo Hospitals',         sector: SECTORS.PHARMA,     yahooSymbol: 'APOLLOHOSP.NS' },
  { symbol: 'DIVISLAB.NS',     name: 'Divi\'s Laboratories',     sector: SECTORS.PHARMA,     yahooSymbol: 'DIVISLAB.NS' },
  { symbol: 'GRASIM.NS',       name: 'Grasim Industries',        sector: SECTORS.INFRA,      yahooSymbol: 'GRASIM.NS' },
  { symbol: 'ADANIPORTS.NS',   name: 'Adani Ports',              sector: SECTORS.INFRA,      yahooSymbol: 'ADANIPORTS.NS' },
  { symbol: 'BPCL.NS',         name: 'BPCL',                     sector: SECTORS.ENERGY,     yahooSymbol: 'BPCL.NS' },
  { symbol: 'SHRIRAMFIN.NS',   name: 'Shriram Finance',          sector: SECTORS.FINANCIAL,  yahooSymbol: 'SHRIRAMFIN.NS' },
  { symbol: 'SBILIFE.NS',      name: 'SBI Life Insurance',       sector: SECTORS.FINANCIAL,  yahooSymbol: 'SBILIFE.NS' },
  { symbol: 'HDFCLIFE.NS',     name: 'HDFC Life Insurance',      sector: SECTORS.FINANCIAL,  yahooSymbol: 'HDFCLIFE.NS' },
  { symbol: 'ICICIGI.NS',      name: 'ICICI General Insurance',  sector: SECTORS.FINANCIAL,  yahooSymbol: 'ICICIGI.NS' },
  { symbol: 'INDUSINDBK.NS',   name: 'IndusInd Bank',            sector: SECTORS.BANKING,    yahooSymbol: 'INDUSINDBK.NS' },
  { symbol: 'NESTLEIND.NS',    name: 'Nestle India',             sector: SECTORS.FMCG,       yahooSymbol: 'NESTLEIND.NS' },
  { symbol: 'BRITANNIA.NS',    name: 'Britannia Industries',     sector: SECTORS.FMCG,       yahooSymbol: 'BRITANNIA.NS' },
  { symbol: 'TATACONSUM.NS',   name: 'Tata Consumer Products',   sector: SECTORS.FMCG,       yahooSymbol: 'TATACONSUM.NS' },
  { symbol: 'TECHM.NS',        name: 'Tech Mahindra',            sector: SECTORS.IT,         yahooSymbol: 'TECHM.NS' },
  { symbol: 'BEL.NS',          name: 'Bharat Electronics',       sector: SECTORS.INFRA,      yahooSymbol: 'BEL.NS' },
  { symbol: 'BAJAJ-AUTO.NS',   name: 'Bajaj Auto',               sector: SECTORS.AUTO,       yahooSymbol: 'BAJAJ-AUTO.NS' },
]);

/* Indian Indices */
export const INDICES = Object.freeze([
  {
    symbol: 'NIFTY',
    name: 'Nifty 50',
    yahooSymbol: '^NSEI',
    tvSymbol: 'NSE:NIFTY',
    basePrice: 23550,
    type: 'index',
    region: 'India',
  },
  {
    symbol: 'SENSEX',
    name: 'BSE Sensex',
    yahooSymbol: '^BSESN',
    tvSymbol: 'BSE:SENSEX',
    basePrice: 77500,
    type: 'index',
    region: 'India',
  },
  {
    symbol: 'BANKNIFTY',
    name: 'Bank Nifty',
    yahooSymbol: '^NSEBANK',
    tvSymbol: 'NSE:BANKNIFTY',
    basePrice: 52000,
    type: 'index',
    region: 'India',
  },
]);

/* Forex Pairs */
export const FOREX_PAIRS = Object.freeze([
  { symbol: 'EURUSD', name: 'Euro / US Dollar',         yahooSymbol: 'EURUSD=X', tvSymbol: 'FX:EURUSD', basePrice: 1.085,  pip: 0.0001 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', yahooSymbol: 'GBPUSD=X', tvSymbol: 'FX:GBPUSD', basePrice: 1.265,  pip: 0.0001 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen',  yahooSymbol: 'USDJPY=X', tvSymbol: 'FX:USDJPY', basePrice: 149.50, pip: 0.01   },
  { symbol: 'AUDUSD', name: 'Australian Dollar / USD',   yahooSymbol: 'AUDUSD=X', tvSymbol: 'FX:AUDUSD', basePrice: 0.645,  pip: 0.0001 },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar',yahooSymbol: 'USDCAD=X', tvSymbol: 'FX:USDCAD', basePrice: 1.362,  pip: 0.0001 },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc',   yahooSymbol: 'USDCHF=X', tvSymbol: 'FX:USDCHF', basePrice: 0.894,  pip: 0.0001 },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / USD',  yahooSymbol: 'NZDUSD=X', tvSymbol: 'FX:NZDUSD', basePrice: 0.595,  pip: 0.0001 },
]);

/* Commodities & Crypto — Primary Chart Assets */
export const COMMODITIES = Object.freeze([
  { symbol: 'XAUUSD', name: 'Gold / US Dollar',   yahooSymbol: 'GC=F',    tvSymbol: 'TVC:GOLD',   basePrice: 2350,  type: 'commodity' },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', yahooSymbol: 'BTC-USD', tvSymbol: 'BITSTAMP:BTCUSD', basePrice: 68000, type: 'crypto'    },
]);

/* Primary chart display assets (shown as live charts on the scanner page) */
export const PRIMARY_CHART_ASSETS = Object.freeze([
  { ...INDICES[0],       category: 'Index' },
  { ...INDICES[1],       category: 'Index' },
  { ...FOREX_PAIRS[0],   category: 'Forex' },
  { ...FOREX_PAIRS[1],   category: 'Forex' },
  { ...FOREX_PAIRS[2],   category: 'Forex' },
  { ...COMMODITIES[0],   category: 'Commodity' },
  { ...COMMODITIES[1],   category: 'Crypto' },
]);

/* All scannable assets (used by the multi-symbol scanner) */
export const SCANNABLE_ASSETS = Object.freeze([
  ...INDICES.map(i => ({ ...i, category: 'Index',     assetType: 'index' })),
  ...FOREX_PAIRS.map(f => ({ ...f, category: 'Forex', assetType: 'forex' })),
  ...COMMODITIES.map(c => ({ ...c, category: c.type === 'crypto' ? 'Crypto' : 'Commodity', assetType: c.type })),
]);

/* Sector metadata for strength engine */
export const SECTOR_META = Object.freeze([
  { key: SECTORS.BANKING,   label: 'Banking',     icon: '🏦', stocks: NIFTY50_STOCKS.filter(s => s.sector === SECTORS.BANKING) },
  { key: SECTORS.IT,        label: 'IT',          icon: '💻', stocks: NIFTY50_STOCKS.filter(s => s.sector === SECTORS.IT) },
  { key: SECTORS.AUTO,      label: 'Auto',        icon: '🚗', stocks: NIFTY50_STOCKS.filter(s => s.sector === SECTORS.AUTO) },
  { key: SECTORS.ENERGY,    label: 'Energy',      icon: '⚡', stocks: NIFTY50_STOCKS.filter(s => s.sector === SECTORS.ENERGY) },
  { key: SECTORS.PHARMA,    label: 'Pharma',      icon: '💊', stocks: NIFTY50_STOCKS.filter(s => s.sector === SECTORS.PHARMA) },
  { key: SECTORS.FMCG,      label: 'FMCG',        icon: '🛒', stocks: NIFTY50_STOCKS.filter(s => s.sector === SECTORS.FMCG) },
  { key: SECTORS.FINANCIAL, label: 'Financials',  icon: '📈', stocks: NIFTY50_STOCKS.filter(s => s.sector === SECTORS.FINANCIAL) },
  { key: SECTORS.METALS,    label: 'Metals',      icon: '⚙️', stocks: NIFTY50_STOCKS.filter(s => s.sector === SECTORS.METALS) },
]);

/**
 * Lookup a symbol record by its symbol string (case-insensitive).
 * @param {string} symbolKey
 * @returns {object|null}
 */
export function findSymbol(symbolKey) {
  const key = String(symbolKey).toUpperCase();
  return (
    INDICES.find(s => s.symbol === key) ||
    FOREX_PAIRS.find(s => s.symbol === key) ||
    COMMODITIES.find(s => s.symbol === key) ||
    NIFTY50_STOCKS.find(s => s.symbol.toUpperCase() === key) ||
    null
  );
}
