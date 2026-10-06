import { describe, it, expect } from 'vitest';
import { cleanTextForSpeech, numberToOrdinalWord } from './sovereignVoice';

describe('Sovereign Voice Speech & Reading Intelligence', () => {
  describe('numberToOrdinalWord', () => {
    it('accurately converts single digits and teens', () => {
      expect(numberToOrdinalWord(1)).toBe('first');
      expect(numberToOrdinalWord(2)).toBe('second');
      expect(numberToOrdinalWord(3)).toBe('third');
      expect(numberToOrdinalWord(4)).toBe('fourth');
      expect(numberToOrdinalWord(11)).toBe('eleventh');
      expect(numberToOrdinalWord(12)).toBe('twelfth');
      expect(numberToOrdinalWord(15)).toBe('fifteenth');
    });

    it('accurately converts tens and compound numbers', () => {
      expect(numberToOrdinalWord(20)).toBe('twentieth');
      expect(numberToOrdinalWord(21)).toBe('twenty-first');
      expect(numberToOrdinalWord(30)).toBe('thirtieth');
      expect(numberToOrdinalWord(40)).toBe('fortieth');
      expect(numberToOrdinalWord(44)).toBe('forty-fourth');
      expect(numberToOrdinalWord(50)).toBe('fiftieth');
      expect(numberToOrdinalWord(75)).toBe('seventy-fifth');
      expect(numberToOrdinalWord(99)).toBe('ninety-ninth');
    });

    it('accurately converts hundreds and thousands', () => {
      expect(numberToOrdinalWord(100)).toBe('one hundredth');
      expect(numberToOrdinalWord(101)).toBe('one hundred and first');
      expect(numberToOrdinalWord(250)).toBe('two hundred and fiftieth');
      expect(numberToOrdinalWord(500)).toBe('five hundredth');
      expect(numberToOrdinalWord(1000)).toBe('one thousandth');
    });
  });

  describe('cleanTextForSpeech', () => {
    it('properly articulates standalone and quoted digraph "th" as "T-H"', () => {
      const input = 'Reading doesn\u2019t work. It doesn\u2019t read letters properly. For example, "th" doesn\u2019t read properly.';
      const output = cleanTextForSpeech(input);
      expect(output).toContain('T-H');
      expect(output).toContain("doesn't");
      expect(output).not.toContain('"th"');
    });

    it('converts isolated consonant digraphs into hyphenated letter pairs', () => {
      expect(cleanTextForSpeech('Check "th" and "sh" and "ch" sounds.')).toBe('Check T-H and S-H and C-H sounds.');
      expect(cleanTextForSpeech('Can you read: th')).toBe('Can you read: T-H');
      expect(cleanTextForSpeech('Letter: ph and wh')).toBe('Letter: P-H and W-H');
    });

    it('preserves normal words containing "th" without altering their spelling', () => {
      const sentence = 'The path with father and brother is the thirty-fourth step.';
      const output = cleanTextForSpeech(sentence);
      expect(output).toContain('The path with father and brother is the thirty-fourth step.');
      expect(output).not.toContain('T-H');
    });

    it('converts numeric ordinals into natural spoken words', () => {
      expect(cleanTextForSpeech('Review 1st, 2nd, 3rd, and 4th quarters.')).toBe('Review first, second, third, and fourth quarters.');
      expect(cleanTextForSpeech('The 40th anniversary and 100th milestone.')).toBe('The fortieth anniversary and one hundredth milestone.');
    });

    it('normalizes typographic quotes and unicode dashes into clean speech', () => {
      const input = 'Elena\u2019s strategy\u2014verified by \u201CSignalDesk\u201D\u2014is operational.';
      const output = cleanTextForSpeech(input);
      expect(output).toBe("Elena's strategy, verified by SignalDesk, is operational.");
    });

    it('formats currencies, percentages, and business metrics cleanly for speech', () => {
      expect(cleanTextForSpeech('Current ARR is $3.42M with +8.5% growth.')).toBe('Current A R R is 3.42 million dollars with plus 8.5 percent growth.');
      expect(cleanTextForSpeech('Exposure of €180K and £50K in Europe.')).toBe('Exposure of 180 thousand euros and 50 thousand pounds in Europe.');
    });
  });
});
