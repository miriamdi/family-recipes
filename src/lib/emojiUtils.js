// emojiUtils.js — modular emoji generation for recipe names
// - Translates/transforms the input name to English (best-effort, internal)
// - Tries to match keywords against a food-emoji catalog
// - Falls back to a random food emoji

const FOOD_EMOJI_CATALOG = [
  // Expanded food emoji catalog with keywords (English + Hebrew common tokens)
  { emoji: '🍝', keywords: ['pasta', 'פסטה'] },
  { emoji: '🍕', keywords: ['pizza', 'פיצה'] },
  { emoji: '🍔', keywords: ['burger', 'בורגר', 'המבורגר'] },
  { emoji: '🍗', keywords: ['chicken', 'עוף'] },
  { emoji: '🍖', keywords: ['meat', 'בשר', 'סטייק'] },
  { emoji: '🍤', keywords: ['shrimp', 'שרימפ', 'שימפ'] },
  { emoji: '🍣', keywords: ['sushi', 'סושי'] },
  { emoji: '🍱', keywords: ['bento', 'בן(ט)ו'] },
  { emoji: '🍛', keywords: ['curry', 'תבשיל', 'קארי'] },
  { emoji: '🍲', keywords: ['stew', 'מרק', 'תבשיל'] },
  { emoji: '🍜', keywords: ['ramen', 'noodle', 'מרק', 'אטריות'] },
  { emoji: '🍚', keywords: ['rice', 'אורז'] },
  { emoji: '🍞', keywords: ['bread', 'לחם'] },
  { emoji: '🥐', keywords: ['croissant', 'מאפה', 'בצק'] },
  { emoji: '🥯', keywords: ['bagel', 'בייגל'] },
  { emoji: '🥖', keywords: ['baguette', 'באגל', 'לחם'] },
  { emoji: '🧀', keywords: ['cheese', 'גבינה'] },
  { emoji: '🍳', keywords: ['egg', 'ביצה', 'ביצים'] },
  { emoji: '🥚', keywords: ['egg', 'ביצה'] },
  { emoji: '🥓', keywords: ['bacon', 'בקון'] },
  { emoji: '🥩', keywords: ['steak', 'סטייק'] },
  { emoji: '🍟', keywords: ['fries', 'צ' + 'יפס', 'ציפס'] },
  { emoji: '🌭', keywords: ['hotdog', 'נקניקיה'] },
  { emoji: '🍿', keywords: ['popcorn', 'פופקורן'] },
  { emoji: '🍿', keywords: ['popcorn', 'פופקורן'] },
  { emoji: '🧂', keywords: ['salt', 'מלח'] },
  { emoji: '🍰', keywords: ['cake', 'עוגה', 'עוגת'] },
  { emoji: '🎂', keywords: ['birthday cake', 'עוגת יום הולדת'] },
  { emoji: '🧁', keywords: ['cupcake', 'קאפקייק', 'מאפה'] },
  { emoji: '🍪', keywords: ['cookie', 'עוגיה', 'עוגיות'] },
  { emoji: '🍩', keywords: ['donut', 'סופגניה'] },
  { emoji: '🍨', keywords: ['icecream', 'גלידה'] },
  { emoji: '🍦', keywords: ['soft serve', 'גלידה'] },
  { emoji: '🍮', keywords: ['custard', 'פודינג'] },
  { emoji: '🍫', keywords: ['chocolate', 'שוקולד'] },
  { emoji: '🍬', keywords: ['candy', 'סוכריה'] },
  { emoji: '🍭', keywords: ['lollipop', 'סוכריה'] },
  { emoji: '🍯', keywords: ['honey', 'דבש'] },
  { emoji: '🍎', keywords: ['apple', 'תפוח'] },
  { emoji: '🍏', keywords: ['green apple', 'תפוח'] },
  { emoji: '🍐', keywords: ['pear', 'אגס'] },
  { emoji: '🍊', keywords: ['orange', 'תפוז'] },
  { emoji: '🍋', keywords: ['lemon', 'לימון'] },
  { emoji: '🍌', keywords: ['banana', 'בננה'] },
  { emoji: '🍉', keywords: ['watermelon', 'אבטיח'] },
  { emoji: '🍇', keywords: ['grape', 'ענבים'] },
  { emoji: '🍓', keywords: ['strawberry', 'תות'] },
  { emoji: '🍒', keywords: ['cherry', 'דובדבן'] },
  { emoji: '🍑', keywords: ['peach', 'אפרסק'] },
  { emoji: '🥭', keywords: ['mango', 'מנגו'] },
  { emoji: '🍍', keywords: ['pineapple', 'אננס'] },
  { emoji: '🥭', keywords: ['mango', 'מנגו'] },
  { emoji: '🥑', keywords: ['avocado', 'אבוקדו'] },
  { emoji: '🥦', keywords: ['broccoli', 'ברוקולי'] },
  { emoji: '🥬', keywords: ['lettuce', 'חסה'] },
  { emoji: '🥒', keywords: ['cucumber', 'מלפפון'] },
  { emoji: '🌶️', keywords: ['pepper', 'פלפל'] },
  { emoji: '🫑', keywords: ['pepper', 'פלפל'] },
  { emoji: '🥕', keywords: ['carrot', 'גזר'] },
  { emoji: '🧄', keywords: ['garlic', 'שום'] },
  { emoji: '🧅', keywords: ['onion', 'בצל'] },
  { emoji: '🥔', keywords: ['potato', 'תפוח אדמה', 'בטטה'] },
  { emoji: '🍠', keywords: ['sweet potato', 'בטטה'] },
  { emoji: '🥯', keywords: ['bagel', 'בייגל'] },
  { emoji: '🥨', keywords: ['pretzel', 'פרצל'] },
  { emoji: '🫓', keywords: ['flatbread', 'פיתה'] },
  { emoji: '🥟', keywords: ['dumpling', 'כופתא'] },
  { emoji: '🫔', keywords: ['tamale', 'טמאלה'] },
  { emoji: '🌮', keywords: ['taco', 'טאקו'] },
  { emoji: '🌯', keywords: ['burrito', 'בוריטו'] },
  { emoji: '🥪', keywords: ['sandwich', 'כריך'] },
  { emoji: '🫙', keywords: ['jar', 'צנצנת'] },
  { emoji: '🍤', keywords: ['fried shrimp', 'שרימפ'] },
  { emoji: '🍖', keywords: ['meat', 'בשר'] },
  { emoji: '🍗', keywords: ['chicken', 'עוף'] },
  { emoji: '🍳', keywords: ['fry', 'ביצים', 'ביצה'] },
  { emoji: '🍽️', keywords: ['meal', 'ארוחה'] }
];

const GENERIC_FOOD_EMOJIS = [
  '🍽️','🍝','🍕','🍔','🍟','🍗','🍖','🍤','🍣','🍱','🍛','🍲','🍜','🍚','🍙','🍞','🥐','🥯','🥖','🧀','🍳','🥓','🥩','🌭','🥪','🌮','🌯','🥗','🥘','🥫','🍿','🧂','🍰','🎂','🧁','🍪','🍩','🍨','🍦','🍫','🍬','🍭','🍯','🍎','🍏','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🍑','🥭','🍍','🥝','🥑','🥦','🥬','🥒','🌶️','🫑','🥕','🧄','🧅','🥔','🍠','🥟','🫓','🥨','🥯','🍮'
];

function sanitizeText(text = '') {
  // Keep implementation CI-safe: allow ASCII letters/digits and Hebrew range, normalize punctuation to spaces.
  // Avoid Unicode property escapes (\p{...}) to stay compatible with older/tooling JS parsers.
  return String(text || '').toLowerCase().replace(/[^0-9a-z\u0590-\u05FF\s]+/g, ' ').trim();
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

// Known emojis we generate from (used for simple, deterministic checks).
const KNOWN_EMOJIS = Array.from(new Set([
  ...GENERIC_FOOD_EMOJIS,
  ...FOOD_EMOJI_CATALOG.map(e => e.emoji)
])).sort((a, b) => b.length - a.length); // longer first to match ZWJ/VS sequences first

// Extract a leading emoji from a string if it matches one of our KNOWN_EMOJIS.
// Returns the emoji string or null. (NO use of Unicode property escapes)
export function extractLeadingEmoji(text = '') {
  if (!text || typeof text !== 'string') return null;
  const s = text.trimStart();
  for (const emoji of KNOWN_EMOJIS) {
    if (s.startsWith(emoji)) return emoji;
  }
  return null;
}

// Remove a leading emoji from the string if it matches our known list; otherwise return unchanged.
export function stripLeadingEmoji(text = '') {
  if (!text || typeof text !== 'string') return text;
  const s = text.trimStart();
  const e = extractLeadingEmoji(s);
  if (!e) return text;
  return s.slice(e.length).trimStart();
}

export default { getEmojiForName, translateToEnglishInternal, extractLeadingEmoji, stripLeadingEmoji };