"use client";

/**
 * 2026-08  hard delete for junk / duplicate organisations in the
 * admin queue (founder ask: a double registration had no remove
 * path). Typed-name confirmation in a BrandDialog; the server
 * action re-checks the name and refuses orgs with placements.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Trash2 } from "lucide-react";
import { BrandDialog } from "@/components/ui/BrandDialog";
import { deleteOrganization } from "@/lib/admin/org-vetting";

interface Props {
  orgId: string;
  orgName: string;
  documentCount: number;
}

export function OrgDeleteButton({ orgId, orgName, documentCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await deleteOrganization({ orgId, confirmName: typed });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Delete ${orgName}`}
        onClick={() => setOpen(true)}
        className="inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)] transition-colors hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>

      <BrandDialog
        open={open}
        onClose={close}
        pending={pending}
        eyebrow="Danger zone"
        title={`Delete ${orgName}?`}
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="h-10 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="org-delete-form"
              disabled={pending || typed.trim() !== orgName}
              className="h-10 rounded-[var(--radius-pill)] bg-[color:var(--color-danger)] px-4 text-xs uppercase tracking-[0.18em] text-white disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-[color:var(--color-ink)]">
          <p>
            This permanently removes the organisation, its team memberships,
            vacancies and their pipelines, saved searches, shortlists
            {documentCount > 0
              ? `, and ${documentCount} uploaded document${documentCount === 1 ? "" : "s"}`
              : ""}
            . It cannot be undone.
          </p>
          <p className="text-xs text-[color:var(--color-ink-soft)]">
            Member accounts are not deleted; manage those on the Users page.
            Organisations with confirmed placements cannot be deleted at all.
          </p>
          <form id="org-delete-form" onSubmit={submit}>
            <label className="block text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Type the organisation name to confirm
            </label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={orgName}
              className="mt-1.5 h-10 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 text-sm"
            />
          </form>
          {error && (
            <p role="alert" className="text-xs text-[color:var(--color-danger)]">
              {error}
            </p>
          )}
        </div>
      </BrandDialog>
    </>
  );
}
