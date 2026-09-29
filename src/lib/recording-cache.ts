export type CachedRecording = {
  id: string;
  userId: string;
  title: string;
  chunks: number;
  samples: number;
  stopped: boolean;
  /** Set once the server confirmed the recording; the local copy is then kept only for the user to download. */
  finished?: boolean;
};
// `uploaded` is per chunk (not a count on the recording) because recording snapshots are re-put on every chunk and would overwrite a count.
type CachedChunk = {
  key: string;
  recordingId: string;
  userId: string;
  index: number;
  blob: Blob;
  uploaded?: boolean;
};

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("breeze-recordings", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("recordings", { keyPath: "id" });
      request.result.createObjectStore("chunks", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => IDBRequest<T>
) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const request = work(tx);
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Could not save audio on this device."));
    };
  });
}

/** Every chunk key of one recording; keys are `${userId}:${id}:${index}`. */
function chunkRange(userId: string, id: string) {
  return IDBKeyRange.bound(`${userId}:${id}:`, `${userId}:${id}:￿`);
}

export async function saveRecording(recording: CachedRecording) {
  await transaction(["recordings"], "readwrite", (tx) =>
    tx.objectStore("recordings").put(recording)
  );
}
export async function cacheChunk(recording: CachedRecording, index: number, blob: Blob) {
  await transaction(["recordings", "chunks"], "readwrite", (tx) => {
    tx.objectStore("chunks").put({
      key: `${recording.userId}:${recording.id}:${index}`,
      recordingId: recording.id,
      userId: recording.userId,
      index,
      blob,
    } satisfies CachedChunk);
    return tx.objectStore("recordings").put(recording);
  });
}
/** Unfinished recordings only — the ones that still need uploading. */
export async function listRecordings(userId: string) {
  const rows = await transaction<CachedRecording[]>(["recordings"], "readonly", (tx) =>
    tx.objectStore("recordings").getAll()
  );
  return rows.filter((row) => row.userId === userId && !row.finished);
}
export async function readChunk(userId: string, id: string, index: number) {
  return transaction<CachedChunk | undefined>(["chunks"], "readonly", (tx) =>
    tx.objectStore("chunks").get(`${userId}:${id}:${index}`)
  );
}
export async function markChunkUploaded(chunk: CachedChunk) {
  await transaction(["chunks"], "readwrite", (tx) =>
    tx.objectStore("chunks").put({ ...chunk, uploaded: true } satisfies CachedChunk)
  );
}
/** The finished local copy of a meeting's recording on this device, if any. */
export async function findFinishedRecording(meetingId: string, userId: string) {
  const row = await transaction<CachedRecording | undefined>(["recordings"], "readonly", (tx) =>
    tx.objectStore("recordings").get(meetingId)
  );
  return row?.userId === userId && row.finished ? row : undefined;
}
/** Deletes a recording and all of its chunks. */
export async function deleteRecording(userId: string, id: string) {
  await transaction(["recordings", "chunks"], "readwrite", (tx) => {
    tx.objectStore("chunks").delete(chunkRange(userId, id));
    return tx.objectStore("recordings").delete(id);
  });
}

/** Joins 16 kHz mono PCM16 WAV parts into one WAV: part 0's header with the sizes rewritten, then every part's samples. */
export async function mergeWav(parts: Blob[]) {
  if (!parts.length) throw new Error("No audio to download.");
  const header = new DataView(await parts[0]!.slice(0, 44).arrayBuffer());
  const size = parts.reduce((sum, part) => sum + part.size - 44, 0);
  header.setUint32(4, 36 + size, true);
  header.setUint32(40, size, true);
  return new Blob([header, ...parts.map((part) => part.slice(44))], { type: "audio/wav" });
}
/** Builds one WAV from a local recording. Missing chunks (e.g. the part cut off by a crash) are skipped. */
export async function recordingWav(recording: CachedRecording) {
  const rows = await transaction<CachedChunk[]>(["chunks"], "readonly", (tx) =>
    tx.objectStore("chunks").getAll(chunkRange(recording.userId, recording.id))
  );
  // Keys sort as strings ("10" before "2"), so order by index.
  return mergeWav(rows.sort((a, b) => a.index - b.index).map((row) => row.blob));
}
