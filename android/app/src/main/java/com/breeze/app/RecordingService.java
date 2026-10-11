package com.breeze.app;

import android.app.*;
import android.Manifest;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.*;
import android.os.*;
import java.io.File;

/** A user-started foreground microphone service, independent of the WebView lifecycle. */
public final class RecordingService extends Service {
    public static final String STOP = "com.breeze.app.STOP";
    public static volatile String activeId;
    private static final int NOTIFICATION = 14;
    private volatile boolean stopping;
    private Thread worker;
    private int latestStartId;
    private PowerManager.WakeLock wakeLock;
    public static boolean isRunning() { return activeId != null; }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        latestStartId = startId;
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        if (STOP.equals(intent.getAction())) { stopping = true; return START_NOT_STICKY; }
        if (worker != null) return START_NOT_STICKY;
        String id = intent.getStringExtra("id");
        if (id == null) { stopSelf(); return START_NOT_STICKY; }
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
            wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Breeze:recording");
            wakeLock.acquire(4 * 60 * 60 * 1000L + 60000);
            worker = new Thread(() -> capture(id), "Breeze microphone");
            worker.start();
        } catch (Exception error) {
            try { new RecordingStore(this).updateState(id, true, "No se pudo iniciar el micrófono: " + error.getMessage()); } catch (Exception ignored) { }
            activeId = null; stopSelf();
        }
        return START_NOT_STICKY;
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
            try { store.updateState(id, true, failure); } catch (Exception ignored) { }
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            new Handler(Looper.getMainLooper()).post(() -> {
                synchronized (RecordingService.class) {
                    worker = null;
                    stopForeground(STOP_FOREGROUND_REMOVE);
                    stopSelfResult(latestStartId);
                    activeId = null;
                }
            });
        }
    }
    @Override public void onDestroy() { stopping = true; super.onDestroy(); }
}
