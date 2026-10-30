import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(() => {
  const figure = document.querySelector("#hologramHero .figure");
  if (!figure || figure.dataset.eclipseRuntime === "ready") return;
  figure.dataset.eclipseRuntime = "ready";

  // Keep the authored SVG projection visible until the real GLB is rendered.
  const fallback = figure.querySelector("svg");
  const host = document.createElement("div");
  host.id = "eclipseModelCanvas";
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", "ECLIPSE primary 3D hologram");
  Object.assign(host.style, {
    position: "absolute", inset: "0", width: "100%", height: "100%",
    minHeight: "320px", opacity: "0", transition: "opacity 420ms ease",
    pointerEvents: "none"
  });
  figure.append(host);
  figure.classList.add("eclipse-model");
  Object.assign(figure.style, { position: "relative", overflow: "visible", filter: "drop-shadow(0 0 17px #a8cbd744)" });

  const assistantMode = document.querySelector("#assistantMode");
  const assistantFeedback = document.querySelector("#assistantFeedback");
  const runtimeStatus = document.createElement("div");
  runtimeStatus.id = "eclipseHologramStatus";
  runtimeStatus.setAttribute("role", "status");
  runtimeStatus.setAttribute("aria-live", "polite");
  runtimeStatus.style.cssText = "position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:4;max-width:90%;padding:5px 9px;border:1px solid #29434b;border-radius:20px;background:#04121ddd;color:#a8cbd7;font:8px/1.3 system-ui;letter-spacing:.12em;text-align:center;white-space:nowrap";
  host.append(runtimeStatus);

  let renderer = null;
  let scene = null;
  let camera = null;
  let resizeObserver = null;
  let intersectionObserver = null;
  let animationFrame = 0;
  let disposed = false;
  let visible = true;
  let pageVisible = !document.hidden;
  let activeModel = null;
  let mixer = null;
  let fallbackIdle = null;
  let lastFrame = 0;
  let elapsed = 0;
  let resizeHandler = null;
  let contextLost = false;
  let successful = false;

  const setRuntimeStatus = (message, detail = "") => {
    runtimeStatus.textContent = message;
    runtimeStatus.title = detail || message;
    runtimeStatus.dataset.state = message.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (detail) console.warn("[ECLIPSE hologram]", message, detail);
  };
  const setFallback = (message) => {
    host.style.opacity = "0";
    if (fallback) fallback.style.opacity = "1";
    setRuntimeStatus(message);
  };
  const revealModel = () => {
    successful = true;
    if (fallback) {
      fallback.style.transition = "opacity 420ms ease";
      fallback.style.opacity = "0";
      fallback.setAttribute("aria-hidden", "true");
    }
    host.style.opacity = "1";
    setRuntimeStatus("PRIMARY 3D CORE ONLINE", "eclipse-hologram-enhanced-1.glb");
  };

  const createRenderer = () => {
    if (!window.WebGLRenderingContext) throw new Error("WebGL is not supported.");
    const next = new THREE.WebGLRenderer({
      alpha: true, antialias: true, powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false
    });
    next.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    next.outputColorSpace = THREE.SRGBColorSpace;
    next.toneMapping = THREE.ACESFilmicToneMapping;
    next.toneMappingExposure = 1.2;
    next.setClearColor(0x000000, 0);
    Object.assign(next.domElement.style, { width: "100%", height: "100%", display: "block" });
    host.insertBefore(next.domElement, runtimeStatus);
    return next;
  };

  const buildScene = () => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
    scene.add(new THREE.HemisphereLight(0xc5f6ff, 0x071321, 2.0));
    const key = new THREE.DirectionalLight(0x9beeff, 3.0);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0x548cff, 22, 12);
    rim.position.set(-3, 1, 1);
    scene.add(rim);
    const fill = new THREE.PointLight(0x8ffff0, 12, 10);
    fill.position.set(2, -1, 3);
    scene.add(fill);
  };

  const fitCamera = (root) => {
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    if (bounds.isEmpty()) throw new Error("The GLB contains no renderable geometry.");
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    if (![size.x, size.y, size.z, center.x, center.y, center.z].every(Number.isFinite)) {
      throw new Error("The GLB has invalid geometry bounds.");
    }
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (!(maxDimension > 0)) throw new Error("The GLB geometry has zero size.");

    // Center/normalize inside a stable pivot, then calculate a camera distance
    // that fits the bounding sphere in both vertical and horizontal FOV.
    const pivot = new THREE.Group();
    pivot.name = "ECLIPSE_MODEL_PIVOT";
    root.position.sub(center);
    root.scale.multiplyScalar(2.7 / maxDimension);
    pivot.add(root);
    pivot.updateMatrixWorld(true);

    const normalizedBounds = new THREE.Box3().setFromObject(pivot);
    const sphere = normalizedBounds.getBoundingSphere(new THREE.Sphere());
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) {
      throw new Error("The GLB could not be framed because its bounding sphere is invalid.");
    }
    const aspect = Math.max(0.35, host.clientWidth / Math.max(1, host.clientHeight));
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
    const limitingHalfFov = Math.max(0.08, Math.min(verticalHalfFov, horizontalHalfFov));
    const distance = (sphere.radius / Math.sin(limitingHalfFov)) * 1.16;
    camera.position.set(0, sphere.center.y + sphere.radius * 0.08, Math.max(3.2, distance));
    camera.lookAt(0, sphere.center.y, 0);
    camera.near = Math.max(0.01, distance / 100);
    camera.far = Math.max(100, distance * 20);
    camera.updateProjectionMatrix();
    return pivot;
  };

  const resize = () => {
    if (!renderer || !host.isConnected || disposed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    if (activeModel) {
      const pivot = activeModel.parent;
      if (pivot) {
        const bounds = new THREE.Box3().setFromObject(pivot);
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        const aspect = width / height;
        const v = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const h = Math.atan(Math.tan(v) * aspect);
        const distance = (sphere.radius / Math.sin(Math.max(0.08, Math.min(v, h)))) * 1.16;
        camera.aspect = aspect;
        camera.position.set(0, sphere.center.y + sphere.radius * 0.08, Math.max(3.2, distance));
        camera.lookAt(0, sphere.center.y, 0);
        camera.near = Math.max(0.01, distance / 100);
        camera.far = Math.max(100, distance * 20);
      }
    } else {
      camera.aspect = width / height;
    }
    camera.updateProjectionMatrix();
  };

  const shouldRender = () => !disposed && !contextLost && visible && pageVisible && renderer;
  const render = (timestamp) => {
    if (disposed) return;
    animationFrame = requestAnimationFrame(render);
    if (!shouldRender()) return;
    const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;
    elapsed += delta;
    if (mixer) mixer.update(delta);
    else if (activeModel && fallbackIdle) {
      activeModel.rotation.y = Math.sin(elapsed * 0.22) * 0.10;
      activeModel.position.y = fallbackIdle.baseY + Math.sin(elapsed * 0.8) * 0.025;
    }
    try {
      renderer.render(scene, camera);
    } catch (error) {
      console.error("[ECLIPSE] Hologram render failed", error);
      setRuntimeStatus("RENDER FAILURE", error?.message || "Unknown renderer failure");
      host.style.opacity = "0";
    }
  };

  const loadWithRetry = async (attempt = 1) => {
    const maxAttempts = 3;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      setRuntimeStatus(attempt === 1 ? "FETCHING PRIMARY GLB" : "RETRYING PRIMARY GLB " + attempt + "/" + maxAttempts);
      const response = await fetch("/eclipse-hologram-enhanced-1.glb", {
        method: "GET", cache: "no-cache", credentials: "same-origin",
        headers: { Accept: "model/gltf-binary, application/octet-stream" },
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error("GLB request returned HTTP " + response.status);
        error.retryable = response.status >= 500 || response.status === 408 || response.status === 429;
        throw error;
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 20) throw new Error("GLB response is unexpectedly small.");
      const view = new DataView(buffer);
      if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Downloaded asset does not have the GLB magic header.");
      if (view.getUint32(4, true) !== 2) throw new Error("Only binary glTF 2.0 assets are supported.");
      if (view.getUint32(8, true) !== buffer.byteLength) throw new Error("GLB declared length does not match downloaded bytes.");
      setRuntimeStatus("PARSING PRIMARY GLB");
      const loader = new GLTFLoader();
      const gltf = await new Promise((resolve, reject) => {
        loader.parse(buffer, "/", resolve, reject);
      });
      if (!gltf || !(gltf.scene || gltf.scenes?.length)) throw new Error("GLB contains no usable scene.");
      return gltf;
    } catch (error) {
      if (attempt >= maxAttempts || error.retryable === false) throw error;
      if (error.name !== "AbortError" && !error.retryable && !/fetch|network|load|timeout|HTTP 5|HTTP 4(08|29)/i.test(error.message || "")) {
        throw error;
      }
      setRuntimeStatus("LOAD RETRY " + attempt + "/" + maxAttempts, error.message);
      await new Promise(resolve => window.setTimeout(resolve, 700 * attempt));
      return loadWithRetry(attempt + 1);
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const disposeObject = (object) => {
    if (!object) return;
    object.traverse?.(node => {
      if (node.geometry) node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value && value.isTexture) value.dispose();
        }
        material.dispose?.();
      }
    });
  };

  const boot = async () => {
    try {
      setRuntimeStatus("INITIALIZING WEBGL");
      renderer = createRenderer();
      buildScene();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      intersectionObserver = new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting);
        if (visible) lastFrame = 0;
      }, { threshold: 0.01 });
      intersectionObserver.observe(figure);
      resizeHandler = resize;
      window.addEventListener("resize", resizeHandler, { passive: true });
      document.addEventListener("visibilitychange", onVisibilityChange);
      renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);
      renderer.domElement.addEventListener("webglcontextrestored", onContextRestored, false);
      resize();
      animationFrame = requestAnimationFrame(render);

      const gltf = await loadWithRetry();
      if (disposed) return;
      const sourceScene = gltf.scene || gltf.scenes[0];
      const pivot = fitCamera(sourceScene);
      scene.add(pivot);
      activeModel = sourceScene;
      if (Array.isArray(gltf.animations) && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(sourceScene);
        gltf.animations.forEach(clip => mixer.clipAction(clip).play());
      } else {
        fallbackIdle = { baseY: sourceScene.position.y };
      }
      resize();
      revealModel();
    } catch (error) {
      console.error("[ECLIPSE] Primary hologram initialization failed", error);
      setFallback(error.name === "AbortError" ? "MODEL LOAD TIMEOUT · FALLBACK ACTIVE" : "3D UNAVAILABLE · FALLBACK ACTIVE");
      runtimeStatus.title = error?.message || "Unknown hologram initialization error";
      if (assistantFeedback && !assistantFeedback.textContent.trim()) {
        assistantFeedback.textContent = "Hologram fallback active; AI controls remain available.";
      }
    }
  };

  function onVisibilityChange() {
    pageVisible = !document.hidden;
    if (pageVisible) lastFrame = 0;
  }
  function onContextLost(event) {
    event.preventDefault();
    contextLost = true;
    setRuntimeStatus("GRAPHICS CONTEXT LOST");
    host.style.opacity = "0";
  }
  function onContextRestored() {
    contextLost = false;
    try {
      renderer.resetState();
      resize();
      setRuntimeStatus("GRAPHICS RESTORED · RELOADING MODEL");
      if (activeModel) {
        scene.remove(activeModel.parent || activeModel);
        disposeObject(activeModel);
        activeModel = null;
      }
      mixer = null;
      bootAfterContextRestore();
    } catch (error) {
      console.error("[ECLIPSE] WebGL restoration failed", error);
      setFallback("GRAPHICS RECOVERY FAILED · FALLBACK ACTIVE");
    }
  }
  async function bootAfterContextRestore() {
    try {
      const gltf = await loadWithRetry();
      if (disposed) return;
      const sourceScene = gltf.scene || gltf.scenes[0];
      const pivot = fitCamera(sourceScene);
      scene.add(pivot);
      activeModel = sourceScene;
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(sourceScene);
        gltf.animations.forEach(clip => mixer.clipAction(clip).play());
      } else fallbackIdle = { baseY: sourceScene.position.y };
      resize();
      revealModel();
    } catch (error) {
      setFallback("MODEL RECOVERY FAILED · FALLBACK ACTIVE");
      runtimeStatus.title = error?.message || "Unknown recovery error";
    }
  }

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (renderer?.domElement) {
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
    }
    mixer?.stopAllAction();
    disposeObject(activeModel);
    renderer?.dispose();
  };
  window.addEventListener("pagehide", cleanup, { once: true });

  // AI owns assistantMode; the hologram has its own independent status badge.
  if (assistantMode && !assistantMode.dataset.eclipseAiStatus) {
    assistantMode.dataset.eclipseAiStatus = "true";
  }
  boot();
})();