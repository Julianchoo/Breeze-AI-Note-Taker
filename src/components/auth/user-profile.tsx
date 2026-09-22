"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, NotebookPen } from "lucide-react";
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
import { useSession, signOut } from "@/lib/auth-client";
export function UserProfile() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
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
          <DropdownMenuItem onClick={leave} className="rounded-lg px-2 py-2">
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
