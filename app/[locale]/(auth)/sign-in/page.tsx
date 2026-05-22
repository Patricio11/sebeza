import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { TextField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Sign in" };

type Role = "seeker" | "employer" | "admin";

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { as } = await searchParams;
  const role = (as === "employer" || as === "admin" ? as : "seeker") as Role;
  const t = await getTranslations("auth");

  const destination =
    role === "employer" ? "/employer" : role === "admin" ? "/admin" : "/dashboard";

  return (
    <AuthShell
      eyebrow={t("signIn.eyebrow")}
      heading={t("signIn.heading")}
      subhead={t("signIn.subhead")}
      rightAside={<SignInDossier />}
    >
      <form
        action={destination}
        method="get"
        className="flex flex-col gap-6"
      >
        <RolePicker active={role} t={t} />

        <TextField
          id="email"
          label={t("common.email")}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.co.za"
        />

        <TextField
          id="password"
          label={t("common.password")}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="inline-flex items-center gap-2 text-[color:var(--color-ink-soft)]">
            <input
              type="checkbox"
              name="remember"
              className="size-4 rounded border-[color:var(--color-hairline)]"
            />
            {t("common.rememberMe")}
          </label>
          <Link
            href="/forgot-password"
            className="text-[color:var(--color-brand)] hover:underline"
          >
            {t("signIn.forgot")}
          </Link>
        </div>

        {(role === "employer" || role === "admin") && (
          <p className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-4 py-3 text-xs text-[color:var(--color-ink-soft)]">
            {t("signIn.twoFactor")}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg">
          {t("signIn.submit")}
        </Button>

        <p className="text-sm text-[color:var(--color-ink-soft)]">
          {t("signIn.noAccount")}{" "}
          <Link
            href="/sign-up"
            className="font-medium text-[color:var(--color-brand)] hover:underline"
          >
            {t("signIn.createOne")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function RolePicker({ active, t }: { active: Role; t: (k: string) => string }) {
  const options: { value: Role; label: string }[] = [
    { value: "seeker", label: t("signIn.asSeeker") },
    { value: "employer", label: t("signIn.asEmployer") },
    { value: "admin", label: t("signIn.asAdmin") },
  ];
  return (
    <div>
      <div className="mb-2 text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
        {t("signIn.rolePicker")}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const isActive = o.value === active;
          return (
            <Link
              key={o.value}
              href={{ pathname: "/sign-in", query: { as: o.value } }}
              className={
                "rounded-[var(--radius-pill)] border px-4 py-1.5 text-sm transition-colors " +
                (isActive
                  ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                  : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)] hover:border-[color:var(--color-ink)]")
              }
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SignInDossier() {
  return (
    <>
      <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
        How sign-in works
      </div>
      <ul className="mt-3 space-y-4 text-sm">
        <DossierItem
          n="01"
          title="Email + password, with OTP"
          body="A one-time code sent to your inbox makes account-takeover much harder. Better Auth handles this in Phase 2."
        />
        <DossierItem
          n="02"
          title="2FA for employers and admins"
          body="Mandatory for accounts that can see contact details or change platform data. TOTP via authenticator app."
        />
        <DossierItem
          n="03"
          title="Every session, audit-logged"
          body="A successful sign-in is itself an audit event. You can revoke devices any time from your account settings."
        />
      </ul>
    </>
  );
}

function DossierItem({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-3">
      <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
        {n}
      </span>
      <div>
        <div className="font-display text-base text-[color:var(--color-ink)]">
          {title}
        </div>
        <p className="text-[color:var(--color-ink-soft)]">{body}</p>
      </div>
    </li>
  );
}
