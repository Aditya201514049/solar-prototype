/**
 * Fetches OSM data from Overpass API
 * @param {string} query - Overpass API query string
 * @param {string} apiUrl - Overpass API endpoint (default: https://overpass-api.de/api/interpreter)
 * @returns {Promise<Object>} Promise that resolves with parsed OSM JSON data
 */
export async function fetchOSM(query, apiUrl = "https://overpass-api.de/api/interpreter") {
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      body: query
    });

    const text = await response.text();
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      throw new Error(`Overpass API did not return valid JSON.\n\n${text.slice(0, 200)}`);
    }
  } catch (error) {
    // Re-throw with more context if it's not already our custom error
    if (error.message.includes("Overpass API")) {
      throw error;
    }
    throw new Error(`Failed to fetch OSM data from Overpass API: ${error.message}`);
  }
}

