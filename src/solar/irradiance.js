/**
 * Calculate direct solar irradiance on a surface
 * Uses Lambert's cosine law: irradiance = cos(angle between sun and surface normal)
 * 
 * @param {THREE.Vector3} sunDir - Normalized sun direction vector (pointing FROM surface TO sun)
 * @param {THREE.Vector3} surfaceNormal - Normalized surface normal vector (pointing outward)
 * @returns {number} Irradiance value (0..1, where 1 = maximum, 0 = no direct sunlight)
 */
export function calcIrradiance(sunDir, surfaceNormal) {
	// Irradiance is proportional to cos(theta) where theta is angle between sun and normal
	// Dot product gives cos(angle) when both vectors are normalized
	const dot = sunDir.dot(surfaceNormal);
	
	// Clamp to 0-1 range
	// Negative values mean sun is behind the surface (no direct light)
	// Values > 1 shouldn't happen with normalized vectors, but clamp for safety
	return Math.max(0, Math.min(1, dot));
}

/**
 * Calculate irradiance for a solar panel
 * Takes into account panel's tilt and azimuth orientation
 * 
 * @param {THREE.Mesh} panelMesh - The panel mesh (must have userData.normal)
 * @param {THREE.Vector3} sunVec - Normalized sun direction vector
 * @returns {number} Irradiance value (0..1)
 */
export function calcPanelIrradiance(panelMesh, sunVec) {
	// Get panel normal from userData (calculated when panel was created)
	const panelNormal = panelMesh.userData.normal;
	
	if (!panelNormal) {
		// Fallback: if normal not stored, assume flat panel (upward normal)
		const flatNormal = new THREE.Vector3(0, 0, 1);
		return calcIrradiance(sunVec, flatNormal);
	}
	
	// Use stored normal (already normalized)
	return calcIrradiance(sunVec, panelNormal);
}

/**
 * Calculate irradiance for a panel with explicit tilt and azimuth
 * Useful when you need to calculate irradiance before creating the panel mesh
 * 
 * @param {number} tilt - Panel tilt in degrees (0 = flat, 90 = vertical)
 * @param {number} azimuth - Panel azimuth in degrees (0 = North, 180 = South)
 * @param {THREE.Vector3} sunVec - Normalized sun direction vector
 * @returns {number} Irradiance value (0..1)
 */
export function calcPanelIrradianceFromOrientation(tilt, azimuth, sunVec) {
	// Calculate panel normal from tilt and azimuth
	// Start with upward normal (Z-axis)
	const normal = new THREE.Vector3(0, 0, 1);
	
	// Convert to radians
	const tiltRad = (tilt * Math.PI) / 180;
	// Use same coordinate conversion as sun vector and panelModel.js
	const threeJsAzRad = ((90 - azimuth) * Math.PI) / 180;
	
	// Apply rotations (same as in panelModel.js)
	normal.applyAxisAngle(new THREE.Vector3(1, 0, 0), -tiltRad);
	normal.applyAxisAngle(new THREE.Vector3(0, 0, 1), threeJsAzRad);
	normal.normalize();
	
	return calcIrradiance(sunVec, normal);
}
