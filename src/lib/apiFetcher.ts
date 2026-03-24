/**
 * Utility for safe and resilient API fetching from the Python backend.
 * Handles timeouts, connection errors, and provides safe fallbacks.
 */

const DEFAULT_API_URL = "http://127.0.0.1:8000/api/v1";

export async function safeFetch<T>(
  path: string, 
  fallback: T, 
  options: RequestInit = { cache: "no-store", next: { revalidate: 0 } }
): Promise<T> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  const url = path.startsWith("http") ? path : `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(id);

    if (!res.ok) {
      console.warn(`[SafeFetch] Error ${res.status} for ${url}`);
      return fallback;
    }

    return await res.json();
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error(`[SafeFetch] Timeout fetching ${url}`);
    } else {
      console.error(`[SafeFetch] Failed to fetch ${url}:`, error.message);
    }
    return fallback;
  }
}
