import { auth } from './firebase';

const BASE_URL = 'https://drape-dev.it/admin-api';

/** Pending GET requests for deduplication */
const pendingRequests = new Map<string, Promise<unknown>>();

/**
 * Get the current user's Firebase ID token.
 * Returns null if not authenticated.
 */
async function getToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (err) {
    console.error('[api] Failed to get token:', err);
    return null;
  }
}

/**
 * Generic API call with automatic auth header and JSON parsing.
 * GET requests are deduplicated: concurrent calls to the same endpoint
 * share a single in-flight promise.
 */
export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T | null> {
  const method = (options.method ?? 'GET').toUpperCase();
  const url = `${BASE_URL}${endpoint}`;

  // Deduplicate GET requests
  if (method === 'GET') {
    const existing = pendingRequests.get(url);
    if (existing) {
      return existing as Promise<T | null>;
    }
  }

  const request = (async (): Promise<T | null> => {
    try {
      const token = await getToken();
      if (!token) {
        console.error('[api] No auth token available');
        return null;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...((options.headers as Record<string, string>) ?? {}),
      };

      const response = await fetch(url, {
        ...options,
        method,
        headers,
      });

      if (!response.ok) {
        console.error(`[api] ${method} ${endpoint} → ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data as T;
    } catch (err) {
      console.error(`[api] ${method} ${endpoint} error:`, err);
      return null;
    } finally {
      if (method === 'GET') {
        pendingRequests.delete(url);
      }
    }
  })();

  if (method === 'GET') {
    pendingRequests.set(url, request);
  }

  return request;
}

// ─── Convenience methods ─────────────────────────────────────────────────────

export function apiGet<T>(endpoint: string): Promise<T | null> {
  return apiCall<T>(endpoint);
}

export function apiPost<T>(endpoint: string, body?: unknown): Promise<T | null> {
  return apiCall<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(endpoint: string): Promise<T | null> {
  return apiCall<T>(endpoint, { method: 'DELETE' });
}
