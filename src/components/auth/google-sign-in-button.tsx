"use client";

import { useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/**
 * Official Google "G" mark. Its four brand colors are fixed by Google's
 * identity guidelines, so this is a deliberate exception to the token rule.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.642h6.458a5.52 5.52 0 0 1-2.394 3.622v3.01h3.878c2.269-2.088 3.578-5.164 3.578-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.956-1.075 7.942-2.908l-3.878-3.01c-1.075.72-2.45 1.145-4.064 1.145-3.125 0-5.77-2.11-6.715-4.947H1.276v3.107A11.995 11.995 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.285 14.28a7.212 7.212 0 0 1 0-4.56V6.614H1.276a11.995 11.995 0 0 0 0 10.772l4.009-3.107z"
      />
      <path
        fill="#EA4335"
        d="M12 4.773c1.762 0 3.343.606 4.587 1.795l3.44-3.44C17.951 1.19 15.235 0 12 0 7.31 0 3.255 2.69 1.276 6.614l4.009 3.107C6.23 6.883 8.875 4.773 12 4.773z"
      />
    </svg>
  );
}

export function GoogleSignInButton({ className }: { className?: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setError("");
    setIsPending(true);

    try {
      const result = await signIn.social({
        provider: "google",
        callbackURL: "/meetings",
        errorCallbackURL: "/login?google=error",
      });

      if (result.error) {
        setError("Could not sign in with Google. Please try again.");
        setIsPending(false);
      }
    } catch {
      setError("Could not connect to Google. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-3", className)}>
      <Button
        type="button"
        size="lg"
        onClick={handleSignIn}
        disabled={isPending}
        aria-busy={isPending}
        className="w-full gap-3"
      >
        {/* The mark sits in a white chip so its colors stay legible on terracotta. */}
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white">
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin text-neutral-600" aria-hidden="true" />
          ) : (
            <GoogleMark className="size-3.5" />
          )}
        </span>
        {isPending ? "Connecting to Google…" : "Continue with Google"}
      </Button>
      {error && (
        <div
          role="alert"
          className="text-destructive border-destructive/30 bg-destructive/10 flex items-start gap-2.5 rounded-lg border p-3 text-sm leading-5"
        >
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
