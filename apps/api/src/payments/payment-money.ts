import { BadRequestException } from '@nestjs/common';

const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG',
  'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
]);
const THREE_DECIMAL = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

export function currencyExponent(currencyValue: string) {
  const currency = currencyValue.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BadRequestException('Devise invalide.');
  }
  if (ZERO_DECIMAL.has(currency)) return 0;
  if (THREE_DECIMAL.has(currency)) return 3;
  return 2;
}

export function minorToMajorString(amountMinor: number, currency: string) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new BadRequestException('Montant monétaire invalide.');
  }
  const exponent = currencyExponent(currency);
  if (exponent === 0) return String(amountMinor);
  const divisor = 10 ** exponent;
  return (amountMinor / divisor).toFixed(exponent);
}

export function majorToMinor(amount: number | string, currency: string) {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new BadRequestException('Montant fournisseur invalide.');
  }
  const multiplier = 10 ** currencyExponent(currency);
  const result = Math.round(numeric * multiplier);
  if (!Number.isSafeInteger(result)) {
    throw new BadRequestException('Montant fournisseur hors limites.');
  }
  return result;
}
