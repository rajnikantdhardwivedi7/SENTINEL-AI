import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-md border border-primary/40 bg-primary/10 shadow-glow">
        <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z" />
          <path d="M8 12h3l1-3 2 6 1-3h1" />
        </svg>
      </span>
      SENTINEL<span className="text-primary">AI</span>
    </Link>
  );
}

export function DemoBanner() {
  return (
    <div className="border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-center text-xs text-warning">
      Demo mode — every metric, alert and event shown is <strong>simulated</strong>. No real infrastructure is connected.
    </div>
  );
}
