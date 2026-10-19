package com.breeze.app;

import android.annotation.SuppressLint;
import android.media.AudioManager;

/**
 * Pure checks that detect when Android is feeding the recorder silence instead of
 * microphone audio. Android 10+ silences other apps during phone/VoIP calls and
 * this cannot be bypassed, so the recorder stops instead of saving silent audio.
 */
final class CaptureGuards {
    static final String CALL_IN_PROGRESS = "Hay una llamada en curso. Android no permite que otras apps graben durante una llamada; usá el grabador del teléfono o grabá desde otro dispositivo.";
    static final String CALL_INTERRUPTED = "Una llamada interrumpió la grabación. Android no permite grabar durante llamadas; el audio anterior quedó guardado.";
    static final String DIGITAL_SILENCE = "El micrófono no está captando sonido (Android lo silenció). El audio anterior quedó guardado.";
    /** A call mode must last this long before an active recording is stopped. */
    static final long CALL_GRACE_MS = 3000;
    /** Seconds of exact digital silence that mean the microphone is muted by the system. */
    static final int SILENCE_SECONDS = 10;
    /** Real rooms always produce some noise; only values this close to zero count as muted. */
    static final int SILENCE_AMPLITUDE = 1;

    private CaptureGuards() { }

    // MODE_CALL_SCREENING is API 30; comparing its constant value is safe on older releases,
    // which simply never report it.
    @SuppressLint("InlinedApi")
    static boolean isCallMode(int mode) {
        return mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION
            || mode == AudioManager.MODE_CALL_SCREENING;
    }

    /** Reports true once a condition has held continuously for longer than a threshold. */
    static final class Sustained {
        private final long thresholdMs;
        private long since = -1;
        Sustained(long thresholdMs) { this.thresholdMs = thresholdMs; }
        boolean update(boolean active, long nowMs) {
            if (!active) { since = -1; return false; }
            if (since < 0) since = nowMs;
            return nowMs - since > thresholdMs;
        }
    }

    /** Counts consecutive near-zero samples; any audible sample resets the run. */
    static final class SilenceDetector {
        private final long limitSamples;
        private long silentSamples;
        SilenceDetector(int sampleRate, int seconds) { limitSamples = (long) sampleRate * seconds; }
        /** Returns true when the trailing run of digital silence reaches the limit. */
        boolean feed(short[] samples, int count) {
            for (int i = 0; i < count; i++) {
                int value = samples[i];
                if (value > SILENCE_AMPLITUDE || value < -SILENCE_AMPLITUDE) silentSamples = 0;
                else silentSamples++;
            }
            return silentSamples >= limitSamples;
        }
    }
}
