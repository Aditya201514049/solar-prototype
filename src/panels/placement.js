import * as THREE from 'three';
import { panelConfig } from './panelConfig';
import { createPanelMesh } from './panelModel';
import { calcPanelIrradiance, calcIrradiance } from '../solar/irradiance';

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
      // Get the actual world-space normal from the rotated panel
      // This ensures the normal matches the visual orientation
      panel.updateMatrixWorld(true);
      
      // Create a vector pointing up in panel's local space
      const localUp = new THREE.Vector3(0, 0, 1);
      // Transform to world space using panel's rotation matrix
      const worldNormal = localUp.clone();
      worldNormal.transformDirection(panel.matrixWorld);
      worldNormal.normalize();
      
      // Use the world-space normal for irradiance calculation
      const irradiance = calcIrradiance(sunVec, worldNormal);
      
      // Debug: log irradiance for all panels (with color info)
      console.log(`Panel ${panelMeshes.length + 1}: Tilt=${panel.userData.tilt}° Azimuth=${panel.userData.azimuth}° → Irradiance=${irradiance.toFixed(3)} (${irradiance < 0.3 ? 'BLUE' : irradiance < 0.6 ? 'GREEN/CYAN' : irradiance < 0.85 ? 'YELLOW' : 'RED/ORANGE'})`);
      
      // Also store in userData for reference
      panel.userData.irradiance = irradiance;
      panel.userData.worldNormal = worldNormal; // Store for later use
      
      // Color panel based on irradiance
      // Optimized for low sun elevation: More variation in lower ranges
      // Blue (low) -> Cyan -> Green -> Yellow -> Orange -> Red (high)
      let color;
      if (irradiance < 0.1) {
        // Very low: dark blue
        color = new THREE.Color().setHSL(0.6, 1, 0.25);
      } else if (irradiance < 0.25) {
        // Low: blue to cyan (more variation here)
        const t = (irradiance - 0.1) / 0.15;
        color = new THREE.Color().setHSL(0.6 - t * 0.2, 1, 0.25 + t * 0.25);
      } else if (irradiance < 0.4) {
        // Medium-low: cyan to green
        const t = (irradiance - 0.25) / 0.15;
        color = new THREE.Color().setHSL(0.4 - t * 0.15, 1, 0.5 + t * 0.15);
      } else if (irradiance < 0.55) {
        // Medium: green to yellow-green
        const t = (irradiance - 0.4) / 0.15;
        color = new THREE.Color().setHSL(0.25 - t * 0.1, 1, 0.65 + t * 0.1);
      } else if (irradiance < 0.7) {
        // Medium-high: yellow-green to yellow
        const t = (irradiance - 0.55) / 0.15;
        color = new THREE.Color().setHSL(0.15 - t * 0.05, 1, 0.75 + t * 0.05);
      } else if (irradiance < 0.85) {
        // High: yellow to orange
        const t = (irradiance - 0.7) / 0.15;
        color = new THREE.Color().setHSL(0.1 - t * 0.05, 1, 0.8 - t * 0.1);
      } else {
        // Very high: orange to red
        const t = (irradiance - 0.85) / 0.15;
        color = new THREE.Color().setHSL(0.05 - t * 0.05, 1, 0.7 - t * 0.2);
      }
      
      // Update panel material color based on irradiance
      panel.material.color.copy(color);
      // Keep some emissive glow but reduce it for low irradiance
      panel.material.emissive.set(color).multiplyScalar(0.3 * irradiance);
    }
    
    scene.add(panel);
    panelMeshes.push(panel);
    return panel;
  }
  
  // Function to update all panel colors based on current sun position
  function updatePanelIrradiance(newSunVec) {
    panelMeshes.forEach(panel => {
      // Get world-space normal from panel rotation
      panel.updateMatrixWorld(true);
      const localUp = new THREE.Vector3(0, 0, 1);
      const worldNormal = localUp.clone();
      worldNormal.transformDirection(panel.matrixWorld);
      worldNormal.normalize();
      
      const irradiance = calcIrradiance(newSunVec, worldNormal);
      
      // Use same color gradient as addPanelToScene
      let color;
      if (irradiance < 0.1) {
        color = new THREE.Color().setHSL(0.6, 1, 0.25);
      } else if (irradiance < 0.25) {
        const t = (irradiance - 0.1) / 0.15;
        color = new THREE.Color().setHSL(0.6 - t * 0.2, 1, 0.25 + t * 0.25);
      } else if (irradiance < 0.4) {
        const t = (irradiance - 0.25) / 0.15;
        color = new THREE.Color().setHSL(0.4 - t * 0.15, 1, 0.5 + t * 0.15);
      } else if (irradiance < 0.55) {
        const t = (irradiance - 0.4) / 0.15;
        color = new THREE.Color().setHSL(0.25 - t * 0.1, 1, 0.65 + t * 0.1);
      } else if (irradiance < 0.7) {
        const t = (irradiance - 0.55) / 0.15;
        color = new THREE.Color().setHSL(0.15 - t * 0.05, 1, 0.75 + t * 0.05);
      } else if (irradiance < 0.85) {
        const t = (irradiance - 0.7) / 0.15;
        color = new THREE.Color().setHSL(0.1 - t * 0.05, 1, 0.8 - t * 0.1);
      } else {
        const t = (irradiance - 0.85) / 0.15;
        color = new THREE.Color().setHSL(0.05 - t * 0.05, 1, 0.7 - t * 0.2);
      }
      
      panel.material.color.copy(color);
      panel.material.emissive.set(color).multiplyScalar(0.3 * irradiance);
      panel.userData.irradiance = irradiance;
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

