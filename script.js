/* DOM Helpers */
const $ = id => document.getElementById(id);
const safeNum = v => isFinite(v) ? Number(v) : 0;

/* State */
let displayCurrency = 'USD';

/* UI Helpers */
function updateBadge(el, value, prefix = '') {
  el.textContent = `${prefix}${value}`;
}

/* TP / SL Mapping */
function syncTPFromSlider() {
  const entry = safeNum($('entry').value);
  const value = safeNum($('tpSlider').value);
  $('tp').value = (entry * (1 + value / 10000)).toFixed(2);
  $('tpNumeric').value = value;
  updateBadge($('tpBadge'), value, value >= 0 ? '+' : '');
}

function syncSLFromSlider() {
  const entry = safeNum($('entry').value);
  const value = safeNum($('slSlider').value);
  $('stop').value = (entry * (1 - value / 10000)).toFixed(2);
  $('slNumeric').value = value;
  updateBadge($('slBadge'), Math.abs(value), '-');
}

/* Currency Conversion */
function usdToZar(amount) {
  const rate = safeNum($('manualRate').value);
  return rate > 0 ? amount * rate : null;
}

/* Core Calculation */
function calculate() {
  const balance = safeNum($('balance').value);
  const lots = safeNum($('lots').value);
  const entry = safeNum($('entry').value);
  const tp = safeNum($('tp').value);
  const sl = safeNum($('stop').value);
  const contractSize = safeNum($('contractSize').value);
  const leverage = safeNum($('leverage').value);

  const profit = (tp - entry) * contractSize * lots;
  const loss = (entry - sl) * contractSize * lots;
  const margin = (entry * contractSize * lots) / leverage;

  $('projPLcontent').innerHTML =
    `TP: +${profit.toFixed(2)} USD<br>SL: -${loss.toFixed(2)} USD`;

  $('projBalContent').innerHTML =
    `Current: ${balance.toFixed(2)} USD<br>
     TP: ${(balance + profit).toFixed(2)} USD<br>
     SL: ${(balance - loss).toFixed(2)} USD`;

  $('marginUSD').textContent = `${margin.toFixed(2)} USD`;
}

/* Event Bindings */
$('tpSlider').addEventListener('input', syncTPFromSlider);
$('slSlider').addEventListener('input', syncSLFromSlider);
$('tpNumeric').addEventListener('input', () => {
  $('tpSlider').value = $('tpNumeric').value;
  syncTPFromSlider();
});
$('slNumeric').addEventListener('input', () => {
  $('slSlider').value = $('slNumeric').value;
  syncSLFromSlider();
});

$('calcBtn').addEventListener('click', calculate);

$('reset').addEventListener('click', () => location.reload());
