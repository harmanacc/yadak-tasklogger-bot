# Database Layer

This folder contains the Drizzle ORM schema and database utilities.

## Files

- `index.ts` - Database client initialization and connection
- `schema.ts` - Database schema definitions (tables)
- `migrations/` - Database migration files

## Schema Tables

- `ManagedGroup` - Approved/rejected groups
- `ManagedUser` - Approved/rejected users
- `WorkSession` - Start/finish work records
- `Job` - Scheduled jobs for the scheduler
- `BotMessage` - Bot message references for cleanup
