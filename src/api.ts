export async function postJSON<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const body = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(body.error || "request failed");
  }
  return body;
}

export function formatJSON(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
