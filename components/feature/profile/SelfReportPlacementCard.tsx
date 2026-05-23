"use client";

/**
 * Phase 7.5  Seeker self-reports a placement.
 *
 * Shown on the dashboard when status === "employed". Stored with
 * `source: "seeker_reported"`, distinct from the employer-confirmed
 * placements that count in official analytics. Always flagged as
 * self-declared on display surfaces.
 */

import { useState, useTransition } from "react";
import { Briefcase, Info } from "lucide-react";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { selfReportPlacement } from "@/lib/profile/actions";

export function SelfReportPlacementCard() {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [organizationName, setOrg] = useState("");
  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await selfReportPlacement({
        organizationName,
        role,
        city,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(true);
      setExpanded(false);
      setOrg("");
      setRole("");
      setCity("");
    });
  }

  if (saved && !expanded) {
    return (
      <div className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] p-5">
        <div className="flex items-start gap-2 text-sm">
          <Briefcase
            className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand-strong)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Self-reported placement logged.</p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
              Shown on your public profile flagged as self-declared. Employer
              confirmation lifts it to the verified count  ask them to log
              the hire from their side.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <div className="flex items-start gap-2">
        <Briefcase
          className="mt-0.5 size-4 shrink-0 text-[color:var(--color-accent)]"
          aria-hidden="true"
        />
        <div className="flex-1">
          <h3 className="font-display text-lg leading-tight">
            Where are you working?
          </h3>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            Optional. Adding a self-reported placement helps your profile
            tell the right story. Employer-confirmed placements count in
            national analytics; self-reports do not  Placement-Truth Rule.
          </p>
        </div>
      </div>

      {!expanded ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => {
            setExpanded(true);
            setSaved(false);
          }}
        >
          Log self-reported placement
        </Button>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <TextField
            id="srp-org"
            label="Organisation name"
            value={organizationName}
            onChange={(e) => setOrg(e.target.value)}
            required
            minLength={2}
            maxLength={200}
          />
          <TextField
            id="srp-role"
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
            minLength={2}
            maxLength={120}
          />
          <TextField
            id="srp-city"
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            minLength={1}
            maxLength={120}
          />
          <p className="flex items-start gap-1.5 text-xs text-[color:var(--color-ink-soft)]">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            We display this on your profile with a "self-reported" label.
            No national-analytics impact until your employer confirms.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-white px-3 py-2 text-xs text-[color:var(--color-danger)]"
            >
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpanded(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
