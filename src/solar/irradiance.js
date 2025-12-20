// Calculate direct solar irradiance on a flat roof
// Inputs: sunDir (THREE.Vector3, normalized), roofNormal (THREE.Vector3, normalized)
// Returns: irradiance (0..1, 1 = max, 0 = shaded or facing away)
export function calcIrradiance(sunDir, roofNormal) {
	// Irradiance is proportional to cos(theta) where theta is angle between sun and normal
	const dot = sunDir.dot(roofNormal);
	return Math.max(0, dot); // 0 if sun is below roof
}
