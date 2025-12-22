import * as THREE from 'three';
import { panelConfig } from './panelConfig';

/**
 * Creates a panel mesh with custom configuration
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
  panel.position.copy(position);
  panel.position.z += thickness / 2; // Position slightly above roof based on thickness
  panel.castShadow = true;
  panel.receiveShadow = true;
  
  return panel;
}

