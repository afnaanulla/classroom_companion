const API_BASE = "http://localhost:3000/api";

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error);
  return json.data;
}
