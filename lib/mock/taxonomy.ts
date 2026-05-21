import type { Province, TaxonomyEntry } from "./types";

// Controlled vocabularies. Phase 4 moves these to DB tables (`provinces`, `cities`,
// `professions`, `skills`) — but the shape stays identical so the seam holds.

export const PROVINCES: Province[] = [
  {
    slug: "eastern-cape",
    label: "Eastern Cape",
    cities: [
      { slug: "gqeberha", label: "Gqeberha" },
      { slug: "east-london", label: "East London" },
      { slug: "mthatha", label: "Mthatha" },
    ],
  },
  {
    slug: "free-state",
    label: "Free State",
    cities: [
      { slug: "bloemfontein", label: "Bloemfontein" },
      { slug: "welkom", label: "Welkom" },
    ],
  },
  {
    slug: "gauteng",
    label: "Gauteng",
    cities: [
      { slug: "johannesburg", label: "Johannesburg" },
      { slug: "pretoria", label: "Pretoria" },
      { slug: "soweto", label: "Soweto" },
      { slug: "tembisa", label: "Tembisa" },
    ],
  },
  {
    slug: "kwazulu-natal",
    label: "KwaZulu-Natal",
    cities: [
      { slug: "durban", label: "Durban" },
      { slug: "pietermaritzburg", label: "Pietermaritzburg" },
      { slug: "umlazi", label: "Umlazi" },
    ],
  },
  {
    slug: "limpopo",
    label: "Limpopo",
    cities: [
      { slug: "polokwane", label: "Polokwane" },
      { slug: "thohoyandou", label: "Thohoyandou" },
    ],
  },
  {
    slug: "mpumalanga",
    label: "Mpumalanga",
    cities: [
      { slug: "mbombela", label: "Mbombela" },
      { slug: "witbank", label: "eMalahleni" },
    ],
  },
  {
    slug: "northern-cape",
    label: "Northern Cape",
    cities: [
      { slug: "kimberley", label: "Kimberley" },
      { slug: "upington", label: "Upington" },
    ],
  },
  {
    slug: "north-west",
    label: "North West",
    cities: [
      { slug: "rustenburg", label: "Rustenburg" },
      { slug: "mahikeng", label: "Mahikeng" },
    ],
  },
  {
    slug: "western-cape",
    label: "Western Cape",
    cities: [
      { slug: "cape-town", label: "Cape Town" },
      { slug: "stellenbosch", label: "Stellenbosch" },
      { slug: "george", label: "George" },
    ],
  },
];

// Seed only — extended in Phase 7 by admin taxonomy management.
export const PROFESSIONS: TaxonomyEntry[] = [
  { slug: "chef", label: "Chef" },
  { slug: "software-developer", label: "Software Developer" },
  { slug: "help-desk", label: "Help Desk / IT Support" },
  { slug: "call-centre-agent", label: "Call-Centre Agent" },
  { slug: "hr-practitioner", label: "HR Practitioner" },
  { slug: "electrician", label: "Electrician" },
  { slug: "plumber", label: "Plumber" },
  { slug: "accountant", label: "Accountant" },
  { slug: "nurse", label: "Nurse" },
  { slug: "driver", label: "Driver" },
  { slug: "boilermaker", label: "Boilermaker" },
  { slug: "welder", label: "Welder" },
  { slug: "teacher", label: "Teacher" },
];

export const SKILLS: TaxonomyEntry[] = [
  { slug: "pastry", label: "Pastry" },
  { slug: "menu-design", label: "Menu design" },
  { slug: "kitchen-mgmt", label: "Kitchen management" },
  { slug: "grill", label: "Grill" },
  { slug: "prep", label: "Prep" },
  { slug: "plating", label: "Plating" },
  { slug: "wiring", label: "Domestic wiring" },
  { slug: "industrial-wiring", label: "Industrial wiring" },
  { slug: "react", label: "React" },
  { slug: "node", label: "Node.js" },
  { slug: "typescript", label: "TypeScript" },
  { slug: "postgres", label: "PostgreSQL" },
  { slug: "ifrs", label: "IFRS reporting" },
  { slug: "payroll", label: "Payroll" },
  { slug: "pdi", label: "Pre-delivery inspection" },
];

export function findProvinceBySlug(slug: string | null | undefined) {
  if (!slug) return null;
  return PROVINCES.find((p) => p.slug === slug) ?? null;
}

export function findCityBySlug(slug: string | null | undefined) {
  if (!slug) return null;
  for (const p of PROVINCES) {
    const c = p.cities.find((x) => x.slug === slug);
    if (c) return { ...c, province: p };
  }
  return null;
}

export function findProfession(slug: string | null | undefined) {
  if (!slug) return null;
  return PROFESSIONS.find((p) => p.slug === slug) ?? null;
}
