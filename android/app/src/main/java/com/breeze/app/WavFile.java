package com.breeze.app;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.io.RandomAccessFile;

/** Recoverable PCM16 mono WAV writer: a crash leaves raw data after a 44-byte header. */
public final class WavFile implements AutoCloseable {
    public static final int RATE = 16000;
    private final RandomAccessFile file;
    private long samples;
    public WavFile(File target) throws IOException {
        file = new RandomAccessFile(target, "rw");
        file.setLength(44);
        header(file, 0);
        file.seek(44);
    }
    public void write(short[] data, int count) throws IOException {
        byte[] bytes = new byte[count * 2];
        for (int i = 0; i < count; i++) {
            bytes[i * 2] = (byte) data[i];
            bytes[i * 2 + 1] = (byte) (data[i] >> 8);
        }
        file.write(bytes);
        samples += count;
    }
    public long samples() { return samples; }
    public void sync() throws IOException { file.getFD().sync(); }
    @Override public void close() throws IOException {
        try { header(file, samples * 2); file.getFD().sync(); }
        finally { file.close(); }
    }
    public static long repair(File target) throws IOException {
        try (RandomAccessFile file = new RandomAccessFile(target, "rw")) {
            long bytes = Math.max(0, file.length() - 44) / 2 * 2;
            file.setLength(44 + bytes);
            header(file, bytes);
            file.getFD().sync();
            return bytes / 2;
        }
    }
    public static void header(OutputStream out, long samples) throws IOException {
        long bytes = samples * 2;
        if (samples < 0 || bytes > 0xffffffffL - 36) throw new IOException("Audio exceeds WAV size limit");
        ByteBuffer header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        header.put(new byte[]{'R','I','F','F'}).putInt((int) (bytes + 36));
        header.put(new byte[]{'W','A','V','E','f','m','t',' '}).putInt(16);
        header.putShort((short) 1).putShort((short) 1).putInt(RATE).putInt(RATE * 2);
        header.putShort((short) 2).putShort((short) 16);
        header.put(new byte[]{'d','a','t','a'}).putInt((int) bytes);
        out.write(header.array());
    }
    private static void header(RandomAccessFile file, long bytes) throws IOException {
        file.seek(0);
        file.writeBytes("RIFF"); le32(file, bytes + 36); file.writeBytes("WAVEfmt ");
        le32(file, 16); le16(file, 1); le16(file, 1); le32(file, RATE);
        le32(file, RATE * 2); le16(file, 2); le16(file, 16);
        file.writeBytes("data"); le32(file, bytes);
    }
    private static void le16(RandomAccessFile file, int value) throws IOException {
        file.write(value); file.write(value >> 8);
    }
    private static void le32(RandomAccessFile file, long value) throws IOException {
        for (int i = 0; i < 4; i++) file.write((int) (value >> (8 * i)));
    }
}
