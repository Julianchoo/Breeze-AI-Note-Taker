import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

/* The home page's single primary action, rendered identically at the top and bottom of the page.
   The button keeps the shared Google sign in behaviour; only its sizing follows the landing system:
   text-base semibold, 8px vertical padding, the Google chip sitting concentric with the pill
   (40px pill, 8px inset, 24px chip). */
export function HomeCta() {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <GoogleSignInButton
        label="Record your first meeting"
        className="w-full items-center sm:w-auto"
        buttonClassName="ease-fluid h-auto gap-2 py-2 pr-4 pl-2 text-base font-semibold duration-300 hover:-translate-y-0.5 active:translate-y-0"
      />
      <p className="text-muted-foreground text-sm">Sign in with Google. No credit card needed.</p>
    </div>
  );
}
