"use client";

/**
 * Phase 11.5.2  personal CV backup editor.
 *
 * Two visual states:
 *   - empty   "Upload a PDF" button + privacy explainer
 *   - present filename · uploaded date · Download / Replace / Delete
 *
 * Privacy posture is foregrounded in copy: this is the seeker's own
 * artefact + we never expose it to employers (D3). The empty-state
 * explainer makes that contract explicit.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import {
  uploadCv,
  downloadCv,
  deleteCv,
} from "@/lib/profile/cv";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  RefreshCcw,
  Trash2,
  Upload,
} from "lucide-react";

interface Props {
  filename: string | null;
  uploadedAt: string | null;
  locale: string;
}

const MAX_BYTES = 5 * 1024 * 1024;

export function CvBackupEditor({ filename, uploadedAt, locale }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  function pickFile() {
    setError(null);
    fileInputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("CV must be a PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("CV is larger than 5 MB.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("filename", file.name);
    startTransition(async () => {
      const res = await uploadCv(form);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
    // Reset the input so re-selecting the same file fires the change.
    e.target.value = "";
  }

  function onDownload() {
    setError(null);
    startTransition(async () => {
      const res = await downloadCv();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // Use a transient <a download> click  works without popup
      // blocker for same-tab navigations.
      const a = document.createElement("a");
      a.href = res.url;
      a.download = res.filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  function onDelete() {
    if (!confirm("Delete your CV backup? You can re-upload any time.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCv();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  if (!filename) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
        <div className="flex items-start gap-3">
          <FileText
            className="mt-0.5 size-5 shrink-0 text-[color:var(--color-ink-soft)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm text-[color:var(--color-ink)]">
              Upload a PDF of your CV. It stays <strong>private to you</strong>
                we don&rsquo;t share it with employers and never index it for
              search. It&rsquo;s your backup copy.
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={pickFile}
                disabled={pending}
              >
                <Upload className="mr-1.5 size-3.5" aria-hidden="true" />
                {pending ? "Uploading" : "Upload CV (PDF, max 5 MB)"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={onFileSelected}
                hidden
              />
            </div>
            {error && (
              <p
                role="alert"
                className="mt-2 flex items-start gap-2 text-xs text-[color:var(--color-danger)]"
              >
                <AlertTriangle
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5">
      <div className="flex flex-wrap items-start gap-3">
        <CheckCircle2
          className="mt-0.5 size-5 shrink-0 text-[color:var(--color-brand-strong)]"
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="font-display text-base text-[color:var(--color-ink)]">
            {filename}
          </p>
          {uploadedAt && (
            <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">
              Uploaded {fmt.format(new Date(uploadedAt))} · Private to you
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onDownload}
          disabled={pending}
        >
          <Download className="mr-1.5 size-3.5" aria-hidden="true" />
          Download
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={pickFile}
          disabled={pending}
        >
          <RefreshCcw className="mr-1.5 size-3.5" aria-hidden="true" />
          Replace
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" />
          Delete
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={onFileSelected}
          hidden
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 flex items-start gap-2 text-xs text-[color:var(--color-danger)]"
        >
          <AlertTriangle
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
