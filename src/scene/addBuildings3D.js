import * as THREE from 'three';
import { solarScene } from '../data/solarScene';
import { latLonToMeters } from '../geo/latLonToMeters';
import { calcIrradiance } from '../solar/irradiance';

/**
 * Adds buildings to the 3D scene with shadow casting and irradiance-colored roofs
 * @param {THREE.Scene} scene - Three.js scene to add buildings to
 * @param {Array<number>} center - Center point [x, y] in meters
 * @param {THREE.Vector3} sunVec - Normalized sun direction vector
 * @returns {Array} Array of roof mesh objects for picking
 */
export function addBuildings3D(scene, center, sunVec) {
  const roofMeshes = [];
  
  solarScene.buildings.forEach((b, idx) => {
    // Create shape from building footprint
    const shape = new THREE.Shape();
    b.footprint.forEach(([lon, lat], i) => {
      const [x, y] = latLonToMeters(lat, lon);
      const px = x - center[0];
      const py = y - center[1];
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    });
    
    // Extrude along Z (height)
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: b.height,
      bevelEnabled: false
    });
    geometry.translate(0, 0, 0);

    // Calculate irradiance for a flat roof (normal = +Z)
    const roofNormal = new THREE.Vector3(0, 0, 1);
    const irr = calcIrradiance(sunVec, roofNormal); // 0..1

    // Color: blue (low) to red (high)
    const color = new THREE.Color().setHSL(0.67 - 0.67 * irr, 1, 0.5); // 0.67=blue, 0=red

    // Multi-material: roof colored by irradiance, walls white
    const materials = [
      new THREE.MeshLambertMaterial({ color: 0xffffff }), // walls
      new THREE.MeshLambertMaterial({ color }) // roof
    ];
    
    // Use groups created by ExtrudeGeometry: group 0 = walls, group 1 = roof
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Store for picking
    roofMeshes.push({ mesh, building: b, shape, idx });
  });
  
  return roofMeshes;
}

