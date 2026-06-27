import * as THREE from 'three';

const PLAYER_COLOR = 0x5ef3a6;
const BULLET_COLOR = 0x7fe7ff;
const ENEMY_COLOR = 0xff5d8f;
const GATE_ADD_COLOR = 0x4cc9ff;
const GATE_MULTIPLY_COLOR = 0x70f6a3;
const GATE_PENALTY_COLOR = 0xff6f6f;
const GATE_WEAPON_COLOR = 0xffd166;
const TRACK_WIDTH = 8;
const TRACK_LENGTH = 72;

const tmpVector = new THREE.Vector3();

export class VisualController {
  constructor({ mount, hud }) {
    this.mount = mount;
    this.hud = hud;
    this.clock = new THREE.Clock();
    this.meshes = {
      bullets: new Map(),
      enemies: new Map(),
      gates: new Map()
    };
    this.effects = [];
    this.stateFingerprint = {
      bullets: new Set(),
      enemies: new Set(),
      gates: new Set()
    };
    this.previewState = createPreviewState();
    this.previewStatusOverride = null;
    this.previewScoreOverride = null;
    this.lastStatus = 'ready';
    this.animationFrame = 0;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x071019, 0.035);

    this.camera = new THREE.PerspectiveCamera(54, 1, 0.1, 180);
    this.camera.position.set(0, 8.4, 12.2);
    this.camera.lookAt(0, 0, -14);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x071019, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.mount.appendChild(this.renderer.domElement);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.setupLights();
    this.setupStage();
    this.setupPlayer();
    this.setupResizeHandling();
  }

  start() {
    this.resize();
    this.animate();
  }

  requestPreviewStart() {
    this.previewStatusOverride = null;
    this.previewScoreOverride = null;
    if (window.gameState) return;
    this.previewState.status = 'playing';
  }

  requestPreviewRestart() {
    this.previewStatusOverride = null;
    this.previewScoreOverride = null;
    if (window.gameState) return;
    this.previewState.status = 'playing';
    this.previewState.score = 0;
  }

  requestPreviewStatus(status) {
    this.previewStatusOverride = status;
    this.previewScoreOverride = status === 'gameover' || status === 'clear' ? 1280 : null;
    if (window.gameState) return;
    this.previewState.status = status;
    if (status === 'gameover' || status === 'clear') this.previewState.score = Math.max(this.previewState.score, 1280);
  }

  stop() {
    cancelAnimationFrame(this.animationFrame);
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xb8f4ff, 0x0a1824, 1.35);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(-5, 10, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 42;
    key.shadow.camera.left = -18;
    key.shadow.camera.right = 18;
    key.shadow.camera.top = 18;
    key.shadow.camera.bottom = -18;
    this.scene.add(key);

    const rim = new THREE.PointLight(0x56d8ff, 22, 28);
    rim.position.set(0, 3, -10);
    this.scene.add(rim);
  }

  setupStage() {
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x102132,
      roughness: 0.64,
      metalness: 0.18
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(TRACK_WIDTH, 0.16, TRACK_LENGTH), floorMaterial);
    floor.position.set(0, -0.08, -TRACK_LENGTH / 2 + 6);
    floor.receiveShadow = true;
    this.root.add(floor);

    const laneMaterial = new THREE.MeshBasicMaterial({
      color: 0x77e8ff,
      transparent: true,
      opacity: 0.25
    });
    [-2.65, 0, 2.65].forEach((x) => {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, TRACK_LENGTH), laneMaterial);
      lane.position.set(x, 0.02, -TRACK_LENGTH / 2 + 6);
      this.root.add(lane);
    });

    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e4153,
      emissive: 0x113747,
      emissiveIntensity: 0.55,
      roughness: 0.38
    });
    [-TRACK_WIDTH / 2 - 0.34, TRACK_WIDTH / 2 + 0.34].forEach((x) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, TRACK_LENGTH), railMaterial);
      rail.position.set(x, 0.33, -TRACK_LENGTH / 2 + 6);
      rail.castShadow = true;
      rail.receiveShadow = true;
      this.root.add(rail);
    });

    const grid = new THREE.GridHelper(120, 60, 0x1d7188, 0x123142);
    grid.position.y = 0.025;
    grid.position.z = -24;
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    this.root.add(grid);
  }

  setupPlayer() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.46, 0.84, 8, 18),
      new THREE.MeshStandardMaterial({
        color: PLAYER_COLOR,
        emissive: 0x1c8f5a,
        emissiveIntensity: 0.38,
        roughness: 0.28,
        metalness: 0.12
      })
    );
    body.position.y = 0.86;
    body.castShadow = true;
    group.add(body);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.72, 0.22, 24),
      new THREE.MeshStandardMaterial({
        color: 0xdfffee,
        emissive: 0x44d990,
        emissiveIntensity: 0.25,
        roughness: 0.32
      })
    );
    base.position.y = 0.16;
    base.castShadow = true;
    group.add(base);

    this.playerLabel = makeTextSprite('1', {
      color: '#071019',
      background: 'rgba(112, 246, 163, 0.94)',
      fontSize: 78
    });
    this.playerLabel.position.set(0, 1.65, 0);
    group.add(this.playerLabel);

    this.player = group;
    this.root.add(group);
  }

  setupResizeHandling() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.mount);
    window.addEventListener('orientationchange', () => this.resize(), { passive: true });
  }

  resize() {
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.fov = width < 700 ? 63 : 54;
    this.camera.position.set(0, width < 700 ? 9.8 : 8.4, width < 700 ? 13.8 : 12.2);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  animate = () => {
    this.animationFrame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    const state = this.getState(dt);

    this.syncPlayer(state, elapsed);
    this.syncCollection('bullets', state.bullets, (item) => this.createBullet(item), dt, elapsed);
    this.syncCollection('enemies', state.enemies, (item) => this.createEnemy(item), dt, elapsed);
    this.syncCollection('gates', state.gates, (item) => this.createGate(item), dt, elapsed);
    this.syncEffects(dt);
    this.updateHud(state);
    this.updateCamera(state, dt);

    this.renderer.render(this.scene, this.camera);
  };

  getState(dt) {
    if (window.gameState) {
      const state = normalizeState(window.gameState);
      if (this.previewStatusOverride) {
        state.status = this.previewStatusOverride;
        state.score = Math.max(state.score, this.previewScoreOverride ?? state.score);
      }
      return state;
    }
    updatePreviewState(this.previewState, dt);
    return normalizeState(this.previewState);
  }

  syncPlayer(state, elapsed) {
    const player = state.player;
    this.player.position.lerp(toVector(player, 0, 0, 3.2), 0.24);
    this.player.rotation.z = THREE.MathUtils.lerp(this.player.rotation.z, -player.x * 0.04, 0.16);
    this.player.position.y = Math.sin(elapsed * 7) * 0.035;

    const label = String(player.value ?? state.power ?? 1);
    if (this.playerLabel.userData.text !== label) {
      refreshTextSprite(this.playerLabel, label, {
        color: '#071019',
        background: 'rgba(112, 246, 163, 0.94)',
        fontSize: 78
      });
    }
  }

  syncCollection(type, items, createMesh, dt, elapsed) {
    const nextIds = new Set();
    const currentMeshes = this.meshes[type];
    const previousIds = this.stateFingerprint[type];

    items.forEach((item, index) => {
      const id = getItemId(item, index);
      nextIds.add(id);
      let mesh = currentMeshes.get(id);
      if (!mesh) {
        mesh = createMesh(item);
        currentMeshes.set(id, mesh);
        this.root.add(mesh);
        this.spawnPop(mesh.position, type === 'gates' ? 0x56d8ff : getEffectColor(type), 0.35);
      }
      this.updateMesh(type, mesh, item, dt, elapsed);
    });

    previousIds.forEach((id) => {
      if (!nextIds.has(id)) {
        const mesh = currentMeshes.get(id);
        if (mesh) {
          this.spawnBurst(mesh.position, getEffectColor(type));
          disposeObject(mesh);
          this.root.remove(mesh);
          currentMeshes.delete(id);
        }
      }
    });

    this.stateFingerprint[type] = nextIds;
  }

  updateMesh(type, mesh, item, dt, elapsed) {
    mesh.userData.target.copy(toVector(item, 0, 0.35, -12));
    mesh.position.lerp(mesh.userData.target, Math.min(1, 12 * dt));

    if (type === 'bullets') {
      mesh.rotation.x += dt * 18;
      mesh.rotation.y += dt * 7;
    }

    if (type === 'enemies') {
      const hp = item.hp ?? item.health ?? item.value ?? 1;
      const maxHp = item.maxHp ?? item.maxHealth ?? Math.max(hp, 1);
      const pressure = THREE.MathUtils.clamp(hp / maxHp, 0.22, 1);
      mesh.scale.lerp(tmpVector.set(pressure, pressure, pressure), 0.18);
      mesh.rotation.y += dt * 1.4;
      mesh.userData.label.position.y = 1.18 + Math.sin(elapsed * 4 + mesh.id) * 0.06;
      const label = String(Math.ceil(hp));
      if (mesh.userData.label.userData.text !== label) {
        refreshTextSprite(mesh.userData.label, label, {
          color: '#ffffff',
          background: 'rgba(255, 93, 143, 0.86)',
          fontSize: 70
        });
      }
    }

    if (type === 'gates') {
      applyGateTheme(mesh, item);
      mesh.rotation.y = Math.sin(elapsed * 1.8 + mesh.id) * 0.1;
      mesh.scale.setScalar(1 + Math.sin(elapsed * 4.8 + mesh.id) * 0.025);
      mesh.userData.ring.material.emissiveIntensity = 1.05 + Math.sin(elapsed * 5 + mesh.id) * 0.28;
      mesh.userData.aura.material.opacity = 0.2 + Math.sin(elapsed * 4 + mesh.id) * 0.055;
      const label = gateLabel(item);
      if (mesh.userData.label.userData.text !== label) {
        refreshTextSprite(mesh.userData.label, label, textStyleForGate(item));
      }
    }
  }

  createBullet(item) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 18, 18),
      new THREE.MeshStandardMaterial({
        color: BULLET_COLOR,
        emissive: 0x2eb6df,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.05
      })
    );
    core.castShadow = true;
    group.add(core);

    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.72, 18),
      new THREE.MeshBasicMaterial({
        color: 0x56d8ff,
        transparent: true,
        opacity: 0.34
      })
    );
    trail.rotation.x = Math.PI / 2;
    trail.position.z = 0.32;
    group.add(trail);

    group.userData.target = new THREE.Vector3();
    group.position.copy(toVector(item, 0, 0.58, 0));
    return group;
  }

  createEnemy(item) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.86, 1),
      new THREE.MeshStandardMaterial({
        color: ENEMY_COLOR,
        emissive: 0x8f1647,
        emissiveIntensity: 0.45,
        roughness: 0.34,
        metalness: 0.18
      })
    );
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.91, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.17
      })
    );
    group.add(wire);

    const hp = item.hp ?? item.health ?? item.value ?? 1;
    const label = makeTextSprite(String(Math.ceil(hp)), {
      color: '#ffffff',
      background: 'rgba(255, 93, 143, 0.86)',
      fontSize: 70
    });
    label.position.set(0, 1.18, 0);
    group.add(label);
    group.userData.label = label;
    group.userData.target = new THREE.Vector3();
    group.position.copy(toVector(item, 0, 0.92, -14));
    return group;
  }

  createGate(item) {
    const group = new THREE.Group();
    const theme = gateTheme(item);
    const material = new THREE.MeshStandardMaterial({
      color: theme.color,
      emissive: theme.color,
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0.92,
      roughness: 0.14,
      metalness: 0.2
    });

    const aura = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 2.65),
      new THREE.MeshBasicMaterial({
        color: theme.color,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    aura.position.set(0, 1.18, -0.06);
    group.add(aura);

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.52, 0.24), material);
    const right = left.clone();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.24, 0.24), material);
    left.position.set(-1.22, 1.25, 0);
    right.position.set(1.22, 1.25, 0);
    top.position.set(0, 2.42, 0);
    [left, right, top].forEach((part) => {
      part.castShadow = true;
      group.add(part);
    });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.055, 10, 84),
      new THREE.MeshStandardMaterial({
        color: theme.color,
        emissive: theme.color,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.95
      })
    );
    ring.position.y = 1.24;
    group.add(ring);

    const label = makeTextSprite(gateLabel(item), textStyleForGate(item));
    label.position.set(0, 1.28, 0.08);
    group.add(label);

    group.userData.aura = aura;
    group.userData.frameMaterial = material;
    group.userData.ring = ring;
    group.userData.label = label;
    group.userData.themeKey = theme.key;
    group.userData.target = new THREE.Vector3();
    group.position.copy(toVector(item, 0, 0, -20));
    return group;
  }

  spawnPop(position, color, size) {
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(size, 16, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.42
      })
    );
    pulse.position.copy(position);
    this.root.add(pulse);
    this.effects.push({ mesh: pulse, age: 0, life: 0.32, kind: 'pulse' });
  }

  spawnBurst(position, color) {
    this.spawnPop(position, color, 0.5);
    for (let i = 0; i < 12; i += 1) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 8),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.86
        })
      );
      particle.position.copy(position);
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 4.2,
        Math.random() * 2.8 + 0.4,
        (Math.random() - 0.5) * 4.2
      );
      this.root.add(particle);
      this.effects.push({ mesh: particle, age: 0, life: 0.58, kind: 'particle' });
    }
  }

  syncEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      effect.age += dt;
      const progress = effect.age / effect.life;
      if (progress >= 1) {
        disposeObject(effect.mesh);
        this.root.remove(effect.mesh);
        this.effects.splice(i, 1);
        continue;
      }

      effect.mesh.material.opacity = (1 - progress) * 0.78;
      if (effect.kind === 'pulse') {
        const scale = 1 + progress * 2.8;
        effect.mesh.scale.setScalar(scale);
      } else {
        effect.mesh.position.addScaledVector(effect.mesh.userData.velocity, dt);
        effect.mesh.userData.velocity.y -= 5.2 * dt;
      }
    }
  }

  updateHud(state) {
    const status = state.status;
    const score = state.score ?? 0;
    const wave = state.wave ?? state.level ?? 1;
    const power = state.player.value ?? state.power ?? 1;

    this.hud.power.textContent = String(power);
    this.hud.score.textContent = String(score);
    this.hud.wave.textContent = String(wave);
    this.hud.finalScore.textContent = `Score ${score}`;
    if (this.hud.clearScore) this.hud.clearScore.textContent = `Score ${score}`;

    if (status !== this.lastStatus) {
      this.lastStatus = status;
      const isClear = status === 'clear' || status === 'cleared' || status === 'win' || status === 'victory';
      const isPaused = status === 'paused' || status === 'pause';
      this.hud.startOverlay.classList.toggle('overlay--active', status === 'ready' || status === 'start');
      this.hud.gameOverOverlay.classList.toggle('overlay--active', status === 'gameover' || status === 'over');
      if (this.hud.clearOverlay) this.hud.clearOverlay.classList.toggle('overlay--active', isClear);
      if (this.hud.pauseOverlay) this.hud.pauseOverlay.classList.toggle('overlay--active', isPaused);
      if (this.hud.pauseButton) {
        this.hud.pauseButton.classList.toggle('pause-button--visible', status === 'playing');
        this.hud.pauseButton.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
      }
    }
  }

  updateCamera(state, dt) {
    const playerX = state.player.x ?? 0;
    const targetX = THREE.MathUtils.clamp(playerX * 0.22, -0.85, 0.85);
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetX, dt * 2.5);
    this.camera.lookAt(playerX * 0.12, 0.5, -14);
  }
}

function normalizeState(state) {
  return {
    status: state.status ?? state.phase ?? 'playing',
    score: state.score ?? 0,
    wave: state.wave ?? state.level ?? 1,
    power: state.power ?? state.count ?? state.player?.value ?? 1,
    player: {
      x: state.player?.x ?? state.player?.position?.x ?? state.playerX ?? 0,
      y: state.player?.y ?? state.player?.position?.y ?? 0,
      z: state.player?.z ?? state.player?.position?.z ?? 3.2,
      value: state.player?.value ?? state.power ?? state.count ?? 1
    },
    bullets: collectionFrom(state.bullets ?? state.bulletPool?.items),
    enemies: collectionFrom(state.enemies ?? state.enemyPool?.items),
    gates: collectionFrom(state.gates ?? state.gatePool?.items)
  };
}

function collectionFrom(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && item.active !== false);
}

function createPreviewState() {
  return {
    status: 'ready',
    score: 0,
    wave: 1,
    player: { x: 0, y: 0, z: 3.2, value: 12 },
    bullets: [],
    enemies: [
      { id: 'preview-enemy-1', x: -1.7, y: 0, z: -12, hp: 18, maxHp: 18 },
      { id: 'preview-enemy-2', x: 1.9, y: 0, z: -18, hp: 34, maxHp: 34 }
    ],
    gates: [
      { id: 'preview-gate-1', x: -1.8, y: 0, z: -6, operator: 'add', value: 5 },
      { id: 'preview-gate-2', x: 1.8, y: 0, z: -6, operator: 'multiply', value: 2 }
    ]
  };
}

function updatePreviewState(state, dt) {
  const time = performance.now() * 0.001;
  state.player.x = Math.sin(time * 0.82) * 1.6;
  state.bullets = Array.from({ length: 8 }, (_, index) => ({
    id: `preview-bullet-${index}`,
    x: Math.sin(time * 1.8 + index) * 0.9 + (index % 2 ? 0.22 : -0.22),
    y: 0,
    z: 2.4 - ((time * 9 + index * 1.5) % 18)
  }));
  state.score += Math.round(dt * 8);
}

function toVector(item, fallbackX, fallbackY, fallbackZ) {
  const position = item.position ?? item;
  return new THREE.Vector3(
    position.x ?? fallbackX,
    position.y ?? fallbackY,
    position.z ?? fallbackZ
  );
}

function getItemId(item, index) {
  return String(item.id ?? item.uid ?? item.key ?? index);
}

function getOperator(item) {
  const operator = item.operator ?? item.op ?? item.type ?? 'add';
  if (operator === 'weapon') return 'weapon';
  if (operator === 'x' || operator === '*' || operator === 'mul' || operator === 'multiply') {
    return 'multiply';
  }
  if (operator === '-' || operator === 'sub' || operator === 'subtract') return 'subtract';
  if (operator === '/' || operator === 'div' || operator === 'divide') return 'divide';
  return 'add';
}

function gateLabel(item) {
  const value = item.value ?? item.amount ?? 1;
  const operator = getOperator(item);
  if (operator === 'weapon') return weaponLabel(item.weapon);
  if (operator === 'multiply') return `×${value}`;
  if (operator === 'subtract') return `−${value}`;
  if (operator === 'divide') return `÷${value}`;
  return `+${value}`;
}

function gateTheme(item) {
  const operator = getOperator(item);
  if (operator === 'weapon') {
    return { key: 'weapon', color: GATE_WEAPON_COLOR };
  }
  if (operator === 'multiply') {
    return { key: 'multiply', color: GATE_MULTIPLY_COLOR };
  }
  if (operator === 'subtract' || operator === 'divide') {
    return { key: 'penalty', color: GATE_PENALTY_COLOR };
  }
  return { key: 'add', color: GATE_ADD_COLOR };
}

function applyGateTheme(mesh, item) {
  const theme = gateTheme(item);
  if (mesh.userData.themeKey === theme.key) return;
  mesh.userData.themeKey = theme.key;
  [mesh.userData.frameMaterial, mesh.userData.ring.material, mesh.userData.aura.material].forEach((material) => {
    material.color.setHex(theme.color);
    if (material.emissive) material.emissive.setHex(theme.color);
    material.needsUpdate = true;
  });
}

function textStyleForGate(item) {
  const operator = getOperator(item);
  const isWeapon = operator === 'weapon';
  const isMultiply = operator === 'multiply';
  const isPenalty = operator === 'subtract' || operator === 'divide';
  return {
    color: isPenalty ? '#ffffff' : '#071019',
    background: isWeapon
      ? 'rgba(255, 209, 102, 0.96)'
      : isPenalty
      ? 'rgba(255, 111, 111, 0.9)'
      : isMultiply
        ? 'rgba(112, 246, 163, 0.96)'
        : 'rgba(76, 201, 255, 0.96)',
    fontSize: 92,
    scaleX: 1.72,
    scaleY: 0.78
  };
}

function weaponLabel(weapon) {
  const labels = {
    rifle: 'RIFLE',
    machinegun: 'MG',
    bazooka: 'BZK',
    rocket: 'RKT'
  };
  return labels[weapon] ?? 'GUN';
}

function getEffectColor(type) {
  if (type === 'enemies') return ENEMY_COLOR;
  if (type === 'gates') return GATE_ADD_COLOR;
  return BULLET_COLOR;
}

function makeTextSprite(text, options) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
  sprite.scale.set(options.scaleX ?? 1.35, options.scaleY ?? 0.62, 1);
  refreshTextSprite(sprite, text, options);
  return sprite;
}

function refreshTextSprite(sprite, text, options) {
  const canvas = document.createElement('canvas');
  const width = 320;
  const height = 160;
  const radius = 28;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, width, height);
  context.fillStyle = options.background;
  roundRect(context, 18, 28, width - 36, height - 56, radius);
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  context.lineWidth = 5;
  context.stroke();

  context.fillStyle = options.color;
  context.font = `900 ${options.fontSize}px Inter, Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (sprite.material.map) sprite.material.map.dispose();
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  sprite.userData.text = text;
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material.map) material.map.dispose();
        material.dispose();
      });
    }
  });
}
