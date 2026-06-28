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
    fireRate: CONFIG.player.baseFireRate, // 連射速度(volleys/s, 武器倍率込み)
    fireTimer: 0, // 発射クールダウン蓄積
    weapon: CONFIG.weapons.startWeapon, // 現在の銃(描画契約: player.weapon)
    moveDir: 0, // 横移動方向(-1/0/1)
    aimTargetId: null, // 互換用。現在は自動照準を使わないため常に null
  };
  recomputeStats(p);
  return p;
}

/** 銃を切り替える(未知 id は無視)。 */
export function setWeapon(p, weapon) {
  if (CONFIG.weapons.defs[weapon]) p.weapon = weapon;
  return p.weapon;
}

/** 次の銃へ巡回切り替えする(デバッグ/手動切替用)。 */
export function cycleWeapon(p) {
  const list = CONFIG.weapons.list;
  const i = list.indexOf(p.weapon);
  p.weapon = list[(i + 1) % list.length];
  return p.weapon;
}

/** value から派生ステータス(同時発射数・威力)を再計算する。 */
export function recomputeStats(p) {
  const v = clamp(Math.round(p.value), 0, CONFIG.player.maxValue);
  p.value = v;
  // value をストリーム数に割り当て、上限を超えた分は威力に回す。
  p.shotCount = clamp(v, 1, CONFIG.player.shotCap);
  p.bulletPower = Math.max(1, Math.ceil(v / CONFIG.player.shotCap));
}

/** 入力に追従して横移動し、連射速度を wave に合わせて更新する。 */
export function updatePlayer(p, input, dt, wave) {
  const half = CONFIG.lane.halfWidth;
  p.targetX = clamp(input.targetX, -half, half);
  // 追従の残差から「今どちらへ動こうとしているか」を求める
  const follow = p.targetX - p.x;
  p.moveDir = Math.abs(follow) > CONFIG.player.aimMoveThreshold ? Math.sign(follow) : 0;
  // フレームレート非依存の指数追従
  const k = Math.min(1, CONFIG.player.moveResponse * dt);
  p.x += follow * k;

  const baseRate = Math.min(
    CONFIG.player.maxFireRate,
    CONFIG.player.baseFireRate + (wave - 1) * CONFIG.player.fireRatePerWave
  );
  // 現在の銃の連射倍率を反映(マシンガンは速く、バズーカは遅く)。
  const w = CONFIG.weapons.defs[p.weapon] || CONFIG.weapons.defs[CONFIG.weapons.startWeapon];
  p.fireRate = baseRate * w.fireRateMul;
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
      p.value += Math.min(
        CONFIG.player.multiplyGainMax,
        Math.ceil(p.value * Math.max(0, value - 1) * CONFIG.player.multiplyGainRate)
      );
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
