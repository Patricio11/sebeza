"use client";

/**
 * Phase 34 - the signed-in seeker's Apply flow on /apply/[token]
 * (docs/PHASE_34_SELF_APPLY_PLAN.md §34.4).
 *
 * Three-beat experience, all on BrandDialog so it feels like Sebenza,
 * never a generic popup:
 *   1. "Apply now" pill (or the honest already-applied / already-
 *      invited state the server computed).
 *   2. ApplyConfirm dialog - vacancy summary strip + the D4 disclosure
 *      line ("Applying shares your profile with {org} for this role").
 *      The confirm click is the audited consent act.
 *   3. Congrats dialog - restrained celebration + the SMART nudge: the
 *      vacancy's asked-for skills the seeker doesn't have yet, one tap
 *      from adding them. "Complete your profile so you're considered."
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, ArrowUpRight, Sparkles } from "lucide-react";
import { BrandDialog } from "@/components/ui/BrandDialog";
import { selfApplyToVacancy } from "@/lib/seeker/self-apply";

type Phase =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "done"; skillsGap: { slug: string; label: string }[] }
  | { kind: "already_applied"; invitationId: string }
  | { kind: "already_invited"; invitationId: string };

export function ApplyIsland({
  token,
  vacancyTitle,
  orgName,
  locationLabel,
  salaryBand,
  initialState,
  initialInvitationId,
  disclosure,
}: {
  token: string;
  vacancyTitle: string;
  orgName: string;
  locationLabel: string;
  /** Already viewer-filtered server-side (D2) - null = not shown. */
  salaryBand: string | null;
  initialState: "can_apply" | "already_applied" | "already_invited";
  initialInvitationId: string | null;
  /** The exact D4 disclosure line, resolved server-side. */
  disclosure: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => {
    if (initialState === "already_applied" && initialInvitationId) {
      return { kind: "already_applied", invitationId: initialInvitationId };
    }
    if (initialState === "already_invited" && initialInvitationId) {
      return { kind: "already_invited", invitationId: initialInvitationId };
    }
    return { kind: "idle" };
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await selfApplyToVacancy(token);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      if (res.outcome === "applied") {
        setPhase({ kind: "done", skillsGap: res.skillsGap });
      } else if (res.outcome === "already_applied") {
        setPhase({ kind: "already_applied", invitationId: res.invitationId });
      } else {
        setPhase({ kind: "already_invited", invitationId: res.invitationId });
      }
      router.refresh();
    });
  }

  // ── Terminal inline states (no dialog needed) ──────────────────────────
  if (phase.kind === "already_applied") {
    return (
      <StatusPanel
        icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
        title="You've applied for this role"
        body={`Your application is with ${orgName}. Keep your profile fresh. That's what they review.`}
        cta={{ href: "/dashboard/invitations", label: "View my applications" }}
      />
    );
  }
  if (phase.kind === "already_invited") {
    return (
      <StatusPanel
        icon={<Sparkles className="size-5" aria-hidden="true" />}
        title="Good news: you're already invited"
        body={`${orgName} already invited you to this role. Respond to the invitation instead of applying.`}
        cta={{
          href: `/dashboard/invitations/${phase.invitationId}`,
          label: "Open the invitation",
        }}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPhase({ kind: "confirm" })}
        className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-7 py-3.5 text-sm font-medium text-[color:var(--color-surface)] shadow-press transition-transform hover:-translate-y-0.5"
      >
        Apply now
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </button>

      {/* ── Beat 2: confirm ─────────────────────────────────────────────── */}
      <BrandDialog
        open={phase.kind === "confirm"}
        onClose={() => {
          if (!pending) {
            setPhase({ kind: "idle" });
            setError(null);
          }
        }}
        eyebrow="Apply · Sebenza"
        title={`Apply for ${vacancyTitle}`}
        pending={pending}
        footer={
          <>
            <button
              type="button"
              onClick={() => setPhase({ kind: "idle" })}
              disabled={pending}
              className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-5 py-2.5 text-sm text-[color:var(--color-ink)] transition-colors hover:border-[color:var(--color-ink)] disabled:opacity-50"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[color:var(--color-surface)] shadow-press transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {pending ? "Sending…" : "Confirm application"}
            </button>
          </>
        }
      >
        {/* Vacancy summary strip - the seeker confirms against the facts. */}
        <dl className="grid gap-2 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-4 text-sm">
          <SummaryRow label="Role" value={vacancyTitle} />
          <SummaryRow label="Employer" value={orgName} />
          <SummaryRow label="Location" value={locationLabel} />
          {salaryBand && <SummaryRow label="Salary band" value={salaryBand} />}
        </dl>

        {/* D4 - the disclosure IS the consent moment; state it plainly. */}
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
          {disclosure}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-3 py-2 text-sm text-[color:var(--color-ink)]"
          >
            {error}
          </p>
        )}
      </BrandDialog>

      {/* ── Beat 3: congratulations + the smart nudge ───────────────────── */}
      <BrandDialog
        open={phase.kind === "done"}
        onClose={() => router.push("/dashboard/invitations")}
        eyebrow="Application sent"
        title="Nicely done."
        footer={
          <>
            {phase.kind === "done" && phase.skillsGap.length > 0 && (
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[color:var(--color-surface)] shadow-press transition-transform hover:-translate-y-0.5"
              >
                Complete my profile
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            )}
            <Link
              href="/dashboard/invitations"
              className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-5 py-2.5 text-sm text-[color:var(--color-ink)] transition-colors hover:border-[color:var(--color-ink)]"
            >
              View my applications
            </Link>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 size-6 shrink-0 text-[color:var(--color-positive)]"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-[color:var(--color-ink)]">
            Your application for <strong>{vacancyTitle}</strong> is with{" "}
            <strong>{orgName}</strong>. They review applicants on their
            vacancy pipeline, and your profile is what they&rsquo;ll see.
          </p>
        </div>

        {phase.kind === "done" && phase.skillsGap.length > 0 ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[color:var(--color-brand)]/30 bg-[color:var(--color-brand-tint)] p-4">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
              Be considered · complete your profile
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--color-ink)]">
              This employer asked for skills you haven&rsquo;t added yet. Add
              the ones you have. It&rsquo;s how you rank higher:
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {phase.skillsGap.map((s) => (
                <li
                  key={s.slug}
                  className="rounded-[var(--radius-pill)] border border-[color:var(--color-brand)]/50 bg-[color:var(--color-surface)] px-3 py-1 text-xs text-[color:var(--color-brand-strong)]"
                >
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
            Keep your profile complete and your status fresh. Employers see
            exactly what you&rsquo;ve shared, and fresher profiles rank
            higher.
          </p>
        )}
      </BrandDialog>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="text-right font-medium text-[color:var(--color-ink)]">
        {value}
      </dd>
    </div>
  );
}

function StatusPanel({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <div className="flex items-center gap-2 text-[color:var(--color-brand-strong)]">
        {icon}
        <p className="font-display text-lg text-[color:var(--color-ink)]">
          {title}
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
        {body}
      </p>
      <Link
        href={cta.href}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-brand-strong)] hover:underline"
      >
        {cta.label}
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
