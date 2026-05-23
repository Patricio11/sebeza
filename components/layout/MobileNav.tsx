"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/feature/LocaleSwitcher";
import { SAChevron } from "@/components/ui/SAChevron";
import { SebenzaLogo } from "@/components/ui/SebenzaLogo";
import { Menu, X } from "lucide-react";

/**
 * Mobile navigation drawer.
 *
 * Renders only on `<md`. The drawer is built as a fullscreen panel that
 * slides up from the bottom edge  far more thumb-reachable than a top-down
 * hamburger drawer, especially on tall Android phones. Body scroll is locked
 * while it's open; the X closes it; tapping outside closes it; pressing Esc
 * closes it. Honours `prefers-reduced-motion` via the global CSS rule.
 *
 * Used by both `SiteHeader` (internal pages) and `LandingHeader` (the landing).
 */
export function MobileNav({
  tone = "default",
}: {
  /** "default" matches the SiteHeader's ink-on-paper trigger; "hero" matches the LandingHeader's transparent overlay. */
  tone?: "default" | "hero";
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close drawer on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const triggerClass =
    tone === "hero"
      ? "inline-flex size-11 items-center justify-center rounded-full border border-[color:var(--color-sa-charcoal)]/15 bg-white/80 text-[color:var(--color-sa-charcoal)] backdrop-blur md:hidden"
      : "inline-flex size-11 items-center justify-center rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)] md:hidden";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("menu")}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={triggerClass}
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("menu")}
          className="fixed inset-0 z-50 flex flex-col md:hidden"
        >
          {/* Scrim */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[color:var(--color-ink)]/40 anim-fade"
          />

          {/* Panel  full screen on small phones, comfortable on larger */}
          <div className="relative ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto bg-[color:var(--color-paper)] anim-rise-soft">
            {/* Top flag stripe inside drawer */}
            <div aria-hidden="true" className="flex h-[3px] w-full shrink-0">
              <div className="flex-[3] bg-[color:var(--color-brand)]" />
              <div className="flex-[2] bg-[color:var(--color-accent)]" />
              <div className="flex-[1] bg-[color:var(--color-danger)]" />
            </div>

            {/* Header row */}
            <div className="flex items-center justify-between px-5 py-4">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                aria-label="Sebenza  home"
                className="flex items-center"
              >
                <SebenzaLogo width={130} />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex size-11 items-center justify-center rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {/* Editorial eyebrow */}
            <div className="px-5">
              <div className="flex items-center gap-2 border-b border-[color:var(--color-hairline)] pb-3 text-[0.62rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
                <SAChevron variant="mark" className="size-2.5" />
                Navigate
              </div>
            </div>

            {/* Nav links  big, thumb-sized */}
            <nav
              aria-label="Primary"
              className="flex-1 overflow-y-auto px-5 py-2"
            >
              <ul className="divide-y divide-[color:var(--color-hairline)]">
                <DrawerLink
                  href="/search"
                  label={t("findTalent")}
                  hint="Browse the live talent register"
                />
                <DrawerLink
                  href="/insights"
                  label={t("insights")}
                  hint="National employment bulletin"
                />
                <DrawerLink
                  href="/dashboard"
                  label={t("createProfile")}
                  hint="Get found for the work you do"
                />
              </ul>
            </nav>

            {/* Auth actions  large, thumb-sized */}
            <div className="flex flex-col gap-3 border-t border-[color:var(--color-hairline)] px-5 py-5">
              <Link
                href="/sign-up"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--color-ink)] px-6 py-4 text-base font-medium text-[color:var(--color-paper)] shadow-press"
              >
                {t("signUp")}
                <span aria-hidden="true">↗</span>
              </Link>
              <Link
                href="/sign-in"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center rounded-full border border-[color:var(--color-ink)] px-6 py-4 text-base font-medium text-[color:var(--color-ink)]"
              >
                {t("signIn")}
              </Link>
            </div>

            {/* Footer band  locale + trust strip */}
            <div className="border-t border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <LocaleSwitcher />
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                <li>POPIA-first</li>
                <li aria-hidden="true">·</li>
                <li>WCAG 2.2 AA</li>
                <li aria-hidden="true">·</li>
                <li>Works on 3G</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DrawerLink({
  href,
  label,
  hint,
}: {
  href: "/search" | "/insights" | "/dashboard";
  label: string;
  hint: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-4 py-5 transition-colors active:bg-[color:var(--color-brand-tint)]"
      >
        <span>
          <span className="block font-display text-2xl leading-tight text-[color:var(--color-ink)]">
            {label}
          </span>
          <span className="block text-sm text-[color:var(--color-ink-soft)]">
            {hint}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="text-2xl text-[color:var(--color-brand)]"
        >
          →
        </span>
      </Link>
    </li>
  );
}
