# localized-regions

[![npm version](https://img.shields.io/npm/v/localized-regions.svg)](https://www.npmjs.com/package/localized-regions)
[![npm downloads](https://img.shields.io/npm/dm/localized-regions.svg)](https://www.npmjs.com/package/localized-regions)
[![license](https://img.shields.io/npm/l/localized-regions.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/localized-regions.svg)](./dist/index.d.ts)

**Country, province and city data with bilingual localized labels and ISO 3166 codes.**
Get country / province / city dropdown options with labels like `España (Spain)`, stable ISO
3166-1 and ISO 3166-2 codes, and the full set of **50 Spanish provinces** (not the 17
autonomous communities). Framework-agnostic and TypeScript-first: the data drops straight into
**react-select**, **MUI Autocomplete**, or any dropdown.

```ts
import { countryOptions, provinceOptions } from 'localized-regions';

countryOptions('es');   // [{ value: 'ES', label: 'España (Spain)' }, { value: 'NL', label: 'Nederland (Netherlands)' }, ...]
provinceOptions('ES');  // [{ value: 'ES-MA', label: 'Málaga' }, { value: 'ES-B', label: 'Barcelona' }, ...]
```

## Features

- **Bilingual / localized country labels** - `España (Spain)`, `Deutschland (Germany)`, `Nederland (Netherlands)`, computed from the browser-native `Intl.DisplayNames` for any locale.
- **Correct Spanish provinces** - all **50 provinces** with ISO 3166-2 codes and their parent autonomous community. (Popular datasets like `country-state-city` return only ~16 of them for Spain.)
- **Stable, invoicing-safe values** - country = ISO 3166-1 code (`ES`), province = ISO 3166-2 code (`ES-MA`). Labels are display-only.
- **Full city database** - cities for every country, sourced from `country-state-city` at runtime.
- **Correct Dutch cities** - the Netherlands is served from the official Dutch place register (BAG woonplaatsen), not `country-state-city`, whose NL list is 19% `Gemeente X` municipality records and missing roughly 1000 real places.
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
getCountries({ locale: 'es' });  // [{ code:'ES', name:'Spain', localized:'España', label:'España (Spain)' }, ...]
getCountries();                  // English-only labels

// Spain -> 50 provinces (ISO 3166-2 codes + community grouping)
getProvinces('ES');              // [{ code:'ES-MA', countryCode:'ES', name:'Málaga', community:'Andalusia', communityCode:'ES-AN' }, ...]

// Cities (full database)
getCities('ES', 'ES-MA');

// Ready-to-use dropdown options
countryOptions('es');            // [{ value:'ES', label:'España (Spain)' }, ...]
provinceOptions('ES');           // [{ value:'ES-MA', label:'Málaga' }, ...]
cityOptions('ES', 'ES-MA');      // [{ value:'Málaga', label:'Málaga' }, ...]

formatCountryLabel('ES', 'es');  // "España (Spain)"
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
| `cityMatches(city, input)` | `boolean` - does this city match typed input, by name or alias |
| `countryOptions(locale?)` | `Option[]` (`{ value, label }`) |
| `provinceOptions(countryCode)` | `Option[]` |
| `cityOptions(countryCode, provinceCode?)` | `Option[]` |

## How the data is built

Data is generated at build time (`npm run generate`) and committed under `data/`:

- **Countries** - `Intl.DisplayNames` (English) plus a code list, 250 countries.
- **Provinces** - `iso-3166-2` subdivisions. Spain is curated to 50 provinces, with 4 regional-language names aliased to their common form (Nafarroa -> Navarra, Balears -> Balearic Islands, Alacant -> Alicante, Castelló -> Castellón).
- **Cities** - `country-state-city` at runtime, except the Netherlands.
- **Netherlands cities** - the official BAG woonplaats register, fetched at build time from the PDOK Locatieserver and baked into `data/cities-nl`. No runtime API call and no API key. Generation fails if a `Gemeente X` entry ever reappears.

Regenerate after a data-source bump:

```bash
npm run generate && npm run build
```

## Netherlands cities

NL city data comes from the official Dutch place register (BAG woonplaatsen, via
the PDOK Locatieserver) rather than `country-state-city`, whose NL list contains
325 `Gemeente X` municipality records and is missing roughly 1000 real places.

The Hague is returned as `Den Haag` - the name the municipality, PostNL and
Taaladvies all use for addresses. Its formal name `'s-Gravenhage` is kept as a
search alias on `City.aliases`, never as a separate selectable option. Use
`cityMatches` as your select's `filterOption` so aliases are searchable:

```js
import { getCities, cityMatches } from 'localized-regions';

<Select
  options={getCities('NL', 'NL-ZH')}
  getOptionLabel={(c) => c.name}
  getOptionValue={(c) => c.name}
  filterOption={(option, input) => cityMatches(option.data, input)}
/>
```

`getProvinces('NL')` returns the 12 real provinces. Aruba, Curacao and Sint
Maarten are separate constituent countries, and Bonaire, Saba and Sint Eustatius
are Caribbean special municipalities; ISO 3166-2 lists all six under NL, but they
are not provinces and have no cities, so they are excluded.

## Notes and limitations

- **Spain city cascade is community-level.** The source city data groups Spanish cities under autonomous communities, not the 50 provinces, so `getCities('ES', 'ES-MA')` returns the parent community's cities (best-effort). City is best treated as a free-text field.
- **Bilingual labels are country-level only.** `Intl.DisplayNames` does not localize subdivisions; province names are shown as-is.

## License

MIT (c) Amit Tank. See [LICENSE](./LICENSE).
