"use client";

/**
 * Phase 9.10  Org onboarding form (KYC document upload + address +
 * VAT). The Owner-only edit surface that flips an org from
 * `unverified`  `pending` review.
 *
 * Mobile-first: single column on phones, 2-column for the meta
 * fields (city + VAT) on md+. Document slots are stacked  each is a
 * full-width row at 360 px wide so the file name + size + delete
 * action all fit.
 *
 * Upload model: per-file POST as the user picks them (no progress
 * spinner gymnastics  one upload = one request via FormData). The
 * server replaces the previous file of the same required kind on
 * each pick. `Other` is append-only up to the OTHER_DOC_CAP.
 *
 * Resubmission case: when the org is back in `unverified` after an
 * admin "Request changes", `adminNote` is set on the org row and
 * the parent page renders a yellow banner. Previously-uploaded docs
 * stay visible in this form so the user only changes what was
 * flagged. On submit the banner clears (handled server-side).
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";

import { Button } from "@/components/ui/Button";
import { TextField, TextareaField } from "@/components/ui/FormField";
import {
  deleteOrgDocument,
  submitOrgOnboarding,
  uploadOrgDocumentFile,
} from "@/lib/employer/vetting";
import {
  ORG_DOCUMENT_LABEL,
  REQUIRED_DOC_KINDS,
  type OrgDocumentKind,
  type OrgDocumentRow,
} from "@/lib/employer/vetting-types";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";

interface Props {
  initial: {
    companyAddress: string | null;
    vatNumber: string | null;
    city: string | null;
    documents: OrgDocumentRow[];
    adminNote: string | null;
  };
}

const KB = 1024;
const MB = 1024 * KB;

function formatBytes(n: number): string {
  if (n < KB) return `${n} B`;
  if (n < MB) return `${(n / KB).toFixed(0)} KB`;
  return `${(n / MB).toFixed(1)} MB`;
}

export function OrgOnboardingForm({ initial }: Props) {
  const router = useRouter();
  const [companyAddress, setCompanyAddress] = useState(
    initial.companyAddress ?? "",
  );
  const [vatNumber, setVatNumber] = useState(initial.vatNumber ?? "");
  const [city, setCity] = useState(initial.city ?? "");

  // Local mirror of the server-side documents list. Updated optimistically
  // after each upload + delete; the parent page also refreshes via
  // router.refresh() after upload completion.
  const [docs, setDocs] = useState<OrgDocumentRow[]>(initial.documents);

  const [uploadingKind, setUploadingKind] = useState<OrgDocumentKind | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const docsByKind = new Map<OrgDocumentKind, OrgDocumentRow[]>();
  for (const d of docs) {
    const list = docsByKind.get(d.kind) ?? [];
    list.push(d);
    docsByKind.set(d.kind, list);
  }

  async function handlePick(kind: OrgDocumentKind, file: File) {
    setError(null);
    setUploadingKind(kind);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("file", file);
      const res = await uploadOrgDocumentFile(fd);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // Optimistic local insert; router.refresh() picks up the
      // canonical state from the server next tick.
      const next: OrgDocumentRow = {
        id: res.documentId,
        kind,
        originalName: file.name,
        storageKey: res.storageKey,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      };
      setDocs((prev) => {
        if (kind === "other") return [...prev, next];
        return [...prev.filter((d) => d.kind !== kind), next];
      });
      router.refresh();
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleDelete(documentId: string) {
    setError(null);
    const res = await deleteOrgDocument(documentId);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setDocs((prev) => prev.filter((d) => d.id !== documentId));
    router.refresh();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitOrgOnboarding({
        companyAddress: companyAddress.trim(),
        vatNumber: vatNumber.trim() || null,
        city: city.trim() || null,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // Server-side revalidate of the page itself will flip the view.
      router.refresh();
    });
  }

  const haveAllRequired = REQUIRED_DOC_KINDS.every((k) => docsByKind.has(k));
  const submitDisabled =
    pending ||
    !haveAllRequired ||
    !companyAddress.trim() ||
    companyAddress.trim().length < 10;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 px-4 py-3 text-sm text-[color:var(--color-danger)]"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Required documents ─────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <header>
          <h2 className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            Required documents
          </h2>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            PDF, JPG, or PNG. Max 10 MB per file. The latest upload of
            each kind is what we review.
          </p>
        </header>
        <ul className="flex flex-col gap-3">
          {REQUIRED_DOC_KINDS.map((kind) => (
            <li key={kind}>
              <DocSlot
                kind={kind}
                files={docsByKind.get(kind) ?? []}
                uploading={uploadingKind === kind}
                onPick={(f) => handlePick(kind, f)}
                onDelete={handleDelete}
                disabled={pending}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ── Optional supporting docs ───────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            Other supporting documents (optional)
          </h2>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            Anything else that helps  e.g. an SARB licence for
            financial-services orgs. Up to 3 files.
          </p>
        </header>
        <DocSlot
          kind="other"
          files={docsByKind.get("other") ?? []}
          uploading={uploadingKind === "other"}
          onPick={(f) => handlePick("other", f)}
          onDelete={handleDelete}
          disabled={pending}
          appendOnly
        />
      </section>

      <hr className="hairline" />

      {/* ── Address + VAT ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <header>
          <h2 className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
            Organisation details
          </h2>
          <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
            The physical address on your CIPC / proof-of-address
            document. Helps us match the docs without back-and-forth.
          </p>
        </header>
        <TextareaField
          id="company-address"
          label="Physical address"
          value={companyAddress}
          onChange={(e) => setCompanyAddress(e.target.value)}
          placeholder="Building, street, suburb, city, postal code"
          rows={3}
          maxLength={500}
          required
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="org-city"
            label="Head office city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Cape Town"
            optional
          />
          <TextField
            id="vat-number"
            label="VAT number"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            placeholder="e.g. 4123456789"
            optional
            hint="South African VAT numbers are 10 digits, starting with 4."
          />
        </div>
      </section>

      {/* ── Submit ─────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 border-t border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-5 py-4 md:static md:mx-0 md:flex-row md:items-center md:justify-between md:rounded-[var(--radius-md)] md:border md:bg-[color:var(--color-surface)] md:p-5">
        <p className="text-xs text-[color:var(--color-ink-soft)]">
          {haveAllRequired
            ? "All required documents are in place. Submit when you're ready."
            : `${REQUIRED_DOC_KINDS.length - (docsByKind.size > REQUIRED_DOC_KINDS.length ? REQUIRED_DOC_KINDS.length : Array.from(docsByKind.keys()).filter((k) => REQUIRED_DOC_KINDS.includes(k)).length)} of ${REQUIRED_DOC_KINDS.length} required documents still missing.`}
        </p>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={submitDisabled}
        >
          {pending ? "Submitting" : "Submit for verification"}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DocSlot  one row per document kind.
// ─────────────────────────────────────────────────────────────────────────────

interface DocSlotProps {
  kind: OrgDocumentKind;
  files: OrgDocumentRow[];
  uploading: boolean;
  onPick: (file: File) => void;
  onDelete: (documentId: string) => void;
  disabled?: boolean;
  /** For `other`  show multiple existing files + an add slot. */
  appendOnly?: boolean;
}

function DocSlot({
  kind,
  files,
  uploading,
  onPick,
  onDelete,
  disabled,
  appendOnly,
}: DocSlotProps) {
  const inputId = `doc-${kind}`;
  const haveOne = files.length > 0;
  const showAddSlot = appendOnly || !haveOne;

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm text-[color:var(--color-ink)]">
            {ORG_DOCUMENT_LABEL[kind]}
            {kind !== "other" && (
              <span
                aria-hidden="true"
                className="ml-1 text-[color:var(--color-danger)]"
              >
                *
              </span>
            )}
          </p>
        </div>
        {haveOne && !appendOnly && (
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            On file
          </span>
        )}
      </div>

      {/* Existing files */}
      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2 text-xs"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <FileText
                  className="size-3.5 shrink-0 text-[color:var(--color-ink-soft)]"
                  aria-hidden="true"
                />
                <span className="truncate text-[color:var(--color-ink)]">
                  {f.originalName}
                </span>
                <span className="shrink-0 text-[color:var(--color-ink-soft)]">
                  ({formatBytes(f.sizeBytes)})
                </span>
              </span>
              <button
                type="button"
                onClick={() => onDelete(f.id)}
                disabled={disabled || uploading}
                aria-label={`Remove ${f.originalName}`}
                className="rounded-[var(--radius-pill)] p-1 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-danger)]"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add / replace */}
      {showAddSlot && (
        <div className="mt-3">
          <input
            id={inputId}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(file);
              // Clear the input so picking the same file twice re-triggers.
              e.target.value = "";
            }}
          />
          <label
            htmlFor={inputId}
            className={
              "inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--color-ink)] px-4 text-xs font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)] " +
              (disabled || uploading ? "pointer-events-none opacity-60" : "")
            }
          >
            {uploading ? (
              <>
                <Loader2
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="size-3.5" aria-hidden="true" />
                {haveOne ? "Add another" : "Choose file"}
              </>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
