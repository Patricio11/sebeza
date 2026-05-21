import { SiteHeader } from "@/components/layout/SiteHeader";
import { RosterSkeleton } from "@/components/ui/Skeleton";

export default function SearchLoading() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1240px] px-5 py-10 md:px-8">
        <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
          Talent register · loading
        </div>
        <div className="mt-2 h-12 max-w-[60%] animate-pulse rounded-sm bg-[color:var(--color-surface-sunk)]" />
        <div className="mt-10">
          <RosterSkeleton rows={5} />
        </div>
      </main>
    </>
  );
}
