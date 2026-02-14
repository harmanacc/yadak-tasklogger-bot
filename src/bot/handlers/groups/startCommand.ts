/**
 * Group Command Handlers
 * Handles /start command and callback queries for work sessions
 */

import { Context, Keyboard } from "grammy";
import { bot } from "../../index";
import { findUserByTelegramId, createUser } from "../../../db/queries";
import {
  createWorkSession,
  findLatestSessionByUserId,
} from "../../../db/queries/workSession";
import {
  WorkTypeEnum,
  WorkLocationEnum,
  type WorkLocation,
} from "../../../db/schema";
import {
  buildMainKeyboard,
  buildLocationKeyboard,
  CallbackData,
} from "../../keyboards/main";
import {
  formatPersianDate,
  formatPersianTime,
  formatPersianWeekday,
  toTehranTime,
} from "../../../utils/date";
import { startPatTokenFlow } from "../user/setPatTokenHandler";
import { handleDailyReport as processDailyReport } from "../reports/dailyReportHandler";
import { MessageType, trackMessage } from "../../../services/messageService";
import { findMessagesByChatIdAndType } from "../../../db/queries/message";

/**
 * Setup group command handlers
 */
export function setupGroupHandlers(): void {
  // Handle /start command in groups
  bot.command("start", handleStartCommand);

  // Handle inline keyboard callbacks
  bot.callbackQuery(
    [
      CallbackData.START_WORK,
      CallbackData.FINISH_WORK,
      CallbackData.DAILY_REPORT,
      CallbackData.SET_PAT_TOKEN,
      CallbackData.LOCATION_OFFICE,
      CallbackData.LOCATION_REMOTE,
    ],
    handleCallbackQuery,
  );

  // Handle text button clicks in groups
  bot.hears("شروع کار", handleStartWorkText);
  bot.hears("پایان کار", handleFinishWorkText);
  bot.hears("گزارش روزانه", handleDailyReportText);
  bot.hears("تنظیم توکن", handleSetPatTokenText);
  bot.hears("🏢 دفتر", handleOfficeText);
  bot.hears("🏠 remote", handleRemoteText);
}

/**
 * Handle /start command in groups
 */
async function handleStartCommand(ctx: Context): Promise<void> {
  // Handle private chat differently - show PAT token options
  if (ctx.chat?.type === "private") {
    const userId = ctx.from?.id.toString();
    const userName = ctx.from?.first_name || "کاربر";

    // Ensure user exists in database
    let user = await findUserByTelegramId(userId!);
    if (!user) {
      await createUser({
        telegramId: userId!,
        name: userName,
        username: ctx.from?.username,
      });
      user = await findUserByTelegramId(userId!);
    }

    const privateMessage = `
👋 <b>خوش آمدید!</b>

از دکمه‌های زیر استفاده کنید:
`;

    await ctx.reply(privateMessage, {
      parse_mode: "HTML",
      reply_markup: buildMainKeyboard(),
    });
    return;
  }

  // For groups, show the welcome message with work buttons
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id.toString();

  // Delete the command message
  if (ctx.message?.message_id && chatId) {
    ctx.api.deleteMessage(chatId, ctx.message.message_id).catch(() => {});
  }

  // Don't delete old welcome messages - user can have multiple flows
  // Old messages will be cleaned up when needed

  const welcomeMessage = `
👋 <b>خوش آمدید!</b>

از دکمه‌های زیر استفاده کنید:
`;

  // Send main keyboard
  const sentMessage = await ctx.reply(welcomeMessage, {
    parse_mode: "HTML",
    reply_markup: buildMainKeyboard(),
  });

  // Track the welcome message
  if (chatId) {
    await trackMessage(
      ctx.api,
      chatId,
      sentMessage.message_id,
      MessageType.WELCOME,
    );
  }
}

/**
 * Handle callback queries from inline keyboard
 */
async function handleCallbackQuery(ctx: Context): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;

  if (!callbackData) return;

  // Answer the callback to stop loading animation
  await ctx.answerCallbackQuery();

  // Handle PAT token in private chat
  if (ctx.chat?.type === "private") {
    switch (callbackData) {
      case CallbackData.SET_PAT_TOKEN:
        await handleSetPatToken(ctx);
        break;
      case CallbackData.START_WORK:
        await handleStartWork(ctx);
        break;
      case CallbackData.FINISH_WORK:
        await handleFinishWork(ctx);
        break;
      case CallbackData.DAILY_REPORT:
        await processDailyReport(ctx);
        break;
      case CallbackData.LOCATION_OFFICE:
        await handleLocationSelection(ctx, WorkLocationEnum.OFFICE);
        break;
      case CallbackData.LOCATION_REMOTE:
        await handleLocationSelection(ctx, WorkLocationEnum.REMOTE);
        break;
    }
    return;
  }

  // For groups, check if it's a group
  if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
    await ctx.reply("❌ این دستور فقط در گروه‌ها قابل استفاده است");
    return;
  }

  switch (callbackData) {
    case CallbackData.START_WORK:
      await handleStartWork(ctx);
      break;
    case CallbackData.FINISH_WORK:
      await handleFinishWork(ctx);
      break;
    case CallbackData.DAILY_REPORT:
      await processDailyReport(ctx);
      break;
    case CallbackData.SET_PAT_TOKEN:
      await handleSetPatToken(ctx);
      break;
    case CallbackData.LOCATION_OFFICE:
      await handleLocationSelection(ctx, WorkLocationEnum.OFFICE);
      break;
    case CallbackData.LOCATION_REMOTE:
      await handleLocationSelection(ctx, WorkLocationEnum.REMOTE);
      break;
  }
}

/**
 * Handle Start Work action - show location selection
 */
async function handleStartWork(ctx: Context): Promise<void> {
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id.toString();
  const userName = ctx.from?.first_name || "همکار";
  const username = ctx.from?.username;

  if (!userId || !chatId) {
    await ctx.reply("❌ خطا در پردازش درخواست");
    return;
  }

  // Ensure user exists in database
  let user = await findUserByTelegramId(userId);
  if (!user) {
    await createUser({
      telegramId: userId,
      name: userName,
      username: username,
    });
    user = await findUserByTelegramId(userId);
  }

  if (!user) {
    await ctx.reply("❌ کاربر یافت نشد");
    return;
  }

  const locationMessage = `
🏢 <b>محل کار را انتخاب کنید:</b>
`;

  // Handle differently for group vs private chat
  if (ctx.chat?.type === "private") {
    // In private chat, send a new message with location keyboard
    const sentMessage = await ctx.reply(locationMessage, {
      parse_mode: "HTML",
      reply_markup: buildLocationKeyboard(),
    });

    // Track location selection message
    await trackMessage(
      ctx.api,
      chatId,
      sentMessage.message_id,
      MessageType.LOCATION_SELECT,
    );
    return;
  }

  // For groups, edit the existing message
  const messageId = ctx.callbackQuery?.message?.message_id;
  if (!messageId) return;

  // Edit message with location keyboard
  await ctx.editMessageText(locationMessage, {
    parse_mode: "HTML",
    reply_markup: buildLocationKeyboard(),
  });

  // Track location selection message
  await trackMessage(ctx.api, chatId, messageId, MessageType.LOCATION_SELECT);
}

/**
 * Handle Finish Work action - record session and send message
 */
async function handleFinishWork(ctx: Context): Promise<void> {
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id.toString();
  const userName = ctx.from?.first_name || "همکار";
  const username = ctx.from?.username;

  if (!userId || !chatId) {
    await ctx.reply("❌ خطا در پردازش درخواست");
    return;
  }

  // Ensure user exists in database
  let user = await findUserByTelegramId(userId);
  if (!user) {
    await createUser({
      telegramId: userId,
      name: userName,
      username: username,
    });
    user = await findUserByTelegramId(userId);
  }

  if (!user) {
    await ctx.reply("❌ کاربر یافت نشد");
    return;
  }

  // Create work session - use default group ID (1) since groups are not stored
  const now = new Date();
  const tehranNow = toTehranTime(now);

  // Create work session
  await createWorkSession({
    userId: user.id,
    groupId: 1, // Default group - groups are not stored
    type: WorkTypeEnum.FINISH,
    location: undefined,
    timestamp: now,
  });

  // Format message
  const displayName = ctx.from?.first_name || "همکار";
  const message = `
🔚 <b>پایان کار</b>

👤 <b>${displayName}</b>
📅 ${formatPersianDate(tehranNow)}
🕐 ${formatPersianTime(tehranNow)}
📆 ${formatPersianWeekday(tehranNow)}
`;

  // Handle differently for group vs private chat
  if (ctx.chat?.type === "private") {
    // In private chat, reply with the finish message
    await ctx.reply(message, { parse_mode: "HTML" });
    return;
  }

  // For groups, edit the existing message
  const messageId = ctx.callbackQuery?.message?.message_id;
  if (!messageId) {
    await ctx.reply("❌ خطا در پردازش پیام");
    return;
  }

  // Edit message
  await ctx.editMessageText(message, {
    parse_mode: "HTML",
    reply_markup: undefined,
  });

  // Track finish work message
  await trackMessage(
    ctx.api,
    chatId,
    messageId,
    MessageType.FINISH_WORK,
    user.id,
  );
}

/**
 * Handle location selection for Start Work
 */
async function handleLocationSelection(
  ctx: Context,
  location: WorkLocation,
): Promise<void> {
  const userId = ctx.from?.id.toString();
  const chatId = ctx.chat?.id.toString();
  const userName = ctx.from?.first_name || "همکار";
  const username = ctx.from?.username;

  if (!userId || !chatId) {
    await ctx.reply("❌ خطا در پردازش درخواست");
    return;
  }

  // Ensure user exists in database
  let user = await findUserByTelegramId(userId);
  if (!user) {
    await createUser({
      telegramId: userId,
      name: userName,
      username: username,
    });
    user = await findUserByTelegramId(userId);
  }

  if (!user) {
    await ctx.reply("❌ کاربر یافت نشد");
    return;
  }

  // Create work session - use default group ID (1) since groups are not stored
  const now = new Date();
  const tehranNow = toTehranTime(now);
  await createWorkSession({
    userId: user.id,
    groupId: 1, // Default group - groups are not stored
    type: WorkTypeEnum.START,
    location: location,
    timestamp: now,
  });

  // Format message
  const displayName = ctx.from?.first_name || "همکار";
  const locationText =
    location === WorkLocationEnum.OFFICE ? "🏢 دفتر" : "🏠 دورکاری";
  const message = `
🚀 <b>شروع کار</b>

👤 <b>${displayName}</b>
📅 ${formatPersianDate(tehranNow)}
🕐 ${formatPersianTime(tehranNow)}
📆 ${formatPersianWeekday(tehranNow)}
📍 ${locationText}
`;

  // Handle differently for group vs private chat
  if (ctx.chat?.type === "private") {
    // In private chat, reply with the start message
    await ctx.reply(message, { parse_mode: "HTML" });
    return;
  }

  // For groups, edit the existing message
  const messageId = ctx.callbackQuery?.message?.message_id;
  if (!messageId) {
    await ctx.reply("❌ خطا در پردازش پیام");
    return;
  }

  // Edit message
  await ctx.editMessageText(message, {
    parse_mode: "HTML",
    reply_markup: undefined,
  });

  // Track start work message
  await trackMessage(
    ctx.api,
    chatId,
    messageId,
    MessageType.START_WORK,
    user.id,
  );
}

/**
 * Handle Set PAT Token action - starts the token input flow in private chat
 */
async function handleSetPatToken(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id.toString();

  if (!telegramId) {
    await ctx.reply("❌ خطا در پردازش درخواست");
    return;
  }

  // Get user from database
  const user = await findUserByTelegramId(telegramId);

  if (!user) {
    // For private chat
    if (ctx.chat?.type === "private") {
      await ctx.reply("❌ <b>کاربر یافت نشد.</b>", { parse_mode: "HTML" });
      return;
    }

    // For groups
    await ctx.editMessageText(
      "❌ <b>کاربر یافت نشد.</b>\n\nابتدا در یک گروه مجاز /start را بزنید.",
      { parse_mode: "HTML", reply_markup: undefined },
    );
    return;
  }

  // Start the PAT token flow in private chat
  await startPatTokenFlow(ctx);

  // For groups, update the group message
  if (ctx.chat?.type !== "private") {
    await ctx.editMessageText(
      "🔐 <b>توکن Azure DevOps</b>\n\n" +
        "لطفاً توکن خود را در پیام خصوصی ارسال شده وارد کنید.",
      { parse_mode: "HTML", reply_markup: undefined },
    );
  }
}

// Text button handlers (for Keyboard buttons)

async function handleStartWorkText(ctx: Context): Promise<void> {
  await handleStartWork(ctx);
}

async function handleFinishWorkText(ctx: Context): Promise<void> {
  await handleFinishWork(ctx);
}

async function handleDailyReportText(ctx: Context): Promise<void> {
  await processDailyReport(ctx);
}

async function handleSetPatTokenText(ctx: Context): Promise<void> {
  // For private chat, handle directly
  if (ctx.chat?.type === "private") {
    await handleSetPatToken(ctx);
    return;
  }
  await handleSetPatToken(ctx);
}

async function handleOfficeText(ctx: Context): Promise<void> {
  await handleLocationSelection(ctx, WorkLocationEnum.OFFICE);
}

async function handleRemoteText(ctx: Context): Promise<void> {
  await handleLocationSelection(ctx, WorkLocationEnum.REMOTE);
}
