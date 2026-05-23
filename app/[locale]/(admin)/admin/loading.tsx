import { Skeleton } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[color:var(--color-paper)] p-6 md:p-12">
      <div className="max-w-[1200px] space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-3/4 max-w-2xl" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
