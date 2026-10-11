package com.breeze.app;
import org.junit.Test;
import java.io.*;
import java.nio.file.Files;
import static org.junit.Assert.*;
public class WavFileTest {
    @Test public void writesLittleEndianAudioAndHeader() throws Exception {
        File file = File.createTempFile("breeze", ".wav");
        try {
            try (WavFile wav = new WavFile(file)) { wav.write(new short[]{0x1234, -1}, 2); }
            byte[] bytes = Files.readAllBytes(file.toPath());
            assertEquals(48, bytes.length); assertEquals('R', bytes[0]);
            assertEquals(4, bytes[40]); assertEquals(0x34, bytes[44]); assertEquals(0x12, bytes[45]);
            assertEquals((byte) 0xff, bytes[46]);
        } finally { file.delete(); }
    }
    @Test public void recoveryRepairsHeaderAndTruncatesIncompleteSample() throws Exception {
        File file = File.createTempFile("breeze", ".wav");
        try {
            try (RandomAccessFile raw = new RandomAccessFile(file, "rw")) { raw.setLength(49); }
            assertEquals(2, WavFile.repair(file));
            assertEquals(48, file.length());
            assertEquals(4, Files.readAllBytes(file.toPath())[40]);
        } finally { file.delete(); }
    }
    @Test public void streamingHeaderMatchesWriterForCombinedSamples() throws Exception {
        File file = File.createTempFile("breeze", ".wav");
        try {
            try (WavFile wav = new WavFile(file)) { wav.write(new short[]{12, 34, 56}, 3); }
            ByteArrayOutputStream merged = new ByteArrayOutputStream();
            WavFile.header(merged, 1 + 2);
            assertArrayEquals(java.util.Arrays.copyOf(Files.readAllBytes(file.toPath()), 44), merged.toByteArray());
            assertEquals(6, merged.toByteArray()[40]);
        } finally { file.delete(); }
    }
}
