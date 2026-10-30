const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const modelPath = path.join(root, "public", "eclipse-hologram-enhanced-1.glb");
const sourcePath = path.join(root, "public", "companion.js");
const bundlePath = path.join(root, "public", "assets", "companion.bundle.js");

if (!fs.existsSync(modelPath) || fs.statSync(modelPath).size < 1024) {
  throw new Error("The canonical ECLIPSE hologram GLB is missing or unexpectedly small.");
}
const bytes = fs.readFileSync(modelPath);
if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error("Primary model is missing the GLB magic header.");
if (bytes.readUInt32LE(4) !== 2) throw new Error("Primary model must be binary glTF 2.0.");
if (bytes.readUInt32LE(8) !== bytes.length) throw new Error("GLB declared length does not match the file size.");

let offset = 12;
let document = null;
let binaryChunk = null;
while (offset < bytes.length) {
  if (offset + 8 > bytes.length) throw new Error("GLB contains a truncated chunk header.");
  const length = bytes.readUInt32LE(offset);
  const type = bytes.readUInt32LE(offset + 4);
  offset += 8;
  if (length % 4 !== 0 || offset + length > bytes.length) throw new Error("GLB contains an invalid chunk length.");
  if (type === 0x4e4f534a) {
    if (document) throw new Error("GLB contains multiple JSON chunks.");
    document = JSON.parse(bytes.toString("utf8", offset, offset + length).replace(/[\\u0000\\u0020]+$/g, ""));
  } else if (type === 0x004e4942) {
    if (binaryChunk) throw new Error("GLB contains multiple BIN chunks.");
    binaryChunk = { offset, length };
  }
  offset += length;
}
if (offset !== bytes.length || !document) throw new Error("GLB JSON chunk is missing or malformed.");
if (document.asset?.version !== "2.0") throw new Error("GLB asset metadata is not glTF 2.0.");
if (!Array.isArray(document.scenes) || !document.scenes.length) throw new Error("GLB has no scene.");
if (!Array.isArray(document.nodes) || !document.nodes.length) throw new Error("GLB has no nodes.");
if (!Array.isArray(document.meshes) || !document.meshes.length) throw new Error("GLB has no mesh geometry.");
if (!Array.isArray(document.accessors) || !document.accessors.length) throw new Error("GLB has no accessors.");
if (!Array.isArray(document.bufferViews) || !document.bufferViews.length) throw new Error("GLB has no buffer views.");
if (!binaryChunk) throw new Error("GLB has no embedded binary buffer.");
if (document.buffers?.some(buffer => buffer.uri)) throw new Error("Primary GLB unexpectedly references an external buffer.");
for (const [index, bufferView] of document.bufferViews.entries()) {
  const end = (bufferView.byteOffset || 0) + bufferView.byteLength;
  if (!Number.isInteger(bufferView.byteLength) || bufferView.byteLength < 0 || end > binaryChunk.length) {
    throw new Error("GLB bufferView " + index + " exceeds the embedded binary chunk.");
  }
}
for (const [index, accessor] of document.accessors.entries()) {
  if (!Number.isInteger(accessor.count) || accessor.count < 1) throw new Error("GLB accessor " + index + " has an invalid element count.");
  if (accessor.bufferView !== undefined && !document.bufferViews[accessor.bufferView]) {
    throw new Error("GLB accessor " + index + " references a missing bufferView.");
  }
}
const sceneNodes = document.scenes.flatMap(scene => scene.nodes || []);
if (!sceneNodes.length || sceneNodes.some(index => !document.nodes[index])) throw new Error("GLB scene graph contains invalid root-node references.");
const hasPosition = document.meshes.some(mesh => (mesh.primitives || []).some(primitive =>
  primitive.attributes && Number.isInteger(primitive.attributes.POSITION)
));
if (!hasPosition) throw new Error("GLB has no mesh primitive with POSITION geometry.");

if (!fs.existsSync(bundlePath) || fs.statSync(bundlePath).size < 10000) {
  throw new Error("The production Three.js companion bundle is missing. Run npm run build.");
}
const bundle = fs.readFileSync(bundlePath, "utf8");
if (/https?:\\/\\/(?:cdn\\.)?(?:jsdelivr|unpkg|cdnjs)/i.test(bundle)) {
  throw new Error("The production companion bundle still contains an external CDN dependency.");
}
const source = fs.readFileSync(sourcePath, "utf8");
for (const marker of ["loadWithRetry", "GLTFLoader", "webglcontextlost", "AnimationMixer", "eclipse-hologram-enhanced-1.glb"]) {
  if (!source.includes(marker)) throw new Error("Fault-tolerant hologram runtime is missing required behavior: " + marker);
}
if (/assistantMode\\.textContent\\s*=/.test(source)) {
  throw new Error("Hologram runtime must not overwrite the independent AI status indicator.");
}
console.log("NEXUS primary GLB structure, embedded geometry, and production runtime checks: OK");
