// Mirrors the eventual Drizzle schema (Phase 4) but redaction-aware.
// Phase 4 swaps `lib/data/provider.ts` from mock → db with NO change to these types
// or to the UI components that consume them. That is the seam.

export type EmploymentStatus =
  | "employed"
  | "unemployed"
  | "self_employed"
  | "studying"
  | "open_to_work";

export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

export type Seniority = "junior" | "intermediate" | "senior";

export type UserRole = "seeker" | "employer" | "admin";

export type FreshnessBand = "fresh" | "ageing" | "stale";

export interface SkillRef {
  name: string;
  proficiency: 1 | 2 | 3 | 4 | 5;
}

/**
 * What the public/search payload CAN expose.
 * Redaction Rule (TO_START_EVERY_SESSION.md §5): never include ID, documents,
 * or raw contact details here — even for verified employers. Contact reveal is
 * a separate, audit-logged code path (Phase 5).
 */
export interface PublicProfile {
  handle: string;
  /** Surname is redacted in public/search payloads (e.g. "Thandeka M."). */
  displayName: string;
  profession: string;
  seniority: Seniority | null;
  city: string;
  province: string;
  /** Shown, optionally filterable. NEVER a gate. Location-Not-Nationality Rule. */
  nationality: string | null;
  /** Drives optional "highlight" UI only. Never used to exclude. */
  isCitizen: boolean;
  topSkills: SkillRef[];
  /** One-paragraph bio for the profile page (still PII-light). */
  bio?: string;
  status: EmploymentStatus;
  /** ISO timestamp. Freshness band derives from this — see helpers.freshnessBand(). */
  statusConfirmedAt: string;
  verification: VerificationStatus;
  /** 0–100. Drives ProfileCompleteness component + ranking. */
  completeness: number;
  /** When the profile joined Sebenza (for "member since"). */
  memberSince: string;
  experience?: ExperienceItem[];
  qualifications?: QualificationItem[];
}

export interface ExperienceItem {
  role: string;
  organization: string;
  city: string;
  /** ISO yyyy-mm. */
  startedAt: string;
  /** ISO yyyy-mm or null for current. */
  endedAt: string | null;
  description?: string;
}

export interface QualificationItem {
  title: string;
  institution: string;
  /** ISO yyyy. */
  awardedYear: number | null;
  verification: VerificationStatus;
}

export interface SearchFilters {
  query?: string;
  province?: string | null;
  city?: string | null;
  status?: EmploymentStatus | null;
  seniority?: Seniority | null;
  verification?: VerificationStatus | null;
  highlightCitizens?: boolean;
}

export interface SearchResult {
  total: number;
  profiles: PublicProfile[];
}

export interface AnalyticsSnapshot {
  totalActive: number;
  confirmedHiresThisMonth: number;
  byStatus: Record<
    EmploymentStatus,
    { count: number; freshnessConfidence: number }
  >;
  demandBySkill: { skill: string; searches: number; matches: number }[];
  trend: { month: string; registrations: number; placements: number }[];
}

export interface TaxonomyEntry {
  slug: string;
  label: string;
}

export interface Province extends TaxonomyEntry {
  cities: TaxonomyEntry[];
}
