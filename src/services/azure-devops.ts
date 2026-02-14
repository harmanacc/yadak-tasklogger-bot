/**
 * Azure DevOps Service
 * Functional approach for Azure DevOps API integration
 */

import "dotenv/config";

const AZURE_DEVOPS_BASE_URL =
  process.env.AZURE_DEVOPS_BASE_URL || "https://dev.azure.com/yourorganization";
const AZURE_DEVOPS_API_VERSION = "1.2";

/**
 * Get authorization header with PAT token
 * Azure DevOps expects: Basic base64(username:pat)
 * Using empty username with PAT as password
 */
function getAuthHeader(patToken: string): string {
  // Base64 encode ":patToken" (empty username with colon prefix)
  const encoded = Buffer.from(`:${patToken}`).toString("base64");
  return `Basic ${encoded}`;
}

/**
 * Run a WiQL query and return work item references
 */
export async function runWiqlQuery(
  patToken: string,
  query: string,
): Promise<Array<{ id: number; url: string }>> {
  const url = `${AZURE_DEVOPS_BASE_URL}/_apis/wit/wiql?api-version=${AZURE_DEVOPS_API_VERSION}`;
  const authHeader = getAuthHeader(patToken);

  // Debug log (mask the actual token)

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Azure DevOps] Error response");
    throw new Error(`Azure DevOps WiQL query failed: ${response.status} `);
  }

  const data = await response.json();
  return data.workItems || [];
}

/**
 * Fetch work items details by IDs
 */
export async function fetchWorkItemsByIds(
  patToken: string,
  ids: number[],
  fields: string[] = [
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.ChangedDate",
  ],
): Promise<Array<Record<string, unknown>>> {
  if (ids.length === 0) return [];

  const idsParam = ids.join(",");
  const fieldsParam = fields.join(",");

  const response = await fetch(
    `${AZURE_DEVOPS_BASE_URL}/_apis/wit/workitems?ids=${idsParam}&fields=${fieldsParam}&api-version=${AZURE_DEVOPS_API_VERSION}`,
    {
      method: "GET",
      headers: {
        Authorization: getAuthHeader(patToken),
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure DevOps workitems fetch failed: ${response.status} `);
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Get daily work items for the current user
 */
export async function getDailyWorkItems(
  patToken: string,
): Promise<Array<Record<string, unknown>>> {
  const query = `
    SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.ChangedDate] 
    FROM workitems 
    WHERE [System.TeamProject] = "Yadak.com" 
      AND [System.AssignedTo] = @me 
      AND [System.ChangedDate] >= @StartOfDay
    ORDER BY [System.ChangedDate] DESC
  `;

  const workItems = await runWiqlQuery(patToken, query);
  const ids = workItems.map((item) => item.id);

  // Fetch with fields needed for daily report
  return fetchWorkItemsByIds(patToken, ids, [
    "System.Id",
    "System.Title",
    "System.State",
    "System.WorkItemType",
    "System.AssignedTo",
    "System.ChangedDate",
    "Microsoft.VSTS.Scheduling.OriginalEstimate",
    "Microsoft.VSTS.Scheduling.CompletedWork",
  ]);
}

/**
 * Run any custom WiQL query and return full work item details
 */
export async function runCustomQuery(
  patToken: string,
  query: string,
  fields: string[] = [
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.ChangedDate",
  ],
): Promise<Array<Record<string, unknown>>> {
  const workItems = await runWiqlQuery(patToken, query);
  const ids = workItems.map((item) => item.id);
  return fetchWorkItemsByIds(patToken, ids, fields);
}
