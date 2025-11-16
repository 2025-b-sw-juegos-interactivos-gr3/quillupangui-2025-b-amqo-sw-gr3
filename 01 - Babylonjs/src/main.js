// src/main.js - escena que carga coraline_coraline_wii.glb
// Debug-friendly scene loader: logs pasos y dibuja un placeholder si el GLB no aparece.
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

async function createScene() {
  const scene = new BABYLON.Scene(engine);

  // === Havok Physics init ===
  let physicsEnabled = false;
  try {
    const hk = await import("https://cdn.babylonjs.com/havok/HavokPhysics.js");
    const havokInstance = await (hk?.HavokPhysics ? hk.HavokPhysics() : HavokPhysics());
    const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);
    physicsEnabled = true;
  } catch (e) {
    console.warn("Havok init failed; physics will be disabled.", e);
  }

  // CAMBIAR A CÁMARA QUE SIGUE AL JUGADOR (ArcRotateCamera)
  const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 10, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(canvas, true);
  
  // Deshabilitar controles de teclado de la cámara para no interferir con el movimiento
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  
  // Limitar el zoom
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 20;

  new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene).intensity = 0.8;
  const dir = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-0.5,-1,-0.5), scene);
  dir.position = new BABYLON.Vector3(5,10,5);
  dir.intensity = 0.6;

  // ===== PISO CON TEXTURA =====
  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 40, height: 40 }, scene);
  const gmat = new BABYLON.StandardMaterial("gmat", scene);
  
  // Cargar textura del piso (tierra de bosque)
  gmat.diffuseTexture = new BABYLON.Texture("assets/textures/forest_ground.jpg", scene);
  
  // Repetir la textura para que no se vea estirada
  gmat.diffuseTexture.uScale = 10; // Repetir 10 veces en X
  gmat.diffuseTexture.vScale = 10; // Repetir 10 veces en Z
  
  ground.material = gmat;

  // Physics: static ground collider
  try {
    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0, friction: 0.8, restitution: 0 }, scene);
  } catch {}

  // ===== SKYBOX (CIELO ESTRELLADO) =====
  const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
  const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
  skyboxMaterial.backFaceCulling = false;
  
  // Usar UNA SOLA imagen para el cielo
  skyboxMaterial.emissiveTexture = new BABYLON.Texture("assets/textures/night.jpg", scene);
  skyboxMaterial.disableLighting = true;
  
  skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
  skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
  skybox.material = skyboxMaterial;

  // Physics demo extras (static): a box and a sphere to test collisions
  // Quitar objetos de demo visibles (dejamos ejemplo comentado por si se quiere probar)
  // try {
  //   const staticBox = BABYLON.MeshBuilder.CreateBox("staticBox", { size: 1 }, scene);
  //   staticBox.position = new BABYLON.Vector3(2, 0.5, 5);
  //   staticBox.isVisible = false;
  //   new BABYLON.PhysicsAggregate(staticBox, BABYLON.PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, scene);
  //
  //   const staticSphere = BABYLON.MeshBuilder.CreateSphere("staticSphere", { diameter: 1 }, scene);
  //   staticSphere.position = new BABYLON.Vector3(-2, 0.5, 5);
  //   staticSphere.isVisible = false;
  //   new BABYLON.PhysicsAggregate(staticSphere, BABYLON.PhysicsShapeType.SPHERE, { mass: 0, friction: 0.8 }, scene);
  // } catch {}

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
    // === Player physics collider (capsule) ===
    let playerAggregate;
    const playerCollider = BABYLON.MeshBuilder.CreateCapsule("playerCollider", { height: 1.8, radius: 0.4 }, scene);
    playerCollider.position = new BABYLON.Vector3(0, 0.9, 0);
    playerCollider.isVisible = false;
    try {
      playerAggregate = new BABYLON.PhysicsAggregate(playerCollider, BABYLON.PhysicsShapeType.CAPSULE, { mass: 1, friction: 0.5, restitution: 0 }, scene);
      playerAggregate.body.setAngularDamping(100.0);
    } catch {}

    // Fallback de colisiones sin físicas
    if (!physicsEnabled) {
      scene.collisionsEnabled = true;
      ground.checkCollisions = true;
      playerCollider.checkCollisions = true;
      playerCollider.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4);
      playerCollider.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);
    }

    const container = new BABYLON.TransformNode("charRoot", scene);
    container.parent = playerCollider;

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
  const moveSpeed = 5;
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
      const dt = scene.getEngine().getDeltaTime() * 0.001;
      let movement = BABYLON.Vector3.Zero();
      
      // --- LÓGICA DE MOVIMIENTO RELATIVA A LA CÁMARA ---
      const cameraForward = camera.getDirection(BABYLON.Axis.Z);
      const cameraRight = camera.getDirection(BABYLON.Axis.X);
      cameraForward.y = 0;
      cameraRight.y = 0;
      cameraForward.normalize();
      cameraRight.normalize();

      if (keys['w'] || keys['arrowup']) movement.addInPlace(cameraForward);
      if (keys['s'] || keys['arrowdown']) movement.addInPlace(cameraForward.scale(-1));
      if (keys['a'] || keys['arrowleft']) movement.addInPlace(cameraRight.scale(-1));
      if (keys['d'] || keys['arrowright']) movement.addInPlace(cameraRight);

  const wasMoving = isMoving;
  isMoving = movement.lengthSquared() > 1e-6;

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
        // Apply velocity to physics body (preserve Y velocity for gravity)
        const finalVelocity = movement.scale(moveSpeed);
        if (physicsEnabled && playerAggregate?.body) {
          playerAggregate.body.setLinearVelocity(new BABYLON.Vector3(
            finalVelocity.x,
            playerAggregate.body.getLinearVelocity().y,
            finalVelocity.z
          ));
        } else {
          // Fallback sin físicas: mover con colisiones AABB
          const delta = movement.scale(moveSpeed * dt);
          if (scene.collisionsEnabled && playerCollider.checkCollisions) {
            playerCollider.moveWithCollisions(delta);
          } else {
            playerCollider.position.addInPlace(delta);
          }
        }

        // Rotate physics collider to face movement direction
        const targetRotation = Math.atan2(movement.x, movement.z);
        playerCollider.rotation.y = targetRotation + Math.PI;
      } else {
        // Stop horizontal motion but keep gravity
        if (physicsEnabled && playerAggregate?.body) {
          playerAggregate.body.setLinearVelocity(new BABYLON.Vector3(
            0,
            playerAggregate.body.getLinearVelocity().y,
            0
          ));
        }
      }
      // Camera follow
      camera.setTarget(playerCollider.position);
    });

    // ===== CARGAR ÁRBOLES DE SAKURA (DENTRO DEL TRY DE CORALINE) =====
    const sakuraFolder = "assets/sakura/";
    const sakuraFile = "sakura_cherry_blossom.glb";

    // ÁRBOL 1 - Lado derecho
    try {
      const sakuraRes1 = await BABYLON.SceneLoader.ImportMeshAsync("", sakuraFolder, sakuraFile, scene);
      
      console.log("Árbol de sakura 1 cargado:", sakuraRes1.meshes.length, "meshes");
      
      const sakuraContainer1 = new BABYLON.TransformNode("sakuraRoot1", scene);
      
      if (sakuraRes1.meshes[0]) {
        sakuraRes1.meshes[0].parent = sakuraContainer1;
      }
      
      // Posición: A la derecha de Coraline
  sakuraContainer1.position = new BABYLON.Vector3(4, 0, 2);
  sakuraContainer1.scaling = new BABYLON.Vector3(1, 1, 1);
  // Static trunk collider (invisible)
  const trunk1 = BABYLON.MeshBuilder.CreateCylinder("sakuraTrunk1", { diameter: 0.8, height: 3 }, scene);
  trunk1.isVisible = false;
  trunk1.parent = sakuraContainer1;
  trunk1.position.y = 1.5;
  trunk1.checkCollisions = true;
  try { new BABYLON.PhysicsAggregate(trunk1, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.8 }, scene); } catch {}
      
      console.log("Árbol 1 posicionado en:", sakuraContainer1.position);
      
    } catch (sakuraError) {
      console.error("Error cargando árbol de sakura 1:", sakuraError);
    }

    // ÁRBOL 2 - Lado izquierdo (paralelo al primero)
    try {
      const sakuraRes2 = await BABYLON.SceneLoader.ImportMeshAsync("", sakuraFolder, sakuraFile, scene);
      
      console.log("Árbol de sakura 2 cargado:", sakuraRes2.meshes.length, "meshes");
      
      const sakuraContainer2 = new BABYLON.TransformNode("sakuraRoot2", scene);
      
      if (sakuraRes2.meshes[0]) {
        sakuraRes2.meshes[0].parent = sakuraContainer2;
      }
      
      // Posición: A la izquierda de Coraline (paralelo al árbol 1)
  sakuraContainer2.position = new BABYLON.Vector3(-4, 0, 2);
  sakuraContainer2.scaling = new BABYLON.Vector3(1, 1, 1);
  const trunk2 = BABYLON.MeshBuilder.CreateCylinder("sakuraTrunk2", { diameter: 0.8, height: 3 }, scene);
  trunk2.isVisible = false;
  trunk2.parent = sakuraContainer2;
  trunk2.position.y = 1.5;
  trunk2.checkCollisions = true;
  try { new BABYLON.PhysicsAggregate(trunk2, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.8 }, scene); } catch {}
      sakuraContainer2.rotation.y = Math.PI; // 180 grados
      
      console.log("Árbol 2 posicionado en:", sakuraContainer2.position);
      
    } catch (sakuraError) {
      console.error("Error cargando árbol de sakura 2:", sakuraError);
    }

    // ÁRBOL 3 - Lado izquierdo más adelante
    try {
      const sakuraRes3 = await BABYLON.SceneLoader.ImportMeshAsync("", sakuraFolder, sakuraFile, scene);
      
      console.log("Árbol de sakura 3 cargado:", sakuraRes3.meshes.length, "meshes");
      
      const sakuraContainer3 = new BABYLON.TransformNode("sakuraRoot3", scene);
      
      if (sakuraRes3.meshes[0]) {
        sakuraRes3.meshes[0].parent = sakuraContainer3;
      }
      
      // Posición: A la izquierda más adelante
  sakuraContainer3.position = new BABYLON.Vector3(-4, 0, 4);
  sakuraContainer3.scaling = new BABYLON.Vector3(1, 1, 1);
  const trunk3 = BABYLON.MeshBuilder.CreateCylinder("sakuraTrunk3", { diameter: 0.8, height: 3 }, scene);
  trunk3.isVisible = false;
  trunk3.parent = sakuraContainer3;
  trunk3.position.y = 1.5;
  trunk3.checkCollisions = true;
  try { new BABYLON.PhysicsAggregate(trunk3, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.8 }, scene); } catch {}
      sakuraContainer3.rotation.y = Math.PI; // 180 grados
      
      console.log("Árbol 3 posicionado en:", sakuraContainer3.position);
      
    } catch (sakuraError) {
      console.error("Error cargando árbol de sakura 3:", sakuraError);
    }

    // ÁRBOL 4 - Lado derecho más adelante
    try {
      const sakuraRes4 = await BABYLON.SceneLoader.ImportMeshAsync("", sakuraFolder, sakuraFile, scene);
      
      console.log("Árbol de sakura 4 cargado:", sakuraRes4.meshes.length, "meshes");
      
      const sakuraContainer4 = new BABYLON.TransformNode("sakuraRoot4", scene);
      
      if (sakuraRes4.meshes[0]) {
        sakuraRes4.meshes[0].parent = sakuraContainer4;
      }
      
      // Posición: A la derecha más adelante
  sakuraContainer4.position = new BABYLON.Vector3(4, 0, 4);
  sakuraContainer4.scaling = new BABYLON.Vector3(1, 1, 1);
  const trunk4 = BABYLON.MeshBuilder.CreateCylinder("sakuraTrunk4", { diameter: 0.8, height: 3 }, scene);
  trunk4.isVisible = false;
  trunk4.parent = sakuraContainer4;
  trunk4.position.y = 1.5;
  trunk4.checkCollisions = true;
  try { new BABYLON.PhysicsAggregate(trunk4, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.8 }, scene); } catch {}
      
      console.log("Árbol 4 posicionado en:", sakuraContainer4.position);
      
    } catch (sakuraError) {
      console.error("Error cargando árbol de sakura 4:", sakuraError);
    }

    // ÁRBOL 5 - Lado izquierdo atrás
    try {
      const sakuraRes5 = await BABYLON.SceneLoader.ImportMeshAsync("", sakuraFolder, sakuraFile, scene);
      
      console.log("Árbol de sakura 5 cargado:", sakuraRes5.meshes.length, "meshes");
      
      const sakuraContainer5 = new BABYLON.TransformNode("sakuraRoot5", scene);
      
      if (sakuraRes5.meshes[0]) {
        sakuraRes5.meshes[0].parent = sakuraContainer5;
      }
      
      // Posición: A la izquierda atrás (Z = -4)
  sakuraContainer5.position = new BABYLON.Vector3(-4, 0, -4);
  sakuraContainer5.scaling = new BABYLON.Vector3(1, 1, 1);
  const trunk5 = BABYLON.MeshBuilder.CreateCylinder("sakuraTrunk5", { diameter: 0.8, height: 3 }, scene);
  trunk5.isVisible = false;
  trunk5.parent = sakuraContainer5;
  trunk5.position.y = 1.5;
  trunk5.checkCollisions = true;
  try { new BABYLON.PhysicsAggregate(trunk5, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.8 }, scene); } catch {}
      
      console.log("Árbol 5 posicionado en:", sakuraContainer5.position);
      
    } catch (sakuraError) {
      console.error("Error cargando árbol de sakura 5:", sakuraError);
    }

    // ÁRBOL 6 - Lado derecho atrás
    try {
      const sakuraRes6 = await BABYLON.SceneLoader.ImportMeshAsync("", sakuraFolder, sakuraFile, scene);
      
      console.log("Árbol de sakura 6 cargado:", sakuraRes6.meshes.length, "meshes");
      
      const sakuraContainer6 = new BABYLON.TransformNode("sakuraRoot6", scene);
      
      if (sakuraRes6.meshes[0]) {
        sakuraRes6.meshes[0].parent = sakuraContainer6;
      }
      
      // Posición: A la derecha atrás (Z = -4)
  sakuraContainer6.position = new BABYLON.Vector3(4, 0, -4);
  sakuraContainer6.scaling = new BABYLON.Vector3(1, 1, 1);
  const trunk6 = BABYLON.MeshBuilder.CreateCylinder("sakuraTrunk6", { diameter: 0.8, height: 3 }, scene);
  trunk6.isVisible = false;
  trunk6.parent = sakuraContainer6;
  trunk6.position.y = 1.5;
  trunk6.checkCollisions = true;
  try { new BABYLON.PhysicsAggregate(trunk6, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.8 }, scene); } catch {}
      sakuraContainer6.rotation.y = Math.PI; // 180 grados

      console.log("Árbol 6 posicionado en:", sakuraContainer6.position);
      
    } catch (sakuraError) {
      console.error("Error cargando árbol de sakura 6:", sakuraError);
    }

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

// ELIMINAR ESTE BLOQUE (está duplicado y fuera de la función)
// const sakuraFolder = "assets/sakura/";
// const sakuraFile = "sakura_cherry_blossom.glb";

// try {
//   const sakuraRes = await BABYLON.SceneLoader.ImportMeshAsync("", sakuraFolder, sakuraFile, scene);
  
//   console.log("Árbol de sakura cargado:", sakuraRes.meshes.length, "meshes");
  
//   // Crear un contenedor para el árbol
//   const sakuraContainer = new BABYLON.TransformNode("sakuraRoot", scene);
  
//   // Asignar todos los meshes del árbol al contenedor
//   if (sakuraRes.meshes[0]) {
//     sakuraRes.meshes[0].parent = sakuraContainer;
//   }
  
//   // Posicionar el árbol (ajusta según necesites)
//   sakuraContainer.position = new BABYLON.Vector3(0, 5, -10); // Ejemplo: en (0, 5, -10)
  
//   // Ajustar escala si es necesario
//   sakuraContainer.scaling = new BABYLON.Vector3(2, 2, 2);
  
//   // Opcional: rotar el árbol
//   // sakuraContainer.rotation.y = Math.PI / 4; // 45 grados
  
//   console.log("Árbol posicionado en:", sakuraContainer.position);
  
// } catch (sakuraError) {
//   console.error("Error cargando árbol de sakura:", sakuraError);
// }

createScene().then(scene => engine.runRenderLoop(() => scene.render()));
window.addEventListener("resize", () => engine.resize());
