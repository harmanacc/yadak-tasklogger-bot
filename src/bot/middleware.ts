/**
 * Bot Middleware
 * Middleware functions for access control and other bot behaviors
 * Groups are no longer managed - all groups are valid
 */

import { Context, NextFunction } from "grammy";
import { BOT_ADMIN_TELEGRAM_ID } from "./index";
import {
  findUserByTelegramId,
  createUser,
  updateUserByTelegramId,
} from "../db/queries/user";
import { StatusEnum } from "../db/schema";

/**
 * Check if the user is the super admin
 */
export function isAdmin(ctx: Context): boolean {
  const userId = ctx.from?.id.toString();
  const result = userId === BOT_ADMIN_TELEGRAM_ID;
  console.log("[isAdmin] Checking:", {
    userId,
    adminId: BOT_ADMIN_TELEGRAM_ID,
    result,
  });
  return result;
}

/**
 * Get the user's Telegram ID as string
 */
export function getUserTelegramId(ctx: Context): string | undefined {
  return ctx.from?.id.toString();
}

/**
 * Get the chat's Telegram ID as string
 */
export function getChatTelegramId(ctx: Context): string | undefined {
  return ctx.chat?.id.toString();
}

/**
 * Middleware to check if the update is from private chat
 */
export async function isPrivateChat(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  if (ctx.chat?.type === "private") {
    await next();
  }
}

/**
 * Middleware to check if the update is from a group
 */
export async function isGroupChat(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    await next();
  }
}

/**
 * Admin-only middleware - only allows super admin in private chat
 */
export async function adminOnly(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  console.log(
    "[adminOnly] Called, chat type:",
    ctx.chat?.type,
    "user:",
    ctx.from?.id,
  );

  // Must be private chat
  if (ctx.chat?.type !== "private") {
    console.log("[adminOnly] Not private chat, returning");
    return;
  }

  // Must be admin
  if (!isAdmin(ctx)) {
    console.log(
      "[adminOnly] Not admin, user:",
      ctx.from?.id,
      "admin:",
      BOT_ADMIN_TELEGRAM_ID,
    );
    await ctx.reply(
      "⛔ Unauthorized. This command is only for the super admin.",
    );
    return;
  }

  console.log("[adminOnly] Admin confirmed, proceeding");
  await next();
}

/**
 * Access Control Middleware
 *
 * Rules:
 * - If update is from private chat: allow all (admin handlers will check if admin)
 * - If update from group: only check user approval, auto-create user with allowed status if not exists
 * - No group checking or storing at all - all groups are valid
 */
export async function accessControl(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const chatId = getChatTelegramId(ctx);
  const userId = getUserTelegramId(ctx);

  // Private chat - allow all (admin handlers will check if admin)
  if (ctx.chat?.type === "private") {
    await next();
    return;
  }

  // Group chat - only check user, no group logic
  if (
    chatId &&
    (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup")
  ) {
    try {
      // Auto-create user with allowed status if not exists
      if (userId) {
        let user = await findUserByTelegramId(userId);
        if (!user) {
          const userName = ctx.from?.first_name || "Unknown";
          const username = ctx.from?.username;
          await createUser({
            telegramId: userId,
            name: userName,
            username: username,
            status: StatusEnum.ALLOWED, // Auto-allow users
          });
        } else if (user.status !== StatusEnum.ALLOWED) {
          // Update existing pending/rejected users to allowed
          await updateUserByTelegramId(userId, {
            status: StatusEnum.ALLOWED,
          });
        }
      }
    } catch (error) {
      console.error("[AccessControl] Error:", error);
    }

    // Proceed to next handler - no group checking
    await next();
    return;
  }

  // For other chat types, just proceed
  await next();
}
