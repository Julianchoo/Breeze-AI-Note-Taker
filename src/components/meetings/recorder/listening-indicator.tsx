import { MicrophoneIcon } from "@phosphor-icons/react/dist/ssr";
import "./recorder-transitions.css";

/* Android recorder: the native service owns the microphone and the bridge exposes no input level,
   so this is an ambient "listening" ring on a fixed 4s breath. It never pretends to follow sound.
   Real levels would need a level/amplitude method added to the native bridge (new APK). */
export function ListeningIndicator({ active }: { active: boolean }) {
  return (
    <div aria-hidden="true" className="mt-6 flex h-10 items-center justify-center">
      <span className="relative flex size-10 items-center justify-center">
        <span
          className={`absolute inset-0 rounded-full border-2 transition-colors duration-700 ${
            active
              ? "border-destructive/50 recorder-listening-breathe"
              : "border-muted-foreground/20"
          }`}
        />
        <MicrophoneIcon
          weight="fill"
          className={`size-4 transition-colors duration-700 ${
            active ? "text-destructive" : "text-muted-foreground/45"
          }`}
        />
      </span>
    </div>
  );
}
