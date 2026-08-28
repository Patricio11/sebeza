/**
 * Role blueprints (docs/ROLE_BLUEPRINTS_PLAN.md, 2026-08-28).
 *
 * The Compass used to know only two things: what employers searched for
 * and what higher-ranked peers hold. With no local demand and a pool of
 * three, a good profile read "Learn 0 skills". A blueprint is the third
 * source: what a role's skill set looks like, in three tiers.
 *
 *   core        everyone in the role has these
 *   expected    employers assume these
 *   next_level  what takes a junior to mid / senior, grouped in named
 *               TRACKS a seeker can pick as a route
 *
 * This file is the STARTER catalogue: a curated constant, the same
 * standing as the taxonomy constants (empty-DB fallback + seed source).
 * The live table `profession_skill_blueprints` is what seekers read
 * once the admin imports it on /admin/blueprints; admins edit from
 * there. No model is asked at runtime; the AI's only job is to explain.
 *
 * Every skill slug here must exist in the skill taxonomy; NEW_SKILLS
 * below are the additions that make the blueprints expressible, and
 * migration 0080 inserts them (ON CONFLICT DO NOTHING). A unit test
 * checks both sides never drift.
 */

export type BlueprintTier = "core" | "expected" | "next_level";

export interface BlueprintRow {
  professionSlug: string;
  skillSlug: string;
  tier: BlueprintTier;
  /** Named route for next-level skills ("DevOps & Cloud"); null otherwise. */
  track: string | null;
  /** One-line "prove it with" idea, written once, shown to everyone. */
  proveIt: string | null;
}

export interface NewSkill {
  slug: string;
  label: string;
  category: "technical" | "professional";
}

/** Skills added to the taxonomy so blueprints can be expressed. */
export const NEW_SKILLS: NewSkill[] = [
  // Software + IT
  { slug: "git", label: "Git & version control", category: "technical" },
  { slug: "docker", label: "Docker", category: "technical" },
  { slug: "ci-cd", label: "CI/CD pipelines", category: "technical" },
  { slug: "rest-apis", label: "REST APIs", category: "technical" },
  { slug: "testing", label: "Automated testing", category: "technical" },
  { slug: "javascript", label: "JavaScript", category: "technical" },
  { slug: "html-css", label: "HTML & CSS", category: "technical" },
  { slug: "linux", label: "Linux", category: "technical" },
  {
    slug: "cloud-fundamentals",
    label: "Cloud fundamentals",
    category: "technical",
  },
  { slug: "security-basics", label: "Security basics", category: "technical" },
  { slug: "system-design", label: "System design", category: "technical" },
  { slug: "php", label: "PHP", category: "technical" },
  { slug: "java", label: "Java", category: "technical" },
  { slug: "mobile-dev", label: "Mobile development", category: "technical" },
  { slug: "ui-design", label: "UI design", category: "technical" },
  { slug: "user-research", label: "User research", category: "professional" },
  { slug: "prototyping", label: "Prototyping", category: "technical" },
  { slug: "accessibility", label: "Accessibility", category: "technical" },
  {
    slug: "networking-basics",
    label: "Networking basics",
    category: "technical",
  },
  {
    slug: "windows-admin",
    label: "Windows administration",
    category: "technical",
  },
  {
    slug: "ticketing-systems",
    label: "Ticketing systems",
    category: "technical",
  },
  { slug: "data-analysis", label: "Data analysis", category: "technical" },
  // Working with people and organisations
  {
    slug: "communication",
    label: "Clear communication",
    category: "professional",
  },
  {
    slug: "time-management",
    label: "Time management",
    category: "professional",
  },
  {
    slug: "problem-solving",
    label: "Problem solving",
    category: "professional",
  },
  { slug: "teamwork", label: "Teamwork", category: "professional" },
  { slug: "leadership", label: "Team leadership", category: "professional" },
  {
    slug: "conflict-resolution",
    label: "Conflict resolution",
    category: "professional",
  },
  { slug: "agile", label: "Agile & Scrum", category: "professional" },
  { slug: "mentoring", label: "Mentoring", category: "professional" },
  {
    slug: "training-delivery",
    label: "Training delivery",
    category: "professional",
  },
  { slug: "ms-office", label: "Microsoft Office", category: "technical" },
  { slug: "reporting", label: "Reporting", category: "professional" },
  { slug: "minute-taking", label: "Minute taking", category: "professional" },
  {
    slug: "diary-management",
    label: "Diary management",
    category: "professional",
  },
  { slug: "data-capture", label: "Data capture", category: "technical" },
  {
    slug: "records-filing",
    label: "Records & filing",
    category: "professional",
  },
  {
    slug: "telephone-etiquette",
    label: "Telephone etiquette",
    category: "professional",
  },
  { slug: "sales", label: "Sales", category: "professional" },
  { slug: "negotiation", label: "Negotiation", category: "professional" },
  { slug: "crm", label: "CRM systems", category: "technical" },
  { slug: "recruitment", label: "Recruitment", category: "professional" },
  { slug: "labour-law", label: "Labour law basics", category: "professional" },
  { slug: "hr-admin", label: "HR administration", category: "professional" },
  {
    slug: "performance-management",
    label: "Performance management",
    category: "professional",
  },
  // Finance
  { slug: "tax-compliance", label: "Tax compliance", category: "professional" },
  { slug: "sage-pastel", label: "Sage / Pastel", category: "technical" },
  { slug: "xero", label: "Xero", category: "technical" },
  { slug: "vat-returns", label: "VAT returns", category: "professional" },
  {
    slug: "financial-reporting",
    label: "Financial reporting",
    category: "professional",
  },
  { slug: "budgeting", label: "Budgeting", category: "professional" },
  { slug: "auditing", label: "Auditing", category: "professional" },
  // Trades and technical
  {
    slug: "hand-power-tools",
    label: "Hand & power tools",
    category: "technical",
  },
  {
    slug: "reading-drawings",
    label: "Reading plans & drawings",
    category: "technical",
  },
  {
    slug: "site-safety",
    label: "Health & safety on site",
    category: "professional",
  },
  { slug: "solar-pv", label: "Solar PV installation", category: "technical" },
  {
    slug: "electrical-testing",
    label: "Electrical testing & CoC",
    category: "technical",
  },
  {
    slug: "plumbing-standards",
    label: "Plumbing standards (SANS)",
    category: "technical",
  },
  {
    slug: "geyser-installation",
    label: "Geyser installation",
    category: "technical",
  },
  {
    slug: "setting-out",
    label: "Measuring & setting out",
    category: "technical",
  },
  { slug: "finishing", label: "Finishing & snagging", category: "technical" },
  {
    slug: "mig-tig-welding",
    label: "MIG / TIG welding",
    category: "technical",
  },
  { slug: "fabrication", label: "Steel fabrication", category: "technical" },
  {
    slug: "vehicle-diagnostics",
    label: "Vehicle diagnostics",
    category: "technical",
  },
  { slug: "engine-repair", label: "Engine repair", category: "technical" },
  { slug: "spray-painting", label: "Spray painting", category: "technical" },
  {
    slug: "refrigeration",
    label: "Refrigeration systems",
    category: "technical",
  },
  { slug: "gas-handling", label: "Safe gas handling", category: "technical" },
  { slug: "quoting", label: "Quoting & estimating", category: "professional" },
  // Health and care
  { slug: "patient-care", label: "Patient care", category: "professional" },
  {
    slug: "infection-control",
    label: "Infection control",
    category: "technical",
  },
  {
    slug: "vital-signs",
    label: "Vital signs monitoring",
    category: "technical",
  },
  {
    slug: "clinical-records",
    label: "Clinical record keeping",
    category: "professional",
  },
  { slug: "dispensing", label: "Dispensing", category: "technical" },
  { slug: "emergency-care", label: "Emergency care", category: "technical" },
  {
    slug: "dental-chairside",
    label: "Dental chairside assisting",
    category: "technical",
  },
  { slug: "wound-care", label: "Wound care", category: "technical" },
  // Education
  {
    slug: "learner-assessment",
    label: "Learner assessment",
    category: "professional",
  },
  {
    slug: "curriculum-design",
    label: "Curriculum design",
    category: "professional",
  },
  {
    slug: "inclusive-education",
    label: "Inclusive education",
    category: "professional",
  },
  {
    slug: "digital-teaching",
    label: "Digital teaching tools",
    category: "technical",
  },
  // Driving and logistics
  { slug: "route-planning", label: "Route planning", category: "technical" },
  {
    slug: "vehicle-inspection",
    label: "Vehicle inspection",
    category: "technical",
  },
  { slug: "load-securing", label: "Load securing", category: "technical" },
  {
    slug: "inventory-management",
    label: "Inventory management",
    category: "professional",
  },
  {
    slug: "warehouse-systems",
    label: "Warehouse management systems",
    category: "technical",
  },
  {
    slug: "dangerous-goods",
    label: "Dangerous goods handling",
    category: "technical",
  },
  // Retail and sales
  { slug: "merchandising", label: "Merchandising", category: "professional" },
  { slug: "cash-handling", label: "Cash handling", category: "technical" },
  { slug: "stock-take", label: "Stock takes", category: "professional" },
  { slug: "upselling", label: "Upselling", category: "professional" },
  // Security
  { slug: "access-control", label: "Access control", category: "technical" },
  {
    slug: "incident-reporting",
    label: "Incident reporting",
    category: "professional",
  },
  {
    slug: "firearm-competency",
    label: "Firearm competency",
    category: "technical",
  },
  {
    slug: "surveillance-systems",
    label: "Surveillance systems",
    category: "technical",
  },
  // Beauty, wellness, fitness
  { slug: "skincare", label: "Skincare treatments", category: "technical" },
  { slug: "hair-cutting", label: "Hair cutting", category: "technical" },
  { slug: "hair-colouring", label: "Hair colouring", category: "technical" },
  { slug: "nail-art", label: "Nail art & gel systems", category: "technical" },
  {
    slug: "massage-techniques",
    label: "Massage techniques",
    category: "technical",
  },
  {
    slug: "makeup-techniques",
    label: "Makeup techniques",
    category: "technical",
  },
  {
    slug: "hygiene-standards",
    label: "Hygiene standards",
    category: "technical",
  },
  {
    slug: "programme-design",
    label: "Training programme design",
    category: "professional",
  },
  {
    slug: "nutrition-basics",
    label: "Nutrition basics",
    category: "technical",
  },
  {
    slug: "group-instruction",
    label: "Group instruction",
    category: "professional",
  },
  { slug: "anatomy-basics", label: "Anatomy basics", category: "technical" },
  // Property, legal, insurance
  {
    slug: "property-law",
    label: "Property law basics",
    category: "professional",
  },
  {
    slug: "property-valuation",
    label: "Property valuation",
    category: "technical",
  },
  {
    slug: "lease-administration",
    label: "Lease administration",
    category: "professional",
  },
  { slug: "legal-research", label: "Legal research", category: "professional" },
  { slug: "legal-drafting", label: "Legal drafting", category: "professional" },
  { slug: "litigation", label: "Litigation", category: "professional" },
  {
    slug: "dictation-typing",
    label: "Dictation & typing",
    category: "technical",
  },
  {
    slug: "risk-assessment",
    label: "Risk assessment",
    category: "professional",
  },
  {
    slug: "claims-handling",
    label: "Claims handling",
    category: "professional",
  },
  {
    slug: "compliance",
    label: "Regulatory compliance",
    category: "professional",
  },
  // Creative and marketing
  { slug: "adobe-suite", label: "Adobe Creative Suite", category: "technical" },
  { slug: "photo-editing", label: "Photo editing", category: "technical" },
  { slug: "video-editing", label: "Video editing", category: "technical" },
  { slug: "copywriting", label: "Copywriting", category: "professional" },
  { slug: "seo", label: "SEO", category: "technical" },
  {
    slug: "social-media",
    label: "Social media management",
    category: "professional",
  },
  { slug: "paid-ads", label: "Paid advertising", category: "technical" },
  {
    slug: "marketing-analytics",
    label: "Marketing analytics",
    category: "technical",
  },
  { slug: "brand-strategy", label: "Brand strategy", category: "professional" },
  {
    slug: "content-strategy",
    label: "Content strategy",
    category: "professional",
  },
  { slug: "lighting", label: "Lighting", category: "technical" },
  // Farming and mining
  { slug: "crop-handling", label: "Crop handling", category: "technical" },
  { slug: "livestock-care", label: "Livestock care", category: "technical" },
  {
    slug: "farm-machinery",
    label: "Farm machinery operation",
    category: "technical",
  },
  {
    slug: "mine-safety-procedures",
    label: "Mine safety procedures",
    category: "technical",
  },
  { slug: "rock-drilling", label: "Rock drilling", category: "technical" },
  {
    slug: "hazard-identification",
    label: "Hazard identification",
    category: "professional",
  },
  // Hospitality extras
  { slug: "wine-knowledge", label: "Wine knowledge", category: "technical" },
  { slug: "stock-control", label: "Stock control", category: "professional" },
  {
    slug: "reservation-systems",
    label: "Reservation systems",
    category: "technical",
  },
  {
    slug: "housekeeping-standards",
    label: "Housekeeping standards",
    category: "technical",
  },
  {
    slug: "event-coordination",
    label: "Event coordination",
    category: "professional",
  },
  {
    slug: "guest-relations",
    label: "Guest relations",
    category: "professional",
  },
];

type Spec = {
  core: string[];
  expected: string[];
  next: Record<string, string[]>;
  proveIt?: Record<string, string>;
};

const SPECS: Record<string, Spec> = {
  // ── Hospitality ─────────────────────────────────────────────────────────
  chef: {
    core: ["prep", "food-safety", "plating", "kitchen-mgmt"],
    expected: ["menu-design", "stock-control", "teamwork"],
    next: {
      "Head chef": ["leadership", "budgeting", "training-delivery"],
      "Pastry & baking": ["pastry", "baking"],
    },
    proveIt: {
      "menu-design":
        "Write a three-course seasonal menu with costed portions and share it as a PDF.",
    },
  },
  cook: {
    core: ["prep", "grill", "food-safety"],
    expected: ["plating", "time-management", "teamwork"],
    next: { "Towards chef": ["kitchen-mgmt", "menu-design", "stock-control"] },
  },
  "kitchen-porter": {
    core: ["food-safety", "prep", "hygiene-standards"],
    expected: ["time-management", "teamwork"],
    next: { "Towards cook": ["grill", "plating"] },
  },
  waitstaff: {
    core: ["customer-service", "food-safety", "pos-systems"],
    expected: ["upselling", "teamwork", "communication"],
    next: {
      "Front-of-house lead": [
        "wine-knowledge",
        "guest-relations",
        "leadership",
      ],
    },
  },
  barista: {
    core: ["coffee-art", "customer-service", "pos-systems"],
    expected: ["food-safety", "cash-handling"],
    next: { "Cafe lead": ["stock-control", "leadership", "training-delivery"] },
  },
  bartender: {
    core: ["mixology", "customer-service", "pos-systems"],
    expected: ["cash-handling", "stock-control", "food-safety"],
    next: { "Bar manager": ["wine-knowledge", "leadership", "budgeting"] },
  },
  "restaurant-manager": {
    core: ["leadership", "customer-service", "stock-control", "food-safety"],
    expected: ["budgeting", "reservation-systems", "conflict-resolution"],
    next: {
      "Multi-site operations": [
        "financial-reporting",
        "recruitment",
        "event-coordination",
      ],
    },
  },
  "hotel-receptionist": {
    core: ["customer-service", "reservation-systems", "telephone-etiquette"],
    expected: ["cash-handling", "communication", "ms-office"],
    next: {
      "Front-office supervisor": [
        "guest-relations",
        "leadership",
        "conflict-resolution",
      ],
    },
  },
  housekeeping: {
    core: ["housekeeping-standards", "time-management", "hygiene-standards"],
    expected: ["teamwork", "stock-control"],
    next: {
      "Housekeeping supervisor": [
        "leadership",
        "training-delivery",
        "reporting",
      ],
    },
  },
  // ── Tech and office ─────────────────────────────────────────────────────
  "software-developer": {
    core: ["git", "javascript", "sql", "problem-solving"],
    expected: ["rest-apis", "testing", "html-css", "agile"],
    next: {
      "DevOps & Cloud": [
        "docker",
        "ci-cd",
        "cloud-fundamentals",
        "aws",
        "linux",
      ],
      "Front-end": ["react", "typescript", "accessibility"],
      "Back-end": ["postgres", "node", "system-design", "security-basics"],
      Leadership: ["mentoring", "leadership"],
    },
    proveIt: {
      docker:
        "Containerise one of your projects and put the Dockerfile in the repo README.",
      "ci-cd":
        "Add a pipeline that runs your tests on every push; link the green run.",
      testing:
        "Write tests for one module until a bug you planted gets caught.",
      "rest-apis":
        "Build a small JSON API with three endpoints and document them.",
      "system-design":
        "Sketch how your app would handle ten times the users; explain one trade-off.",
    },
  },
  "help-desk": {
    core: [
      "ticketing-systems",
      "customer-service",
      "windows-admin",
      "communication",
    ],
    expected: ["networking-basics", "problem-solving", "time-management"],
    next: {
      "Systems administration": [
        "linux",
        "security-basics",
        "cloud-fundamentals",
      ],
      "Service management": ["reporting", "leadership"],
    },
  },
  "ux-ui-designer": {
    core: ["figma", "ui-design", "prototyping", "user-research"],
    expected: ["accessibility", "html-css", "communication"],
    next: {
      "Product design lead": ["leadership", "data-analysis", "agile"],
      "Front-end handoff": ["javascript", "react"],
    },
    proveIt: {
      accessibility:
        "Audit one screen against WCAG contrast and keyboard rules; list the fixes.",
    },
  },
  "call-centre-agent": {
    core: ["customer-service", "telephone-etiquette", "crm", "communication"],
    expected: ["problem-solving", "data-capture", "time-management"],
    next: {
      "Team leader": ["leadership", "reporting", "conflict-resolution"],
      "Sales floor": ["sales", "upselling"],
    },
  },
  "hr-practitioner": {
    core: ["hr-admin", "recruitment", "labour-law", "communication"],
    expected: ["payroll", "ms-office", "conflict-resolution"],
    next: {
      "HR business partner": [
        "performance-management",
        "leadership",
        "reporting",
      ],
      "Learning & development": ["training-delivery", "curriculum-design"],
    },
  },
  receptionist: {
    core: [
      "telephone-etiquette",
      "customer-service",
      "ms-office",
      "diary-management",
    ],
    expected: ["communication", "records-filing", "data-capture"],
    next: {
      "Office administrator": [
        "minute-taking",
        "bookkeeping-skill",
        "reporting",
      ],
    },
  },
  "admin-clerk": {
    core: ["ms-office", "data-capture", "records-filing"],
    expected: ["communication", "time-management", "telephone-etiquette"],
    next: {
      "Office coordinator": ["minute-taking", "diary-management", "reporting"],
      "Finance admin": ["bookkeeping-skill", "excel"],
    },
  },
  "personal-assistant": {
    core: ["diary-management", "ms-office", "communication", "minute-taking"],
    expected: ["time-management", "telephone-etiquette", "event-coordination"],
    next: { "Executive assistant": ["reporting", "budgeting", "negotiation"] },
  },
  accountant: {
    core: ["bookkeeping-skill", "ifrs", "excel", "financial-reporting"],
    expected: ["tax-compliance", "vat-returns", "sage-pastel"],
    next: {
      "Financial management": ["budgeting", "auditing", "leadership"],
      "Professional body": ["saipa"],
      Systems: ["xero", "data-analysis"],
    },
    proveIt: {
      "financial-reporting":
        "Prepare a monthly management pack for a small business from a trial balance.",
    },
  },
  bookkeeper: {
    core: ["bookkeeping-skill", "excel", "sage-pastel"],
    expected: ["vat-returns", "payroll", "records-filing"],
    next: {
      "Towards accountant": ["ifrs", "financial-reporting", "tax-compliance"],
      Systems: ["xero"],
    },
  },
  // ── Trades ───────────────────────────────────────────────────────────────
  electrician: {
    core: ["wiring", "electrical-testing", "site-safety", "hand-power-tools"],
    expected: ["reading-drawings", "problem-solving", "quoting"],
    next: {
      "Solar & renewables": ["solar-pv"],
      Industrial: ["industrial-wiring"],
      "Running jobs": ["leadership", "budgeting"],
    },
    proveIt: {
      "solar-pv":
        "Document one small PV install with the CoC and the string layout.",
    },
  },
  plumber: {
    core: [
      "pipe-fitting",
      "plumbing-standards",
      "site-safety",
      "hand-power-tools",
    ],
    expected: ["geyser-installation", "reading-drawings", "quoting"],
    next: {
      "Solar geysers & gas": ["solar-pv", "gas-handling"],
      "Running jobs": ["leadership", "budgeting"],
    },
  },
  bricklayer: {
    core: ["setting-out", "hand-power-tools", "site-safety"],
    expected: ["reading-drawings", "teamwork", "finishing"],
    next: { "Site foreman": ["leadership", "quoting", "time-management"] },
  },
  carpenter: {
    core: [
      "hand-power-tools",
      "reading-drawings",
      "setting-out",
      "site-safety",
    ],
    expected: ["finishing", "quoting"],
    next: { "Own workshop": ["budgeting", "sales", "leadership"] },
  },
  painter: {
    core: ["finishing", "hand-power-tools", "site-safety"],
    expected: ["quoting", "time-management"],
    next: {
      "Decorative & spray": ["spray-painting"],
      Contractor: ["leadership", "budgeting"],
    },
  },
  tiler: {
    core: ["setting-out", "finishing", "hand-power-tools"],
    expected: ["reading-drawings", "quoting", "site-safety"],
    next: { Contractor: ["leadership", "budgeting", "sales"] },
  },
  roofer: {
    core: ["site-safety", "hand-power-tools", "setting-out"],
    expected: ["reading-drawings", "teamwork", "quoting"],
    next: {
      "Solar-ready roofing": ["solar-pv"],
      Contractor: ["leadership", "budgeting"],
    },
  },
  plasterer: {
    core: ["finishing", "hand-power-tools", "site-safety"],
    expected: ["setting-out", "quoting"],
    next: { Contractor: ["leadership", "budgeting"] },
  },
  boilermaker: {
    core: ["fabrication", "mig-tig-welding", "reading-drawings", "site-safety"],
    expected: ["hand-power-tools", "setting-out", "quoting"],
    next: { Supervision: ["leadership", "hazard-identification", "reporting"] },
  },
  welder: {
    core: ["mig-tig-welding", "site-safety", "hand-power-tools"],
    expected: ["reading-drawings", "fabrication"],
    next: {
      "Coded welder & supervision": [
        "quoting",
        "leadership",
        "hazard-identification",
      ],
    },
  },
  mechanic: {
    core: [
      "engine-repair",
      "vehicle-diagnostics",
      "hand-power-tools",
      "site-safety",
    ],
    expected: ["problem-solving", "quoting", "customer-service"],
    next: {
      "Workshop manager": ["leadership", "stock-control", "budgeting"],
      "Electrical & hybrid": ["electrical-testing"],
    },
  },
  "panel-beater": {
    core: ["spray-painting", "hand-power-tools", "site-safety"],
    expected: ["finishing", "quoting"],
    next: {
      "Workshop manager": ["leadership", "stock-control", "customer-service"],
    },
  },
  "aircon-technician": {
    core: [
      "refrigeration",
      "electrical-testing",
      "gas-handling",
      "site-safety",
    ],
    expected: ["customer-service", "quoting", "problem-solving"],
    next: {
      "Commercial HVAC": ["reading-drawings", "leadership"],
      "Solar & energy": ["solar-pv"],
    },
  },
  "fridge-technician": {
    core: ["refrigeration", "gas-handling", "electrical-testing"],
    expected: ["site-safety", "customer-service", "problem-solving"],
    next: {
      "Commercial refrigeration": ["reading-drawings", "quoting", "leadership"],
    },
  },
  // ── Health and care ─────────────────────────────────────────────────────
  nurse: {
    core: [
      "patient-care",
      "vital-signs",
      "infection-control",
      "clinical-records",
    ],
    expected: ["medication-administration", "cpr", "communication"],
    next: {
      "Specialist care": ["wound-care", "emergency-care", "pediatric-care"],
      "Unit leadership": ["leadership", "mentoring"],
    },
  },
  caregiver: {
    core: [
      "elderly-care",
      "patient-care",
      "hygiene-standards",
      "communication",
    ],
    expected: ["first-aid", "cpr", "medication-administration"],
    next: {
      "Towards nursing": [
        "vital-signs",
        "infection-control",
        "clinical-records",
      ],
    },
  },
  paramedic: {
    core: ["emergency-care", "cpr", "first-aid", "vital-signs"],
    expected: ["patient-care", "clinical-records", "defensive-driving"],
    next: {
      "Advanced life support": [
        "medication-administration",
        "leadership",
        "training-delivery",
      ],
    },
  },
  "pharmacy-assistant": {
    core: ["dispensing", "customer-service", "stock-control"],
    expected: ["clinical-records", "data-capture", "hygiene-standards"],
    next: {
      "Pharmacy technician": [
        "medication-administration",
        "compliance",
        "inventory-management",
      ],
    },
  },
  "dental-assistant": {
    core: ["dental-chairside", "infection-control", "patient-care"],
    expected: ["reservation-systems", "customer-service", "clinical-records"],
    next: {
      "Practice coordinator": ["stock-control", "cash-handling", "leadership"],
    },
  },
  // ── Education ────────────────────────────────────────────────────────────
  teacher: {
    core: [
      "lesson-planning",
      "classroom-management",
      "learner-assessment",
      "communication",
    ],
    expected: ["digital-teaching", "inclusive-education"],
    next: {
      "Head of department": ["curriculum-design", "leadership", "mentoring"],
    },
  },
  tutor: {
    core: ["lesson-planning", "communication", "learner-assessment"],
    expected: ["time-management", "digital-teaching"],
    next: {
      "Teaching qualification": [
        "classroom-management",
        "curriculum-design",
        "inclusive-education",
      ],
    },
  },
  "ecd-practitioner": {
    core: [
      "ecd-pedagogy",
      "classroom-management",
      "pediatric-care",
      "first-aid",
    ],
    expected: ["lesson-planning", "communication", "inclusive-education"],
    next: { "Centre manager": ["leadership", "budgeting", "compliance"] },
  },
  lecturer: {
    core: [
      "curriculum-design",
      "learner-assessment",
      "communication",
      "lesson-planning",
    ],
    expected: ["digital-teaching", "mentoring"],
    next: {
      "Academic leadership": ["leadership", "reporting", "data-analysis"],
    },
  },
  "sports-coach": {
    core: [
      "programme-design",
      "group-instruction",
      "first-aid",
      "communication",
    ],
    expected: ["nutrition-basics", "leadership"],
    next: {
      "Performance coaching": ["data-analysis", "mentoring", "anatomy-basics"],
    },
  },
  // ── Driving and logistics ────────────────────────────────────────────────
  driver: {
    core: ["code-08-licence", "defensive-driving", "route-planning"],
    expected: ["vehicle-inspection", "customer-service", "time-management"],
    next: {
      "Heavy vehicles": ["code-10-licence", "load-securing"],
      "Passenger transport": ["pdi", "first-aid"],
    },
  },
  "truck-driver": {
    core: [
      "code-14-licence",
      "defensive-driving",
      "load-securing",
      "vehicle-inspection",
    ],
    expected: ["route-planning", "pdi", "time-management"],
    next: {
      "Specialised freight": ["dangerous-goods"],
      "Fleet supervision": ["leadership", "reporting"],
    },
  },
  "delivery-driver": {
    core: ["code-08-licence", "route-planning", "customer-service"],
    expected: ["defensive-driving", "time-management", "vehicle-inspection"],
    next: {
      "Logistics coordination": ["inventory-management", "reporting"],
      "Heavy vehicles": ["code-10-licence"],
    },
  },
  "taxi-driver": {
    core: ["code-08-licence", "pdi", "defensive-driving", "customer-service"],
    expected: ["route-planning", "cash-handling", "first-aid"],
    next: { "Fleet operations": ["leadership", "budgeting", "reporting"] },
  },
  "forklift-operator": {
    core: ["forklift-licence", "load-securing", "site-safety"],
    expected: ["vehicle-inspection", "warehouse-systems", "teamwork"],
    next: {
      "Warehouse supervision": [
        "inventory-management",
        "leadership",
        "reporting",
      ],
    },
  },
  "crane-operator": {
    core: ["load-securing", "site-safety", "hazard-identification"],
    expected: ["vehicle-inspection", "communication", "teamwork"],
    next: {
      "Rigging supervision": ["leadership", "reading-drawings", "reporting"],
    },
  },
  "warehouse-picker": {
    core: ["warehouse-systems", "stock-take", "site-safety"],
    expected: ["time-management", "teamwork", "load-securing"],
    next: {
      "Stock control": [
        "inventory-management",
        "forklift-licence",
        "reporting",
      ],
    },
  },
  "stock-controller": {
    core: ["inventory-management", "stock-take", "warehouse-systems", "excel"],
    expected: ["reporting", "data-capture", "communication"],
    next: { "Supply chain": ["negotiation", "leadership", "data-analysis"] },
  },
  "dispatch-clerk": {
    core: [
      "warehouse-systems",
      "route-planning",
      "data-capture",
      "communication",
    ],
    expected: ["time-management", "reporting", "load-securing"],
    next: {
      "Logistics coordination": [
        "inventory-management",
        "negotiation",
        "leadership",
      ],
    },
  },
  "logistics-coordinator": {
    core: ["route-planning", "inventory-management", "excel", "communication"],
    expected: ["warehouse-systems", "reporting", "negotiation"],
    next: {
      "Supply chain management": [
        "data-analysis",
        "budgeting",
        "leadership",
        "compliance",
      ],
    },
  },
  "supply-chain-officer": {
    core: ["inventory-management", "negotiation", "excel", "reporting"],
    expected: ["warehouse-systems", "compliance", "communication"],
    next: {
      "Supply chain lead": [
        "data-analysis",
        "budgeting",
        "leadership",
        "risk-assessment",
      ],
    },
  },
  // ── Retail ───────────────────────────────────────────────────────────────
  "retail-assistant": {
    core: ["customer-service", "pos-systems", "cash-handling"],
    expected: ["merchandising", "stock-take", "upselling"],
    next: { Supervisor: ["leadership", "stock-control", "reporting"] },
  },
  cashier: {
    core: ["pos-systems", "cash-handling", "customer-service"],
    expected: ["time-management", "upselling", "communication"],
    next: { "Front-end supervisor": ["leadership", "reporting", "stock-take"] },
  },
  "store-manager": {
    core: ["leadership", "stock-control", "customer-service", "reporting"],
    expected: ["merchandising", "budgeting", "recruitment"],
    next: {
      "Area management": [
        "financial-reporting",
        "data-analysis",
        "performance-management",
      ],
    },
  },
  "visual-merchandiser": {
    core: ["merchandising", "ui-design", "communication"],
    expected: ["stock-take", "adobe-suite", "time-management"],
    next: {
      "Brand & campaigns": ["brand-strategy", "photo-editing", "leadership"],
    },
  },
  // ── Security ─────────────────────────────────────────────────────────────
  "security-officer": {
    core: ["psira-grade-c", "access-control", "incident-reporting"],
    expected: ["customer-service", "first-aid", "communication"],
    next: {
      "Armed & supervisory": ["psira-grade-a", "firearm-competency"],
      "Control room": ["surveillance-systems"],
    },
  },
  "armed-response": {
    core: [
      "psira-grade-a",
      "firearm-competency",
      "defensive-driving",
      "incident-reporting",
    ],
    expected: ["first-aid", "access-control", "code-08-licence"],
    next: { Supervision: ["leadership", "conflict-resolution", "reporting"] },
  },
  "cctv-operator": {
    core: ["surveillance-systems", "incident-reporting", "psira-grade-c"],
    expected: ["communication", "access-control", "data-capture"],
    next: {
      "Control room supervisor": [
        "leadership",
        "reporting",
        "networking-basics",
      ],
    },
  },
  // ── Domestic, cleaning, grounds ──────────────────────────────────────────
  "domestic-worker": {
    core: ["housekeeping-standards", "hygiene-standards", "time-management"],
    expected: ["communication", "elderly-care"],
    next: {
      "Care & childcare": ["pediatric-care", "first-aid"],
      Cooking: ["prep", "food-safety"],
    },
  },
  cleaner: {
    core: ["hygiene-standards", "housekeeping-standards", "time-management"],
    expected: ["teamwork", "site-safety"],
    next: { Supervisor: ["leadership", "stock-control", "reporting"] },
  },
  caretaker: {
    core: ["hand-power-tools", "site-safety", "time-management"],
    expected: ["housekeeping-standards", "communication", "stock-control"],
    next: {
      "Facilities management": ["quoting", "electrical-testing", "leadership"],
    },
  },
  gardener: {
    core: ["hand-power-tools", "crop-handling", "site-safety"],
    expected: ["time-management", "communication"],
    next: { "Landscaping business": ["quoting", "sales", "farm-machinery"] },
  },
  // ── Beauty and wellness ──────────────────────────────────────────────────
  hairstylist: {
    core: [
      "hair-cutting",
      "hair-colouring",
      "customer-service",
      "hygiene-standards",
    ],
    expected: ["upselling", "reservation-systems", "time-management"],
    next: {
      "Salon owner": [
        "stock-control",
        "budgeting",
        "social-media",
        "leadership",
      ],
    },
  },
  barber: {
    core: ["hair-cutting", "customer-service", "hygiene-standards"],
    expected: ["cash-handling", "time-management", "upselling"],
    next: { "Own shop": ["stock-control", "budgeting", "social-media"] },
  },
  "beauty-therapist": {
    core: [
      "skincare",
      "hygiene-standards",
      "customer-service",
      "anatomy-basics",
    ],
    expected: ["upselling", "reservation-systems", "massage-techniques"],
    next: {
      "Advanced aesthetics": ["makeup-techniques", "nail-art"],
      "Spa management": ["leadership", "stock-control"],
    },
  },
  "nail-technician": {
    core: ["nail-art", "hygiene-standards", "customer-service"],
    expected: ["upselling", "time-management", "social-media"],
    next: {
      "Full beauty": ["skincare", "makeup-techniques"],
      "Own studio": ["budgeting", "stock-control"],
    },
  },
  "massage-therapist": {
    core: [
      "massage-techniques",
      "anatomy-basics",
      "hygiene-standards",
      "customer-service",
    ],
    expected: ["reservation-systems", "communication"],
    next: {
      "Spa & wellness lead": ["skincare", "leadership", "programme-design"],
    },
  },
  "spa-therapist": {
    core: [
      "massage-techniques",
      "skincare",
      "hygiene-standards",
      "customer-service",
    ],
    expected: ["anatomy-basics", "upselling", "reservation-systems"],
    next: { "Spa management": ["leadership", "stock-control", "budgeting"] },
  },
  aesthetician: {
    core: [
      "skincare",
      "anatomy-basics",
      "hygiene-standards",
      "customer-service",
    ],
    expected: ["makeup-techniques", "upselling", "compliance"],
    next: { "Clinic lead": ["leadership", "sales", "social-media"] },
  },
  "makeup-artist": {
    core: ["makeup-techniques", "skincare", "customer-service"],
    expected: ["social-media", "photo-editing", "time-management"],
    next: {
      "Film, bridal & brand": ["lighting", "brand-strategy", "budgeting"],
    },
  },
  // ── Fitness and aquatics ─────────────────────────────────────────────────
  "personal-trainer": {
    core: [
      "programme-design",
      "anatomy-basics",
      "first-aid",
      "customer-service",
    ],
    expected: ["nutrition-basics", "sales", "social-media"],
    next: {
      "Group & studio": ["group-instruction", "leadership", "budgeting"],
    },
  },
  "fitness-instructor": {
    core: ["group-instruction", "programme-design", "first-aid"],
    expected: ["anatomy-basics", "customer-service", "communication"],
    next: {
      "Personal training": ["nutrition-basics", "sales"],
      "Studio management": ["leadership", "budgeting"],
    },
  },
  "yoga-instructor": {
    core: ["group-instruction", "anatomy-basics", "first-aid"],
    expected: ["programme-design", "communication", "social-media"],
    next: {
      "Studio & retreats": ["event-coordination", "budgeting", "leadership"],
    },
  },
  "pilates-instructor": {
    core: ["group-instruction", "anatomy-basics", "programme-design"],
    expected: ["first-aid", "communication", "customer-service"],
    next: {
      "Rehab & studio": ["massage-techniques", "leadership", "budgeting"],
    },
  },
  lifeguard: {
    core: ["lifesaving-cert", "pool-rescue", "cpr", "first-aid"],
    expected: ["pool-chemistry", "communication", "incident-reporting"],
    next: {
      "Open water & supervision": ["open-water-rescue", "leadership"],
      Instruction: ["swim-coaching"],
    },
  },
  "pool-attendant": {
    core: ["pool-chemistry", "pool-maintenance", "hygiene-standards"],
    expected: ["first-aid", "customer-service", "site-safety"],
    next: { Lifeguard: ["lifesaving-cert", "pool-rescue", "cpr"] },
  },
  "swim-instructor": {
    core: ["swim-coaching", "lifesaving-cert", "cpr", "group-instruction"],
    expected: ["first-aid", "pool-rescue", "communication"],
    next: {
      "Head coach": ["programme-design", "leadership", "open-water-rescue"],
    },
  },
  // ── Farming and mining ───────────────────────────────────────────────────
  "farm-worker": {
    core: ["crop-handling", "hand-power-tools", "site-safety"],
    expected: ["livestock-care", "teamwork", "time-management"],
    next: {
      "Machinery & supervision": [
        "farm-machinery",
        "code-08-licence",
        "leadership",
      ],
    },
  },
  miner: {
    core: [
      "mine-safety-procedures",
      "hazard-identification",
      "site-safety",
      "hand-power-tools",
    ],
    expected: ["rock-drilling", "teamwork", "first-aid"],
    next: {
      "Team leader & safety": [
        "leadership",
        "incident-reporting",
        "training-delivery",
      ],
    },
  },
  "mine-safety-officer": {
    core: [
      "mine-safety-procedures",
      "hazard-identification",
      "incident-reporting",
      "reporting",
    ],
    expected: ["first-aid", "training-delivery", "communication"],
    next: {
      "Safety management": [
        "risk-assessment",
        "compliance",
        "leadership",
        "data-analysis",
      ],
    },
  },
  // ── Property, legal, insurance ───────────────────────────────────────────
  "estate-agent": {
    core: ["sales", "negotiation", "property-law", "customer-service"],
    expected: ["crm", "social-media", "communication"],
    next: {
      "Principal & valuation": [
        "property-valuation",
        "leadership",
        "budgeting",
      ],
    },
  },
  "rental-agent": {
    core: ["lease-administration", "customer-service", "property-law"],
    expected: ["sales", "crm", "records-filing"],
    next: {
      "Property management": ["budgeting", "reporting", "conflict-resolution"],
    },
  },
  "property-manager": {
    core: [
      "lease-administration",
      "property-law",
      "budgeting",
      "communication",
    ],
    expected: ["reporting", "conflict-resolution", "quoting"],
    next: {
      "Portfolio management": [
        "financial-reporting",
        "leadership",
        "compliance",
      ],
    },
  },
  "property-valuer": {
    core: ["property-valuation", "property-law", "reporting", "excel"],
    expected: ["data-analysis", "communication"],
    next: {
      "Commercial valuation": [
        "financial-reporting",
        "risk-assessment",
        "leadership",
      ],
    },
  },
  attorney: {
    core: ["legal-research", "legal-drafting", "litigation", "communication"],
    expected: ["negotiation", "time-management", "records-filing"],
    next: {
      "Practice leadership": ["leadership", "budgeting", "mentoring"],
      Specialisation: ["property-law", "labour-law", "compliance"],
    },
  },
  advocate: {
    core: ["litigation", "legal-research", "legal-drafting", "communication"],
    expected: ["negotiation", "time-management"],
    next: {
      "Silk & mentoring": ["mentoring", "leadership"],
      Specialisation: ["labour-law", "property-law"],
    },
  },
  "candidate-attorney": {
    core: [
      "legal-research",
      "legal-drafting",
      "records-filing",
      "communication",
    ],
    expected: ["time-management", "litigation", "ms-office"],
    next: {
      "Admission & beyond": ["negotiation", "property-law", "labour-law"],
    },
  },
  paralegal: {
    core: ["legal-research", "records-filing", "ms-office", "communication"],
    expected: ["legal-drafting", "data-capture", "time-management"],
    next: { "Senior paralegal": ["litigation", "compliance", "leadership"] },
  },
  "legal-secretary": {
    core: [
      "dictation-typing",
      "ms-office",
      "diary-management",
      "records-filing",
    ],
    expected: ["telephone-etiquette", "legal-drafting", "minute-taking"],
    next: {
      Paralegal: ["legal-research", "litigation"],
      "Office management": ["leadership", "bookkeeping-skill"],
    },
  },
  "insurance-broker": {
    core: ["sales", "risk-assessment", "compliance", "communication"],
    expected: ["crm", "negotiation", "customer-service"],
    next: {
      "Brokerage leadership": [
        "leadership",
        "financial-reporting",
        "data-analysis",
      ],
    },
  },
  "claims-assessor": {
    core: ["claims-handling", "risk-assessment", "reporting", "communication"],
    expected: ["data-capture", "compliance", "negotiation"],
    next: { "Senior assessment": ["auditing", "leadership", "data-analysis"] },
  },
  underwriter: {
    core: ["risk-assessment", "compliance", "excel", "reporting"],
    expected: ["data-analysis", "communication", "negotiation"],
    next: {
      "Senior underwriting": ["financial-reporting", "leadership", "auditing"],
    },
  },
  // ── Creative and marketing ───────────────────────────────────────────────
  "graphic-designer": {
    core: ["adobe-suite", "ui-design", "communication"],
    expected: ["photo-editing", "brand-strategy", "time-management"],
    next: {
      "Digital product": ["figma", "prototyping", "accessibility"],
      "Motion & video": ["video-editing"],
      "Creative lead": ["leadership"],
    },
  },
  photographer: {
    core: ["lighting", "photo-editing", "adobe-suite", "customer-service"],
    expected: ["social-media", "sales", "time-management"],
    next: {
      "Video & studio": ["video-editing", "budgeting", "brand-strategy"],
    },
  },
  videographer: {
    core: ["video-editing", "lighting", "adobe-suite"],
    expected: ["social-media", "customer-service", "time-management"],
    next: {
      "Production lead": ["content-strategy", "budgeting", "leadership"],
    },
  },
  copywriter: {
    core: ["copywriting", "communication", "content-strategy"],
    expected: ["seo", "social-media", "time-management"],
    next: {
      "Brand & growth": ["brand-strategy", "marketing-analytics", "paid-ads"],
    },
  },
  "content-creator": {
    core: ["social-media", "video-editing", "copywriting"],
    expected: ["photo-editing", "content-strategy", "communication"],
    next: {
      "Growth & brand": ["marketing-analytics", "paid-ads", "brand-strategy"],
    },
  },
  "sales-representative": {
    core: ["sales", "negotiation", "customer-service", "crm"],
    expected: ["communication", "upselling", "time-management"],
    next: {
      "Key accounts & management": ["reporting", "leadership", "data-analysis"],
    },
  },
  "marketing-coordinator": {
    core: ["social-media", "copywriting", "event-coordination", "ms-office"],
    expected: ["marketing-analytics", "content-strategy", "communication"],
    next: {
      "Marketing manager": [
        "brand-strategy",
        "paid-ads",
        "budgeting",
        "leadership",
      ],
    },
  },
  "social-media-manager": {
    core: [
      "social-media",
      "content-strategy",
      "copywriting",
      "marketing-analytics",
    ],
    expected: ["photo-editing", "video-editing", "paid-ads"],
    next: {
      "Head of digital": ["brand-strategy", "seo", "leadership", "budgeting"],
    },
  },
  "digital-marketer": {
    core: ["seo", "paid-ads", "marketing-analytics", "content-strategy"],
    expected: ["social-media", "copywriting", "crm"],
    next: {
      "Growth lead": [
        "data-analysis",
        "brand-strategy",
        "leadership",
        "budgeting",
      ],
    },
  },
  "brand-manager": {
    core: [
      "brand-strategy",
      "content-strategy",
      "marketing-analytics",
      "communication",
    ],
    expected: ["budgeting", "paid-ads", "leadership"],
    next: {
      "Marketing director": [
        "financial-reporting",
        "data-analysis",
        "performance-management",
      ],
    },
  },
};

/** Flat rows, the shape the table and the engine use. */
export const STARTER_BLUEPRINTS: BlueprintRow[] = Object.entries(SPECS).flatMap(
  ([professionSlug, spec]) => {
    const rows: BlueprintRow[] = [];
    const push = (
      skillSlug: string,
      tier: BlueprintTier,
      track: string | null,
    ) =>
      rows.push({
        professionSlug,
        skillSlug,
        tier,
        track,
        proveIt: spec.proveIt?.[skillSlug] ?? null,
      });
    spec.core.forEach((s) => push(s, "core", null));
    spec.expected.forEach((s) => push(s, "expected", null));
    Object.entries(spec.next).forEach(([track, skills]) =>
      skills.forEach((s) => push(s, "next_level", track)),
    );
    return rows;
  },
);

export function starterBlueprintFor(professionSlug: string): BlueprintRow[] {
  return STARTER_BLUEPRINTS.filter((r) => r.professionSlug === professionSlug);
}
