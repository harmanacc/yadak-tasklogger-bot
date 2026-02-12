import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// Status enum type
export const StatusEnum = {
  PENDING: "pending",
  ALLOWED: "allowed",
  REJECTED: "rejected",
} as const;

export type Status = (typeof StatusEnum)[keyof typeof StatusEnum];

// Work session type enum
export const WorkTypeEnum = {
  START: "start",
  FINISH: "finish",
} as const;

export type WorkType = (typeof WorkTypeEnum)[keyof typeof WorkTypeEnum];

// Work location enum
export const WorkLocationEnum = {
  OFFICE: "office",
  REMOTE: "remote",
} as const;

export type WorkLocation =
  (typeof WorkLocationEnum)[keyof typeof WorkLocationEnum];

// Job status enum
export const JobStatusEnum = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type JobStatus = (typeof JobStatusEnum)[keyof typeof JobStatusEnum];

// ManagedGroup table
export const managedGroup = sqliteTable("managed_group", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramId: text("telegram_id").notNull().unique(),
  title: text("title").notNull(),
  status: text("status", {
    enum: [StatusEnum.PENDING, StatusEnum.ALLOWED, StatusEnum.REJECTED],
  })
    .notNull()
    .default(StatusEnum.PENDING),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ManagedUser table
export const managedUser = sqliteTable("managed_user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramId: text("telegram_id").notNull().unique(),
  name: text("name").notNull(),
  username: text("username"),
  status: text("status", {
    enum: [StatusEnum.PENDING, StatusEnum.ALLOWED, StatusEnum.REJECTED],
  })
    .notNull()
    .default(StatusEnum.PENDING),
  patToken: text("pat_token"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// WorkSession table
export const workSession = sqliteTable("work_session", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => managedUser.id),
  groupId: integer("group_id")
    .notNull()
    .references(() => managedGroup.id),
  type: text("type", {
    enum: [WorkTypeEnum.START, WorkTypeEnum.FINISH],
  }).notNull(),
  location: text("location", {
    enum: [WorkLocationEnum.OFFICE, WorkLocationEnum.REMOTE],
  }),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// BotMessage table
export const botMessage = sqliteTable("bot_message", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  messageId: integer("message_id").notNull(),
  userId: integer("user_id").references(() => managedUser.id),
  type: text("type").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Job table - generic scheduler job with description and time
export const job = sqliteTable("job", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(), // Job description (e.g., "offday reminder")
  payload: text("payload"), // JSON string for additional data
  dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
  executedAt: integer("executed_at", { mode: "timestamp" }),
  status: text("status", {
    enum: [
      JobStatusEnum.PENDING,
      JobStatusEnum.COMPLETED,
      JobStatusEnum.FAILED,
    ],
  })
    .notNull()
    .default(JobStatusEnum.PENDING),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Type exports for queries
export type ManagedGroup = typeof managedGroup.$inferSelect;
export type NewManagedGroup = typeof managedGroup.$inferInsert;

export type ManagedUser = typeof managedUser.$inferSelect;
export type NewManagedUser = typeof managedUser.$inferInsert;

export type WorkSession = typeof workSession.$inferSelect;
export type NewWorkSession = typeof workSession.$inferInsert;

export type BotMessage = typeof botMessage.$inferSelect;
export type NewBotMessage = typeof botMessage.$inferInsert;

export type Job = typeof job.$inferSelect;
export type NewJob = typeof job.$inferInsert;
