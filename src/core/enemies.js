// =============================================================================
//  enemies.js  —  敵オブジェクトの生成・移動・ライフサイクル
// -----------------------------------------------------------------------------
//  敵は奥(spawnZ)で生成され +z 方向(手前)へ流れてくる。HP は wave で増加。
//  タイプ(normal/tank/rusher/weaver)で HP・速度・サイズ・突破ダメージ・横揺れが
//  変わる。描画契約: enemy は { id, x, y, z, hp, maxHp, kind, radius } を持つ。
// =============================================================================

import { CONFIG } from './config.js';
import { ObjectPool } from './pool.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createEnemySystem() {
  return new ObjectPool({
    size: CONFIG.enemies.poolSize,
    prefix: 'e',
    create: () => ({
      x: 0, y: 0, z: 0, hp: 1, maxHp: 1, speed: 0,
      kind: 'normal', radius: CONFIG.enemies.radius, breach: 1,
      weave: 0, baseX: 0, phase: 0, age: 0,
    }),
    reset: (e, a) => {
      e.x = a.x;
      e.y = 0;
      e.z = a.z;
      e.hp = a.hp;
      e.maxHp = a.hp;
      e.speed = a.speed;
      e.kind = a.kind ?? 'normal'; // 描画契約: enemy.kind
      e.radius = a.radius ?? CONFIG.enemies.radius; // タイプ別の当たり判定/サイズ
      e.breach = a.breach ?? CONFIG.enemies.breachDamageMin; // 突破時の固定ダメージ(残HP非依存)
      e.weave = a.weave ?? 0; // 横揺れ振幅(0=直進)
      e.baseX = a.baseX ?? a.x; // 横揺れの中心
      e.phase = a.phase ?? 0; // 横揺れの初期位相
      e.age = 0; // 出現からの経過秒
    },
  });
}

/** wave に応じたタイプ別出現重みから 1 タイプを抽選する。 */
export function rollEnemyType(wave) {
  const { types, spawnWeights } = CONFIG.enemies;
  const w = wave - 1;
  const keys = Object.keys(types);
  let total = 0;
  const weights = keys.map((k) => {
    const base = spawnWeights.base[k] ?? 0;
    const per = spawnWeights.perWave[k] ?? 0;
    const val = Math.max(0, base + per * w);
    total += val;
    return val;
  });
  if (total <= 0) return 'normal';
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= weights[i];
    if (r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
}

/** wave に応じた 1 スポーンあたりの同時出現数(密度)。 */
export function burstCount(wave) {
  const { burstBase, burstPerWave, burstMax } = CONFIG.enemies;
  return Math.min(burstMax, Math.floor(burstBase + (wave - 1) * burstPerWave));
}

/** wave に応じたタイプの敵を、指定 x(省略時ランダム)に1体生成する。 */
export function spawnEnemy(pool, wave, scrollSpeed, x) {
  const half = CONFIG.lane.halfWidth;
  const px = typeof x === 'number' ? x : (Math.random() * 2 - 1) * half;
  const kind = rollEnemyType(wave);
  const def = CONFIG.enemies.types[kind];
  const baseHp = CONFIG.enemies.baseHp + (wave - 1) * CONFIG.enemies.hpPerWave;
  return pool.acquire({
    x: clamp(px, -half, half),
    z: CONFIG.world.spawnZ,
    hp: Math.max(1, Math.ceil(baseHp * def.hpMul)),
    speed: scrollSpeed * def.speedMul,
    kind,
    radius: CONFIG.enemies.radius * def.radiusMul,
    breach: def.breach,
    weave: def.weave,
    baseX: clamp(px, -half, half),
    phase: Math.random() * Math.PI * 2,
  });
}

/** 敵を手前へ移動させ(weaver は横揺れ)、通り過ぎたものを回収する。 */
export function updateEnemies(pool, dt) {
  const despawnZ = CONFIG.world.despawnZ;
  const half = CONFIG.lane.halfWidth;
  const freq = CONFIG.enemies.weaveFreq;
  const items = pool.items;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.active) continue;
    e.age += dt;
    e.z += e.speed * dt;
    if (e.weave > 0) {
      e.x = clamp(e.baseX + Math.sin(e.age * freq + e.phase) * e.weave, -half, half);
    }
    if (e.z > despawnZ) pool.release(e);
  }
}
