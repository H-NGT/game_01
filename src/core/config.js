// =============================================================================
//  config.js  —  ゲーム全体のチューニング定数
// -----------------------------------------------------------------------------
//  数値バランス・プール容量・座標系の基準をここに集約する。
//  座標系: x=横(レーン) / y=高さ / z=奥行き。
//   - プレイヤーは z = player.zPos に固定（トレッドミル方式）。
//   - 敵・ゲートは z = world.spawnZ(奥) で生成され +z 方向（手前）へ流れてくる。
//   - 弾はプレイヤーから -z 方向（奥）へ進み、敵と衝突する。
// =============================================================================

export const CONFIG = {
  lane: {
    halfWidth: 3.5, // プレイヤーが移動できる横方向の限界 (±)
  },

  world: {
    spawnZ: -52, // 敵・ゲートの出現位置(奥)。近めにして出現を明確に・密度を確保
    despawnZ: 9, // プレイヤーを通り過ぎて消滅する位置(手前)
    baseScrollSpeed: 16, // 敵・ゲートが手前へ流れる基本速度 (units/s)
    scrollSpeedPerWave: 0.8, // wave ごとの加速量
    maxScrollSpeed: 34,
    waveDurationSec: 12, // この秒数ごとに wave が +1
  },

  player: {
    zPos: 4, // 固定 z 位置
    yPos: 0,
    radius: 1.0, // 衝突半径
    startValue: 1, // 初期の主数値(value)
    moveResponse: 12, // 横移動の追従の速さ(大きいほど機敏)
    shotCap: 16, // 弾ストリームの最大同時数(同時発射数の上限)
    muzzleSpread: 1.6, // 多重発射時の発射口の横広がり
    spreadAngle: 0.16, // 多重発射時の射角の広がり(rad, 全幅)
    baseFireRate: 5, // 連射速度の基本値 (volleys/s)
    fireRatePerWave: 0.25, // wave ごとの連射速度上昇
    maxFireRate: 14,
  },

  bullets: {
    poolSize: 512,
    radius: 0.3,
    speed: 70, // 弾速 (units/s)
    despawnZ: -90, // これより奥へ進んだら回収
  },

  enemies: {
    poolSize: 256,
    radius: 1.2,
    baseHp: 3, // wave1 の基本HP
    hpPerWave: 2, // wave ごとのHP増加
    baseSpawnIntervalSec: 0.8, // 出現間隔(基本)
    minSpawnIntervalSec: 0.25,
    spawnIntervalPerWave: 0.04, // wave ごとに間隔短縮
    firstSpawnDelaySec: 1.2, // 開始直後の短い猶予(スタート強化ゲートを取る時間)
    breachDamageMin: 1, // 突破された敵が与える value ダメージの最小値
  },

  gates: {
    poolSize: 16,
    width: 2.2, // 1ゲートの横幅(衝突に使用)
    pairOffsetX: 2.0, // 左右ゲートの中心オフセット
    spawnIntervalSec: 5, // ゲート出現間隔
    firstSpawnAtSec: 1.5, // 最初のゲートが出現するまでの時間
    starterZ: -22, // スタート時に近距離へ出す強化ゲートの出現位置(敵より先に到達)
  },

  scoring: {
    killBase: 1, // 撃破スコアの最低値(実際は max(killBase, maxHp))
  },
};
