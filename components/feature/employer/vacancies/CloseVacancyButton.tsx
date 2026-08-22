"use client";

/**
 * Close-vacancy lifecycle action with a proper confirmation (2026-08-22,
 * founder request). Closing stops new invitations and takes the role
 * off every seeker-facing surface, so it deserves a BrandDialog that
 * says exactly that instead of firing on a stray tap. Reopening stays
 * a plain button on the page: it is the undo, not the decision.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { BrandDialog } from "@/components/ui/BrandDialog";
import { Button } from "@/components/ui/Button";
import { Archive } from "lucide-react";

interface Props {
  vacancyTitle: string;
  /** Count of invitations still awaiting a reply, stated honestly in
   *  the dialog so the employer knows who is left hanging. */
  pendingCount: number;
  label: string;
  action: () => Promise<void>;
}

export function CloseVacancyButton({ vacancyTitle, pendingCount, label, action }: Props) {
  const t = useTranslations("employerVacancies.closeConfirm");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await action();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <BrandDialog
        open={open}
        onClose={() => setOpen(false)}
        pending={pending}
        eyebrow={t("eyebrow")}
        title={t("title", { vacancyTitle })}
        maxWidth="md"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={confirm} disabled={pending}>
              <Archive className="size-4" aria-hidden="true" />
              {pending ? t("closing") : t("confirm")}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-[color:var(--color-ink)]">
          <p>{t("body")}</p>
          {pendingCount > 0 && (
            <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-3 py-2 text-xs">
              {t("pendingWarning", { count: pendingCount })}
            </p>
          )}
          <p className="text-xs text-[color:var(--color-ink-soft)]">{t("reversible")}</p>
        </div>
      </BrandDialog>
    </>
  );
}
