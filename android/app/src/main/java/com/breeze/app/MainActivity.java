package com.breeze.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.webkit.CookieManager;
import android.widget.EditText;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import android.util.Base64;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;

/** Only the configured HTTPS origin may load inside the privileged WebView. */
public class MainActivity extends Activity {
    private WebView web;
    private String breezeOrigin;
    private SharedPreferences preferences;
    private RecordingStore store;
    private volatile boolean visible;
    private boolean trusted(Uri uri) {
        Uri origin = Uri.parse(breezeOrigin);
        return "https".equals(uri.getScheme()) && origin.getHost().equals(uri.getHost()) && origin.getPort() == uri.getPort();
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("breeze", MODE_PRIVATE);
        breezeOrigin = preferences.getString("origin", null);
        if (breezeOrigin == null) { configureOrigin(); return; }
        initializeWeb();
        handleAuthIntent(getIntent());
    }
    private void configureOrigin() {
        EditText field = new EditText(this);
        field.setSingleLine(true);
        field.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        field.setText(BuildConfig.BREEZE_ORIGIN);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Connect Breeze")
            .setMessage("Enter your Breeze website address. Use your deployed HTTPS site.")
            .setView(field).setCancelable(false).setPositiveButton("Connect", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            try {
                Uri uri = Uri.parse(field.getText().toString().trim());
                if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null || (uri.getPath() != null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath()))) throw new IllegalArgumentException();
                breezeOrigin = "https://" + uri.getAuthority();
                preferences.edit().putString("origin", breezeOrigin).apply();
                dialog.dismiss(); initializeWeb(); handleAuthIntent(getIntent());
            } catch (Exception error) { field.setError("Enter an HTTPS origin, for example https://breeze-ai-lime.vercel.app"); }
        }));
        dialog.show();
    }
    private void initializeWeb() {
        store = new RecordingStore(this);
        if (!RecordingService.isRunning()) {
            try { store.recover(); }
            catch (Exception error) { Toast.makeText(this, "Could not recover saved recordings. Check free storage and reopen Breeze.", Toast.LENGTH_LONG).show(); }
        }
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(0);
        web.addJavascriptInterface(new Bridge(), "BreezeAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (trusted(request.getUrl())) {
                    if (request.isForMainFrame() && "/login".equals(request.getUrl().getPath())) { beginSignIn(); return true; }
                    return false;
                }
                if (request.isForMainFrame() && ("https".equals(request.getUrl().getScheme()) || "http".equals(request.getUrl().getScheme()))) {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (trusted(request.getUrl())) return null;
                // addJavascriptInterface is available to frames: never load remote frames/resources.
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
        });
        setContentView(web);
        web.loadUrl(breezeOrigin + "/meetings");
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(Build.VERSION.SDK_INT >= 33 ? new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS} : new String[]{Manifest.permission.RECORD_AUDIO}, 1);
        } else if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }
    @Override protected void onResume() { super.onResume(); visible = true; }
    @Override protected void onPause() { visible = false; super.onPause(); }
    @Override protected void onDestroy() { if (web != null) { web.removeJavascriptInterface("BreezeAndroid"); web.destroy(); } super.onDestroy(); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleAuthIntent(intent); }
    @Override protected void onActivityResult(int request, int resultCode, Intent data) {
        super.onActivityResult(request, resultCode, data);
        if (request != 41) return;
        String id = preferences.getString("exportId", null);
        String userId = preferences.getString("exportUser", null);
        preferences.edit().remove("exportId").remove("exportUser").apply();
        if (resultCode != RESULT_OK || data == null || data.getData() == null || id == null || userId == null) return;
        Uri destination = data.getData();
        new Thread(() -> {
            try (java.io.OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                if (output == null) throw new java.io.IOException("Could not open the destination file");
                store.export(id, userId, output);
                runOnUiThread(() -> Toast.makeText(this, "Audio saved", Toast.LENGTH_LONG).show());
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(this, "Could not save audio. The original recording is still on this phone; try another destination.", Toast.LENGTH_LONG).show());
            }
        }, "breeze-audio-export").start();
    }
    private static String base64(byte[] bytes) { return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING); }
    private void beginSignIn() {
        try {
            byte[] random = new byte[32]; SecureRandom rng = new SecureRandom(); rng.nextBytes(random);
            String verifier = base64(random); rng.nextBytes(random); String state = base64(random);
            String challenge = base64(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
            preferences.edit().putString("authVerifier", verifier).putString("authState", state).putLong("authStarted", System.currentTimeMillis()).apply();
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(breezeOrigin + "/android/connect?challenge=" + challenge + "&state=" + state)));
        } catch (Exception error) { Toast.makeText(this, "Could not open browser sign-in.", Toast.LENGTH_LONG).show(); }
    }
    private void handleAuthIntent(Intent intent) {
        Uri uri = intent.getData();
        if (uri == null || !"breeze".equals(uri.getScheme()) || !"auth".equals(uri.getHost()) || web == null) return;
        intent.setData(null);
        String expectedState = preferences.getString("authState", null);
        String verifier = preferences.getString("authVerifier", null);
        String state = uri.getQueryParameter("state");
        String token = uri.getQueryParameter("token");
        if (expectedState == null || verifier == null || !expectedState.equals(state) || token == null || token.length() > 4096 || System.currentTimeMillis() - preferences.getLong("authStarted", 0) > 600_000) {
            Toast.makeText(this, "Sign-in expired. Open Breeze and sign in again.", Toast.LENGTH_LONG).show(); return;
        }
        preferences.edit().remove("authState").remove("authVerifier").remove("authStarted").apply();
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(breezeOrigin + "/api/android/session").openConnection();
                connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15_000); connection.setReadTimeout(15_000);
                connection.setRequestMethod("POST"); connection.setRequestProperty("Content-Type", "application/json"); connection.setDoOutput(true);
                byte[] body = new JSONObject().put("token", token).put("state", state).put("verifier", verifier).toString().getBytes(StandardCharsets.UTF_8);
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(body); }
                if (connection.getResponseCode() != 200) throw new IllegalStateException("Sign-in failed or expired. Try again.");
                java.util.List<String> cookies = null;
                for (java.util.Map.Entry<String, java.util.List<String>> entry : connection.getHeaderFields().entrySet()) {
                    if ("Set-Cookie".equalsIgnoreCase(entry.getKey())) cookies = entry.getValue();
                }
                if (cookies == null || cookies.isEmpty()) throw new IllegalStateException("Sign-in returned no session. Try again.");
                java.util.List<String> received = cookies;
                runOnUiThread(() -> {
                    CookieManager manager = CookieManager.getInstance();
                    // Remove a stale cached session before adopting the browser's account.
                    manager.setCookie(breezeOrigin, "better-auth.session_data=; Path=/; Max-Age=0; Secure");
                    manager.setCookie(breezeOrigin, "__Secure-better-auth.session_data=; Path=/; Max-Age=0; Secure");
                    for (String cookie : received) manager.setCookie(breezeOrigin, cookie);
                    manager.flush(); if (!isFinishing() && !isDestroyed()) web.loadUrl(breezeOrigin + "/meetings");
                });
            } catch (Exception error) { runOnUiThread(() -> Toast.makeText(this, "Sign-in failed or expired. Return to Breeze and try again.", Toast.LENGTH_LONG).show()); }
            finally { if (connection != null) connection.disconnect(); }
        }, "breeze-sign-in").start();
    }
    private interface Action { JSONObject run() throws Exception; }
    private String result(Action action) {
        try { JSONObject json = action.run(); json.put("ok", true); return json.toString(); }
        catch (Exception error) { try { return new JSONObject().put("ok", false).put("error", error.getMessage() == null ? "Native recording failed" : error.getMessage()).toString(); } catch (Exception ignored) { return "{\"ok\":false,\"error\":\"Native recording failed\"}"; } }
    }
    private static void identifier(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_-]{1,128}")) throw new IllegalArgumentException("Invalid recording or user ID");
    }
    public class Bridge {
        @JavascriptInterface public void signIn() { runOnUiThread(() -> beginSignIn()); }
        @JavascriptInterface public String startRecording(String id, String userId, String title) {
            return result(() -> {
                identifier(id); identifier(userId);
                if (!visible) throw new IllegalStateException("Open Breeze to start recording");
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) throw new IllegalStateException("Enable microphone permission in Android Settings → Apps → Breeze → Permissions, then reopen Breeze");
                synchronized (RecordingService.class) {
                    if (RecordingService.isRunning()) throw new IllegalStateException("A recording is already active");
                    if (title == null || title.length() > 500) throw new IllegalArgumentException("Invalid recording title");
                    store.create(id, userId, title);
                    RecordingService.activeId = id;
                    try { startForegroundService(new Intent(MainActivity.this, RecordingService.class).putExtra("id", id).putExtra("userId", userId).putExtra("title", title)); }
                    catch (RuntimeException e) { RecordingService.activeId = null; store.updateState(id, true, e.getMessage()); throw e; }
                }
                return new JSONObject().put("recording", store.get(id, userId));
            });
        }
        @JavascriptInterface public String stopRecording() {
            return result(() -> {
                String id = RecordingService.activeId;
                if (id == null) throw new IllegalStateException("No recording is active");
                startService(new Intent(MainActivity.this, RecordingService.class).setAction("com.breeze.app.STOP"));
                return new JSONObject().put("recording", store.getActive(id));
            });
        }
        @JavascriptInterface public String getRecordings(String userId) { return result(() -> { identifier(userId); return new JSONObject().put("recordings", store.list(userId)); }); }
        @JavascriptInterface public String getSavedRecordings(String userId) { return result(() -> { identifier(userId); return new JSONObject().put("recordings", store.saved(userId)); }); }
        @JavascriptInterface public String exportRecording(String id, String userId) {
            return result(() -> {
                identifier(id); identifier(userId);
                if (!visible) throw new IllegalStateException("Open Breeze to save audio");
                JSONObject recording = store.get(id, userId);
                if (!recording.getBoolean("stopped")) throw new IllegalStateException("Stop recording before saving audio");
                synchronized (MainActivity.this) {
                    if (preferences.contains("exportId")) throw new IllegalStateException("Close the previous save dialog first");
                    preferences.edit().putString("exportId", id).putString("exportUser", userId).apply();
                }
                runOnUiThread(() -> {
                    try {
                        Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                            .setType("audio/wav").putExtra(Intent.EXTRA_TITLE, "Breeze-" + id + ".wav");
                        startActivityForResult(save, 41);
                    } catch (RuntimeException error) {
                        preferences.edit().remove("exportId").remove("exportUser").apply();
                        Toast.makeText(MainActivity.this, "No file app is available to save audio.", Toast.LENGTH_LONG).show();
                    }
                });
                return new JSONObject();
            });
        }
        @JavascriptInterface public String getRecording(String id, String userId) { return result(() -> { identifier(id); identifier(userId); return new JSONObject().put("recording", store.get(id, userId)); }); }
        @JavascriptInterface public String readChunk(String id, String userId, int index) { return result(() -> { identifier(id); identifier(userId); return store.readChunk(id, userId, index); }); }
        @JavascriptInterface public String markChunkUploaded(String id, String userId, int index) { return result(() -> { identifier(id); identifier(userId); store.markUploaded(id, userId, index); return new JSONObject(); }); }
        @JavascriptInterface public String markFinished(String id, String userId) { return result(() -> { identifier(id); identifier(userId); store.finish(id, userId); return new JSONObject(); }); }
    }
}
