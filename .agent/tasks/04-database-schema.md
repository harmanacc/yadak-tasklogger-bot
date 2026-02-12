# Task 04: Database Schema Setup

## Overview

Create drizzle ORM schema with all required tables for the application.

## Core Logic

- Define ManagedGroup table (telegramId, title, status, createdAt, updatedAt)
- Define ManagedUser table (telegramId, name, username, status, patToken, createdAt, updatedAt)
- Define WorkSession table (userId, groupId, type, location, timestamp)
- Define BotMessage table (chatId, messageId, userId, type)
- Define Job table (id, type, payload, dueAt, executedAt, status)

## Relations to Code Files

- /src/app/db/schema.ts - Database schema definitions
- /src/app/db/index.ts - Database client export

## Steps

1. Create drizzle schema file with all 5 tables
2. Define proper types and enums for status fields
3. Set up SQLite database connection
4. Export database client for use in other modules

## Checklist

- [x] ManagedGroup table defined
- [x] ManagedUser table defined
- [x] WorkSession table defined
- [x] BotMessage table defined
- [x] Job table defined
- [x] Database client exported
- [x] /src/db/schema.ts created
- [x] /src/db/index.ts created
