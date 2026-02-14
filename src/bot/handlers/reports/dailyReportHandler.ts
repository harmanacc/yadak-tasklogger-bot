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

type WorkItem = {
  id: number;
  fields?: Record<string, unknown>;
};

/**
 * Handle Daily Report action - sends report to the same chat where button was clicked
 */
export async function handleDailyReport(ctx: Context): Promise<void> {
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id.toString();
  const isPrivate = ctx.chat?.type === "private";

  if (!userId || !chatId) {
    await ctx.reply("❌ خطا در پردازش درخواست");
    return;
  }

  // Get user from database
  const user = await findUserByTelegramId(userId);

  if (!user) {
    if (isPrivate) {
      await ctx.reply("❌ <b>کاربر یافت نشد.</b>\n\nابتدا /start را بزنید.", {
        parse_mode: "HTML",
      });
      return;
    }
    await ctx.editMessageText(
      "❌ <b>کاربر یافت نشد.</b>\n\nابتدا در یک گروه مجاز /start را بزنید.",
      { parse_mode: "HTML", reply_markup: undefined },
    );
    return;
  }

  // Check if user has PAT token
  if (!user.patToken) {
    if (isPrivate) {
      await ctx.reply(
        "⚠️ <b>توکن Azure DevOps تنظیم نشده است.</b>\n\n" +
          "لطفاً ابتدا توکن خود را تنظیم کنید.\n" +
          "برای تنظیم توکن، روی دکمه «تنظیم توکن» کلیک کنید.",
        {
          parse_mode: "HTML",
        },
      );
      return;
    }

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
    // Show loading message
    if (isPrivate) {
      await ctx.reply("⏳ در حال دریافت گزارش...");
    } else {
      await ctx.editMessageText("⏳ در حال دریافت گزارش...", {
        reply_markup: undefined,
      });
    }

    // Fetch daily work items
    const workItems = (await getDailyWorkItems(decryptedToken)) as WorkItem[];

    // Format the response with Persian date header
    const today = formatPersianDate();
    let message = `📊 گزارش روزانه | ${today}\n\n`;

    if (workItems.length === 0) {
      message += "📭 تسکی برای امروز یافت نشد.";
    } else {
      // Helper to get work item type from item
      const getWorkItemType = (item: WorkItem) => {
        const fields = item.fields || (item as Record<string, unknown>);
        return fields["System.WorkItemType"] as string;
      };

      // Helper to get state
      const getState = (item: WorkItem) => {
        const fields = item.fields || (item as Record<string, unknown>);
        return fields["System.State"] as string;
      };

      const isClosed = (state: string) =>
        state === "Done" || state === "Closed";
      const isActive = (state: string) =>
        state === "Active" || state === "In Progress";
      const isResolved = (state: string) => state === "Resolved";
      const isNew = (state: string) =>
        state === "New" || state === "To Do" || state === "Open";

      // Group work items by type (User Story vs Task)
      const stories = workItems.filter(
        (item) => getWorkItemType(item) === "User Story",
      );
      const tasks = workItems.filter(
        (item) => getWorkItemType(item) === "Task",
      );

      // Sort each group: Active > New > Resolved > Closed
      const getSortOrder = (state: string) => {
        if (isActive(state)) return 0;
        if (isNew(state)) return 1;
        if (isResolved(state)) return 2;
        if (isClosed(state)) return 3;
        return 4;
      };

      const sortByState = (a: WorkItem, b: WorkItem) => {
        const stateA = getState(a);
        const stateB = getState(b);
        return getSortOrder(stateA) - getSortOrder(stateB);
      };

      const sortedStories = [...stories].sort(sortByState);
      const sortedTasks = [...tasks].sort(sortByState);

      // Helper to format a single item
      const formatItem = (item: WorkItem) => {
        const fields = item.fields || (item as Record<string, unknown>);
        const id = item.id;
        const title = fields["System.Title"] as string;
        const state = fields["System.State"] as string;

        // Determine emoji based on state
        let stateMark = "⚪";
        if (isClosed(state)) stateMark = "✅";
        else if (isResolved(state)) stateMark = "🟢";
        else if (isActive(state)) stateMark = "🔵";
        else if (isNew(state)) stateMark = "⚪";

        const hours = fields["Microsoft.VSTS.Scheduling.OriginalEstimate"] as
          | number
          | undefined;
        const hoursText = hours ? ` (${hours}h)` : "";

        return `${stateMark} <a href="https://vcontrol.sepasholding.com/Yagadotcom/_workitems/edit/${id}">#${id}</a> ${title}${hoursText}`;
      };

      // Add stories section
      if (sortedStories.length > 0) {
        message += `استوری‌ها (${sortedStories.length}):\n`;
        for (const item of sortedStories) {
          message += formatItem(item) + "\n";
        }
        message += "\n";
      }

      // Add tasks section
      if (sortedTasks.length > 0) {
        message += `تسک‌ها (${sortedTasks.length}):\n`;
        for (const item of sortedTasks) {
          message += formatItem(item) + "\n";
        }
      }

      // Add legend
      message += "\n🔵 Active | ⚪ New | 🟢 Resolved | ✅ Closed";
    }

    // Handle differently for private chat vs group
    if (isPrivate) {
      // Send report as a new message in private chat
      await ctx.reply(message, { parse_mode: "HTML" });
    } else {
      // Send report to the same chat (group) where button was clicked
      await ctx.reply(message, { parse_mode: "HTML" });

      // Delete the original button message
      const messageId = ctx.callbackQuery?.message?.message_id;
      if (messageId) {
        try {
          await ctx.api.deleteMessage(chatId, messageId);
        } catch {
          // Message might already be deleted or not accessible
        }
      }
    }
  } catch (error) {
    console.error("Azure DevOps error:", error);
    if (isPrivate) {
      await ctx.reply(
        "❌ <b>خطا در دریافت گزارش</b>\n\n" +
          "لطفاً توکن خود را بررسی کنید یا دوباره تلاش کنید.",
        { parse_mode: "HTML" },
      );
      return;
    }

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
