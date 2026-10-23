// Shared loading skeleton (server component). Same container/padding as real pages so the layout does not jump.
export default function PageSkeleton({ cards = 3, title = true }: { cards?: number; title?: boolean }) {
  return (
    <div className="p-4 space-y-4" role="status" aria-busy="true" aria-live="polite">
      <h1 className="text-sm font-semibold text-gray-600">טוען…</h1>
      {title && <div className="h-7 w-2/5 rounded-lg bg-gray-200 animate-pulse motion-reduce:animate-none" />}
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card space-y-3" aria-hidden="true">
          <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-full rounded bg-gray-100 animate-pulse motion-reduce:animate-none" />
          <div className="h-3 w-4/5 rounded bg-gray-100 animate-pulse motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
