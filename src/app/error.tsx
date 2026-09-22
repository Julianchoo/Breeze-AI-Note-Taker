"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="glow-bg">
      <div className="animate-fade-up mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center sm:py-32">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.18em]">Error</p>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">
          Something interrupted Breeze
        </h1>
        <p className="text-muted-foreground leading-7">
          We could not load this page. Try again — nothing you recorded has been lost.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} size="lg">
            Try again
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/meetings">My meetings</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
