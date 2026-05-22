import type { InstitutionKind, NqfLevel, Province, TaxonomyEntry } from "./types";

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

// ──────────────────────────────────────────────────────────────────────────────
// SA tertiary institutions — controlled vocabulary.
// Representative subset of public universities + UOTs + a TVET + UNISA + INDLELA.
// Full list managed in admin taxonomy from Phase 7.

export interface InstitutionEntry extends TaxonomyEntry {
  kind: InstitutionKind;
  /** Where the main campus sits — used for proximity heuristics in Career compass. */
  city: string;
  province: string;
}

export const INSTITUTIONS: InstitutionEntry[] = [
  // Research universities
  { slug: "wits", label: "University of the Witwatersrand", kind: "university", city: "Johannesburg", province: "Gauteng" },
  { slug: "uct", label: "University of Cape Town", kind: "university", city: "Cape Town", province: "Western Cape" },
  { slug: "stellenbosch", label: "Stellenbosch University", kind: "university", city: "Stellenbosch", province: "Western Cape" },
  { slug: "up", label: "University of Pretoria", kind: "university", city: "Pretoria", province: "Gauteng" },
  { slug: "uj", label: "University of Johannesburg", kind: "university", city: "Johannesburg", province: "Gauteng" },
  { slug: "ukzn", label: "University of KwaZulu-Natal", kind: "university", city: "Durban", province: "KwaZulu-Natal" },
  { slug: "rhodes", label: "Rhodes University", kind: "university", city: "Makhanda", province: "Eastern Cape" },
  { slug: "nwu", label: "North-West University", kind: "university", city: "Potchefstroom", province: "North West" },
  { slug: "ufs", label: "University of the Free State", kind: "university", city: "Bloemfontein", province: "Free State" },
  { slug: "uwc", label: "University of the Western Cape", kind: "university", city: "Cape Town", province: "Western Cape" },
  { slug: "ufh", label: "University of Fort Hare", kind: "university", city: "Alice", province: "Eastern Cape" },
  { slug: "nmu", label: "Nelson Mandela University", kind: "university", city: "Gqeberha", province: "Eastern Cape" },
  // Universities of Technology
  { slug: "tut", label: "Tshwane University of Technology", kind: "uot", city: "Pretoria", province: "Gauteng" },
  { slug: "cput", label: "Cape Peninsula University of Technology", kind: "uot", city: "Cape Town", province: "Western Cape" },
  { slug: "dut", label: "Durban University of Technology", kind: "uot", city: "Durban", province: "KwaZulu-Natal" },
  { slug: "vut", label: "Vaal University of Technology", kind: "uot", city: "Vanderbijlpark", province: "Gauteng" },
  // Distance
  { slug: "unisa", label: "University of South Africa (UNISA)", kind: "distance", city: "Pretoria", province: "Gauteng" },
  // Public TVET (representative)
  { slug: "tvet-ekurhuleni-west", label: "Ekurhuleni West TVET College", kind: "tvet", city: "Germiston", province: "Gauteng" },
  { slug: "tvet-tshwane-north", label: "Tshwane North TVET College", kind: "tvet", city: "Pretoria", province: "Gauteng" },
  { slug: "tvet-false-bay", label: "False Bay TVET College", kind: "tvet", city: "Cape Town", province: "Western Cape" },
  // Artisan training
  { slug: "indlela", label: "INDLELA", kind: "indlela", city: "Olifantsfontein", province: "Gauteng" },
];

export const INSTITUTION_KIND_LABEL: Record<InstitutionKind, string> = {
  university: "Research university",
  uot: "University of Technology",
  tvet: "Public TVET",
  distance: "Distance university",
  indlela: "Artisan training (INDLELA)",
  private: "Private",
};

export const NQF_LEVELS: { level: NqfLevel; label: string; band: string }[] = [
  { level: 4, label: "NQF 4", band: "Matric / National Certificate" },
  { level: 5, label: "NQF 5", band: "Higher Certificate" },
  { level: 6, label: "NQF 6", band: "Diploma / Adv. Certificate" },
  { level: 7, label: "NQF 7", band: "Bachelor's / Adv. Diploma" },
  { level: 8, label: "NQF 8", band: "Honours / Postgrad Diploma" },
  { level: 9, label: "NQF 9", band: "Master's" },
  { level: 10, label: "NQF 10", band: "Doctorate" },
];

export function findInstitution(slug: string | null | undefined) {
  if (!slug) return null;
  return INSTITUTIONS.find((i) => i.slug === slug) ?? null;
}

export function nqfLabel(level: NqfLevel): string {
  const entry = NQF_LEVELS.find((n) => n.level === level);
  return entry ? `${entry.label} · ${entry.band}` : `NQF ${level}`;
}
