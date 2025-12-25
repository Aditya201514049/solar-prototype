import * as THREE from 'three';
import { panelConfig } from './panelConfig';
import { createPanelMesh } from './panelModel';
import { calcPanelIrradiance } from '../solar/irradiance';

/**
 * Sets up panel placement system with raycasting and event handlers
 * @param {THREE.Scene} scene - Three.js scene
 * @param {THREE.Camera} camera - Three.js camera
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer
 * @param {Array} roofMeshes - Array of roof mesh objects for picking
 * @param {THREE.Vector3} sunVec - Normalized sun direction vector for irradiance calculations
 * @returns {Object} Object containing panel arrays and control functions
 */
export function setupPanelPlacement(scene, camera, renderer, roofMeshes, sunVec) {
  const placedPanels = [];
  const panelMeshes = [];
  let placingPanel = false;

  // Helper to add a panel mesh to the scene with irradiance-based coloring
  function addPanelToScene(position, config = null) {
    const panel = createPanelMesh(position, config);
    
    // Calculate irradiance for this panel
    if (sunVec) {
      const irradiance = calcPanelIrradiance(panel, sunVec);
      
      // Color panel based on irradiance
      // Blue (low) to Yellow/Green (medium) to Red (high)
      // Use a gradient: blue (0) -> cyan -> yellow -> red (1)
      let color;
      if (irradiance < 0.1) {
        // Very low: dark blue
        color = new THREE.Color().setHSL(0.6, 1, 0.3);
      } else if (irradiance < 0.5) {
        // Low to medium: blue to cyan
        const t = (irradiance - 0.1) / 0.4;
        color = new THREE.Color().setHSL(0.6 - t * 0.2, 1, 0.3 + t * 0.3);
      } else if (irradiance < 0.8) {
        // Medium to high: cyan to yellow
        const t = (irradiance - 0.5) / 0.3;
        color = new THREE.Color().setHSL(0.4 - t * 0.2, 1, 0.6 + t * 0.2);
      } else {
        // High: yellow to red
        const t = (irradiance - 0.8) / 0.2;
        color = new THREE.Color().setHSL(0.2 - t * 0.2, 1, 0.8 - t * 0.3);
      }
      
      // Update panel material color based on irradiance
      panel.material.color.copy(color);
      // Keep some emissive glow but reduce it for low irradiance
      panel.material.emissive.set(color).multiplyScalar(0.3 * irradiance);
      
      // Store irradiance value in userData for later use
      panel.userData.irradiance = irradiance;
    }
    
    scene.add(panel);
    panelMeshes.push(panel);
    return panel;
  }
  
  // Function to update all panel colors based on current sun position
  function updatePanelIrradiance(newSunVec) {
    panelMeshes.forEach(panel => {
      if (panel.userData.normal) {
        const irradiance = calcPanelIrradiance(panel, newSunVec);
        
        // Update color based on new irradiance
        let color;
        if (irradiance < 0.1) {
          color = new THREE.Color().setHSL(0.6, 1, 0.3);
        } else if (irradiance < 0.5) {
          const t = (irradiance - 0.1) / 0.4;
          color = new THREE.Color().setHSL(0.6 - t * 0.2, 1, 0.3 + t * 0.3);
        } else if (irradiance < 0.8) {
          const t = (irradiance - 0.5) / 0.3;
          color = new THREE.Color().setHSL(0.4 - t * 0.2, 1, 0.6 + t * 0.2);
        } else {
          const t = (irradiance - 0.8) / 0.2;
          color = new THREE.Color().setHSL(0.2 - t * 0.2, 1, 0.8 - t * 0.3);
        }
        
        panel.material.color.copy(color);
        panel.material.emissive.set(color).multiplyScalar(0.3 * irradiance);
        panel.userData.irradiance = irradiance;
      }
    });
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
    addPanelToScene,
    updatePanelIrradiance
  };
}

