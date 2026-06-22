/**
 * Seed fixtures  the canonical accounts the seed writes INTO the database.
 *
 * These are NOT runtime data. Nothing outside `db/seed.ts` imports them; at
 * runtime every read comes from the database via the data-provider seam
 * (`lib/data/provider.ts`). They previously lived in the nav component files
 * (`MOCK_ADMIN` in adminNav, `MOCK_EMPLOYER` in employerNav), which made the
 * runtime layer look mock-backed  moved here and renamed `SEED_*` to make the
 * DB-first boundary explicit. Editing a value here only changes what the next
 * `npm run db:seed` writes; it has no effect on a running app.
 */

export interface SeedEmployer {
  orgName: string;
  orgVerified: boolean;
  industry: string;
  size: string;
  registration: string;
  city: string;
  country: string;
  user: {
    fullName: string;
    role: string;
    email: string;
  };
}

/** Discovery Bank  the seed's happy-path employer + its owner account. */
export const SEED_DISCOVERY_EMPLOYER: SeedEmployer = {
  orgName: "Discovery Bank",
  orgVerified: false,
  industry: "Financial services",
  size: "1 001+",
  registration: "1996/004593/06",
  city: "Sandton",
  country: "South Africa",
  user: {
    fullName: "Naledi Khumalo",
    role: "Head of Talent Acquisition",
    email: "naledi.khumalo@discovery.co.za",
  },
};

/** The seeded platform admin account. */
export const SEED_ADMIN = {
  fullName: "Sebenza · Admin",
  role: "Compliance & Trust",
  email: "admin@sebenzasa.com",
};
