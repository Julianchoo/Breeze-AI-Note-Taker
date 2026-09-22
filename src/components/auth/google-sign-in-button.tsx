"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { signIn } from "@/lib/auth-client"

export function GoogleSignInButton() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState("")

  async function handleSignIn() {
    setError("")
    setIsPending(true)

    try {
      const result = await signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: "/login?google=error",
      })

      if (result.error) {
        setError("Could not sign in with Google. Please try again.")
        setIsPending(false)
      }
    } catch {
      setError("Could not connect to Google. Please try again.")
      setIsPending(false)
    }
  }

  return (
    <div className="mb-4 flex w-full max-w-sm flex-col gap-2">
      <Button type="button" variant="outline" onClick={handleSignIn} disabled={isPending}>
        {isPending ? "Connecting to Google..." : "Continue with Google"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
