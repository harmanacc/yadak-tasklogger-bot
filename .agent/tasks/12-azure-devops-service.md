# Task 12: Azure DevOps Service

## Overview

Create service for Azure DevOps API integration for daily report queries.

## Core Logic

- Create AzureDevopsService class
- Query Azure DevOps REST API using user's PAT token
- Use Wiql (Work Item Query Language) for queries
- Return formatted work items

## Relations to Code Files

- /src/app/services/azureDevopsService.ts
- /src/app/utils/http.ts - HTTP client

## Steps

1. Create AzureDevopsService class
2. Implement query method with PAT token authentication
3. Implement work items retrieval
4. Handle API errors gracefully
5. Export service for use in handlers

## Checklist

- [x] AzureDevopsService class created
- [x] Query method working with PAT token
- [x] Work items retrieved correctly
- [x] Error handling in place
- [x] Service exported
