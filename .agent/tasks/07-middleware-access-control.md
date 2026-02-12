# Task 07: Middleware & Access Control

## Overview

Implement middleware for access control to ensure only allowed groups and users can interact with the bot.

## Core Logic

- Check if update is from private chat - allow if admin
- For group updates: lookup ManagedGroup by telegramId
- If group not found: trigger Group Discovery Flow
- If status !== 'allowed': ignore update
- Implement isAdmin helper to check BOT_ADMIN_TELEGRAM_ID

## Relations to Code Files

- /src/app/bot/middleware.ts
- /src/app/bot/handlers/admin.ts
- /src/app/db/ - Database queries

## Steps

1. Create isAdmin function to check super admin
2. Implement private chat admin check middleware
3. Implement group lookup middleware
4. Implement Group Discovery Flow trigger
5. Implement status check middleware

## Checklist

- [x] isAdmin function created
- [x] Private chat admin middleware working
- [x] Group lookup middleware working
- [x] Group Discovery Flow triggers for new groups
- [x] Pending/rejected groups ignored
