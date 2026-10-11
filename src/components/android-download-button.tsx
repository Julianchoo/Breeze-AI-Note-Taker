"use client";

import Link from "next/link";
import { Download, Smartphone } from "lucide-react";
import { useSyncExternalStore } from "react";
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
  return (
    <div className="flex flex-col items-start gap-3">
      <Button asChild size="lg">
        <a href={ANDROID_APK_URL}>
          <Download aria-hidden="true" />
          {installed ? "Download latest APK" : "Download for Android"}
        </a>
      </Button>
      <p className="text-muted-foreground text-xs">
        {version ? <>Installed version: <span className="font-mono tabular-nums">{version}</span>. </> : null}
        Opens the APK download in your browser.
      </p>
    </div>
  );
}
