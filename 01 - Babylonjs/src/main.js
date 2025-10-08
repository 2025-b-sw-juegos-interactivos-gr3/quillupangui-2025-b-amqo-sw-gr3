// src/main.js - escena simple inspirada en Coraline
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const createScene = function () {
  const scene = new BABYLON.Scene(engine);

  // Cámara
  const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 3, 18, new BABYLON.Vector3(0, 1.5, 0), scene);
  camera.attachControl(canvas, true);

  // Luces: ambiente tenue y luz direccional cálida
  const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.4;
  const dir = new BABYLON.DirectionalLight("dir", new BABYLON.Vector3(-0.5, -1, -0.5), scene);
  dir.position = new BABYLON.Vector3(5, 10, 5);
  dir.intensity = 0.9;

  // Añadir un glow sutil para dar vida a colores (sin archivos externos)
  const glow = new BABYLON.GlowLayer("glow", scene);
  glow.intensity = 0.2;

  // Suelo simple (más claro para mejor visibilidad)
  const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 40, height: 40}, scene);
  const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.18, 0.14, 0.1); // marrón claro
  ground.material = groundMat;

  // Paredes simples alrededor para contraste
  const backWall = BABYLON.MeshBuilder.CreatePlane("backWall", {width: 40, height: 12}, scene);
  backWall.position = new BABYLON.Vector3(0, 6, -20);
  const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
  wallMat.diffuseColor = new BABYLON.Color3(0.12, 0.08, 0.04);
  backWall.material = wallMat;

  const leftWall = BABYLON.MeshBuilder.CreatePlane("leftWall", {width: 40, height: 12}, scene);
  leftWall.position = new BABYLON.Vector3(-20, 6, 0);
  leftWall.rotation.y = Math.PI/2;
  leftWall.material = wallMat;

  // Portal / puerta secreta (una puerta roja en un marco)
  const doorFrame = BABYLON.MeshBuilder.CreateBox("doorFrame", {height: 6, width: 3.2, depth: 0.2}, scene);
  doorFrame.position = new BABYLON.Vector3(0, 3, -6);
  const frameMat = new BABYLON.StandardMaterial("frameMat", scene);
  frameMat.diffuseColor = new BABYLON.Color3(0.13, 0.06, 0.03);
  doorFrame.material = frameMat;

  const door = BABYLON.MeshBuilder.CreatePlane("door", {height: 5.4, width: 2.6}, scene);
  door.position = new BABYLON.Vector3(0, 3, -6.11);
  // Puerta 2D con detalles (DynamicTexture)
  const doorDT = new BABYLON.DynamicTexture('doorDT', {width: 512, height: 1060}, scene, true);
  const dctx = doorDT.getContext();
  // Fondo madera rojiza
  dctx.fillStyle = '#7d1a1c'; dctx.fillRect(0,0,512,1060);
  // Borde oscuro
  dctx.strokeStyle = '#3d0c0c'; dctx.lineWidth = 20; dctx.strokeRect(10,10,492,1040);
  // Paneles
  function panel(x,y,w,h){ dctx.strokeStyle = '#4e1111'; dctx.lineWidth = 10; dctx.strokeRect(x,y,w,h); }
  panel(90,160,332,300); // superior
  panel(90,560,332,360); // inferior
  // Perilla y placa
  dctx.fillStyle = '#caa14a'; dctx.beginPath(); dctx.arc(380,530,18,0,Math.PI*2); dctx.fill();
  dctx.fillStyle = '#9b7d30'; dctx.fillRect(360,505,40,10);
  doorDT.update();
  const doorMat = new BABYLON.StandardMaterial("doorMat", scene);
  doorMat.diffuseTexture = doorDT; doorMat.emissiveColor = new BABYLON.Color3(0.9,0.9,0.9);
  door.material = doorMat;

  // Personaje: billboard 2D estilizado (cabello azul delante de la cara, abrigo amarillo)
  function createCoralineBillboard(scene) {
    const plane = BABYLON.MeshBuilder.CreatePlane('coraline2D', {width: 1.6, height: 2.6}, scene);
    plane.position = new BABYLON.Vector3(-2, 1.5, -2);
    plane.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_Y;
    const dt = new BABYLON.DynamicTexture('coralineDT', {width: 512, height: 832}, scene, true);
    dt.hasAlpha = true;
    const ctx = dt.getContext();
    ctx.clearRect(0,0,512,832);
    // helpers
    function path(points, fill) { ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (let i=1;i<points.length;i++){ ctx.lineTo(points[i][0], points[i][1]); } ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    function circle(x,y,r,fill){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    // Cara y cuerpo primero
    circle(256,130,70,'#FCE2C6');
    path([[180,180],[332,180],[380,640],[132,640]], '#F9DC14'); // abrigo
    circle(220,130,16,'#111'); circle(292,130,16,'#111'); // ojos botones
    ctx.strokeStyle = '#7A1515'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(256,170,24,0,Math.PI); ctx.stroke(); // boca
    // Cabello al final (delante de la cara), elevado en Y
    path([[160,40],[352,40],[352,110],[160,110]], '#2186F4'); // cap superior
    path([[140,100],[180,100],[175,240],[140,240]], '#2186F4'); // mechón izq
    path([[332,100],[372,100],[372,240],[337,240]], '#2186F4'); // mechón der
    dt.update();
    const mat = new BABYLON.StandardMaterial('coraline2DMat', scene);
    mat.diffuseTexture = dt; mat.opacityTexture = dt; mat.emissiveColor = new BABYLON.Color3(1,1,1);
    plane.material = mat;
    return plane;
  }
  const coraline = createCoralineBillboard(scene);
  scene.registerBeforeRender(()=>{
    const t = performance.now()*0.001;
    coraline.position.y = 1.5 + Math.sin(t*1.5)*0.03;
    coraline.rotation.z = Math.sin(t*0.8)*0.02;
  });

  return scene;
};

const scene = createScene();
engine.runRenderLoop(() => { scene.render(); });
window.addEventListener("resize", () => { engine.resize(); });
