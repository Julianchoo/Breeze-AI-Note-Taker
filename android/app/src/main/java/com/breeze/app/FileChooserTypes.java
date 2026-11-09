package com.breeze.app;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Locale;

/**
 * Turns an HTML input's accept types into MIME types for the Android picker.
 * WebView versions differ: some pass one comma-joined string ("audio/*,video/*"),
 * others one entry per type. File extensions (".mp3") cannot be expressed as an
 * intent MIME filter, so they are dropped; the web page validates the file anyway.
 */
final class FileChooserTypes {
    private FileChooserTypes() {}

    static String[] mimeTypes(String[] acceptTypes) {
        LinkedHashSet<String> types = new LinkedHashSet<>();
        if (acceptTypes != null) {
            for (String entry : acceptTypes) {
                if (entry == null) continue;
                for (String part : entry.split(",")) {
                    String type = part.trim().toLowerCase(Locale.ROOT);
                    if (type.indexOf('/') > 0 && !type.endsWith("/")) types.add(type);
                }
            }
        }
        return new ArrayList<>(types).toArray(new String[0]);
    }

    /** The single intent type: the only accepted type, or a wildcard narrowed by EXTRA_MIME_TYPES. */
    static String intentType(String[] mimeTypes) {
        return mimeTypes.length == 1 ? mimeTypes[0] : "*/*";
    }
}
