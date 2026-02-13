/**
 * Bot Core Setup
 * Initializes the grammY bot instance with token and optional proxy support
 */

import { Bot, Context, GrammyError, HttpError } from "grammy";
import "dotenv/config";

// Import handlers
import { setupDiscoveryHandlers } from "./handlers/discovery";
import { setupAdminHandlers } from "./handlers/admin";
import { setupGroupHandlers } from "./handlers/groups/startCommand";
import { setupPatTokenHandlers } from "./handlers/user/setPatTokenHandler";

// Import middleware
import { accessControl } from "./middleware";

// Get configuration from environment
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_ADMIN_TELEGRAM_ID = process.env.BOT_ADMIN_TELEGRAM_ID;
const PROXY_URL = process.env.PROXY_URL;

// Validate required environment variables
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable is required");
}

if (!BOT_ADMIN_TELEGRAM_ID) {
  throw new Error("BOT_ADMIN_TELEGRAM_ID environment variable is required");
}

const apiRoot = PROXY_URL ? PROXY_URL : "https://api.telegram.org/bot";

// Create bot instance
const bot = new Bot(BOT_TOKEN, {
  client: {
    apiRoot,
  },
});

// Configure proxy if provided - grammY uses apiRoot to change the API endpoint
// console.log("🚀 ~ PROXY_URL:", PROXY_URL);
// if (PROXY_URL) {
//   // Replace {bot_token} placeholder with actual token
//   const proxyUrl = PROXY_URL.replace("{bot_token}", BOT_TOKEN);
//   console.log("🚀 ~ proxyUrl:", proxyUrl);
//   // @ts-ignore - grammY internal property
//   bot.api.apiRoot = proxyUrl;
// }

// Setup handlers
console.log("[Bot] Setting up handlers...");
setupGroupHandlers();
setupPatTokenHandlers();
setupDiscoveryHandlers();
setupAdminHandlers();
console.log("[Bot] All handlers set up");

// Apply middleware
bot.use(accessControl);
console.log("[Bot] Middleware applied");

// Error handling - use the bot's catch method
bot.catch((err) => {
  const ctx = err.ctx;
  console.error("Error while handling update:", err.error);

  if (err.error instanceof GrammyError) {
    console.error("GrammyError:", err.error.message);
  } else if (err.error instanceof HttpError) {
    console.error("HttpError:", err.error.message);
  } else {
    console.error("Unknown error:", err.error);
  }

  // Notify admin about critical errors
  const adminId = BOT_ADMIN_TELEGRAM_ID;
  bot.api
    .sendMessage(
      adminId,
      `⚠️ Bot Error:\n${err.message}\n\nUpdate ID: ${ctx.update.update_id}`,
    )
    .catch(console.error);
});

// Export bot and config
export { bot, BOT_TOKEN, BOT_ADMIN_TELEGRAM_ID, PROXY_URL };
