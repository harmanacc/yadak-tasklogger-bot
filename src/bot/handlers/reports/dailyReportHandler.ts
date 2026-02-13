/**
 * Daily Report Handler
 * Handles Daily Report button - queries Azure DevOps and sends report to the same chat
 */

import { Context } from "grammy";
import { findUserByTelegramId } from "../../../db/queries";
import { getDailyWorkItems } from "../../../services/azure-devops";
import { formatPersianDate } from "../../../utils/date";
import { decryptToken } from "../../../utils/crypto";
import { MessageType, trackMessage } from "../../../services/messageService";

/**
 * Handle Daily Report action - sends report to the same chat where button was clicked
 */
export async function handleDailyReport(ctx: Context): Promise<void> {
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id.toString();

  if (!userId || !chatId) {
    await ctx.reply("❌ خطا در پردازش درخواست");
    return;
  }

  // Get user from database
  const user = await findUserByTelegramId(userId);

  if (!user) {
    await ctx.editMessageText(
      "❌ <b>کاربر یافت نشد.</b>\n\nابتدا در یک گروه مجاز /start را بزنید.",
      { parse_mode: "HTML", reply_markup: undefined },
    );
    return;
  }

  // Check if user has PAT token
  if (!user.patToken) {
    const messageId = ctx.callbackQuery?.message?.message_id;
    if (messageId) {
      await ctx.editMessageText(
        "⚠️ <b>توکن Azure DevOps تنظیم نشده است.</b>\n\n" +
          "لطفاً ابتدا توکن خود را تنظیم کنید.\n" +
          "برای تنظیم توکن، روی دکمه «تنظیم توکن» کلیک کنید.",
        {
          parse_mode: "HTML",
          reply_markup: undefined,
        },
      );
      await trackMessage(
        ctx.api,
        chatId,
        messageId,
        MessageType.DAILY_REPORT,
        user.id,
      );
    }
    return;
  }

  // Decrypt the token
  const decryptedToken = decryptToken(user.patToken);

  try {
    // Get message ID for tracking
    const messageId = ctx.callbackQuery?.message?.message_id;

    // Show loading message in group
    await ctx.editMessageText("⏳ در حال دریافت گزارش...", {
      reply_markup: undefined,
    });

    // Fetch daily work items
    const workItems = await getDailyWorkItems(decryptedToken);

    // Format the response with Persian date header
    const today = formatPersianDate();
    let message = `📊 <b>گزارش روزانه</b>\n\n📅 تاریخ: ${today}\n\n`;

    if (workItems.length === 0) {
      message += "📭 تسک‌ی برای امروز یافت نشد.";
    } else {
      message += `📋 <b>${workItems.length}   استوری یا تسک:</b>\n\n`;

      for (const item of workItems) {
        // Work items from batch API have fields nested inside 'fields' property
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields =
          ((item as any).fields as Record<string, unknown>) || item;
        const id = item.id;
        const title = fields["System.Title"] as string;
        const state = fields["System.State"] as string;
        const workItemType = fields["System.WorkItemType"] as string;
        const originalEstimate = fields[
          "Microsoft.VSTS.Scheduling.OriginalEstimate"
        ] as number | undefined;
        const completedWork = fields[
          "Microsoft.VSTS.Scheduling.CompletedWork"
        ] as number | undefined;

        // State emoji based on work item state
        const stateEmoji =
          state === "Done" || state === "Closed"
            ? "✅"
            : state === "In Progress" || state === "Active"
              ? "🔄"
              : state === "To Do"
                ? "⬜"
                : "⏳";

        // Work item type emoji
        const typeEmoji = workItemType === "User Story" ? "📖" : "📝";

        // Format work hours
        let hoursText = "";
        if (originalEstimate !== undefined || completedWork !== undefined) {
          const estimate = originalEstimate ?? 0;
          const completed = completedWork ?? 0;
          hoursText = ` (${completed}/${estimate}h)`;
        }

        message += `${stateEmoji} ${typeEmoji} <a href="https://vcontrol.sepasholding.com/Yadakdotcom/_workitems/edit/${id}">#${id}</a> ${title}${hoursText}\n`;
        message += `   📌 ${state} | ${workItemType}\n\n`;
      }
    }

    // Send report to the same chat (group) where button was clicked
    await ctx.reply(message, { parse_mode: "HTML" });

    // Delete the original button message
    if (messageId) {
      try {
        await ctx.api.deleteMessage(chatId, messageId);
      } catch {
        // Message might already be deleted or not accessible
      }
    }
  } catch (error) {
    console.error("Azure DevOps error:", error);
    const messageId = ctx.callbackQuery?.message?.message_id;
    if (messageId) {
      await ctx.editMessageText(
        "❌ <b>خطا در دریافت گزارش</b>\n\n" +
          "لطفاً توکن خود را بررسی کنید یا دوباره تلاش کنید.",
        { parse_mode: "HTML", reply_markup: undefined },
      );
      await trackMessage(
        ctx.api,
        chatId,
        messageId,
        MessageType.DAILY_REPORT,
        user.id,
      );
    }
  }
}
