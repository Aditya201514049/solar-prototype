import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { solarScene } from '../data/solarScene';
import { latLonToMeters } from '../geo/latLonToMeters';

export function initScene() {
  // Create renderer
  const container = document.getElementById('threejs-container');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(1300, 800);
  container.appendChild(renderer.domElement);

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);

  // Camera
  const camera = new THREE.PerspectiveCamera(60, 1300 / 800, 0.1, 10000);
  camera.position.set(0, -400, 400);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.update();

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(100, -200, 500);
  scene.add(dir);

  // Convert OSM footprints to meters, center at (0,0)
  const center = latLonToMeters(solarScene.location.lat, solarScene.location.lon);

  solarScene.buildings.forEach(b => {
    const shape = new THREE.Shape();
    b.footprint.forEach(([lon, lat], i) => {
      const [x, y] = latLonToMeters(lat, lon);
      const px = x - center[0];
      const py = y - center[1];
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    });
    // Extrude
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: b.height,
      bevelEnabled: false
    });
    // Move so base is at z=0
    geometry.translate(0, 0, 0);
    const material = new THREE.MeshLambertMaterial({ color: 0x999999 });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
  });

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}
