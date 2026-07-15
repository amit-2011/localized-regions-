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

// Emit as TypeScript modules (not JSON loaded via path) so consumers can bundle the
// data statically in the browser without Node `path`/`__dirname`/dynamic `require`.
const countriesTs =
  `import type { Country } from '../types';\n\n` +
  `const countries: Country[] = ${JSON.stringify(countries, null, 2)};\n\n` +
  `export default countries;\n`;
const provincesTs =
  `import type { Province } from '../types';\n\n` +
  `const provinces: Record<string, Province[]> = ${JSON.stringify(provinces, null, 2)};\n\n` +
  `export default provinces;\n`;
fs.writeFileSync(path.join(OUT, 'countries.ts'), countriesTs);
fs.writeFileSync(path.join(OUT, 'provinces.ts'), provincesTs);

console.log('Generated src/data/');
console.log('  countries:', countries.length);
console.log('  countries with provinces:', Object.keys(provinces).length);
console.log('  Spain provinces:', provinces.ES.length, '(expected 50)');
