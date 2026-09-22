import { redirect } from "next/navigation";
import { PasswordlessNotice } from "@/components/auth/passwordless-notice";
import { getOptionalSession } from "@/lib/session";

export const metadata = { title: "Reset password" };

export default async function ResetPassword() {
  if (await getOptionalSession()) redirect("/meetings");
  return (
    <PasswordlessNotice
      eyebrow="Reset password"
      title="Nothing to reset"
      description="This link is no longer used. Breeze signs you in with Google."
    />
  );
}
