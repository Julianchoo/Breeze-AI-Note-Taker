"use client";

import Link from "next/link";
import { Download, Smartphone } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { hasAndroidRecorder, parseNativeResult } from "@/lib/native-android-recorder";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};
export const ANDROID_APK_URL =
  "https://github.com/Julianchoo/Breeze-AI-Note-Taker/releases/download/android-latest/breeze.apk";

export function AndroidAppLink() {
  const installed = useSyncExternalStore(subscribe, hasAndroidRecorder, () => false);
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/android" aria-label={installed ? "Update Android app" : "Download Android app"}>
        <Smartphone aria-hidden="true" />
        <span className="hidden sm:inline">{installed ? "Update app" : "Android app"}</span>
      </Link>
    </Button>
  );
}

function installedVersion() {
  if (!window.BreezeAndroid?.getAppInfo) return "";
  try {
    const info = parseNativeResult<{ versionName: string; versionCode: number }>(window.BreezeAndroid.getAppInfo());
    return typeof info.versionName === "string" && Number.isInteger(info.versionCode)
      ? `${info.versionName} (${info.versionCode})`
      : "";
  } catch {
    return "";
  }
}

export function AndroidDownloadButton() {
  const installed = useSyncExternalStore(subscribe, hasAndroidRecorder, () => false);
  const version = useSyncExternalStore(subscribe, installedVersion, () => "");
  const [copyStatus, setCopyStatus] = useState("");
  const pageUrl = "https://breeze-ai-lime.vercel.app/android";
  async function copyDownloadPage() {
    try { await navigator.clipboard.writeText(pageUrl); setCopyStatus("Link copied. Open Chrome and paste it into the address bar."); }
    catch { setCopyStatus("Copy the address below and open it in Chrome."); }
  }
  return (
    <div className="flex flex-col items-start gap-3">
      {installed ? (
        <Button size="lg" onClick={copyDownloadPage}>Copy download link for Chrome</Button>
      ) : (
        <Button asChild size="lg">
          <a href="/api/android/apk" download="breeze.apk">
            <Download aria-hidden="true" />Download for Android
          </a>
        </Button>
      )}
      <p className="text-muted-foreground text-xs">
        {version ? <>Installed version: <span className="font-mono tabular-nums">{version}</span>. </> : null}
        {installed ? "Open the download page in Chrome to update." : "Downloads breeze.apk to your phone."}
      </p>
      {installed ? (
        <div className="text-muted-foreground max-w-md space-y-2 text-sm leading-6">
          <p>This app version cannot save APK downloads. Open Chrome and paste this address to download the update:</p>
          <p className="text-foreground break-all select-all">{pageUrl}</p>
          <p role="status">{copyStatus}</p>
        </div>
      ) : null}
      <a href={ANDROID_APK_URL} className="text-primary text-sm underline underline-offset-4">
        Alternative download from GitHub
      </a>
    </div>
  );
}
