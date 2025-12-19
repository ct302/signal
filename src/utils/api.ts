/**
 * Fetch with exponential backoff retry logic
 */
export const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries = 5,
  backoff = 1000
): Promise<Response> => {
  try {
    const response = await fetch(url, options);
    if (response.status === 429 && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};
