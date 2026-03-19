/**
 * geocode-and-finalize.ts
 *
 * Reads scripts/candidates.json, assigns lat/lng via a static lookup map,
 * assigns difficulty, and writes public/data/seed-objects.json.
 *
 * Run: npx tsx scripts/geocode-and-finalize.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

interface Candidate {
  objectID: number;
  title: string;
  culture: string;
  country: string;
  region: string;
  city: string;
  medium: string;
  department: string;
  objectDate: string;
}

interface SeedObject {
  objectID: number;
  lat: number;
  lng: number;
  difficulty: "easy" | "medium" | "hard";
  notes: string;
}

// ---------------------------------------------------------------------------
// LOOKUP MAPS
// Each key is lowercased for matching. Values are [lat, lng].
// ---------------------------------------------------------------------------

// City-level coordinates (keyed by city name, lowercase)
const CITY_COORDS: Record<string, [number, number]> = {
  // Egypt
  thebes: [25.7402, 32.6014],
  luxor: [25.7402, 32.6014],
  memphis: [29.8476, 31.2517],
  cairo: [30.0444, 31.2357],
  giza: [30.0131, 31.2089],
  saqqara: [29.8712, 31.2165],
  amarna: [27.6453, 30.9007],
  "tell el-amarna": [27.6453, 30.9007],
  alexandria: [31.2001, 29.9187],
  // Greece
  athens: [37.9838, 23.7275],
  corinth: [37.9333, 22.9333],
  mycenae: [37.7308, 22.7561],
  olympia: [37.6386, 21.63],
  sparta: [37.0742, 22.4296],
  delphi: [38.4824, 22.5011],
  // Italy
  rome: [41.9028, 12.4964],
  pompeii: [40.7489, 14.4989],
  paestum: [40.4224, 15.0056],
  etruria: [42.5, 11.5],
  florence: [43.7696, 11.2558],
  firenze: [43.7696, 11.2558],
  venice: [45.4408, 12.3155],
  milan: [45.4654, 9.1866],
  naples: [40.8518, 14.2681],
  cremona: [45.1327, 10.0227],
  siena: [43.3186, 11.3307],
  lucca: [43.8429, 10.5027],
  pistoia: [43.933, 10.9172],
  "san gemini": [42.6167, 12.55],
  // Iraq / Mesopotamia
  ur: [30.9626, 46.1039],
  babylon: [32.5422, 44.4209],
  nineveh: [36.3592, 43.1583],
  nippur: [32.1268, 45.2327],
  baghdad: [33.3152, 44.3661],
  basra: [30.5085, 47.7804],
  // Iran / Persia
  persepolis: [29.9353, 52.8914],
  susa: [32.1897, 48.256],
  nishapur: [36.2107, 58.7956],
  isfahan: [32.6546, 51.668],
  tabriz: [38.08, 46.2919],
  herat: [34.3482, 62.2],
  kashan: [33.9851, 51.4347],
  tehran: [35.6892, 51.389],
  gurgan: [36.8368, 54.4395],
  kirman: [30.2839, 57.0834],
  taybad: [34.7399, 60.7744],
  // China
  beijing: [39.9042, 116.4074],
  shanghai: [31.2304, 121.4737],
  luoyang: [34.6197, 112.454],
  hangchow: [30.2741, 120.1551], // old name for Hangzhou
  "xianmen (formerly amoy)": [24.4798, 118.0894],
  // Japan
  kyoto: [35.0116, 135.7681],
  tokyo: [35.6762, 139.6503],
  edo: [35.6762, 139.6503],
  osaka: [34.6937, 135.5023],
  "ōsaka": [34.6937, 135.5023],
  "miwa, nara prefecture": [34.5306, 135.859],
  tohshima: [34.7, 136.5], // approximate
  // India
  delhi: [28.6139, 77.209],
  "new delhi": [28.6139, 77.209],
  mathura: [27.4924, 77.6737],
  amaravati: [16.5732, 80.3568],
  calcutta: [22.5726, 88.3639],
  lucknow: [26.8467, 80.9462],
  bijapur: [16.8302, 75.7100],
  bidar: [17.9104, 77.5199],
  // Turkey / Anatolia
  constantinople: [41.0082, 28.9784],
  istanbul: [41.0082, 28.9784],
  ankara: [39.9334, 32.8597],
  // Syria
  damascus: [33.5138, 36.2765],
  aleppo: [36.2021, 37.1343],
  // Pakistan / Afghanistan
  lahore: [31.5497, 74.3436],
  // Central Asia
  samarkand: [39.654, 66.9597],
  // France
  paris: [48.8566, 2.3522],
  limoges: [45.8336, 1.2611],
  versailles: [48.8049, 2.1204],
  strasbourg: [48.5734, 7.7521],
  rouen: [49.4432, 1.0999],
  amiens: [49.894, 2.2957],
  avignon: [43.9493, 4.8055],
  montargis: [47.9986, 2.7308],
  autun: [46.9475, 4.2988],
  // Germany
  "nürnberg": [49.4521, 11.0767],
  nuremberg: [49.4521, 11.0767],
  cologne: [50.938, 6.9603],
  hamburg: [53.5753, 10.0153],
  dresden: [51.0504, 13.7373],
  augsburg: [48.3705, 10.8978],
  aachen: [50.776, 6.0838],
  hildesheim: [52.1508, 9.9511],
  hanover: [52.3759, 9.732],
  freiburg: [47.9990, 7.8421],
  neuwied: [50.4289, 7.4641],
  jettingen: [48.3833, 10.45],
  butzbach: [50.4358, 8.6642],
  // England
  london: [51.5074, -0.1278],
  // Netherlands
  amsterdam: [52.3676, 4.9041],
  middelburg: [51.4988, 3.6136],
  // Belgium
  brussels: [50.8503, 4.3517],
  ghent: [51.0543, 3.7174],
  tournai: [50.6063, 3.3886],
  // Spain
  madrid: [40.4168, -3.7038],
  seville: [37.3891, -5.9845],
  cordoba: [37.8882, -4.7794],
  malaga: [36.7213, -4.4214],
  "manises (valencia)": [39.488, -0.4557],
  lerida: [41.614, 0.6224],
  leon: [42.5987, -5.5671],
  // Switzerland
  basel: [47.5596, 7.5886],
  // Austria
  vienna: [48.2082, 16.3738],
  innsbruck: [47.2692, 11.4041],
  ebreichsdorf: [47.9667, 16.4],
  // Portugal
  lisbon: [38.7223, -9.1393],
  // Norway
  oslo: [59.9139, 10.7522],
  // Russia
  "st. petersburg": [59.9343, 30.3351],
  // Mexico
  "mexico city": [19.4326, -99.1332],
  puebla: [19.0402, -98.2063],
  "mérida": [20.9674, -89.5928],
  tonalá: [20.6236, -103.2350],
  // Peru
  chuquibamba: [-15.8403, -72.6567],
  // Canada
  skidegate: [53.2555, -132.0747],
  // United States
  "new york": [40.7128, -74.006],
  philadelphia: [39.9526, -75.1652],
  boston: [42.3601, -71.0589],
  baltimore: [39.2904, -76.6122],
  newport: [41.4901, -71.3128],
  providence: [41.824, -71.4128],
  "jersey city": [40.7178, -74.0431],
  "new bedford": [41.6362, -70.9342],
  "san francisco": [37.7749, -122.4194],
  buffalo: [42.8864, -78.8784],
  // Indonesia
  "nusa tenggara": [-8.6574, 122.236],
  "kabiterau village": [-4.0, 136.5],
  // Philippines
  mindanao: [8.0, 125.0],
  // Papua New Guinea
  "yamok village": [-4.2, 143.2],
  // Nigeria
  "court of benin": [6.3369, 5.6289],
  "benin city": [6.3369, 5.6289],
  // Democratic Republic of the Congo
  "buli village": [-5.0, 27.5],
  // Turkey
  "iznik": [40.4295, 29.7233],
  // Tunisia
  "qairawan": [35.6781, 10.0963],
  "kairouan": [35.6781, 10.0963],
  "possibly qairawan": [35.6781, 10.0963],
  "probably qairawan": [35.6781, 10.0963],
  // Myanmar
  mandalay: [21.9745, 96.0836],
  // Mali
  "tintam village": [13.0, -8.0],
  bougouni: [11.4186, -7.4845],
  // Spain — accent variants
  "león": [42.5987, -5.5671],
  "málaga": [36.7213, -4.4214],
  // Germany — full-name variant
  "freiburg im breisgau": [47.9990, 7.8421],
  // England — typo variant in Met data
  londong: [51.5074, -0.1278],
  // Pakistan / India
  kashmir: [34.0837, 74.7973],
  // Mexico
  "iztlan del río": [21.0406, -104.3614],
  "iztlan del rio": [21.0406, -104.3614],
  // Belgium
  antwerp: [51.2194, 4.4025],
  // United States — smaller towns
  alloway: [39.5637, -75.3577],
  anna: [37.4609, -89.2484],
  biloxi: [30.3960, -88.8853],
  bristol: [41.6718, -71.2703],
  brooklyn: [40.6782, -73.9442],
  "cain hoy": [32.8885, -79.8187],
  "east windsor": [41.9312, -72.5371],
  hancock: [42.5126, -73.3579],
  hatfield: [42.3612, -72.5998],
  ipswich: [42.6776, -70.8412],
  manheim: [40.1648, -76.3938],
  "new bremen": [40.4395, -84.3730],
  norwich: [41.5243, -72.0759],
  "north's landing": [39.5, -74.5],
  pekin: [40.5675, -89.6445],
  pittsburgh: [40.4406, -79.9959],
  "rose valley": [39.8726, -75.4307],
  "rosebud reservation": [43.4520, -100.7770],
  salem: [42.5195, -70.8967],
  sandwich: [41.7590, -70.4928],
  "standing rock reservation": [45.7833, -100.8667],
  trenton: [40.2171, -74.7429],
  waynesboro: [39.7551, -77.5783],
  woodstock: [42.0415, -74.1179],
};

// Region-level coordinates (keyed by region name, lowercase)
const REGION_COORDS: Record<string, [number, number]> = {
  // Egypt regions
  "upper egypt, thebes": [25.7402, 32.6014],
  "upper egypt": [26.0, 32.0],
  "middle egypt": [28.5, 30.7],
  "lower egypt": [30.5, 31.0],
  "memphite region": [29.87, 31.22],
  "southern upper egypt": [25.0, 32.5],
  "northern upper egypt": [27.5, 31.0],
  "eastern delta": [30.8, 32.0],
  "delta": [31.0, 31.0],
  "fayum entrance area": [29.3, 30.9],
  "alexandria region": [31.2, 29.9],
  "nubia": [20.0, 33.0],
  // Mesoamerica
  mesoamerica: [20.0, -90.0],
  "tehuacan valley": [18.4613, -97.3942],
  // Africa
  "igun-eronmwen guild, court of benin": [6.3369, 5.6289],
  "grassfields region": [5.7, 10.5],
  "highlands region": [11.8, 39.0],
  "amhara region": [11.5, 38.0],
  "menabe region": [-20.0, 44.5],
  "chiloango river": [-4.5, 12.0],
  // India regions
  deccan: [17.0, 77.0],
  bengal: [23.6852, 90.3563],
  goa: [15.2993, 74.124],
  // France regions
  aquitaine: [44.5, 0.5],
  // US regions
  "plains states": [41.5, -99.0],
  "mokumanamana (necker) island, marae 12": [23.5700, -164.7000], // Hawaii/Necker Island
  // Central Asia
  "central asia": [42.0, 63.0],
  "khurasan or herat": [35.5, 61.5],
  // Peru
  "north coast": [-7.0, -79.0],        // Moche/Chimu region
  "south coast": [-14.0, -75.5],       // Nazca/Paracas region
  tembladera: [-7.42, -79.15],         // Jequetepeque Valley, Peru
  // Oceania
  "society islands": [-17.65, -149.45], // Tahiti / French Polynesia
  "gambier islands": [-23.13, -134.97], // Mangareva
  "ha'apai islands": [-19.75, -174.37], // Tonga
  "rapa nui (easter island)": [-27.11, -109.35],
  "mabuiag island": [-9.9500, 142.1800], // Torres Strait, Australia
  "possibly new georgia or guadalcanal island": [-9.0, 158.0], // Solomon Islands
  sumatra: [0.5890, 101.3431],
  // Americas
  caribbean: [18.74, -70.17],          // Dominican Republic context
  "central region": [9.9300, -84.0900], // Costa Rica
  // Egypt — additional region variants
  "upper egypt, thebes": [25.7402, 32.6014],
  "upper egypt, thebes or northern upper egypt": [25.7402, 32.6014],
  "northern upper egypt": [27.5, 31.0],
  // Africa
  "twifo-heman traditional area": [5.5, -1.5], // Ghana
};

// Country centroid coordinates (keyed by country name, lowercase)
const COUNTRY_COORDS: Record<string, [number, number]> = {
  egypt: [26.8206, 30.8025],
  "probably egypt": [26.8206, 30.8025],
  "egypt and sudan": [20.0, 33.0],
  greece: [39.0742, 21.8243],
  italy: [41.8719, 12.5674],
  "central italy": [43.0, 12.5],
  "southern italy": [40.5, 16.0],
  china: [35.8617, 104.1954],
  japan: [36.2048, 138.2529],
  india: [20.5937, 78.9629],
  "northern india": [28.0, 77.0],
  "northern india or pakistan": [30.0, 72.0],
  iran: [32.4279, 53.688],
  "iran (persia)": [32.4279, 53.688],
  "northwestern iran, probably": [37.0, 47.0],
  "iran or afghanistan": [34.0, 62.0],
  "iran or central asia": [38.0, 60.0],
  "iran or iraq": [33.0, 48.0],
  iraq: [33.2232, 43.6793],
  "iraq or northern jazira": [35.5, 42.0],
  turkey: [38.9637, 35.2433],
  "western turkey": [38.5, 27.5],
  france: [46.2276, 2.2137],
  "present-day france": [46.2276, 2.2137],
  england: [52.3555, -1.1743],
  "united kingdom": [55.3781, -3.436],
  germany: [51.1657, 10.4515],
  "germany (?)": [51.1657, 10.4515],
  netherlands: [52.1326, 5.2913],
  "the netherlands": [52.1326, 5.2913],
  "south netherlands": [50.5, 4.5],
  "southern netherlands": [50.5, 4.5],
  spain: [40.4637, -3.7492],
  peru: [-9.19, -75.0152],
  mexico: [23.6345, -102.5528],
  "new spain (mexico)": [23.6345, -102.5528],
  cambodia: [12.5657, 104.991],
  thailand: [15.87, 100.9925],
  indonesia: [-0.7893, 113.9213],
  nigeria: [9.082, 8.6753],
  mali: [17.5707, -3.9962],
  ethiopia: [9.145, 40.4897],
  "united states": [39.8283, -98.5795],
  "unitted states": [39.8283, -98.5795],
  canada: [56.1304, -106.3468],
  russia: [61.524, 105.3188],
  "southern russia or black sea region (?)": [47.0, 35.0],
  syria: [34.8021, 38.9968],
  "probably syria": [34.8021, 38.9968],
  "probably syria or iraq": [34.0, 42.0],
  "syria or north africa": [28.0, 20.0],
  switzerland: [46.8182, 8.2275],
  austria: [47.5162, 14.5501],
  "lower austria": [48.2, 15.7],
  belgium: [50.5039, 4.4699],
  portugal: [39.3999, -8.2245],
  norway: [60.472, 8.4689],
  tibet: [31.1048, 97.1704],
  "present-day afghanistan": [33.9391, 67.7099],
  "present-day pakistan": [30.3753, 69.3451],
  "china or korea": [35.0, 127.0],
  "mali, guinea, guinea-bissau or the senegambia": [12.0, -14.0],
  "angola or democratic republic of the congo": [-5.0, 20.0],
  "republic of the congo or cabinda, angola": [-4.5, 14.0],
  madagascar: [-18.7669, 46.8691],
  philippines: [12.8797, 121.774],
  myanmar: [21.9162, 95.956],
  "myanmar (formerly burma)": [21.9162, 95.956],
  uganda: [1.3733, 32.2903],
  tunisia: [33.8869, 9.5375],
  // Multi-country joined with pipe
  "france (cartoon)|southern netherlands (woven)": [48.8566, 2.3522],
  "italy|france": [44.0, 10.0],
  "france|france": [46.2276, 2.2137],
  "italy|italy": [41.8719, 12.5674],
  "iran|iran": [32.4279, 53.688],
  "sothern turkmenistan": [37.5, 59.0],
  "probably iraq or syria": [34.0, 42.0],
  "iraq or northern jazira": [35.5, 42.0],
  "egypt and sudan|nubia": [20.0, 33.0],
  "southern russia or black sea region (?)": [47.0, 35.0],
};

// Continent mapping for geographic diversity report
const CONTINENT_MAP: Record<string, string> = {
  egypt: "Africa",
  "probably egypt": "Africa",
  "egypt and sudan": "Africa",
  nigeria: "Africa",
  mali: "Africa",
  ethiopia: "Africa",
  "angola or democratic republic of the congo": "Africa",
  "republic of the congo or cabinda, angola": "Africa",
  madagascar: "Africa",
  uganda: "Africa",
  "mali, guinea, guinea-bissau or the senegambia": "Africa",
  greece: "Europe",
  italy: "Europe",
  "central italy": "Europe",
  "southern italy": "Europe",
  france: "Europe",
  "present-day france": "Europe",
  england: "Europe",
  "united kingdom": "Europe",
  germany: "Europe",
  "germany (?)": "Europe",
  netherlands: "Europe",
  "the netherlands": "Europe",
  "south netherlands": "Europe",
  "southern netherlands": "Europe",
  spain: "Europe",
  "france (cartoon)|southern netherlands (woven)": "Europe",
  switzerland: "Europe",
  austria: "Europe",
  "lower austria": "Europe",
  belgium: "Europe",
  portugal: "Europe",
  norway: "Europe",
  russia: "Europe",
  "southern russia or black sea region (?)": "Europe",
  "italy|france": "Europe",
  "france|france": "Europe",
  "italy|italy": "Europe",
  turkey: "Middle East",
  "western turkey": "Middle East",
  iran: "Middle East",
  "iran (persia)": "Middle East",
  "northwestern iran, probably": "Middle East",
  "iran or afghanistan": "Middle East",
  "iran or central asia": "Middle East",
  "iran or iraq": "Middle East",
  "iran|iran": "Middle East",
  iraq: "Middle East",
  "iraq or northern jazira": "Middle East",
  syria: "Middle East",
  "probably syria": "Middle East",
  "probably syria or iraq": "Middle East",
  "syria or north africa": "Middle East",
  "probably iraq or syria": "Middle East",
  tunisia: "Africa",
  india: "Asia",
  "northern india": "Asia",
  "northern india or pakistan": "Asia",
  china: "Asia",
  "china or korea": "Asia",
  japan: "Asia",
  tibet: "Asia",
  "present-day afghanistan": "Asia",
  "present-day pakistan": "Asia",
  cambodia: "Asia",
  thailand: "Asia",
  indonesia: "Asia",
  philippines: "Asia",
  myanmar: "Asia",
  "myanmar (formerly burma)": "Asia",
  "sothern turkmenistan": "Asia",
  peru: "Americas",
  mexico: "Americas",
  "new spain (mexico)": "Americas",
  "united states": "Americas",
  "unitted states": "Americas",
  canada: "Americas",
};

// ---------------------------------------------------------------------------
// NORMALIZATION HELPERS
// ---------------------------------------------------------------------------

function normalizeStr(s: string): string {
  return s.toLowerCase().trim();
}

/** Strip "probably", "possibly", "present-day", etc. prefixes for matching */
function stripQualifiers(s: string): string {
  return s
    .toLowerCase()
    .replace(/^probably\s+/i, "")
    .replace(/^possibly\s+/i, "")
    .replace(/^present-day\s+/i, "")
    .replace(/^\(?\?\)?$/i, "")
    .trim();
}

/** Try city lookup with various normalizations */
function lookupCity(city: string): [number, number] | null {
  if (!city) return null;
  const key = normalizeStr(city);
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  const stripped = stripQualifiers(key);
  if (CITY_COORDS[stripped]) return CITY_COORDS[stripped];
  // Strip trailing "?" or "(?)" — e.g. "Milan?", "Milan (?)", "Mandalay?"
  const noUncertainty = key.replace(/\s*\(\?\)\s*$/, "").replace(/\?\s*$/, "").trim();
  if (noUncertainty !== key) {
    if (CITY_COORDS[noUncertainty]) return CITY_COORDS[noUncertainty];
    const strippedNoUnc = stripQualifiers(noUncertainty);
    if (CITY_COORDS[strippedNoUnc]) return CITY_COORDS[strippedNoUnc];
  }
  // Handle "vicinity of X"
  const vicinityMatch = key.match(/^vicinity\s+of\s+(.+)$/);
  if (vicinityMatch) {
    const inner = vicinityMatch[1].trim();
    if (CITY_COORDS[inner]) return CITY_COORDS[inner];
  }
  // Handle "probably X" / "possibly X" city patterns
  const probablyMatch = key.match(/^(?:probably|possibly)\s+(.+)$/);
  if (probablyMatch) {
    const inner = probablyMatch[1].trim();
    if (CITY_COORDS[inner]) return CITY_COORDS[inner];
    // also try stripping trailing uncertainty from the inner part
    const innerClean = inner.replace(/\s*\(\?\)\s*$/, "").replace(/\?\s*$/, "").trim();
    if (CITY_COORDS[innerClean]) return CITY_COORDS[innerClean];
  }
  // Handle "X or Y" patterns — take first (try on both raw key and stripped)
  for (const candidate of [key, stripped]) {
    const orMatch = candidate.match(/^(.+?)\s+or\s+.+$/);
    if (orMatch) {
      const first = orMatch[1].trim();
      if (CITY_COORDS[first]) return CITY_COORDS[first];
    }
  }
  // Handle pipe-separated multi-values — take first
  const pipeFirst = key.split("|")[0].trim();
  if (pipeFirst !== key && CITY_COORDS[pipeFirst]) return CITY_COORDS[pipeFirst];
  return null;
}

/** Try region lookup */
function lookupRegion(region: string): [number, number] | null {
  if (!region) return null;
  const key = normalizeStr(region);
  if (REGION_COORDS[key]) return REGION_COORDS[key];
  const stripped = stripQualifiers(key);
  if (REGION_COORDS[stripped]) return REGION_COORDS[stripped];
  // pipe-separated: take first
  const first = key.split("|")[0].trim();
  if (first !== key && REGION_COORDS[first]) return REGION_COORDS[first];
  return null;
}

/** Try country lookup */
function lookupCountry(country: string): [number, number] | null {
  if (!country) return null;
  const key = normalizeStr(country);
  if (COUNTRY_COORDS[key]) return COUNTRY_COORDS[key];
  const stripped = stripQualifiers(key);
  if (COUNTRY_COORDS[stripped]) return COUNTRY_COORDS[stripped];
  // pipe-separated: take first
  const first = key.split("|")[0].trim();
  if (first !== key && COUNTRY_COORDS[first]) return COUNTRY_COORDS[first];
  // Try just the first word if it's "X or Y" format
  const orFirst = key.split(" or ")[0].trim();
  if (orFirst !== key && COUNTRY_COORDS[orFirst]) return COUNTRY_COORDS[orFirst];
  return null;
}

// ---------------------------------------------------------------------------
// DIFFICULTY HEURISTIC
// ---------------------------------------------------------------------------

type ResolutionLevel = "city" | "region" | "country";

function assignDifficulty(
  candidate: Candidate,
  resolution: ResolutionLevel
): "easy" | "medium" | "hard" {
  const hasCulture =
    candidate.culture.trim().length > 0 &&
    candidate.culture.toLowerCase() !== "unknown" &&
    candidate.culture.toLowerCase() !== "american";

  if (resolution === "city" && hasCulture) return "easy";
  if (resolution === "city" && !hasCulture) return "medium";
  if (resolution === "region") return "medium";
  // country-only
  if (hasCulture) return "medium";
  return "hard";
}

// ---------------------------------------------------------------------------
// CONTINENT DETECTION for summary
// ---------------------------------------------------------------------------

function getContinent(country: string): string {
  const key = normalizeStr(country);
  if (CONTINENT_MAP[key]) return CONTINENT_MAP[key];
  // Try stripped
  const stripped = stripQualifiers(key);
  if (CONTINENT_MAP[stripped]) return CONTINENT_MAP[stripped];
  return "Unknown";
}

// ---------------------------------------------------------------------------
// NOTES GENERATION
// ---------------------------------------------------------------------------

function buildNotes(candidate: Candidate, resolution: ResolutionLevel): string {
  const parts: string[] = [];
  if (candidate.city) parts.push(candidate.city);
  if (candidate.region) parts.push(candidate.region);
  if (candidate.country) parts.push(candidate.country);
  const geo = parts.join(", ");
  const culture = candidate.culture ? ` — ${candidate.culture}` : "";
  const date = candidate.objectDate ? ` (${candidate.objectDate})` : "";
  return `${geo}${culture}${date} [${resolution}-level coords]`;
}

// ---------------------------------------------------------------------------
// FILTER OUT NON-ANCIENT/NON-GEOGRAPHIC US OBJECTS
// ---------------------------------------------------------------------------

/**
 * Return true if we should include this object in the seed list.
 *
 * We aim for objects where the country/city field reflects an ancient or
 * traditional origin — not where something was merely manufactured.
 * We skip:
 *   - American Wing items (decorative arts made in US cities)
 *   - The Libraries (illuminated manuscripts made in France/England/Italy)
 *   - Musical instruments made in Europe (not ancient origin clues)
 * We keep:
 *   - Egyptian Art, Islamic Art, Medieval Art, Cloisters
 *   - Arts of Africa, Oceania, and the Americas
 *   - Musical instruments from non-European traditions
 */
function isGameplayRelevant(candidate: Candidate): boolean {
  const country = normalizeStr(candidate.country);
  const city = normalizeStr(candidate.city);
  const dept = normalizeStr(candidate.department);
  const culture = normalizeStr(candidate.culture);

  // === HARD SKIPS BY DEPARTMENT ===

  // Skip all American Wing — furniture/silver/paintings made in US cities
  if (dept === "the american wing") {
    return false;
  }

  // Skip Libraries — illuminated manuscripts made in Europe
  if (dept === "the libraries") {
    return false;
  }

  // Skip Musical Instruments from Western Europe / US (not origin-clue worthy)
  if (dept === "musical instruments") {
    const europeanMusicCountries = new Set([
      "italy", "germany", "france", "england", "spain", "netherlands",
      "the netherlands", "south netherlands", "southern netherlands",
      "austria", "belgium", "norway", "switzerland", "portugal",
      "united kingdom",
    ]);
    const cKey = country.split("|")[0].trim();
    if (europeanMusicCountries.has(cKey)) return false;
    // Also skip US instruments
    if (cKey.startsWith("united states")) return false;
  }

  // === COUNTRY-LEVEL FILTERS ===

  // Skip plain US with American Wing cities
  const usModernCities = new Set([
    "new york", "philadelphia", "boston", "baltimore", "newport",
    "providence", "jersey city", "new bedford", "san francisco",
    "buffalo", "hancock", "alloway", "ipswich", "new bremen",
    "manheim", "norwich", "north's landing", "bristol",
    "rose valley", "woodstock", "east windsor", "cain hoy",
    "waynesboro", "anna", "pekin",
  ]);

  const isNativeAmerican =
    culture.includes("sioux") ||
    culture.includes("cheyenne") ||
    culture.includes("apache") ||
    culture.includes("navajo") ||
    culture.includes("pueblo") ||
    culture.includes("haida") ||
    culture.includes("kwakwaka") ||
    culture.includes("tlingit") ||
    culture.includes("plains") ||
    culture.includes("lakota") ||
    culture.includes("ojibwe") ||
    culture.includes("shoshone") ||
    culture.includes("native american") ||
    city.includes("standing rock") ||
    city.includes("rosebud reservation");

  if (
    (country.startsWith("united states") || country === "unitted states") &&
    usModernCities.has(city) &&
    !isNativeAmerican
  ) {
    return false;
  }

  // Skip bland "United States" with no region and no native culture
  if (
    (country === "united states" || country === "unitted states") &&
    !city &&
    !candidate.region &&
    !isNativeAmerican
  ) {
    return false;
  }

  // Skip London/England decorative arts (not ancient)
  if (
    (country === "england" || country === "united kingdom") &&
    (city === "london" || city === "londong" || city === "probably london")
  ) {
    return false;
  }

  // Skip Paris decorative arts (Libraries already caught most, but belt+suspenders)
  // We keep Paris Islamic Art (which is manufacture place for medieval objects) but
  // those are already filtered by dept above. Keep anything remaining.

  // Keep everything else
  return true;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const candidatesPath = path.join(__dirname, "candidates.json");
  const outputDir = path.join(projectRoot, "public", "data");
  const outputPath = path.join(outputDir, "seed-objects.json");

  const candidates: Candidate[] = JSON.parse(
    readFileSync(candidatesPath, "utf-8")
  );

  console.log(`\nLoaded ${candidates.length} candidates from ${candidatesPath}`);

  mkdirSync(outputDir, { recursive: true });

  const seedObjects: SeedObject[] = [];
  let skippedNoCoords = 0;

  const unmatchedCombos: Set<string> = new Set();

  for (const candidate of candidates) {
    // Try geocoding: city → region only (no country centroids)
    let coords: [number, number] | null = null;
    let resolution: ResolutionLevel | null = null;

    coords = lookupCity(candidate.city);
    if (coords) {
      resolution = "city";
    } else {
      coords = lookupRegion(candidate.region);
      if (coords) {
        resolution = "region";
      }
    }

    if (!coords || !resolution) {
      unmatchedCombos.add(
        `country="${candidate.country}" region="${candidate.region}" city="${candidate.city}"`
      );
      skippedNoCoords++;
      continue;
    }

    const difficulty = assignDifficulty(candidate, resolution);
    const notes = buildNotes(candidate, resolution);

    seedObjects.push({
      objectID: candidate.objectID,
      lat: coords[0],
      lng: coords[1],
      difficulty,
      notes,
    });
  }

  // De-duplicate by objectID (keep first occurrence)
  const seen = new Set<number>();
  const deduped = seedObjects.filter((obj) => {
    if (seen.has(obj.objectID)) return false;
    seen.add(obj.objectID);
    return true;
  });

  // -------------------------------------------------------------------------
  // PER-COUNTRY CAPS
  // US is intentionally capped low — present but not common.
  // France capped to avoid decorative arts dominating Europe.
  // Everything else uncapped (take all available).
  // -------------------------------------------------------------------------

  const COUNTRY_CAPS: Record<string, number> = {
    "egypt": 40,
    "egypt and sudan": 5,
    "probably egypt": 2,
    "united states": 10,
    "unitted states": 0,   // typo variant — fold into US cap above
    "france": 20,
    "present-day france": 5,
    "france (cartoon)": 5,
  };

  const candidateMap2 = new Map(candidates.map((c) => [c.objectID, c]));

  // Sort: city-level coords first (more precise = better gameplay)
  const difficultyOrder = { easy: 0, medium: 1, hard: 2 };
  const sortedByDifficulty = [...deduped].sort(
    (a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
  );

  // Bucket by normalized first-pipe country value
  const countryBuckets: Record<string, SeedObject[]> = {};
  for (const obj of sortedByDifficulty) {
    const cand = candidateMap2.get(obj.objectID);
    const country = cand
      ? normalizeStr(cand.country.split("|")[0].trim())
      : "unknown";
    if (!countryBuckets[country]) countryBuckets[country] = [];
    countryBuckets[country].push(obj);
  }

  const balanced: SeedObject[] = [];
  for (const [country, objs] of Object.entries(countryBuckets)) {
    const cap = COUNTRY_CAPS[country] ?? Infinity;
    balanced.push(...objs.slice(0, cap));
  }

  // Sort by objectID so the list isn't country-clustered
  balanced.sort((a, b) => a.objectID - b.objectID);

  const finalList = balanced;

  writeFileSync(outputPath, JSON.stringify(finalList, null, 2), "utf-8");

  // -------------------------------------------------------------------------
  // REPORTING
  // -------------------------------------------------------------------------

  console.log(`\n=== Geocoding & Finalization Results ===`);
  console.log(`Total candidates processed: ${candidates.length}`);
  console.log(`Skipped (no city or region coords): ${skippedNoCoords}`);
  console.log(`Duplicate objectIDs removed: ${seedObjects.length - deduped.length}`);
  console.log(`After dedup: ${deduped.length}`);
  console.log(`After per-country caps: ${finalList.length}`);
  console.log(`Output written to: ${outputPath}`);

  // Difficulty breakdown
  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  for (const obj of finalList) diffCounts[obj.difficulty]++;
  console.log(`\nDifficulty breakdown:`);
  console.log(`  easy:   ${diffCounts.easy} (${pct(diffCounts.easy, finalList.length)}%)`);
  console.log(`  medium: ${diffCounts.medium} (${pct(diffCounts.medium, finalList.length)}%)`);
  console.log(`  hard:   ${diffCounts.hard} (${pct(diffCounts.hard, finalList.length)}%)`);

  // Per-country breakdown
  const countryCounts: Record<string, number> = {};
  for (const obj of finalList) {
    const cand = candidateMap2.get(obj.objectID);
    const country = cand ? cand.country.split("|")[0].trim() : "Unknown";
    countryCounts[country] = (countryCounts[country] ?? 0) + 1;
  }
  const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
  console.log(`\nBy country (${sortedCountries.length} countries):`);
  for (const [country, count] of sortedCountries) {
    console.log(`  ${count.toString().padStart(3)}  ${country}`);
  }

  // Warn if below target
  if (finalList.length < 100) {
    console.warn(`\nWARNING: Only ${finalList.length} objects in final seed list (target: 150–250, minimum: 100).`);
  } else if (finalList.length < 150) {
    console.warn(`\nWARNING: ${finalList.length} objects — below target range of 150–250.`);
  } else if (finalList.length > 300) {
    console.warn(`\nWARNING: ${finalList.length} objects — above target range (target: 150–250).`);
  } else {
    console.log(`\nSeed list size (${finalList.length}) is within target range (150–250).`);
  }

  // Log unmatched combinations for debugging
  if (unmatchedCombos.size > 0) {
    console.log(`\nUnmatched geographic combos (${unmatchedCombos.size}):`);
    for (const combo of unmatchedCombos) {
      console.log(`  ${combo}`);
    }
  }
}

function pct(n: number, total: number): string {
  return total === 0 ? "0" : ((n / total) * 100).toFixed(1);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
