# Bot Handlers

This folder contains handler modules for different bot functionalities.

## Files

- `discovery.ts` - Handles Group and User Discovery Flow
  - Callback query handlers for approve/reject buttons
  - Updates group/user status in database
- `admin.ts` - Handles Super Admin Commands (private chat only)
  - /groups - List all groups grouped by status
  - /users - List all users grouped by status
  - /allowgroup <groupId> - Mark group as allowed
  - /allowuser <userId> - Mark user as allowed
  - /rejectgroup <groupId> - Mark group as rejected
  - /rejectuser <userId> - Mark user as rejected
  - /removegroup <groupId> - Delete group record
  - /removeuser <userId> - Delete user record
  - /discover - Extract group ID from forwarded message

## Setup

Import and call the setup functions in the main bot entry point:

```typescript
import { setupDiscoveryHandlers } from "./handlers/discovery";
import { setupAdminHandlers } from "./handlers/admin";

// In main setup
setupDiscoveryHandlers();
setupAdminHandlers();
```
