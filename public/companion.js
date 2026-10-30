import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(() => {
  const figure = document.querySelector("#hologramHero .figure");
  if (!figure) return;

  figure.replaceChildren();
  figure.classList.add("eclipse-model");
  const host = document.createElement("div");
  host.id = "eclipseModelCanvas";
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", "ECLIPSE 3D hologram");
  Object.assign(host.style, { position:"absolute", inset:"0", width:"100%", height:"100%", minHeight:"320px" });
  figure.append(host);
  Object.assign(figure.style, { width:"min(76%,560px)", height:"94%", maxHeight:"none", zIndex:"1" });

  const status = document.querySelector("#assistantMode");
  const hero = document.querySelector("#heroStatus");
  const setMode = (mode) => {
    // Hologram lifecycle is independent from the bot API connection indicator.
    if (status) status.textContent = mode;
  };
  let hologramLoaded = false;
  const showDiagnostic = (message) => {
    let note = host.querySelector("[data-hologram-diagnostic]");
    if (!note) {
      note = document.createElement("div");
      note.dataset.hologramDiagnostic = "true";
      note.setAttribute("role", "status");
      note.style.cssText = "position:absolute;left:8%;right:8%;bottom:8px;text-align:center;color:#ff9aa9;font-size:10px;line-height:1.5;z-index:3";
      host.append(note);
    }
    note.textContent = message;
  };

  let renderer;
  try {
    if (!window.WebGLRenderingContext) throw new Error("WebGL is not supported by this browser.");
    renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, powerPreference:"high-performance" });
  } catch (error) {
    console.error("[ECLIPSE] WebGL initialization failed", error);
    setMode("WEBGL UNAVAILABLE");
    showDiagnostic("3D projection unavailable in this browser. Enable WebGL or try a supported browser.");
    renderer = null;
  }

  if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setClearColor(0x000000, 0);
  Object.assign(renderer.domElement.style, { width:"100%", height:"100%", display:"block" });
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.15, 4.8);
  scene.add(new THREE.HemisphereLight(0xc5f6ff, 0x071321, 2.0));
  const key = new THREE.DirectionalLight(0x9beeff, 3.0); key.position.set(3,4,5); scene.add(key);
  const rim = new THREE.PointLight(0x548cff, 22, 12); rim.position.set(-3,1,1); scene.add(rim);
  const fill = new THREE.PointLight(0x8ffff0, 12, 10); fill.position.set(2,-1,3); scene.add(fill);

  const resize = () => {
    if (!renderer || !host.isConnected) return;
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  window.addEventListener("resize", resize, { passive:true });
  resize();

  let model = null;
  let frame = 0;
  let disposed = false;
  const clock = new THREE.Clock();
  const render = () => {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (model && !renderer.getContext().isContextLost()) {
      const t = clock.getElapsedTime();
      model.rotation.y = Math.sin(t * .22) * .10;
      model.position.y = model.userData.baseY + Math.sin(t * .8) * .025;
      renderer.render(scene, camera);
    }
  };
  render();

  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    setMode("WEBGL CONTEXT LOST");
    showDiagnostic("Graphics context interrupted. Waiting for the browser to restore the 3D renderer…");
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    renderer.resetState();
    resize();
    setMode(model ? "3D CORE ONLINE" : "LOADING 3D CORE");
    if (model) showDiagnostic("");
  });

  setMode("LOADING 3D MODEL");
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    if (total > 0 && !model) setMode("LOADING MODEL " + Math.round(loaded / total * 100) + "%");
  };
  manager.onError = (url) => {
    console.error("[ECLIPSE] Asset request failed:", url);
    setMode("MODEL ASSET ERROR");
    showDiagnostic("A 3D asset could not be downloaded. Check the model request in the browser network panel.");
  };
  const loader = new GLTFLoader(manager);
  const modelTimeout = window.setTimeout(() => {
    if (!model && !disposed) {
      setMode("MODEL LOAD TIMEOUT");
      showDiagnostic("The hologram is taking too long to load. Check the GLB request and server response.");
    }
  }, 45000);

  loader.load("/eclipse-hologram-enhanced-1.glb", (gltf) => {
    if (disposed) return;
    window.clearTimeout(modelTimeout);
    try {
      model = gltf.scene;
      hologramLoaded = true;
      const bounds = new THREE.Box3().setFromObject(model);
      const dimensions = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const largestDimension = Math.max(dimensions.x, dimensions.y, dimensions.z);
      if (!Number.isFinite(largestDimension) || largestDimension <= 0) {
        throw new Error("The GLB contains no visible model geometry.");
      }
      model.position.sub(center);
      const scale = 2.65 / largestDimension;
      model.scale.setScalar(scale);
      model.userData.baseY = 0;
      scene.add(model);
      resize();
      setMode("3D CORE ONLINE");
      showDiagnostic("");
    } catch (error) {
      console.error("[ECLIPSE] Model setup failed", error);
      setMode("MODEL PARSE ERROR");
      showDiagnostic("The GLB was downloaded but could not be prepared for rendering.");
    }
  }, (event) => {
    if (event.total > 0 && !model) {
      setMode("DOWNLOADING MODEL " + Math.round(event.loaded / event.total * 100) + "%");
    }
  }, (error) => {
    window.clearTimeout(modelTimeout);
    console.error("[ECLIPSE] GLB load failed", error);
    setMode("3D MODEL ERROR");
    showDiagnostic("The hologram model failed to load. Check the GLB asset response and browser console.");
  });

  window.addEventListener("beforeunload", () => {
    disposed = true;
    window.clearTimeout(modelTimeout);
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    window.removeEventListener("resize", resize);
    renderer.dispose();
  }, { once:true });
  }

  const log = document.querySelector("#chatlog");
  const input = document.querySelector("#assistantInput");
  const send = document.querySelector("#assistantSend");
  const feedback = document.querySelector("#assistantFeedback");
  const history = [];
  let busy = false;
  const bubble = (who, message, ai=false) => {
    if (!log) return;
    const node = document.createElement("div"); node.className = "bubble" + (ai ? " ai" : "");
    const label = document.createElement("div"); label.className = "who"; label.textContent = who;
    const body = document.createElement("div"); body.textContent = message;
    node.append(label, body); log.append(node); log.scrollTop = log.scrollHeight;
  };
  async function ask() {
    const message = (input?.value || "").trim();
    if (!message || busy) return;
    input.value = ""; busy = true; if (send) send.disabled = true;
    setMode("THINKING"); if (feedback) feedback.textContent = "ECLIPSE is consulting the configured AI model…";
    bubble("YOU", message);
    try {
      const response = await fetch("/api/ai/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ message, history:history.slice(-12) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "AI request failed.");
      const answer = String(data.reply || "").trim() || "I couldn't produce a response.";
      history.push({ role:"user", content:message }, { role:"assistant", content:answer });
      bubble("ECLIPSE / AI", answer, true);
      setMode(hologramLoaded ? "3D CORE ONLINE" : "AI ONLINE · MODEL PENDING");
      if (feedback) feedback.textContent = "Response generated by " + (data.model || "configured model") + ".";
    } catch (error) {
      bubble("ECLIPSE / SYSTEM", error.message, true);
      setMode("AI OFFLINE");
      if (feedback) feedback.textContent = error.message;
    } finally {
      busy = false;
      if (send) send.disabled = false;
    }
  }
  send?.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); ask(); }, true);
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); event.stopImmediatePropagation(); ask(); }
  }, true);

})();
