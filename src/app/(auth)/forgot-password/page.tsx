import { redirect } from "next/navigation";
import { PasswordlessNotice } from "@/components/auth/passwordless-notice";
import { getOptionalSession } from "@/lib/session";

export const metadata = { title: "Trouble signing in" };

export default async function ForgotPassword() {
  if (await getOptionalSession()) redirect("/meetings");
  return (
    <PasswordlessNotice
      eyebrow="Trouble signing in"
      title="No password needed"
      description="Breeze accounts use Google to sign in."
    />
  );
}
