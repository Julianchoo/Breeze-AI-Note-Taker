import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
    <div className="flex min-h-[65vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Breeze</CardTitle>
          <CardDescription>Your conversations. A little clearer.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <GoogleSignInButton />
          {google === "error" && (
            <p role="alert" className="text-destructive text-sm">
              Google sign-in did not complete. Please try again.
            </p>
          )}
          <p className="text-muted-foreground text-sm leading-6">
            Sign in to record a meeting and keep your summaries, transcripts, and audio together.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
