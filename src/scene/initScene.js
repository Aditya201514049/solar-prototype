import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { solarScene } from '../data/solarScene';
import { latLonToMeters } from '../geo/latLonToMeters';
import { getSunPosition } from '../solar/sunPosition';
import { calcIrradiance } from '../solar/irradiance';
import { panelConfig } from '../panels/panelConfig';

// Store panel positions and meshes globally for now
const placedPanels = [];
const panelMeshes = [];

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

  // Add a ground plane to receive shadows (X-Y plane, Z=0)
  const groundGeo = new THREE.PlaneGeometry(3000, 3000);
  // Use a light blue color for the ground for better contrast
  const groundMat = new THREE.MeshPhongMaterial({ color: 0xb3d1ff, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Add buildings with shadow casting (extrude along Z) and color roofs by irradiance
  // Also keep a reference to each roof mesh for picking
  const roofMeshes = [];
  solarScene.buildings.forEach((b, idx) => {
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
    const sunVec = new THREE.Vector3(sunX, sunY, sunZ).normalize();
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

  // --- Panel Placement Tool ---
  let placingPanel = false;
  const placePanelBtn = document.getElementById('place-panel');
  if (placePanelBtn) {
    placePanelBtn.addEventListener('click', () => {
      placingPanel = !placingPanel;
      placePanelBtn.textContent = placingPanel ? 'Exit Panel Placement' : 'Place Panel';
      placePanelBtn.classList.toggle('active', placingPanel);
      renderer.domElement.style.cursor = placingPanel ? 'crosshair' : '';
    });
  }

  // Raycaster for picking
  const raycaster = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', (event) => {
    // Left-click (button 0): Add panel (only in placement mode)
    if (event.button === 0 && placingPanel) {
      // Get mouse position in normalized device coordinates
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      // Intersect with roof meshes only
      const intersects = raycaster.intersectObjects(roofMeshes.map(r => r.mesh));
      if (intersects.length > 0) {
        const hit = intersects[0];
        // Store panel position and configuration (on roof)
        placedPanels.push({
          position: hit.point.clone(),
          roofIdx: roofMeshes.findIndex(r => r.mesh === hit.object),
          config: {
            width: panelConfig.width,
            height: panelConfig.height,
            thickness: panelConfig.thickness,
            shape: panelConfig.shape
          }
        });
        // Visualize panel immediately
        addPanelMesh(hit.point);
      }
    }

    // Right-click (button 2): Remove panel (always available)
    if (event.button === 2) {
      event.preventDefault();
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      // Intersect with panel meshes only
      const intersects = raycaster.intersectObjects(panelMeshes);
      if (intersects.length > 0) {
        const hitPanel = intersects[0].object;
        // Remove from scene
        scene.remove(hitPanel);
        // Remove from arrays
        const idx = panelMeshes.indexOf(hitPanel);
        if (idx !== -1) {
          panelMeshes.splice(idx, 1);
          placedPanels.splice(idx, 1);
        }
      }
    }
  });

  // Helper to add a panel mesh at a position with custom configuration
  function addPanelMesh(pos) {
    let panelGeom;
    const width = panelConfig.width / 100; // Convert cm to meters
    const height = panelConfig.height / 100; // Convert cm to meters
    const thickness = panelConfig.thickness / 100; // Convert cm to meters
    
    // Create geometry based on shape
    switch (panelConfig.shape) {
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
    panel.position.copy(pos);
    panel.position.z += thickness / 2; // Position slightly above roof based on thickness
    panel.castShadow = true;
    panel.receiveShadow = true;
    scene.add(panel);
    panelMeshes.push(panel);
  }

  // Remove panel on right-click (pointerdown, button 2)
  // (Already handled above in the unified pointerdown listener)

  // Remove all panels when button is clicked
  const removePanelsBtn = document.getElementById('remove-panels');
  if (removePanelsBtn) {
    removePanelsBtn.addEventListener('click', () => {
      // Remove all panel meshes from the scene
      panelMeshes.forEach(panel => {
        scene.remove(panel);
        // Dispose of geometry and material to free memory
        panel.geometry.dispose();
        panel.material.dispose();
      });
      // Clear the arrays
      panelMeshes.length = 0;
      placedPanels.length = 0;
    });
  }

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

  // Render all previously placed panels (if any)
  // Note: Uses current panelConfig, not the original config when placed
  placedPanels.forEach(p => addPanelMesh(p.position));

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
