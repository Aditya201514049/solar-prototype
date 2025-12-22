import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { solarScene } from '../data/solarScene';
import { latLonToMeters } from '../geo/latLonToMeters';
import { getSunPosition } from '../solar/sunPosition';
import { createGround } from './ground';
import { addBuildings3D } from './addBuildings3D';
import { setupPanelPlacement } from '../panels/placement';
import { panelConfig } from '../panels/panelConfig';

export function initScene() {
  // Create renderer
  const container = document.getElementById('threejs-container');
  // Clear container if it already has content (prevent duplicates)
  container.innerHTML = '';
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(1400, 800);
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
  controls.enablePan = true; // Enable panning
  controls.panSpeed = 2.0; // Pan speed (higher = faster)
  controls.enableDamping = true; // Smooth camera movement
  controls.dampingFactor = 0.05;
  
  // Configure mouse buttons: left = rotate, middle = pan, right = (reserved for panel removal)
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.PAN, // Middle mouse button for panning
    RIGHT: null // Disable right mouse pan since we use it for panel removal
  };
  
  controls.update();

  // Add keyboard arrow keys for panning (convenient when zoomed in)
  const panSpeed = 50; // Pan distance per key press
  const keys = {};
  window.addEventListener('keydown', (event) => {
    keys[event.code] = true;
  });
  window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
  });

  // Pan with arrow keys
  function handleKeyboardPan() {
    if (keys['ArrowLeft'] || keys['KeyA']) {
      controls.pan(panSpeed, 0);
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
      controls.pan(-panSpeed, 0);
    }
    if (keys['ArrowUp'] || keys['KeyW']) {
      controls.pan(0, -panSpeed);
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      controls.pan(0, panSpeed);
    }
  }

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

  // Add ground plane
  createGround(scene);

  // Calculate normalized sun vector for building irradiance
  const sunVec = new THREE.Vector3(sunX, sunY, sunZ).normalize();

  // Add buildings with shadow casting and irradiance-colored roofs
  const roofMeshes = addBuildings3D(scene, center, sunVec);

  // Setup panel placement system
  const panelSystem = setupPanelPlacement(scene, camera, renderer, roofMeshes);

  // Panel customization modal controls
  const panelModal = document.getElementById('panel-customization-modal');
  const panelSettingsBtn = document.getElementById('panel-settings');
  const closeModalBtn = document.getElementById('close-modal');
  const widthSlider = document.getElementById('panel-width');
  const heightSlider = document.getElementById('panel-height');
  const thicknessSlider = document.getElementById('panel-thickness');
  const shapeSelect = document.getElementById('panel-shape');
  const widthValue = document.getElementById('width-value');
  const heightValue = document.getElementById('height-value');
  const thicknessValue = document.getElementById('thickness-value');

  // Open modal
  if (panelSettingsBtn && panelModal) {
    panelSettingsBtn.addEventListener('click', () => {
      panelModal.classList.add('active');
    });
  }

  // Close modal
  if (closeModalBtn && panelModal) {
    closeModalBtn.addEventListener('click', () => {
      panelModal.classList.remove('active');
    });
  }

  // Close modal when clicking outside of it
  if (panelModal) {
    panelModal.addEventListener('click', (e) => {
      if (e.target === panelModal) {
        panelModal.classList.remove('active');
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panelModal.classList.contains('active')) {
        panelModal.classList.remove('active');
      }
    });
  }

  if (widthSlider && heightSlider && thicknessSlider && shapeSelect) {
    // Update panel configuration when sliders change
    widthSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      panelConfig.width = value;
      widthValue.textContent = value;
      // For square shape, update height too
      if (panelConfig.shape === 'square') {
        panelConfig.height = value;
        heightSlider.value = value;
        heightValue.textContent = value;
      }
    });

    heightSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      panelConfig.height = value;
      heightValue.textContent = value;
      // For square shape, update width too
      if (panelConfig.shape === 'square') {
        panelConfig.width = value;
        widthSlider.value = value;
        widthValue.textContent = value;
      }
    });

    thicknessSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      panelConfig.thickness = value;
      thicknessValue.textContent = value;
    });

    shapeSelect.addEventListener('change', (e) => {
      panelConfig.setShape(e.target.value);
      // Update UI to reflect square shape constraints
      if (e.target.value === 'square') {
        const size = Math.max(panelConfig.width, panelConfig.height);
        panelConfig.width = size;
        panelConfig.height = size;
        widthSlider.value = size;
        heightSlider.value = size;
        widthValue.textContent = size;
        heightValue.textContent = size;
      }
    });
  }

  // Restore previously placed panels (if any)
  panelSystem.restorePanels();

  // --- Sun visualization ---
  // Sun sphere with emissive material for glow effect
  const sunGeom = new THREE.SphereGeometry(40, 32, 32);
  const sunMat = new THREE.MeshPhongMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 1 });
  const sunMesh = new THREE.Mesh(sunGeom, sunMat);
  sunMesh.position.set(sunX, sunY, sunZ);
  sunMesh.castShadow = false;
  sunMesh.receiveShadow = false;
  scene.add(sunMesh);

  // Add a subtle sunbeam (directional helper)
  const sunDir = new THREE.Vector3(sunX, sunY, sunZ).normalize();
  const sunRayGeom = new THREE.CylinderGeometry(2, 2, sunDist * 0.8, 8, 1, true);
  const sunRayMat = new THREE.MeshBasicMaterial({ color: 0xFFFACD, transparent: true, opacity: 0.25 });
  const sunRay = new THREE.Mesh(sunRayGeom, sunRayMat);
  sunRay.position.set(sunX/2, sunY/2, sunZ/2);
  sunRay.lookAt(0, 0, 0);
  scene.add(sunRay);

  // Enable shadow mapping
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    handleKeyboardPan(); // Check for keyboard panning
    controls.update(); // Update controls (for damping)
    renderer.render(scene, camera);
  }
  animate();
}
