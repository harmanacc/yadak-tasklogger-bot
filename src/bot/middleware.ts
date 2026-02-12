/**
 * Bot Middleware
 * Middleware functions for access control and other bot behaviors
 */

import { Context, NextFunction } from "grammy";
import { bot, BOT_ADMIN_TELEGRAM_ID } from "./index";
import { findGroupByTelegramId, createGroup } from "../db/queries/group";
import { findUserByTelegramId, createUser } from "../db/queries/user";
import { StatusEnum } from "../db/schema";

/**
 * Check if the user is the super admin
 */
export function isAdmin(ctx: Context): boolean {
  const userId = ctx.from?.id.toString();
  return userId === BOT_ADMIN_TELEGRAM_ID;
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
  // Must be private chat
  if (ctx.chat?.type !== "private") {
    return;
  }

  // Must be admin
  if (!isAdmin(ctx)) {
    await ctx.reply(
      "⛔ Unauthorized. This command is only for the super admin.",
    );
    return;
  }

  await next();
}

/**
 * Access Control Middleware
 *
 * Rules:
 * - If update is from private chat and user is admin → allow
 * - If update is from group:
 *   - Load ManagedGroup by telegramId
 *   - If not found → trigger Group Discovery Flow
 *   - If status !== allowed → ignore update
 *   - If allowed → process normally
 */
export async function accessControl(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  const chatId = getChatTelegramId(ctx);
  const userId = getUserTelegramId(ctx);

  // Private chat - check if admin
  if (ctx.chat?.type === "private") {
    if (isAdmin(ctx)) {
      await next();
    }
    // Allow other private chats for now (can be extended later)
    // TODO: Decide if we need to manage users in private chat
    return;
  }

  // Group chat - check group status
  if (
    chatId &&
    (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup")
  ) {
    const group = await findGroupByTelegramId(chatId);

    if (!group) {
      // Group not found - trigger Group Discovery Flow
      await triggerGroupDiscovery(ctx, chatId);
      return;
    }

    if (group.status !== StatusEnum.ALLOWED) {
      // Group is not allowed - ignore
      return;
    }

    // Group is allowed - also check user status
    if (userId) {
      const user = await findUserByTelegramId(userId);

      if (!user) {
        // User not found in group - trigger user discovery
        await triggerUserDiscovery(ctx, userId);
        return;
      }

      if (user.status !== StatusEnum.ALLOWED) {
        // User is not allowed - ignore
        return;
      }
    }

    // Group and user are allowed - proceed
    await next();
  }
}

/**
 * Trigger Group Discovery Flow
 *
 * When the bot receives any update from a group and user that does not exist:
 * 1. Insert group with status = pending
 * 2. Insert user with status = pending
 * 3. Notify super admin in private chat
 * 4. Send approval message with inline buttons
 */
async function triggerGroupDiscovery(
  ctx: Context,
  chatId: string,
): Promise<void> {
  const chatTitle = ctx.chat?.title || "Unknown Group";
  const userId = getUserTelegramId(ctx);
  const userName = ctx.from?.first_name || "Unknown";
  const username = ctx.from?.username;

  try {
    // Create pending group
    await createGroup({
      telegramId: chatId,
      title: chatTitle,
      status: StatusEnum.PENDING,
    });

    // Create pending user if exists
    if (userId) {
      await createUser({
        telegramId: userId,
        name: userName,
        username: username,
        status: StatusEnum.PENDING,
      });
    }

    // Notify super admin
    const adminId = BOT_ADMIN_TELEGRAM_ID;

    if (!adminId) {
      console.error("[Group Discovery] Admin ID not configured");
      return;
    }

    const message =
      `🔔 <b>New Group Request</b>\n\n` +
      `📍 <b>Group:</b> ${chatTitle}\n` +
      `🆔 <b>Group ID:</b> <code>${chatId}</code>\n` +
      `👤 <b>User:</b> ${userName}${username ? ` (@${username})` : ""}\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>`;

    // Send approval message to admin with inline keyboard
    await bot.api.sendMessage(adminId, message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_group:${chatId}` },
            { text: "❌ Reject", callback_data: `reject_group:${chatId}` },
          ],
        ],
      },
    });

    console.log(
      `[Group Discovery] New group ${chatTitle} (${chatId}) added as pending`,
    );
  } catch (error) {
    console.error("[Group Discovery] Error:", error);
  }
}

/**
 * Trigger User Discovery Flow
 * For when a user interacts with the bot but doesn't exist in the database
 */
async function triggerUserDiscovery(
  ctx: Context,
  userId: string,
): Promise<void> {
  const userName = ctx.from?.first_name || "Unknown";
  const username = ctx.from?.username;

  try {
    // Create pending user
    await createUser({
      telegramId: userId,
      name: userName,
      username: username,
      status: StatusEnum.PENDING,
    });

    // Notify super admin
    const adminId = BOT_ADMIN_TELEGRAM_ID;

    if (!adminId) {
      console.error("[User Discovery] Admin ID not configured");
      return;
    }

    const message =
      `🔔 <b>New User Request</b>\n\n` +
      `👤 <b>User:</b> ${userName}${username ? ` (@${username})` : ""}\n` +
      `🆔 <b>User ID:</b> <code>${userId}</code>`;

    await bot.api.sendMessage(adminId, message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_user:${userId}` },
            { text: "❌ Reject", callback_data: `reject_user:${userId}` },
          ],
        ],
      },
    });

    console.log(
      `[User Discovery] New user ${userName} (${userId}) added as pending`,
    );
  } catch (error) {
    console.error("[User Discovery] Error:", error);
  }
}
