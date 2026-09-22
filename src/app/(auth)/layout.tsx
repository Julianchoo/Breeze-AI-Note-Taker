export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-bg flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 sm:py-24">
      <div className="animate-fade-up w-full max-w-md">
        {/* Masthead: a quiet brand line sitting on a hairline rule. */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="eyebrow">Breeze — meeting notes</span>
          <div className="rule-fade h-px w-full" />
        </div>
        {children}
        <div className="rule-fade mt-8 h-px w-full" />
        <p className="text-muted-foreground mt-4 text-center text-xs leading-5">
          Breeze works best in Chrome or Edge on desktop.
        </p>
      </div>
    </div>
  );
}
