import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
      <p className="text-muted-foreground font-mono text-sm">404</p>
      <h1 className="text-2xl font-semibold">This page is not here</h1>
      <p className="text-muted-foreground">
        Return to your meetings to pick up where you left off.
      </p>
      <Button asChild>
        <Link href="/meetings">My meetings</Link>
      </Button>
    </div>
  );
}
