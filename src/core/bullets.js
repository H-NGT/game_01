// =============================================================================
//  bullets.js  —  弾オブジェクトの生成・移動・ライフサイクル
// -----------------------------------------------------------------------------
//  プレイヤーから前方へ発射。弾道は自動で敵へ向かず、プレイヤーの横位置と
//  武器ごとの固定拡散で決まる。
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
 * オートエイム: 前方の敵から狙う1体を選ぶ。
 *  - プレイヤーの移動方向(moveDir)側にいる敵を優先(なければ全体の最近接)。
 *  - 旋回角が aimMaxAngle を超える真横〜後方の敵は狙わない。
 * 狙う敵がいなければ null(=正面へ撃つ)。
 */
export function pickAimTarget(player, enemyPool) {
  if (!enemyPool) return null;
  const enemies = enemyPool.items;
  const dir = player.moveDir;
  const maxAng = CONFIG.player.aimMaxAngle;
  let best = null;
  let bestD2 = Infinity;
  let bestDir = null;
  let bestDirD2 = Infinity;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.active) continue;
    const dz = player.z - e.z; // 前方距離(>0 が自機より奥=前方)
    if (dz <= 0) continue; // 自機平面より手前/背後は狙わない
    const dx = e.x - player.x;
    if (Math.abs(Math.atan2(dx, dz)) > maxAng) continue; // 旋回し過ぎる敵は除外
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) { bestD2 = d2; best = e; }
    if (dir !== 0 && Math.sign(dx) === dir && d2 < bestDirD2) { bestDirD2 = d2; bestDir = e; }
  }
  return bestDir || best;
}

/**
 * 1 volley を発射する。プレイヤーの shotCount/bulletPower と現在の銃を反映。
 * 銃ごとに 発射数/威力/拡散/弾速/弾サイズ/貫通/爆風 が変わる。
 * 敵への自動旋回は行わず、ユーザーが横移動で射線を合わせる。
 */
export function firePlayer(pool, player, enemyPool) {
  const w = CONFIG.weapons.defs[player.weapon] || CONFIG.weapons.defs[CONFIG.weapons.startWeapon];
  const n = Math.max(1, Math.round(player.shotCount * w.shotMul));
  const power = Math.max(1, Math.round(player.bulletPower * w.powerMul));
  const speed = CONFIG.bullets.speed * w.speedMul;
  const spread = CONFIG.player.spreadAngle * w.spreadMul;
  const muzzle = CONFIG.player.muzzleSpread;
  const radius = CONFIG.bullets.radius * w.radiusMul;

  player.aimTargetId = null;

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
