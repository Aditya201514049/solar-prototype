import * as THREE from 'three';
import { panelConfig } from './panelConfig';

/**
 * Calculates the normal vector of a panel based on its tilt and azimuth
 * @param {number} tilt - Tilt angle in degrees (0 = flat, 90 = vertical)
 * @param {number} azimuth - Azimuth angle in degrees (0 = North, 180 = South)
 * @returns {THREE.Vector3} Normal vector pointing outward from panel surface
 */
export function calculatePanelNormal(tilt, azimuth) {
  // Start with upward normal (Z-axis)
  const normal = new THREE.Vector3(0, 0, 1);
  
  // Convert to radians
  const tiltRad = (tilt * Math.PI) / 180;
  
  // Convert panel azimuth to Three.js coordinate system
  // Panel azimuth: 0°=North, 90°=East, 180°=South, 270°=West (same as solar azimuth)
  // Three.js: +Y=North, +X=East, -Y=South, -X=West
  // Convert to Three.js angle: threeJsAngle = 90° - panelAzimuth
  // But we need to match the sun vector coordinate system
  // Sun uses: threeJsAzRad = ((90 - solarAzimuth) * PI) / 180
  // So panel should use the same: threeJsAzRad = ((90 - azimuth) * PI) / 180
  // However, the panel rotation uses (azimuth - 180), so we need to adjust
  // Actually, let's use the same conversion as the sun vector for consistency
  const threeJsAzRad = ((90 - azimuth) * Math.PI) / 180;
  
  // Apply rotations in same order as panel mesh:
  // 1. Tilt around X-axis (negative rotation to tilt toward South)
  normal.applyAxisAngle(new THREE.Vector3(1, 0, 0), -tiltRad);
  
  // 2. Azimuth rotation around Z-axis
  // Use the same coordinate system as sun vector and panel rotation
  normal.applyAxisAngle(new THREE.Vector3(0, 0, 1), threeJsAzRad);
  
  return normal.normalize();
}

/**
 * Creates a panel mesh with custom configuration including tilt and azimuth
 * @param {THREE.Vector3} position - Position where the panel should be placed
 * @param {Object} config - Panel configuration (optional, uses panelConfig if not provided)
 * @returns {THREE.Mesh} The panel mesh
 */
export function createPanelMesh(position, config = null) {
  // Use provided config or fall back to global panelConfig
  const cfg = config || panelConfig;
  
  let panelGeom;
  const width = cfg.width / 100; // Convert cm to meters
  const height = cfg.height / 100; // Convert cm to meters
  const thickness = cfg.thickness / 100; // Convert cm to meters
  
  // Get tilt and azimuth (default to 0 if not provided)
  const tilt = cfg.tilt || 0;
  const azimuth = cfg.azimuth !== undefined ? cfg.azimuth : 180; // Default to South
  
  // Create geometry based on shape
  switch (cfg.shape) {
    case 'square':
      // Square: use the larger dimension
      const size = Math.max(width, height);
      panelGeom = new THREE.BoxGeometry(size, size, thickness);
      break;
    case 'circular':
      // Circular: use cylinder with radius based on average dimension
      const radius = Math.max(width, height) / 2;
      panelGeom = new THREE.CylinderGeometry(radius, radius, thickness, 32);
      // Rotate cylinder to lie flat (rotate 90 degrees around X-axis)
      panelGeom.rotateX(Math.PI / 2);
      break;
    case 'rectangular':
    default:
      // Rectangular: standard box
      panelGeom = new THREE.BoxGeometry(width, height, thickness);
      break;
  }
  
  const panelMat = new THREE.MeshPhongMaterial({ color: 0x00c3ff, emissive: 0x0077ff });
  const panel = new THREE.Mesh(panelGeom, panelMat);
  
  // Position panel on roof
  panel.position.copy(position);
  panel.position.z += thickness / 2; // Position slightly above roof based on thickness
  
  // Apply rotations for tilt and azimuth
  // For a panel on a horizontal roof:
  // 1. First tilt around X-axis (makes it lean toward a direction)
  // 2. Then rotate around Z-axis for azimuth (which direction it faces)
  
  // Tilt rotation: rotate around X-axis (pitch)
  // Tilt: 0° = flat/horizontal, 90° = vertical
  // Positive rotation tilts panel toward -Y direction (South when azimuth = 180)
  const tiltRad = (tilt * Math.PI) / 180;
  panel.rotateX(-tiltRad); // Negative to tilt toward correct direction
  
  // Azimuth rotation: rotate around Z-axis (yaw)
  // In Three.js: +Y is North, +X is East
  // Azimuth: 0° = North, 90° = East, 180° = South, 270° = West
  // Use same coordinate conversion as sun vector: threeJsAngle = 90° - azimuth
  const threeJsAzRad = ((90 - azimuth) * Math.PI) / 180;
  panel.rotateZ(threeJsAzRad);
  
  panel.castShadow = true;
  panel.receiveShadow = true;
  
  // Store panel normal for irradiance calculations (optional metadata)
  panel.userData.normal = calculatePanelNormal(tilt, azimuth);
  panel.userData.tilt = tilt;
  panel.userData.azimuth = azimuth;
  
  return panel;
}

