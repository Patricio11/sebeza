/**
 * The dataProvider seam (UX_UI_SPEC §4 + ROADMAP Phase 4 §4.2).
 *
 * Every page reads through this module. Phase 1 ships with the `mock` provider;
 * Phase 4 swaps to `db` against the same interface — pages do not change.
 *
 * Set `SEBENZA_DATA_PROVIDER=db` in env to switch (db impl arrives in Phase 4).
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

export interface DataProvider {
  searchProfiles(filters: SearchFilters): Promise<SearchResult>;
  getProfile(handle: string): Promise<PublicProfile | null>;
  getAnalyticsSnapshot(): Promise<AnalyticsSnapshot>;
}

const mockProvider: DataProvider = {
  async searchProfiles(filters) {
    // Phase 4: this becomes a real SQL query with select-list redaction.
    // The redaction is enforced at the type layer too — see PublicProfile.
    const ranked = rankProfiles(mockProfiles, filters);
    // Capture searchEvent (skills-gap signal — Phase 6 §6.3).
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

const dbProvider: DataProvider = {
  async searchProfiles() {
    throw new Error(
      "db provider not implemented yet — see ROADMAP.md Phase 4. Use SEBENZA_DATA_PROVIDER=mock for Phase 1.",
    );
  },
  async getProfile() {
    throw new Error("db provider not implemented yet — see ROADMAP.md Phase 4.");
  },
  async getAnalyticsSnapshot() {
    throw new Error("db provider not implemented yet — see ROADMAP.md Phase 4.");
  },
};

function selectProvider(): DataProvider {
  const choice = process.env.SEBENZA_DATA_PROVIDER ?? "mock";
  return choice === "db" ? dbProvider : mockProvider;
}

export const dataProvider: DataProvider = selectProvider();
