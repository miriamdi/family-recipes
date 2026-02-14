// emojiUtils.js — modular emoji generation for recipe names
// - Translates/transforms the input name to English (best-effort, internal)
// - Tries to match keywords against a food-emoji catalog
// - Falls back to a random food emoji

const FOOD_EMOJI_CATALOG = [
  // Each entry is data-driven (keywords array) — component does not hardcode behavior
  { emoji: '🍝', keywords: ['pasta', 'פסטה', 'פסטה'] },
  { emoji: '🍕', keywords: ['pizza', 'פּיצה', 'פיצה'] },
  { emoji: '🍔', keywords: ['burger', 'בורגר', 'המבורגר'] },
  { emoji: '🍗', keywords: ['chicken', 'עוף', 'עוף'] },
  { emoji: '🍰', keywords: ['cake', 'עוגה', 'עוגת'] },
  { emoji: '🍞', keywords: ['bread', 'לחם'] },
  { emoji: '🥗', keywords: ['salad', 'סלט'] },
  { emoji: '🍣', keywords: ['sushi', 'סושי'] },
  { emoji: '🍛', keywords: ['curry', 'תבשיל', 'קארי'] },
  { emoji: '🍜', keywords: ['ramen', 'מרק'] },
  { emoji: '🍪', keywords: ['cookie', 'עוגיה', 'עוגיות'] },
  { emoji: '🍩', keywords: ['donut', 'סופגניה'] },
  { emoji: '🍎', keywords: ['apple', 'תפוח'] },
  { emoji: '🍌', keywords: ['banana', 'בננה'] },
  { emoji: '🧁', keywords: ['cupcake', 'מאפה'] },
  { emoji: '🥐', keywords: ['croissant', 'מאפה', 'בצק'] },
  { emoji: '🍤', keywords: ['shrimp', 'שרימפ', 'שרימפס', 'בשרי'] },
  { emoji: '🍲', keywords: ['stew', 'מרק', 'תבשיל'] },
  { emoji: '🥪', keywords: ['sandwich', 'כריך'] },
  { emoji: '🍜', keywords: ['noodle', 'אטריות'] },
  { emoji: '🍨', keywords: ['ice', 'גלידה'] }
];

const GENERIC_FOOD_EMOJIS = [
  '🍽️','🍝','🍕','🍔','🍣','🍞','🥗','🍗','🍰','🍪','🍩','🍎','🍌','🥐','🧁','🍤','🍲','🥪','🍛','🍜'
];

function sanitizeText(text = '') {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').trim();
}

// Very small internal "translation" helper: map a few common Hebrew food-words to English tokens.
// This is intentionally conservative and local — the goal is to increase match-rate, not to be a full translator.
const HEBREW_TO_EN = {
  'עוגה': 'cake',
  'עוג': 'cake',
  'שוקולד': 'chocolate',
  'שוק': 'chocolate',
  'פסטה': 'pasta',
  'פנקייק': 'pancake',
  'פנק': 'pancake',
  'סלט': 'salad',
  'עוף': 'chicken',
  'לחם': 'bread',
  'בצק': 'dough',
  'בצקיות': 'pastry',
  'כופתאות': 'dumpling',
  'שניצל': 'schnitzel',
  'פיצה': 'pizza',
  'בורגר': 'burger',
  'פירה': 'mashed',
  'מרק': 'soup',
  'אטריות': 'noodle',
  'ארוחת': 'meal',
  'עוגיה': 'cookie',
  'סופגניה': 'donut',
  'גלידה': 'icecream',
  'תפוח': 'apple',
  'בננה': 'banana',
  'סושי': 'sushi'
};

function translateToEnglishInternal(text = '') {
  const clean = sanitizeText(text);
  if (!clean) return '';
  // If it already contains ASCII letters, assume it's English-ish and return simplified words
  if (/[a-z]/i.test(clean)) {
    return clean;
  }
  // Tokenize and map known Hebrew tokens
  const tokens = clean.split(/\s+/);
  const mapped = tokens.map(t => HEBREW_TO_EN[t] || t);
  return mapped.join(' ');
}

export function getEmojiForName(name) {
  const clean = sanitizeText(name);
  if (!clean) return randomFoodEmoji();

  const translated = translateToEnglishInternal(clean);
  const words = new Set((translated || clean).split(/\s+/).filter(Boolean));

  // Search catalog for a matching keyword (data-driven, not hardcoded in component)
  for (const entry of FOOD_EMOJI_CATALOG) {
    for (const kw of entry.keywords) {
      if (words.has(kw) || Array.from(words).some(w => w.includes(kw))) {
        return entry.emoji;
      }
    }
  }

  // Try partial matches against keywords
  for (const entry of FOOD_EMOJI_CATALOG) {
    for (const kw of entry.keywords) {
      for (const w of words) {
        if (w.includes(kw) || kw.includes(w)) return entry.emoji;
      }
    }
  }

  return randomFoodEmoji();
}

function randomFoodEmoji() {
  return GENERIC_FOOD_EMOJIS[Math.floor(Math.random() * GENERIC_FOOD_EMOJIS.length)];
}

export default { getEmojiForName, translateToEnglishInternal };