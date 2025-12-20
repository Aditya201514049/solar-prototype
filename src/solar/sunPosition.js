// Calculate sun position (azimuth, elevation) for a given date, lat, lon
// Returns { azimuth, elevation } in degrees
// Formula: NOAA Solar Calculator (simplified)
export function getSunPosition(date, lat, lon) {
	// Convert date to UTC
	const rad = Math.PI / 180;
	const day = date.getUTCDate();
	const month = date.getUTCMonth() + 1;
	const year = date.getUTCFullYear();
	const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

	// Day of year
	const N1 = Math.floor(275 * month / 9);
	const N2 = Math.floor((month + 9) / 12);
	const N3 = (1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3));
	const N = N1 - (N2 * N3) + day - 30;

	// Fractional year (in radians)
	const gamma = 2 * Math.PI / 365 * (N - 1 + (hour - 12) / 24);

	// Equation of time (in minutes)
	const eqtime = 229.18 * (
		0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
		- 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
	);

	// Solar declination (in radians)
	const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
		- 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
		- 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

	// Time offset (in minutes)
	const timeOffset = eqtime + 4 * lon;
	// True solar time (in minutes)
	const tst = hour * 60 + timeOffset;
	// Hour angle (in radians)
	const ha = (tst / 4 - 180) * rad;

	// Solar zenith angle
	const latRad = lat * rad;
	const zenith = Math.acos(
		Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(ha)
	);
	// Solar elevation angle
	const elevation = 90 - zenith / rad;

	// Solar azimuth angle
	let azimuth = Math.acos(
		(Math.sin(decl) - Math.sin(latRad) * Math.cos(zenith)) /
		(Math.cos(latRad) * Math.sin(zenith))
	) / rad;
	if (ha > 0) azimuth = 360 - azimuth;

	return { azimuth, elevation };
}
