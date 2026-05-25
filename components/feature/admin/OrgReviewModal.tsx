"use client";

/**
 * Phase 9.10  Admin org review modal.
 *
 * Bottom-sheet on phones, centred dialog on md+ (same idiom as the
 * 9.8 decline modal). Five state-dependent action affordances:
 *
 *   emailVerified=false  (org in any state):
 *     · Mark as verified (break-glass, amber)
 *     · Resend verification email
 *   unverified + emailVerified  (the Owner hasn't submitted yet):
 *     · No actions  waiting on user.
 *   pending  (submission ready for review):
 *     · Approve (emerald)
 *     · Request changes (amber, with note input)
 *     · Reject (red outline, with reason input)
 *   verified  (already approved):
 *     · Read-only.
 *   rejected  (previously rejected):
 *     · Read-only, shows previous reason.
 *
 * The action surface lives in `lib/admin/org-vetting.ts`.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

import { Button } from "@/components/ui/Button";
import {
  approveOrg,
  rejectOrg,
  requestChangesOnOrg,
  resendOrgVerificationEmail,
  markOrgEmailVerified,
  type OrgReviewDetail,
} from "@/lib/admin/org-vetting";
import {
  ORG_DOCUMENT_LABEL,
  type OrgDocumentKind,
} from "@/lib/employer/vetting-types";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  ShieldCheck,
  ShieldOff,
  X,
  XCircle,
} from "lucide-react";

interface Props {
  detail: OrgReviewDetail;
  onClose: () => void;
}

type Mode = "idle" | "rejecting" | "requesting-changes";

const STATE_PILL: Record<
  OrgReviewDetail["org"]["verification"],
  { label: string; class: string }
> = {
  unverified: {
    label: "Draft",
    class:
      "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]",
  },
  pending: {
    label: "Pending review",
    class:
      "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]",
  },
  verified: {
    label: "Verified",
    class:
      "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]",
  },
  rejected: {
    label: "Rejected",
    class:
      "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
  },
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function OrgReviewModal({ detail, onClose }: Props) {
  const router = useRouter();
  const { org, documents } = detail;
  const [mode, setMode] = useState<Mode>("idle");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setError(null);
    setMode("idle");
    setReason("");
    setNote("");
    router.refresh();
    onClose();
  }

  function onApprove() {
    if (!window.confirm(`Approve ${org.name}? This unlocks every PII feature for the org. Account reference: ${org.id}.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await approveOrg({ orgId: org.id });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      refresh();
    });
  }

  function onReject() {
    if (reason.trim().length < 10) {
      setError("Reason must be at least 10 characters.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await rejectOrg({ orgId: org.id, reason: reason.trim() });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      refresh();
    });
  }

  function onRequestChanges() {
    if (note.trim().length < 10) {
      setError("Note must be at least 10 characters.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await requestChangesOnOrg({
        orgId: org.id,
        note: note.trim(),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      refresh();
    });
  }

  function onResend() {
    setError(null);
    startTransition(async () => {
      const res = await resendOrgVerificationEmail({ orgId: org.id });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      refresh();
    });
  }

  function onMarkVerified() {
    if (
      !window.confirm(
        "Mark the Owner's email as verified? Use only when the verification link is genuinely lost or pre-consumed (e.g. Outlook Safe Links). This is audit-logged distinctly.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await markOrgEmailVerified({ orgId: org.id });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      refresh();
    });
  }

  const pill = STATE_PILL[org.verification];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-review-h"
      className="fixed inset-0 z-30 flex items-end justify-center bg-[color:var(--color-ink)]/40 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] md:rounded-[var(--radius-md)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--color-hairline)] p-5 md:p-6">
          <div>
            <h2
              id="org-review-h"
              className="font-display text-xl text-[color:var(--color-ink)]"
            >
              {org.name}
            </h2>
            <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              {org.id}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] ${pill.class}`}
              >
                {pill.label}
              </span>
              {org.ownerEmail && (
                <span className="inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  {org.ownerEmailVerified ? (
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                  ) : (
                    <ShieldOff className="size-3" aria-hidden="true" />
                  )}
                  Owner email {org.ownerEmailVerified ? "verified" : "unverified"}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 md:px-6">
          {/* Status-specific context cards */}
          {!org.ownerEmailVerified && org.verification === "unverified" && (
            <Context
              tone="brand"
              icon={Mail}
              title="Owner hasn't verified their email yet"
              body="They can't open the onboarding form until the Better Auth verification link is used. Use Resend or Mark-as-verified below."
            />
          )}
          {org.verification === "unverified" && org.ownerEmailVerified && !org.adminNote && (
            <Context
              tone="muted"
              icon={Clock}
              title="Waiting on the Owner to submit"
              body="Their email is verified  the form is open on their side. No admin action right now."
            />
          )}
          {org.adminNote && org.verification === "unverified" && (
            <Context
              tone="warn"
              icon={AlertTriangle}
              title="Your previous note is still showing on their form"
              body={org.adminNote}
            />
          )}
          {org.verification === "rejected" && org.rejectionReason && (
            <Context
              tone="danger"
              icon={XCircle}
              title="Previously rejected"
              body={org.rejectionReason}
            />
          )}
          {org.verification === "verified" && (
            <Context
              tone="accent"
              icon={ShieldCheck}
              title="Already verified"
              body={`Account reference is ${org.id}. No further action available; suspend via /admin/users if needed.`}
            />
          )}

          {/* Company info grid */}
          <section className="mt-5">
            <h3 className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Organisation details
            </h3>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <InfoRow label="Legal name" value={org.name} />
              <InfoRow
                label="Registration number"
                value={org.registrationNumber}
              />
              <InfoRow label="Industry" value={org.industry} />
              <InfoRow label="Country" value={org.country} />
              <InfoRow label="City" value={org.city} />
              <InfoRow label="VAT number" value={org.vatNumber} />
              {org.companyAddress && (
                <div className="md:col-span-2">
                  <dt className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                    Physical address
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-[color:var(--color-ink)]">
                    {org.companyAddress}
                  </dd>
                </div>
              )}
              {org.ownerEmail && (
                <InfoRow
                  label="Owner email"
                  value={`${org.ownerName ?? "?"} · ${org.ownerEmail}`}
                />
              )}
            </dl>
          </section>

          {/* Documents */}
          <section className="mt-6">
            <h3 className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
              Documents · {documents.length}
            </h3>
            {documents.length === 0 ? (
              <p className="text-xs italic text-[color:var(--color-ink-soft)]">
                No documents uploaded yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-display text-sm text-[color:var(--color-ink)]">
                        {ORG_DOCUMENT_LABEL[d.kind as OrgDocumentKind] ?? d.kind}
                      </p>
                      <p className="text-[0.7rem] text-[color:var(--color-ink-soft)]">
                        <FileText
                          className="mr-1 inline size-3 align-text-bottom"
                          aria-hidden="true"
                        />
                        {d.originalName}  {formatBytes(d.sizeBytes)}
                      </p>
                    </div>
                    {d.signedUrl ? (
                      <a
                        href={d.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink)] hover:border-[color:var(--color-ink)]"
                      >
                        Open
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-danger)]">
                        URL signing failed
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Reason / note input  conditional */}
          {mode === "rejecting" && (
            <div className="mt-5 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/5 p-3">
              <label
                htmlFor="reject-reason"
                className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]"
              >
                Rejection reason  the org will see this verbatim
              </label>
              <textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                disabled={pending}
                maxLength={500}
                rows={3}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-2 text-sm"
                placeholder="e.g. CIPC certificate is for a different entity than the registration number on file."
              />
              <p className="mt-1 text-[0.65rem] text-[color:var(--color-ink-soft)]">
                {500 - reason.length} characters left.
              </p>
            </div>
          )}
          {mode === "requesting-changes" && (
            <div className="mt-5 rounded-[var(--radius-sm)] border border-[color:var(--color-warn,#b08600)] bg-[color:var(--color-warn,#b08600)]/5 p-3">
              <label
                htmlFor="changes-note"
                className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]"
              >
                Note  shown to the org as a yellow banner on their form
              </label>
              <textarea
                id="changes-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                disabled={pending}
                maxLength={500}
                rows={3}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-2 text-sm"
                placeholder="e.g. Proof of address is older than 3 months  please upload a recent municipal bill or bank statement."
              />
              <p className="mt-1 text-[0.65rem] text-[color:var(--color-ink-soft)]">
                {500 - note.length} characters left.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-3 py-2 text-sm text-[color:var(--color-danger)]"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4 md:p-5">
          <div className="flex flex-wrap gap-2">
            {!org.ownerEmailVerified && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onResend}
                  disabled={pending}
                >
                  Resend verification email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onMarkVerified}
                  disabled={pending}
                >
                  Mark as verified (break-glass)
                </Button>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === "idle" && org.verification === "pending" && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setMode("requesting-changes")}
                  disabled={pending}
                >
                  Request changes
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setMode("rejecting")}
                  disabled={pending}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={onApprove}
                  disabled={pending}
                >
                  Approve
                </Button>
              </>
            )}
            {mode === "rejecting" && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMode("idle");
                    setReason("");
                    setError(null);
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={onReject}
                  disabled={pending || reason.trim().length < 10}
                >
                  {pending ? "Rejecting" : "Send rejection"}
                </Button>
              </>
            )}
            {mode === "requesting-changes" && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMode("idle");
                    setNote("");
                    setError(null);
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={onRequestChanges}
                  disabled={pending || note.trim().length < 10}
                >
                  {pending ? "Sending" : "Request changes"}
                </Button>
              </>
            )}
            {(org.verification === "verified" ||
              org.verification === "rejected") &&
              mode === "idle" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={pending}
                >
                  Close
                </Button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[color:var(--color-ink)]">
        {value && value.trim() ? value : (
          <span className="italic text-[color:var(--color-ink-soft)]">not provided</span>
        )}
      </dd>
    </div>
  );
}

const CTX_TONE: Record<
  "brand" | "muted" | "warn" | "danger" | "accent",
  string
> = {
  brand:
    "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]",
  muted:
    "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)]",
  warn:
    "border-[color:var(--color-warn,#b08600)] bg-[color:var(--color-warn,#b08600)]/10",
  danger:
    "border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10",
  accent:
    "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10",
};

function Context({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "brand" | "muted" | "warn" | "danger" | "accent";
  icon: typeof CheckCircle2;
  title: string;
  body: string;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-[var(--radius-sm)] border p-3 text-sm ${CTX_TONE[tone]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-display text-base text-[color:var(--color-ink)]">
          {title}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-[color:var(--color-ink-soft)]">
          {body}
        </p>
      </div>
    </div>
  );
}
