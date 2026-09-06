export function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gtf-red px-1 font-mono text-[10px] font-bold leading-none text-gtf-text">
      {count > 9 ? "9+" : count}
    </span>
  );
}
