/**
 * Database Queries - ManagedUser
 * CRUD operations for ManagedUser table
 */

import { eq, asc } from "drizzle-orm";
import { db } from "../index";
import {
  managedUser,
  StatusEnum,
  type ManagedUser,
  type NewManagedUser,
} from "../schema";

/**
 * Find a user by their telegram ID
 */
export async function findUserByTelegramId(
  telegramId: string,
): Promise<ManagedUser | undefined> {
  const result = await db
    .select()
    .from(managedUser)
    .where(eq(managedUser.telegramId, telegramId))
    .limit(1);
  return result[0];
}

/**
 * Find a user by their internal ID
 */
export async function findUserById(
  id: number,
): Promise<ManagedUser | undefined> {
  const result = await db
    .select()
    .from(managedUser)
    .where(eq(managedUser.id, id))
    .limit(1);
  return result[0];
}

/**
 * Create a new user
 */
export async function createUser(user: NewManagedUser): Promise<ManagedUser> {
  const result = await db.insert(managedUser).values(user).returning();
  return result[0];
}

/**
 * Update user status
 */
export async function updateUserStatus(
  id: number,
  status:
    | typeof StatusEnum.PENDING
    | typeof StatusEnum.ALLOWED
    | typeof StatusEnum.REJECTED,
): Promise<ManagedUser> {
  const result = await db
    .update(managedUser)
    .set({ status, updatedAt: new Date() })
    .where(eq(managedUser.id, id))
    .returning();
  return result[0];
}

/**
 * Update user PAT token
 */
export async function updateUserPatToken(
  id: number,
  patToken: string,
): Promise<ManagedUser> {
  const result = await db
    .update(managedUser)
    .set({ patToken, updatedAt: new Date() })
    .where(eq(managedUser.id, id))
    .returning();
  return result[0];
}

/**
 * Update user by telegram ID
 */
export async function updateUserByTelegramId(
  telegramId: string,
  data: Partial<NewManagedUser>,
): Promise<ManagedUser> {
  const result = await db
    .update(managedUser)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(managedUser.telegramId, telegramId))
    .returning();
  return result[0];
}

/**
 * Delete a user by ID
 */
export async function deleteUser(id: number): Promise<void> {
  await db.delete(managedUser).where(eq(managedUser.id, id));
}

/**
 * Get all users grouped by status
 */
export async function getAllUsersGroupedByStatus(): Promise<
  Record<string, ManagedUser[]>
> {
  const allUsers = await db
    .select()
    .from(managedUser)
    .orderBy(asc(managedUser.status));

  const grouped: Record<string, ManagedUser[]> = {
    allowed: [],
    pending: [],
    rejected: [],
  };

  for (const user of allUsers) {
    if (user.status === StatusEnum.ALLOWED) {
      grouped.allowed.push(user);
    } else if (user.status === StatusEnum.PENDING) {
      grouped.pending.push(user);
    } else if (user.status === StatusEnum.REJECTED) {
      grouped.rejected.push(user);
    }
  }

  return grouped;
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<ManagedUser[]> {
  return db.select().from(managedUser).orderBy(asc(managedUser.status));
}
