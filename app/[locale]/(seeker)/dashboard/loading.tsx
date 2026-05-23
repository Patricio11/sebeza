import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--color-paper)] p-6 md:p-12">
      <div className="max-w-[1200px] space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-3/4 max-w-2xl" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
