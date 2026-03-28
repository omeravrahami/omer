import { fetch } from "expo/fetch";

// Response envelope type - all app routes return { data: T }
interface ApiResponse<T> {
  data: T;
}

const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;

// Default request timeout in milliseconds
const REQUEST_TIMEOUT_MS = 20_000;

const request = async <T>(
  url: string,
  options: { method?: string; body?: string } = {}
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      signal: controller.signal,
    });

    // 1. Handle 204 No Content
    if (response.status === 204) {
      return null as unknown as T;
    }

    // 2. JSON responses: parse and unwrap { data }
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const json: ApiResponse<T> = await response.json();
      // TanStack Query forbids undefined — coerce to null
      return (json.data ?? null) as T;
    }

    // 3. Non-JSON: return null (undefined is forbidden by TanStack Query)
    return null as unknown as T;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("הבקשה נכשלה: תם הזמן הקצוב (timeout). בדוק את החיבור לאינטרנט.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: any) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: any) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
  patch: <T>(url: string, body: any) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
};
