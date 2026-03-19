export async function postJSON<T>(pathname: string, payload: unknown): Promise<T> {
  const response = await fetch("http://127.0.0.1:18090" + pathname, {
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
