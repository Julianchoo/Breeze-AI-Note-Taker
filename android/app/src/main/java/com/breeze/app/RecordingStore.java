package com.breeze.app;

import android.content.Context;
import android.util.AtomicFile;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** App-private, atomic metadata with individually durable audio chunks. */
public final class RecordingStore {
    private static final Object LOCK = new Object();
    private final File root;
    public RecordingStore(Context context) { root = new File(context.getFilesDir(), "recordings"); root.mkdirs(); }
    private File dir(String id) throws IOException {
        if (id == null || !id.matches("[A-Za-z0-9_-]{1,128}")) throw new IOException("Invalid recording id");
        return new File(root, id);
    }
    private JSONObject read(String id) throws Exception {
        AtomicFile atomic = new AtomicFile(new File(dir(id), "metadata.json"));
        try (FileInputStream stream = atomic.openRead()) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096]; int count;
            while ((count = stream.read(buffer)) != -1) bytes.write(buffer, 0, count);
            return new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        }
    }
    private void save(JSONObject data) throws Exception {
        AtomicFile atomic = new AtomicFile(new File(dir(data.getString("id")), "metadata.json"));
        FileOutputStream stream = atomic.startWrite();
        try { stream.write(data.toString().getBytes(StandardCharsets.UTF_8)); atomic.finishWrite(stream); }
        catch (Exception error) { atomic.failWrite(stream); throw error; }
    }
    public void create(String id, String userId, String title) throws Exception { synchronized (LOCK) {
        File folder = dir(id);
        if (folder.exists()) throw new IOException("Recording already exists");
        if (!folder.mkdirs()) throw new IOException("Cannot create recording storage");
        save(new JSONObject().put("id", id).put("userId", userId).put("title", title)
            .put("chunks", 0).put("samples", 0).put("stopped", false).put("finished", false)
            .put("startedAt", System.currentTimeMillis()).put("error", JSONObject.NULL).put("uploaded", new JSONArray()));
    } }
    public JSONObject get(String id, String userId) throws Exception { synchronized (LOCK) {
        JSONObject value = read(id);
        if (!value.getString("userId").equals(userId)) throw new SecurityException("Recording belongs to another account");
        return value;
    } }
    public JSONObject getActive(String id) throws Exception { synchronized (LOCK) { return read(id); } }
    public JSONArray list(String userId) throws Exception { synchronized (LOCK) {
        JSONArray result = new JSONArray(); File[] folders = root.listFiles();
        if (folders != null) for (File folder : folders) {
            if (!folder.isDirectory()) continue;
            JSONObject value;
            try { value = read(folder.getName()); } catch (Exception unreadable) { continue; }
            if (value.getString("userId").equals(userId) && !value.getBoolean("finished")) result.put(value);
        }
        return result;
    } }
    public File chunkFile(String id, int index) throws IOException {
        if (index < 0 || index > 120) throw new IOException("Invalid chunk index");
        return new File(dir(id), String.format(java.util.Locale.ROOT, "%04d.wav", index));
    }
    public int nextIndex(String id) throws Exception { synchronized (LOCK) { return read(id).getInt("chunks"); } }
    public void sealChunk(String id, int index, long samples) throws Exception { synchronized (LOCK) {
        JSONObject value = read(id);
        if (index != value.getInt("chunks")) throw new IOException("Nonsequential chunk");
        save(value.put("chunks", index + 1).put("samples", value.getLong("samples") + samples));
    } }
    public void updateState(String id, boolean stopped, String error) throws Exception { synchronized (LOCK) {
        save(read(id).put("stopped", stopped).put("error", error == null ? JSONObject.NULL : error));
    } }
    public JSONObject readChunk(String id, String userId, int index) throws Exception { synchronized (LOCK) {
        JSONObject value = get(id, userId);
        if (index < 0 || index >= value.getInt("chunks")) throw new IOException("Chunk is not sealed");
        byte[] bytes = Files.readAllBytes(chunkFile(id, index).toPath());
        boolean uploaded = false;
        JSONArray sent = value.getJSONArray("uploaded");
        for (int i = 0; i < sent.length(); i++) if (sent.getInt(i) == index) uploaded = true;
        return new JSONObject().put("index", index).put("samples", (bytes.length - 44) / 2)
            .put("uploaded", uploaded).put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
    } }
    public void markUploaded(String id, String userId, int index) throws Exception { synchronized (LOCK) {
        JSONObject value = get(id, userId);
        if (index < 0 || index >= value.getInt("chunks")) throw new IOException("Invalid chunk");
        JSONArray uploaded = value.getJSONArray("uploaded");
        for (int i = 0; i < uploaded.length(); i++) if (uploaded.getInt(i) == index) return;
        uploaded.put(index); save(value);
    } }
    public void finish(String id, String userId) throws Exception { synchronized (LOCK) {
        JSONObject value = get(id, userId);
        if (!value.getBoolean("stopped") || value.getJSONArray("uploaded").length() != value.getInt("chunks"))
            throw new IOException("Recording has pending audio");
        save(value.put("finished", true));
    } }
    public JSONArray saved(String userId) throws Exception { synchronized (LOCK) {
        JSONArray result = new JSONArray(); File[] folders = root.listFiles();
        if (folders != null) for (File folder : folders) {
            if (!folder.isDirectory()) continue;
            JSONObject value;
            try { value = read(folder.getName()); } catch (Exception unreadable) { continue; }
            if (value.getString("userId").equals(userId) && value.getBoolean("stopped")) result.put(value);
        }
        return result;
    } }
    public void export(String id, String userId, OutputStream out) throws Exception {
        JSONObject value = get(id, userId);
        if (!value.getBoolean("stopped")) throw new IOException("Stop recording before exporting");
        long samples = 0;
        for (int i = 0; i < value.getInt("chunks"); i++) {
            File chunk = chunkFile(id, i);
            if (!chunk.isFile() || chunk.length() < 44 || (chunk.length() - 44) % 2 != 0)
                throw new IOException("Saved audio chunk is missing or damaged");
            samples += (chunk.length() - 44) / 2;
        }
        WavFile.header(out, samples);
        byte[] buffer = new byte[16384];
        for (int i = 0; i < value.getInt("chunks"); i++) {
            try (FileInputStream input = new FileInputStream(chunkFile(id, i))) {
                input.getChannel().position(44);
                int count;
                while ((count = input.read(buffer)) != -1) out.write(buffer, 0, count);
            }
        }
        out.flush();
    }
    /** Must only be invoked when RecordingService.isRunning() is false. */
    public void recover() throws Exception { synchronized (LOCK) {
        if (RecordingService.isRunning()) return;
        File[] folders = root.listFiles();
        if (folders == null) return;
        for (File folder : folders) {
            if (!folder.isDirectory()) continue;
            JSONObject value;
            try { value = read(folder.getName()); } catch (Exception unreadable) { continue; }
            if (value.getBoolean("finished")) continue;
            int index = value.getInt("chunks");
            File partial = chunkFile(folder.getName(), index);
            while (partial.exists()) {
                long samples = WavFile.repair(partial);
                if (samples == 0) { partial.delete(); break; }
                sealChunk(folder.getName(), index, samples);
                partial = chunkFile(folder.getName(), ++index);
            }
            if (!value.getBoolean("stopped")) updateState(folder.getName(), true,
                "Android interrumpió la grabación. El audio guardado está disponible para sincronizar.");
        }
    } }
}
