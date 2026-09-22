import Link from "next/link";
import { Wind } from "lucide-react";
import { UserProfile } from "@/components/auth/user-profile";
import { ModeToggle } from "./ui/mode-toggle";
export function SiteHeader() {
  return (
    <>
      <a
        href="#main-content"
        className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:border focus:p-3"
      >
        Skip to content
      </a>
      <header className="bg-background border-b">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"
          aria-label="Main navigation"
        >
          <Link
            href="/"
            aria-label="Breeze home"
            className="flex items-center gap-2 text-xl font-semibold tracking-tight"
          >
            <Wind className="size-6" aria-hidden="true" />
            breeze<span className="text-muted-foreground">.</span>
          </Link>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <UserProfile />
          </div>
        </nav>
      </header>
    </>
  );
}
