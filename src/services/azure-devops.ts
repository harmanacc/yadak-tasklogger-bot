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
 */
function getAuthHeader(patToken: string): string {
  const credentials = Buffer.from(`:${patToken}`).toString("base64");
  return `Basic ${credentials}`;
}

/**
 * Run a WiQL query and return work item references
 */
export async function runWiqlQuery(
  patToken: string,
  query: string,
): Promise<Array<{ id: number; url: string }>> {
  const response = await fetch(
    `${AZURE_DEVOPS_BASE_URL}/_apis/wit/wiql?api-version=${AZURE_DEVOPS_API_VERSION}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAuthHeader(patToken),
      },
      body: JSON.stringify({ query }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Azure DevOps WiQL query failed: ${response.status} - ${errorText}`,
    );
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
    throw new Error(
      `Azure DevOps workitems fetch failed: ${response.status} - ${errorText}`,
    );
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
      AND [System.ChangedDate] >= @today - 1 
      AND [System.ChangedDate] < @today + 1 
    ORDER BY [System.ChangedDate] DESC
  `;

  const workItems = await runWiqlQuery(patToken, query);
  const ids = workItems.map((item) => item.id);
  return fetchWorkItemsByIds(patToken, ids);
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
