"use client";

/**
 * Phase 11.4.2  follow-employer heart toggle.
 *
 * Tiny client island. Renders a heart icon that fills when followed.
 * On click, hits `followEmployer` / `unfollowEmployer` server actions
 * + router-refreshes so any sibling counts (e.g. "Following N
 * employers") refresh on the page.
 *
 * Privacy posture: the toggle never tells the employer anything
 * the follow is private to the seeker (D3). The icon is the only
 * surface; no count, no list, no on-page notification to the
 * employer-facing UI.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Heart } from "lucide-react";
import {
  followEmployer,
  unfollowEmployer,
} from "@/lib/seeker/follows";

interface Props {
  orgId: string;
  initialFollowing: boolean;
  /** Compact icon-only variant for /search cards. */
  variant?: "icon" | "button";
}

export function FollowEmployerButton({
  orgId,
  initialFollowing,
  variant = "icon",
}: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function onToggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const res = next
        ? await followEmployer(orgId)
        : await unfollowEmployer(orgId);
      if (!res.ok) {
        setFollowing(!next);
        return;
      }
      router.refresh();
    });
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-pressed={following}
        aria-label={following ? "Unfollow employer" : "Follow employer"}
        title={following ? "Following  click to unfollow" : "Follow this employer"}
        className={
          "inline-flex size-8 items-center justify-center rounded-full border transition-colors " +
          (following
            ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
            : "border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]")
        }
      >
        <Heart
          className={"size-4 " + (following ? "fill-current" : "")}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={following}
      className={
        "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-4 py-2 text-sm font-medium transition-colors " +
        (following
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
          : "border-[color:var(--color-ink)] bg-[color:var(--color-paper)] text-[color:var(--color-ink)] hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]")
      }
    >
      <Heart
        className={"size-4 " + (following ? "fill-current" : "")}
        aria-hidden="true"
      />
      {following
        ? pending
          ? "Saving"
          : "Following"
        : pending
          ? "Following"
          : "Follow this employer"}
    </button>
  );
}
