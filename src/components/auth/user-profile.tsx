"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, NotebookPen } from "lucide-react";
import { toast } from "sonner";
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
      <Button variant="ghost" size="sm" asChild>
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full" aria-label="Account menu">
          {(session.user.name[0] || "B").toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="truncate">{session.user.name}</div>
          <div className="text-muted-foreground truncate text-xs font-normal">
            {session.user.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/meetings">
              <NotebookPen />
              My meetings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={leave}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
