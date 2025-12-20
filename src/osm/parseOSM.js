
import { solarScene } from "../data/solarScene";

export function parseOSM(osmData) {
  solarScene.nodes = {};
  solarScene.buildings = [];

  osmData.elements.forEach(el => {
    if (el.type === "node") {
      solarScene.nodes[el.id] = el;
    }

    if (el.type === "way" && el.nodes) {
      solarScene.buildings.push({
        id: el.id,
        nodeIds: el.nodes,
        tags: el.tags || {}
      });
    }
  });
}
