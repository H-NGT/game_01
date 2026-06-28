// =============================================================================
//  gates.js  —  計算ゲート(門)の生成・移動・選択
// -----------------------------------------------------------------------------
//  ゲートは左右ペアで出現し、プレイヤーは横移動でどちらかを「通過」して
//  value を増減させる(または銃を切り替える)。奥(spawnZ)で生成され +z へ流れる。
//  描画契約: gate は { id, x, y, z, operator, value, weapon } を持つ。
//   operator: 'add' | 'subtract' | 'multiply' | 'divide' | 'weapon'
//   operator==='weapon' のとき weapon(銃 id) を適用し value は使わない。
// =============================================================================

import { CONFIG, getDifficultyConfig } from './config.js';
import { ObjectPool } from './pool.js';

export function createGateSystem() {
  return new ObjectPool({
    size: CONFIG.gates.poolSize,
    prefix: 'g',
    create: () => ({
      x: 0,
      y: 0,
      z: 0,
      operator: 'add',
      value: 1,
      weapon: null, // operator==='weapon' のとき切り替える銃 id
      target: 'value',
      speed: 0,
      applied: false, // プレイヤー平面を通過済みか
    }),
    reset: (g, a) => {
      g.x = a.x;
      g.y = 0;
      g.z = a.z;
      g.operator = a.operator;
      g.value = a.value ?? 0;
      g.weapon = a.weapon ?? null;
      g.target = 'value';
      g.speed = a.speed;
      g.applied = false;
    },
  });
}

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const scaled = (value, mul) => Math.max(1, Math.round(value * mul));

/** 左右に異なる銃を提示する武器選択ゲートのペアを返す。 */
function rollWeaponOptions() {
  const ws = CONFIG.weapons.list;
  const a = pick(ws);
  let b = pick(ws);
  while (b === a && ws.length > 1) b = pick(ws);
  return [
    { operator: 'weapon', weapon: a, value: 0 },
    { operator: 'weapon', weapon: b, value: 0 },
  ];
}

/**
 * wave に応じた左右ペアのゲート候補を生成する。
 * 一定確率で「武器選択ゲート(左右で別の銃)」になる。それ以外は
 * 片方を「強い加算/乗算」、もう片方を「弱い/デバフ」にして選択を意味のあるものにする。
 * bothBuff=true のときは両方を強化ゲートにする(序盤の確実な強化用)。
 */
function rollGateOptions(wave, bothBuff, difficulty = CONFIG.difficulties.defaultLevel) {
  const d = getDifficultyConfig(difficulty);
  // 武器選択ゲート(序盤の確実強化ペアでは出さない)
  if (!bothBuff && Math.random() < CONFIG.gates.weaponChance * d.weaponChanceMul) {
    return rollWeaponOptions();
  }

  const goodPool = [
    { operator: 'multiply', value: 2 },
    { operator: 'add', value: scaled(4 + wave * 1.5, d.gateGoodValueMul) },
    { operator: 'add', value: scaled(8 + wave * 2, d.gateGoodValueMul) },
  ];

  const badPool = [
    { operator: 'divide', value: 2 },
    { operator: 'subtract', value: scaled(4 + wave, d.gateBadValueMul) },
    { operator: 'subtract', value: scaled(8 + wave * 1.5, d.gateBadValueMul) },
  ];
  if (difficulty >= 4) badPool.push({ operator: 'divide', value: 3 });

  const neutralPool = [
    { operator: 'add', value: scaled(2 + wave * 0.5, d.gateGoodValueMul) },
    { operator: 'multiply', value: 1 },
  ];

  const good = pick(goodPool);
  if (bothBuff) {
    return [good, pick(goodPool)];
  }
  if (Math.random() < d.gateGoodPairChance) {
    return Math.random() < 0.5 ? [good, pick(goodPool)] : [pick(goodPool), good];
  }
  const other = Math.random() < d.gatePenaltyChance ? pick(badPool) : pick(neutralPool);
  // 左右どちらに良い方を置くかランダム化
  return Math.random() < 0.5 ? [good, other] : [other, good];
}

/**
 * 左右ペアのゲートを生成する。
 * @param {object} [opts]
 * @param {number} [opts.z]        出現 z(省略時は world.spawnZ)
 * @param {boolean} [opts.bothBuff] 両方を強化ゲートにする
 * @param {number} [opts.difficulty] 難易度(1-5)
 */
export function spawnGatePair(pool, wave, scrollSpeed, opts = {}) {
  const difficulty = opts.difficulty ?? CONFIG.difficulties.defaultLevel;
  const [left, right] = rollGateOptions(wave, opts.bothBuff, difficulty);
  const off = CONFIG.gates.pairOffsetX;
  const z = typeof opts.z === 'number' ? opts.z : CONFIG.world.spawnZ;
  pool.acquire({ x: -off, z, operator: left.operator, value: left.value, weapon: left.weapon, speed: scrollSpeed });
  pool.acquire({ x: off, z, operator: right.operator, value: right.value, weapon: right.weapon, speed: scrollSpeed });
}

/** ゲートを手前へ移動させ、通り過ぎたものを回収する。 */
export function updateGates(pool, dt) {
  const despawnZ = CONFIG.world.despawnZ;
  const items = pool.items;
  for (let i = 0; i < items.length; i++) {
    const g = items[i];
    if (!g.active) continue;
    g.z += g.speed * dt;
    if (g.z > despawnZ) pool.release(g);
  }
}
