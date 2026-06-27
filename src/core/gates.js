// =============================================================================
//  gates.js  —  計算ゲート(門)の生成・移動・選択
// -----------------------------------------------------------------------------
//  ゲートは左右ペアで出現し、プレイヤーは横移動でどちらかを「通過」して
//  value を増減させる。奥(spawnZ)で生成され +z 方向へ流れる。
//  描画契約: gate は { id, x, y, z, operator, value } を持つ。
//   operator: 'add' | 'subtract' | 'multiply' | 'divide'
// =============================================================================

import { CONFIG } from './config.js';
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
      target: 'value',
      speed: 0,
      applied: false, // プレイヤー平面を通過済みか
    }),
    reset: (g, a) => {
      g.x = a.x;
      g.y = 0;
      g.z = a.z;
      g.operator = a.operator;
      g.value = a.value;
      g.target = 'value';
      g.speed = a.speed;
      g.applied = false;
    },
  });
}

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/**
 * wave に応じた左右ペアのゲート候補を生成する。
 * 片方を「強い加算/乗算」、もう片方を「弱い/デバフ」にして選択を意味のあるものにする。
 */
function rollGateOptions(wave) {
  const goodPool = [
    { operator: 'multiply', value: 2 },
    { operator: 'multiply', value: 3 },
    { operator: 'add', value: 5 + wave * 2 },
    { operator: 'add', value: 10 + wave * 3 },
  ];
  const badPool = [
    { operator: 'divide', value: 2 },
    { operator: 'subtract', value: 5 + wave },
    { operator: 'add', value: 2 },
    { operator: 'multiply', value: 1 },
  ];
  const good = pick(goodPool);
  // 60% は「良い vs 悪い」、40% は「良い vs 別の良い」で構成
  const other = Math.random() < 0.6 ? pick(badPool) : pick(goodPool);
  // 左右どちらに良い方を置くかランダム化
  return Math.random() < 0.5 ? [good, other] : [other, good];
}

/** 左右ペアのゲートを生成する。 */
export function spawnGatePair(pool, wave, scrollSpeed) {
  const [left, right] = rollGateOptions(wave);
  const off = CONFIG.gates.pairOffsetX;
  pool.acquire({ x: -off, z: CONFIG.world.spawnZ, operator: left.operator, value: left.value, speed: scrollSpeed });
  pool.acquire({ x: off, z: CONFIG.world.spawnZ, operator: right.operator, value: right.value, speed: scrollSpeed });
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
