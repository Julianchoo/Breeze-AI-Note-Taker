import { pgTable, text, timestamp, boolean, index, uuid, integer, doublePrecision, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import type { MeetingStatus, TranscriptSegment } from "./meeting-types";

// IMPORTANT! ID fields should ALWAYS use UUID types, EXCEPT the BetterAuth tables.


export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    // Lifetime OpenAI spend; kept here (not summed from meetings) so deleting meetings can't reset it.
    spentUsd: doublePrecision("spent_usd").default(0).notNull(),
    costLimitUsd: doublePrecision("cost_limit_usd").default(0.5).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("user_email_idx").on(table.email)]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_token_idx").on(table.token),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    index("account_provider_account_idx").on(table.providerId, table.accountId),
  ]
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const meetings = pgTable("meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").$type<MeetingStatus>().default("recording").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  durationSeconds: doublePrecision("duration_seconds").default(0).notNull(),
  costUsd: doublePrecision("cost_usd"),   // OpenAI + Soniox spend at list price; NULL = never recorded
  expectedChunks: integer("expected_chunks"),
  summary: text("summary"),
  detectedLanguage: text("detected_language"),
  error: text("error"),
  leaseToken: uuid("lease_token"),
  leaseUntil: timestamp("lease_until"),
  failures: integer("failures").default(0).notNull(),
  speakerNames: jsonb("speaker_names").$type<Record<string, string>>().default({}).notNull(),
  speakerSuggestions: jsonb("speaker_suggestions").$type<Record<string, string>>().default({}).notNull(),
  aiContext: text("ai_context"),
  // In-flight Soniox upload and transcription job; cleared once the transcript is saved or the job fails.
  sonioxFileId: text("soniox_file_id"),
  sonioxTranscriptionId: text("soniox_transcription_id"),
}, (table) => [index("meetings_user_created_idx").on(table.userId, table.createdAt)]);

export const meetingChunks = pgTable("meeting_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  index: integer("chunk_index").notNull(),
  blobPath: text("blob_path").notNull(),
  sha256: text("sha256").notNull(),
  durationSeconds: doublePrecision("duration_seconds").notNull(),
  segments: jsonb("segments").$type<TranscriptSegment[]>(),
}, (table) => [uniqueIndex("meeting_chunks_meeting_index_unique").on(table.meetingId, table.index)]);
