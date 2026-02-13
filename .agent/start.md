# initial note

this document is the general system prompt for the agent and how the agent should behave and what are the rules of the agent.
it is not part of a task nor a file to be edited by the agent.
you must follow the rules of the agent strictly.

this project builds a production-grade internal telegram bot with persistent storage, job scheduling, and button-driven workflows.

simplicity and modularity are the core values of this project.

---

# Project Name

yadak-tasklog-bot

---

# Overview

This project is an internal Telegram bot used by a development organization.

The bot operates inside `approved` Telegram groups and provides:

- Start work and finish work announcements using buttons.(at office or remote)
- Automatic off-day reminder scheduling.
- Daily report message generation. which would integrate with azure devops. per user.
- Super-admin controlles groups approval system . which can be on or many super-admins.

No external services are required. All states lives in SQLite.

---

# Tech Stack

- Language: TypeScript (Bun js)
- Telegram Library: grammY
- Database ORM: drizzle
- Database: SQLite (Docker volume, and in root folder for development)
- Scheduler: Internal polling job runner (database-backed)
- Config: dotenv

No HTTP server or web framework is used.

---

# Architecture

## Core Modules

1. Bot Layer
   - grammY bot instance
   - Handlers for commands and callback queries
   - Message cleanup and UI interactions - so in a workflow only one message would remain unless new command is sent.

2. Database Layer
   - drizzle client wrapper
   - All DB access must live in a dedicated db module

3. Scheduler (this is the latest feature to implement)
   - Polls Job table every 60 seconds
   - Executes due jobs
   - Deletes completed jobs
   - Must be restart-safe

4. Message Tracking
   - Stores bot message references for cleanup and delete actions

---

To get started, follow these steps:

1- to start doing any task , you need to make a task of what you want to do. and make the proper relations to code files (without expicitly writing the code in the task file)
the task file should be bare minimum , just the core logics , the steps of the task and a checklist of steps to do which after the task is done gets checked . under the /.agent/tasks/ folder .
after a task is done , you need to check the task with me and confirm .and update the checklist in the task file .

example of task header sections :

- Overview
- Core Logic
- Relations to Code Files
- Steps
- Checklist

2- check the task with me and confirm .
3- start doing the task .  
4- check the task list and confirm with me that the task is done .
5- i will test it myself and confirm that it is done , do not run the server yourself as it is running on my server and i will test it myself .
6- do not build the project .

to get started , always read package.json and the readme.md file . to understand the projects .
try to follow the conventions of the project .
do not create test files . ask me to test if you need to .
do not attempt to run the server yourself .

## How to create new files .

when you want to create a new file , the files should be bite sized and have one or few logic . a file should be one purpose only and if you are getting big in the file should be broken into smaller files .

# important note

under each chunk of code , big folders have a readme.md file that explains the purpose of the folder and the files inside it .and how to use or create them .
also if you make a new folder there should be a readme.md file that explains the purpose of the folder and how to use it .
like `/app/db/README.md` .

---

# Environment Variables

BOT_TOKEN=<telegram bot token>
BOT_ADMIN_TELEGRAM_ID=<telegram id of super admin>

# Proxy Configuration (optional)

# Cloudflare Workers proxy URL - DON'T include bot token, grammY adds it automatically

PROXY_URL="https://subdomain.username.workers.dev"

---

# User and Group Access Control

Groups are stored in the ManagedGroup table.
Users are stored in the ManagedUser table.

Group and User statuses:

- pending
- allowed
- rejected

Rules:

- Only groups and users with status = allowed may use the bot.
- Pending and rejected groups are ignored by default.
- The super admin controls group and user approval. admin should be able to control it using the bot which is connected to the database.

so the bot is either is using the direct message to super admin or is inside a approved group getting messages from approved users only .

---

# Group and User Discovery Flow

When the bot receives any update from a group and user that does not exist in ManagedGroup and ManagedUser:

1. Insert group and user with:
   - telegramId
   - title
   - status = pending
2. Notify super admin in private chat.
3. Send approval message containing:
   - Group name
   - Group ID
   - Inline buttons: Approve / Reject
4. Store the admin message reference for tracking.

The bot ignores all interactions from the group or user until approved.

---

# Super Admin

The super admin is identified using BOT_ADMIN_TELEGRAM_ID.

Only the super admin may:

- Approve or reject group and user requests
- View all managed groups and users
- Manually override group status and user status
- Remove group records and user records

Admin commands are accepted only in private chat. which would only respond to the super admin.

---

# Admin Commands

in private chat only

/groups  
Lists all groups grouped by status.

/users  
Lists all users grouped by status.

/allowgroup <groupId>
Marks a group as allowed manually.

/allowgroup <userId>
Marks a user as allowed manually.

/rejectgroup <groupId>
Marks a group as rejected manually.

/rejectuser <userId>
Marks a user as rejected manually.

/removegroup <groupId>
Deletes a group record.

/removeuser <userId>
Deletes a user record.

/discover  
Admin may forward a message from a group. The bot extracts the group ID and proposes approval using buttons.

---

# commands inside Groups

/start to start up the bot.

buttons:

- start work - at office or remote selection , when determined then will send a message to the groupt with date and time and weekday and remote or office flag.
- finish work - same as start work but with a different message and no flags.
- daily report - will connect to azure devops and generate a daily report message. the query is hardcoded in the code and will be changed later . it will get a personlized message for each user based on the daily tasks generated in azure devops . i will generate the query for you .

---

# Middleware Rules

For every incoming update:

- If update is from private chat and user is admin → allow.
- If update is from group:
  - Load ManagedGroup by telegramId.
  - If not found → trigger Group Discovery Flow.
  - If status !== allowed → ignore update.
  - If allowed → process normally.

---

# Bot Behavior Rules

## General

- Prefer inline buttons over text commands.
- Delete user command messages when possible.
- Only informational bot messages should remain in chat.
- Always validate callback payloads.
- Never crash on malformed input.
- each user will need a PAT_TOKEN to connect to azure devops . there should be a button that updates the PAT_TOKEN for that user in the database . user can update the PAT_TOKEN anytime .
  the PAT_TOKENs will be only used for azure devops queries .

---

## Start Work Button

- Sends a formatted message including:
  - User name
  - Date
  - Time
  - Weekday
  - Remote / Office flag

---

## Finish Work Button

Same behavior as Start Work. but with a different message and no flags.

---

## Daily Report Button

Sends formatted Persian date string. with the result of the query to azure devops.

Example:
گزارش ۱۴۰۳/۵/۶

#### example of azure devops query

```bash
curl -X POST "https://vcontrol.sepasholding.com/Yadakdotcom/_apis/wit/wiql?api-version=1.2" \
-H "Content-Type: application/json" \
-H "Authorization: Basic {PAT_TOKEN}" \
-d '{
  "query": "SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.ChangedDate] FROM workitems WHERE [System.TeamProject] = \"Yadak.com\" AND [System.AssignedTo] = @me AND [System.ChangedDate] >= @today - 1 AND [System.ChangedDate] < @today + 1 ORDER BY [System.ChangedDate] DESC"
}'
```

---

# End of Document

always read the drizzle schema file for the database schema .

# very important note

DO NOT THINK TOO MUCH .
START DOING THE TASKS .
IF YOU NEED HELP , ASK ME .

everythin should be functional , no OOP is allowed . no base class nothing.

do not build the project , i will run and test it myself .

run type check and lint after each task is completed .
