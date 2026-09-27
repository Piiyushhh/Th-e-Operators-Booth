import { ParsedNotice, SupportedLanguage } from './types.js';
import { ParsedNoticeSchema } from './schemas.js';

// Station mappings for Indian Railways stations (especially Central / Western / Pan-India)
const KNOWN_STATIONS: Record<string, string> = {
  // English station codes and names
  'PUNE': 'PUNE',
  'PUNE JN': 'PUNE',
  'PUNE JUNCTION': 'PUNE',
  'CSMT': 'CSMT',
  'CSTM': 'CSMT',
  'MUMBAI CSMT': 'CSMT',
  'MUMBAI': 'CSMT',
  'LNL': 'LNL',
  'LONAVALA': 'LNL',
  'LONAWALA': 'LNL',
  'KYN': 'KYN',
  'KALYAN': 'KYN',
  'KALYAN JN': 'KYN',
  'MMR': 'MMR',
  'MANMAD': 'MMR',
  'MANMAD JN': 'MMR',
  'BSL': 'BSL',
  'BHUSAVAL': 'BSL',
  'BHUSAWAL': 'BSL',
  'DD': 'DD',
  'DAUND': 'DD',
  'DAUND JN': 'DD',
  'SUR': 'SUR',
  'SOLAPUR': 'SUR',
  'SHOLAPUR': 'SUR',
  'TNA': 'TNA',
  'THANE': 'TNA',
  'DR': 'DR',
  'DADAR': 'DR',
  'NGP': 'NGP',
  'NAGPUR': 'NGP',
  'KOP': 'KOP',
  'KOLHAPUR': 'KOP',
  'PVR': 'PVR',
  'PANDHARPUR': 'PVR',
  'STR': 'STR',
  'SATARA': 'STR',
  'MRJ': 'MRJ',
  'MIRAJ': 'MRJ',
  'SNSI': 'SNSI',
  'SAINAGAR SHIRDI': 'SNSI',
  'SHIRDI': 'SNSI',
  'IGP': 'IGP',
  'IGATPURI': 'IGP',
  'NK': 'NK',
  'NASHIK': 'NK',
  'NASIK': 'NK',
  'NASHIK ROAD': 'NK',
  'NDLS': 'NDLS',
  'NEW DELHI': 'NDLS',
  'DELHI': 'NDLS',
  'HWH': 'HWH',
  'HOWRAH': 'HWH',
  'MAS': 'MAS',
  'CHENNAI': 'MAS',
  'SBC': 'SBC',
  'BENGALURU': 'SBC',
  'BANGALORE': 'SBC',
  'HYB': 'HYB',
  'HYDERABAD': 'HYB',
  'SC': 'SC',
  'SECUNDERABAD': 'SC',
  'GKP': 'GKP',
  'GORAKHPUR': 'GKP',
  'PNBE': 'PNBE',
  'PATNA': 'PNBE',
  'ADI': 'ADI',
  'AHMEDABAD': 'ADI',
  'BSR': 'BSR',
  'VASAI ROAD': 'BSR',
  'PNVL': 'PNVL',
  'PANVEL': 'PNVL',

  // Marathi / Hindi Devanagari station names
  'पुणे': 'PUNE',
  'पुणे जंक्शन': 'PUNE',
  'सीएसएमटी': 'CSMT',
  'मुंबई': 'CSMT',
  'मुंबई सीएसएमटी': 'CSMT',
  'लोणावळा': 'LNL',
  'लोनावला': 'LNL',
  'कल्याण': 'KYN',
  'कल्याण जंक्शन': 'KYN',
  'मनमाड': 'MMR',
  'मनमाड जंक्शन': 'MMR',
  'भुसावळ': 'BSL',
  'भुसावल': 'BSL',
  'दौंड': 'DD',
  'दौंड जंक्शन': 'DD',
  'सोलापूर': 'SUR',
  'ठाणे': 'TNA',
  'दादर': 'DR',
  'नागपूर': 'NGP',
  'कोल्हापूर': 'KOP',
  'पंढरपूर': 'PVR',
  'सातारा': 'STR',
  'मिरज': 'MRJ',
  'शिर्डी': 'SNSI',
  'साईनगर शिर्डी': 'SNSI',
  'इगतपुरी': 'IGP',
  'नाशिक': 'NK',
  'नाशिक रोड': 'NK',
  'नासिक': 'NK',
  'नवी दिल्ली': 'NDLS',
  'हावडा': 'HWH',
  'चेन्नई': 'MAS',
  'बंगळुरू': 'SBC',
  'बेंगलुरु': 'SBC',
  'हैदराबाद': 'HYB',
  'सिकंदराबाद': 'SC',
  'गोरखपुर': 'GKP',
  'गोरखपूर': 'GKP',
  'पटना': 'PNBE',
  'अहमदाबाद': 'ADI',
  'पनवेल': 'PNVL'
};

const NON_STATION_WORDS = new Set([
  'EXP', 'TRN', 'HRS', 'MIN', 'DUE', 'NEW', 'TIME', 'LATE', 'THE', 'AND', 'FOR', 'NOT',
  'OUT', 'OFF', 'NOW', 'DAY', 'RUN', 'ALL', 'SEE', 'GET', 'SET', 'PER', 'END', 'RAW',
  'BAD', 'TAG', 'TOP', 'BOX', 'WHY', 'HOW', 'WHO', 'YES', 'NO', 'STN', 'AT',
  'BY', 'IS', 'IN', 'ON', 'TO', 'UP', 'DOWN', 'CAUSE', 'REASON', 'NOTICE', 'SPECIAL',
  'EXPEC', 'ARRIV', 'DEPAR', 'FROM'
]);

// Devanagari numerals to ASCII conversion
const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

export function normalizeDevanagariDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] || d);
}

export function detectLanguage(text: string): SupportedLanguage {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);

  if (hasDevanagari && hasLatin) {
    return 'mixed';
  }
  if (hasDevanagari) {
    if (/आहे|येईल|वाजता|स्थानकावर|उशीर|झाला|झाली|बिघाड|दुरुस्ती|पावसामुळे|तास|मिनिटे/.test(text)) {
      return 'mr';
    }
    return 'hi';
  }
  return 'en';
}

export class ParseError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = 'PARSE_FAILED', details?: unknown) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Extracts 4 to 6 digit train number from notice
 */
function extractTrainNumber(text: string, normalizedText: string): string | null {
  const keywordPatterns = [
    /(?:train|trn|exp|express|गाडी|ट्रेन|गाडी\s*क्र\.?|ट्रेन\s*(?:नंबर|नं\.?)|गाड़ी\s*(?:संख्या|नं\.?))\s*[:#.-]?\s*(\d{4,6})/i,
    /(\d{4,6})\s*(?:exp|express|एक्सप्रेस|डेक्कन|हुतात्मा|कोणार्क|इंद्रायणी|सुपरफास्ट)/i,
    /(?:^|\s)#?(\d{5})(?:\s|$|[^\d])/
  ];

  for (const pattern of keywordPatterns) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Fallback: any standalone 4 to 6 digit number that doesn't conflict with times
  const standaloneMatches = normalizedText.matchAll(/\b(\d{4,6})\b/g);
  for (const match of standaloneMatches) {
    const num = match[1];
    if (num.length >= 5) {
      return num;
    }
    if (num.length === 4 && !/^(?:[01]\d|2[0-3])[0-5]\d$/.test(num)) {
      return num;
    }
  }

  return null;
}

/**
 * Extracts station code / name
 */
function extractStation(text: string, normalizedText: string): string | null {
  // 1. Explicit tagged station patterns (highest priority)
  const tagPatterns = [
    /\b(?:at)\b\s+([A-Za-z]{2,5}|[\u0900-\u097F]+)\s+(?:station|stn|स्थानकावर|स्थानक|स्टेशन)/i,
    /\b([A-Za-z]{2,5}|[\u0900-\u097F]+)\s+(?:station|stn|स्थानकावर|स्थानक|स्थानकावरून|स्थानकी|स्टेशन|येथे|पर)\b/i,
    /\b(?:station|stn|स्थानक|स्थानकावर|स्थानक:|स्टेशन|स्टेशन:|arriving|reach)\b\s*[:.-]?\s*([A-Za-z]{2,5}|[\u0900-\u097F]+)/i,
    /\(([A-Za-z]{2,5}|[\u0900-\u097F]+)\)/ // e.g. (PUNE), (CSMT)
  ];

  for (const pattern of tagPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const upper = candidate.toUpperCase();
      if (KNOWN_STATIONS[upper]) {
        return KNOWN_STATIONS[upper];
      }
      if (KNOWN_STATIONS[candidate]) {
        return KNOWN_STATIONS[candidate];
      }
      if (/^[A-Z]{2,5}$/.test(upper) && !NON_STATION_WORDS.has(upper)) {
        return upper;
      }
    }
  }

  // 2. Dictionary match against full text (checking longest / specific names first)
  const sortedKeys = Object.keys(KNOWN_STATIONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const isAscii = /^[A-Z0-9 ]+$/i.test(key);
    if (isAscii) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(text)) {
        return KNOWN_STATIONS[key];
      }
    } else {
      if (text.includes(key)) {
        return KNOWN_STATIONS[key];
      }
    }
  }

  return null;
}

/**
 * Extracts and standardizes expected time (e.g. 14:30)
 */
function extractExpectedTime(text: string, normalizedText: string): string | null {
  const timePatterns = [
    /(?:expected|arrival|time|exp\s*time|new\s*time|अपेक्षित|वेळ|वाजता|पहुंचेगी|समय)\s*[:.-]?\s*([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*(am|pm|hrs|hours|बजे))?/i,
    /([01]?\d|2[0-3])[:.]([0-5]\d)\s*(am|pm|hrs|hours|वाजता|बजे)/i,
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/,
    /(?:\bat|@)\s*([01]?\d|2[0-3])[:.]([0-5]\d)/i
  ];

  for (const pattern of timePatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const modifier = match[3]?.toLowerCase();

      if (modifier === 'pm' && hours < 12) {
        hours += 12;
      } else if (modifier === 'am' && hours === 12) {
        hours = 0;
      }

      const formattedHours = hours.toString().padStart(2, '0');
      return `${formattedHours}:${minutes}`;
    }
  }

  // Check 4-digit time like 1430 hrs
  const fourDigitMatch = normalizedText.match(/\b([01]\d|2[0-3])([0-5]\d)\s*(?:hrs|hours|वाजता)\b/i);
  if (fourDigitMatch) {
    return `${fourDigitMatch[1]}:${fourDigitMatch[2]}`;
  }

  return null;
}

/**
 * Extracts delay minutes if mentioned (English, Marathi, Hindi)
 */
function extractDelay(text: string, normalizedText: string): { minutes: number | null; text: string | null } {
  // 1. Hours + minutes: e.g. "delay: 1 hr 15 min", "1 तास 30 मिनिटे", "1 घंटा 30 मिनट"
  const hrMinMatch =
    normalizedText.match(/(?:delay(?:ed)?(?:\s+by)?|late(?:\s+by)?|उशीर(?:\s*:)?|देरी(?:\s*:)?)\s*[:.-]?\s*(\d+)\s*(?:hr|hour|hours|तास|घंटे|घंटा)\s*(?:and|व|आणि)?\s*(\d+)?\s*(?:m|min|mins|minute|minutes|मिनिटे|मिनिट|मिनट)?/i) ||
    normalizedText.match(/(\d+)\s*(?:hr|hour|hours|तास|घंटे|घंटा)\s*(?:and|व|आणि)?\s*(\d+)\s*(?:m|min|mins|minute|minutes|मिनिटे|मिनिट|मिनट)?\s*(?:delay|delayed|late|उशीर|देरी)/i);

  if (hrMinMatch) {
    const hours = parseInt(hrMinMatch[1], 10);
    const mins = hrMinMatch[2] ? parseInt(hrMinMatch[2], 10) : 0;
    const totalMinutes = (hours * 60) + mins;
    return {
      minutes: totalMinutes,
      text: `${hours} hr${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`
    };
  }

  // 2. Minutes with prefix: "delayed by 45 mins", "delay 30m", "उशीर ४५ मिनिटे", "उशीर: ३० मिनिटे", "देरी: 45 मिनट"
  const minPrefixMatch = normalizedText.match(/(?:delay(?:ed)?(?:\s+by)?|late(?:\s+by)?|उशीर(?:\s*:)?|देरी(?:\s*:)?)\s*[:.-]?\s*(\d+)\s*(?:m|min|mins|minute|minutes|मिनिटे|मिनिट|मिनट)?(?:\s|$|[^0-9a-zA-Z\u0900-\u097F])/i);
  if (minPrefixMatch && minPrefixMatch[1]) {
    const mins = parseInt(minPrefixMatch[1], 10);
    return { minutes: mins, text: `${mins} minutes` };
  }

  // 3. Minutes with suffix: "45 mins delayed", "30 मिनट देरी", "४५ मिनिटे उशीर"
  const minSuffixMatch = normalizedText.match(/(\d+)\s*(?:m|min|mins|minute|minutes|मिनिटे|मिनिट|मिनट)\s*(?:delay|delayed|late|उशीर|देरी)?(?:\s|$|[^0-9a-zA-Z\u0900-\u097F])/i);
  if (minSuffixMatch && minSuffixMatch[1]) {
    const mins = parseInt(minSuffixMatch[1], 10);
    return { minutes: mins, text: `${mins} minutes` };
  }

  // 4. Hours with prefix: "delayed by 2 hours", "late 2 hrs", "उशीर: २ तास", "देरी: 1 घंटा"
  const hrPrefixMatch = normalizedText.match(/(?:delay(?:ed)?(?:\s+by)?|late(?:\s+by)?|उशीर(?:\s*:)?|देरी(?:\s*:)?)\s*[:.-]?\s*(\d+)\s*(?:hr|hour|hours|तास|घंटे|घंटा)(?:\s|$|[^0-9a-zA-Z\u0900-\u097F])/i);
  if (hrPrefixMatch && hrPrefixMatch[1]) {
    const hours = parseInt(hrPrefixMatch[1], 10);
    return { minutes: hours * 60, text: `${hours} hour${hours > 1 ? 's' : ''}` };
  }

  // 5. Hours with suffix: "2 hours late", "२ तास उशीर", "1 घंटा देरी"
  const hrSuffixMatch = normalizedText.match(/(\d+)\s*(?:hr|hour|hours|तास|घंटे|घंटा)\s*(?:delay|delayed|late|उशीर|देरी)(?:\s|$|[^0-9a-zA-Z\u0900-\u097F])/i);
  if (hrSuffixMatch && hrSuffixMatch[1]) {
    const hours = parseInt(hrSuffixMatch[1], 10);
    return { minutes: hours * 60, text: `${hours} hour${hours > 1 ? 's' : ''}` };
  }

  return { minutes: null, text: null };
}

/**
 * Extracts reason if present in English, Hindi, or Marathi
 */
function extractReason(text: string): string | null {
  const reasonPrefixes = [
    /(?:due\s+to|reason\s*[:.-]|cause\s*[:.-]|because\s+of)\s*([^,;.)]+)/i,
    /(?:कारण\s*[:.-]?|वजह\s*[:.-]?)\s*([^,;.)]+)/i,
    /(?:के\s*कारण|मुळे|पावसामुळे)\s*([^,;.)]+)/i
  ];

  for (const pattern of reasonPrefixes) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const reason = match[1].trim();
      if (reason.length > 2 && !/^(late|delayed|\d+)/i.test(reason)) {
        return reason;
      }
    }
  }

  const knownReasons = [
    { pattern: /(?:signal\s+(?:failure|issue|problem)|सिग्नल\s+(?:बिघाड|खराबी))/i, text: 'Signal failure' },
    { pattern: /(?:track\s+(?:maintenance|repair|fracture)|ट्रॅक\s+(?:दुरुस्ती|दुरुस्त))/i, text: 'Track maintenance' },
    { pattern: /(?:heavy\s+rain|waterlogging|पावसामुळे|भारी\s+बारिश)/i, text: 'Heavy rainfall / Waterlogging' },
    { pattern: /(?:engine\s+(?:failure|trouble)|इंजिन\s+बिघाड|इंजन\s+खराबी)/i, text: 'Engine failure' },
    { pattern: /(?:technical\s+(?:issue|snag|problem)|तांत्रिक\s+बिघाड|तकनीकी\s+खराबी)/i, text: 'Technical issue' },
    { pattern: /(?:power\s+(?:outage|failure|block)|पॉवर\s+ब्लॉक)/i, text: 'Power block / outage' },
    { pattern: /(?:fog|धुके|कोहरा)/i, text: 'Dense fog condition' },
    { pattern: /(?:derailment|रुळावरून\s+घसरली|पटरी\s+से\s+उतरी)/i, text: 'Derailment' },
    { pattern: /(?:overhead\s+(?:wire|equipment)\s+issue|OHE\s+breakdown)/i, text: 'Overhead equipment issue' }
  ];

  for (const { pattern, text: reasonText } of knownReasons) {
    if (pattern.test(text)) {
      return reasonText;
    }
  }

  return null;
}

/**
 * Main Deterministic Railway Delay Notice Parser
 */
export function parseRailwayNotice(rawNotice: string): ParsedNotice {
  if (!rawNotice || typeof rawNotice !== 'string') {
    throw new ParseError('Notice must be a non-empty string', 'EMPTY_NOTICE');
  }

  const trimmed = rawNotice.trim();
  if (trimmed.length < 5) {
    throw new ParseError('Notice is too short to be a valid railway notice', 'NOTICE_TOO_SHORT');
  }

  const normalizedText = normalizeDevanagariDigits(trimmed);
  const language = detectLanguage(trimmed);

  // 1. Extract Train Number (Required)
  const train = extractTrainNumber(trimmed, normalizedText);
  if (!train) {
    throw new ParseError('Could not identify a valid train number (4-6 digits) in notice', 'MISSING_TRAIN');
  }

  // 2. Extract Station (Required)
  const station = extractStation(trimmed, normalizedText);
  if (!station) {
    throw new ParseError('Could not identify a valid station code or name in notice', 'MISSING_STATION');
  }

  // 3. Extract Expected Time (Required)
  const expectedTime = extractExpectedTime(trimmed, normalizedText);
  if (!expectedTime) {
    throw new ParseError('Could not identify expected arrival/departure time in notice', 'MISSING_EXPECTED_TIME');
  }

  // 4. Extract Delay (Optional)
  const delay = extractDelay(trimmed, normalizedText);

  // 5. Extract Reason (Optional)
  const reason = extractReason(trimmed);

  const parsedResult: ParsedNotice = {
    train,
    station,
    expected_time: expectedTime,
    delay_minutes: delay.minutes,
    delay_text: delay.text,
    reason: reason || null,
    language,
    raw_notice: trimmed,
    parsed_at: new Date().toISOString()
  };

  // 6. Validate with Zod schema before returning
  const validation = ParsedNoticeSchema.safeParse(parsedResult);
  if (!validation.success) {
    throw new ParseError(
      'Parsed output failed schema validation',
      'SCHEMA_VALIDATION_FAILED',
      validation.error.issues
    );
  }

  return validation.data;
}
