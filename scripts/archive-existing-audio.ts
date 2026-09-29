// One-off: removes the audio of already-transcribed meetings from Blob (the admin's is archived to OneDrive first).
// Dry run by default; `npx tsx scripts/archive-existing-audio.ts --apply` changes data.
process.loadEnvFile();
const apply = process.argv.includes("--apply");

async function main() {
  // Imported after .env is loaded: db.ts reads POSTGRES_URL at import time.
  const { and, eq, isNull, lt, or } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db");
  const { isAdmin, releaseAudio } = await import("../src/lib/meetings");
  const { meetingChunks, meetings } = await import("../src/lib/schema");
  const rows = await db.select().from(meetings);
  const chunks = await db.select().from(meetingChunks);
  const totals = { archived: 0, deleted: 0, untranscribed: 0, failed: 0 };
  for (const row of rows) {
    const parts = chunks.filter(c => c.meetingId === row.id).sort((a, b) => a.index - b.index);
    if (!parts.some(c => c.blobPath)) continue;
    // Untranscribed audio is still needed by Soniox.
    if (parts.some(c => c.segments === null)) { totals.untranscribed++; console.log(`skip     ${row.id}  not fully transcribed`); continue; }
    const admin = await isAdmin(row.userId), action = admin ? "archive" : "delete ";
    console.log(`${action}  ${row.id}  ${parts.length} parts  ${row.createdAt.toISOString().slice(0, 10)} ${row.title}`);
    if (!apply) { totals[admin ? "archived" : "deleted"]++; continue; }
    try {
      // Skip meetings the app is processing right now.
      await releaseAudio(row, parts, admin, and(eq(meetings.id, row.id), or(isNull(meetings.leaseUntil), lt(meetings.leaseUntil, new Date()))));
      totals[admin ? "archived" : "deleted"]++;
    } catch (error) { totals.failed++; console.error(`failed   ${row.id}`, error instanceof Error ? error.message : error); }
  }
  console.log(`${apply ? "Applied" : "Dry run (pass --apply to change data)"}: ${totals.archived} archived to OneDrive, ${totals.deleted} deleted, ${totals.untranscribed} skipped (not transcribed), ${totals.failed} failed.`);
  process.exit(totals.failed ? 1 : 0);
}
void main();
