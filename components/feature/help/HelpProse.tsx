/**
 * Phase 10.1  typography components for help-center articles.
 *
 * One file so authors importing into an article get everything from
 * a single line. Civic-editorial bar applied throughout: Fraunces on
 * headings, generous line-height + paragraph spacing, max 65ch body
 * width on the article page (set on the parent  this file is
 * width-agnostic).
 *
 * Components exported:
 *
 *   <HelpProse>     wraps the article body; applies typography
 *   <Callout>       info / warning / tip emphasis blocks
 *   <Steps>         numbered procedure list (just an <ol> with
 *                    styling; semantic)
 *   <Step>          individual step row (use inside <Steps>)
 *   <HelpKey>       inline keyboard shortcut chip
 *   <DashboardLink> "Try it now " CTA pointing into the app
 *
 * Articles import only what they use; tree-shaking strips the rest.
 */

import { Link } from "@/i18n/navigation";
import { ArrowRight, Info, AlertTriangle, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";

interface HelpProseProps {
  children: ReactNode;
}

/**
 * Article body wrapper. Children are plain HTML semantic elements
 * (`<p>`, `<h2>`, `<ul>` etc.); we style them with `[&_p]:` etc. so
 * authors don't have to import a custom `<P>` for every paragraph.
 * That keeps article files readable + close to plain prose.
 */
export function HelpProse({ children }: HelpProseProps) {
  return (
    <div
      className={
        // No max-width here  the surrounding article card constrains
        // the reading column at the page level. Keeping the cap on
        // HelpProse AND on the card double-constrains + leaves the
        // ugly right gutter visible.
        "[&_p]:my-4 [&_p]:text-[0.95rem] [&_p]:leading-relaxed [&_p]:text-[color:var(--color-ink)] " +
        "[&_h2]:font-display [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[color:var(--color-ink)] [&_h2]:tracking-tight " +
        "[&_h3]:font-display [&_h3]:text-lg [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-[color:var(--color-ink)] " +
        "[&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:text-[0.95rem] [&_ul]:leading-relaxed " +
        "[&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:text-[0.95rem] [&_ol]:leading-relaxed " +
        "[&_li]:my-1.5 [&_li]:text-[color:var(--color-ink)] " +
        "[&_strong]:font-semibold [&_strong]:text-[color:var(--color-ink)] " +
        "[&_em]:italic " +
        "[&_a]:text-[color:var(--color-brand-strong)] [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-[color:var(--color-ink)] " +
        "[&_hr]:my-8 [&_hr]:border-[color:var(--color-hairline)]"
      }
    >
      {children}
    </div>
  );
}

interface CalloutProps {
  type?: "info" | "warning" | "tip";
  title?: string;
  children: ReactNode;
}

/**
 * Emphasis block for important context inline in an article. Tone
 * carries a deliberate posture:
 *
 *   info       neutral; "here's how this works in practice"
 *   warning    yellow; "be careful  this is irreversible / costs
 *               something / is easy to misread"
 *   tip        green; "here's a faster path you might not know about"
 *
 * Title is optional; when omitted the icon + tone class is the only
 * signal that this is a callout.
 */
export function Callout({ type = "info", title, children }: CalloutProps) {
  const config = {
    info: {
      Icon: Info,
      tone: "border-[color:var(--color-hairline)] bg-[color:var(--color-paper)]",
      iconClass: "text-[color:var(--color-ink-soft)]",
    },
    warning: {
      Icon: AlertTriangle,
      tone: "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/5",
      iconClass: "text-[color:var(--color-accent)]",
    },
    tip: {
      Icon: Lightbulb,
      tone: "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]",
      iconClass: "text-[color:var(--color-brand-strong)]",
    },
  }[type];
  const Icon = config.Icon;
  return (
    <aside
      className={`my-5 flex items-start gap-3 rounded-[var(--radius-sm)] border-l-4 ${config.tone} px-4 py-3`}
    >
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${config.iconClass}`}
        aria-hidden="true"
      />
      <div className="flex-1 text-[0.92rem] leading-relaxed text-[color:var(--color-ink)] [&_p]:m-0">
        {title && (
          <p className="mb-1 font-display text-[1rem] font-semibold">
            {title}
          </p>
        )}
        {children}
      </div>
    </aside>
  );
}

interface StepsProps {
  children: ReactNode;
}

/** Numbered procedure list wrapper. Inside, use `<Step>` rows. */
export function Steps({ children }: StepsProps) {
  return (
    <ol className="my-5 space-y-3 [&>li]:flex [&>li]:items-start [&>li]:gap-3 list-none pl-0">
      {children}
    </ol>
  );
}

interface StepProps {
  number: number;
  children: ReactNode;
}

/**
 * Single numbered step. Author passes the number explicitly so
 * skipping a step or restarting the count is clear in source. The
 * step body can be any inline content (`<>...</>` is fine).
 */
export function Step({ number, children }: StepProps) {
  return (
    <li>
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-ink)] font-display text-sm text-[color:var(--color-paper)]"
      >
        {number}
      </span>
      <div className="flex-1 text-[0.95rem] leading-relaxed text-[color:var(--color-ink)] [&_p]:m-0">
        {children}
      </div>
    </li>
  );
}

interface HelpKeyProps {
  children: ReactNode;
}

/** Inline keyboard-shortcut chip. Use sparingly. */
export function HelpKey({ children }: HelpKeyProps) {
  return (
    <kbd className="mx-0.5 inline-flex h-5 items-center rounded border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-1.5 font-mono text-[0.72rem] text-[color:var(--color-ink)]">
      {children}
    </kbd>
  );
}

interface DashboardLinkProps {
  href: string;
  children: ReactNode;
}

/**
 * "Try it now " CTA. Drops the user from the article straight into
 * the relevant dashboard surface. Visually distinct from regular
 * underline links so the deep-link affordance is obvious  it's the
 * call-to-action of the article, not a footnote.
 */
export function DashboardLink({ href, children }: DashboardLinkProps) {
  return (
    <Link
      href={href as never}
      className="my-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] no-underline transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
    >
      {children}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}
