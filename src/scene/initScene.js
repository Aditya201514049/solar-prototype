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
  // Note: getSunPosition uses UTC time internally, but we pass local time
  // For Bangladesh (UTC+6), we need to convert local time to UTC
  const now = new Date();
  // Convert local time to UTC (Bangladesh is UTC+6)
  // If it's 3:09 PM local, that's 9:09 AM UTC
  const utcTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
  // But getSunPosition already uses getUTCHours(), so we can just pass the Date object
  // Actually, let's use the current local time and let getSunPosition handle it
  // The function uses UTC internally, so we need to adjust
  const { azimuth, elevation } = getSunPosition(now, solarScene.location.lat, solarScene.location.lon);
  
  // Debug: log sun position and time
  const localHours = now.getHours();
  const localMinutes = now.getMinutes();
  console.log(`Local time: ${localHours}:${localMinutes.toString().padStart(2, '0')} (BDT, UTC+6)`);
  console.log('Sun position - Azimuth:', azimuth.toFixed(1), '° Elevation:', elevation.toFixed(1), '°');
  // --- Fix: Make sun position and shadows realistic ---
  const sunDist = 2000; // farther for more parallel shadows
  // In OSM/Three.js, Y is north, X is east, Z is up
  // Solar azimuth: 0=north, 90=east, 180=south, 270=west
  // Three.js: +Y=north, +X=east, -Y=south, -X=west
  // Convert solar azimuth to Three.js coordinates
  // Solar 180° (South) should be Three.js -Y direction
  const azRad = (azimuth * Math.PI) / 180; // Convert to radians (0-360°)
  const elRad = elevation * Math.PI / 180;
  
  // Convert from solar azimuth to Three.js coordinates
  // Solar azimuth: 0°=North, 90°=East, 180°=South, 270°=West (clockwise from North)
  // Three.js: +Y=North, +X=East, -Y=South, -X=West
  // Standard conversion: Three.js angle = 90° - solar azimuth (in degrees)
  // But we need to be careful: solar uses clockwise, Three.js uses counter-clockwise
  // For solar azimuth 180° (South), we want -Y direction
  // For solar azimuth 0° (North), we want +Y direction
  // For solar azimuth 90° (East), we want +X direction
  // For solar azimuth 270° (West), we want -X direction
  const threeJsAzRad = ((90 - azimuth) * Math.PI) / 180;
  
  const sunX = sunDist * Math.cos(elRad) * Math.sin(threeJsAzRad);
  const sunY = sunDist * Math.cos(elRad) * Math.cos(threeJsAzRad);
  const sunZ = sunDist * Math.sin(elRad);
  
  // Debug: verify sun position
  console.log('Sun 3D position:', sunX.toFixed(1), sunY.toFixed(1), sunZ.toFixed(1));

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

  // Calculate normalized sun direction vector (FROM surface TO sun)
  // For Lambert's cosine law, we need the direction FROM surface TO sun
  // This is the opposite of the direction FROM sun TO surface
  // Sun is at elevation 23.1° above horizon, so direction should point upward (positive Z)
  // The sun position is (sunX, sunY, sunZ), so direction FROM surface TO sun is: (sunX, sunY, sunZ) normalized
  // But we need to recalculate from azimuth/elevation to ensure correct direction
  // For Three.js: +Y=North, +X=East, +Z=Up
  // Solar azimuth: 0°=North, 90°=East, 180°=South, 270°=West
  // Direction FROM surface TO sun (pointing toward sun):
  const sunVec = new THREE.Vector3(
    Math.cos(elRad) * Math.sin(threeJsAzRad),
    Math.cos(elRad) * Math.cos(threeJsAzRad),
    Math.sin(elRad)  // Positive Z because sun is above horizon
  ).normalize();
  
  // Debug: log sun position and vector for troubleshooting
  console.log('Sun position - Azimuth:', azimuth.toFixed(1), '° Elevation:', elevation.toFixed(1), '°');
  console.log('Sun vector (FROM sun TO surface):', sunVec.x.toFixed(3), sunVec.y.toFixed(3), sunVec.z.toFixed(3));
  
  // Test: Calculate irradiance for a flat panel (should be cos(elevation))
  const flatNormal = new THREE.Vector3(0, 0, 1);
  const flatIrradiance = Math.max(0, sunVec.dot(flatNormal));
  console.log('Flat panel irradiance:', flatIrradiance.toFixed(3), 'Expected cos(elevation):', Math.cos(elRad).toFixed(3), 'Actual sin(elevation):', Math.sin(elRad).toFixed(3));
  console.log('Sun vector Z component:', sunVec.z.toFixed(3), 'Should equal sin(elevation) for correct direction');

  // Add buildings with shadow casting and irradiance-colored roofs
  const roofMeshes = addBuildings3D(scene, center, sunVec);

  // Setup panel placement system (pass sunVec for irradiance calculations)
  const panelSystem = setupPanelPlacement(scene, camera, renderer, roofMeshes, sunVec);

  // Panel customization modal controls
  const panelModal = document.getElementById('panel-customization-modal');
  const panelSettingsBtn = document.getElementById('panel-settings');
  const closeModalBtn = document.getElementById('close-modal');
  const widthSlider = document.getElementById('panel-width');
  const heightSlider = document.getElementById('panel-height');
  const thicknessSlider = document.getElementById('panel-thickness');
  const tiltSlider = document.getElementById('panel-tilt');
  const azimuthSlider = document.getElementById('panel-azimuth');
  const shapeSelect = document.getElementById('panel-shape');
  const widthValue = document.getElementById('width-value');
  const heightValue = document.getElementById('height-value');
  const thicknessValue = document.getElementById('thickness-value');
  const tiltValue = document.getElementById('tilt-value');
  const azimuthValue = document.getElementById('azimuth-value');

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

  if (widthSlider && heightSlider && thicknessSlider && tiltSlider && azimuthSlider && shapeSelect) {
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

    tiltSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      panelConfig.tilt = value;
      tiltValue.textContent = value;
    });

    azimuthSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      panelConfig.azimuth = value;
      azimuthValue.textContent = value;
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
