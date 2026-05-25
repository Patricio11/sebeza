"use client";

/**
 * Phase 9.10  Inline "Review" button for the admin organisations
 * queue. Click  fetches the full detail (org row + signed-URL
 * docs) server-side  opens the OrgReviewModal.
 *
 * The detail fetch is on-demand (not pre-fetched in the queue
 * SELECT) because each row needs `n` short-TTL signed URLs and
 * minting all of them up-front would waste tokens for orgs the
 * admin never opens.
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  getOrgReviewDetail,
  type OrgReviewDetail,
} from "@/lib/admin/org-vetting";
import { OrgReviewModal } from "./OrgReviewModal";
import { AlertTriangle, Eye } from "lucide-react";

interface Props {
  orgId: string;
  label?: string;
}

export function OrgReviewLauncher({ orgId, label = "Review" }: Props) {
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<OrgReviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    startTransition(async () => {
      const res = await getOrgReviewDetail(orgId);
      if (!res) {
        setError("Couldn't load this organisation. It may have been deleted.");
        return;
      }
      setDetail(res);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={open}
        disabled={pending}
      >
        <Eye className="size-4" aria-hidden="true" />
        {pending ? "Loading" : label}
      </Button>
      {error && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--color-danger)]">
          <AlertTriangle className="size-3" aria-hidden="true" />
          {error}
        </p>
      )}
      {detail && (
        <OrgReviewModal detail={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
