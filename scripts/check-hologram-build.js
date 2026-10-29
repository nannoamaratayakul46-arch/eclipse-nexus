const fs = require("node:fs");
const path = require("node:path");

const model = path.join(__dirname, "..", "public", "eclipse-hologram-enhanced-1.glb");
const bundle = path.join(__dirname, "..", "public", "assets", "companion.bundle.js");
if (!fs.existsSync(model) || fs.statSync(model).size < 1024) {
  throw new Error("The exact ECLIPSE hologram GLB is missing or unexpectedly small.");
}
if (!fs.existsSync(bundle) || fs.statSync(bundle).size < 10000) {
  throw new Error("The production Three.js companion bundle is missing. Run npm run build.");
}
const source = fs.readFileSync(bundle, "utf8");
if (/https?:\/\/(?:cdn\.)?(?:jsdelivr|unpkg|cdnjs)/i.test(source)) {
  throw new Error("The production companion bundle still contains an external CDN dependency.");
}
console.log("NEXUS hologram asset and local production bundle checks: OK");
