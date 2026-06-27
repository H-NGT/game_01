// =============================================================================
//  player.js  —  プレイヤーのステート管理
// -----------------------------------------------------------------------------
//  プレイヤーは「主数値 value」を持つ。ゲート通過で value が増減し、
//  そこから 同時発射数(shotCount) / 1発の威力(bulletPower) を導出する。
//  連射速度(fireRate) は wave に応じて上昇する。
//  value <= 0 でゲームオーバー。
// =============================================================================

import { CONFIG } from './config.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createPlayer() {
  const p = {
    id: 'player',
    x: 0,
    y: CONFIG.player.yPos,
    z: CONFIG.player.zPos,
    targetX: 0,
    value: CONFIG.player.startValue, // 主数値(Codex 描画契約: player.value)
    shotCount: 1, // 同時発射数(value から導出)
    bulletPower: 1, // 1発の威力(value から導出)
    fireRate: CONFIG.player.baseFireRate, // 連射速度(volleys/s)
    fireTimer: 0, // 発射クールダウン蓄積
  };
  recomputeStats(p);
  return p;
}

/** value から派生ステータス(同時発射数・威力)を再計算する。 */
export function recomputeStats(p) {
  const v = Math.max(0, Math.round(p.value));
  p.value = v;
  // value をストリーム数に割り当て、上限を超えた分は威力に回す。
  p.shotCount = clamp(v, 1, CONFIG.player.shotCap);
  p.bulletPower = Math.max(1, Math.ceil(v / CONFIG.player.shotCap));
}

/** 入力に追従して横移動し、連射速度を wave に合わせて更新する。 */
export function updatePlayer(p, input, dt, wave) {
  const half = CONFIG.lane.halfWidth;
  p.targetX = clamp(input.targetX, -half, half);
  // フレームレート非依存の指数追従
  const k = Math.min(1, CONFIG.player.moveResponse * dt);
  p.x += (p.targetX - p.x) * k;

  p.fireRate = Math.min(
    CONFIG.player.maxFireRate,
    CONFIG.player.baseFireRate + (wave - 1) * CONFIG.player.fireRatePerWave
  );
}

/** ゲートの演算子をプレイヤーの value へ適用する。 */
export function applyOperator(p, operator, value) {
  switch (operator) {
    case 'add':
      p.value += value;
      break;
    case 'subtract':
      p.value -= value;
      break;
    case 'multiply':
      p.value *= value;
      break;
    case 'divide':
      if (value !== 0) p.value /= value;
      break;
    default:
      break;
  }
  recomputeStats(p);
  return p.value;
}

/** 敵接触などで value を減算する。0 以下になったら false を返す(=ゲームオーバー)。 */
export function damagePlayer(p, amount) {
  p.value = Math.max(0, p.value - amount);
  recomputeStats(p);
  return p.value > 0;
}
