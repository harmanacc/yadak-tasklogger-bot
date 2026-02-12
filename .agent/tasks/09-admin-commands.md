# Task 09: Super Admin Commands

## Overview

Implement all super admin commands for group and user management.

## Core Logic

Commands only work in private chat with super admin:

- /groups - list all groups grouped by status
- /users - list all users grouped by status
- /allowgroup <groupId> - mark group as allowed
- /allowuser <userId> - mark user as allowed
- /rejectgroup <groupId> - mark group as rejected
- /rejectuser <userId> - mark user as rejected
- /removegroup <groupId> - delete group record
- /removeuser <userId> - delete user record
- /discover - forward message from group to extract group ID

## Relations to Code Files

- /src/app/bot/handlers/admin/groupsCommand.ts
- /src/app/bot/handlers/admin/usersCommand.ts
- /src/app/bot/handlers/admin/allowCommand.ts
- /src/app/bot/handlers/admin/rejectCommand.ts
- /src/app/bot/handlers/admin/removeCommand.ts
- /src/app/bot/handlers/admin/discoverCommand.ts
- /src/app/services/groupService.ts
- /src/app/services/userService.ts

## Steps

1. Implement /groups command with status grouping
2. Implement /users command with status grouping
3. Implement /allowgroup command
4. Implement /allowuser command
5. Implement /rejectgroup command
6. Implement /rejectuser command
7. Implement /removegroup command
8. Implement /removeuser command
9. Implement /discover command for forward extraction

## Checklist

- [x] /groups command working
- [x] /users command working
- [x] /allowgroup command working
- [x] /allowuser command working
- [x] /rejectgroup command working
- [x] /rejectuser command working
- [x] /removegroup command working
- [x] /removeuser command working
- [x] /discover command working
