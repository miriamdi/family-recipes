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
  // Replace any unicode vulgar fraction characters with ascii "num/den" tokens (add spaces to separate)
  for (const [char, parts] of Object.entries(unicodeToFraction)) {
    if (s.includes(char)) {
      const [num, den] = parts;
      s = s.split(char).join(` ${num}/${den} `);
    }
  }

  // Handle signs: if leading '-' then apply to the full sum
  const negative = s.trim().startsWith('-');
  if (negative) s = s.trim().slice(1).trim();

  // Find numeric tokens: fractions like 1/2 or decimals/integers like 2 or 2.5
  const tokens = s.match(/-?\d+\/\d+|-?\d+(?:[.,]\d+)?/g);
  if (!tokens || tokens.length === 0) {
    const f = parseFloat(s.replace(',', '.'));
    return Number.isFinite(f) ? (negative ? -f : f) : 0;
  }

  // Sum all tokens: fractions are converted, decimals parsed. This allows inputs like "1 1/2", "1/2 2", "2½", "½2"
  let total = 0;
  for (const t of tokens) {
    if (t.includes('/')) {
      const parts = t.split('/');
      const n = parseFloat(parts[0]);
      const d = parseFloat(parts[1]) || 1;
      if (d === 0) continue;
      total += n / d;
    } else {
      const v = parseFloat(t.replace(',', '.'));
      if (Number.isFinite(v)) total += v;
    }
  }
  return negative ? -total : total;
}
