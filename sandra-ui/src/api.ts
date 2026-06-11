const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Base URL for file downloads (strip /api suffix)
export const API_FILE_BASE = API_BASE.replace(/\/api$/, "");

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;

  const headers: Record<string, string> = isFormData
    ? {} // Let browser set Content-Type with boundary for FormData
    : { "Content-Type": "application/json" };

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  const json = await response.json();
  if (json.error) throw new Error(json.error);
  return json.data;
}
