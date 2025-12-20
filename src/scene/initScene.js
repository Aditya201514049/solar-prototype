import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { solarScene } from '../data/solarScene';
import { latLonToMeters } from '../geo/latLonToMeters';
import { getSunPosition } from '../solar/sunPosition';

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
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // --- Sun position for shadow casting ---
  const now = new Date();
  const { azimuth, elevation } = getSunPosition(now, solarScene.location.lat, solarScene.location.lon);
  // --- Fix: Make sun position and shadows realistic ---
  const sunDist = 2000; // farther for more parallel shadows
  // In OSM/Three.js, Y is north, X is east, Z is up
  // Azimuth: 0=north (+Y), 90=east (+X), 180=south (-Y), 270=west (-X)
  // Elevation: 0=horizon, 90=zenith
  const azRad = (azimuth - 180) * Math.PI / 180; // convert to Three.js: 0=south, 90=west, 180=north, 270=east
  const elRad = elevation * Math.PI / 180;
  const sunX = sunDist * Math.cos(elRad) * Math.sin(azRad);
  const sunY = sunDist * Math.cos(elRad) * Math.cos(azRad);
  const sunZ = sunDist * Math.sin(elRad);

  // Directional light for sun
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
  sunLight.position.set(sunX, sunY, sunZ);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 100;
  sunLight.shadow.camera.far = 3000;
  sunLight.shadow.camera.left = -1000;
  sunLight.shadow.camera.right = 1000;
  sunLight.shadow.camera.top = 1000;
  sunLight.shadow.camera.bottom = -1000;
  scene.add(sunLight);
  scene.add(sunLight.target);


  // Convert OSM footprints to meters, center at (0,0)
  const center = latLonToMeters(solarScene.location.lat, solarScene.location.lon);

  // Add a ground plane to receive shadows (X-Y plane, Z=0)
  const groundGeo = new THREE.PlaneGeometry(3000, 3000);
  const groundMat = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Add buildings with shadow casting (extrude along Z)
  solarScene.buildings.forEach(b => {
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
    // Place base at Z=0
    geometry.translate(0, 0, 0);
    const material = new THREE.MeshLambertMaterial({ color: 0x999999 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  // --- Sun visualization ---
  const sunGeom = new THREE.SphereGeometry(30, 32, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
  const sunMesh = new THREE.Mesh(sunGeom, sunMat);
  sunMesh.position.set(sunX, sunY, sunZ);
  scene.add(sunMesh);

  // Enable shadow mapping
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}
