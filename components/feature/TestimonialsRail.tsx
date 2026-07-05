/**
 * Phase 24  the landing testimonials rail. Renders ONLY approved, consented
 * quotes from the DB (the fabricated cards Phase 23.2 removed lived here);
 * zero approved → renders nothing. Quotes are labelled as what they are
 * words from users, not placement claims.
 *
 * Server component; matches the landing's Mzansi-National visual language.
 */

import { Quote } from "lucide-react";
import { SAChevron } from "@/components/ui/SAChevron";
import { listApprovedTestimonials } from "@/lib/testimonials";

const INITIAL_STYLES = [
  { bg: "var(--color-sa-green)", fg: "var(--color-sa-cream)" },
  { bg: "var(--color-sa-gold)", fg: "var(--color-sa-charcoal)" },
  { bg: "var(--color-sa-charcoal)", fg: "var(--color-sa-gold)" },
];

export async function TestimonialsRail() {
  const testimonials = await listApprovedTestimonials();
  if (testimonials.length === 0) return null;

  return (
    <section
      aria-labelledby="testimonials-h"
      className="bg-[color:var(--color-sa-cream)] py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <header className="mb-12 grid items-end gap-6 md:mb-16 md:grid-cols-[2fr_1fr]">
          <div>
            <div className="flex items-center gap-3 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-sa-green-deep)]">
              <SAChevron variant="mark" className="size-3" />
              In their words
            </div>
            <h2
              id="testimonials-h"
              className="mt-3 font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] tracking-[-0.02em]"
            >
              Real users.
              <br />
              <span className="italic text-[color:var(--color-sa-green-deep)]">
                Their own words.
              </span>
            </h2>
          </div>
          <p className="text-[color:var(--color-ink-soft)]">
            Shared by seekers and employers on Sebenza, shown with their
            explicit consent and reviewed by our team. First names only
            never contact details.
          </p>
        </header>

        <ul className="grid gap-6 md:grid-cols-3">
          {testimonials.slice(0, 3).map((t, i) => {
            const style = INITIAL_STYLES[i % INITIAL_STYLES.length]!;
            return (
              <li
                key={t.id}
                className="group relative flex flex-col gap-5 rounded-2xl border border-[color:var(--color-sa-charcoal)]/10 bg-white p-7 transition-transform hover:-translate-y-1 hover:shadow-press md:p-8"
              >
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-14 items-center justify-center rounded-full font-display text-2xl"
                    style={{ background: style.bg, color: style.fg }}
                  >
                    {t.displayName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="font-display text-lg leading-tight">
                      {t.displayName}
                    </div>
                    <div className="text-sm text-[color:var(--color-ink-soft)]">
                      {t.displayContext}
                    </div>
                  </div>
                </div>

                <blockquote className="border-l-2 border-[color:var(--color-sa-gold)] pl-4 text-[color:var(--color-sa-charcoal)]">
                  <p className="font-display text-lg italic leading-snug">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </blockquote>

                <div className="mt-auto flex items-center gap-2 border-t border-dashed border-[color:var(--color-sa-charcoal)]/15 pt-4 text-[0.66rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  <Quote className="size-3.5" aria-hidden="true" />
                  Shared with consent ·{" "}
                  {t.authorRole === "employer" ? "Employer" : "Job seeker"}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
