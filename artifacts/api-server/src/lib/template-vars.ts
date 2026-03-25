const FIRST_NAMES = ["James","John","Robert","Michael","William","David","Richard","Joseph","Thomas","Charles","Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen","Emma","Liam","Noah","Oliver","Elijah","Ava","Isabella","Sophia","Charlotte","Mia"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin"];
const COMPANIES = ["Acme Corp","Nexus Solutions","BluePeak Tech","Orbital Systems","Zenith Digital","Apex Industries","Skyline Group","TerraLink","Fusion Labs","GridPoint Inc","Vektor AI","Momentum Co","Stratos Media","ClearPath LLC","PrimeNet"];
const STREETS = ["742 Evergreen Terrace","1600 Pennsylvania Ave","350 Fifth Ave","221B Baker St","1 Infinite Loop","425 Mission St","800 N Michigan Ave","555 Market St","1 Microsoft Way","3000 Sand Hill Rd","456 Oak Avenue","789 Maple Drive","123 Main Street","2048 Innovation Blvd","900 Summit Ridge"];
const CITIES = ["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas","San Jose","Austin","Jacksonville","Fort Worth","Columbus","Charlotte","San Francisco","Indianapolis","Seattle","Denver","Boston","Nashville","Portland","Las Vegas","Memphis","Louisville"];
const STATE_DATA: { abbr: string; name: string }[] = [
  { abbr: "AL", name: "Alabama" }, { abbr: "AK", name: "Alaska" }, { abbr: "AZ", name: "Arizona" },
  { abbr: "CA", name: "California" }, { abbr: "CO", name: "Colorado" }, { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" }, { abbr: "IL", name: "Illinois" }, { abbr: "NY", name: "New York" },
  { abbr: "TX", name: "Texas" }, { abbr: "WA", name: "Washington" }, { abbr: "MA", name: "Massachusetts" },
  { abbr: "OH", name: "Ohio" }, { abbr: "NC", name: "North Carolina" }, { abbr: "MI", name: "Michigan" },
  { abbr: "NV", name: "Nevada" }, { abbr: "OR", name: "Oregon" }, { abbr: "TN", name: "Tennessee" },
];
const JOB_TITLES = ["CEO","COO","CFO","CTO","VP of Marketing","VP of Sales","Marketing Director","Sales Manager","Product Manager","Software Engineer","Data Analyst","Digital Marketing Manager","Business Development Manager","Operations Manager","Account Executive","Brand Manager","Content Strategist","UX Designer","DevOps Engineer","HR Director"];
const INDUSTRIES = ["Technology","Healthcare","Finance","E-Commerce","Real Estate","Education","Manufacturing","Retail","Hospitality","Insurance","Media","Consulting","Legal","Logistics","Pharmaceutical"];
const PHONE_TYPES = ["iPhone 16 Pro","iPhone 15 Pro Max","iPhone 14","iPhone 13 Mini","Samsung Galaxy S25 Ultra","Samsung Galaxy S24","Google Pixel 9 Pro","Google Pixel 8a","OnePlus 12","Motorola Edge 50","Samsung Galaxy A55","iPhone SE (3rd Gen)","Samsung Galaxy Z Fold 6","Google Pixel 9","iPhone 16"];
const CARRIERS = ["Verizon","AT&T","T-Mobile","Sprint","US Cellular","Boost Mobile","Cricket Wireless","Metro PCS","Straight Talk"];
const AREA_CODES = ["212","310","415","713","312","617","305","404","503","702","206","214","480","602","305","804","813","720","303","617"];
const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const COUPON_PREFIXES = ["CYBER","DEAL","SAVE","PROMO","VIP","ELITE","XCRAWL","MEGA","FLASH","BOOST"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rndInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rndHex(len: number): string {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join("");
}

function rndAlphaNum(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...Array(len)].map(() => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function uuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export interface ContactData {
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  [key: string]: string | undefined;
}

export function resolveVars(html: string, contact: ContactData = {}): string {
  const now = new Date();
  const firstName = contact.first_name || pick(FIRST_NAMES);
  const lastName = contact.last_name || pick(LAST_NAMES);
  const fullName = `${firstName} ${lastName}`;
  const email = contact.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
  const company = contact.company || pick(COMPANIES);
  const areaCode = pick(AREA_CODES);
  const phoneLocal = `${rndInt(200, 999)}-${rndInt(1000, 9999)}`;
  const phoneRaw = `${areaCode}${phoneLocal.replace(/-/g, "")}`;
  const phoneFormatted = `(${areaCode}) ${phoneLocal}`;
  const stateObj = pick(STATE_DATA);
  const city = pick(CITIES);
  const zip = `${rndInt(10000, 99999)}`;
  const street = pick(STREETS);
  const address = `${street}, ${city}, ${stateObj.abbr} ${zip}`;
  const phoneType = pick(PHONE_TYPES);
  const carrier = pick(CARRIERS);
  const age = rndInt(22, 65);
  const gender = Math.random() > 0.5 ? "Male" : "Female";
  const jobTitle = pick(JOB_TITLES);
  const industry = pick(INDUSTRIES);
  const domainSlug = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  const website = `www.${domainSlug}.com`;
  const dayName = DAY_NAMES[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const monthName = MONTH_NAMES[now.getMonth()];
  const year = now.getFullYear();
  const dateShort = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${year}`;
  const dateIso = now.toISOString().slice(0, 10);
  const dateLong = `${monthName} ${now.getDate()}, ${year}`;
  const hour12 = now.getHours() % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() < 12 ? "AM" : "PM";
  const time12 = `${hour12}:${minutes} ${ampm}`;
  const time24 = `${String(now.getHours()).padStart(2, "0")}:${minutes}`;
  const datetime = `${dateLong} at ${time12}`;
  const couponCode = `${pick(COUPON_PREFIXES)}-${rndAlphaNum(4)}`;
  const trackingId = `TRK-${rndHex(8)}`;
  const randomNum = String(rndInt(10000, 999999));
  const uuid = uuidV4();
  const unsubUrl = contact["unsubscribe_url"] || `https://unsubscribe.example.com/?id=${rndHex(16)}`;

  const map: Record<string, string> = {
    first_name: firstName,
    firstname: firstName,
    last_name: lastName,
    lastname: lastName,
    full_name: fullName,
    fullname: fullName,
    name: fullName,
    email: email,
    company: company,
    age: String(age),
    gender: gender,
    job_title: jobTitle,
    jobtitle: jobTitle,
    title: jobTitle,
    industry: industry,
    website: website,
    phone: phoneFormatted,
    phone_10: phoneRaw,
    number10: phoneRaw,
    phone_raw: phoneRaw,
    phone_formatted: phoneFormatted,
    phone_type: phoneType,
    device: phoneType,
    carrier: carrier,
    street: street,
    city: city,
    state: stateObj.abbr,
    state_full: stateObj.name,
    zip: zip,
    zipcode: zip,
    postal_code: zip,
    country: "United States",
    address: address,
    date: dateLong,
    date_long: dateLong,
    date_short: dateShort,
    date_us: dateShort,
    date_iso: dateIso,
    time: time12,
    time_12: time12,
    time_24: time24,
    datetime: datetime,
    day: dayName,
    month: monthName,
    year: String(year),
    coupon_code: couponCode,
    coupon: couponCode,
    tracking_id: trackingId,
    random_number: randomNum,
    uuid: uuid,
    unsubscribe_url: unsubUrl,
    click_url: unsubUrl.replace("unsubscribe", "track/click"),
  };

  return html.replace(/\{\{(\s*[\w_]+\s*(?:\|[^}]*)?\s*)\}\}/gi, (match, raw) => {
    const key = raw.trim().split("|")[0].trim().toLowerCase();
    return map[key] ?? match;
  });
}

export const VAR_CATALOG: Array<{
  category: string;
  vars: Array<{ tag: string; description: string; example: string }>;
}> = [
  {
    category: "Person",
    vars: [
      { tag: "{{first_name}}", description: "First name", example: "James" },
      { tag: "{{last_name}}", description: "Last name", example: "Smith" },
      { tag: "{{full_name}}", description: "Full name", example: "James Smith" },
      { tag: "{{email}}", description: "Email address", example: "james.smith@example.com" },
      { tag: "{{age}}", description: "Age (22–65)", example: "34" },
      { tag: "{{gender}}", description: "Gender", example: "Male" },
      { tag: "{{job_title}}", description: "Job title", example: "Marketing Director" },
      { tag: "{{company}}", description: "Company name", example: "Nexus Solutions" },
      { tag: "{{industry}}", description: "Industry", example: "Technology" },
      { tag: "{{website}}", description: "Company website", example: "www.nexussolutions.com" },
    ],
  },
  {
    category: "Phone",
    vars: [
      { tag: "{{phone}}", description: "US phone formatted", example: "(415) 867-5309" },
      { tag: "{{Number10}}", description: "US phone 10 digits raw", example: "4158675309" },
      { tag: "{{phone_10}}", description: "US phone 10 digits raw", example: "4158675309" },
      { tag: "{{phone_type}}", description: "Device model", example: "iPhone 16 Pro" },
      { tag: "{{device}}", description: "Device model (alias)", example: "Samsung Galaxy S25 Ultra" },
      { tag: "{{carrier}}", description: "Mobile carrier", example: "Verizon" },
    ],
  },
  {
    category: "Location",
    vars: [
      { tag: "{{address}}", description: "Full US address", example: "742 Evergreen Terrace, Chicago, IL 60601" },
      { tag: "{{street}}", description: "Street address", example: "742 Evergreen Terrace" },
      { tag: "{{city}}", description: "City", example: "Chicago" },
      { tag: "{{state}}", description: "State abbreviation", example: "IL" },
      { tag: "{{state_full}}", description: "Full state name", example: "Illinois" },
      { tag: "{{zip}}", description: "ZIP code", example: "60601" },
      { tag: "{{country}}", description: "Country", example: "United States" },
    ],
  },
  {
    category: "Date & Time",
    vars: [
      { tag: "{{date}}", description: "Full date", example: "March 24, 2026" },
      { tag: "{{date_short}}", description: "Short date MM/DD/YYYY", example: "03/24/2026" },
      { tag: "{{date_iso}}", description: "ISO date YYYY-MM-DD", example: "2026-03-24" },
      { tag: "{{time}}", description: "12-hour time", example: "2:47 PM" },
      { tag: "{{time_24}}", description: "24-hour time", example: "14:47" },
      { tag: "{{datetime}}", description: "Full date + time", example: "March 24, 2026 at 2:47 PM" },
      { tag: "{{day}}", description: "Day of week", example: "Monday" },
      { tag: "{{month}}", description: "Month name", example: "March" },
      { tag: "{{year}}", description: "4-digit year", example: "2026" },
    ],
  },
  {
    category: "Utility",
    vars: [
      { tag: "{{coupon_code}}", description: "Random coupon code", example: "CYBER-X7K2" },
      { tag: "{{tracking_id}}", description: "Tracking identifier", example: "TRK-4F8A2C9E" },
      { tag: "{{random_number}}", description: "Random 5–6 digit number", example: "847291" },
      { tag: "{{uuid}}", description: "Unique UUID v4", example: "550e8400-e29b-41d4-a716-446655440000" },
      { tag: "{{unsubscribe_url}}", description: "Unsubscribe link URL", example: "https://..." },
      { tag: "{{click_url}}", description: "Click tracking URL", example: "https://..." },
    ],
  },
];
