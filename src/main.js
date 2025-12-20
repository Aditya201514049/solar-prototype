import { parseOSM } from "./osm/parseOSM";
import { draw2D } from "./debug/draw2D";

const canvas = document.getElementById("map");

const state = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0
};

// Overpass query (UNCHANGED)
const query = `
[out:json];
(
  way["building"](23.7800,90.4000,23.7820,90.4020);
);
out body;
>;
out skel qt;
`;

fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  body: query
})
.then(res => res.json())
.then(data => {
  parseOSM(data);
  draw2D(canvas, state);
});

// Zoom
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  state.zoom *= e.deltaY < 0 ? 1.1 : 0.9;
  draw2D(canvas, state);
});

// Pan
let dragging = false;
let startX, startY;

canvas.addEventListener("mousedown", e => {
  dragging = true;
  startX = e.clientX - state.offsetX;
  startY = e.clientY - state.offsetY;
});

canvas.addEventListener("mousemove", e => {
  if (!dragging) return;
  state.offsetX = e.clientX - startX;
  state.offsetY = e.clientY - startY;
  draw2D(canvas, state);
});

canvas.addEventListener("mouseup", () => dragging = false);
canvas.addEventListener("mouseleave", () => dragging = false);
