export interface Country {
  code: string
  name: string
  currency: string
}

export const COUNTRIES: Country[] = [
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR' },
  { code: 'TH', name: 'Thailand', currency: 'THB' },
  { code: 'VN', name: 'Vietnam', currency: 'VND' },
  { code: 'PH', name: 'Philippines', currency: 'PHP' },
  { code: 'CN', name: 'China', currency: 'CNY' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD' },
  { code: 'TW', name: 'Taiwan', currency: 'TWD' },
  { code: 'KR', name: 'South Korea', currency: 'KRW' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'MX', name: 'Mexico', currency: 'MXN' },
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'IT', name: 'Italy', currency: 'EUR' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  { code: 'SE', name: 'Sweden', currency: 'SEK' },
  { code: 'NO', name: 'Norway', currency: 'NOK' },
  { code: 'DK', name: 'Denmark', currency: 'DKK' },
  { code: 'PL', name: 'Poland', currency: 'PLN' },
  { code: 'CZ', name: 'Czechia', currency: 'CZK' },
  { code: 'TR', name: 'Turkey', currency: 'TRY' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR' }
]

export function currencyForCountry(code: string): string | undefined {
  return COUNTRIES.find(c => c.code === code)?.currency
}

export function countryName(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.name ?? code
}

/** Currencies Frankfurter (ECB) publishes. Anything else needs a manual rate. */
export const API_SUPPORTED_CURRENCIES = new Set([
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
])

/** Every currency the app offers in a picker: destination currencies plus the ECB list. */
export const SELECTABLE_CURRENCIES: string[] = [
  ...new Set([...COUNTRIES.map(c => c.currency), ...API_SUPPORTED_CURRENCIES])
].sort()
