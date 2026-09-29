"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Cloud, LogOut, NotebookPen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient, useSession, signOut } from "@/lib/auth-client";
import { ADMIN_EMAIL } from "@/lib/utils";
export function UserProfile() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const isAdmin = session?.user.email === ADMIN_EMAIL;
  // null while unknown (or the check failed): the OneDrive item stays hidden.
  const [oneDrive, setOneDrive] = useState<boolean | null>(null);
  const folderRequested = useRef(false);
  useEffect(() => {
    // Only the admin archives audio to OneDrive; the API 404s for everyone else.
    if (!isAdmin) return;
    const url = new URL(location.href);
    if (url.searchParams.get("onedrive") === "connected") {
      // Back from linking Microsoft: create the "Audios Breeze" folder once, then tidy the URL.
      if (folderRequested.current) return;
      folderRequested.current = true;
      url.searchParams.delete("onedrive");
      router.replace(url.pathname + url.search + url.hash);
      void fetch("/api/onedrive", { method: "POST" })
        .then(async (response) => {
          const data = await response.json().catch(() => null);
          if (!response.ok || data?.connected !== true)
            throw new Error(typeof data?.error === "string" ? data.error : "");
          setOneDrive(true);
          toast.success("OneDrive connected. Audio is archived to “Audios Breeze”.");
        })
        .catch((error: Error) => {
          setOneDrive(false);
          toast.error(error.message || "Could not set up OneDrive. Please try connecting again.");
        });
      return;
    }
    void fetch("/api/onedrive")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setOneDrive(typeof data?.connected === "boolean" ? data.connected : null))
      .catch(() => setOneDrive(null));
  }, [isAdmin, router]);
  if (isPending) return <Skeleton className="size-9 rounded-full" />;
  if (!session)
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/login">Sign in</Link>
      </Button>
    );
  async function leave() {
    try {
      const result = await signOut();
      if (result.error) throw new Error();
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }
  async function connectOneDrive() {
    const result = await authClient
      .linkSocial({
        provider: "microsoft",
        callbackURL: `${location.pathname}?onedrive=connected`,
      })
      .catch(() => null);
    // On success the browser is already redirecting to Microsoft.
    if (!result || result.error)
      toast.error("Could not start connecting OneDrive. Please try again.");
  }
  const initial = (session.user.name[0] || "B").toUpperCase();
  // The Google avatar may be absent; the initial is always the fallback.
  const avatarSrc = session.user.image ?? undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="rounded-full transition-opacity duration-200 hover:opacity-80"
        >
          <Avatar className="border-border size-9 border">
            <AvatarImage src={avatarSrc} alt="" />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-medium">
              {initial}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl p-1.5">
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2.5">
          <Avatar className="border-border size-9 shrink-0 border">
            <AvatarImage src={avatarSrc} alt="" />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-medium">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm leading-5">{session.user.name}</div>
            <div className="text-muted-foreground truncate text-xs leading-4 font-normal">
              {session.user.email}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="rounded-lg px-2 py-2">
            <Link href="/meetings">
              <NotebookPen />
              My meetings
            </Link>
          </DropdownMenuItem>
          {/* Visibility only — /admin re-checks the session on the server. */}
          {isAdmin && (
            <DropdownMenuItem asChild className="rounded-lg px-2 py-2">
              <Link href="/admin">
                <ShieldCheck />
                Admin
              </Link>
            </DropdownMenuItem>
          )}
          {isAdmin && oneDrive === false && (
            <DropdownMenuItem onClick={connectOneDrive} className="rounded-lg px-2 py-2">
              <Cloud />
              Connect OneDrive
            </DropdownMenuItem>
          )}
          {isAdmin && oneDrive === true && (
            <DropdownMenuItem disabled className="rounded-lg px-2 py-2">
              <Check />
              OneDrive connected
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={leave} className="rounded-lg px-2 py-2">
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
