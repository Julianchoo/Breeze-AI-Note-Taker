import type { Metadata } from "next";
import { Smartphone } from "lucide-react";
import { AndroidDownloadButton } from "@/components/android-download-button";

export const metadata: Metadata = {
  title: "Android app",
  description: "Download or update Breeze for Android to record meetings with your screen locked.",
};

export default function AndroidPage() {
  return (
    <div className="glow-bg">
      <div className="mx-auto max-w-2xl px-4 pt-12 pb-20 sm:px-6 sm:pt-16 sm:pb-28">
        <header className="animate-fade-up flex flex-col gap-4">
          <p className="eyebrow">Breeze on your phone</p>
          <h1 className="font-display text-4xl leading-[1.1] sm:text-5xl">Your meetings, on Android.</h1>
          <p className="text-muted-foreground text-sm leading-6 sm:text-base">
            Record with your screen locked or while using other apps. Audio stays on your phone until you reopen Breeze to upload it.
          </p>
          <div className="mt-3"><AndroidDownloadButton /></div>
        </header>
        <div className="rule-fade mt-10 h-px sm:mt-14" />
        <section className="animate-fade-up mt-10 [animation-delay:120ms]" aria-labelledby="install-heading">
          <h2 id="install-heading" className="font-display text-2xl">Install or update</h2>
          <ol className="text-muted-foreground mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 marker:font-mono">
            <li>Download the APK on your Android phone and open it from Downloads.</li>
            <li>If Android asks, allow your browser to install this app. Confirm the installation or update.</li>
            <li>Open Breeze, connect to your Breeze website and sign in with Google. Allow microphone and notification access.</li>
          </ol>
          <p className="text-muted-foreground mt-5 text-sm leading-6">
            For future updates, return here and install the latest APK over the existing app. Your saved recordings and sign-in stay on the phone.
          </p>
        </section>
        <aside className="border-border/70 bg-card mt-8 rounded-2xl border p-6" aria-labelledby="saved-audio-heading">
          <h2 id="saved-audio-heading" className="flex items-center gap-2 text-sm font-medium">
            <Smartphone className="text-primary size-4" aria-hidden="true" />
            Keep your saved audio
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            Stop any recording before updating. If you installed the original test APK, Android may reject this first update. Upload your pending recordings and export any audio you want to keep before uninstalling the old app. Uninstalling deletes recordings saved only on your phone.
          </p>
        </aside>
      </div>
    </div>
  );
}
