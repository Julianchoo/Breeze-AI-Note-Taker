"use client";

import { useSyncExternalStore } from "react";
import { hasAndroidRecorder } from "@/lib/native-android-recorder";

const subscribe = () => () => {};

/** Legacy Android WebViews do not report their system-bar insets to the page. */
export function NativeAppFrame({ children }: { children: React.ReactNode }) {
  const native = useSyncExternalStore(subscribe, hasAndroidRecorder, () => false);
  return (
    <div className="app-frame flex min-h-screen flex-1 flex-col" data-native-android={native ? "true" : undefined}>
      {children}
    </div>
  );
}
