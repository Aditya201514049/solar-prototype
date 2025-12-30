/**
 * Manages the panel information sidebar display
 * Updates the sidebar with panel data and handles interactions
 */

/**
 * Updates the panel info sidebar with current panel data
 * @param {Array<THREE.Mesh>} panelMeshes - Array of panel mesh objects
 */
export function updatePanelInfoSidebar(panelMeshes) {
  const panelList = document.getElementById('panel-list');
  if (!panelList) return;

  // Clear existing content
  panelList.innerHTML = '';

  if (panelMeshes.length === 0) {
    // Show empty state
    panelList.innerHTML = `
      <div class="empty-state">
        <p>No panels placed yet.</p>
        <p class="empty-hint">Click "Place Panel" to start adding panels.</p>
      </div>
    `;
    return;
  }

  // Create panel cards
  panelMeshes.forEach((panel, index) => {
    const card = createPanelCard(panel, index + 1);
    panelList.appendChild(card);
  });
}

/**
 * Creates a panel card element with panel information
 * @param {THREE.Mesh} panel - Panel mesh object
 * @param {number} panelNumber - Panel number (1-indexed)
 * @returns {HTMLElement} Panel card element
 */
function createPanelCard(panel, panelNumber) {
  const card = document.createElement('div');
  card.className = 'panel-card';
  card.dataset.panelIndex = panelNumber - 1; // Store 0-indexed for array access

  // Get panel data from userData
  const irradiance = panel.userData.irradiance || 0;
  const shadowFactor = panel.userData.shadowFactor || 1;
  const tilt = panel.userData.tilt || 0;
  const azimuth = panel.userData.azimuth !== undefined ? panel.userData.azimuth : 180;
  const inShadow = panel.userData.inShadow || false;

  // Determine shadow status
  let shadowStatus = 'clear';
  let shadowText = 'CLEAR';
  if (shadowFactor < 0.5) {
    shadowStatus = 'shadowed';
    shadowText = 'SHADOWED';
  } else if (shadowFactor < 1.0) {
    shadowStatus = 'partial';
    shadowText = 'PARTIAL';
  }

  // Format azimuth direction
  const azimuthDirection = getAzimuthDirection(azimuth);

  // Get irradiance category for color coding
  const irradianceCategory = getIrradianceCategory(irradiance);
  const irradiancePercent = Math.round(irradiance * 100);

  // Create card HTML
  card.innerHTML = `
    <div class="panel-card-header">
      <span class="panel-id">Panel ${panelNumber}</span>
      <span class="status-badge ${shadowStatus}">${shadowText}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Irradiance</span>
      <span class="metric-value irradiance-value">
        ${irradiance.toFixed(3)}
        <div class="irradiance-bar">
          <div class="irradiance-fill ${irradianceCategory}" style="width: ${irradiancePercent}%"></div>
        </div>
      </span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Shadow Factor</span>
      <span class="metric-value">${shadowFactor.toFixed(2)}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Tilt</span>
      <span class="metric-value">${tilt}°</span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Azimuth</span>
      <span class="metric-value">${azimuth}° (${azimuthDirection})</span>
    </div>
  `;

  return card;
}

/**
 * Gets the cardinal direction from azimuth angle
 * @param {number} azimuth - Azimuth in degrees (0-360)
 * @returns {string} Direction string (N, NE, E, etc.)
 */
function getAzimuthDirection(azimuth) {
  // Normalize to 0-360
  const normalized = ((azimuth % 360) + 360) % 360;
  
  if (normalized >= 337.5 || normalized < 22.5) return 'N';
  if (normalized >= 22.5 && normalized < 67.5) return 'NE';
  if (normalized >= 67.5 && normalized < 112.5) return 'E';
  if (normalized >= 112.5 && normalized < 157.5) return 'SE';
  if (normalized >= 157.5 && normalized < 202.5) return 'S';
  if (normalized >= 202.5 && normalized < 247.5) return 'SW';
  if (normalized >= 247.5 && normalized < 292.5) return 'W';
  if (normalized >= 292.5 && normalized < 337.5) return 'NW';
  
  return 'N';
}

/**
 * Gets the irradiance category for color coding
 * @param {number} irradiance - Irradiance value (0-1)
 * @returns {string} Category name
 */
function getIrradianceCategory(irradiance) {
  if (irradiance < 0.1) return 'low';
  if (irradiance < 0.25) return 'medium-low';
  if (irradiance < 0.4) return 'medium';
  if (irradiance < 0.55) return 'medium-high';
  if (irradiance < 0.7) return 'high';
  return 'very-high';
}

/**
 * Sets up sidebar toggle functionality
 * @param {Function} onPanelSelect - Callback when a panel is selected
 */
export function setupSidebarToggle(onPanelSelect) {
  const sidebar = document.getElementById('panel-info-sidebar');
  const toggleBtn = document.getElementById('toggle-panel-info');
  const closeBtn = document.getElementById('close-sidebar');
  const panelList = document.getElementById('panel-list');

  if (!sidebar || !toggleBtn) return;

  // Toggle sidebar visibility
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    toggleBtn.classList.toggle('active', sidebar.classList.contains('active'));
  });

  // Close sidebar
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('active');
      toggleBtn.classList.remove('active');
    });
  }

  // Handle panel card clicks
  if (panelList && onPanelSelect) {
    panelList.addEventListener('click', (e) => {
      const card = e.target.closest('.panel-card');
      if (card) {
        const panelIndex = parseInt(card.dataset.panelIndex);
        if (!isNaN(panelIndex) && onPanelSelect) {
          // Remove previous selection
          document.querySelectorAll('.panel-card').forEach(c => {
            c.classList.remove('selected');
          });
          // Add selection to clicked card
          card.classList.add('selected');
          // Call callback with panel index
          onPanelSelect(panelIndex);
        }
      }
    });
  }
}

/**
 * Highlights a specific panel card in the sidebar
 * @param {number} panelIndex - Index of panel to highlight (0-indexed)
 */
export function highlightPanelCard(panelIndex) {
  // Remove previous selection
  document.querySelectorAll('.panel-card').forEach(c => {
    c.classList.remove('selected');
  });

  // Find and select the card
  const card = document.querySelector(`.panel-card[data-panel-index="${panelIndex}"]`);
  if (card) {
    card.classList.add('selected');
    // Scroll into view
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
