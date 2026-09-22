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
      <header className="bg-background/70 border-border/60 sticky top-0 z-40 border-b backdrop-blur-md">
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6"
          aria-label="Main navigation"
        >
          <Link href="/" aria-label="Breeze home" className="group flex items-center gap-2.5">
            <span className="bg-primary/10 text-primary group-hover:bg-primary/15 flex size-8 items-center justify-center rounded-lg transition-colors duration-200">
              <Wind className="size-4" aria-hidden="true" />
            </span>
            <span className="font-display text-2xl leading-none">
              breeze<span className="text-primary">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ModeToggle />
            <UserProfile />
          </div>
        </nav>
      </header>
    </>
  );
}
