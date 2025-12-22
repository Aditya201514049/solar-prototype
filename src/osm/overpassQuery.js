/**
 * Generates an Overpass API query string to fetch buildings within a bounding box
 * @param {number} minLat - Minimum latitude (south boundary)
 * @param {number} minLon - Minimum longitude (west boundary)
 * @param {number} maxLat - Maximum latitude (north boundary)
 * @param {number} maxLon - Maximum longitude (east boundary)
 * @returns {string} Overpass API query string
 */
export function buildOverpassQuery(minLat, minLon, maxLat, maxLon) {
  return `[out:json];
(
  way["building"](${minLat},${minLon},${maxLat},${maxLon});
);
out body;
>;
out skel qt;`;
}

/**
 * Generates an Overpass API query for buildings at a specific location with a bounding box size
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} size - Size of bounding box in degrees (default: 0.002)
 * @returns {string} Overpass API query string
 */
export function buildOverpassQueryFromCenter(lat, lon, size = 0.002) {
  const minLat = lat - size / 2;
  const maxLat = lat + size / 2;
  const minLon = lon - size / 2;
  const maxLon = lon + size / 2;
  return buildOverpassQuery(minLat, minLon, maxLat, maxLon);
}

