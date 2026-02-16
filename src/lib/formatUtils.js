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

  const fracPartAscii = `${num}/${den}`;

  // Map common reduced fractions to single unicode vulgar fraction characters
  const unicodeMap = {
    '1/2': '½',
    '1/3': '⅓',
    '2/3': '⅔',
    '1/4': '¼',
    '3/4': '¾',
    '1/5': '⅕',
    '2/5': '⅖',
    '3/5': '⅗',
    '4/5': '⅘',
    '1/6': '⅙',
    '5/6': '⅚',
    '1/8': '⅛',
    '3/8': '⅜',
    '5/8': '⅝',
    '7/8': '⅞'
  };

  const unicodeChar = unicodeMap[fracPartAscii];

  // Use LEFT-TO-RIGHT MARK to ensure integer stays to the left of the fraction
  const LRM = '\u200E';

  if (unicodeChar) {
    if (integerPart > 0) return sign + `${integerPart}${LRM}${unicodeChar}`;
    return sign + unicodeChar;
  }

  if (integerPart > 0) return sign + `${integerPart} ${fracPartAscii}`;
  return sign + fracPartAscii;
}

export default { formatAmountToFraction };

// Parse user-entered amount strings (e.g. "1 1/4", "3/4", "1.25") into a decimal number
export function parseAmountToDecimal(input) {
  if (input == null || input === '') return 0;
  if (typeof input === 'number') return input;
  let s = String(input).trim();
  if (s === '') return 0;

  // Support unicode vulgar fraction characters (e.g. ½, ⅓, ¾) and mixed forms like "1½"
  const unicodeToFraction = {
    '½': [1, 2],
    '⅓': [1, 3],
    '⅔': [2, 3],
    '¼': [1, 4],
    '¾': [3, 4],
    '⅕': [1, 5],
    '⅖': [2, 5],
    '⅗': [3, 5],
    '⅘': [4, 5],
    '⅙': [1, 6],
    '⅚': [5, 6],
    '⅛': [1, 8],
    '⅜': [3, 8],
    '⅝': [5, 8],
    '⅞': [7, 8]
  };

  // If string contains a unicode fraction, convert to an equivalent numeric expression
  for (const [char, parts] of Object.entries(unicodeToFraction)) {
    if (s.includes(char)) {
      const [num, den] = parts;
      // Mixed form like "1½" or "-1½"
      const mixedMatch = s.match(/^(-?\d+)\s*${char}$/);
      if (mixedMatch) {
        const sign = mixedMatch[1].startsWith('-') ? -1 : 1;
        const intPart = Math.abs(parseInt(mixedMatch[1], 10));
        return sign * (intPart + num / den);
      }
      // Mixed with space like "1 ½"
      const mixedSpace = s.match(/^(-?\d+)\s+${char}$/);
      if (mixedSpace) {
        const sign = mixedSpace[1].startsWith('-') ? -1 : 1;
        const intPart = Math.abs(parseInt(mixedSpace[1], 10));
        return sign * (intPart + num / den);
      }
      // Pure fraction char
      if (s === char || s === `-${char}`) {
        const sign = s.startsWith('-') ? -1 : 1;
        return sign * (num / den);
      }
      // Replace any occurrence of the unicode fraction with its ascii form (e.g. "1½" -> "1 1/2")
      s = s.replace(char, ` ${num}/${den}`);
      break;
    }
  }

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
