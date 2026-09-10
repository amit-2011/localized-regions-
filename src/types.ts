export interface Country {
  /** ISO 3166-1 alpha-2 code, e.g. "ES" */
  code: string;
  /** English name, e.g. "Spain" */
  name: string;
}

export interface CountryOption {
  code: string;
  /** English name */
  name: string;
  /** Name in the requested locale, e.g. "España" (undefined when locale is en/absent) */
  localized?: string;
  /** Display label, e.g. "España (Spain)" when localized, else "Spain" */
  label: string;
}

export interface Province {
  /** ISO 3166-2 code, e.g. "ES-MA" */
  code: string;
  /** Parent country ISO 3166-1 alpha-2 code, e.g. "ES" */
  countryCode: string;
  /** Province name, e.g. "Málaga" */
  name: string;
  /** Parent autonomous community / region name (Spain only), e.g. "Andalusia" */
  community?: string;
  /** Parent autonomous community ISO 3166-2 code (Spain only), e.g. "ES-AN" */
  communityCode?: string;
  /** iso-3166-2 subdivision type for non-Spain countries, e.g. "Province" / "State" */
  type?: string;
}

export interface City {
  name: string;
  countryCode: string;
  stateCode?: string;
  latitude?: string;
  longitude?: string;
  /**
   * Extra strings that should match while typing but are never displayed or
   * stored, e.g. "'s-Gravenhage" for Den Haag (RAT-2000). Use cityMatches()
   * rather than reading this directly.
   */
  aliases?: string[];
}

/** react-select / MUI style option */
export interface Option {
  value: string;
  label: string;
}
