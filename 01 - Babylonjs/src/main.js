// src/main.js - escena que carga coraline_coraline_wii.glb
// Debug-friendly scene loader: logs pasos y dibuja un placeholder si el GLB no aparece.
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

async function createScene() {
  const scene = new BABYLON.Scene(engine);

  // Cámara fija estilo Resident Evil - SIN attachControl
  const camera = new BABYLON.FreeCamera("fixedCam", new BABYLON.Vector3(0, 5, -10), scene);
  camera.setTarget(new BABYLON.Vector3(0, 1, 0)); // Mira hacia el centro del escenario
  // NO attachControl - la cámara está completamente fija

  new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene).intensity = 0.8;
  const dir = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-0.5,-1,-0.5), scene);
  dir.position = new BABYLON.Vector3(5,10,5);
  dir.intensity = 0.6;

  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 40, height: 40 }, scene);
  const gmat = new BABYLON.StandardMaterial("gmat", scene);
  gmat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.22);
  ground.material = gmat;

  const folder = "assets/coraline/";
  const file = "coraline_walk.glb";

  try {
    const res = await BABYLON.SceneLoader.ImportMeshAsync("", folder, file, scene);

    // Texturas (respetando mayúsculas)
    const tex = {
      body:    new BABYLON.Texture("assets/coraline/textures/Body.png", scene),
      eyes:    new BABYLON.Texture("assets/coraline/textures/Eyes.png", scene),
      hair:    new BABYLON.Texture("assets/coraline/textures/Hair.png", scene),
      head:    new BABYLON.Texture("assets/coraline/textures/Head.png", scene),
      firefly: new BABYLON.Texture("assets/coraline/textures/Firefly.png", scene),
    };

    function mkMat(name, t) {
      const m = new BABYLON.PBRMaterial(name, scene);
      m.albedoTexture = t;
      m.metallic = 0;
      m.roughness = 0.9;
      return m;
    }
    const mats = {
      body:    mkMat("m_body", tex.body),
      eyes:    mkMat("m_eyes", tex.eyes),
      hair:    mkMat("m_hair", tex.hair),
      head:    mkMat("m_head", tex.head),
      firefly: mkMat("m_firefly", tex.firefly),
    };

    // Candidatos y nombres originales (antes de reasignar)
    const candidates = res.meshes.filter(m => m !== ground && m.getTotalVertices() > 0);
    const originalNames = new Map(candidates.map(m => [m, (m.material?.name || m.name || "").toLowerCase()]));

    // Glow (una sola vez, dentro del try)
    const glow = new BABYLON.GlowLayer("glow", scene);
    glow.intensity = 0.6;

    // Overrides definitivos (swap eyes/firefly)
    const overrides = new Map([
      ["mesh_3.001", "firefly"], // firefly
      ["mesh_4.004", "eyes"],    // eyes
    ]);

    // Heurística y overrides en el mismo scope
    scene.executeWhenReady(() => {
      scene.render(false);
      const parts = candidates.map(m => {
        const bi = m.getBoundingInfo();
        const min = bi.boundingBox.minimumWorld;
        const max = bi.boundingBox.maximumWorld;
        const center = min.add(max).scale(0.5);
        const size = max.subtract(min);
        return { m, center, size, maxY: max.y };
      }).sort((a, b) => b.maxY - a.maxY);

      const hairPart = parts[0];
      const headPart = parts.find(p => p.m !== hairPart.m && p.size.y > (hairPart.size.y * 0.3)) || parts[1];
      const eyesParts = parts.filter(p =>
        p.m !== hairPart.m &&
        p.m !== headPart.m &&
        p.size.y < (headPart?.size.y || 1) * 0.35 &&
        Math.abs(p.center.y - (headPart?.center.y || 0)) < (headPart?.size.y || 1) * 0.6
      );

      // Default = body
      parts.forEach(p => p.m.material = mats.body);
      if (hairPart) hairPart.m.material = mats.hair;
      if (headPart) headPart.m.material = mats.head;
      eyesParts.forEach(p => p.m.material = mats.eyes);

      // Overrides por nombre original
      candidates.forEach(m => {
        const orig = originalNames.get(m); // p.ej. "mesh_3.001"
        const ov = overrides.get(orig);
        if (!ov) return;
        if (ov === "firefly") {
          m.material = mats.firefly;
          mats.firefly.emissiveTexture = tex.firefly;
          mats.firefly.emissiveColor = new BABYLON.Color3(1, 1, 1);
        } else if (ov === "eyes") {
          m.material = mats.eyes;
        }
      });

      console.log("Asignación final:");
      candidates.forEach(p => console.log(`- ${p.name} | orig=${originalNames.get(p)} -> ${p.material?.name}`));
    });

    // Parent y encuadre
    const container = new BABYLON.TransformNode("charRoot", scene);
    const imported = res.meshes.filter(m => m && m !== ground);
    imported.forEach(m => { if (m.rotationQuaternion) m.rotationQuaternion = null; });
    if (imported[0]) imported[0].parent = container;

    autoOrientUpright(container, imported, scene);
    frameCameraAndScale(container, imported, camera, scene);

    // Guardar y mostrar la rotación inicial después de autoOrient
    scene.executeWhenReady(() => {
      scene.render(false);
      console.log("Rotación inicial del container después de autoOrient:", {
        x: container.rotation.x,
        y: container.rotation.y,
        z: container.rotation.z
      });
    });

    // Animaciones
    const groups = res.animationGroups ?? [];
    console.log("AnimationGroups:", groups.map(g => `${g.name} (targets:${g.targetedAnimations?.length ?? 0})`));
    
    const walkAnim = groups.find(g => (g.targetedAnimations?.length ?? 0) > 0);
    
    if (walkAnim) {
      console.log("Animación encontrada:", walkAnim.name);
      walkAnim.loopAnimation = true;
      walkAnim.start(true);
      walkAnim.goToFrame(0);
      walkAnim.pause();
    } else {
      console.warn("No se encontró animación!");
    }

    // ===== MOVIMIENTO CON CÁMARA FIJA =====
    const moveSpeed = 0.08;
    const keys = {};
    let isMoving = false;

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();
        keys[key] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      keys[key] = false;
    });

    scene.onBeforeRenderObservable.add(() => {
      let movement = BABYLON.Vector3.Zero();
      let targetRotation = null;
      
      if (keys['w'] || keys['arrowup']) {
        movement.z += 1;
        targetRotation = Math.PI; // 180°
      } else if (keys['s'] || keys['arrowdown']) {
        movement.z -= 1;
        targetRotation = 0; // 0°
      } else if (keys['a'] || keys['arrowleft']) {
        movement.x -= 1;
        targetRotation = -Math.PI / 2; // -90°
      } else if (keys['d'] || keys['arrowright']) {
        movement.x += 1;
        targetRotation = Math.PI / 2; // 90°
      }

      const wasMoving = isMoving;
      isMoving = movement.length() > 0;

      if (walkAnim && isMoving !== wasMoving) {
        if (isMoving) {
          console.log("Iniciando animación");
          walkAnim.play(true);
        } else {
          console.log("Pausando animación");
          walkAnim.pause();
        }
      }

      if (isMoving) {
        movement.normalize();
        container.position.addInPlace(movement.scale(moveSpeed));
        
        if (targetRotation !== null) {
          // Rotación INSTANTÁNEA para debug
          container.rotation.y = targetRotation;
          
          console.log("Rotación aplicada:", {
            targetDegrees: (targetRotation * 180 / Math.PI).toFixed(0) + "°",
            targetRadians: targetRotation.toFixed(3),
            currentY: container.rotation.y.toFixed(3),
            currentX: container.rotation.x.toFixed(3),
            currentZ: container.rotation.z.toFixed(3)
          });
        }
      }
    });

  } catch (e) {
    console.error("Error cargando GLB:", e);
  }

  return scene;
}

function computeWorldBounds(meshes) {
  let min = new BABYLON.Vector3(+Infinity, +Infinity, +Infinity);
  let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
  meshes.forEach(m => {
    const bi = m.getBoundingInfo();
    min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld);
    max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld);
  });
  return { min, max, size: max.subtract(min), center: min.add(max).scale(0.5) };
}

function autoOrientUpright(container, meshes, scene) {
  const trials = [
    { axis: null, angle: 0 },
    { axis: BABYLON.Axis.X, angle:  Math.PI/2 },
    { axis: BABYLON.Axis.X, angle: -Math.PI/2 },
    { axis: BABYLON.Axis.Z, angle:  Math.PI/2 },
    { axis: BABYLON.Axis.Z, angle: -Math.PI/2 },
  ];
  const original = container.rotation.clone();
  let best = { h: -Infinity, axis: null, angle: 0 };
  for (const t of trials) {
    container.rotation.copyFrom(original);
    if (t.axis) container.rotate(t.axis, t.angle, BABYLON.Space.LOCAL);
    scene.render(false);
    const { size } = computeWorldBounds(meshes);
    if (size.y > best.h) best = { h: size.y, axis: t.axis, angle: t.angle };
  }
  container.rotation.copyFrom(original);
  if (best.axis) container.rotate(best.axis, best.angle, BABYLON.Space.LOCAL);
}

function frameCameraAndScale(container, meshes, camera, scene) {
  scene.executeWhenReady(() => {
    scene.render(false);
    scene.render(false);
    
    const { size, min } = computeWorldBounds(meshes);
    const currentH = Math.max(0.001, size.y);
    const desiredH = 1.8;
    const s = desiredH / currentH;
    container.scaling.set(s, s, s);
    
    scene.render(false);
    const { min: newMin, max, center } = computeWorldBounds(meshes);
    const groundY = 0;
    const offset = groundY - newMin.y;
    container.position.y += offset;
    
    console.log("Ajuste de posición Y:", offset);
    console.log("Posición final del container:", container.position.y);
  });
}

createScene().then(scene => engine.runRenderLoop(() => scene.render()));
window.addEventListener("resize", () => engine.resize());
