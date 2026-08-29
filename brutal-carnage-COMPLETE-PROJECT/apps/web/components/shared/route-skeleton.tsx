// components/shared/route-skeleton.tsx
// Rendered instantly by every route's loading.tsx while the server
// component's data fetch (Prisma calls, etc.) is still in flight. Without
// this, Next.js has nothing to show and the screen just freezes on
// navigation until the whole page's data resolves.

export function RouteSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 h-6 w-40 animate-pulse rounded bg-zinc-800/70" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-zinc-800 bg-zinc-950/60"
          />
        ))}
      </div>

      <div className="mt-6 h-72 animate-pulse rounded-lg border border-zinc-800 bg-zinc-950/60" />
    </div>
  );
}
