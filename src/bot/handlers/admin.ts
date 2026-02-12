/**
 * Admin Command Handlers
 * Handles all super admin commands for group and user management
 *
 * Commands (private chat only):
 * - /groups - list all groups grouped by status
 * - /users - list all users grouped by status
 * - /allowgroup <groupId> - mark group as allowed
 * - /allowuser <userId> - mark user as allowed
 * - /rejectgroup <groupId> - mark group as rejected
 * - /rejectuser <userId> - mark user as rejected
 * - /removegroup <groupId> - delete group record
 * - /removeuser <userId> - delete user record
 * - /discover - forward message from group to extract group ID
 */

import { bot, BOT_ADMIN_TELEGRAM_ID } from "../index";
import { adminOnly, isAdmin } from "../middleware";
import {
  getAllGroupsGroupedByStatus,
  findGroupById,
  updateGroupStatus,
  deleteGroup,
} from "../../db/queries/group";
import {
  getAllUsersGroupedByStatus,
  findUserById,
  updateUserStatus,
  deleteUser,
} from "../../db/queries/user";
import { StatusEnum } from "../../db/schema";

/**
 * Setup all admin command handlers
 */
export function setupAdminHandlers(): void {
  // /groups - List all groups grouped by status
  bot.command("groups", adminOnly, async (ctx) => {
    try {
      const grouped = await getAllGroupsGroupedByStatus();

      let message = "📋 <b>Groups List</b>\n\n";

      // Allowed groups
      if (grouped.allowed.length > 0) {
        message += "✅ <b>Allowed</b>\n";
        for (const group of grouped.allowed) {
          message += `• ${group.title} (ID: <code>${group.id}</code>)\n`;
        }
        message += "\n";
      }

      // Pending groups
      if (grouped.pending.length > 0) {
        message += "⏳ <b>Pending</b>\n";
        for (const group of grouped.pending) {
          message += `• ${group.title} (ID: <code>${group.id}</code>)\n`;
        }
        message += "\n";
      }

      // Rejected groups
      if (grouped.rejected.length > 0) {
        message += "❌ <b>Rejected</b>\n";
        for (const group of grouped.rejected) {
          message += `• ${group.title} (ID: <code>${group.id}</code>)\n`;
        }
        message += "\n";
      }

      // Empty state
      if (
        grouped.allowed.length === 0 &&
        grouped.pending.length === 0 &&
        grouped.rejected.length === 0
      ) {
        message += "No groups found.";
      }

      await ctx.reply(message, { parse_mode: "HTML" });
    } catch (error) {
      console.error("[Admin] Error fetching groups:", error);
      await ctx.reply("❌ Error fetching groups.");
    }
  });

  // /users - List all users grouped by status
  bot.command("users", adminOnly, async (ctx) => {
    try {
      const grouped = await getAllUsersGroupedByStatus();

      let message = "👥 <b>Users List</b>\n\n";

      // Allowed users
      if (grouped.allowed.length > 0) {
        message += "✅ <b>Allowed</b>\n";
        for (const user of grouped.allowed) {
          const name = user.username
            ? `${user.name} (@${user.username})`
            : user.name;
          message += `• ${name} (ID: <code>${user.id}</code>)\n`;
        }
        message += "\n";
      }

      // Pending users
      if (grouped.pending.length > 0) {
        message += "⏳ <b>Pending</b>\n";
        for (const user of grouped.pending) {
          const name = user.username
            ? `${user.name} (@${user.username})`
            : user.name;
          message += `• ${name} (ID: <code>${user.id}</code>)\n`;
        }
        message += "\n";
      }

      // Rejected users
      if (grouped.rejected.length > 0) {
        message += "❌ <b>Rejected</b>\n";
        for (const user of grouped.rejected) {
          const name = user.username
            ? `${user.name} (@${user.username})`
            : user.name;
          message += `• ${name} (ID: <code>${user.id}</code>)\n`;
        }
        message += "\n";
      }

      // Empty state
      if (
        grouped.allowed.length === 0 &&
        grouped.pending.length === 0 &&
        grouped.rejected.length === 0
      ) {
        message += "No users found.";
      }

      await ctx.reply(message, { parse_mode: "HTML" });
    } catch (error) {
      console.error("[Admin] Error fetching users:", error);
      await ctx.reply("❌ Error fetching users.");
    }
  });

  // /allowgroup <groupId> - Mark group as allowed
  bot.command("allowgroup", adminOnly, async (ctx) => {
    const message = ctx.message;
    if (!message) {
      return;
    }

    const args = message.text.split(" ");
    const groupId = args[1];

    if (!groupId) {
      await ctx.reply(
        "⚠️ Usage: /allowgroup <groupId>\n\nExample: /allowgroup 123",
      );
      return;
    }

    const id = parseInt(groupId, 10);
    if (isNaN(id)) {
      await ctx.reply("❌ Invalid group ID. Please provide a numeric ID.");
      return;
    }

    try {
      const group = await findGroupById(id);

      if (!group) {
        await ctx.reply(`❌ Group with ID ${id} not found.`);
        return;
      }

      await updateGroupStatus(id, StatusEnum.ALLOWED);

      await ctx.reply(
        `✅ Group <b>"${group.title}"</b> (ID: <code>${id}</code>) has been allowed.`,
        { parse_mode: "HTML" },
      );

      console.log(`[Admin] Group ${group.title} (ID: ${id}) allowed by admin`);
    } catch (error) {
      console.error("[Admin] Error allowing group:", error);
      await ctx.reply("❌ Error allowing group.");
    }
  });

  // /allowuser <userId> - Mark user as allowed
  bot.command("allowuser", adminOnly, async (ctx) => {
    const message = ctx.message;
    if (!message) {
      return;
    }

    const args = message.text.split(" ");
    const userId = args[1];

    if (!userId) {
      await ctx.reply(
        "⚠️ Usage: /allowuser <userId>\n\nExample: /allowuser 123",
      );
      return;
    }

    const id = parseInt(userId, 10);
    if (isNaN(id)) {
      await ctx.reply("❌ Invalid user ID. Please provide a numeric ID.");
      return;
    }

    try {
      const user = await findUserById(id);

      if (!user) {
        await ctx.reply(`❌ User with ID ${id} not found.`);
        return;
      }

      await updateUserStatus(id, StatusEnum.ALLOWED);

      const name = user.username
        ? `${user.name} (@${user.username})`
        : user.name;

      await ctx.reply(
        `✅ User <b>"${name}"</b> (ID: <code>${id}</code>) has been allowed.`,
        { parse_mode: "HTML" },
      );

      console.log(`[Admin] User ${name} (ID: ${id}) allowed by admin`);
    } catch (error) {
      console.error("[Admin] Error allowing user:", error);
      await ctx.reply("❌ Error allowing user.");
    }
  });

  // /rejectgroup <groupId> - Mark group as rejected
  bot.command("rejectgroup", adminOnly, async (ctx) => {
    const message = ctx.message;
    if (!message) {
      return;
    }

    const args = message.text.split(" ");
    const groupId = args[1];

    if (!groupId) {
      await ctx.reply(
        "⚠️ Usage: /rejectgroup <groupId>\n\nExample: /rejectgroup 123",
      );
      return;
    }

    const id = parseInt(groupId, 10);
    if (isNaN(id)) {
      await ctx.reply("❌ Invalid group ID. Please provide a numeric ID.");
      return;
    }

    try {
      const group = await findGroupById(id);

      if (!group) {
        await ctx.reply(`❌ Group with ID ${id} not found.`);
        return;
      }

      await updateGroupStatus(id, StatusEnum.REJECTED);

      await ctx.reply(
        `❌ Group <b>"${group.title}"</b> (ID: <code>${id}</code>) has been rejected.`,
        { parse_mode: "HTML" },
      );

      console.log(`[Admin] Group ${group.title} (ID: ${id}) rejected by admin`);
    } catch (error) {
      console.error("[Admin] Error rejecting group:", error);
      await ctx.reply("❌ Error rejecting group.");
    }
  });

  // /rejectuser <userId> - Mark user as rejected
  bot.command("rejectuser", adminOnly, async (ctx) => {
    const message = ctx.message;
    if (!message) {
      return;
    }

    const args = message.text.split(" ");
    const userId = args[1];

    if (!userId) {
      await ctx.reply(
        "⚠️ Usage: /rejectuser <userId>\n\nExample: /rejectuser 123",
      );
      return;
    }

    const id = parseInt(userId, 10);
    if (isNaN(id)) {
      await ctx.reply("❌ Invalid user ID. Please provide a numeric ID.");
      return;
    }

    try {
      const user = await findUserById(id);

      if (!user) {
        await ctx.reply(`❌ User with ID ${id} not found.`);
        return;
      }

      await updateUserStatus(id, StatusEnum.REJECTED);

      const name = user.username
        ? `${user.name} (@${user.username})`
        : user.name;

      await ctx.reply(
        `❌ User <b>"${name}"</b> (ID: <code>${id}</code>) has been rejected.`,
        { parse_mode: "HTML" },
      );

      console.log(`[Admin] User ${name} (ID: ${id}) rejected by admin`);
    } catch (error) {
      console.error("[Admin] Error rejecting user:", error);
      await ctx.reply("❌ Error rejecting user.");
    }
  });

  // /removegroup <groupId> - Delete group record
  bot.command("removegroup", adminOnly, async (ctx) => {
    const message = ctx.message;
    if (!message) {
      return;
    }

    const args = message.text.split(" ");
    const groupId = args[1];

    if (!groupId) {
      await ctx.reply(
        "⚠️ Usage: /removegroup <groupId>\n\nExample: /removegroup 123",
      );
      return;
    }

    const id = parseInt(groupId, 10);
    if (isNaN(id)) {
      await ctx.reply("❌ Invalid group ID. Please provide a numeric ID.");
      return;
    }

    try {
      const group = await findGroupById(id);

      if (!group) {
        await ctx.reply(`❌ Group with ID ${id} not found.`);
        return;
      }

      await deleteGroup(id);

      await ctx.reply(
        `🗑️ Group <b>"${group.title}"</b> (ID: <code>${id}</code>) has been removed.`,
        { parse_mode: "HTML" },
      );

      console.log(`[Admin] Group ${group.title} (ID: ${id}) removed by admin`);
    } catch (error) {
      console.error("[Admin] Error removing group:", error);
      await ctx.reply("❌ Error removing group.");
    }
  });

  // /removeuser <userId> - Delete user record
  bot.command("removeuser", adminOnly, async (ctx) => {
    const message = ctx.message;
    if (!message) {
      return;
    }

    const args = message.text.split(" ");
    const userId = args[1];

    if (!userId) {
      await ctx.reply(
        "⚠️ Usage: /removeuser <userId>\n\nExample: /removeuser 123",
      );
      return;
    }

    const id = parseInt(userId, 10);
    if (isNaN(id)) {
      await ctx.reply("❌ Invalid user ID. Please provide a numeric ID.");
      return;
    }

    try {
      const user = await findUserById(id);

      if (!user) {
        await ctx.reply(`❌ User with ID ${id} not found.`);
        return;
      }

      await deleteUser(id);

      const name = user.username
        ? `${user.name} (@${user.username})`
        : user.name;

      await ctx.reply(
        `🗑️ User <b>"${name}"</b> (ID: <code>${id}</code>) has been removed.`,
        { parse_mode: "HTML" },
      );

      console.log(`[Admin] User ${name} (ID: ${id}) removed by admin`);
    } catch (error) {
      console.error("[Admin] Error removing user:", error);
      await ctx.reply("❌ Error removing user.");
    }
  });

  // /discover - Admin may forward a message from a group to extract group ID
  bot.command("discover", adminOnly, async (ctx) => {
    await ctx.reply(
      "🔍 <b>Discover Mode</b>\n\n" +
        "Forward a message from a group to extract the group ID.\n\n" +
        "I'll analyze the forwarded message and show you the group information with approval buttons.",
      { parse_mode: "HTML" },
    );
  });

  // Handle forwarded messages for /discover command
  bot.on("message:forward_origin", adminOnly, async (ctx) => {
    const message = ctx.message;
    if (!message) {
      return;
    }

    const forwardOrigin = message.forward_origin;
    if (!forwardOrigin || forwardOrigin.type !== "chat") {
      return;
    }

    const forwardedFrom = forwardOrigin.sender_chat;
    if (!forwardedFrom) {
      return;
    }

    if (forwardedFrom.type !== "group" && forwardedFrom.type !== "supergroup") {
      await ctx.reply(
        "❌ The forwarded message is not from a group. Please forward from a group.",
      );
      return;
    }

    const groupId = forwardedFrom.id.toString();
    const groupTitle = forwardedFrom.title || "Unknown Group";

    // Show group info with approval buttons
    const messageText =
      `🔍 <b>Group Discovered</b>\n\n` +
      `📍 <b>Group:</b> ${groupTitle}\n` +
      `🆔 <b>Group ID:</b> <code>${groupId}</code>`;

    await ctx.reply(messageText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `approve_group:${groupId}` },
            { text: "❌ Reject", callback_data: `reject_group:${groupId}` },
          ],
        ],
      },
    });
  });
}
