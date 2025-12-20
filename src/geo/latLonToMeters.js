// Converts latitude/longitude to Web Mercator meters (centered at 0,0 for lon/lat=0,0)
// Returns [x, y] in meters
export function latLonToMeters(lat, lon) {
	const R = 6378137.0; // Earth radius in meters
	const x = R * lon * Math.PI / 180;
	const y = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
	return [x, y];
}
