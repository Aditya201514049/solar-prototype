import * as THREE from 'three';

/**
 * Creates and adds a ground plane to the scene
 * @param {THREE.Scene} scene - Three.js scene to add ground to
 * @param {number} size - Size of the ground plane (default: 3000)
 * @param {number} color - Color of the ground (default: 0xb3d1ff - light blue)
 * @returns {THREE.Mesh} The ground mesh
 */
export function createGround(scene, size = 3000, color = 0xb3d1ff) {
  const groundGeo = new THREE.PlaneGeometry(size, size);
  const groundMat = new THREE.MeshPhongMaterial({ color, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

