// =============================================================================
//  collision.js  —  衝突判定ロジック
// -----------------------------------------------------------------------------
//  ・弾 × 敵   : 敵HPを威力分減算。撃破でスコア加算。
//  ・自機 × ゲート: 自機平面を通過したゲートの演算子を value に適用。
//  ・自機 × 敵   : 接触で残HP分だけ value を減算(撃ち漏らしペナルティ)。
//
//  ctx = { emit(event), addScore(n) } を介して上位(game.js)へ通知する。
//  弾×敵は O(弾×敵) だが、実 active 数は小さい。必要なら z 方向の
//  空間分割でブロードフェーズ最適化が可能(TODO)。
// =============================================================================

import { CONFIG } from './config.js';
import { applyOperator, damagePlayer } from './player.js';

/** 弾と敵の衝突を解決する。 */
export function resolveBulletEnemy(bulletPool, enemyPool, ctx) {
  const enemies = enemyPool.items;
  const bullets = bulletPool.items;
  const rBE = CONFIG.bullets.radius + CONFIG.enemies.radius;
  const rBE2 = rBE * rBE;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.active) continue;
    for (let j = 0; j < bullets.length; j++) {
      const b = bullets[j];
      if (!b.active) continue;
      const dx = e.x - b.x;
      const dz = e.z - b.z;
      if (dx * dx + dz * dz > rBE2) continue;

      e.hp -= b.power;
      bulletPool.release(b);
      ctx.emit({ type: 'hit', x: e.x, y: e.y, z: e.z });

      if (e.hp <= 0) {
        ctx.addScore(Math.max(CONFIG.scoring.killBase, e.maxHp));
        ctx.emit({ type: 'enemyKilled', x: e.x, y: e.y, z: e.z });
        enemyPool.release(e);
        break; // この敵は消滅したので次の敵へ
      }
    }
  }
}

/**
 * 自機平面を通過したゲートの演算を value へ適用する。
 * 左右ペアの両方が reach 内に入っても、最も近い1枚だけを「選択」して適用する。
 */
export function resolvePlayerGate(player, gatePool, ctx) {
  const gates = gatePool.items;
  const reach = CONFIG.gates.width / 2 + CONFIG.player.radius;
  let chosen = null;
  let chosenDist = Infinity;

  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    if (!g.active || g.applied) continue;
    if (g.z < player.z) continue; // まだ自機平面に到達していない
    g.applied = true; // 通過判定は1回だけ(選ばれなかった側は「見送り」)
    const d = Math.abs(g.x - player.x);
    if (d <= reach && d < chosenDist) {
      chosen = g;
      chosenDist = d;
    }
  }

  if (chosen) {
    const newValue = applyOperator(player, chosen.operator, chosen.value);
    ctx.emit({ type: 'gate', x: chosen.x, y: chosen.y, z: chosen.z, operator: chosen.operator, value: chosen.value, result: newValue });
  }
}

/**
 * 自機の防衛ライン(z = player.z)を突破した敵を処理する。
 * 「接触」も「横へ避けられて倒し漏らした通過」も、ライン到達(z >= player.z)で
 * まとめて検出する。突破された敵は残HP分だけ value を奪い、value<=0 で
 * ゲームオーバー(false を返す)。
 */
export function resolvePlayerEnemy(player, enemyPool, ctx) {
  const enemies = enemyPool.items;
  let alive = true;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.active) continue;
    if (e.z < player.z) continue; // まだライン手前

    const contact = Math.abs(e.x - player.x) <= CONFIG.player.radius + CONFIG.enemies.radius;
    const damage = Math.max(CONFIG.enemies.breachDamageMin, Math.ceil(e.hp));
    const survived = damagePlayer(player, damage);
    enemyPool.release(e);
    ctx.emit({ type: 'playerHit', x: e.x, y: e.y, z: player.z, damage, contact });
    if (!survived) {
      alive = false;
      break;
    }
  }
  return alive;
}
