import { describe, it, expect } from 'vitest';
import { parseRailwayNotice, ParseError, normalizeDevanagariDigits } from '../src/parser.js';
import { ParsedNoticeSchema } from '../src/schemas.js';

describe('Railway Notice Parser', () => {
  describe('Devanagari Digit Normalization', () => {
    it('correctly converts Devanagari numerals to ASCII digits', () => {
      expect(normalizeDevanagariDigits('०१२३४५६७८९')).toBe('0123456789');
      expect(normalizeDevanagariDigits('गाडी १२१५८ वेळ १४:३०')).toBe('गाडी 12158 वेळ 14:30');
    });
  });

  describe('Valid English Notices', () => {
    it('parses English notice with train, station, time, delay and reason', () => {
      const notice = 'Train 12158 Pune - Solapur Hutatma Exp expected at PUNE station at 14:30 hrs (delayed by 45 mins due to signal failure at Daund)';
      const result = parseRailwayNotice(notice);

      expect(result.train).toBe('12158');
      expect(result.station).toBe('PUNE');
      expect(result.expected_time).toBe('14:30');
      expect(result.delay_minutes).toBe(45);
      expect(result.reason).toContain('signal failure');
      expect(result.language).toBe('en');

      // Validate Zod schema
      const validation = ParsedNoticeSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });

    it('parses Deccan Queen arriving CSMT', () => {
      const notice = '12124 (Deccan Queen) arriving CSMT expected 18:45, delay 30m reason: track maintenance';
      const result = parseRailwayNotice(notice);

      expect(result.train).toBe('12124');
      expect(result.station).toBe('CSMT');
      expect(result.expected_time).toBe('18:45');
      expect(result.delay_minutes).toBe(30);
      expect(result.reason).toContain('track maintenance');
    });

    it('parses notice with 1 hr 15 min delay format', () => {
      const notice = 'Train No: 01104, Stn: MMR, Exp Time: 21:00, Delay: 1 hr 15 min, Cause: fog condition';
      const result = parseRailwayNotice(notice);

      expect(result.train).toBe('01104');
      expect(result.station).toBe('MMR');
      expect(result.expected_time).toBe('21:00');
      expect(result.delay_minutes).toBe(75);
    });
  });

  describe('Valid Marathi Notices', () => {
    it('parses Marathi notice with Devanagari numerals and Marathi reason', () => {
      const notice = 'गाडी क्र. १२१५८ हुतात्मा एक्सप्रेस पुणे (PUNE) स्थानकावर १४:३० वाजता अपेक्षित आहे. कारण: सिग्नल बिघाड (उशीर ४५ मिनिटे)';
      const result = parseRailwayNotice(notice);

      expect(result.train).toBe('12158');
      expect(result.station).toBe('PUNE');
      expect(result.expected_time).toBe('14:30');
      expect(result.delay_minutes).toBe(45);
      expect(result.reason).toBeTruthy();
      expect(result.language).toBe('mixed');
    });

    it('parses pure Marathi notice with Devanagari station name', () => {
      const notice = 'गाडी क्र. १२१२४ लोणावळा येथे ०६:१५ वाजता येईल. उशीर: ३० मिनिटे, कारण: पावसामुळे पाणी साचले';
      const result = parseRailwayNotice(notice);

      expect(result.train).toBe('12124');
      expect(result.station).toBe('LNL');
      expect(result.expected_time).toBe('06:15');
      expect(result.delay_minutes).toBe(30);
    });
  });

  describe('Valid Hindi Notices', () => {
    it('parses Hindi notice with station and reason', () => {
      const notice = 'गाड़ी संख्या 12158 हुतात्मा एक्सप्रेस पुणे (PUNE) स्टेशन पर 14:30 बजे पहुंचेगी। देरी: 45 मिनट, कारण: सिग्नल खराबी';
      const result = parseRailwayNotice(notice);

      expect(result.train).toBe('12158');
      expect(result.station).toBe('PUNE');
      expect(result.expected_time).toBe('14:30');
      expect(result.delay_minutes).toBe(45);
    });
  });

  describe('Malformed & Unparseable Notices (Must Fail and Throw ParseError)', () => {
    it('throws ParseError on missing train number', () => {
      const notice = 'Express train arriving at PUNE station at 14:30 hrs is running late by 45 mins due to signal failure';
      expect(() => parseRailwayNotice(notice)).toThrow(ParseError);
      try {
        parseRailwayNotice(notice);
      } catch (err: any) {
        expect(err.code).toBe('MISSING_TRAIN');
      }
    });

    it('throws ParseError on missing station', () => {
      const notice = 'Train 12158 Hutatma Express is delayed by 45 mins. Expected arrival 14:30 hrs due to signal failure.';
      expect(() => parseRailwayNotice(notice)).toThrow(ParseError);
      try {
        parseRailwayNotice(notice);
      } catch (err: any) {
        expect(err.code).toBe('MISSING_STATION');
      }
    });

    it('throws ParseError on missing expected time', () => {
      const notice = 'Train 12158 Hutatma Express reaching PUNE station is indefinitely delayed due to derailment.';
      expect(() => parseRailwayNotice(notice)).toThrow(ParseError);
      try {
        parseRailwayNotice(notice);
      } catch (err: any) {
        expect(err.code).toBe('MISSING_EXPECTED_TIME');
      }
    });

    it('throws ParseError on random garbage input', () => {
      const garbage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
      expect(() => parseRailwayNotice(garbage)).toThrow(ParseError);
    });

    it('throws ParseError on empty or too short notice', () => {
      expect(() => parseRailwayNotice('')).toThrow(ParseError);
      expect(() => parseRailwayNotice('hi')).toThrow(ParseError);
    });
  });
});
