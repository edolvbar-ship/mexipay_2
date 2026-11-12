/**
 * Converts backend cent-string (e.g. '1180') to display decimal string '11.80'
 * Safe for null/undefined/empty
 */
export function formatAmountFromCents(amount: string | number | null | undefined): string {
  if (!amount) return '0.00';

  const str = amount.toString().trim();
  if (str === '' || str === '0') return '0.00';

  // Handle if already has decimal (safety)
  if (str.includes('.')) {
    return parseFloat(str).toFixed(2);
  }

  const clean = str.replace(/^0+/, '') || '0';
  if (clean.length <= 2) {
    return (parseInt(clean, 10) / 100).toFixed(2);
  }

  const pesos = clean.slice(0, -2) || '0';
  const centavos = clean.slice(-2).padStart(2, '0');
  return `${parseInt(pesos, 10)}.${centavos}`;
}

/**
 * Optional: for currency pipe compatibility
 */
export function formatAmountFromCentsNumber(amount: string | number | null | undefined): number {
  return parseFloat(formatAmountFromCents(amount));
}
