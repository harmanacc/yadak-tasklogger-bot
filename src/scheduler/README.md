# Scheduler Layer

This folder contains the job scheduler that polls the database for due jobs.

## Files

- `index.ts` - Scheduler initialization and start/stop logic
- `runner.ts` - Job execution logic (polls every 60 seconds)

## How It Works

1. The scheduler polls the `Job` table every 60 seconds
2. Executes jobs where `dueAt <= now()` and `status = pending`
3. Deletes completed jobs after execution
4. Is restart-safe (pending jobs remain in database)

## Job Table

The Job table is generic with:

- `description` - Job description (e.g., "offday reminder", "custom notification")
- `payload` - JSON string for additional data
- `dueAt` - When the job should execute
- `status` - pending/completed/failed
