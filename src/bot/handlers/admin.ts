/**
 * Admin Command Handlers
 * Handles all super admin commands for user management only
 * Groups are no longer managed - all groups are valid
 *
 * Commands (private chat only):
 * - /admin - show admin menu with buttons
 * - /users - list all users with action buttons
 */

import { bot, BOT_ADMIN_TELEGRAM_ID } from "../index";
import {
  getAllUsersGroupedByStatus,
  findUserById,
  findUserByTelegramId,
  createUser,
  updateUserByTelegramId,
  updateUserStatus,
  deleteUser,
} from "../../db/queries/user";
import { StatusEnum } from "../../db/schema";

/**
 * Admin callback data prefixes
 */
const AdminCallback = {
  APPROVE_USER: "admin_approve_user",
  REJECT_USER: "admin_reject_user",
  REMOVE_USER: "admin_remove_user",
  ADD_USER: "admin_add_user",
  SHOW_USERS: "admin_show_users",
  SHOW_MAIN_MENU: "admin_show_main_menu",
  CANCEL_ADD: "admin_cancel_add",
} as const;

/**
 * Build inline keyboard for admin main menu
 */
function buildAdminMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "👥 کاربران", callback_data: AdminCallback.SHOW_USERS }],
      [{ text: "➕ افزودن کاربر", callback_data: AdminCallback.ADD_USER }],
    ],
  };
}

/**
 * Build cancel keyboard
 */
function buildCancelKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "❌ لغو", callback_data: AdminCallback.CANCEL_ADD }],
    ],
  };
}

/**
 * Build inline keyboard for admin menu (back button)
 */
function buildAdminMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "👥 کاربران", callback_data: AdminCallback.SHOW_USERS }],
      [{ text: "🔙 بازگشت", callback_data: AdminCallback.SHOW_MAIN_MENU }],
    ],
  };
}

/**
 * Build inline keyboard for a single user with actions
 */
function buildUserActionKeyboard(userId: number, status: string) {
  const keyboard = [];

  if (status !== StatusEnum.ALLOWED) {
    keyboard.push({
      text: "✅ تأیید",
      callback_data: `${AdminCallback.APPROVE_USER}:${userId}`,
    });
  }

  if (status !== StatusEnum.REJECTED) {
    keyboard.push({
      text: "❌ رد",
      callback_data: `${AdminCallback.REJECT_USER}:${userId}`,
    });
  }

  keyboard.push({
    text: "🗑️ حذف",
    callback_data: `${AdminCallback.REMOVE_USER}:${userId}`,
  });

  return keyboard;
}

// Store pending user inputs
interface PendingInput {
  type: "user";
  step: "telegram_id" | "name";
  telegramId?: string;
}

const adminPendingInputs = new Map<string, PendingInput>();

/**
 * Setup all admin command handlers
 */
export function setupAdminHandlers(): void {
  console.log("[Admin] Setting up admin handlers");

  // /admin - Show admin menu with buttons
  bot.command("admin", async (ctx) => {
    console.log("[Admin] /admin command received");

    // Must be private chat
    if (ctx.chat?.type !== "private") {
      console.log("[Admin] Not private chat");
      return;
    }

    // Must be admin
    const userId = ctx.from?.id.toString();
    if (userId !== BOT_ADMIN_TELEGRAM_ID) {
      console.log(
        "[Admin] Not admin, user:",
        userId,
        "admin:",
        BOT_ADMIN_TELEGRAM_ID,
      );
      await ctx.reply(
        "⛔ Unauthorized. This command is only for the super admin.",
      );
      return;
    }

    console.log("[Admin] Admin confirmed, showing menu");
    const message = `
🛠️ <b>پنل مدیریت</b>

از دکمه‌های زیر استفاده کنید:
`;

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: buildAdminMainMenuKeyboard(),
    });
  });

  // /users - List all users with action buttons
  bot.command("users", async (ctx) => {
    console.log("[Admin] /users command received");

    // Must be private chat
    if (ctx.chat?.type !== "private") {
      console.log("[Admin] Not private chat");
      return;
    }

    // Must be admin
    const userId = ctx.from?.id.toString();
    if (userId !== BOT_ADMIN_TELEGRAM_ID) {
      console.log("[Admin] Not admin");
      await ctx.reply(
        "⛔ Unauthorized. This command is only for the super admin.",
      );
      return;
    }

    try {
      const grouped = await getAllUsersGroupedByStatus();

      let message = "👥 <b>لیست کاربران</b>\n\n";

      if (grouped.allowed.length > 0) {
        message += "✅ <b>فعال</b>\n";
        for (const user of grouped.allowed) {
          const name = user.username
            ? `${user.name} (@${user.username})`
            : user.name;
          message += `• ${name}\n`;
          message += `  🆔 <code>${user.telegramId}</code>\n\n`;
        }
      }

      if (grouped.pending.length > 0) {
        message += "⏳ <b>در انتظار</b>\n";
        for (const user of grouped.pending) {
          const name = user.username
            ? `${user.name} (@${user.username})`
            : user.name;
          message += `• ${name}\n`;
          message += `  🆔 <code>${user.telegramId}</code>\n\n`;
        }
      }

      if (grouped.rejected.length > 0) {
        message += "❌ <b>رد شده</b>\n";
        for (const user of grouped.rejected) {
          const name = user.username
            ? `${user.name} (@${user.username})`
            : user.name;
          message += `• ${name}\n`;
          message += `  🆔 <code>${user.telegramId}</code>\n\n`;
        }
      }

      if (
        grouped.allowed.length === 0 &&
        grouped.pending.length === 0 &&
        grouped.rejected.length === 0
      ) {
        message += "هیچ کاربری یافت نشد.";
      }

      const inlineKeyboard = [];

      for (const user of [
        ...grouped.pending,
        ...grouped.allowed,
        ...grouped.rejected,
      ]) {
        const statusEmoji =
          user.status === StatusEnum.ALLOWED
            ? "✅"
            : user.status === StatusEnum.REJECTED
              ? "❌"
              : "⏳";
        const name = user.username
          ? `${user.name} (@${user.username})`
          : user.name;

        inlineKeyboard.push([
          {
            text: `${statusEmoji} ${name}`,
            callback_data: `admin_user_info:${user.id}`,
          },
        ]);

        const actions = buildUserActionKeyboard(user.id, user.status);
        for (let i = 0; i < actions.length; i += 2) {
          inlineKeyboard.push(actions.slice(i, i + 2));
        }
      }

      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    } catch (error) {
      console.error("[Admin] Error fetching users:", error);
      await ctx.reply("❌ Error fetching users.");
    }
  });

  // Handle admin callback queries (button clicks)
  bot.callbackQuery(/^admin_/, async (ctx) => {
    const callbackData = ctx.callbackQuery?.data;
    if (!callbackData) return;

    // Must be admin
    const userId = ctx.from?.id.toString();
    if (userId !== BOT_ADMIN_TELEGRAM_ID) {
      await ctx.answerCallbackQuery({
        text: "⛔ Unauthorized",
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery();

    const parts = callbackData.split(":");
    const action = parts[0];
    const idStr = parts[1];

    // Handle cancel
    if (action === AdminCallback.CANCEL_ADD) {
      if (userId) {
        adminPendingInputs.delete(userId);
      }
      const message = `
🛠️ <b>پنل مدیریت</b>

عملیات لغو شد.
`;
      await ctx.editMessageText(message, {
        parse_mode: "HTML",
        reply_markup: buildAdminMainMenuKeyboard(),
      });
      return;
    }

    // Handle main menu
    if (action === AdminCallback.SHOW_MAIN_MENU) {
      const message = `
🛠️ <b>پنل مدیریت</b>

از دکمه‌های زیر استفاده کنید:
`;
      await ctx.editMessageText(message, {
        parse_mode: "HTML",
        reply_markup: buildAdminMainMenuKeyboard(),
      });
      return;
    }

    // Handle add user
    if (action === AdminCallback.ADD_USER) {
      const message = `
➕ <b>افزودن کاربر جدید</b>

لطفاً شناسه تلگرام کاربر را ارسال کنید:
`;
      await ctx.editMessageText(message, {
        parse_mode: "HTML",
        reply_markup: buildCancelKeyboard(),
      });

      if (userId) {
        adminPendingInputs.set(userId, {
          type: "user",
          step: "telegram_id",
        });
      }
      return;
    }

    // For other actions, we need an ID
    const id = idStr ? parseInt(idStr, 10) : null;

    if (id === null || isNaN(id)) {
      await ctx.reply("❌ شناسه نامعتبر است.");
      return;
    }

    try {
      // Handle menu actions that show lists
      if (action === AdminCallback.SHOW_USERS) {
        const grouped = await getAllUsersGroupedByStatus();
        let msg = "👥 <b>لیست کاربران</b>\n\n";

        if (grouped.allowed.length > 0) {
          msg += "✅ <b>فعال</b>\n";
          for (const u of grouped.allowed) {
            const name = u.username ? `${u.name} (@${u.username})` : u.name;
            msg += `• ${name} (ID: <code>${u.telegramId}</code>)\n`;
          }
          msg += "\n";
        }
        if (grouped.pending.length > 0) {
          msg += "⏳ <b>در انتظار</b>\n";
          for (const u of grouped.pending) {
            const name = u.username ? `${u.name} (@${u.username})` : u.name;
            msg += `• ${name} (ID: <code>${u.telegramId}</code>)\n`;
          }
          msg += "\n";
        }
        if (grouped.rejected.length > 0) {
          msg += "❌ <b>رد شده</b>\n";
          for (const u of grouped.rejected) {
            const name = u.username ? `${u.name} (@${u.username})` : u.name;
            msg += `• ${name} (ID: <code>${u.telegramId}</code>)\n`;
          }
          msg += "\n";
        }

        if (
          grouped.allowed.length === 0 &&
          grouped.pending.length === 0 &&
          grouped.rejected.length === 0
        ) {
          msg += "هیچ کاربری یافت نشد.";
        }

        const inlineKeyboard = [];
        for (const u of [
          ...grouped.pending,
          ...grouped.allowed,
          ...grouped.rejected,
        ]) {
          const statusEmoji =
            u.status === StatusEnum.ALLOWED
              ? "✅"
              : u.status === StatusEnum.REJECTED
                ? "❌"
                : "⏳";
          const name = u.username ? `${u.name} (@${u.username})` : u.name;
          inlineKeyboard.push([
            {
              text: `${statusEmoji} ${name}`,
              callback_data: `admin_user_info:${u.id}`,
            },
          ]);
          const actions = buildUserActionKeyboard(u.id, u.status);
          for (let i = 0; i < actions.length; i += 2) {
            inlineKeyboard.push(actions.slice(i, i + 2));
          }
        }
        inlineKeyboard.push([
          { text: "🔙 بازگشت", callback_data: AdminCallback.SHOW_MAIN_MENU },
        ]);

        await ctx.editMessageText(msg, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
        return;
      }

      // Handle user actions
      if (action === AdminCallback.APPROVE_USER) {
        await handleApproveUser(ctx, id);
        return;
      }

      if (action === AdminCallback.REJECT_USER) {
        await handleRejectUser(ctx, id);
        return;
      }

      if (action === AdminCallback.REMOVE_USER) {
        await handleRemoveUser(ctx, id);
        return;
      }
    } catch (error) {
      console.error("[Admin] Error handling callback:", error);
      await ctx.reply("❌ Error processing request.");
    }
  });

  // Handle text messages for pending inputs
  bot.on("message:text", async (ctx) => {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) return;

    // Must be admin
    if (telegramId !== BOT_ADMIN_TELEGRAM_ID) {
      return;
    }

    const pending = adminPendingInputs.get(telegramId);
    if (!pending) return;

    const text = ctx.message?.text;
    if (!text) return;

    // Check if it's a command
    if (text.startsWith("/")) {
      adminPendingInputs.delete(telegramId);
      return;
    }

    if (pending.type === "user" && pending.step === "telegram_id") {
      // Store telegram ID and ask for name
      adminPendingInputs.set(telegramId, {
        type: "user",
        step: "name",
        telegramId: text,
      });

      await ctx.reply("لطفاً نام کاربر را ارسال کنید:", {
        reply_markup: buildCancelKeyboard(),
      });
      return;
    }

    if (pending.type === "user" && pending.step === "name") {
      if (!pending.telegramId) {
        await ctx.reply("❌ خطا: شناسه تلگرام یافت نشد.");
        adminPendingInputs.delete(telegramId);
        return;
      }

      try {
        // Check if user already exists
        const existingUser = await findUserByTelegramId(pending.telegramId);
        if (existingUser) {
          await ctx.reply("❌ کاربر با این شناسه تلگرام قبلاً وجود دارد.");
          adminPendingInputs.delete(telegramId);
          return;
        }

        // Create new user
        await createUser({
          telegramId: pending.telegramId,
          name: text,
          username: undefined,
          status: StatusEnum.ALLOWED,
        });

        await ctx.reply(
          `✅ کاربر با موفقیت افزوده شد:\n\n🆔 <code>${pending.telegramId}</code>\n👤 ${text}`,
          { parse_mode: "HTML" },
        );
      } catch (error) {
        console.error("[Admin] Error creating user:", error);
        await ctx.reply("❌ Error creating user.");
      }

      adminPendingInputs.delete(telegramId);
      return;
    }
  });
}

/**
 * Handle user approval
 */
async function handleApproveUser(ctx: any, userId: number): Promise<void> {
  const user = await findUserById(userId);

  if (!user) {
    await ctx.reply("❌ کاربر یافت نشد.");
    return;
  }

  await updateUserStatus(userId, StatusEnum.ALLOWED);

  const name = user.username ? `${user.name} (@${user.username})` : user.name;

  const message =
    `✅ <b>کاربر تأیید شد</b>\n\n` +
    `👤 <b>کاربر:</b> ${name}\n` +
    `🆔 <b>شناسه:</b> <code>${user.telegramId}</code>`;

  await ctx.editMessageText(message, {
    parse_mode: "HTML",
    reply_markup: undefined,
  });

  console.log(`[Admin] User ${user.name} (${user.telegramId}) approved`);
}

/**
 * Handle user rejection
 */
async function handleRejectUser(ctx: any, userId: number): Promise<void> {
  const user = await findUserById(userId);

  if (!user) {
    await ctx.reply("❌ کاربر یافت نشد.");
    return;
  }

  await updateUserStatus(userId, StatusEnum.REJECTED);

  const name = user.username ? `${user.name} (@${user.username})` : user.name;

  const message =
    `❌ <b>کاربر رد شد</b>\n\n` +
    `👤 <b>کاربر:</b> ${name}\n` +
    `🆔 <b>شناسه:</b> <code>${user.telegramId}</code>`;

  await ctx.editMessageText(message, {
    parse_mode: "HTML",
    reply_markup: undefined,
  });

  console.log(`[Admin] User ${user.name} (${user.telegramId}) rejected`);
}

/**
 * Handle user removal
 */
async function handleRemoveUser(ctx: any, userId: number): Promise<void> {
  const user = await findUserById(userId);

  if (!user) {
    await ctx.reply("❌ کاربر یافت نشد.");
    return;
  }

  const name = user.username ? `${user.name} (@${user.username})` : user.name;

  await deleteUser(userId);

  const message =
    `🗑️ <b>کاربر حذف شد</b>\n\n` +
    `👤 <b>کاربر:</b> ${name}\n` +
    `🆔 <b>شناسه:</b> <code>${user.telegramId}</code>`;

  await ctx.editMessageText(message, {
    parse_mode: "HTML",
    reply_markup: undefined,
  });

  console.log(`[Admin] User ${user.name} (${user.telegramId}) removed`);
}
