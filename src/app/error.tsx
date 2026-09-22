"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something interrupted Breeze</h1>
      <p className="text-muted-foreground">We could not load this page. Please try again.</p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/meetings">My meetings</Link>
        </Button>
      </div>
    </div>
  );
}
