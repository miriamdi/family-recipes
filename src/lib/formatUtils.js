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
