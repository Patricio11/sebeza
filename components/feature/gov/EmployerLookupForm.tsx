"use client";

/**
 * Phase 9.7.6  Per-employer lookup form (client island).
 *
 * Inputs:
 *   - org name OR registration number (exactly one  the action
 *     refuses both filled or both empty).
 *   - reason (enum, required).
 *   - reasonNote (required when reason === "other").
 *
 * The action lives in `lib/gov/employer-lookup.ts` and re-validates
 * everything server-side. This component is just the UX.
 *
 * Result panel shapes:
 *   - Org not found  honest "no match" + reminder that this is
 *     exact-match-only (the user probably typed the name slightly
 *     wrong).
 *   - Found but below floor  show placement count, explain the
 *     suppression, do NOT show the split.
 *   - Found and above floor  show the split with the same paired
 *     bars idiom used in 9.7.5 + the freshness note.
 */

import { useState, useTransition } from "react";
import { performEmployerLookup } from "@/lib/gov/employer-lookup";
import {
  REASON_LABELS,
  type LookupReason,
  type LookupResult,
} from "@/lib/gov/employer-lookup-types";
import { Button } from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/FormField";
import { Search, ShieldAlert } from "lucide-react";

export function EmployerLookupForm() {
  const [pending, startTransition] = useTransition();
  const [orgName, setOrgName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [reason, setReason] = useState<LookupReason>("compliance_check");
  const [reasonNote, setReasonNote] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);

  const exactlyOne =
    (orgName.trim().length > 0) !== (registrationNumber.trim().length > 0);
  const noteOk =
    reason !== "other" || reasonNote.trim().length >= 5;
  const canSubmit = !pending && exactlyOne && noteOk;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const r = await performEmployerLookup({
        orgName: orgName.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
        reason,
        reasonNote: reason === "other" ? reasonNote.trim() : undefined,
      });
      setResult(r);
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-5 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-6"
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Which employer? (exactly one)
          </legend>
          <TextField
            id="orgName"
            label="Organisation name (exact match, case-insensitive)"
            placeholder="e.g. Discovery Bank"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={pending || registrationNumber.trim().length > 0}
            hint="No autocomplete by design  this surface never enumerates employers."
          />
          <TextField
            id="registrationNumber"
            label="CIPC registration number"
            placeholder="2020/123456/07"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            disabled={pending || orgName.trim().length > 0}
          />
        </fieldset>

        <SelectField
          id="reason"
          label="Reason for lookup (audit-logged)"
          value={reason}
          onChange={(e) => setReason(e.target.value as LookupReason)}
          required
          disabled={pending}
        >
          {(Object.keys(REASON_LABELS) as LookupReason[]).map((k) => (
            <option key={k} value={k}>
              {REASON_LABELS[k]}
            </option>
          ))}
        </SelectField>

        {reason === "other" && (
          <TextareaField
            id="reasonNote"
            label="Note (required, ≥ 5 chars)"
            placeholder="e.g. Provincial Treasury request, ref #2026-…"
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            disabled={pending}
          />
        )}

        <Button type="submit" variant="primary" size="lg" disabled={!canSubmit}>
          <Search className="mr-2 size-4" aria-hidden="true" />
          {pending ? "Looking up" : "Look up employer"}
        </Button>

        <p className="text-[0.7rem] italic text-[color:var(--color-ink-soft)]">
          Each submission writes one{" "}
          <code className="rounded bg-[color:var(--color-surface-sunk)] px-1 text-[0.65rem]">
            gov.employer_mix.lookup
          </code>{" "}
          row with your user id, the employer queried, your stated
          reason, and the result (found / not found, above / below
          floor). Visible in the 9.7.7 oversight log.
        </p>
      </form>

      <div>
        {!result && (
          <div className="flex h-full items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-10 text-center text-sm text-[color:var(--color-ink-soft)]">
            Submit the form to see the result here. Nothing is queried
            until you do; nothing is exposed before then.
          </div>
        )}
        {result && <ResultPanel result={result} />}
      </div>
    </div>
  );
}

function ResultPanel({ result }: { result: LookupResult }) {
  if (!result.ok) {
    return (
      <div
        role="alert"
        className="rounded-[var(--radius-md)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 p-5 text-sm text-[color:var(--color-danger)]"
      >
        <div className="flex items-center gap-2 font-medium">
          <ShieldAlert className="size-4" aria-hidden="true" />
          Refused
        </div>
        <p className="mt-1 text-[color:var(--color-ink)]">{result.message}</p>
      </div>
    );
  }

  if (!result.orgFound) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
        <h3 className="font-display text-lg">No match.</h3>
        <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
          No organisation found with that exact name / registration
          number. Exact-match-only is deliberate  the surface
          never returns &ldquo;close matches.&rdquo; If the spelling
          differs by a character, the lookup will refuse. Floor at the
          time of this query: k = {result.floor}.
        </p>
      </div>
    );
  }

  // Found.
  const nfmt = new Intl.NumberFormat("en-ZA");
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--color-hairline)] pb-3">
        <div>
          <h3 className="font-display text-lg">{result.orgName}</h3>
          {result.registrationNumber && (
            <p className="text-xs text-[color:var(--color-ink-soft)]">
              CIPC: {result.registrationNumber}
            </p>
          )}
        </div>
        <span className="text-xs text-[color:var(--color-ink-soft)]">
          {result.total === 0
            ? "no platform-confirmed placements"
            : `${nfmt.format(result.total)} platform-confirmed placement${
                result.total === 1 ? "" : "s"
              }`}
        </span>
      </header>

      {!result.aboveFloor ? (
        <BelowFloorBlock
          total={result.total}
          floor={result.floor}
          nfmt={nfmt}
        />
      ) : (
        <AboveFloorBlock result={result} nfmt={nfmt} />
      )}
    </div>
  );
}

function BelowFloorBlock({
  total,
  floor,
  nfmt,
}: {
  total: number;
  floor: number;
  nfmt: Intl.NumberFormat;
}) {
  return (
    <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5 p-4">
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
        <ShieldAlert className="size-3.5" aria-hidden="true" />
        Below small-numbers floor
      </div>
      <p className="mt-2 text-sm text-[color:var(--color-ink)]">
        This employer has <strong>{nfmt.format(total)}</strong> Sebenza-
        confirmed placement{total === 1 ? "" : "s"}  below the
        suppression floor of <strong>{floor}</strong>. The SA-citizen
        / foreign-national split is <strong>not shown</strong>: at
        this volume, the split could re-identify individuals via the
        employer&rsquo;s own reveal log. The full count is in the
        audit-log row for this query.
      </p>
    </div>
  );
}

function AboveFloorBlock({
  result,
  nfmt,
}: {
  result: Extract<LookupResult, { aboveFloor: true }>;
  nfmt: Intl.NumberFormat;
}) {
  const pctSa = (result.sa_citizen / result.total) * 100;
  const pctForeign = (result.foreign_national / result.total) * 100;
  const dfmt = new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "short",
  });
  return (
    <>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-4">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
            SA citizens
          </div>
          <div className="mt-1 font-display tabular text-2xl text-[color:var(--color-brand-strong)]">
            {nfmt.format(result.sa_citizen)}{" "}
            <span className="text-sm">({pctSa.toFixed(0)}%)</span>
          </div>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-paper)] p-4">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-accent)]">
            Foreign nationals
          </div>
          <div className="mt-1 font-display tabular text-2xl">
            {nfmt.format(result.foreign_national)}{" "}
            <span className="text-sm">({pctForeign.toFixed(0)}%)</span>
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mt-4 flex h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]"
      >
        <span
          className="block h-full bg-[color:var(--color-brand)]"
          style={{ width: `${pctSa}%` }}
        />
        <span
          className="block h-full bg-[color:var(--color-accent)]"
          style={{ width: `${pctForeign}%` }}
        />
      </div>
      <p className="mt-4 text-xs text-[color:var(--color-ink-soft)]">
        Date range:{" "}
        {result.firstHireAt
          ? dfmt.format(new Date(result.firstHireAt))
          : "n/a"}
        {" "}{" "}
        {result.lastHireAt
          ? dfmt.format(new Date(result.lastHireAt))
          : "n/a"}{" "}
        · floor k = {result.floor} · employer-confirmed placements only.
      </p>
    </>
  );
}
