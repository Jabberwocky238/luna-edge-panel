const baseURL = () => {
  if (window.location.hostname === "localhost") {
    return "http://127.0.0.1:18090";
  }
  return "";
}

export async function postJSON<T>(pathname: string, payload: unknown): Promise<T> {
  const normalizedPath = pathname.trim();
  if (!normalizedPath.startsWith("/")) {
    throw new Error("pathname must start with /");
  }

  const response = await fetch(baseURL() + normalizedPath, {
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
