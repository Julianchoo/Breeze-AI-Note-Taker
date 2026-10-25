"use client";

import { useSyncExternalStore } from "react";

/* The on-screen keyboard has no reliable cross-browser signal. Chrome on Android shrinks only the
   visual viewport, while the APK's WebView (adjustResize) shrinks the whole window; in both cases
   visualViewport.height drops well below the tallest height seen at the current width. Requiring a
   focused text field as well avoids false positives from collapsing browser toolbars or pinch zoom. */
const KEYBOARD_MIN_HEIGHT_PX = 150;
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/* Tallest unscaled viewport height seen at the current viewport width. Reset when the width changes
   (rotation, split screen), because the keyboard only ever reduces the height. */
let baselineHeight = 0;
let baselineWidth = 0;

function isTextEntry(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
  if (element instanceof HTMLInputElement) {
    return !element.readOnly && !element.disabled && !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  return false;
}

/* Multiplying by scale undoes pinch zoom, which also shrinks visualViewport.height. */
function updateBaseline(viewport: VisualViewport) {
  const height = viewport.height * viewport.scale;
  const width = Math.round(viewport.width * viewport.scale);
  if (width !== baselineWidth) {
    baselineWidth = width;
    baselineHeight = height;
  } else if (height > baselineHeight) {
    baselineHeight = height;
  }
}

function getSnapshot(): boolean {
  const viewport = window.visualViewport;
  if (!viewport || !isTextEntry(document.activeElement)) return false;
  return baselineHeight - viewport.height * viewport.scale > KEYBOARD_MIN_HEIGHT_PX;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  updateBaseline(viewport);

  const onResize = () => {
    updateBaseline(viewport);
    onChange();
  };
  /* Moving focus between two fields fires focusout then focusin in the same task. Deferring to the
     next frame reads only the settled state, so the bar does not flicker between fields. */
  let frame = 0;
  const onFocusChange = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(onChange);
  };

  viewport.addEventListener("resize", onResize);
  document.addEventListener("focusin", onFocusChange);
  document.addEventListener("focusout", onFocusChange);
  return () => {
    cancelAnimationFrame(frame);
    viewport.removeEventListener("resize", onResize);
    document.removeEventListener("focusin", onFocusChange);
    document.removeEventListener("focusout", onFocusChange);
  };
}

/** True while a text field has focus and the on-screen keyboard is taking up the viewport. */
export function useVirtualKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
