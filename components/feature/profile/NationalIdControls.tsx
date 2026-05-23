"use client";

/**
 * National ID controls  Phase 3 re-check #3.
 *
 * Rules:
 *  - The ID is encrypted at rest (AES-GCM) and NEVER echoed back, not even
 *    a last-4 hint.
 *  - Showing "ID on file · encrypted" is the most we expose.
 *  - "Change ID number" reveals a single field (client-side SA ID validation
 *    + server-side checksum + re-encryption).
 *  - Removing the ID is allowed but warned  verification cannot proceed
 *    without an ID on file.
 */

import { useState, useTransition } from "react";
import { TextField, EncryptedBadge } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Lock, Pencil, Trash2, X } from "lucide-react";
import { changeNationalId, removeNationalId } from "@/lib/profile/actions";
import { validateSaIdNumber } from "@/lib/id-number";

interface Props {
  hasNationalId: boolean;
}

type Mode = "view" | "change" | "confirm-remove";

export function NationalIdControls({ hasNationalId }: Props) {
  const [mode, setMode] = useState<Mode>("view");
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasOnFile, setHasOnFile] = useState(hasNationalId);

  function handleSave() {
    setError(null);
    const v = validateSaIdNumber(value);
    if (!v.ok) {
      setError(
        v.reason === "wrong_length"
          ? "An SA ID number is 13 digits."
          : v.reason === "not_digits"
            ? "Only digits, please."
            : v.reason === "bad_checksum"
              ? "Checksum doesn't match  double-check the number."
              : "That doesn't look like a valid SA ID number.",
      );
      return;
    }
    startTransition(async () => {
      const r = await changeNationalId({ idNumber: v.normalised });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setMode("view");
      setValue("");
      setHasOnFile(true);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const r = await removeNationalId();
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setMode("view");
      setHasOnFile(false);
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
          National ID
        </div>
        <EncryptedBadge>POPIA · special category</EncryptedBadge>
      </div>

      {mode === "view" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="size-4 text-[color:var(--color-brand)]" aria-hidden="true" />
            {hasOnFile ? (
              <span>
                ID number on file · <span className="text-[color:var(--color-ink-soft)]">encrypted, never shown back</span>
              </span>
            ) : (
              <span className="text-[color:var(--color-ink-soft)]">
                No ID on file  verification cannot proceed until one is captured.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setMode("change")}
            >
              <Pencil className="size-4" aria-hidden="true" />
              {hasOnFile ? "Change" : "Add"}
            </Button>
            {hasOnFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode("confirm-remove")}
                className="text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)] hover:text-white"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
        </div>
      )}

      {mode === "change" && (
        <div className="space-y-3">
          <TextField
            id="new-national-id"
            label={hasOnFile ? "New ID number" : "ID number"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={13}
            placeholder="13 digits"
            error={error ?? undefined}
            hint="Validated against the SA ID checksum. Encrypted before save. Never echoed back."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={pending || value.replace(/\s+/g, "").length !== 13}
            >
              {pending ? "Encrypting…" : "Save & encrypt"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode("view");
                setValue("");
                setError(null);
              }}
              disabled={pending}
            >
              <X className="size-4" aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "confirm-remove" && (
        <div className="space-y-3">
          <p className="text-sm">
            Remove the ID on file?{" "}
            <span className="text-[color:var(--color-ink-soft)]">
              You can add one back later, but verification flows pause until you do.
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={pending}
              className="border border-[color:var(--color-danger)] text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)] hover:text-white"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {pending ? "Removing…" : "Yes, remove"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode("view")}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
          {error && <p className="text-xs text-[color:var(--color-danger)]">{error}</p>}
        </div>
      )}
    </div>
  );
}
