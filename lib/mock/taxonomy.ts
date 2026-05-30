import type { InstitutionKind, NqfLevel, Province, TaxonomyEntry } from "./types";

// Controlled vocabularies. Phase 4 moves these to DB tables (`provinces`, `cities`,
// `professions`, `skills`)  but the shape stays identical so the seam holds.

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

// Seed only  extended in Phase 7 by admin taxonomy management.
// Sebenza profession catalogue. SA-grounded, organised by sector below for
// readability  the dropdown sorts/filters at render time so the file order
// only matters for grep + diffs. Admins can extend this at runtime via
// `/admin/taxonomy`  any addition there is persisted in the `professions`
// table independently of this file.
export const PROFESSIONS: TaxonomyEntry[] = [
  // ── Hospitality ──────────────────────────────────────────────────────
  { slug: "chef", label: "Chef" },
  { slug: "cook", label: "Cook" },
  { slug: "kitchen-porter", label: "Kitchen Porter" },
  { slug: "waitstaff", label: "Waitstaff" },
  { slug: "barista", label: "Barista" },
  { slug: "bartender", label: "Bartender" },
  { slug: "restaurant-manager", label: "Restaurant Manager" },
  { slug: "hotel-receptionist", label: "Hotel Receptionist" },
  { slug: "housekeeping", label: "Housekeeping Attendant" },
  // ── Tech + IT ────────────────────────────────────────────────────────
  { slug: "software-developer", label: "Software Developer" },
  { slug: "help-desk", label: "Help Desk / IT Support" },
  { slug: "ux-ui-designer", label: "UX/UI Designer" },
  // ── Admin + office ───────────────────────────────────────────────────
  { slug: "call-centre-agent", label: "Call-Centre Agent" },
  { slug: "hr-practitioner", label: "HR Practitioner" },
  { slug: "receptionist", label: "Receptionist" },
  { slug: "admin-clerk", label: "Administrative Clerk" },
  { slug: "personal-assistant", label: "Personal Assistant" },
  // ── Finance ──────────────────────────────────────────────────────────
  { slug: "accountant", label: "Accountant" },
  { slug: "bookkeeper", label: "Bookkeeper" },
  // ── Trades + construction ────────────────────────────────────────────
  { slug: "electrician", label: "Electrician" },
  { slug: "plumber", label: "Plumber" },
  { slug: "bricklayer", label: "Bricklayer" },
  { slug: "carpenter", label: "Carpenter" },
  { slug: "painter", label: "Painter" },
  { slug: "tiler", label: "Tiler" },
  { slug: "roofer", label: "Roofer" },
  { slug: "plasterer", label: "Plasterer" },
  { slug: "boilermaker", label: "Boilermaker" },
  { slug: "welder", label: "Welder" },
  // ── Automotive + technical ───────────────────────────────────────────
  { slug: "mechanic", label: "Mechanic" },
  { slug: "panel-beater", label: "Panel Beater" },
  { slug: "aircon-technician", label: "Aircon Technician" },
  { slug: "fridge-technician", label: "Fridge Technician" },
  // ── Healthcare ───────────────────────────────────────────────────────
  { slug: "nurse", label: "Nurse" },
  { slug: "caregiver", label: "Caregiver" },
  { slug: "paramedic", label: "Paramedic" },
  { slug: "pharmacy-assistant", label: "Pharmacy Assistant" },
  { slug: "dental-assistant", label: "Dental Assistant" },
  // ── Education ────────────────────────────────────────────────────────
  { slug: "teacher", label: "Teacher" },
  { slug: "tutor", label: "Tutor" },
  { slug: "ecd-practitioner", label: "ECD Practitioner" },
  { slug: "lecturer", label: "Lecturer" },
  { slug: "sports-coach", label: "Sports Coach" },
  // ── Transport ────────────────────────────────────────────────────────
  { slug: "driver", label: "Driver" },
  { slug: "truck-driver", label: "Truck Driver (long-haul)" },
  { slug: "delivery-driver", label: "Delivery Driver" },
  { slug: "taxi-driver", label: "Taxi Driver" },
  { slug: "forklift-operator", label: "Forklift Operator" },
  { slug: "crane-operator", label: "Crane Operator" },
  // ── Retail + service ─────────────────────────────────────────────────
  { slug: "retail-assistant", label: "Retail Assistant" },
  { slug: "cashier", label: "Cashier" },
  { slug: "store-manager", label: "Store Manager" },
  { slug: "visual-merchandiser", label: "Visual Merchandiser" },
  // ── Security ─────────────────────────────────────────────────────────
  { slug: "security-officer", label: "Security Officer" },
  { slug: "armed-response", label: "Armed Response Officer" },
  { slug: "cctv-operator", label: "CCTV Operator" },
  // ── Cleaning + facilities ────────────────────────────────────────────
  { slug: "domestic-worker", label: "Domestic Worker" },
  { slug: "cleaner", label: "Cleaner" },
  { slug: "caretaker", label: "Caretaker" },
  { slug: "gardener", label: "Gardener" },
  // ── Beauty + wellness ────────────────────────────────────────────────
  { slug: "hairstylist", label: "Hairstylist" },
  { slug: "barber", label: "Barber" },
  { slug: "beauty-therapist", label: "Beauty Therapist" },
  { slug: "nail-technician", label: "Nail Technician" },
  { slug: "massage-therapist", label: "Massage Therapist" },
  { slug: "spa-therapist", label: "Spa Therapist" },
  { slug: "aesthetician", label: "Aesthetician" },
  { slug: "makeup-artist", label: "Makeup Artist" },
  // ── Fitness + sport ──────────────────────────────────────────────────
  { slug: "personal-trainer", label: "Personal Trainer" },
  { slug: "fitness-instructor", label: "Fitness Instructor" },
  { slug: "yoga-instructor", label: "Yoga Instructor" },
  { slug: "pilates-instructor", label: "Pilates Instructor" },
  // ── Aquatics + recreation ────────────────────────────────────────────
  // Added to support metro seasonal-hire patterns (e.g. ~600 summer
  // beach + pool lifeguards). All three roles map cleanly to the
  // seasonal work-availability axis.
  { slug: "lifeguard", label: "Lifeguard" },
  { slug: "pool-attendant", label: "Pool Attendant" },
  { slug: "swim-instructor", label: "Swimming Instructor" },
  // ── Agriculture + mining ─────────────────────────────────────────────
  { slug: "farm-worker", label: "Farm Worker" },
  { slug: "miner", label: "Miner" },
  { slug: "mine-safety-officer", label: "Mine Safety Officer" },
  // ── Property + real estate ───────────────────────────────────────────
  // "Estate Agent" is the colloquial SA term. The Property Practitioners
  // Act 2019 retitles the legal designation to "Property Practitioner"
  // but everyday usage stays "Estate Agent"  match user intent. If a
  // user needs the legal title, admin can add it via /admin/taxonomy
  // or the 9.15 suggestion flow.
  { slug: "estate-agent", label: "Estate Agent" },
  { slug: "rental-agent", label: "Rental Agent" },
  { slug: "property-manager", label: "Property Manager" },
  { slug: "property-valuer", label: "Property Valuer" },
  // ── Legal ────────────────────────────────────────────────────────────
  // SA-specific note: "Attorney" (works through a law firm) is distinct
  // from "Advocate" (bar member, takes briefs from attorneys). Both
  // canonical. "Candidate Attorney" is the SA articled-clerk equivalent.
  { slug: "attorney", label: "Attorney" },
  { slug: "advocate", label: "Advocate" },
  { slug: "candidate-attorney", label: "Candidate Attorney" },
  { slug: "paralegal", label: "Paralegal" },
  { slug: "legal-secretary", label: "Legal Secretary" },
  // ── Insurance ────────────────────────────────────────────────────────
  // SA: "Claims Assessor" is the standard term (USA: "Claims Adjuster").
  { slug: "insurance-broker", label: "Insurance Broker" },
  { slug: "claims-assessor", label: "Claims Assessor" },
  { slug: "underwriter", label: "Underwriter" },
  // ── Logistics + warehouse ────────────────────────────────────────────
  { slug: "warehouse-picker", label: "Warehouse Picker / Packer" },
  { slug: "stock-controller", label: "Stock Controller" },
  { slug: "dispatch-clerk", label: "Dispatch Clerk" },
  { slug: "logistics-coordinator", label: "Logistics Coordinator" },
  { slug: "supply-chain-officer", label: "Supply Chain Officer" },
  // ── Creative + media ─────────────────────────────────────────────────
  { slug: "graphic-designer", label: "Graphic Designer" },
  { slug: "photographer", label: "Photographer" },
  { slug: "videographer", label: "Videographer" },
  { slug: "copywriter", label: "Copywriter" },
  { slug: "content-creator", label: "Content Creator" },
  // ── Sales + marketing ────────────────────────────────────────────────
  { slug: "sales-representative", label: "Sales Representative" },
  { slug: "marketing-coordinator", label: "Marketing Coordinator" },
  { slug: "social-media-manager", label: "Social Media Manager" },
  { slug: "digital-marketer", label: "Digital Marketer" },
  { slug: "brand-manager", label: "Brand Manager" },
];

export const SKILLS: TaxonomyEntry[] = [
  // ── Hospitality ──────────────────────────────────────────────────────
  { slug: "pastry", label: "Pastry" },
  { slug: "baking", label: "Baking" },
  { slug: "menu-design", label: "Menu design" },
  { slug: "kitchen-mgmt", label: "Kitchen management" },
  { slug: "grill", label: "Grill" },
  { slug: "prep", label: "Prep" },
  { slug: "plating", label: "Plating" },
  { slug: "food-safety", label: "Food safety / hygiene" },
  { slug: "coffee-art", label: "Espresso & latte art" },
  { slug: "mixology", label: "Mixology" },
  { slug: "pos-systems", label: "Point-of-sale systems" },
  { slug: "customer-service", label: "Customer service" },
  // ── Tech + IT ────────────────────────────────────────────────────────
  { slug: "react", label: "React" },
  { slug: "node", label: "Node.js" },
  { slug: "typescript", label: "TypeScript" },
  { slug: "python", label: "Python" },
  { slug: "sql", label: "SQL" },
  { slug: "postgres", label: "PostgreSQL" },
  { slug: "aws", label: "AWS" },
  { slug: "figma", label: "Figma" },
  // ── Trades + electrical ──────────────────────────────────────────────
  { slug: "wiring", label: "Domestic wiring" },
  { slug: "industrial-wiring", label: "Industrial wiring" },
  { slug: "pipe-fitting", label: "Pipe fitting" },
  // ── Finance + accounting ─────────────────────────────────────────────
  { slug: "ifrs", label: "IFRS reporting" },
  { slug: "payroll", label: "Payroll" },
  { slug: "bookkeeping-skill", label: "Bookkeeping" },
  { slug: "saipa", label: "SAIPA membership" },
  // ── Office + admin ───────────────────────────────────────────────────
  { slug: "excel", label: "Microsoft Excel" },
  { slug: "word", label: "Microsoft Word" },
  // ── Automotive ───────────────────────────────────────────────────────
  { slug: "pdi", label: "Pre-delivery inspection" },
  // ── Transport + driving (SA-specific licence codes) ──────────────────
  { slug: "code-08-licence", label: "Code 08 driver's licence" },
  { slug: "code-10-licence", label: "Code 10 driver's licence" },
  { slug: "code-14-licence", label: "Code 14 driver's licence" },
  { slug: "defensive-driving", label: "Defensive driving" },
  { slug: "forklift-licence", label: "Forklift licence" },
  // ── Security (PSIRA grades) ──────────────────────────────────────────
  { slug: "psira-grade-c", label: "PSIRA Grade C" },
  { slug: "psira-grade-a", label: "PSIRA Grade A" },
  // ── Healthcare + caregiving ──────────────────────────────────────────
  { slug: "cpr", label: "CPR" },
  { slug: "first-aid", label: "First aid" },
  { slug: "pediatric-care", label: "Paediatric care" },
  { slug: "elderly-care", label: "Elderly care" },
  { slug: "medication-administration", label: "Medication administration" },
  // ── Education ────────────────────────────────────────────────────────
  { slug: "classroom-management", label: "Classroom management" },
  { slug: "ecd-pedagogy", label: "ECD pedagogy" },
  { slug: "lesson-planning", label: "Lesson planning" },
  // ── Aquatics + recreation ────────────────────────────────────────────
  // Added with the lifeguard professions; the metro seasonal scenario
  // is the canonical use case but the same skills apply to leisure
  // facilities + sports clubs.
  { slug: "lifesaving-cert", label: "Lifesaving SA certification" },
  { slug: "pool-rescue", label: "Pool rescue" },
  { slug: "open-water-rescue", label: "Open water rescue" },
  { slug: "pool-chemistry", label: "Pool water chemistry" },
  { slug: "pool-maintenance", label: "Pool maintenance" },
  { slug: "swim-coaching", label: "Swim coaching" },
];

/**
 * Phase 10 follow-up  profession  related skills association map.
 *
 * Drives the *suggestion ranking* on the skill multi-select picker.
 * When an employer creates a vacancy for `chef`, the picker surfaces
 * the chef-related skills FIRST (Pastry, Grill, Menu design, etc.)
 * and pushes the unrelated skills (PSIRA Grade C, AWS) below the
 * fold. Employers can still type any term + see global matches.
 *
 * Curated by hand; intentionally not exhaustive. A profession with no
 * entry just falls back to the global alphabetical list. Adding a
 * profession to the map is a 30-second edit; the picker reads this
 * at render time + the admin team can extend as new professions land
 * via the suggestion queue.
 *
 * NOT used by the matcher  the matcher ranks against profile skills,
 * not vacancy skill picker UX. This map is purely about the picker's
 * "which skills should I show first?" question.
 */
export const PROFESSION_SKILLS_MAP: Record<string, string[]> = {
  // Hospitality
  chef: ["pastry", "menu-design", "kitchen-mgmt", "grill", "prep", "plating", "food-safety", "baking"],
  cook: ["grill", "prep", "plating", "food-safety", "kitchen-mgmt"],
  "kitchen-porter": ["food-safety", "prep"],
  waitstaff: ["customer-service", "pos-systems", "food-safety"],
  barista: ["coffee-art", "customer-service", "pos-systems"],
  bartender: ["mixology", "customer-service", "pos-systems"],
  "restaurant-manager": ["customer-service", "pos-systems", "kitchen-mgmt", "food-safety"],
  "hotel-receptionist": ["customer-service", "excel", "word"],
  housekeeping: ["customer-service"],
  // Tech + IT
  "software-developer": ["typescript", "react", "node", "python", "sql", "postgres", "aws"],
  "help-desk": ["excel", "word", "customer-service"],
  "ux-ui-designer": ["figma"],
  // Admin + office
  "call-centre-agent": ["customer-service", "excel"],
  "hr-practitioner": ["payroll", "excel", "word"],
  receptionist: ["customer-service", "excel", "word"],
  "admin-clerk": ["excel", "word"],
  "personal-assistant": ["excel", "word"],
  // Finance
  accountant: ["ifrs", "bookkeeping-skill", "saipa", "excel"],
  bookkeeper: ["bookkeeping-skill", "payroll", "excel"],
  // Trades
  electrician: ["wiring", "industrial-wiring"],
  plumber: ["pipe-fitting"],
  // Automotive
  mechanic: ["pdi", "code-08-licence"],
  // Healthcare
  nurse: ["cpr", "first-aid", "medication-administration"],
  caregiver: ["elderly-care", "pediatric-care", "first-aid"],
  paramedic: ["cpr", "first-aid", "code-08-licence"],
  // Education
  teacher: ["classroom-management", "lesson-planning"],
  tutor: ["lesson-planning"],
  "ecd-practitioner": ["ecd-pedagogy", "lesson-planning", "first-aid"],
  lecturer: ["lesson-planning"],
  "sports-coach": ["lesson-planning", "first-aid"],
  // Transport
  driver: ["code-08-licence", "defensive-driving"],
  "truck-driver": ["code-14-licence", "defensive-driving"],
  "delivery-driver": ["code-10-licence", "defensive-driving"],
  "taxi-driver": ["code-10-licence", "defensive-driving"],
  "forklift-operator": ["forklift-licence"],
  "crane-operator": ["forklift-licence"],
  // Security
  "security-officer": ["psira-grade-c", "first-aid"],
  "armed-response": ["psira-grade-a", "first-aid", "defensive-driving", "code-08-licence"],
  // Aquatics + recreation (the lifeguard scenario this map was added for)
  lifeguard: [
    "lifesaving-cert",
    "cpr",
    "first-aid",
    "pool-rescue",
    "open-water-rescue",
    "pool-chemistry",
  ],
  "pool-attendant": ["pool-chemistry", "pool-maintenance", "customer-service", "first-aid"],
  "swim-instructor": [
    "swim-coaching",
    "lesson-planning",
    "lifesaving-cert",
    "first-aid",
    "cpr",
  ],
};

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
// SA tertiary institutions  controlled vocabulary.
// Representative subset of public universities + UOTs + a TVET + UNISA + INDLELA.
// Full list managed in admin taxonomy from Phase 7.

export interface InstitutionEntry extends TaxonomyEntry {
  kind: InstitutionKind;
  /** Where the main campus sits  used for proximity heuristics in Career compass. */
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
