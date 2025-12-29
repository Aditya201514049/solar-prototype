/**
 * List of Overpass API endpoints to try (in order)
 * If one fails, we'll try the next one
 */
const OVERPASS_API_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
  "https://overpass.osm.ch/api/interpreter"
];

/**
 * Fetches OSM data from Overpass API with automatic retry and fallback endpoints
 * @param {string} query - Overpass API query string
 * @param {string[]} apiUrls - Array of Overpass API endpoints to try (default: uses predefined list)
 * @param {number} maxRetries - Maximum number of retries per endpoint (default: 2)
 * @param {number} timeout - Request timeout in milliseconds (default: 30000 = 30 seconds)
 * @returns {Promise<Object>} Promise that resolves with parsed OSM JSON data
 */
export async function fetchOSM(
  query, 
  apiUrls = OVERPASS_API_ENDPOINTS, 
  maxRetries = 2,
  timeout = 30000
) {
  const errors = [];

  // Try each endpoint
  for (let endpointIndex = 0; endpointIndex < apiUrls.length; endpointIndex++) {
    const apiUrl = apiUrls[endpointIndex];
    
    // Retry logic for each endpoint
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(apiUrl, {
          method: "POST",
          body: query,
          signal: controller.signal,
          headers: {
            'Content-Type': 'text/plain'
          }
        });

        clearTimeout(timeoutId);

        // Check HTTP status
        if (!response.ok) {
          const statusText = response.statusText || `HTTP ${response.status}`;
          
          // 504 Gateway Timeout or 502 Bad Gateway - retry with next endpoint
          if (response.status === 504 || response.status === 502) {
            errors.push(`${apiUrl}: ${statusText}`);
            break; // Try next endpoint
          }
          
          // 404 Not Found - try next endpoint
          if (response.status === 404) {
            errors.push(`${apiUrl}: ${statusText}`);
            break; // Try next endpoint
          }
          
          // Other errors - throw
          const errorText = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${statusText}${errorText ? ': ' + errorText.slice(0, 100) : ''}`);
        }

        const text = await response.text();
        
        // Try to parse JSON
        try {
          const data = JSON.parse(text);
          
          // Check if response has error elements
          if (data.elements && data.elements.length === 0 && data.remark) {
            throw new Error(`Overpass API returned empty result: ${data.remark}`);
          }
          
          return data;
        } catch (parseError) {
          // If it's not JSON, check if it's an error message
          if (text.includes('error') || text.includes('timeout') || text.includes('rate limit')) {
            errors.push(`${apiUrl}: ${text.slice(0, 200)}`);
            break; // Try next endpoint
          }
          throw new Error(`Overpass API did not return valid JSON.\n\n${text.slice(0, 200)}`);
        }
      } catch (error) {
        // Handle abort (timeout)
        if (error.name === 'AbortError') {
          errors.push(`${apiUrl}: Request timeout after ${timeout}ms`);
          break; // Try next endpoint
        }
        
        // Network errors - retry if we have attempts left
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
          errors.push(`${apiUrl} (attempt ${attempt + 1}): ${error.message}`);
          if (attempt < maxRetries) {
            // Exponential backoff: wait before retry
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue; // Retry same endpoint
          }
          break; // Move to next endpoint
        }
        
        // Other errors - re-throw
        throw error;
      }
    }
  }

  // All endpoints failed
  throw new Error(
    `Failed to fetch OSM data from all Overpass API endpoints.\n\n` +
    `Tried ${apiUrls.length} endpoint(s) with ${maxRetries + 1} attempt(s) each.\n\n` +
    `Errors:\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\n` +
    `This might be due to:\n` +
    `- All Overpass API servers being temporarily unavailable\n` +
    `- Network connectivity issues\n` +
    `- The query being too complex or the area too large\n\n` +
    `Try refreshing the page or checking your internet connection.`
  );
}

