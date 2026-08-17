"use client";

/**
 * "Invite administrator" (2026-08 account directory). Admin accounts are
 * issued, never self-registered; seekers and employers always come through
 * their own consent-first sign-up flows, so this dialog creates admins
 * ONLY and says so. The invitee receives a set-password email and the
 * forced-2FA gate enrols them on first sign-in.
 */

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { UserPlus } from "lucide-react";
import { BrandDialog } from "@/components/ui/BrandDialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { createAdminAccount } from "@/lib/admin/user-accounts";

export function CreateAdminDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAdminAccount({ fullName, email });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  function close() {
    setOpen(false);
    setDone(false);
    setFullName("");
    setEmail("");
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-4 text-sm font-medium text-[color:var(--color-ink)] transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
      >
        <UserPlus className="size-4" aria-hidden="true" />
        Invite administrator
      </button>

      <BrandDialog
        open={open}
        onClose={close}
        eyebrow="Account directory"
        title={done ? "Invitation sent" : "Invite an administrator"}
        pending={pending}
      >
        {done ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
              <span className="font-medium text-[color:var(--color-ink)]">{email}</span>{" "}
              now has an administrator account and a set-password email is on
              its way. On first sign-in they will be walked through two-factor
              setup before they can touch anything.
            </p>
            <Button type="button" variant="primary" size="md" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <p className="text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
              Administrator accounts are issued, never self-registered. Job
              seekers and employers always register themselves: their sign-up
              is a POPIA consent step nobody can perform on their behalf.
            </p>
            <TextField
              id="new-admin-name"
              label="Full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={pending}
            />
            <TextField
              id="new-admin-email"
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
            {error && (
              <p
                role="alert"
                className="rounded-[var(--radius-sm)] border border-[color:var(--color-danger)] bg-white px-3 py-2 text-sm text-[color:var(--color-danger)]"
              >
                {error}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" size="md" disabled={pending}>
                {pending ? "Creating…" : "Create & send invitation"}
              </Button>
              <Button type="button" variant="ghost" size="md" onClick={close} disabled={pending}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </BrandDialog>
    </>
  );
}
