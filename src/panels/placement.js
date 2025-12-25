import * as THREE from 'three';
import { panelConfig } from './panelConfig';
import { createPanelMesh } from './panelModel';

/**
 * Sets up panel placement system with raycasting and event handlers
 * @param {THREE.Scene} scene - Three.js scene
 * @param {THREE.Camera} camera - Three.js camera
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer
 * @param {Array} roofMeshes - Array of roof mesh objects for picking
 * @returns {Object} Object containing panel arrays and control functions
 */
export function setupPanelPlacement(scene, camera, renderer, roofMeshes) {
  const placedPanels = [];
  const panelMeshes = [];
  let placingPanel = false;

  // Helper to add a panel mesh to the scene
  function addPanelToScene(position, config = null) {
    const panel = createPanelMesh(position, config);
    scene.add(panel);
    panelMeshes.push(panel);
    return panel;
  }

  // Panel placement button handler
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
        // Read current panel configuration from panelConfig (updated by sliders)
        const config = {
          width: panelConfig.width,
          height: panelConfig.height,
          thickness: panelConfig.thickness,
          shape: panelConfig.shape,
          tilt: panelConfig.tilt || 0,
          azimuth: panelConfig.azimuth !== undefined ? panelConfig.azimuth : 180
        };
        
        // Store panel position and configuration
        placedPanels.push({
          position: hit.point.clone(),
          roofIdx: roofMeshes.findIndex(r => r.mesh === hit.object),
          config
        });
        
        // Visualize panel immediately with current configuration
        addPanelToScene(hit.point, config);
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
        // Dispose of geometry and material
        hitPanel.geometry.dispose();
        hitPanel.material.dispose();
        // Remove from arrays
        const idx = panelMeshes.indexOf(hitPanel);
        if (idx !== -1) {
          panelMeshes.splice(idx, 1);
          placedPanels.splice(idx, 1);
        }
      }
    }
  });

  // Remove all panels button handler
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

  // Function to restore previously placed panels
  function restorePanels() {
    placedPanels.forEach(p => {
      addPanelToScene(p.position, p.config);
    });
  }

  return {
    placedPanels,
    panelMeshes,
    restorePanels,
    addPanelToScene
  };
}

