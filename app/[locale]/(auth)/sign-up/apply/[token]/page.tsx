/**
 * Phase 34 - Self Apply sign-up landing
 * (docs/PHASE_34_SELF_APPLY_PLAN.md §34.6).
 *
 * URL: /sign-up/apply/[token]  where an anonymous visitor lands after
 * tapping "Apply now" on a public vacancy page.
 *
 * Server-component flow:
 *   1. Load the vacancy's public subset by token (flag + toggle +
 *      open status all re-checked). Any miss renders calm fallback
 *      copy + the plain sign-up path - the ACCOUNT matters more than
 *      the application, so a dead link never dead-ends a willing
 *      sign-up.
 *   2. Pass `applyContext` into <SeekerSignUpForm>: profession +
 *      province pre-fill from the vacancy (editable), step 3 gains the
 *      vacancy's skills as one-tap chips, submit records the
 *      application AT SIGN-UP, success pauses on the congrats dialog
 *      before /verify-email.
 *
 * The vacancy context card (right aside) keeps the role in view the
 * whole way - the seeker never forgets what they're applying for.
 */

import { setRequestLocale, getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { SeekerSignUpForm } from "@/components/feature/auth/SeekerSignUpForm";
import { getProfessions } from "@/lib/taxonomy/query";
import {
  getPublicVacancyByToken,
  type PublicVacancy,
} from "@/lib/vacancy/public";
import { findProvinceBySlug } from "@/lib/mock/taxonomy";

export const metadata = {
  title: "Apply on Sebenza",
  robots: { index: false, follow: false },
};

export default async function ApplySignUpPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.seekerSignUp");

  const result = await getPublicVacancyByToken(token);
  const professions = await getProfessions();

  if (!result.ok) {
    // Dead link - same calm copy as /apply/[token], but the sign-up
    // form stays: turning a dead vacancy link into a live profile is
    // strictly better than a dead end.
    return (
      <AuthShell
        eyebrow="Open role"
        heading="This role isn't accepting applications"
        subhead="The link may have been switched off or the vacancy filled. You can still create your free Sebenza profile. It makes you findable for every open role on the platform."
        rightAside={<ApplyDossier vacancy={null} />}
      >
        <SeekerSignUpForm professions={professions} />
      </AuthShell>
    );
  }

  const vacancy = result.vacancy;
  const provinceLabel = vacancy.provinceSlug
    ? (findProvinceBySlug(vacancy.provinceSlug)?.label ?? null)
    : null;

  return (
    <AuthShell
      eyebrow={`Applying · ${vacancy.orgName}`}
      heading={t("step1.heading")}
      subhead={`You're applying for ${vacancy.title} at ${vacancy.orgName}. Create your free profile. It becomes your application.`}
      rightAside={<ApplyDossier vacancy={vacancy} />}
    >
      <SeekerSignUpForm
        professions={professions}
        applyContext={{
          token,
          vacancyTitle: vacancy.title,
          orgName: vacancy.orgName,
          prefilledProfession: vacancy.professionLabel,
          prefilledProvince: provinceLabel,
          skills: vacancy.skills,
        }}
      />
    </AuthShell>
  );
}

/**
 * Right-aside vacancy context card - the role stays in view through
 * all three sign-up steps.
 */
function ApplyDossier({ vacancy }: { vacancy: PublicVacancy | null }) {
  if (!vacancy) {
    return (
      <>
        <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
          Why create a profile anyway?
        </div>
        <ul className="mt-3 space-y-4 text-sm">
          {[
            {
              n: "01",
              title: "One profile, every role",
              body: "Verified employers across all nine provinces search Sebenza daily. A single profile keeps you findable for all of them, not just the link that brought you here.",
            },
            {
              n: "02",
              title: "Free, and yours",
              body: "No fees, ever. You control what's visible, which consents you grant, and you can pause or leave any time.",
            },
          ].map((item) => (
            <li
              key={item.n}
              className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-3"
            >
              <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
                {item.n}
              </span>
              <div>
                <div className="font-display text-base">{item.title}</div>
                <p className="text-[color:var(--color-ink-soft)]">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
        You&rsquo;re applying for
      </div>
      <div className="mt-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
        <div className="font-display text-xl leading-snug text-[color:var(--color-ink)]">
          {vacancy.title}
        </div>
        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
          {vacancy.orgName} · {vacancy.locationLabel}
        </p>
        {vacancy.skills.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {vacancy.skills.slice(0, 6).map((s) => (
              <li
                key={s.slug}
                className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 py-0.5 text-[0.7rem] text-[color:var(--color-ink-soft)]"
              >
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ul className="mt-5 space-y-4 text-sm">
        {[
          {
            n: "01",
            title: "Your profile IS the application",
            body: `Finish these three steps and your application lands with ${vacancy.orgName} immediately, then verify your email and keep building your profile.`,
          },
          {
            n: "02",
            title: "One profile, every role",
            body: "The same profile keeps you findable for every verified employer on the national platform, not just this one.",
          },
        ].map((item) => (
          <li
            key={item.n}
            className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-dashed border-[color:var(--color-hairline)] pb-3"
          >
            <span className="font-display text-2xl italic text-[color:var(--color-accent)]">
              {item.n}
            </span>
            <div>
              <div className="font-display text-base">{item.title}</div>
              <p className="text-[color:var(--color-ink-soft)]">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
