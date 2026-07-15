import { City as CSCCity } from 'country-state-city';
import { Country, CountryOption, Province, City, Option } from './types';
// Static, build-time generated data (see scripts/generate.js). Imported statically
// so the data bundles cleanly in browser bundlers (webpack/vite) with no Node `path`
// or dynamic `require`.
import countries from './data/countries';
import provinces from './data/provinces';

function displayName(code: string, locale: string): string | undefined {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || undefined;
  } catch (e) {
    return undefined;
  }
}

function buildLabel(name: string, localized?: string): string {
  return localized && localized !== name ? `${name} (${localized})` : name;
}

/**
 * All countries. Pass a locale (e.g. "es") to get bilingual labels like
 * "Spain (España)". Omit or pass "en" for English-only labels.
 */
export function getCountries(opts: { locale?: string } = {}): CountryOption[] {
  const { locale } = opts;
  return countries.map((c) => {
    const localized = locale && locale !== 'en' ? displayName(c.code, locale) : undefined;
    return { code: c.code, name: c.name, localized, label: buildLabel(c.name, localized) };
  });
}

export function getCountry(code: string): Country | undefined {
  return countries.find((c) => c.code === code.toUpperCase());
}

/** Bilingual (or English) display label for a single country code. */
export function formatCountryLabel(code: string, locale?: string): string {
  const c = getCountry(code);
  if (!c) return code;
  const localized = locale && locale !== 'en' ? displayName(code, locale) : undefined;
  return buildLabel(c.name, localized);
}

/**
 * Provinces for a country. Spain returns the curated 50 Provinces (RAT-1776);
 * other countries return their ISO 3166-2 subdivisions.
 */
export function getProvinces(countryCode: string): Province[] {
  return provinces[countryCode.toUpperCase()] || [];
}

export function getProvince(provinceCode: string): Province | undefined {
  const cc = provinceCode.split('-')[0];
  return getProvinces(cc).find((p) => p.code === provinceCode);
}

// Spain cities in the source data are grouped at the autonomous-community level,
// not by the 50 provinces. Where the community ISO code differs from the source
// state code, map it here. City is best-effort for Spain and is expected to be a
// free-text field (RAT-1772).
const ES_COMMUNITY_TO_SOURCE: Record<string, string> = {
  'ES-IB': 'PM', // Balearic Islands
};

/**
 * Cities. With no provinceCode, returns all cities of the country. With a
 * provinceCode, returns cities for that subdivision (Spain: mapped to the
 * parent community, best-effort).
 */
export function getCities(countryCode: string, provinceCode?: string): City[] {
  const cc = countryCode.toUpperCase();
  if (!provinceCode) {
    return (CSCCity.getCitiesOfCountry(cc) as unknown as City[]) || [];
  }
  if (cc === 'ES') {
    const community = getProvince(provinceCode)?.communityCode;
    if (!community) return [];
    const source = ES_COMMUNITY_TO_SOURCE[community] || community.split('-')[1];
    return (CSCCity.getCitiesOfState(cc, source) as unknown as City[]) || [];
  }
  const bare = provinceCode.includes('-') ? provinceCode.split('-').slice(1).join('-') : provinceCode;
  return (CSCCity.getCitiesOfState(cc, bare) as unknown as City[]) || [];
}

// --------------------------------------------------- ready-to-use dropdown options

/** Country options for react-select / MUI. value = ISO code, label = bilingual. */
export function countryOptions(locale?: string): Option[] {
  return getCountries({ locale }).map((c) => ({ value: c.code, label: c.label }));
}

/** Province options. value = ISO 3166-2 code, label = province name. */
export function provinceOptions(countryCode: string): Option[] {
  return getProvinces(countryCode).map((p) => ({ value: p.code, label: p.name }));
}

/** City options. value = label = city name (cities have no stable code). */
export function cityOptions(countryCode: string, provinceCode?: string): Option[] {
  return getCities(countryCode, provinceCode).map((c) => ({ value: c.name, label: c.name }));
}

export * from './types';
