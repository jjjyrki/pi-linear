import { isNonEmptyTrimmedString } from '../src/validation';

describe('isNonEmptyTrimmedString', () => {
  it('accepts non-empty trimmed strings', () => {
    expect(isNonEmptyTrimmedString('hello')).toBe(true);
    expect(isNonEmptyTrimmedString('  hello  ')).toBe(true);
  });

  it('rejects empty or whitespace-only values', () => {
    expect(isNonEmptyTrimmedString('')).toBe(false);
    expect(isNonEmptyTrimmedString('   ')).toBe(false);
    expect(isNonEmptyTrimmedString(null)).toBe(false);
    expect(isNonEmptyTrimmedString(undefined)).toBe(false);
  });
});
