"use client";

/**
 * Phase 9.17  client island for the employer-side invite form on
 * /employer/invites.
 *
 * Renders four fields:
 *
 *   - Email (required, validated as a syntactically valid email
 *     before submission)
 *   - Full name (optional, ≤120 chars)
 *   - Profession (optional, ComboboxField over the DB-backed
 *     professions catalogue; same picker used on the public sign-up)
 *   - Personal note (optional, ≤200-char textarea; verbatim in the
 *     email body)
 *
 * Submit calls `inviteSeeker`. On success the form clears + a small
 * acknowledgement renders below the button; the parent server
 * component does the actual revalidate so the new row appears in the
 * "Pending" list. On D4 dedupe / D7 rate-limit / cooldown blocks, the
 * server returns `{ ok: false, message }` which renders inline.
 */

import { useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { TextField } from "@/components/ui/FormField";
import { ComboboxField } from "@/components/ui/ComboboxField";
import { Button } from "@/components/ui/Button";
import { inviteSeeker } from "@/lib/employer/seeker-invitations";

interface ProfessionOption {
  slug: string;
  label: string;
}

interface Props {
  professions: ProfessionOption[];
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function InviteSeekerForm({ professions }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [profession, setProfession] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setEmail("");
    setName("");
    setProfession("");
    setNote("");
  }

  function valid() {
    return EMAIL_RE.test(email.trim());
  }

  function onSubmit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await inviteSeeker({
        email: email.trim(),
        name: name.trim() || undefined,
        profession: profession.trim() || undefined,
        personalNote: note.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const sentTo = email.trim();
      reset();
      setSuccess(`Invitation sent to ${sentTo}.`);
    });
  }

  return (
    <section
      aria-labelledby="invite-form-heading"
      className="rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-5"
    >
      <header className="mb-4">
        <h2
          id="invite-form-heading"
          className="font-display text-xl text-[color:var(--color-ink)]"
        >
          Invite a candidate
        </h2>
        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
          Send a single Civic-Editorial-styled email. The recipient lands
          on a tailored sign-up page; once they finish, you'll see them on
          your Joined list and can extend a vacancy invitation from there.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="invite-email"
          label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="off"
          required
          disabled={pending}
          hint="The only required field. We'll send the invitation here."
        />
        <TextField
          id="invite-name"
          label="Full name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          disabled={pending}
          hint="Pre-fills their sign-up form. They can edit it."
        />
      </div>

      <div className="mt-4">
        <ComboboxField
          id="invite-profession"
          label="Profession (optional)"
          value={profession}
          onChange={setProfession}
          options={professions.map((p) => ({ value: p.label }))}
          placeholder="Search professions…"
          helpText="Suggests a profession on their sign-up form."
          disabled={pending}
        />
      </div>

      <div className="mt-4">
        <label className="block">
          <span className="block text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
            Personal note (optional, max 200 chars)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            rows={3}
            maxLength={200}
            placeholder="e.g. We worked together at the BNG project  please confirm so I can put you forward for the next contract."
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-3 py-2.5 text-sm text-[color:var(--color-ink)] outline-none transition-colors focus:border-[color:var(--color-ink)] focus:ring-2 focus:ring-[color:var(--color-brand)]/30"
            disabled={pending}
          />
          <p className="mt-1 text-[0.7rem] text-[color:var(--color-ink-soft)]">
            {note.length}/200. Rendered verbatim in the email + flagged
            as personal information in your org's audit log.
          </p>
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-[color:var(--color-brand-strong)]">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {success}
        </p>
      )}

      <div className="mt-4">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onSubmit}
          disabled={pending || !valid()}
        >
          <Send className="size-4" aria-hidden="true" />
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    </section>
  );
}
