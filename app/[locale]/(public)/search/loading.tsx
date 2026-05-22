import { SiteHeader } from "@/components/layout/SiteHeader";
import { RosterSkeleton } from "@/components/ui/Skeleton";
import { SAChevron } from "@/components/ui/SAChevron";

export default function SearchLoading() {
  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="relative mx-auto max-w-[1320px] overflow-hidden px-5 py-12 md:px-10 md:py-16"
      >
        <SAChevron
          variant="signature"
          className="pointer-events-none absolute -right-24 -top-12 size-[360px] opacity-[0.06]"
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-brand-strong)]">
            <SAChevron variant="mark" className="size-3" />
            Talent register · loading
          </div>
          <div className="mt-3 h-12 max-w-[60%] animate-pulse rounded-md bg-[color:var(--color-surface-sunk)]" />
          <div className="mt-12">
            <RosterSkeleton rows={5} />
          </div>
        </div>
      </main>
    </>
  );
}
