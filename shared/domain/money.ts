export const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'IDR', 'KRW', 'VND', 'CLP', 'ISK', 'TWD'])

export const HOME_CURRENCY = 'JPY'

export function decimalsFor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2
}

export function roundMoney(value: number, currency: string): number {
  const factor = 10 ** decimalsFor(currency)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Convert an amount in a foreign currency to home currency (JPY) using a frozen rate. */
export function toHome(amount: number, rateToHome: number): number {
  return roundMoney(amount * rateToHome, HOME_CURRENCY)
}

export function formatMoney(value: number, currency: string): string {
  const decimals = decimalsFor(currency)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}
