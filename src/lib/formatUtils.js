// formatUtils.js - helpers for formatting numeric amounts into cooking-friendly fractions
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

export function formatAmountToFraction(amount) {
  if (amount == null || amount === '') return '';
  const n = Number(amount);
  if (!isFinite(n)) return String(amount);

  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const integerPart = Math.floor(abs);
  let frac = abs - integerPart;

  // If fraction is extremely close to 0 or 1, treat as integer
  if (frac < 1e-8) return sign + String(integerPart);

  // Common cooking denominators
  const dens = [2, 3, 4, 6, 8, 12, 16];
  let best = { num: 0, den: 1, delta: 1 };
  for (const den of dens) {
    const num = Math.round(frac * den);
    const approx = num / den;
    const delta = Math.abs(frac - approx);
    if (num >= 0 && num <= den && delta < best.delta) {
      best = { num, den, delta };
    }
  }

  // If best numerator equals denominator, increment integer part
  if (best.num === best.den) {
    return sign + String(integerPart + 1);
  }

  // If no good approximation found (delta too large), fall back to decimal with 2 dp
  const maxAcceptable = 0.03; // ~3% tolerance
  if (best.delta > maxAcceptable || best.num === 0) {
    // show as decimal but trim trailing zeros
    const dec = Math.round(n * 100) / 100;
    return String(dec);
  }

  // Reduce fraction
  const g = gcd(best.num, best.den);
  const num = best.num / g;
  const den = best.den / g;

  const fracPart = `${num}/${den}`;
  if (integerPart > 0) return sign + `${integerPart} ${fracPart}`;
  return sign + fracPart;
}

export default { formatAmountToFraction };

// Parse user-entered amount strings (e.g. "1 1/4", "3/4", "1.25") into a decimal number
export function parseAmountToDecimal(input) {
  if (input == null || input === '') return 0;
  if (typeof input === 'number') return input;
  let s = String(input).trim();
  if (s === '') return 0;

  // Mixed number like "1 1/4" or "-1 1/4"
  const mixed = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const sign = mixed[1].startsWith('-') ? -1 : 1;
    const intPart = Math.abs(parseInt(mixed[1], 10));
    const num = parseInt(mixed[2], 10);
    const den = parseInt(mixed[3], 10) || 1;
    if (den === 0) return 0;
    return sign * (intPart + num / den);
  }

  // Simple fraction like "3/4" or "-3/4"
  const frac = s.match(/^(-?)(\d+)\/(\d+)$/);
  if (frac) {
    const sign = frac[1] === '-' ? -1 : 1;
    const num = parseInt(frac[2], 10);
    const den = parseInt(frac[3], 10) || 1;
    if (den === 0) return 0;
    return sign * (num / den);
  }

  // Fallback: parse as float (handles "1.25", "0.5", etc.)
  const f = parseFloat(s.replace(',', '.'));
  return Number.isFinite(f) ? f : 0;
}
