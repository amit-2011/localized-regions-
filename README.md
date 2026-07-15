# localized-regions

[![npm version](https://img.shields.io/npm/v/localized-regions.svg)](https://www.npmjs.com/package/localized-regions)
[![npm downloads](https://img.shields.io/npm/dm/localized-regions.svg)](https://www.npmjs.com/package/localized-regions)
[![license](https://img.shields.io/npm/l/localized-regions.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/localized-regions.svg)](./dist/index.d.ts)

**Country, province and city data with bilingual localized labels and ISO 3166 codes.**
Get country / province / city dropdown options with labels like `Spain (España)`, stable ISO
3166-1 and ISO 3166-2 codes, and the full set of **50 Spanish provinces** (not the 17
autonomous communities). Framework-agnostic and TypeScript-first: the data drops straight into
**react-select**, **MUI Autocomplete**, or any dropdown.

```ts
import { countryOptions, provinceOptions } from 'localized-regions';

countryOptions('es');   // [{ value: 'ES', label: 'Spain (España)' }, { value: 'NL', label: 'Netherlands (Países Bajos)' }, ...]
provinceOptions('ES');  // [{ value: 'ES-MA', label: 'Málaga' }, { value: 'ES-B', label: 'Barcelona' }, ...]
```

## Features

- **Bilingual / localized country labels** - `Spain (España)`, `Germany (Alemania)`, `France (Francia)`, computed from the browser-native `Intl.DisplayNames` for any locale.
- **Correct Spanish provinces** - all **50 provinces** with ISO 3166-2 codes and their parent autonomous community. (Popular datasets like `country-state-city` return only ~16 of them for Spain.)
- **Stable, invoicing-safe values** - country = ISO 3166-1 code (`ES`), province = ISO 3166-2 code (`ES-MA`). Labels are display-only.
- **Full city database** - cities for every country, sourced from `country-state-city` at runtime.
- **Framework-agnostic** - no React / MUI / Chakra dependency. Plain data plus ready-to-use `{ value, label }` options.
- **TypeScript types included.**

## Install

```bash
npm install localized-regions
```

## Usage

```ts
import {
  getCountries, getProvinces, getCities,
  countryOptions, provinceOptions, cityOptions,
  formatCountryLabel,
} from 'localized-regions';

// Bilingual country labels (the locale drives the native part)
getCountries({ locale: 'es' });  // [{ code:'ES', name:'Spain', localized:'España', label:'Spain (España)' }, ...]
getCountries();                  // English-only labels

// Spain -> 50 provinces (ISO 3166-2 codes + community grouping)
getProvinces('ES');              // [{ code:'ES-MA', countryCode:'ES', name:'Málaga', community:'Andalusia', communityCode:'ES-AN' }, ...]

// Cities (full database)
getCities('ES', 'ES-MA');

// Ready-to-use dropdown options
countryOptions('es');            // [{ value:'ES', label:'Spain (España)' }, ...]
provinceOptions('ES');           // [{ value:'ES-MA', label:'Málaga' }, ...]
cityOptions('ES', 'ES-MA');      // [{ value:'Málaga', label:'Málaga' }, ...]

formatCountryLabel('ES', 'es');  // "Spain (España)"
```

### With react-select (editable / creatable dropdowns)

```tsx
import CreatableSelect from 'react-select/creatable';
import { provinceOptions } from 'localized-regions';

<CreatableSelect
  options={provinceOptions('ES')}                // 50 Spanish provinces
  onChange={(opt) => save(opt?.value)}           // store the ISO 3166-2 code, e.g. "ES-MA"
  onCreateOption={(typed) => saveCustom(typed)}  // allow a manual free-text correction
/>
```

### With MUI Autocomplete

```tsx
import Autocomplete from '@mui/material/Autocomplete';
import { countryOptions } from 'localized-regions';

<Autocomplete options={countryOptions('es')} getOptionLabel={(o) => o.label} />
```

## API

| Function | Returns |
| --- | --- |
| `getCountries({ locale? })` | `CountryOption[]` - all countries, bilingual when a locale is given |
| `getCountry(code)` | `Country` |
| `formatCountryLabel(code, locale?)` | bilingual / English label string |
| `getProvinces(countryCode)` | `Province[]` (Spain = curated 50) |
| `getProvince(provinceCode)` | `Province` |
| `getCities(countryCode, provinceCode?)` | `City[]` |
| `countryOptions(locale?)` | `Option[]` (`{ value, label }`) |
| `provinceOptions(countryCode)` | `Option[]` |
| `cityOptions(countryCode, provinceCode?)` | `Option[]` |

## How the data is built

Data is generated at build time (`npm run generate`) and committed under `data/`:

- **Countries** - `Intl.DisplayNames` (English) plus a code list, 250 countries.
- **Provinces** - `iso-3166-2` subdivisions. Spain is curated to 50 provinces, with 4 regional-language names aliased to their common form (Nafarroa -> Navarra, Balears -> Balearic Islands, Alacant -> Alicante, Castelló -> Castellón).
- **Cities** - `country-state-city` at runtime.

Regenerate after a data-source bump:

```bash
npm run generate && npm run build
```

## Notes and limitations

- **Spain city cascade is community-level.** The source city data groups Spanish cities under autonomous communities, not the 50 provinces, so `getCities('ES', 'ES-MA')` returns the parent community's cities (best-effort). City is best treated as a free-text field.
- **Bilingual labels are country-level only.** `Intl.DisplayNames` does not localize subdivisions; province names are shown as-is.

## License

MIT (c) Amit Tank. See [LICENSE](./LICENSE).
