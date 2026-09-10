/**
 * Build-time data generator for `localized-regions`.
 *
 * Produces two committed JSON files under ../data:
 *   - countries.json : [{ code, name }]           (all ISO 3166-1 countries, English names)
 *   - provinces.json : { [countryCode]: Province[] }
 *
 * Sources (dev-only, NOT runtime deps for the province data):
 *   - country-state-city : country list (kept in sync with the runtime city source)
 *   - iso-3166-2         : subdivision codes + names
 *   - Intl.DisplayNames  : English country names
 *
 * Spain is fully curated to the 50 Provinces (RAT-1776), NOT the 17 Autonomous
 * Communities. 4 regional-language names from iso-3166-2 are aliased to the
 * client's expected labels.
 */
const fs = require('fs');
const path = require('path');
const { Country } = require('country-state-city');
const iso = require('iso-3166-2');

const OUT = path.join(__dirname, '..', 'src', 'data');
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------- NETHERLANDS CITIES
// RAT-2000. country-state-city's NL list is unusable: 325 of its 1740 entries
// are "Gemeente X" municipality records rather than city names, and it is
// missing roughly 1000 real places (Den Haag, IJmuiden, Poortugaal, Cadzand,
// Leidschendam, ...). Its last publish was 2023-09-18 and 3.2.1 is still the
// latest version, so no upgrade fixes it. We therefore bake the official Dutch
// place register (BAG woonplaatsen) instead, read through the PDOK
// Locatieserver: authoritative, free, no API key.
const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
// The endpoint returns HTTP 400 for rows > 100. Do not raise this.
const PDOK_PAGE = 100;
const NL_EXPECTED_MIN = 2400; // 2503 on 2026-09-10; guards against a short read

// PDOK provinciecode -> ISO 3166-2, so the baked list is keyed exactly the way
// getProvinces('NL') returns its codes.
const NL_PROVINCE_CODE = {
  PV20: 'NL-GR',
  PV21: 'NL-FR',
  PV22: 'NL-DR',
  PV23: 'NL-OV',
  PV24: 'NL-FL',
  PV25: 'NL-GE',
  PV26: 'NL-UT',
  PV27: 'NL-NH',
  PV28: 'NL-ZH',
  PV29: 'NL-ZE',
  PV30: 'NL-NB',
  PV31: 'NL-LI',
};

// BAG stores the formal name; Dutch addresses use the preferred one. The
// municipality adopted "Den Haag" in 1990 for everything except civil-registry
// documents, PostNL addresses to DEN HAAG, and Taaladvies recommends Den Haag
// for addresses. The formal name stays findable through NL_SEARCH_ALIASES.
const NL_DISPLAY_NAME = {
  "'s-Gravenhage": 'Den Haag',
};

// Strings that must match while typing but are never stored or displayed.
// Note 's-Hertogenbosch is the opposite case to Den Haag: there the official
// name IS the everyday name, so "Den Bosch" is an alias, not the display name.
const NL_SEARCH_ALIASES = {
  'Den Haag': ["'s-Gravenhage"],
  "'s-Hertogenbosch": ['Den Bosch'],
};

async function fetchWoonplaatsen() {
  const docs = [];
  let start = 0;
  for (;;) {
    const params = new URLSearchParams({
      q: '*:*',
      fq: 'type:woonplaats',
      fl: 'woonplaatsnaam,provincienaam,provinciecode',
      rows: String(PDOK_PAGE),
      start: String(start),
    });
    const res = await fetch(`${PDOK_URL}?${params}`);
    if (!res.ok) throw new Error(`PDOK returned HTTP ${res.status} at start=${start}`);
    const body = await res.json();
    docs.push(...body.response.docs);
    start += PDOK_PAGE;
    if (start >= body.response.numFound) break;
  }
  return docs;
}

function buildNlCities(docs) {
  // province code -> Map(name -> City), so a name repeated inside one province
  // (Alteveer and Ansen both appear twice in Drenthe) collapses to one option.
  const byProvince = {};
  for (const iso2 of Object.values(NL_PROVINCE_CODE)) byProvince[iso2] = new Map();

  for (const doc of docs) {
    const iso2 = NL_PROVINCE_CODE[doc.provinciecode];
    if (!iso2) throw new Error(`Unmapped PDOK provinciecode: ${doc.provinciecode}`);
    const name = NL_DISPLAY_NAME[doc.woonplaatsnaam] || doc.woonplaatsnaam;
    const city = { name, countryCode: 'NL', stateCode: iso2.split('-')[1] };
    const aliases = NL_SEARCH_ALIASES[name];
    if (aliases) city.aliases = aliases;
    byProvince[iso2].set(name, city);
  }

  const out = {};
  for (const [iso2, map] of Object.entries(byProvince)) {
    out[iso2] = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  }
  return out;
}

function assertNlCities(cities) {
  const all = Object.values(cities).flat();
  if (all.length < NL_EXPECTED_MIN) {
    throw new Error(`NL cities: got ${all.length}, expected at least ${NL_EXPECTED_MIN}`);
  }
  // AC1 of RAT-2000, enforced at build time so it can never regress.
  const gemeente = all.filter((c) => /^gemeente\b/i.test(c.name));
  if (gemeente.length) {
    throw new Error(`NL cities still contain Gemeente entries: ${gemeente.map((c) => c.name).join(', ')}`);
  }
  const empty = Object.entries(cities).filter(([, list]) => list.length === 0);
  if (empty.length) {
    throw new Error(`NL provinces with no cities: ${empty.map(([k]) => k).join(', ')}`);
  }
  // AC2, spot-checked on the reported example.
  if (!cities['NL-ZH'].some((c) => c.name === 'Den Haag')) {
    throw new Error('NL cities: "Den Haag" missing from NL-ZH');
  }
  if (all.some((c) => c.name === "'s-Gravenhage")) {
    throw new Error('NL cities: "\'s-Gravenhage" leaked in as a display name');
  }
}

// ---------------------------------------------------------------- COUNTRIES
const enNames = new Intl.DisplayNames(['en'], { type: 'region' });
const safe = (dn, code) => {
  try {
    return dn.of(code);
  } catch (e) {
    return null;
  }
};
const countries = Country.getAllCountries()
  .map((c) => ({ code: c.isoCode, name: safe(enNames, c.isoCode) || c.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ------------------------------------------------------ SPAIN (RAT-1776 table)
// Autonomous Community | ISO 3166-2 community code  ->  its Provinces
const SPAIN_TABLE = {
  'Andalusia|ES-AN': ['Almería', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Málaga', 'Sevilla'],
  'Aragon|ES-AR': ['Huesca', 'Teruel', 'Zaragoza'],
  'Asturias|ES-AS': ['Asturias'],
  'Balearic Islands|ES-IB': ['Balearic Islands'],
  'Basque Country|ES-PV': ['Álava', 'Gipuzkoa', 'Bizkaia'],
  'Canary Islands|ES-CN': ['Las Palmas', 'Santa Cruz de Tenerife'],
  'Cantabria|ES-CB': ['Cantabria'],
  'Castilla-La Mancha|ES-CM': ['Albacete', 'Ciudad Real', 'Cuenca', 'Guadalajara', 'Toledo'],
  'Castile and León|ES-CL': ['Ávila', 'Burgos', 'León', 'Palencia', 'Salamanca', 'Segovia', 'Soria', 'Valladolid', 'Zamora'],
  'Catalonia|ES-CT': ['Barcelona', 'Girona', 'Lleida', 'Tarragona'],
  'Extremadura|ES-EX': ['Badajoz', 'Cáceres'],
  'Galicia|ES-GA': ['A Coruña', 'Lugo', 'Ourense', 'Pontevedra'],
  'La Rioja|ES-RI': ['La Rioja'],
  'Community of Madrid|ES-MD': ['Madrid'],
  'Region of Murcia|ES-MC': ['Murcia'],
  'Navarre|ES-NC': ['Navarra'],
  'Valencian Community|ES-VC': ['Alicante', 'Castellón', 'Valencia'],
};

// iso-3166-2 gives 4 province names in a co-official regional language; map them
// to the labels the client expects (RAT-1776).
const ALIAS = {
  Nafarroa: 'Navarra',
  Balears: 'Balearic Islands',
  Alacant: 'Alicante',
  'Castelló': 'Castellón',
};

// name -> real ISO 3166-2 province code, from iso-3166-2 (type === 'Province')
const esSubs = iso.country('ES').sub;
const nameToCode = {};
for (const [code, v] of Object.entries(esSubs)) {
  if (v.type !== 'Province') continue;
  const clean = v.name.replace(/\*$/, '').trim();
  const name = ALIAS[clean] || clean;
  nameToCode[name] = code;
}

const spainProvinces = [];
const missing = [];
for (const [key, provs] of Object.entries(SPAIN_TABLE)) {
  const [community, communityCode] = key.split('|');
  for (const name of provs) {
    const code = nameToCode[name];
    if (!code) {
      missing.push(name);
      continue;
    }
    spainProvinces.push({ code, countryCode: 'ES', name, community, communityCode });
  }
}
if (missing.length) throw new Error('Spain provinces missing an ISO code: ' + missing.join(', '));
if (spainProvinces.length !== 50) throw new Error('Expected 50 Spain provinces, got ' + spainProvinces.length);
spainProvinces.sort((a, b) => a.name.localeCompare(b.name, 'es'));

// ------------------------------------------------- PROVINCES (all countries)
const provinces = {};
for (const c of countries) {
  if (c.code === 'ES') {
    provinces.ES = spainProvinces;
    continue;
  }
  let sub = null;
  try {
    const rec = iso.country(c.code);
    sub = rec && rec.sub;
  } catch (e) {
    sub = null;
  }
  if (!sub) continue;
  const list = Object.entries(sub)
    .map(([code, v]) => ({
      code,
      countryCode: c.code,
      name: (v.name || '').replace(/\*$/, '').trim(),
      type: v.type,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (list.length) provinces[c.code] = list;
}

// RAT-2000: iso-3166-2's NL subdivisions include Aruba, Curacao and Sint
// Maarten (separate constituent countries) plus the three Caribbean special
// municipalities. None of them are NL provinces and all six return no cities,
// so they are dropped from the Province dropdown.
const NL_ALLOWED_PROVINCES = new Set(Object.values(NL_PROVINCE_CODE));
provinces.NL = (provinces.NL || []).filter((p) => NL_ALLOWED_PROVINCES.has(p.code));
if (provinces.NL.length !== 12) {
  throw new Error(`Expected 12 NL provinces, got ${provinces.NL.length}`);
}

// Emit as TypeScript modules (not JSON loaded via path) so consumers can bundle the
// data statically in the browser without Node `path`/`__dirname`/dynamic `require`.
function emit(file, typeName, typeExpr, value) {
  const body =
    `import type { ${typeName} } from '../types';\n\n` +
    `const data: ${typeExpr} = ${JSON.stringify(value, null, 2)};\n\n` +
    `export default data;\n`;
  fs.writeFileSync(path.join(OUT, file), body);
}

async function main() {
  const docs = await fetchWoonplaatsen();
  const citiesNL = buildNlCities(docs);
  assertNlCities(citiesNL);

  emit('countries.ts', 'Country', 'Country[]', countries);
  emit('provinces.ts', 'Province', 'Record<string, Province[]>', provinces);
  emit('cities-nl.ts', 'City', 'Record<string, City[]>', citiesNL);

  console.log('Generated src/data/');
  console.log('  countries:', countries.length);
  console.log('  countries with provinces:', Object.keys(provinces).length);
  console.log('  Spain provinces:', provinces.ES.length, '(expected 50)');
  console.log('  NL provinces:', provinces.NL.length, '(expected 12)');
  console.log('  NL cities:', Object.values(citiesNL).flat().length);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
