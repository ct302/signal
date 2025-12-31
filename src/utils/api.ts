import { RATE_LIMIT_CONFIG } from '../constants';

/**
 * HTTP status codes that are safe to retry
 */
const RETRYABLE_STATUS_CODES = new Set([
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * HTTP status codes that should NOT be retried (permanent failures)
 */
const NON_RETRYABLE_STATUS_CODES = new Set([
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  422, // Unprocessable Entity
]);

/**
 * Options for fetchWithRetry
 */
export interface FetchRetryOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  jitterFactor?: number;
  onRetry?: (attempt: number, maxAttempts: number, waitMs: number, reason: string) => void;
}

/**
 * Custom error class for API errors with enhanced information
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public isRetryable: boolean,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Calculate backoff time with jitter to prevent thundering herd
 */
const calculateBackoffWithJitter = (
  baseBackoff: number,
  attempt: number,
  maxBackoff: number,
  jitterFactor: number
): number => {
  // Exponential backoff: baseBackoff * 2^attempt
  const exponentialBackoff = Math.min(baseBackoff * Math.pow(2, attempt), maxBackoff);

  // Add jitter: ±jitterFactor (e.g., ±25% means multiply by 0.75 to 1.25)
  const jitterMultiplier = 1 - jitterFactor + (Math.random() * jitterFactor * 2);

  return Math.floor(exponentialBackoff * jitterMultiplier);
};

/**
 * Parse Retry-After header (can be seconds or HTTP date)
 */
const parseRetryAfterHeader = (retryAfter: string | null): number | null => {
  if (!retryAfter) return null;

  // Try parsing as seconds
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return null;
};

/**
 * Fetch with exponential backoff retry logic
 *
 * Features:
 * - Exponential backoff with jitter to prevent thundering herd
 * - Respects Retry-After header from server
 * - Distinguishes retryable vs non-retryable errors
 * - Provides callback for retry status (for UI indicators)
 * - Throws ApiError with detailed information on failure
 */
export const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retryOptions: FetchRetryOptions = {}
): Promise<Response> => {
  const {
    maxRetries = RATE_LIMIT_CONFIG.maxRetries,
    initialBackoffMs = RATE_LIMIT_CONFIG.initialBackoffMs,
    maxBackoffMs = RATE_LIMIT_CONFIG.maxBackoffMs,
    jitterFactor = RATE_LIMIT_CONFIG.jitterFactor,
    onRetry
  } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success - return response
      if (response.ok) {
        return response;
      }

      // Non-retryable error - throw immediately
      if (NON_RETRYABLE_STATUS_CODES.has(response.status)) {
        const body = await response.text().catch(() => '');
        throw new ApiError(
          `Request failed with status ${response.status}`,
          response.status,
          false,
          body
        );
      }

      // Retryable error - check if we have retries left
      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxRetries) {
        // Check for Retry-After header
        const retryAfterMs = parseRetryAfterHeader(response.headers.get('Retry-After'));

        // Calculate wait time: prefer Retry-After, fallback to exponential backoff with jitter
        const waitMs = retryAfterMs ?? calculateBackoffWithJitter(
          initialBackoffMs,
          attempt,
          maxBackoffMs,
          jitterFactor
        );

        // Notify caller about retry (for UI updates)
        const reason = response.status === 429 ? 'Rate limited' : `Server error (${response.status})`;
        if (onRetry) {
          onRetry(attempt + 1, maxRetries, waitMs, reason);
        }

        console.log(`[fetchWithRetry] ${reason}, attempt ${attempt + 1}/${maxRetries}, waiting ${waitMs}ms`);

        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      // Out of retries or unknown status - throw error
      const body = await response.text().catch(() => '');
      throw new ApiError(
        `Request failed with status ${response.status} after ${attempt + 1} attempts`,
        response.status,
        RETRYABLE_STATUS_CODES.has(response.status),
        body
      );

    } catch (error) {
      // Network errors are retryable
      if (error instanceof TypeError && error.message.includes('fetch')) {
        lastError = error;

        if (attempt < maxRetries) {
          const waitMs = calculateBackoffWithJitter(
            initialBackoffMs,
            attempt,
            maxBackoffMs,
            jitterFactor
          );

          if (onRetry) {
            onRetry(attempt + 1, maxRetries, waitMs, 'Network error');
          }

          console.log(`[fetchWithRetry] Network error, attempt ${attempt + 1}/${maxRetries}, waiting ${waitMs}ms`);

          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
      }

      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }

      // Wrap other errors
      lastError = error as Error;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Request failed after all retries');
};

/**
 * Legacy signature for backwards compatibility
 * @deprecated Use fetchWithRetry with options object instead
 */
export const fetchWithRetryLegacy = async (
  url: string,
  options: RequestInit,
  retries = 5,
  backoff = 1000
): Promise<Response> => {
  return fetchWithRetry(url, options, {
    maxRetries: retries,
    initialBackoffMs: backoff
  });
};
