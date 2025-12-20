const FLOOR_HEIGHT = 3;      // meters per floor
const DEFAULT_HEIGHT = 10;   // meters

function parseHeight(tags = {}) {
  // 1️⃣ Exact height
  if (tags.height) {
    const h = parseFloat(tags.height);
    if (!isNaN(h)) return h;
  }

  // 2️⃣ building:height
  if (tags["building:height"]) {
    const h = parseFloat(tags["building:height"]);
    if (!isNaN(h)) return h;
  }

  // 3️⃣ building levels
  if (tags["building:levels"]) {
    const levels = parseInt(tags["building:levels"]);
    if (!isNaN(levels)) return levels * FLOOR_HEIGHT;
  }

  // 4️⃣ fallback
  return DEFAULT_HEIGHT;
}

export function parseBuildings(osmJson) {
  const nodes = {};
  const buildings = [];

  // store nodes
  osmJson.elements.forEach(el => {
    if (el.type === "node") {
      nodes[el.id] = [el.lon, el.lat];
    }
  });

  // parse buildings
  osmJson.elements.forEach(el => {
    if (el.type === "way" && el.tags?.building) {
      const footprint = el.nodes.map(id => nodes[id]).filter(Boolean);
      if (footprint.length < 3) return;

      buildings.push({
        id: el.id,
        footprint,
        height: parseHeight(el.tags),
        tags: el.tags
      });
    }
  });

  return buildings;
}
