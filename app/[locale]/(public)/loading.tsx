import { Skeleton } from "@/components/ui/Skeleton";

export default function PublicLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--color-paper)]">
      <div className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] py-12">
        <div className="mx-auto max-w-[1200px] px-6">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-3 h-12 w-3/4 max-w-2xl" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] space-y-4 px-6 py-12">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
