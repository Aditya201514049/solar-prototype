// Panel configuration - stores current panel settings
export const panelConfig = {
  width: 200,      // cm (default: 200cm = 2m)
  height: 100,     // cm (default: 100cm = 1m)
  thickness: 5,    // cm (default: 5cm)
  shape: 'rectangular', // 'rectangular', 'square', 'circular'
  tilt: 0,         // degrees (0 = flat/horizontal, 90 = vertical)
  azimuth: 180,    // degrees (0 = North, 90 = East, 180 = South, 270 = West)
  
  // Update configuration
  setSize(width, height, thickness) {
    this.width = width;
    this.height = height;
    this.thickness = thickness;
  },
  
  setShape(shape) {
    this.shape = shape;
    // Auto-adjust for square shape
    if (shape === 'square') {
      const size = Math.max(this.width, this.height);
      this.width = size;
      this.height = size;
    }
  },
  
  setOrientation(tilt, azimuth) {
    this.tilt = tilt;
    this.azimuth = azimuth;
  }
};

