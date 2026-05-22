"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { revokeConsent, regrantConsent } from "@/lib/auth/actions";
import type { ConsentPurpose, ConsentState } from "@/lib/consent";

interface Props {
  purpose: ConsentPurpose;
  label: string;
  body: string;
  initialState: ConsentState;
  grantedAt: string | null;
  version: string;
}

export function ConsentRow({
  purpose,
  label,
  body,
  initialState,
  grantedAt,
  version,
}: Props) {
  const t = useTranslations("seekerDash.privacy");
  const [state, setState] = useState<ConsentState>(initialState);
  const [pending, startTransition] = useTransition();
  const granted = state === "granted";

  function onToggle() {
    startTransition(async () => {
      const result = granted
        ? await revokeConsent(purpose)
        : await regrantConsent(purpose);
      if (result.ok) {
        setState(granted ? "revoked" : "granted");
      }
    });
  }

  return (
    <li className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-display text-lg">{label}</span>
          <span
            className={
              "rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] " +
              (granted
                ? "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                : "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]")
            }
          >
            {granted ? "Active" : state === "revoked" ? "Revoked" : "Not granted"}
          </span>
        </div>
        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{body}</p>
        {granted && grantedAt && (
          <p className="mt-2 text-xs text-[color:var(--color-ink-soft)]">
            {t("granted", { date: grantedAt })} · {t("version", { v: version })}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant={granted ? "secondary" : "primary"}
        size="sm"
        onClick={onToggle}
        disabled={pending}
      >
        {pending ? "…" : granted ? t("revoke") : "Re-grant"}
      </Button>
    </li>
  );
}
