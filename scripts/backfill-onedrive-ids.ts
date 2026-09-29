// One-off: stores the OneDrive item id of the admin's meetings archived before ids were kept, matched by exact file name
// (archiveName) in "Audios Breeze". Ambiguous or missing names are reported and skipped, never guessed.
// Dry run by default; `npx tsx scripts/backfill-onedrive-ids.ts --apply` writes the ids.
process.loadEnvFile();
const apply = process.argv.includes("--apply");

async function main() {
  // Imported after .env is loaded: db.ts reads POSTGRES_URL at import time.
  const { and, eq, isNotNull, isNull } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db");
  const { isAdmin } = await import("../src/lib/meetings");
  const { FOLDER, archiveName, graphGet } = await import("../src/lib/onedrive");
  const { meetingChunks, meetings } = await import("../src/lib/schema");
  const rows = await db.select({ id: meetings.id, userId: meetings.userId, title: meetings.title, createdAt: meetings.createdAt }).from(meetings).where(isNull(meetings.onedriveItemId));
  // Audio still in Blob is not archived yet; releaseAudio stores its id when it is.
  const inBlob = new Set((await db.selectDistinct({ id: meetingChunks.meetingId }).from(meetingChunks).where(isNotNull(meetingChunks.blobPath))).map(c => c.id));
  const totals = { matched: 0, missing: 0, ambiguous: 0, skipped: 0 };
  for (const userId of new Set(rows.map(r => r.userId))) {
    if (!(await isAdmin(userId))) continue;
    const files = new Map<string, string>();
    for (let next: string | undefined = `/me/drive/root:/${encodeURIComponent(FOLDER)}:/children?$select=id,name&$top=200`; next;) {
      const page = await graphGet(userId, next) as { value: { id: string; name: string }[]; "@odata.nextLink"?: string };
      for (const file of page.value) files.set(file.name, file.id);
      next = page["@odata.nextLink"];
    }
    console.log(`${files.size} files in "${FOLDER}"`);
    const mine = rows.filter(r => r.userId === userId).map(r => ({ ...r, name: archiveName(r.createdAt, r.title) }));
    for (const row of mine) {
      if (inBlob.has(row.id)) { totals.skipped++; console.log(`skip       ${row.id}  audio not archived yet`); continue; }
      const fileId = files.get(row.name);
      if (!fileId) { totals.missing++; console.log(`no file    ${row.id}  ${row.name}`); continue; }
      if (mine.filter(r => r.name === row.name).length > 1) { totals.ambiguous++; console.log(`ambiguous  ${row.id}  ${row.name}`); continue; }
      totals.matched++;
      console.log(`match      ${row.id}  ${row.name}`);
      if (apply) await db.update(meetings).set({ onedriveItemId: fileId }).where(and(eq(meetings.id, row.id), isNull(meetings.onedriveItemId)));
    }
  }
  console.log(`${apply ? "Applied" : "Dry run (pass --apply to write ids)"}: ${totals.matched} matched, ${totals.missing} without a file, ${totals.ambiguous} ambiguous, ${totals.skipped} not archived yet.`);
  process.exit(0);
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
export {}; // a module, so its names do not clash with the other scripts
