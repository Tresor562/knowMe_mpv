import {
  currencyExponent,
  majorToMinor,
  minorToMajorString
} from './payment-money';

describe('payment-money', () => {
  it('keeps zero-decimal currencies in whole units', () => {
    expect(currencyExponent('XOF')).toBe(0);
    expect(minorToMajorString(20_000, 'XOF')).toBe('20000');
    expect(majorToMinor('20000', 'XOF')).toBe(20_000);
  });

  it('converts common currencies through minor units without floating arithmetic', () => {
    expect(currencyExponent('EUR')).toBe(2);
    expect(minorToMajorString(173, 'EUR')).toBe('1.73');
    expect(majorToMinor('1.73', 'EUR')).toBe(173);
    expect(minorToMajorString(2_000, 'USD')).toBe('20.00');
  });

  it('supports three-decimal currencies', () => {
    expect(currencyExponent('KWD')).toBe(3);
    expect(minorToMajorString(12_345, 'KWD')).toBe('12.345');
  });
});
