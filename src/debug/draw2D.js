
import { solarScene } from "../data/solarScene";

export function draw2D(canvas, state) {
  const ctx = canvas.getContext("2d");

  const scale = 150000;
  let zoom = state.zoom;
  let offsetX = state.offsetX;
  let offsetY = state.offsetY;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  solarScene.buildings.forEach(building => {
    ctx.beginPath();

    building.nodeIds.forEach((nodeId, index) => {
      const node = solarScene.nodes[nodeId];
      if (!node) return;

      const x =
        (node.lon - solarScene.location.lon) * scale * zoom +
        canvas.width / 2 + offsetX;

      const y =
        (solarScene.location.lat - node.lat) * scale * zoom +
        canvas.height / 2 + offsetY;

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.closePath();
    ctx.fillStyle = "#999";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.stroke();
  });
}
