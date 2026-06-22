import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Loading fallback for the employer segment. The sidebar lives in the
 * route-group `layout.tsx` (outside this Suspense boundary), so this skeleton
 * fills only the main column  the sidebar stays put. Echoes the masthead +
 * content so the swap reads as the page loading, not the whole screen.
 */
export default function EmployerLoading() {
  return (
    <>
      <div className="border-b-2 border-[color:var(--color-ink)] bg-[color:var(--color-paper)] px-5 py-8 md:px-12 md:py-10">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-10 w-3/4 max-w-2xl" />
        <Skeleton className="mt-3 h-4 w-1/2 max-w-md" />
      </div>
      <div className="px-5 py-8 md:px-12 md:py-10">
        <div className="max-w-[1200px] space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    </>
  );
}
