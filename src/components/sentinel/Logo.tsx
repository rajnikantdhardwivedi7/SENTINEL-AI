import { Link } from "@tanstack/react-router";

export function LogoMark() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-elevated">
      <svg viewBox="0 0 24 24" className="size-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3Z" />
        <path d="M8 12h3l1-3 2 6 1-3h1" className="text-primary" stroke="var(--primary)" />
      </svg>
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
      <LogoMark />
      {!compact && <span>SENTINEL <span className="font-normal text-muted-foreground">AI</span></span>}
    </Link>
  );
}

export function DemoBanner() {
  return (
    <div className="border-b border-warning/20 bg-warning/[0.06] px-4 py-1.5 text-center text-xs text-warning">
      Demo mode — every metric, alert and event shown is <strong className="font-medium">simulated</strong>. No real infrastructure is connected.
    </div>
  );
}
