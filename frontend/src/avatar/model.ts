import * as THREE from 'three';
import type { Pose } from '../domain/poses';

// Modelo articulado nativo: las referencias raster guían la silueta y la paleta.
// No requiere descargar un GLB ni enviar las imágenes a un servicio externo.
export function createAresModel() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = {
    blue: new THREE.MeshStandardMaterial({ color: '#087cba', metalness: .55, roughness: .34 }),
    darkBlue: new THREE.MeshStandardMaterial({ color: '#103761', metalness: .55, roughness: .4 }),
    cyan: new THREE.MeshStandardMaterial({ color: '#37cbee', metalness: .4, roughness: .3 }),
    dark: new THREE.MeshStandardMaterial({ color: '#071b2c', metalness: .45, roughness: .4 }),
    green: new THREE.MeshStandardMaterial({ color: '#0dcc98', metalness: .4, roughness: .28 }),
    energy: new THREE.MeshStandardMaterial({ color: '#70ffd0', emissive: '#00ffaa', emissiveIntensity: 1.3, roughness: .25 }),
    face: new THREE.MeshStandardMaterial({ color: '#030e1b', metalness: .15, roughness: .3 }),
    cape: new THREE.MeshStandardMaterial({ color: '#035b64', metalness: .15, roughness: .7, side: THREE.DoubleSide }),
  };
  type MaterialName = keyof typeof materials;
  const ownedGeometry: THREE.BufferGeometry[] = [geometry];
  function block(parent: THREE.Object3D, dimensions: [number, number, number], position: [number, number, number], material: MaterialName) {
    const mesh = new THREE.Mesh(geometry, materials[material]);
    mesh.scale.set(...dimensions);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const torso = new THREE.Group(); torso.position.y = 1.36; body.add(torso);
  block(torso, [.98, .88, .64], [0, 0, 0], 'dark');
  block(torso, [1.02, .4, .76], [0, .23, .04], 'green');
  block(torso, [.73, .12, .04], [0, .32, .44], 'energy');
  block(torso, [.2, .3, .06], [0, .16, .45], 'energy');
  for (let i = 0; i < 3; i++) block(torso, [.8, .09, .08], [0, -.06 - i * .16, .35], 'blue');
  block(torso, [1.09, .18, .79], [0, -.45, .02], 'cyan');
  block(torso, [.22, .2, .09], [0, -.45, .46], 'green');
  const head = new THREE.Group(); head.position.y = 2.34; body.add(head);
  block(head, [1.5, 1.12, 1.08], [0, 0, 0], 'darkBlue');
  block(head, [1.53, .17, 1.13], [0, .51, 0], 'blue');
  block(head, [1.37, .07, 1.02], [0, .62, 0], 'cyan');
  block(head, [1.22, .77, .07], [0, -.02, .56], 'face');
  block(head, [1.34, .08, .13], [0, -.45, .6], 'cyan');
  for (const sign of [-1, 1]) {
    block(head, [.13, .9, .15], [sign * .64, -.02, .59], 'blue');
    block(head, [.08, .65, .16], [sign * .73, -.13, .57], 'cyan');
    block(head, [.12, .4, .42], [sign * .8, -.01, -.02], 'cyan');
    block(head, [.13, .29, .28], [sign * .82, -.01, .01], 'blue');
  }
  block(head, [.26, .58, .17], [0, .43, .66], 'dark');
  block(head, [.2, .51, .19], [0, .45, .69], 'green');
  block(head, [.055, .33, .035], [0, .45, .8], 'energy');
  // Cresta de vóxeles con píxeles binarios en ambos lados.
  for (let i = 0; i < 6; i++) {
    const height = .27 + Math.sin(i / 5 * Math.PI) * .2;
    const z = -.48 + i * .17;
    block(head, [.28, height, .19], [0, .7 + height / 2, z], 'green');
    block(head, [.3, .05, .19], [0, .7 + height, z], 'energy');
    for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
      block(head, [.012, .04, .045], [side * .145, .76 + j * .1, z], (i + j) % 3 === 0 ? 'cyan' : 'energy');
    }
  }
  const eyes = new THREE.Group(); eyes.position.set(0, -.015, .615); head.add(eyes);
  const eyePatterns = {
    normal: ['00100', '00100', '00100', '00100', '00100'],
    cross: ['10001', '01010', '00100', '01010', '10001'],
    right: ['10000', '01000', '00100', '01000', '10000'],
    left: ['00001', '00010', '00100', '00010', '00001'],
    arc: ['00100', '01010', '10001', '00000', '00000'],
    angryRight: ['10000', '01000', '00100', '00010', '00010'],
    angryLeft: ['00001', '00010', '00100', '01000', '01000'],
    scan: ['11111', '10001', '10101', '10001', '11111'],
  };
  function setEyes(pose: Pose) {
    eyes.clear();
    let left = eyePatterns.normal, right = eyePatterns.normal;
    if (pose.id === 2) left = right = eyePatterns.cross;
    else if (pose.id === 15) left = right = eyePatterns.arc;
    else if (pose.id === 16) left = right = eyePatterns.scan;
    else if ([9, 10].includes(pose.id)) { left = eyePatterns.angryRight; right = eyePatterns.angryLeft; }
    else if (![1, 5, 13].includes(pose.id)) { left = eyePatterns.right; right = eyePatterns.left; }
    [left, right].forEach((pattern, eye) => pattern.forEach((row, y) => [...row].forEach((pixel, x) => {
      if (pixel === '1') block(eyes, [.046, .046, .025], [(eye === 0 ? -.26 : .26) + (x - 2) * .044, .08 + (2 - y) * .044, 0], 'energy');
    })));
    if ([4, 7, 15].includes(pose.id)) {
      block(eyes, [.12, .035, .025], [0, -.17, 0], 'energy');
      block(eyes, [.035, .04, .025], [-.075, -.14, 0], 'energy');
      block(eyes, [.035, .04, .025], [.075, -.14, 0], 'energy');
    } else if ([3, 8, 10, 12, 14].includes(pose.id)) block(eyes, [.13, .027, .025], [0, -.16, 0], 'energy');
  }
  const legs = [-1, 1].map(sign => {
    const leg = new THREE.Group(); leg.position.set(sign * .29, .91, 0); body.add(leg);
    block(leg, [.37, .65, .45], [0, -.26, 0], 'darkBlue');
    block(leg, [.41, .23, .5], [0, -.12, .06], 'blue');
    block(leg, [.23, .19, .06], [0, -.12, .35], 'green');
    block(leg, [.48, .29, .74], [0, -.64, .14], 'blue');
    block(leg, [.45, .08, .76], [0, -.53, .15], 'cyan');
    block(leg, [.32, .19, .06], [0, -.65, .55], 'green');
    return leg;
  });
  const arms = [-1, 1].map(sign => {
    const arm = new THREE.Group(); arm.position.set(sign * .79, 1.72, 0); body.add(arm);
    block(arm, [.47, .34, .64], [0, 0, 0], 'green');
    block(arm, [.4, .07, .64], [0, .19, 0], 'energy');
    block(arm, [.28, .43, .34], [0, -.34, 0], 'dark');
    block(arm, [.37, .34, .44], [0, -.51, .015], 'blue');
    block(arm, [.24, .28, .06], [0, -.51, .27], 'cyan');
    block(arm, [.32, .24, .37], [0, -.78, .03], 'darkBlue');
    return arm;
  });
  const rightArm = arms[0]!, leftArm = arms[1]!;
  const sword = new THREE.Group(); sword.position.set(0, -.84, .3); rightArm.add(sword);
  block(sword, [.1, .3, .1], [0, 0, 0], 'darkBlue');
  block(sword, [.4, .08, .17], [0, -.13, 0], 'green');
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-.11, -.18); bladeShape.lineTo(.11, -.18); bladeShape.lineTo(.11, -.82);
  bladeShape.lineTo(0, -.98); bladeShape.lineTo(-.11, -.82); bladeShape.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: .07, bevelEnabled: false });
  ownedGeometry.push(bladeGeometry);
  sword.add(new THREE.Mesh(bladeGeometry, materials.energy));
  block(sword, [.035, .75, .018], [0, -.6, .08], 'cyan');
  const shield = new THREE.Group(); shield.position.set(0, -.53, .36); leftArm.add(shield);
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-.43, .46); shieldShape.lineTo(.43, .46); shieldShape.lineTo(.43, -.2);
  shieldShape.lineTo(0, -.58); shieldShape.lineTo(-.43, -.2); shieldShape.closePath();
  const shieldGeometry = new THREE.ExtrudeGeometry(shieldShape, { depth: .12, bevelEnabled: false });
  ownedGeometry.push(shieldGeometry);
  const shieldBorder = new THREE.Mesh(shieldGeometry, materials.energy); shield.add(shieldBorder);
  const shieldPlate = new THREE.Mesh(shieldGeometry, materials.darkBlue); shieldPlate.scale.set(.88, .88, 1); shieldPlate.position.z = .045; shield.add(shieldPlate);
  const emblem = new THREE.Group(); emblem.position.z = .19; shield.add(emblem);
  function setEmblem(pose: Pose) {
    emblem.clear();
    const line = (w: number, h: number, x: number, y: number, angle = 0) => {
      const mesh = block(emblem, [w, h, .025], [x, y, 0], 'energy'); mesh.rotation.z = angle;
    };
    if (pose.shield === 'DOC') {
      line(.035, .47, -.17, .02); line(.035, .47, .17, .02); line(.36, .035, 0, .26); line(.36, .035, 0, -.22);
      for (let i = 0; i < 3; i++) line(.2, .03, 0, .12 - i * .1);
    } else if (pose.shield === 'CODE') {
      line(.23, .035, -.14, .11, .85); line(.23, .035, -.14, -.05, -.85);
      line(.23, .035, .14, .11, -.85); line(.23, .035, .14, -.05, .85);
    } else {
      line(.04, .43, -.11, .03, -.55); line(.04, .43, .11, .03, .55); line(.25, .035, 0, -.05);
    }
  }
  // Capa segmentada: permite balanceo sin textura ni simulación física costosa.
  const cape = new THREE.Group(); cape.position.set(0, 1.78, -.4); body.add(cape);
  const capeStrips = Array.from({ length: 7 }, (_, i) => {
    const strip = new THREE.Group(); strip.position.set((i - 3) * .16, 0, 0); cape.add(strip);
    block(strip, [.14, 1.25, .035], [0, -.57, -.13], 'cape');
    for (let j = 0; j < 6; j++) block(strip, [.03, .045, .02], [j % 2 ? .025 : -.025, -.14 - j * .18, -.1], (i + j) % 3 ? 'green' : 'energy');
    return strip;
  });
  const barrier = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.3), new THREE.MeshBasicMaterial({ color: '#00ffaa', transparent: true, opacity: .06, side: THREE.DoubleSide, depthWrite: false }));
  ownedGeometry.push(barrier.geometry); barrier.position.set(.5, 1.48, .87); root.add(barrier);
  const slash = new THREE.Mesh(new THREE.TorusGeometry(1.35, .035, 5, 48, Math.PI * 1.25), materials.energy);
  ownedGeometry.push(slash.geometry); slash.position.set(-.05, 1.5, .65); slash.rotation.z = -.7; root.add(slash);
  let activePose: Pose;
  function setPose(pose: Pose) {
    activePose = pose; setEyes(pose); setEmblem(pose);
    shield.visible = pose.shield !== 'NONE'; sword.visible = pose.action !== 'run';
    barrier.visible = pose.action === 'shield'; slash.visible = pose.action === 'slash';
    materials.energy.color.set(pose.id === 2 ? '#ffb0b0' : '#70ffd0');
    materials.energy.emissive.set(pose.id === 2 ? '#ff5265' : '#00ffaa');
  }
  function update(time: number, delta: number, motion: boolean, patrol: boolean) {
    if (!activePose) return;
    const id = activePose.id;
    const run = activePose.action === 'run' || (patrol && id === 1);
    const t = motion ? time : 0;
    const phase = t * (7.4 + (id - 5) * .5) + id * .45;
    const wave = motion ? Math.sin(phase) : 0;
    const ease = motion ? Math.min(delta * 9, 1) : 1;
    const blend = (a: number, b: number) => THREE.MathUtils.lerp(a, b, ease);
    root.position.x = blend(root.position.x, run && motion ? Math.sin(t * .75) * .42 : 0);
    root.rotation.y = blend(root.rotation.y, run && motion ? Math.cos(t * .75) * .25 : Math.sin(t * .5) * (motion ? .08 : 0));
    body.position.y = blend(body.position.y, run ? Math.abs(wave) * .07 : Math.sin(t * 1.9) * (motion ? .025 : 0));
    body.rotation.z = blend(body.rotation.z, run ? -.06 : id === 2 ? -.06 : 0);
    head.rotation.z = blend(head.rotation.z, id === 3 ? .1 : id === 4 ? -.1 : id === 2 ? -.12 : 0);
    head.rotation.y = blend(head.rotation.y, id === 5 && motion ? Math.sin(t) * .28 : 0);
    legs.forEach((leg, i) => { leg.rotation.x = blend(leg.rotation.x, run ? wave * .65 * (i === 0 ? 1 : -1) : 0); });
    const swordAngles: Record<number, number> = { 9: -.3, 10: -2.35, 11: motion ? -.9 + Math.sin(t * 4) * 1.25 : .7, 12: 1.2 };
    rightArm.rotation.z = blend(rightArm.rotation.z, swordAngles[id] ?? -.45);
    rightArm.rotation.x = blend(rightArm.rotation.x, run ? -wave * .55 : id === 4 || id === 16 ? -.4 : 0);
    leftArm.rotation.x = blend(leftArm.rotation.x, run ? wave * .55 : activePose.action === 'shield' ? -.65 : -.08);
    leftArm.rotation.z = blend(leftArm.rotation.z, id === 16 ? -.18 : .12);
    capeStrips.forEach((strip, i) => { strip.rotation.x = blend(strip.rotation.x, (run ? .7 : .17) + (motion ? Math.sin(t * 3 + i * .6) * .11 : 0)); });
    slash.rotation.z = motion ? -t * 2.5 : -.7;
    slash.scale.setScalar(motion ? 1 + Math.sin(t * 4) * .07 : 1);
    barrier.material.opacity = motion ? .055 + Math.sin(t * 3) * .02 : .06;
  }
  function dispose() {
    ownedGeometry.forEach(item => item.dispose());
    Object.values(materials).forEach(material => material.dispose());
    barrier.material.dispose();
  }
  return { root, setPose, update, dispose };
}
