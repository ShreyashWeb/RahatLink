import type { Household, Report, ParsedReport, RiskTier } from './types';

export interface ParseOptions {
  households?: Household[];
  landmarks?: { name: string; lat: number; lng: number }[];
}

export interface ParseResult extends ParsedReport {
  lat?: number;
  lng?: number;
  rawText: string;
}

// Word to number mappings for Hindi, Hinglish, and English
const NUMBER_WORDS: Record<string, number> = {
  // English
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  // Hindi / Hinglish
  ek: 1,
  do: 2,
  teen: 3,
  tin: 3,
  chaar: 4,
  char: 4,
  paanch: 5,
  panch: 5,
  chhah: 6,
  chhe: 6,
  che: 6,
  saat: 7,
  sat: 7,
  aath: 8,
  ath: 8,
  nau: 9,
  no: 9,
  das: 10,
  dus: 10,
  gyarah: 11,
  barah: 12,
  pandrah: 15,
  bees: 20,
};

// Urgency keywords
const HIGH_URGENCY_KEYWORDS = [
  'urgent',
  'urgnt',
  'jaldi',
  'jldi',
  'turant',
  'turnt',
  'emergency',
  'emrgncy',
  'help',
  'hlp',
  'bachao',
  'bchao',
  'bachaoo',
  'critical',
  'sos',
  'khatra',
  'khatre',
  'danger',
  'sunk',
  'submerged',
  'chhat',
  'roof',
  'dub',
  'doob',
  'sar tak',
  'unconscious',
  'behosh',
  'mar rahe',
];

const MEDIUM_URGENCY_KEYWORDS = [
  'paani badh',
  'pani badh',
  'water level high',
  'water level rising',
  'water rising',
  'stuck',
  'phans',
  'fans',
  'fas',
  'attak',
  'trapped',
  'paani aa',
  'pani aa',
  'no food',
  'no water',
  'dawa',
  'medicine',
  'insulin',
  'elderly',
  'pregnant',
];

// Need classification dictionaries
const NEED_KEYWORDS: Record<string, string[]> = {
  rescue: [
    'rescue',
    'bachao',
    'bchao',
    'phans',
    'fans',
    'fas',
    'trapped',
    'boat',
    'naav',
    'chhat',
    'roof',
    'nikalo',
    'nikal',
    'doob',
    'dub',
    'help',
  ],
  medical: [
    'medical',
    'medicine',
    'medicines',
    'dawa',
    'dawaii',
    'dawai',
    'insulin',
    'diabetic',
    'diabetes',
    'sugar',
    'bp',
    'blood pressure',
    'doctor',
    'bimar',
    'beemar',
    'sick',
    'heart',
    'oxygen',
    'inhaler',
    'asthma',
    'bleed',
    'chot',
    'injury',
    'wound',
    'pregnant',
  ],
  water: [
    'water',
    'paani',
    'pani',
    'peene ka paani',
    'peene ka pani',
    'drinking water',
    'pyas',
    'pyaas',
    'clean water',
  ],
  food: [
    'food',
    'khana',
    'khaana',
    'ration',
    'rashan',
    'roti',
    'bhookhe',
    'bhookh',
    'hungry',
    'meals',
    'biscuit',
  ],
  'mobility-assist': [
    'wheelchair',
    'chal nahi',
    'bedridden',
    'elderly',
    'buzurg',
    'buddhe',
    'disabled',
    'paralyzed',
    'mobility',
  ],
  boat: [
    'boat',
    'naav',
    'dinghy',
    'flooded street',
    'deep water',
  ],
};

/**
 * Normalizes text for robust matching:
 * lowercase, removes non-alphanumeric punctuation except periods/commas for coordinates
 */
function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes cleaned text into distinct words
 */
function tokenize(text: string): string[] {
  return cleanText(text).split(' ').filter(Boolean);
}

/**
 * Computes Levenshtein distance between two strings
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Computes fuzzy string similarity in range [0, 1]
 */
function similarity(a: string, b: string): number {
  const normA = cleanText(a);
  const normB = cleanText(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;

  const maxLen = Math.max(normA.length, normB.length);
  const dist = levenshtein(normA, normB);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Extracts explicit coordinates (e.g. "26.8467, 80.9462" or "lat: 26.85, lng: 80.94")
 */
function extractCoordinates(text: string): [number, number] | null {
  const coordRegex = /(-?\d{1,2}\.\d{3,7})\s*,\s*(-?\d{1,3}\.\d{3,7})/;
  const match = text.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }
  return null;
}

/**
 * Extracts people count from digits or Hinglish / English number words
 */
function extractPeopleCount(text: string): number {
  const cleaned = cleanText(text);

  // Pattern 1: Digits + explicit person indicator (e.g. "3 log", "4 people", "5 members", "family of 4")
  const digitWithKeyword = cleaned.match(/\b(\d{1,2})\s*(?:log|people|person|persons|members|jan|aadmi|family|bachhe|bacche|senior)\b/);
  if (digitWithKeyword && parseInt(digitWithKeyword[1], 10) > 0) {
    return Math.min(50, parseInt(digitWithKeyword[1], 10));
  }

  // Pattern 2: Word + context (e.g. "teen log", "chaar members", "do log phans gaye")
  const tokens = tokenize(cleaned);
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    if (NUMBER_WORDS[word] !== undefined) {
      const nextWord = tokens[i + 1];
      if (
        nextWord &&
        ['log', 'people', 'person', 'persons', 'members', 'jan', 'aadmi', 'family', 'bachhe', 'bacche'].includes(nextWord)
      ) {
        return NUMBER_WORDS[word];
      }
    }
  }

  // Pattern 3: Number word followed immediately by need/state (e.g. "paanch log", "do log")
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    if (NUMBER_WORDS[word] !== undefined) {
      const nextWord = tokens[i + 1];
      if (
        nextWord &&
        ['phans', 'fans', 'fas', 'trapped', 'wheelchair', 'bimar', 'chhat'].includes(nextWord)
      ) {
        return NUMBER_WORDS[word];
      }
    }
  }

  // Pattern 4: Lone digit if under 20 and not preceded by sector/house/plot
  const loneDigit = cleaned.match(/(?<!(?:sector|sec|house|plot|lane)\s*)\b([1-9]|1[0-9])\b/);
  if (loneDigit) {
    return parseInt(loneDigit[1], 10);
  }

  return 1; // Default 1 person
}

/**
 * Extracts need categories from text
 */
function extractNeeds(text: string): string[] {
  const cleaned = cleanText(text);
  const identifiedNeeds = new Set<string>();

  for (const [category, keywords] of Object.entries(NEED_KEYWORDS)) {
    for (const kw of keywords) {
      if (cleaned.includes(kw)) {
        identifiedNeeds.add(category);
        break;
      }
    }
  }

  if (identifiedNeeds.size === 0) {
    identifiedNeeds.add('rescue'); // Default general assistance
  }

  return Array.from(identifiedNeeds);
}

/**
 * Derives urgency tier from keywords
 */
function deriveUrgency(text: string): RiskTier {
  const cleaned = cleanText(text);

  for (const kw of HIGH_URGENCY_KEYWORDS) {
    if (cleaned.includes(kw)) {
      return 'HIGH';
    }
  }

  for (const kw of MEDIUM_URGENCY_KEYWORDS) {
    if (cleaned.includes(kw)) {
      return 'MEDIUM';
    }
  }

  return 'LOW';
}

/**
 * Matches extracted text to known households and landmarks using token and substring heuristics
 */
function matchLocation(
  text: string,
  households: Household[] = [],
  landmarks: { name: string; lat: number; lng: number }[] = [],
): {
  locationHint?: string;
  matchedHousehold?: Household;
  matchedCoordinates?: [number, number];
  locationConfidence: number;
} {
  const coords = extractCoordinates(text);
  if (coords) {
    return {
      locationHint: `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`,
      matchedCoordinates: coords,
      locationConfidence: 0.95,
    };
  }

  const cleaned = cleanText(text);
  let bestMatch: Household | undefined = undefined;
  let highestScore = 0;
  let bestHint = '';

  for (const h of households) {
    // Test 1: Full name and surname (e.g. "Sharma Residence", "Verma")
    const nameTokens = tokenize(h.name);
    for (const token of nameTokens) {
      if (token.length > 3 && cleaned.includes(token)) {
        const score = 0.75;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = h;
          bestHint = h.name;
        }
      }
    }

    // Test 2: Address keywords / significant landmarks (e.g. "Gomti Nagar", "Sector 5", "House 12", "Riverbank")
    const addrTokens = h.address.split(',').map((s) => cleanText(s));
    for (const part of addrTokens) {
      if (part.length > 4 && cleaned.includes(part)) {
        const score = 0.85;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = h;
          bestHint = part;
        }
      }
    }

    // Check individual significant address keywords (e.g. "riverbank", "bridge")
    const significantWords = tokenize(h.address).filter(
      (w) => w.length >= 5 && !['nagar', 'gomti', 'house', 'sector'].includes(w),
    );
    for (const word of significantWords) {
      if (cleaned.includes(word)) {
        const score = 0.8;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = h;
          bestHint = word;
        }
      }
    }

    // Test 3: Specific Sector mentions (e.g. "sector 5", "sec 5")
    const secMatch = h.address.match(/sector\s*(\d+)/i);
    if (secMatch) {
      const secNum = secMatch[1];
      if (cleaned.includes(`sector ${secNum}`) || cleaned.includes(`sec ${secNum}`)) {
        const score = 0.8;
        if (score > highestScore) {
          highestScore = score;
          bestMatch = h;
          bestHint = `Sector ${secNum}`;
        }
      }
    }
  }

  // Also check landmarks
  if (landmarks && landmarks.length > 0) {
    for (const lm of landmarks) {
      const lmClean = cleanText(lm.name);
      if (cleaned.includes(lmClean)) {
        if (0.85 > highestScore) {
          highestScore = 0.85;
          bestHint = lm.name;
          return {
            locationHint: bestHint,
            matchedCoordinates: [lm.lat, lm.lng],
            locationConfidence: highestScore,
          };
        }
      }
    }
  }

  // Fallback: extract generic area mention from text if no known household matched
  if (!bestHint) {
    const areaMatch = text.match(/\b(sector\s*\d+|gomti\s*nagar|riverbank|vikas\s*nagar|hazratganj|aliganj)\b/i);
    if (areaMatch) {
      bestHint = areaMatch[0];
      highestScore = 0.5;
    }
  }

  return {
    locationHint: bestHint || (bestMatch ? bestMatch.address : undefined),
    matchedHousehold: bestMatch,
    matchedCoordinates: bestMatch ? [bestMatch.lat, bestMatch.lng] : undefined,
    locationConfidence: highestScore,
  };
}

/**
 * Main parser function:
 * Pure, rule-based Hinglish + English parser for messy SMS distress messages.
 */
export function parseSmsReport(
  text: string,
  options: ParseOptions = {},
): ParseResult {
  const { households = [], landmarks = [] } = options;

  if (!text || !text.trim()) {
    return {
      rawText: text || '',
      type: 'sms-distress',
      urgency: 'LOW',
      needs: ['rescue'],
      peopleCount: 1,
      confidence: 0.1,
      explanation: 'Empty or blank message received.',
    };
  }

  const urgency = deriveUrgency(text);
  const needs = extractNeeds(text);
  const peopleCount = extractPeopleCount(text);
  const locMatch = matchLocation(text, households, landmarks);

  // Compute confidence (0.0 to 1.0)
  let confidence = 0.4; // Base score for non-empty SMS

  if (urgency === 'HIGH') confidence += 0.2;
  else if (urgency === 'MEDIUM') confidence += 0.1;

  if (needs.length > 1 || (needs.length === 1 && needs[0] !== 'rescue')) {
    confidence += 0.15;
  }

  if (locMatch.locationConfidence > 0) {
    confidence += locMatch.locationConfidence * 0.25;
  }

  confidence = Math.min(0.98, Math.max(0.2, parseFloat(confidence.toFixed(2))));

  // Generate explanation sentence
  const explanationParts: string[] = [];
  explanationParts.push(`Urgency: ${urgency}`);
  if (needs.length > 0) explanationParts.push(`Needs: ${needs.join(', ')}`);
  explanationParts.push(`Estimated: ${peopleCount} person(s)`);
  if (locMatch.matchedHousehold) {
    explanationParts.push(`Matched to ${locMatch.matchedHousehold.name} (${Math.round(locMatch.locationConfidence * 100)}% match)`);
  } else if (locMatch.locationHint) {
    explanationParts.push(`Location clue: ${locMatch.locationHint}`);
  }

  return {
    rawText: text,
    type: 'sms-distress',
    urgency,
    needs,
    peopleCount,
    locationHint: locMatch.locationHint,
    matchedHouseholdId: locMatch.matchedHousehold?.id,
    confidence,
    explanation: explanationParts.join(' | '),
    lat: locMatch.matchedCoordinates ? locMatch.matchedCoordinates[0] : undefined,
    lng: locMatch.matchedCoordinates ? locMatch.matchedCoordinates[1] : undefined,
  };
}

/**
 * Creates a fully-populated Report instance from an incoming SMS payload
 */
export function createReportFromSms(
  from: string,
  text: string,
  households: Household[] = [],
): Report {
  const parsed = parseSmsReport(text, { households });

  return {
    id: `rep-sms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    at: new Date().toISOString(),
    from: from || 'unknown',
    text,
    source: 'sms',
    status: parsed.matchedHouseholdId ? 'linked' : 'pending',
    lat: parsed.lat,
    lng: parsed.lng,
    parsed: {
      type: parsed.type,
      urgency: parsed.urgency,
      needs: parsed.needs,
      matchedHouseholdId: parsed.matchedHouseholdId,
      peopleCount: parsed.peopleCount,
      locationHint: parsed.locationHint,
      confidence: parsed.confidence,
      explanation: parsed.explanation,
    },
  };
}
