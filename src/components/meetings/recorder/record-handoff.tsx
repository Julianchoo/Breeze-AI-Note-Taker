"use client";

import { ViewTransition } from "react";
import "./recorder-transitions.css";

/* Shared element for the Record circle (/meetings) → recorder clock well (/meetings/new) morph.

   Both elements are wrapped in a <ViewTransition> with this name. When one unmounts and the other
   mounts in the same navigation (Next runs router navigations inside startTransition), React pairs
   them and animates the box from one to the other inside the page transition that
   MeetingsViewTransition already runs. There is no second, manual document.startViewTransition, so
   the two can never compete. The navigation itself is a plain Link: without the View Transitions API
   the page just swaps.

   React only applies the name while a transition runs, and only one of the elements exists on a page
   at a time (/meetings renders the circle; /meetings/new renders the web or the native recorder, never
   both), so the name stays unique. `default="none"` keeps every other update (enter, exit, resize)
   unanimated: only the pair morphs. */
export const RECORD_HANDOFF_NAME = "breeze-record-handoff";

export function RecordHandoff({ children }: { children: React.ReactElement }) {
  return (
    <ViewTransition name={RECORD_HANDOFF_NAME} share="auto" default="none">
      {children}
    </ViewTransition>
  );
}
