// =============================================================================
//  bullets.js  —  弾オブジェクトの生成・移動・ライフサイクル
// -----------------------------------------------------------------------------
//  プレイヤーから -z 方向へ発射。多重発射(shotCount)時は射角と発射口を
//  左右に広げる。プールで再利用し、奥へ抜けたら回収する。
// =============================================================================

import { CONFIG } from './config.js';
import { ObjectPool } from './pool.js';

export function createBulletSystem() {
  return new ObjectPool({
    size: CONFIG.bullets.poolSize,
    prefix: 'b',
    create: () => ({ x: 0, y: 0, z: 0, vx: 0, vz: 0, power: 1 }),
    reset: (b, a) => {
      b.x = a.x;
      b.y = a.y;
      b.z = a.z;
      b.vx = a.vx;
      b.vz = a.vz;
      b.power = a.power;
    },
  });
}

/** 1 volley を発射する。プレイヤーの shotCount/bulletPower を反映。 */
export function firePlayer(pool, player) {
  const n = player.shotCount;
  const speed = CONFIG.bullets.speed;
  const spread = CONFIG.player.spreadAngle;
  const muzzle = CONFIG.player.muzzleSpread;
  for (let i = 0; i < n; i++) {
    // t: -0.5 .. 0.5 (中央 0)
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const ang = t * spread;
    const b = pool.acquire({
      x: player.x + t * muzzle,
      y: player.y + 0.5,
      z: player.z - 0.6,
      vx: Math.sin(ang) * speed,
      vz: -Math.cos(ang) * speed,
      power: player.bulletPower,
    });
    if (!b) break; // プール枯渇時は打ち切り
  }
}

/** 弾を移動させ、画面奥へ抜けたものを回収する。 */
export function updateBullets(pool, dt) {
  const despawnZ = CONFIG.bullets.despawnZ;
  const items = pool.items;
  for (let i = 0; i < items.length; i++) {
    const b = items[i];
    if (!b.active) continue;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    if (b.z < despawnZ) pool.release(b);
  }
}
