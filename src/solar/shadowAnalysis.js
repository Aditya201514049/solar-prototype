import * as THREE from 'three';

/**
 * Checks if a point is in shadow by casting a ray toward the sun
 * @param {THREE.Vector3} point - The point to check (e.g., panel position)
 * @param {THREE.Vector3} sunVec - Normalized sun direction vector (FROM surface TO sun)
 * @param {Array} buildingMeshes - Array of building mesh objects to check against
 * @param {number} maxDistance - Maximum distance to check for shadows (default: 1000m)
 * @returns {boolean} True if point is in shadow, false otherwise
 */
export function isPointInShadow(point, sunVec, buildingMeshes, maxDistance = 1000) {
  // Create a raycaster to check for intersections
  const raycaster = new THREE.Raycaster();
  
  // Cast ray FROM point TOWARD sun
  // sunVec points FROM surface TO sun, so we use it directly (not negated)
  // The ray should go from the point toward the sun
  const rayDirection = sunVec.clone();
  
  // Set up the ray (from point, toward sun)
  raycaster.set(point, rayDirection);
  
  // Check intersections with all building meshes
  // Exclude the panel itself and the roof it's on (if needed)
  const intersects = raycaster.intersectObjects(
    buildingMeshes.map(r => r.mesh),
    false // Don't check children
  );
  
  // If there are intersections and the first one is close (within maxDistance),
  // the point is in shadow
  if (intersects.length > 0) {
    const firstIntersection = intersects[0];
    // Check if intersection is between point and sun (not behind the point)
    // Use a small threshold to avoid immediate intersections with the panel's own roof
    if (firstIntersection.distance > 0.5 && firstIntersection.distance < maxDistance) {
      return true; // Point is in shadow
    }
  }
  
  return false; // Point is not in shadow
}

/**
 * Calculates shadow factor for a panel (0 = fully shadowed, 1 = no shadow)
 * @param {THREE.Vector3} panelPosition - Panel position in world space
 * @param {THREE.Vector3} sunVec - Normalized sun direction vector
 * @param {Array} buildingMeshes - Array of building mesh objects
 * @param {number} maxDistance - Maximum distance to check for shadows
 * @returns {number} Shadow factor (0-1, where 1 = no shadow, 0 = full shadow)
 */
export function calculateShadowFactor(panelPosition, sunVec, buildingMeshes, maxDistance = 1000) {
  const inShadow = isPointInShadow(panelPosition, sunVec, buildingMeshes, maxDistance);
  return inShadow ? 0 : 1; // Simple binary: either in shadow or not
}

/**
 * Enhanced shadow analysis that checks multiple points on a panel
 * This provides more accurate shadow detection for larger panels
 * @param {THREE.Mesh} panelMesh - The panel mesh
 * @param {THREE.Vector3} sunVec - Normalized sun direction vector
 * @param {Array} buildingMeshes - Array of building mesh objects
 * @param {number} samplePoints - Number of sample points to check (default: 4)
 * @param {THREE.Mesh} excludeMesh - Mesh to exclude from shadow checks (e.g., the roof the panel is on)
 * @returns {number} Shadow factor (0-1, average of all sample points)
 */
export function calculatePanelShadowFactor(panelMesh, sunVec, buildingMeshes, samplePoints = 4, excludeMesh = null) {
  // Get panel bounding box to sample points
  panelMesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(panelMesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  
  // Sample points on the panel surface (in panel's local space)
  // Offset slightly above the panel surface to avoid immediate intersections
  const offsetZ = size.z * 0.6; // Offset by 60% of panel thickness above surface
  const localSamples = [];
  if (samplePoints === 1) {
    // Just check center
    localSamples.push(new THREE.Vector3(0, 0, offsetZ));
  } else if (samplePoints === 4) {
    // Check 4 corners (in local space)
    const halfX = size.x * 0.4;
    const halfY = size.y * 0.4;
    localSamples.push(
      new THREE.Vector3(-halfX, -halfY, offsetZ),
      new THREE.Vector3(halfX, -halfY, offsetZ),
      new THREE.Vector3(-halfX, halfY, offsetZ),
      new THREE.Vector3(halfX, halfY, offsetZ)
    );
  } else {
    // Grid sampling
    const gridSize = Math.ceil(Math.sqrt(samplePoints));
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = (i / (gridSize - 1) - 0.5) * size.x * 0.8;
        const y = (j / (gridSize - 1) - 0.5) * size.y * 0.8;
        localSamples.push(new THREE.Vector3(x, y, offsetZ));
      }
    }
  }
  
  // Transform local sample points to world space
  const samples = localSamples.map(localPoint => {
    const worldPoint = localPoint.clone();
    worldPoint.applyMatrix4(panelMesh.matrixWorld);
    return worldPoint;
  });
  
  // Check each sample point
  let shadowedCount = 0;
  samples.forEach(samplePoint => {
    // Filter out the excludeMesh (roof the panel is on) from shadow checks
    const meshesToCheck = excludeMesh 
      ? buildingMeshes.filter(r => r.mesh !== excludeMesh)
      : buildingMeshes;
    
    if (isPointInShadow(samplePoint, sunVec, meshesToCheck)) {
      shadowedCount++;
    }
  });
  
  // Return fraction of panel that's not shadowed
  return 1 - (shadowedCount / samples.length);
}

