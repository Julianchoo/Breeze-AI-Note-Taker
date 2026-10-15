package com.breeze.app;
import android.media.AudioManager;
import org.junit.Test;
import static org.junit.Assert.*;
public class CaptureGuardsTest {
    @Test public void recognizesCallModesOnly() {
        assertTrue(CaptureGuards.isCallMode(AudioManager.MODE_IN_CALL));
        assertTrue(CaptureGuards.isCallMode(AudioManager.MODE_IN_COMMUNICATION));
        assertTrue(CaptureGuards.isCallMode(AudioManager.MODE_CALL_SCREENING));
        assertFalse(CaptureGuards.isCallMode(AudioManager.MODE_NORMAL));
        assertFalse(CaptureGuards.isCallMode(AudioManager.MODE_RINGTONE));
    }
    @Test public void sustainedConditionNeedsContinuousDuration() {
        CaptureGuards.Sustained guard = new CaptureGuards.Sustained(3000);
        assertFalse(guard.update(true, 1000));
        assertFalse(guard.update(true, 4000));
        assertTrue(guard.update(true, 4001));
        assertFalse(guard.update(false, 5000));
        assertFalse(guard.update(true, 6000));
        assertFalse(guard.update(true, 9000));
    }
    @Test public void silenceTriggersOnlyAfterTenSecondsOfDigitalZeros() {
        CaptureGuards.SilenceDetector detector = new CaptureGuards.SilenceDetector(16000, 10);
        short[] zeros = new short[16000];
        short[] dither = new short[16000];
        for (int i = 0; i < dither.length; i += 2) { dither[i] = 1; dither[i + 1] = -1; }
        for (int second = 0; second < 9; second++) assertFalse(detector.feed(second % 2 == 0 ? zeros : dither, 16000));
        assertTrue(detector.feed(zeros, 16000));
    }
    @Test public void quietRoomNoiseResetsSilence() {
        CaptureGuards.SilenceDetector detector = new CaptureGuards.SilenceDetector(16000, 10);
        short[] zeros = new short[16000];
        short[] quiet = new short[16000];
        quiet[8000] = 2; // A single faint sample is real input, not a system mute.
        for (int second = 0; second < 9; second++) assertFalse(detector.feed(zeros, 16000));
        assertFalse(detector.feed(quiet, 16000));
        for (int second = 0; second < 9; second++) assertFalse(detector.feed(zeros, 16000));
        assertTrue(detector.feed(zeros, 16000));
    }
}
