import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card } from "@/components/ui/card";
import { getOptionalSession } from "@/lib/session";
export const metadata = { title: "Sign in" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  if (await getOptionalSession()) redirect("/meetings");
  const { google } = await searchParams;
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 text-center">
        <p className="eyebrow">Sign in</p>
        <h1 className="font-display text-4xl leading-[1.1] sm:text-5xl">Welcome to Breeze</h1>
        <p className="text-muted-foreground text-base leading-7">
          Your conversations. A little clearer.
        </p>
      </header>
      <Card className="flex flex-col gap-5 p-6 sm:p-8">
        {/* The OAuth round trip failed and bounced back here via ?google=error. */}
        {google === "error" && (
          <div
            role="alert"
            className="text-destructive border-destructive/30 bg-destructive/10 flex items-start gap-2.5 rounded-lg border p-3 text-sm leading-5"
          >
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>Google sign-in did not finish. Nothing was saved — please try again.</span>
          </div>
        )}
        <GoogleSignInButton className="max-w-full" />
        <div className="rule-fade h-px w-full" />
        <p className="text-muted-foreground text-center text-sm leading-6">
          Record a meeting and your summary, transcript, and audio stay together in one place.
        </p>
      </Card>
    </div>
  );
}
