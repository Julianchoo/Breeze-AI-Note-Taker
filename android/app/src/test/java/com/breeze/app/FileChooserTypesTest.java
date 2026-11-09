package com.breeze.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class FileChooserTypesTest {
    @Test public void splitsCommaJoinedAcceptString() {
        assertArrayEquals(new String[]{"audio/*", "video/*"}, FileChooserTypes.mimeTypes(new String[]{"audio/*, video/*"}));
    }
    @Test public void mergesSeparateEntriesAndDropsExtensionsAndDuplicates() {
        assertArrayEquals(new String[]{"audio/*", "video/mp4"}, FileChooserTypes.mimeTypes(new String[]{"Audio/*", ".mp3", "", null, "video/mp4", "audio/*"}));
    }
    @Test public void emptyAcceptAllowsAnyFile() {
        assertEquals(0, FileChooserTypes.mimeTypes(null).length);
        assertEquals(0, FileChooserTypes.mimeTypes(new String[]{""}).length);
        assertEquals("*/*", FileChooserTypes.intentType(new String[0]));
    }
    @Test public void singleTypeIsUsedDirectly() {
        assertEquals("audio/*", FileChooserTypes.intentType(new String[]{"audio/*"}));
        assertEquals("*/*", FileChooserTypes.intentType(new String[]{"audio/*", "video/*"}));
    }
}
