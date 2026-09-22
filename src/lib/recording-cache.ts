export type CachedRecording = {
  id: string;
  userId: string;
  title: string;
  chunks: number;
  samples: number;
  stopped: boolean;
};
type CachedChunk = { key: string; recordingId: string; userId: string; index: number; blob: Blob };

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
export async function listRecordings(userId: string) {
  const rows = await transaction<CachedRecording[]>(["recordings"], "readonly", (tx) =>
    tx.objectStore("recordings").getAll()
  );
  return rows.filter((row) => row.userId === userId);
}
export async function readChunk(userId: string, id: string, index: number) {
  return transaction<CachedChunk | undefined>(["chunks"], "readonly", (tx) =>
    tx.objectStore("chunks").get(`${userId}:${id}:${index}`)
  );
}
export async function deleteChunk(userId: string, id: string, index: number) {
  await transaction(["chunks"], "readwrite", (tx) =>
    tx.objectStore("chunks").delete(`${userId}:${id}:${index}`)
  );
}
export async function deleteRecording(id: string) {
  await transaction(["recordings"], "readwrite", (tx) => tx.objectStore("recordings").delete(id));
}
