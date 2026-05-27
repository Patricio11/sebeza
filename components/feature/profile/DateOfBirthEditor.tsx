"use client";

/**
 * Phase 9.16  edit your date of birth from /dashboard/profile.
 *
 * Captured once at sign-up; this surface is for fixing typos + filling
 * it in for legacy accounts that pre-date the column. Never exposed on
 * the public profile + never echoed into the audit log meta beyond the
 * field name (DOB is POPIA personal info).
 *
 * Edit-on-click: shows the long form ("15 June 1990") with a "Change"
 * button until the user clicks. Then it swaps to a DatePicker + Save /
 * Cancel actions. Same pattern as the surrounding profile sections.
 */

import { useState, useTransition } from "react";
import { CheckCircle, Pencil } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { updateMyDateOfBirth } from "@/lib/profile/actions";

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function displayDob(iso: string | null): string {
  if (!iso) return "Not set";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "Not set";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return `${day} ${FULL_MONTHS[month - 1]} ${year}`;
}

const TODAY = new Date();
const MIN_DATE = `${TODAY.getUTCFullYear() - 100}-01-01`;
const MAX_DATE = (() => {
  const y = TODAY.getUTCFullYear() - 14;
  const m = String(TODAY.getUTCMonth() + 1).padStart(2, "0");
  const d = String(TODAY.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
})();

interface Props {
  /** Current ISO yyyy-mm-dd (null for legacy accounts). */
  initialValue: string | null;
}

export function DateOfBirthEditor({ initialValue }: Props) {
  const [editing, setEditing] = useState(initialValue === null);
  const [draft, setDraft] = useState(initialValue ?? "");
  const [committed, setCommitted] = useState(initialValue);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateMyDateOfBirth({ dateOfBirth: draft });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setCommitted(draft);
      setEditing(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2400);
    });
  }

  function cancel() {
    setDraft(committed ?? "");
    setEditing(false);
    setError(null);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2.5">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Date of birth
          </p>
          <p className="mt-0.5 text-sm font-medium text-[color:var(--color-ink)]">
            {displayDob(committed)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="inline-flex items-center gap-1 text-[0.7rem] text-[color:var(--color-brand-strong)]">
              <CheckCircle className="size-3.5" aria-hidden="true" />
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]"
          >
            <Pencil className="size-3" aria-hidden="true" />
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-3">
      <DatePicker
        label="Date of birth"
        value={draft}
        onChange={setDraft}
        minDate={MIN_DATE}
        maxDate={MAX_DATE}
        error={error ?? undefined}
        helpText="Visible only to you and Sebenza administrators. Never shown on your public profile."
        disabled={pending}
      />
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={save}
          disabled={pending || !draft}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        {committed !== null && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={cancel}
            disabled={pending}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
