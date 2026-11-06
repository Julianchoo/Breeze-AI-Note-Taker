package com.breeze.app;

import android.app.*;
import android.Manifest;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.*;
import android.os.*;
import android.util.Log;
import java.io.File;

/** A user-started foreground microphone service, independent of the WebView lifecycle. */
public final class RecordingService extends Service {
    public static final String STOP = "com.breeze.app.STOP";
    public static volatile String activeId;
    private static final int NOTIFICATION = 14;
    private static final String TAG = "BreezeRecording";
    private volatile boolean stopping;
    private Thread worker;
    /** Recording the current worker captures; guarded by RecordingService.class. */
    private String workerId;
    /** A start that arrived while the previous worker was still finishing. */
    private Intent pendingStart;
    private int latestStartId;
    private PowerManager.WakeLock wakeLock;
    public static boolean isRunning() { return activeId != null; }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        latestStartId = startId;
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        if (STOP.equals(intent.getAction())) {
            stopping = true;
            synchronized (RecordingService.class) {
                // A start still waiting for the previous capture never recorded: mark it stopped too.
                String waiting = pendingStart == null ? null : pendingStart.getStringExtra("id");
                pendingStart = null;
                if (waiting != null) {
                    markStopped(waiting, "Se detuvo antes de empezar a grabar");
                    if (waiting.equals(activeId)) activeId = null;
                }
            }
            return START_NOT_STICKY;
        }
        String id = intent.getStringExtra("id");
        if (id == null) { if (worker == null) stopSelf(); return START_NOT_STICKY; }
        synchronized (RecordingService.class) {
            if (worker != null) {
                // The previous capture is still sealing its audio. Never drop this start:
                // it would leave a recording marked as running that nothing captures.
                if (!id.equals(workerId)) pendingStart = intent;
                return START_NOT_STICKY;
            }
            begin(intent, id);
        }
        return START_NOT_STICKY;
    }
    /** Caller holds RecordingService.class. */
    private void begin(Intent intent, String id) {
        activeId = id;
        stopping = false;
        try {
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(new NotificationChannel("recording", "Grabación de Breeze", NotificationManager.IMPORTANCE_LOW));
            Intent stop = new Intent(this, RecordingService.class).setAction(STOP);
            PendingIntent stopIntent = PendingIntent.getService(this, 0, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
            Notification.Builder notification = new Notification.Builder(this, "recording")
                .setSmallIcon(R.drawable.ic_notification).setContentTitle("Breeze está grabando")
                .setContentText("El audio se guarda en este teléfono.").setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "Detener", stopIntent).build());
            if (open != null) notification.setContentIntent(PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notification.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(NOTIFICATION, notification.build());
            if (wakeLock == null) wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Breeze:recording");
            wakeLock.acquire(4 * 60 * 60 * 1000L + 60000);
            workerId = id;
            worker = new Thread(() -> capture(id), "Breeze microphone");
            worker.start();
        } catch (Exception error) {
            markStopped(id, "No se pudo iniciar el micrófono: " + error.getMessage());
            worker = null; workerId = null;
            if (id.equals(activeId)) activeId = null;
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
    }
    /** Marks the recording stopped, retrying once; recover() repairs it later if both fail. */
    private void markStopped(String id, String failure) {
        RecordingStore store = new RecordingStore(this);
        for (int attempt = 0; attempt < 2; attempt++) {
            try { store.updateState(id, true, failure); return; }
            catch (Exception error) { Log.e(TAG, "Could not mark recording " + id + " stopped (attempt " + (attempt + 1) + ")", error); }
        }
    }
    private void capture(String id) {
        RecordingStore store = new RecordingStore(this);
        AudioRecord recorder = null;
        WavFile wav = null;
        File target = null;
        String failure = null;
        int index = 0;
        long total = 0;
        final long maximum = WavFile.RATE * 4L * 60 * 60;
        final int chunkSamples = WavFile.RATE * 120;
        try {
            index = store.nextIndex(id);
            int min = AudioRecord.getMinBufferSize(WavFile.RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            if (min <= 0) throw new IllegalStateException("El teléfono no admite este formato de audio");
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
                throw new SecurityException("Se necesita permiso para usar el micrófono");
            recorder = new AudioRecord(MediaRecorder.AudioSource.MIC, WavFile.RATE, AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT, Math.max(min * 2, WavFile.RATE * 2));
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("Micrófono no disponible");
            recorder.startRecording();
            short[] buffer = new short[4000];
            long lastSync = SystemClock.elapsedRealtime();
            long silentSince = 0;
            while (!stopping && total < maximum) {
                if (wav == null) { target = store.chunkFile(id, index); wav = new WavFile(target); }
                int wanted = (int) Math.min(buffer.length, Math.min(chunkSamples - wav.samples(), maximum - total));
                int count = recorder.read(buffer, 0, wanted, AudioRecord.READ_BLOCKING);
                if (count < 0) throw new IllegalStateException("El micrófono fue interrumpido (" + count + ")");
                if (count == 0) continue;
                // Android can silence microphone capture while a call or another privileged app owns it.
                if (Build.VERSION.SDK_INT >= 29) {
                    AudioRecordingConfiguration config = recorder.getActiveRecordingConfiguration();
                    if (config != null && config.isClientSilenced()) {
                        if (silentSince == 0) silentSince = SystemClock.elapsedRealtime();
                        if (SystemClock.elapsedRealtime() - silentSince > 3000) throw new IllegalStateException("Otra aplicación o una llamada interrumpió el micrófono");
                    } else silentSince = 0;
                }
                wav.write(buffer, count); total += count;
                if (SystemClock.elapsedRealtime() - lastSync >= 1000) { wav.sync(); lastSync = SystemClock.elapsedRealtime(); }
                if (wav.samples() == chunkSamples) {
                    long samples = wav.samples(); wav.close(); wav = null;
                    store.sealChunk(id, index++, samples);
                }
            }
            if (total >= maximum) failure = "Se alcanzó el límite de 4 horas. El audio está guardado.";
        } catch (Exception error) { failure = error.getMessage() == null ? "Se interrumpió el micrófono" : error.getMessage(); }
        finally {
            if (recorder != null) { try { recorder.stop(); } catch (Exception ignored) { } recorder.release(); }
            if (wav != null) {
                try { long samples = wav.samples(); wav.close(); if (samples > 0) store.sealChunk(id, index, samples); else if (target != null) target.delete(); }
                catch (Exception error) { failure = "El audio necesita recuperación: " + error.getMessage(); }
            }
            markStopped(id, failure);
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            Thread finished = Thread.currentThread();
            new Handler(Looper.getMainLooper()).post(() -> {
                synchronized (RecordingService.class) {
                    if (worker == finished) { worker = null; workerId = null; }
                    if (id.equals(activeId)) activeId = null;
                    Intent next = pendingStart;
                    pendingStart = null;
                    String nextId = next == null ? null : next.getStringExtra("id");
                    if (nextId != null && worker == null) {
                        begin(next, nextId);
                        return;
                    }
                    if (worker == null) {
                        stopForeground(STOP_FOREGROUND_REMOVE);
                        stopSelfResult(latestStartId);
                    }
                }
            });
        }
    }
    @Override public void onDestroy() { stopping = true; super.onDestroy(); }
}
