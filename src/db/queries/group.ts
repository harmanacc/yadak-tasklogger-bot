/**
 * Database Queries - ManagedGroup
 * CRUD operations for ManagedGroup table
 */

import { eq, asc } from "drizzle-orm";
import { db } from "../index";
import {
  managedGroup,
  StatusEnum,
  type ManagedGroup,
  type NewManagedGroup,
} from "../schema";

/**
 * Find a group by its telegram ID
 */
export async function findGroupByTelegramId(
  telegramId: string,
): Promise<ManagedGroup | undefined> {
  const result = await db
    .select()
    .from(managedGroup)
    .where(eq(managedGroup.telegramId, telegramId))
    .limit(1);
  return result[0];
}

/**
 * Find a group by its internal ID
 */
export async function findGroupById(
  id: number,
): Promise<ManagedGroup | undefined> {
  const result = await db
    .select()
    .from(managedGroup)
    .where(eq(managedGroup.id, id))
    .limit(1);
  return result[0];
}

/**
 * Create a new group
 */
export async function createGroup(
  group: NewManagedGroup,
): Promise<ManagedGroup> {
  const result = await db.insert(managedGroup).values(group).returning();
  return result[0];
}

/**
 * Update group status
 */
export async function updateGroupStatus(
  id: number,
  status:
    | typeof StatusEnum.PENDING
    | typeof StatusEnum.ALLOWED
    | typeof StatusEnum.REJECTED,
): Promise<ManagedGroup> {
  const result = await db
    .update(managedGroup)
    .set({ status, updatedAt: new Date() })
    .where(eq(managedGroup.id, id))
    .returning();
  return result[0];
}

/**
 * Update group by telegram ID
 */
export async function updateGroupByTelegramId(
  telegramId: string,
  data: Partial<NewManagedGroup>,
): Promise<ManagedGroup> {
  const result = await db
    .update(managedGroup)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(managedGroup.telegramId, telegramId))
    .returning();
  return result[0];
}

/**
 * Delete a group by ID
 */
export async function deleteGroup(id: number): Promise<void> {
  await db.delete(managedGroup).where(eq(managedGroup.id, id));
}

/**
 * Get all groups grouped by status
 */
export async function getAllGroupsGroupedByStatus(): Promise<
  Record<string, ManagedGroup[]>
> {
  const allGroups = await db
    .select()
    .from(managedGroup)
    .orderBy(asc(managedGroup.status));

  const grouped: Record<string, ManagedGroup[]> = {
    allowed: [],
    pending: [],
    rejected: [],
  };

  for (const group of allGroups) {
    if (group.status === StatusEnum.ALLOWED) {
      grouped.allowed.push(group);
    } else if (group.status === StatusEnum.PENDING) {
      grouped.pending.push(group);
    } else if (group.status === StatusEnum.REJECTED) {
      grouped.rejected.push(group);
    }
  }

  return grouped;
}

/**
 * Get all groups
 */
export async function getAllGroups(): Promise<ManagedGroup[]> {
  return db.select().from(managedGroup).orderBy(asc(managedGroup.status));
}
