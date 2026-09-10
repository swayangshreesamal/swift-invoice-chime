import { Link } from "@tanstack/react-router";

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-brand text-sm font-bold text-paper">
            P
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">PayReminder</span>
        </Link>
        {right}
      </div>
    </div>
  );
}
