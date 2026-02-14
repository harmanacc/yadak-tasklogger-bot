/**
 * Daily Report Handler
 * Handles Daily Report button - queries Azure DevOps and sends report to the same chat
 */

import { Context } from "grammy";
import { findUserByTelegramId } from "../../../db/queries";
import {
  getDailyWorkItems,
  getCurrentUser,
} from "../../../services/azure-devops";
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

    // Get current user to compare with ChangedBy
    const currentUser = await getCurrentUser(decryptedToken);
    const currentUserDisplayName = currentUser?.displayName || "";

    // Helper to get first 2 words from a name
    const getFirstTwoWords = (name: string): string => {
      const words = name.trim().split(/\s+/);
      return words.slice(0, 2).join(" ").toLowerCase();
    };

    // Helper to extract ChangedBy from item (it's a string in format "Name <domain\account>")
    const getChangedBy = (item: WorkItem): string => {
      const fields = item.fields || (item as Record<string, unknown>);
      const changedBy = fields["System.ChangedBy"] as string;
      return changedBy || "";
    };

    // Helper to check if item was changed by current user
    const isChangedByMe = (item: WorkItem) => {
      const changedBy = getChangedBy(item);
      if (!changedBy || !currentUserDisplayName) return false;

      // Extract the name part from "Name <domain\account>"
      const changedByName = changedBy.split(" <")[0].trim();

      // Compare first 2 words
      const changedByFirstTwo = getFirstTwoWords(changedByName);
      const userFirstTwo = getFirstTwoWords(currentUserDisplayName);

      return changedByFirstTwo === userFirstTwo;
    };

    // Format the response with Persian date header
    const today = formatPersianDate();
    let message = `📊 گزارش روزانه | ${today}\n\n`;

    if (workItems.length === 0) {
      message += "📭 تسکی برای امروز یافت نشد.";
    } else {
      // Group work items by who changed them (By Me vs By Others)
      const changedByMe = workItems.filter((item) => isChangedByMe(item));
      const changedByOthers = workItems.filter((item) => !isChangedByMe(item));

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

      // Group by type within each ChangedBy group
      const groupByType = (items: WorkItem[]) => ({
        stories: items.filter((item) => getWorkItemType(item) === "User Story"),
        tasks: items.filter((item) => getWorkItemType(item) === "Task"),
      });

      const myItems = groupByType(changedByMe);
      const othersItems = groupByType(changedByOthers);

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

      // Sort items
      const sortedMyStories = [...myItems.stories].sort(sortByState);
      const sortedMyTasks = [...myItems.tasks].sort(sortByState);
      const sortedOthersStories = [...othersItems.stories].sort(sortByState);
      const sortedOthersTasks = [...othersItems.tasks].sort(sortByState);

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

      // Helper to add a section
      const addSection = (
        title: string,
        stories: WorkItem[],
        tasks: WorkItem[],
      ) => {
        if (stories.length === 0 && tasks.length === 0) return;
        message += `📋 ${title}\n`;
        if (stories.length > 0) {
          message += `📖 استوری‌ها (${stories.length}):\n`;
          for (const item of stories) {
            message += formatItem(item) + "\n";
          }
        }
        if (tasks.length > 0) {
          message += `📝 تسک‌ها (${tasks.length}):\n`;
          for (const item of tasks) {
            message += formatItem(item) + "\n";
          }
        }
        message += "\n";
      };

      // Add "By Me" section
      addSection("تغییرات من", sortedMyStories, sortedMyTasks);

      // Add "By Others" section
      addSection("تغییرات تیم محصول", sortedOthersStories, sortedOthersTasks);

      // Add legend
      message += "🔵 Active | ⚪ New | 🟢 Resolved | ✅ Closed";
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
