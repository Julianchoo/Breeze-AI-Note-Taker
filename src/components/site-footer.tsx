export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="rule-fade h-px" />
        <div className="text-muted-foreground flex flex-col gap-1.5 py-8 text-xs sm:flex-row sm:items-baseline sm:justify-between">
          <p>
            <span className="font-display text-foreground text-sm">breeze</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            A little less to remember.
          </p>
          <p>Your meetings, in one place.</p>
        </div>
      </div>
    </footer>
  );
}
