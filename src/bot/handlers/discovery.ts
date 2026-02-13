/**
 * Discovery Handler
 * Handles callback queries from approval buttons for users only
 * Groups are no longer managed - all groups are valid
 */

import { Context } from "grammy";
import { bot, BOT_ADMIN_TELEGRAM_ID } from "../index";
import { findUserByTelegramId, updateUserStatus } from "../../db/queries/user";
import { StatusEnum } from "../../db/schema";

/**
 * Handle callback queries from admin approval buttons
 */
export function setupDiscoveryHandlers(): void {
  // Handle approve/reject user callbacks
  bot.callbackQuery(/^(approve_user|reject_user):(.+)$/, async (ctx) => {
    // Only allow admin to handle these callbacks
    const userId = ctx.from?.id.toString();
    if (userId !== BOT_ADMIN_TELEGRAM_ID) {
      await ctx.answerCallbackQuery({
        text: "⛔ Unauthorized",
        show_alert: true,
      });
      return;
    }

    const callbackData = ctx.callbackQuery.data;
    const [action, telegramId] = callbackData.split(":");

    try {
      if (action === "approve_user") {
        await handleApproveUser(ctx, telegramId);
      } else if (action === "reject_user") {
        await handleRejectUser(ctx, telegramId);
      }
    } catch (error) {
      console.error("[Discovery Handler] Error:", error);
      await ctx.answerCallbackQuery({
        text: "❌ Error processing request",
        show_alert: true,
      });
    }
  });
}

/**
 * Handle user approval
 */
async function handleApproveUser(
  ctx: Context,
  telegramId: string,
): Promise<void> {
  const user = await findUserByTelegramId(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery({
      text: "❌ User not found",
      show_alert: true,
    });
    return;
  }

  // Update user status to allowed
  await updateUserStatus(user.id, StatusEnum.ALLOWED);

  // Edit the original message to show approval
  const newMessage =
    `✅ <b>User Approved</b>\n\n` +
    `👤 <b>User:</b> ${user.name}${user.username ? ` (@${user.username})` : ""}\n` +
    `🆔 <b>User ID:</b> <code>${telegramId}</code>\n\n` +
    `The user is now allowed to use the bot.`;

  await ctx.editMessageText(newMessage, {
    parse_mode: "HTML",
    reply_markup: undefined,
  });

  await ctx.answerCallbackQuery({
    text: "✅ User approved",
  });

  console.log(`[Discovery] User ${user.name} (${telegramId}) approved`);
}

/**
 * Handle user rejection
 */
async function handleRejectUser(
  ctx: Context,
  telegramId: string,
): Promise<void> {
  const user = await findUserByTelegramId(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery({
      text: "❌ User not found",
      show_alert: true,
    });
    return;
  }

  // Update user status to rejected
  await updateUserStatus(user.id, StatusEnum.REJECTED);

  // Edit the original message to show rejection
  const newMessage =
    `❌ <b>User Rejected</b>\n\n` +
    `👤 <b>User:</b> ${user.name}${user.username ? ` (@${user.username})` : ""}\n` +
    `🆔 <b>User ID:</b> <code>${telegramId}</code>\n\n` +
    `The user has been rejected and cannot use the bot.`;

  await ctx.editMessageText(newMessage, {
    parse_mode: "HTML",
    reply_markup: undefined,
  });

  await ctx.answerCallbackQuery({
    text: "❌ User rejected",
  });

  console.log(`[Discovery] User ${user.name} (${telegramId}) rejected`);
}
