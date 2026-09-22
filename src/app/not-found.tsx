import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="glow-bg">
      <div className="animate-fade-up mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center sm:py-32">
        <p className="text-muted-foreground font-mono text-xs tracking-[0.18em]">404</p>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">This page is not here</h1>
        <p className="text-muted-foreground leading-7">
          The page moved, or never existed. Your meetings are still where you left them.
        </p>
        <Button asChild size="lg">
          <Link href="/meetings">My meetings</Link>
        </Button>
      </div>
    </div>
  );
}
