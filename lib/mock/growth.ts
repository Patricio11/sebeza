/**
 * Career compass  skills-growth recommendations for the seeker dashboard.
 *
 * Anchored on the same `demandBySkill` signal that powers `/insights`. The
 * recommendation logic is intentionally simple in Phase 1.5: pick skills with
 * the biggest demand-vs-match gap in the seeker's profession + location, then
 * surface SA-grounded learning paths (SETA, TVET, INDLELA, SAQA-recognised
 * programmes, free options first).
 *
 * Phase 6 fills `growthProvider` with real SQL: skills common to higher-ranked
 * profiles, real `searchEvents` co-occurrence, and a city-aware demand index.
 * The mock interface holds.
 */
import type { TaxonomyEntry } from "./types";

/** Why are we recommending this skill  drives the chip on each card. */
export type GrowthReason =
  | "demand_high"
  | "common_among_top_ranked"
  | "missing_for_role"
  | "adjacent_role";

export interface SkillRecommendation {
  skill: TaxonomyEntry;
  reason: GrowthReason;
  /** One-sentence honest justification, shown under the chip. */
  detail: string;
  /** What learning this would do to your rank in the local pool. */
  rankIfLearned?: { current: number; projected: number; poolLabel: string };
  /** Searches-vs-matches signal in the seeker's province. */
  demandSignal?: { searches: number; matches: number };
}

export type LearningProviderKind =
  | "seta" // Sector Education and Training Authority
  | "tvet" // Public TVET college
  | "indlela" // National Artisan Moderation Body
  | "saqa" // SAQA-recognised
  | "university" // Public university short course
  | "open"; // Open / free online (MOOC, FOSS docs)

export type LearningCost = "free" | "subsidised" | "paid";

export interface LearningPath {
  title: string;
  provider: string;
  providerKind: LearningProviderKind;
  /** Estimated weeks of part-time study. */
  durationWeeks: number;
  cost: LearningCost;
  /** Short, concrete cost note. Be honest. */
  costNote?: string;
  outcome: string;
  unlocksSkills: string[];
  /** True when this provider is widely accessible nationally. */
  national?: boolean;
  /**
   * Phase 11.2.1  direct URL to the provider's enrolment / application
   * page. Populated only for paths Sebenza has actually visited +
   * verified. Empty URL is honest  better than a stale or wrong link.
   * NEVER a redirect URL, NEVER a tracking pixel  direct deep-link so
   * the trust chain isn't tainted (D1).
   */
  url?: string;
  /**
   * Phase 11.2.1  set when Sebenza has editorially reviewed the
   * provider + the specific course. Distinct from `providerKind`
   * (which is taxonomic)  this is the trust signal.
   */
  sebenzaReviewed?: boolean;
}

export interface AdjacentProfession {
  profession: TaxonomyEntry;
  /** 0..1  how much of the seeker's current skill set overlaps with that role. */
  overlap: number;
  missingSkills: string[];
  /** Honest demand context in the seeker's province. */
  demandHint?: string;
}

export interface CompassSnapshot {
  /** Hero line: the headline rank-delta story. Drives the page's anchor number. */
  headline: {
    currentRank: number;
    projectedRank: number;
    poolLabel: string;
    /** How many skills they'd need to add to reach `projectedRank`. */
    skillsNeeded: number;
  };
  recommendations: SkillRecommendation[];
  learningPaths: LearningPath[];
  adjacentProfessions: AdjacentProfession[];
  /** Skills with the biggest demand vs match gap in the seeker's province. */
  cityDemand: { skill: string; searches: number; matches: number; gap: number }[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock data  keyed to `lerato-n` (Software Developer · Gauteng).
// Phase 6 derives all of this from `searchEvents` + ranking SQL.

export const MOCK_COMPASS: CompassSnapshot = {
  headline: {
    currentRank: 4,
    projectedRank: 2,
    poolLabel: "Software Developer · Gauteng",
    skillsNeeded: 2,
  },
  recommendations: [
    {
      skill: { slug: "kubernetes", label: "Kubernetes & container orchestration" },
      reason: "demand_high",
      detail:
        "Searches for \"developer + Kubernetes\" in Gauteng outnumber matches roughly 3 to 1. Senior-level postings almost always list it.",
      rankIfLearned: { current: 4, projected: 2, poolLabel: "Software Developer · Gauteng" },
      demandSignal: { searches: 1240, matches: 410 },
    },
    {
      skill: { slug: "react-native", label: "React Native (mobile)" },
      reason: "adjacent_role",
      detail:
        "You already have React (5/5). Adding React Native unlocks the Mobile Developer pool  about 60% overlap, growing demand from SA fintech.",
      demandSignal: { searches: 880, matches: 270 },
    },
    {
      skill: { slug: "accessibility", label: "Web accessibility (WCAG)" },
      reason: "common_among_top_ranked",
      detail:
        "Four of the top five Gauteng senior developers list accessibility. Differentiator for public-sector and inclusive-design work.",
      demandSignal: { searches: 320, matches: 110 },
    },
    {
      skill: { slug: "data-eng", label: "Data engineering (SQL → Spark/dbt)" },
      reason: "missing_for_role",
      detail:
        "Your PostgreSQL is strong  extending to pipelines opens the Data Engineer pool, which has the largest gap in Gauteng right now.",
      demandSignal: { searches: 1820, matches: 480 },
    },
  ],
  learningPaths: [
    {
      title: "MICT SETA: Cloud Engineer learnership",
      provider: "Media, Information & Communication Technologies SETA",
      providerKind: "seta",
      durationWeeks: 48,
      cost: "subsidised",
      costNote: "Stipend-paying  fully funded for unemployed SA citizens.",
      outcome: "NQF Level 5 Cloud Engineer certificate · covers Kubernetes, AWS basics",
      unlocksSkills: ["Kubernetes", "AWS", "CI/CD"],
      national: true,
      url: "https://www.mict.org.za/learnerships/",
      sebenzaReviewed: true,
    },
    {
      title: "TVET: National Diploma in IT (Systems Development)",
      provider: "Public TVET colleges (Ekurhuleni West, Tshwane North, others)",
      providerKind: "tvet",
      durationWeeks: 144,
      cost: "subsidised",
      costNote: "NSFAS funding available; typical out-of-pocket ~R 4 000/year.",
      outcome: "NQF Level 6 Diploma · broad systems engineering grounding",
      unlocksSkills: ["Systems analysis", "Databases", "Networking"],
      national: true,
      url: "https://www.dhet.gov.za/SitePages/TVETColleges.aspx",
      sebenzaReviewed: true,
    },
    {
      title: "Wits Plus  Short Course in Cloud Native Development",
      provider: "University of the Witwatersrand (Wits Plus)",
      providerKind: "university",
      durationWeeks: 12,
      cost: "paid",
      costNote: "Approx. R 14 500 · employer-sponsorship common.",
      outcome: "Certificate of completion · CKAD-aligned syllabus",
      unlocksSkills: ["Kubernetes", "Helm", "Cloud native patterns"],
      url: "https://www.witsplus.co.za/",
      sebenzaReviewed: true,
    },
    {
      title: "Free: official Kubernetes documentation + interactive tutorials",
      provider: "kubernetes.io",
      providerKind: "open",
      durationWeeks: 8,
      cost: "free",
      costNote: "Free. Data charges only  most of it is text-light.",
      outcome: "Self-paced. Pair with the CKAD practice exams to validate.",
      unlocksSkills: ["Kubernetes basics"],
      national: true,
      url: "https://kubernetes.io/docs/tutorials/",
      sebenzaReviewed: true,
    },
    {
      title: "Free: web.dev Learn Accessibility",
      provider: "web.dev (Google)",
      providerKind: "open",
      durationWeeks: 4,
      cost: "free",
      costNote: "Free. ~20MB of content total  works on metered data.",
      outcome: "Working knowledge of WCAG 2.2 AA + practical patterns",
      unlocksSkills: ["WCAG 2.2", "ARIA", "Keyboard navigation"],
      national: true,
      url: "https://web.dev/learn/accessibility/",
      sebenzaReviewed: true,
    },
  ],
  adjacentProfessions: [
    {
      profession: { slug: "mobile-developer", label: "Mobile Developer" },
      overlap: 0.72,
      missingSkills: ["React Native or Kotlin", "App store deployment"],
      demandHint:
        "Gauteng fintech (Discovery, Standard Bank, TymeBank) actively hiring · ~880 searches/mo",
    },
    {
      profession: { slug: "data-engineer", label: "Data Engineer" },
      overlap: 0.58,
      missingSkills: ["Spark or dbt", "Cloud data warehousing"],
      demandHint:
        "Largest skills gap in Gauteng IT right now  1820 searches vs 480 matches",
    },
    {
      profession: { slug: "devops-engineer", label: "DevOps / SRE" },
      overlap: 0.65,
      missingSkills: ["Kubernetes", "Terraform", "Observability stack"],
      demandHint:
        "Senior bands pay well above SA developer median  Cloud Engineer SETA path covers most of the gap",
    },
  ],
  cityDemand: [
    { skill: "Data engineering", searches: 1820, matches: 480, gap: 1340 },
    { skill: "Kubernetes / container orchestration", searches: 1240, matches: 410, gap: 830 },
    { skill: "Mobile (React Native / Kotlin)", searches: 880, matches: 270, gap: 610 },
    { skill: "Cybersecurity (blue team)", searches: 760, matches: 220, gap: 540 },
    { skill: "Accessibility (WCAG)", searches: 320, matches: 110, gap: 210 },
  ],
};

/** Phase 6 replaces this with a real query off `searchEvents` + ranking SQL. */
export function getCompassForHandle(_handle: string): CompassSnapshot {
  return MOCK_COMPASS;
}

export const REASON_LABEL: Record<GrowthReason, string> = {
  demand_high: "High demand · low supply",
  common_among_top_ranked: "Common at top of your pool",
  missing_for_role: "Unlocks an adjacent role",
  adjacent_role: "Builds on what you already have",
};

export const PROVIDER_LABEL: Record<LearningProviderKind, string> = {
  seta: "SETA",
  tvet: "Public TVET",
  indlela: "INDLELA",
  saqa: "SAQA-recognised",
  university: "Public university",
  open: "Open / free",
};

export const COST_LABEL: Record<LearningCost, string> = {
  free: "Free",
  subsidised: "Subsidised",
  paid: "Paid",
};
