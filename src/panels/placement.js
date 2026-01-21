import * as THREE from 'three';
import { panelConfig } from './panelConfig';
import { createPanelMesh } from './panelModel';
import { calcPanelIrradiance, calcIrradiance } from '../solar/irradiance';
import { calculatePanelShadowFactor } from '../solar/shadowAnalysis';
import { updatePanelInfoSidebar, setupSidebarToggle, highlightPanelCard } from './panelInfo';

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
  let selectedPanelIndex = -1;
  
  // Store panel-to-roof mapping for shadow analysis
  const panelToRoofMap = new Map();
  
  // Store original materials for highlighting
  const originalMaterials = new Map();

  // Helper to add a panel mesh to the scene with irradiance-based coloring
  function addPanelToScene(position, config = null, panelRoof = null) {
    const panel = createPanelMesh(position, config);
    
    // Store roof mesh immediately if provided
    if (panelRoof) {
      panel.userData.roofMesh = panelRoof;
      console.log(`[PANEL] Creating panel with roof mesh reference`, panelRoof);
    } else {
      console.log(`[PANEL] Creating panel WITHOUT roof mesh reference`);
    }
    
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
      let irradiance = calcIrradiance(sunVec, worldNormal);
      
      // Debug: log normal and dot product for tilted panels
      if (panel.userData.tilt > 0 && panelMeshes.length < 5) {
        const dot = sunVec.dot(worldNormal);
        console.log(`  Panel ${panelMeshes.length + 1} Debug: Tilt=${panel.userData.tilt}° Azimuth=${panel.userData.azimuth}°`);
        console.log(`    World Normal: (${worldNormal.x.toFixed(3)}, ${worldNormal.y.toFixed(3)}, ${worldNormal.z.toFixed(3)})`);
        console.log(`    Sun Vec: (${sunVec.x.toFixed(3)}, ${sunVec.y.toFixed(3)}, ${sunVec.z.toFixed(3)})`);
        console.log(`    Dot product: ${dot.toFixed(3)} → Irradiance: ${irradiance.toFixed(3)}`);
      }
      
      // Phase 3: Shadow Analysis - Check if panel is blocked by buildings
      // Use the provided roof or try to get it from userData
      const excludeRoof = panelRoof || panel.userData.roofMesh;
      console.log(`[PANEL] Shadow calc - excludeRoof is ${excludeRoof ? 'SET' : 'NULL'}`);
      const shadowFactor = calculatePanelShadowFactor(panel, sunVec, roofMeshes, 4, excludeRoof);
      irradiance *= shadowFactor; // Reduce irradiance if in shadow
      
      // Store shadow info for debugging
      panel.userData.shadowFactor = shadowFactor;
      panel.userData.inShadow = shadowFactor < 0.5; // Consider shadowed if more than 50% blocked
      
      // Debug: log irradiance for all panels (with color and shadow info)
      const shadowStatus = shadowFactor < 0.5 ? 'SHADOWED' : shadowFactor < 1 ? 'PARTIAL' : 'CLEAR';
      console.log(`Panel ${panelMeshes.length + 1}: Tilt=${panel.userData.tilt}° Azimuth=${panel.userData.azimuth}° → Irradiance=${irradiance.toFixed(3)} Shadow=${shadowFactor.toFixed(2)} (${shadowStatus})`);
      
      // Also store in userData for reference
      panel.userData.irradiance = irradiance;
      panel.userData.worldNormal = worldNormal; // Store for later use
      
      // Color panel based on irradiance (now includes shadow effects)
      // Optimized for low sun elevation: More variation in lower ranges
      // Blue (low/shadowed) -> Cyan -> Green -> Yellow -> Orange -> Red (high)
      let color;
      if (irradiance < 0.1) {
        // Very low or fully shadowed: dark blue/purple
        color = new THREE.Color().setHSL(0.6, 1, 0.2);
      } else if (irradiance < 0.25) {
        // Low: blue to cyan (more variation here)
        const t = (irradiance - 0.1) / 0.15;
        color = new THREE.Color().setHSL(0.6 - t * 0.2, 1, 0.2 + t * 0.25);
      } else if (irradiance < 0.4) {
        // Medium-low: cyan to green
        const t = (irradiance - 0.25) / 0.15;
        color = new THREE.Color().setHSL(0.4 - t * 0.15, 1, 0.45 + t * 0.15);
      } else if (irradiance < 0.55) {
        // Medium: green to yellow-green
        const t = (irradiance - 0.4) / 0.15;
        color = new THREE.Color().setHSL(0.25 - t * 0.1, 1, 0.6 + t * 0.1);
      } else if (irradiance < 0.7) {
        // Medium-high: yellow-green to yellow
        const t = (irradiance - 0.55) / 0.15;
        color = new THREE.Color().setHSL(0.15 - t * 0.05, 1, 0.7 + t * 0.05);
      } else if (irradiance < 0.85) {
        // High: yellow to orange
        const t = (irradiance - 0.7) / 0.15;
        color = new THREE.Color().setHSL(0.1 - t * 0.05, 1, 0.75 - t * 0.1);
      } else {
        // Very high: orange to red
        const t = (irradiance - 0.85) / 0.15;
        color = new THREE.Color().setHSL(0.05 - t * 0.05, 1, 0.65 - t * 0.2);
      }
      
      // Darken color if panel is significantly shadowed (visual feedback)
      if (shadowFactor < 0.5) {
        color.multiplyScalar(0.6); // Make shadowed panels noticeably darker
      } else if (shadowFactor < 1.0) {
        color.multiplyScalar(0.8 + shadowFactor * 0.2); // Partial shadow
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
    const wasHighlighted = selectedPanelIndex >= 0;
    
    panelMeshes.forEach((panel, index) => {
      // Get world-space normal from panel rotation
      panel.updateMatrixWorld(true);
      const localUp = new THREE.Vector3(0, 0, 1);
      const worldNormal = localUp.clone();
      worldNormal.transformDirection(panel.matrixWorld);
      worldNormal.normalize();
      
      let irradiance = calcIrradiance(newSunVec, worldNormal);
      
      // Phase 3: Recalculate shadow factor with new sun position
      const panelRoof = panel.userData.roofMesh;
      const shadowFactor = calculatePanelShadowFactor(panel, newSunVec, roofMeshes, 4, panelRoof);
      irradiance *= shadowFactor;
      
      // Update shadow info
      panel.userData.shadowFactor = shadowFactor;
      panel.userData.inShadow = shadowFactor < 0.5;
      
      // Update userData irradiance
      panel.userData.irradiance = irradiance;
      
      // Use same color gradient as addPanelToScene
      let color;
      if (irradiance < 0.1) {
        color = new THREE.Color().setHSL(0.6, 1, 0.2);
      } else if (irradiance < 0.25) {
        const t = (irradiance - 0.1) / 0.15;
        color = new THREE.Color().setHSL(0.6 - t * 0.2, 1, 0.2 + t * 0.25);
      } else if (irradiance < 0.4) {
        const t = (irradiance - 0.25) / 0.15;
        color = new THREE.Color().setHSL(0.4 - t * 0.15, 1, 0.45 + t * 0.15);
      } else if (irradiance < 0.55) {
        const t = (irradiance - 0.4) / 0.15;
        color = new THREE.Color().setHSL(0.25 - t * 0.1, 1, 0.6 + t * 0.1);
      } else if (irradiance < 0.7) {
        const t = (irradiance - 0.55) / 0.15;
        color = new THREE.Color().setHSL(0.15 - t * 0.05, 1, 0.7 + t * 0.05);
      } else if (irradiance < 0.85) {
        const t = (irradiance - 0.7) / 0.15;
        color = new THREE.Color().setHSL(0.1 - t * 0.05, 1, 0.75 - t * 0.1);
      } else {
        const t = (irradiance - 0.85) / 0.15;
        color = new THREE.Color().setHSL(0.05 - t * 0.05, 1, 0.65 - t * 0.2);
      }
      
      // Darken if shadowed
      if (shadowFactor < 0.5) {
        color.multiplyScalar(0.6);
      } else if (shadowFactor < 1.0) {
        color.multiplyScalar(0.8 + shadowFactor * 0.2);
      }
      
      // Update material (preserve highlight if this panel is selected)
      if (index === selectedPanelIndex && wasHighlighted) {
        // Keep highlight but update base color
        panel.material.color.copy(color);
        panel.material.emissive.set(0x00ffff).multiplyScalar(0.5); // Maintain cyan highlight
        panel.material.emissiveIntensity = 1.5;
      } else {
        panel.material.color.copy(color);
        panel.material.emissive.set(color).multiplyScalar(0.3 * irradiance);
      }
      
      // Update original material for future highlighting
      if (originalMaterials.has(panel)) {
        const origMat = originalMaterials.get(panel);
        origMat.color.copy(color);
        origMat.emissive.set(color).multiplyScalar(0.3 * irradiance);
      }
    });
    
    // Update sidebar after recalculating irradiance
    updatePanelInfoSidebar(panelMeshes);
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
        
        const roofIdx = roofMeshes.findIndex(r => r.mesh === hit.object);
        const roofMesh = roofMeshes[roofIdx].mesh;
        
        console.log(`[PLACEMENT] Roof index: ${roofIdx}, total roofs: ${roofMeshes.length}`);
        
        // Store panel position and configuration (including roof index for restoration)
        placedPanels.push({
          position: hit.point.clone(),
          roofIdx: roofIdx,
          config
        });
        
        // Visualize panel immediately with current configuration
        // Pass the roof mesh so shadow analysis works correctly from the start
        const panel = addPanelToScene(hit.point, config, roofMesh);
        // Store reference to roof for shadow analysis (exclude this roof from shadow checks)
        if (panel) {
          panel.userData.roofMesh = roofMesh;
          // Recalculate shadow with roofMesh now set (if sunVec exists)
          if (sunVec) {
            panel.updateMatrixWorld(true);
            const localUp = new THREE.Vector3(0, 0, 1);
            const worldNormal = localUp.clone();
            worldNormal.transformDirection(panel.matrixWorld);
            worldNormal.normalize();
            let irradiance = calcIrradiance(sunVec, worldNormal);
            const shadowFactor = calculatePanelShadowFactor(panel, sunVec, roofMeshes, 4, roofMesh);
            irradiance *= shadowFactor;
            panel.userData.shadowFactor = shadowFactor;
            panel.userData.inShadow = shadowFactor < 0.5;
            panel.userData.irradiance = irradiance;
            
            // Update panel color based on recalculated irradiance
            let color;
            if (irradiance < 0.1) {
              color = new THREE.Color().setHSL(0.6, 1, 0.2);
            } else if (irradiance < 0.25) {
              const t = (irradiance - 0.1) / 0.15;
              color = new THREE.Color().setHSL(0.6 - t * 0.2, 1, 0.2 + t * 0.25);
            } else if (irradiance < 0.4) {
              const t = (irradiance - 0.25) / 0.15;
              color = new THREE.Color().setHSL(0.4 - t * 0.15, 1, 0.45 + t * 0.15);
            } else if (irradiance < 0.55) {
              const t = (irradiance - 0.4) / 0.15;
              color = new THREE.Color().setHSL(0.25 - t * 0.1, 1, 0.6 + t * 0.1);
            } else if (irradiance < 0.7) {
              const t = (irradiance - 0.55) / 0.15;
              color = new THREE.Color().setHSL(0.15 - t * 0.05, 1, 0.7 + t * 0.05);
            } else if (irradiance < 0.85) {
              const t = (irradiance - 0.7) / 0.15;
              color = new THREE.Color().setHSL(0.1 - t * 0.05, 1, 0.75 - t * 0.1);
            } else {
              const t = (irradiance - 0.85) / 0.15;
              color = new THREE.Color().setHSL(0.05 - t * 0.05, 1, 0.65 - t * 0.2);
            }
            
            if (shadowFactor < 0.5) {
              color.multiplyScalar(0.6);
            } else if (shadowFactor < 1.0) {
              color.multiplyScalar(0.8 + shadowFactor * 0.2);
            }
            
            panel.material.color.copy(color);
            panel.material.emissive.set(color).multiplyScalar(0.3 * irradiance);
          }
        }
        // Update sidebar after panel is added
        updatePanelInfoSidebar(panelMeshes);
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
          // Clear selection if removed panel was selected
          if (selectedPanelIndex === idx) {
            selectedPanelIndex = -1;
            clearPanelHighlight();
          } else if (selectedPanelIndex > idx) {
            selectedPanelIndex--; // Adjust selection index
          }
          // Remove from original materials map
          originalMaterials.delete(hitPanel);
        }
        // Update sidebar after removing panel
        updatePanelInfoSidebar(panelMeshes);
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
      selectedPanelIndex = -1;
      originalMaterials.clear();
      // Update sidebar
      updatePanelInfoSidebar(panelMeshes);
    });
  }

  // Function to restore previously placed panels
  function restorePanels() {
    placedPanels.forEach(p => {
      // Get the roof mesh if available
      const roofMesh = p.roofIdx !== undefined && roofMeshes[p.roofIdx] 
        ? roofMeshes[p.roofIdx].mesh 
        : null;
      
      // Pass roof mesh so shadow analysis works correctly
      const panel = addPanelToScene(p.position, p.config, roofMesh);
      // Also store roof reference in userData for shadow analysis
      if (panel && roofMesh) {
        panel.userData.roofMesh = roofMesh;
      }
    });
    updatePanelInfoSidebar(panelMeshes);
  }

  // Panel highlighting functions
  function highlightPanel(panelIndex) {
    if (panelIndex < 0 || panelIndex >= panelMeshes.length) return;
    
    // Clear previous highlight
    clearPanelHighlight();
    
    // Highlight selected panel
    selectedPanelIndex = panelIndex;
    const panel = panelMeshes[panelIndex];
    
    // Create highlight effect using outline material
    const highlightMaterial = panel.material.clone();
    highlightMaterial.emissive.set(0x00ffff).multiplyScalar(0.5); // Cyan glow
    highlightMaterial.emissiveIntensity = 1.5;
    
    // Store original and apply highlight
    if (!originalMaterials.has(panel)) {
      originalMaterials.set(panel, panel.material.clone());
    }
    panel.material = highlightMaterial;
    
    // Highlight in sidebar
    highlightPanelCard(panelIndex);
    
    // Optional: Focus camera on panel (smooth transition)
    const panelPosition = panel.position.clone();
    const cameraOffset = new THREE.Vector3(0, -200, 200);
    const targetPosition = panelPosition.clone().add(cameraOffset);
    
    // Animate camera to panel (optional - can be enabled if desired)
    // animateCameraToPosition(camera, controls, targetPosition, panelPosition);
  }

  function clearPanelHighlight() {
    if (selectedPanelIndex >= 0 && selectedPanelIndex < panelMeshes.length) {
      const panel = panelMeshes[selectedPanelIndex];
      if (originalMaterials.has(panel)) {
        panel.material = originalMaterials.get(panel);
      }
    }
    selectedPanelIndex = -1;
    
    // Clear sidebar selection
    document.querySelectorAll('.panel-card').forEach(c => {
      c.classList.remove('selected');
    });
  }

  // Setup sidebar toggle with panel selection callback
  setupSidebarToggle((panelIndex) => {
    highlightPanel(panelIndex);
  });

  // Initialize sidebar (show empty state)
  updatePanelInfoSidebar(panelMeshes);

  return {
    placedPanels,
    panelMeshes,
    restorePanels,
    addPanelToScene,
    updatePanelIrradiance,
    highlightPanel,
    clearPanelHighlight
  };
}

