/**
 * The `dataProvider` seam (UX_UI_SPEC §4 + ROADMAP Phase 4 §4.2).
 *
 * Every public-read page calls through this module. Phase 1 shipped with
 * `mockProvider`. Phase 4 lights up `dbProvider` against the Postgres queries
 * in `db/queries/*`. Pages don't change  same interface, same shape.
 *
 * The active provider is picked at boot from `SEBENZA_DATA_PROVIDER`:
 *   - `db`   (recommended)         Phase 4+: live Neon + FTS ranking
 *   - `mock` (fallback)            Phase 1-style mock fixtures; useful
 *                                   for off-DB local dev / fixture tests
 *
 * Photo URLs: the DB stores raw Supabase Storage keys; this layer signs
 * them with a short-lived URL before handing to the page. Mock provider
 * passes through the static URL field as-is.
 */
import { mockAnalytics } from "@/lib/mock/analytics";
import { mockProfiles, getProfileByHandle } from "@/lib/mock/profiles";
import { rankProfiles } from "@/lib/mock/helpers";
import type {
  AnalyticsSnapshot,
  PublicProfile,
  SearchFilters,
  SearchResult,
} from "@/lib/mock/types";
import { logAccess } from "@/lib/audit";
import {
  searchProfilesQuery,
  findProfileByHandleQuery,
} from "@/db/queries/profiles";
import { analyticsSnapshotQuery } from "@/db/queries/analytics";
import { signedPhotoUrl } from "@/lib/storage/signed";
import { isStorageConfigured } from "@/lib/storage/supabase";

export interface DataProvider {
  searchProfiles(filters: SearchFilters): Promise<SearchResult>;
  getProfile(handle: string): Promise<PublicProfile | null>;
  getAnalyticsSnapshot(): Promise<AnalyticsSnapshot>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock provider  Phase 1 fixtures. Kept as a fallback for off-DB dev.
// ─────────────────────────────────────────────────────────────────────────────

const mockProvider: DataProvider = {
  async searchProfiles(filters) {
    const ranked = rankProfiles(mockProfiles, filters);
    await logAccess({
      kind: "search.profiles",
      actor: "anonymous",
      meta: { filters, resultCount: ranked.length },
    });
    return { total: ranked.length, profiles: ranked };
  },

  async getProfile(handle) {
    const profile = getProfileByHandle(handle);
    if (profile) {
      await logAccess({
        kind: "profile.view",
        actor: "anonymous",
        subject: handle,
      });
    }
    return profile;
  },

  async getAnalyticsSnapshot() {
    return mockAnalytics;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DB provider  Phase 4: real Neon + ranking SQL.
//
// On top of the raw query layer, this provider:
//   - Mints short-lived signed URLs for any photo keys in the payload
//   - Hands logAccess to the query layer (so the audit row carries the
//     same `kind` regardless of which provider is active)
// ─────────────────────────────────────────────────────────────────────────────

const dbProvider: DataProvider = {
  async searchProfiles(filters) {
    const { total, profiles } = await searchProfilesQuery(filters);
    const signed = await signPhotoUrls(profiles);
    return { total, profiles: signed };
  },

  async getProfile(handle) {
    const profile = await findProfileByHandleQuery(handle);
    if (!profile) return null;
    const [signed] = await signPhotoUrls([profile]);
    return signed ?? profile;
  },

  async getAnalyticsSnapshot() {
    return analyticsSnapshotQuery();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Photo signing
//
// The DB stores `profilePhotoUrl` as a raw Supabase Storage object key.
// Public read paths swap it for a short-lived signed URL right before the
// payload leaves the server. Done in parallel via Promise.all so the
// overhead is one round-trip regardless of result count.
//
// If Supabase isn't configured (dev without SUPABASE_URL), photo URLs
// degrade to `null` and the Avatar component falls back to initials 
// the page still renders cleanly.
// ─────────────────────────────────────────────────────────────────────────────

async function signPhotoUrls(
  profiles: PublicProfile[],
): Promise<PublicProfile[]> {
  if (!isStorageConfigured()) {
    return profiles.map((p) => ({ ...p, profilePhotoUrl: null }));
  }
  return Promise.all(
    profiles.map(async (p) => {
      if (!p.profilePhotoUrl) return { ...p, profilePhotoUrl: null };
      const url = await signedPhotoUrl(p.profilePhotoUrl);
      return { ...p, profilePhotoUrl: url };
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection
// ─────────────────────────────────────────────────────────────────────────────

function selectProvider(): DataProvider {
  const choice = process.env.SEBENZA_DATA_PROVIDER ?? "mock";
  if (choice === "db") return dbProvider;
  if (choice === "mock") return mockProvider;
  // Unknown value  fail closed to mock so dev doesn't crash on a typo.
  console.warn(
    `[dataProvider] Unknown SEBENZA_DATA_PROVIDER="${choice}"  falling back to mock.`,
  );
  return mockProvider;
}

export const dataProvider: DataProvider = selectProvider();
