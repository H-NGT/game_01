// =============================================================================
//  enemies.js  —  敵オブジェクトの生成・移動・ライフサイクル
// -----------------------------------------------------------------------------
//  敵は奥(spawnZ)で生成され +z 方向(手前)へ流れてくる。HP は wave で増加。
//  描画契約: enemy は { id, x, y, z, hp, maxHp } を持つ。
// =============================================================================

import { CONFIG } from './config.js';
import { ObjectPool } from './pool.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createEnemySystem() {
  return new ObjectPool({
    size: CONFIG.enemies.poolSize,
    prefix: 'e',
    create: () => ({ x: 0, y: 0, z: 0, hp: 1, maxHp: 1, speed: 0 }),
    reset: (e, a) => {
      e.x = a.x;
      e.y = 0;
      e.z = a.z;
      e.hp = a.hp;
      e.maxHp = a.hp;
      e.speed = a.speed;
    },
  });
}

/** wave に応じた HP の敵を、指定 x(省略時ランダム)に1体生成する。 */
export function spawnEnemy(pool, wave, scrollSpeed, x) {
  const half = CONFIG.lane.halfWidth;
  const px = typeof x === 'number' ? x : (Math.random() * 2 - 1) * half;
  const hp = CONFIG.enemies.baseHp + (wave - 1) * CONFIG.enemies.hpPerWave;
  return pool.acquire({
    x: clamp(px, -half, half),
    z: CONFIG.world.spawnZ,
    hp,
    speed: scrollSpeed,
  });
}

/** 敵を手前へ移動させ、通り過ぎたものを回収する。 */
export function updateEnemies(pool, dt) {
  const despawnZ = CONFIG.world.despawnZ;
  const items = pool.items;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.active) continue;
    e.z += e.speed * dt;
    if (e.z > despawnZ) pool.release(e);
  }
}
