import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card } from "@/components/ui/card";
import { getOptionalSession } from "@/lib/session";

export const metadata = { title: "Create account" };

const INCLUDED = [
  "Recordings kept in your own private storage",
  "A summary, a full transcript, and the audio",
  "Speaker labels within each part of the conversation",
];

export default async function Register() {
  if (await getOptionalSession()) redirect("/meetings");
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 text-center">
        <p className="eyebrow">Create account</p>
        <h1 className="font-display text-4xl leading-[1.1] sm:text-5xl">Start with Breeze</h1>
        <p className="text-muted-foreground text-base leading-7">
          One button. Your account is created the first time you continue.
        </p>
      </header>
      <Card className="flex flex-col gap-5 p-6 sm:p-8">
        <GoogleSignInButton className="max-w-full" />
        <div className="rule-fade h-px w-full" />
        <ul className="flex flex-col gap-2.5">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm leading-6">
              <Check className="text-primary mt-1 size-3.5 shrink-0" aria-hidden="true" />
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-muted-foreground text-center text-sm leading-6">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
