// =============================================================================
//  bullets.js  —  弾オブジェクトの生成・移動・ライフサイクル
// -----------------------------------------------------------------------------
//  プレイヤーから画面奥へまっすぐ発射。弾道は敵へ向かわず、プレイヤーの
//  横位置をユーザーが合わせることで命中させる。
//  プールで再利用し、奥へ抜けたら回収する。
// =============================================================================

import { CONFIG } from './config.js';
import { ObjectPool } from './pool.js';

export function createBulletSystem() {
  return new ObjectPool({
    size: CONFIG.bullets.poolSize,
    prefix: 'b',
    create: () => ({
      x: 0, y: 0, z: 0, vx: 0, vz: 0, power: 1,
      kind: 'rifle', radius: CONFIG.bullets.radius, pierce: 0, splash: 0, hits: 0,
    }),
    reset: (b, a) => {
      b.x = a.x;
      b.y = a.y;
      b.z = a.z;
      b.vx = a.vx;
      b.vz = a.vz;
      b.power = a.power;
      b.kind = a.kind ?? 'rifle'; // 描画契約: bullet.kind(銃 id)
      b.radius = a.radius ?? CONFIG.bullets.radius; // 当たり判定(爆風弾は大きい)
      b.pierce = a.pierce ?? 0; // 残り貫通体数
      b.splash = a.splash ?? 0; // 着弾時の爆風半径
      b.hits = 0; // この弾が命中した体数(貫通カウント)
    },
  });
}

/**
 * 1 volley を発射する。プレイヤーの shotCount/bulletPower と現在の銃を反映。
 * 銃ごとに 発射数/威力/弾速/弾サイズ/貫通/爆風 が変わる。
 * 横方向の速度は持たせず、ユーザーが横移動で射線を合わせる。
 */
export function firePlayer(pool, player, enemyPool) {
  const w = CONFIG.weapons.defs[player.weapon] || CONFIG.weapons.defs[CONFIG.weapons.startWeapon];
  const n = Math.max(1, Math.round(player.shotCount * w.shotMul));
  const power = Math.max(1, Math.round(player.bulletPower * w.powerMul));
  const speed = CONFIG.bullets.speed * w.speedMul;
  const muzzle = CONFIG.player.muzzleSpread;
  const radius = CONFIG.bullets.radius * w.radiusMul;

  player.aimTargetId = null;

  for (let i = 0; i < n; i++) {
    // t: -0.5 .. 0.5 (中央 0)
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const b = pool.acquire({
      x: player.x + t * muzzle,
      y: player.y + 0.5,
      z: player.z - 0.6,
      vx: 0,
      vz: -speed,
      power,
      kind: player.weapon,
      radius,
      pierce: w.pierce,
      splash: w.splash,
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
