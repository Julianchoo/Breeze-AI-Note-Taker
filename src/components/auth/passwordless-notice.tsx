import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const GOOGLE_RECOVERY = "https://accounts.google.com/signin/recovery";

/**
 * Breeze has no password of its own — every account is a Google account.
 * Shown on /forgot-password and /reset-password, which people still reach
 * from bookmarks and from links in older emails.
 */
export function PasswordlessNotice({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <span
          className="bg-primary/10 text-primary mb-1 flex size-11 items-center justify-center rounded-xl"
          aria-hidden="true"
        >
          <KeyRound className="size-5" />
        </span>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display text-4xl leading-[1.1] sm:text-5xl">{title}</h1>
        <p className="text-muted-foreground text-base leading-7">{description}</p>
      </header>
      <Card className="flex flex-col gap-5 p-6 sm:p-8">
        <p className="text-muted-foreground text-sm leading-6">
          Breeze does not store a password for you. You sign in with Google, so there is nothing
          here to reset.
        </p>
        <div className="rule-fade h-px w-full" />
        <div className="flex flex-col gap-3">
          <Button asChild size="lg" className="w-full">
            <Link href="/login">Go to sign in</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href={GOOGLE_RECOVERY} target="_blank" rel="noopener noreferrer">
              Recover your Google account
            </a>
          </Button>
        </div>
        <p className="text-muted-foreground text-xs leading-5">
          If you cannot reach your Google account, recover it with Google first — your Breeze
          meetings are waiting once you are back in.
        </p>
      </Card>
    </div>
  );
}
