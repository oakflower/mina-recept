// Scales ingredient amounts when the number of servings changes.
// Loaded as a plain script in the browser (global scaleAmount) and with require() in tests.

const NUMBER = String.raw`\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?`;
const AMOUNT_PATTERN = new RegExp(String.raw`^(${NUMBER})(?:\s*[-–]\s*(${NUMBER}))?$`);

// "1 1/2" -> 1.5, "0,5" -> 0.5. Returns NaN if the text is not a number.
function parseNumber(text) {
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(text.replace(',', '.'));
}

// 1.5 -> "1,5". At most two decimals, Swedish decimal comma.
function formatNumber(number) {
  return String(Math.round(number * 100) / 100).replace('.', ',');
}

// Scales an amount text from one number of servings to another.
// Amounts that are not numbers ("en nypa", "") are returned unchanged.
function scaleAmount(amount, fromServings, toServings) {
  const match = String(amount).trim().match(AMOUNT_PATTERN);
  if (!match) return amount;
  const numbers = [match[1], match[2]].filter(Boolean).map(parseNumber);
  if (!numbers.every(Number.isFinite)) return amount;
  const factor = toServings / fromServings;
  return numbers.map((number) => formatNumber(number * factor)).join('-');
}

if (typeof module !== 'undefined') module.exports = { scaleAmount };
