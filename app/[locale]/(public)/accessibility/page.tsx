import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SAChevron } from "@/components/ui/SAChevron";

export const metadata = {
  title: "Accessibility",
  description:
    "Sebenza's accessibility commitment: WCAG 2.2 AA, low-data by design, and how to reach us when something doesn't work for you.",
};

/**
 * Accessibility statement (2026-07-02  see
 * docs/ACCESSIBILITY_PAGE_PLAN.md).
 *
 * Fixes the last dead footer link: SiteFooter has pointed at
 * /accessibility since Phase 9 without the route existing (the /terms
 * sibling was fixed the same day).
 *
 * Every claim below is sourced from docs/A11Y_AUDIT.md  the page
 * REPORTS the audited posture, it doesn't invent one. Known
 * limitations are stated honestly per the platform's
 * Verification-Honesty ethos; update this page when the audit doc
 * materially changes.
 */
export default async function AccessibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lastUpdated = "2026-07-02";

  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-[color:var(--color-paper)]">
        <header className="border-b-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] py-12 md:py-16">
          <div className="mx-auto max-w-[820px] px-6">
            <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-brand-strong)]">
              <SAChevron variant="mark" className="size-3" />
              Access · WCAG 2.2 AA
            </div>
            <h1 className="mt-3 font-display text-5xl leading-tight md:text-6xl">
              Accessibility
            </h1>
            <p className="mt-3 text-[color:var(--color-ink-soft)]">
              Last updated <time dateTime={lastUpdated}>{lastUpdated}</time>.
              A national platform has to work for the whole nation  this
              page describes what we&rsquo;ve built, what&rsquo;s still in
              progress, and how to tell us when something doesn&rsquo;t
              work for you.
            </p>
          </div>
        </header>

        <article className="mx-auto max-w-[820px] px-6 py-12 md:py-16">
          <Section title="1. Our commitment">
            <p>
              Sebenza targets <strong>WCAG 2.2 Level AA</strong> across
              every surface  public pages, seeker and employer
              dashboards, and the government analytics portal.
              Accessibility is one of the platform&rsquo;s founding rules,
              not a retrofit: every page is designed to be usable on a
              low-end Android phone over a 3G connection, with keyboard
              and screen-reader access as the default, never an add-on.
            </p>
          </Section>

          <Section title="2. What we've built">
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                <strong>Keyboard access everywhere.</strong> Every
                interactive control  including our custom dropdowns,
                date pickers, and multi-select fields  works with a
                keyboard alone, with visible focus indicators throughout.
              </li>
              <li>
                <strong>Skip links + landmarks.</strong> Every page
                carries a &ldquo;skip to main content&rdquo; link and a
                proper landmark structure so screen-reader users
                aren&rsquo;t forced through navigation on every page.
              </li>
              <li>
                <strong>Labelled forms.</strong> Every input routes
                through labelled form components  no unlabelled fields.
              </li>
              <li>
                <strong>Reduced motion respected.</strong> The little
                animation we use (we deliberately use very little)
                switches off when your device asks for reduced motion.
              </li>
              <li>
                <strong>Readable contrast.</strong> Our text palette
                clears the 4.5:1 contrast floor; accent colours are
                reserved for non-text emphasis.
              </li>
              <li>
                <strong>Small screens first.</strong> Layouts are designed
                at 360px width first and tested there; nothing essential
                is hidden on a phone.
              </li>
              <li>
                <strong>Low-data by design.</strong> Pages stay light
                (no video backgrounds, no heavy animation), and a
                data-saver mode trims images further on metered
                connections.
              </li>
              <li>
                <strong>Language.</strong> Pages declare their language
                per locale so screen readers pronounce content correctly.
              </li>
            </ul>
          </Section>

          <Section title="3. Known limitations">
            <p>
              Honesty is a platform rule, so here is what&rsquo;s not
              finished:
            </p>
            <ul className="my-4 list-disc pl-6 space-y-2">
              <li>
                Our accessibility testing currently combines automated
                static checks with manual keyboard and screen-reader
                passes; a fully automated in-browser test suite is on our
                roadmap.
              </li>
              <li>
                The interface is currently English-first. isiZulu,
                isiXhosa, and Afrikaans are being professionally
                translated (never machine-translated for legal and
                consent copy); further official languages follow.
              </li>
              <li>
                Some older PDF-style exports (e.g. printable policy
                briefs) may not yet be fully screen-reader optimised.
              </li>
            </ul>
          </Section>

          <Section title="4. Tell us when something doesn't work">
            <p>
              If any part of Sebenza is hard or impossible for you to
              use  with a screen reader, keyboard, switch device,
              magnification, or anything else  we want to know. Email{" "}
              <a href="mailto:popia@sebenzasa.com" className="underline">
                popia@sebenzasa.com
              </a>{" "}
              with the page and what happened. Accessibility reports are
              treated as defects, not feedback  they get fixed, not
              filed.
            </p>
          </Section>

          <Section title="5. Review">
            <p>
              This statement is reviewed alongside our internal
              accessibility audit and updated whenever the platform&rsquo;s
              accessibility posture materially changes.
            </p>
          </Section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-2xl">
        {title}
      </h2>
      <div className="prose prose-sm max-w-none text-[color:var(--color-ink)] [&_p]:my-3 [&_p]:text-base [&_p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}
