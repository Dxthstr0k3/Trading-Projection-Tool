/* ===============================
   STATE & CONFIG
================================ */

let displayCurrency = 'USD';

/* ===============================
   DOM HELPERS
================================ */

const $ = id => document.getElementById(id);
const num = v => Number.isFinite(+v) ? +v : 0;
const fmt = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—';

/* ===============================
   TRADE DIRECTION
================================ */

function getTradeDirection(entry, tp, sl) {
  if (tp > entry && sl < entry) return 'LONG';
  if (tp < entry && sl > entry) return 'SHORT';
  return 'UNDEFINED';
}

/* ===============================
   PIP & PRICE CALCULATIONS
================================ */

function pipDistance(a, b, pipSize) {
  return pipSize > 0 ? Math.abs(a - b) / pipSize : 0;
}

/* ===============================
   RISK MANAGEMENT
================================ */

function calculateSuggestedLots({
  balance,
  riskValue,
  riskMode,
  lossPerLot
}) {
  if (lossPerLot <= 0) return null;

  const riskAmount =
    riskMode === 'percent'
      ? (riskValue / 100) * balance
      : riskValue;

  const lots = riskAmount / lossPerLot;
  return Number.isFinite(lots) && lots > 0 ? lots : null;
}

/* ===============================
   CURRENCY CONVERSION
================================ */

function usdToZar(value) {
  const rate = num($('manualRate').value);
  return rate > 0 ? value * rate : null;
}

function displayValue(valueUSD) {
  if (displayCurrency === 'USD') {
    return `${fmt(valueUSD)} USD`;
  }
  const converted = usdToZar(valueUSD);
  return converted !== null
    ? `${fmt(converted)} ZAR`
    : 'Rate required';
}

/* ===============================
   CORE CALCULATION
================================ */

async function calculate({ fetchLive = false, fetchATR = false } = {}) {

  /* Inputs */
  const balance = num($('balance').value);
  const lots = num($('lots').value);
  const entry = num($('entry').value);
  const tp = num($('tp').value);
  const sl = num($('stop').value);
  const leverage = num($('leverage').value) || 1;
  const pipSize = num($('pipSize').value);
  const contractSize = num($('contractSize').value);
  const riskValue = num($('riskValue').value);
  const riskMode = $('riskMode').value;

  /* Direction */
  const direction = getTradeDirection(entry, tp, sl);
  $('tradeDir').innerHTML =
    direction === 'LONG'
      ? '<span class="indicator-long">LONG</span>'
      : direction === 'SHORT'
      ? '<span class="indicator-short">SHORT</span>'
      : '—';

  /* Pips */
  const pipsSL = pipDistance(entry, sl, pipSize);
  const pipsTP = pipDistance(entry, tp, pipSize);
  $('pipsDiff').innerHTML =
    `${fmt(pipsSL, 1)} pips (SL) • ${fmt(pipsTP, 1)} pips (TP)`;

  /* Profit / Loss per lot */
  let profitPerLot = 0;
  let lossPerLot = 0;

  if (direction === 'LONG') {
    profitPerLot = (tp - entry) * contractSize;
    lossPerLot = (entry - sl) * contractSize;
  } else if (direction === 'SHORT') {
    profitPerLot = (entry - tp) * contractSize;
    lossPerLot = (sl - entry) * contractSize;
  }

  const totalProfit = profitPerLot * lots;
  const totalLoss = lossPerLot * lots;

  /* Projected P/L */
  $('projPLcontent').innerHTML = `
    TP: +${displayValue(totalProfit)}<br>
    SL: -${displayValue(totalLoss)}
  `;

  /* Projected Balance */
  $('projBalContent').innerHTML = `
    Current: ${displayValue(balance)}<br>
    If TP: ${displayValue(balance + totalProfit)}<br>
    If SL: ${displayValue(balance - totalLoss)}
  `;

  /* Margin */
  const positionValue = entry * contractSize * lots;
  const margin = positionValue / leverage;
  $('marginUSD').innerHTML = displayValue(margin);

  /* Risk : Reward */
  const rr =
    lossPerLot > 0 ? profitPerLot / lossPerLot : null;
  $('rr').textContent =
    rr ? `1 : ${fmt(rr, 2)}` : '—';

  /* Suggested Lots */
  const suggestedLots = calculateSuggestedLots({
    balance,
    riskValue,
    riskMode,
    lossPerLot
  });

  $('suggestLots').innerHTML =
    suggestedLots
      ? `${fmt(suggestedLots, 4)} lots`
      : '—';

  /* Live Price */
  if (fetchLive) {
    await fetchLivePrice();
  }

  /* ATR */
  if (fetchATR) {
    await fetchATRValue();
  }
}

/* ===============================
   LIVE PRICE (TWELVE DATA)
================================ */

async function fetchLivePrice() {
  const symbol = $('liveSymbol').value.trim();
  const apiKey = $('tdKey').value.trim();
  if (!symbol || !apiKey) {
    $('livePrice').textContent = 'API key & symbol required';
    return;
  }

  $('livePrice').textContent = 'Fetching...';

  try {
    const res = await fetch(
      `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`
    );
    const data = await res.json();
    $('livePrice').textContent =
      data.price ? `${fmt(+data.price, 4)}` : 'Unavailable';
  } catch {
    $('livePrice').textContent = 'Error';
  }
}

/* ===============================
   ATR CALCULATION
================================ */

async function fetchATRValue() {
  const symbol = $('liveSymbol').value.trim();
  const apiKey = $('tdKey').value.trim();
  const periods = num($('atrPeriods').value);
  const timeframe = $('timeframe').value;

  if (!symbol || !apiKey) {
    $('tfEstimate').textContent = 'ATR unavailable';
    return;
  }

  const intervalMap = {
    1: '1min', 5: '5min', 15: '15min',
    60: '1h', 240: '4h', 1440: '1day'
  };

  try {
    const res = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${intervalMap[timeframe]}&outputsize=100&apikey=${apiKey}`
    );
    const data = await res.json();
    const values = data.values;
    if (!values || values.length < periods + 1) return;

    const trs = [];
    for (let i = 1; i <= periods; i++) {
      const h = +values[i].high;
      const l = +values[i].low;
      const pc = +values[i - 1].close;
      trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }

    const atr = trs.reduce((a, b) => a + b, 0) / periods;
    $('tfEstimate').textContent = `ATR ≈ ${fmt(atr, 4)}`;
  } catch {
    $('tfEstimate').textContent = 'ATR error';
  }
}

/* ===============================
   EVENT BINDINGS
================================ */

$('calcBtn').addEventListener('click', () =>
  calculate({ fetchLive: true, fetchATR: true })
);

$('fetchLivePrice').addEventListener('click', fetchLivePrice);

$('displayUSD')?.addEventListener('click', () => {
  displayCurrency = 'USD';
  calculate();
});

$('displayZAR')?.addEventListener('click', () => {
  displayCurrency = 'ZAR';
  calculate();
});
