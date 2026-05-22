/**
 * Student mode — academic-context recommendations.
 *
 * When a seeker has an `academic` block, the Career compass runs through a
 * student-specific layer on top of the demand-driven recommendations:
 *
 *  1. Recommended electives / specialisations *within* their programme that
 *     line up with high-demand market skills.
 *  2. Internships + graduate programmes — real SA programmes from credible
 *     organisations across private + public sectors.
 *  3. "Where graduates from your programme go" — the destinations dataset
 *     that the Department of Higher Education currently does not have.
 *  4. Supplementary free learning that complements the syllabus.
 *
 * Phase 6 derives (3) from `placements` joined with `profiles.academic`. This
 * Phase 1.5 mock holds the same interface so the Phase 6 swap is invisible.
 */
import type {
  AcademicProfile,
  InstitutionKind,
  NqfLevel,
  TaxonomyEntry,
} from "./types";

// ──────────────────────────────────────────────────────────────────────────────
// Programme electives / specialisations — what to take *within* the degree.

export interface ProgrammeElective {
  skill: TaxonomyEntry;
  /** Where it lives in the curriculum (year, course code or module). */
  curriculumHint: string;
  /** Why this elective is leverage right now. */
  detail: string;
  /** Province-level demand-vs-supply signal. */
  demandSignal: { searches: number; matches: number };
}

// ──────────────────────────────────────────────────────────────────────────────
// Internships + graduate programmes

export type ProgrammeKind = "internship" | "graduate_programme" | "learnership";

export interface OpportunityProgramme {
  title: string;
  organisation: string;
  /** Public sector / corporate / NGO / startup — gives context, never a hard filter. */
  sector: "public" | "corporate" | "ngo" | "startup";
  kind: ProgrammeKind;
  /** Months. */
  durationMonths: number;
  cities: string[];
  /** Open / closing soon / closed — never invented, sourced from programme listings (Phase 4). */
  applicationStatus: "open" | "closing_soon" | "closed";
  /** "Closes in 3 weeks", "Year-round intake" — display-only context. */
  applicationHint: string;
  /** Eligibility framing — be honest about who is NOT eligible. */
  eligibility: string;
  /** Tags surface fit; matched against the student's `fieldOfStudy`. */
  fieldTags: string[];
  /** True when the programme is recognised on the SAQA register. */
  saqaRecognised?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Graduate destinations — where past graduates of this programme ended up.

export interface GraduateDestination {
  /** Aggregated, anonymised — never a per-person trace. */
  destination: string;
  share: number; // 0..1
  /** "Median months from graduation to first confirmed placement." */
  medianMonthsToPlacement: number | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// The full student snapshot returned to the Career compass.

export interface StudentSnapshot {
  /** Headline like: "Graduate-ready by Dec 2026 · 7 months to go". */
  graduationHeadline: { monthsLeft: number; expectedGraduation: string };
  /** Bridge-the-degree-to-the-market summary. */
  bridgeHeadline: string;
  electives: ProgrammeElective[];
  programmes: OpportunityProgramme[];
  destinations: GraduateDestination[];
  /** Free learning that complements the syllabus. Re-uses the same shape as compass paths. */
  supplementarySkills: TaxonomyEntry[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock data — generic-enough to fit either student in the fixture set; the
// Phase 4 implementation reads from `searchEvents` × `profiles.academic`.

const CS_SNAPSHOT: StudentSnapshot = {
  graduationHeadline: { monthsLeft: 7, expectedGraduation: "2026-12" },
  bridgeHeadline:
    "Your BSc CS covers the fundamentals; the market wants two specific bridges before graduation.",
  electives: [
    {
      skill: { slug: "comp3007-distributed", label: "Distributed Systems (COMS3007)" },
      curriculumHint: "Year 3, Wits CS — taken in your second semester",
      detail:
        "Container orchestration and the Kubernetes lab module map almost 1:1 to the senior-developer demand in Gauteng.",
      demandSignal: { searches: 1240, matches: 410 },
    },
    {
      skill: { slug: "comp3008-data", label: "Big Data & Data Pipelines (COMS3008)" },
      curriculumHint: "Year 3 elective, Wits CS",
      detail:
        "Pairs your existing PostgreSQL strength with the dbt / Spark vocabulary the data-engineer pool is gasping for.",
      demandSignal: { searches: 1820, matches: 480 },
    },
    {
      skill: { slug: "comp4001-accessibility", label: "Inclusive Computing (COMS4001H)" },
      curriculumHint: "Honours-level elective — open to high-performing third-years",
      detail:
        "Almost no other graduate carries WCAG fluency. Big differentiator for public-sector and Discovery-style fintech work.",
      demandSignal: { searches: 320, matches: 110 },
    },
  ],
  programmes: [
    {
      title: "Yoco Engineering Internship",
      organisation: "Yoco",
      sector: "startup",
      kind: "internship",
      durationMonths: 6,
      cities: ["Cape Town", "Remote (ZA)"],
      applicationStatus: "open",
      applicationHint: "Rolling intake · review every 6 weeks",
      eligibility: "Final-year BSc CS / BIS / Eng or recent graduate. Must be eligible to work in SA.",
      fieldTags: ["Computer Science", "Software Engineering", "Information Systems"],
    },
    {
      title: "Discovery Graduate Programme — Tech & Data",
      organisation: "Discovery",
      sector: "corporate",
      kind: "graduate_programme",
      durationMonths: 24,
      cities: ["Sandton"],
      applicationStatus: "closing_soon",
      applicationHint: "Closes 30 June · final-year + 2026 graduates",
      eligibility: "65%+ average; final-year of a recognised BSc/BCom/BEng. SA citizens & permanent residents.",
      fieldTags: ["Computer Science", "Data Science", "Actuarial", "Engineering"],
    },
    {
      title: "Standard Bank Group IT Graduate Programme",
      organisation: "Standard Bank",
      sector: "corporate",
      kind: "graduate_programme",
      durationMonths: 18,
      cities: ["Johannesburg", "Cape Town"],
      applicationStatus: "open",
      applicationHint: "Intake every February · 2026 final-year welcome to apply",
      eligibility:
        "Final-year of a SA-accredited BSc/BCom/BEng. NSFAS / Funza Lushaka recipients explicitly encouraged.",
      fieldTags: ["Computer Science", "Information Systems", "Mathematics"],
    },
    {
      title: "MICT SETA Cloud Engineer Learnership",
      organisation: "MICT SETA",
      sector: "public",
      kind: "learnership",
      durationMonths: 12,
      cities: ["National — host employer dependent"],
      applicationStatus: "open",
      applicationHint: "Quarterly intake · paying stipend throughout",
      eligibility:
        "Unemployed / studying SA citizens with NQF 6+ in IT or related. Strong fit for graduating BSc CS.",
      fieldTags: ["Computer Science", "Information Technology", "Engineering"],
      saqaRecognised: true,
    },
    {
      title: "Stats SA Graduate Trainee",
      organisation: "Statistics South Africa",
      sector: "public",
      kind: "graduate_programme",
      durationMonths: 12,
      cities: ["Pretoria"],
      applicationStatus: "open",
      applicationHint: "Annual intake · public service salary scale 5",
      eligibility:
        "SA citizens with a completed or final-year Honours in Statistics, Economics, Computer Science or related.",
      fieldTags: ["Statistics", "Computer Science", "Economics"],
    },
  ],
  destinations: [
    { destination: "SA fintech (Yoco, TymeBank, Stitch)", share: 0.28, medianMonthsToPlacement: 4 },
    { destination: "Big-five banks (Standard, FNB, Discovery, Investec, Capitec)", share: 0.22, medianMonthsToPlacement: 6 },
    { destination: "Telcos / network ops", share: 0.12, medianMonthsToPlacement: 7 },
    { destination: "Honours / Masters continuation", share: 0.18, medianMonthsToPlacement: null },
    { destination: "Public sector (Stats SA, SARS, SITA)", share: 0.08, medianMonthsToPlacement: 8 },
    { destination: "International remote (US/EU)", share: 0.07, medianMonthsToPlacement: 5 },
    { destination: "Not yet placed (12+ months)", share: 0.05, medianMonthsToPlacement: null },
  ],
  supplementarySkills: [
    { slug: "git-workflow", label: "Git workflow & code review etiquette" },
    { slug: "linux-basics", label: "Practical Linux (the gap most CS grads have)" },
    { slug: "system-design", label: "System design interview prep" },
  ],
};

const ACCOUNTING_SNAPSHOT: StudentSnapshot = {
  graduationHeadline: { monthsLeft: 6, expectedGraduation: "2026-11" },
  bridgeHeadline:
    "BCom Honours qualifies you for SAICA articles — most leverage now is choosing the right traineeship.",
  electives: [
    {
      skill: { slug: "afm4001-data-analytics", label: "Accounting Data Analytics" },
      curriculumHint: "Honours elective — UCT BCom Hons",
      detail:
        "Bridges Excel + IFRS into Power BI / SQL. Currently the deciding factor between traineeships at the Big Four.",
      demandSignal: { searches: 540, matches: 180 },
    },
    {
      skill: { slug: "afm4002-tax", label: "Advanced Tax Practice" },
      curriculumHint: "Honours elective — UCT BCom Hons",
      detail:
        "SARS + private-sector tax practice still has the deepest persistent skills gap in the accounting market.",
      demandSignal: { searches: 410, matches: 140 },
    },
  ],
  programmes: [
    {
      title: "PwC SAICA Training Programme",
      organisation: "PwC South Africa",
      sector: "corporate",
      kind: "graduate_programme",
      durationMonths: 36,
      cities: ["Cape Town", "Johannesburg", "Durban"],
      applicationStatus: "open",
      applicationHint: "Apply Q3 of Honours year · January 2027 intake",
      eligibility: "BCom Honours in Accounting from a SAICA-accredited programme.",
      fieldTags: ["Accounting & Finance"],
      saqaRecognised: true,
    },
    {
      title: "Deloitte Audit Graduate Programme",
      organisation: "Deloitte",
      sector: "corporate",
      kind: "graduate_programme",
      durationMonths: 36,
      cities: ["Cape Town", "Johannesburg", "Pretoria"],
      applicationStatus: "open",
      applicationHint: "Apply Q3 of Honours year",
      eligibility: "BCom Honours in Accounting · SAICA pathway.",
      fieldTags: ["Accounting & Finance"],
      saqaRecognised: true,
    },
    {
      title: "SARS Tax Trainee Programme",
      organisation: "South African Revenue Service",
      sector: "public",
      kind: "graduate_programme",
      durationMonths: 24,
      cities: ["Pretoria", "Cape Town", "Durban"],
      applicationStatus: "closing_soon",
      applicationHint: "Closes 30 June · final-year BCom Honours",
      eligibility: "SA citizens with a BCom / BCom Hons in Accounting, Tax or Economics.",
      fieldTags: ["Accounting & Finance", "Tax"],
    },
  ],
  destinations: [
    { destination: "Big Four audit trainees (PwC, EY, Deloitte, KPMG)", share: 0.42, medianMonthsToPlacement: 5 },
    { destination: "Mid-tier audit & advisory (BDO, Mazars, Moore)", share: 0.18, medianMonthsToPlacement: 6 },
    { destination: "Banks: finance & risk graduate streams", share: 0.16, medianMonthsToPlacement: 6 },
    { destination: "Public sector (SARS, AGSA, Treasury)", share: 0.11, medianMonthsToPlacement: 7 },
    { destination: "Industry finance & corporate", share: 0.08, medianMonthsToPlacement: 8 },
    { destination: "Not yet placed (12+ months)", share: 0.05, medianMonthsToPlacement: null },
  ],
  supplementarySkills: [
    { slug: "power-bi", label: "Power BI for finance reporting" },
    { slug: "sql-finance", label: "SQL for finance teams" },
  ],
};

/** Pick the right mock snapshot for the academic profile. */
export function getStudentSnapshot(academic: AcademicProfile): StudentSnapshot {
  const field = academic.fieldOfStudy.toLowerCase();
  if (field.includes("accounting") || field.includes("finance")) {
    return ACCOUNTING_SNAPSHOT;
  }
  return CS_SNAPSHOT;
}

// ──────────────────────────────────────────────────────────────────────────────
// Display helpers

export const PROGRAMME_KIND_LABEL: Record<ProgrammeKind, string> = {
  internship: "Internship",
  graduate_programme: "Graduate programme",
  learnership: "Learnership",
};

export const SECTOR_LABEL: Record<OpportunityProgramme["sector"], string> = {
  public: "Public sector",
  corporate: "Corporate",
  ngo: "NGO",
  startup: "Startup",
};

export const APPLICATION_STATUS_LABEL: Record<
  OpportunityProgramme["applicationStatus"],
  string
> = {
  open: "Open",
  closing_soon: "Closing soon",
  closed: "Closed",
};

export const INSTITUTION_BAND_LABEL: Record<InstitutionKind, string> = {
  university: "Research university",
  uot: "University of Technology",
  tvet: "Public TVET",
  distance: "Distance university",
  indlela: "Artisan training",
  private: "Private institution",
};

/** Months between two ISO yyyy-mm strings (or yyyy-mm-dd / Date). Used for graduation timeline. */
export function monthsUntil(iso: string, reference: Date = new Date()): number {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return 0;
  const target = new Date(y, m - 1, 1);
  const months =
    (target.getFullYear() - reference.getFullYear()) * 12 +
    (target.getMonth() - reference.getMonth());
  return months;
}

/** Render an NQF level (4..10) into a short text label. */
export function nqfShort(level: NqfLevel): string {
  switch (level) {
    case 4:
      return "Matric";
    case 5:
      return "Higher Cert.";
    case 6:
      return "Diploma";
    case 7:
      return "Bachelor's";
    case 8:
      return "Honours";
    case 9:
      return "Master's";
    case 10:
      return "Doctorate";
  }
}
