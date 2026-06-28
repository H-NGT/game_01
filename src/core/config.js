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
    maxValue: 140, // POWERの上限。乗算ゲートで雪だるま式に増えすぎるのを防ぐ
    moveResponse: 12, // 横移動の追従の速さ(大きいほど機敏)
    shotCap: 16, // 弾ストリームの最大同時数(同時発射数の上限)
    muzzleSpread: 1.6, // 多重発射時の発射口の横広がり
    baseFireRate: 5, // 連射速度の基本値 (volleys/s)
    fireRatePerWave: 0.25, // wave ごとの連射速度上昇
    maxFireRate: 14,
    aimMoveThreshold: 0.04, // これ以上 targetX へ追従中なら「移動方向」と判定
    multiplyGainRate: 0.65, // ×ゲートの実増加率。表示倍率そのままの爆増を抑える
    multiplyGainMax: 32, // 1回の×ゲートで増えるPOWERの最大値
  },

  bullets: {
    poolSize: 768,
    radius: 0.3,
    speed: 70, // 弾速 (units/s)
    despawnZ: -90, // これより奥へ進んだら回収
  },

  enemies: {
    poolSize: 512,
    radius: 1.2, // 標準サイズの衝突半径(タイプで radiusMul 倍される)
    baseHp: 9, // wave1 の基本HP
    hpPerWave: 4, // wave ごとのHP増加
    baseSpawnIntervalSec: 0.62, // 出現間隔(基本)
    minSpawnIntervalSec: 0.18,
    spawnIntervalPerWave: 0.035, // wave ごとに間隔短縮
    firstSpawnDelaySec: 0.95, // 開始直後の短い猶予(スタート強化ゲートを取る時間)
    breachDamageMin: 1, // 突破された敵が与える value ダメージの最小値
    weaveFreq: 2.6, // weaver 系の横揺れ角速度 (rad/s)

    // --- 敵タイプ ------------------------------------------------------------
    //  HP/速度/サイズ/突破時の固定ダメージ(breach)と横揺れ(weave)で性格を分ける。
    //  breach は「突破された際に value から奪う固定ダメージ」。残HP に依存しない
    //  ので、固い敵を倒し損ねても一撃死しない(調整しやすい)。
    //  kind は描画契約 enemy.kind として公開する。
    types: {
      normal: { hpMul: 1.0, speedMul: 1.0, radiusMul: 1.0, breach: 1, weave: 0 },
      tank: { hpMul: 3.2, speedMul: 0.72, radiusMul: 1.45, breach: 4, weave: 0 }, // 固い壁
      rusher: { hpMul: 0.7, speedMul: 1.85, radiusMul: 0.85, breach: 5, weave: 0 }, // 速い・突破が痛い
      weaver: { hpMul: 1.25, speedMul: 1.05, radiusMul: 1.0, breach: 2, weave: 2.6 }, // 横に揺れて避ける
      boss: { hpMul: 18, speedMul: 0.54, radiusMul: 2.7, breach: 14, weave: 0.6 }, // 定期出現する巨大な壁
    },
    // wave ごとの各タイプ出現重み。序盤は normal 中心、後半で強敵が増える。
    // weightAt(wave) で線形に強敵側へ寄せる(下の関数参照)。
    spawnWeights: {
      base: { normal: 10, tank: 1, rusher: 1, weaver: 1 },
      perWave: { normal: -0.5, tank: 0.6, rusher: 0.7, weaver: 0.5 },
    },
    // wave に応じて 1 回のスポーンで複数体まとめて出す(密度を上げる)。
    burstBase: 1,
    burstPerWave: 0.2, // wave ごとに +0.2 体(切り捨て)
    burstMax: 6,
    bossFirstAtSec: 24,
    bossIntervalSec: 34,
    bossHpPerWave: 26,
    breachHpDamageRate: 0.45, // 到達時、残HPの何割を value ダメージへ乗せるか
    breachValueDamageRate: 0.18, // 到達時、現在 value の最低何割を削るか
    bossBreachValueDamageRate: 0.65,
  },

  gates: {
    poolSize: 16,
    width: 2.2, // 1ゲートの横幅(衝突に使用)
    pairOffsetX: 2.0, // 左右ゲートの中心オフセット
    spawnIntervalSec: 5, // ゲート出現間隔
    firstSpawnAtSec: 1.5, // 最初のゲートが出現するまでの時間
    starterZ: -22, // スタート時に近距離へ出す強化ゲートの出現位置(敵より先に到達)
    weaponChance: 0.28, // このゲートペアを「武器選択ゲート(左右で別の銃)」にする確率
  },

  difficulties: {
    defaultLevel: 3,
    minLevel: 1,
    maxLevel: 5,
    levels: {
      1: {
        label: 'EASY',
        enemyIntervalMul: 1.22,
        enemyHpMul: 0.82,
        enemySpeedMul: 0.92,
        breachMul: 0.8,
        burstBonus: 0,
        weightWaveBonus: -1,
        bossHpMul: 0.72,
        gateGoodPairChance: 0.48,
        gatePenaltyChance: 0.45,
        gateGoodValueMul: 1.2,
        gateBadValueMul: 0.75,
        weaponChanceMul: 1.2,
        starterBothBuff: true,
      },
      2: {
        label: 'NORMAL',
        enemyIntervalMul: 1.04,
        enemyHpMul: 1.0,
        enemySpeedMul: 0.98,
        breachMul: 1.0,
        burstBonus: 0,
        weightWaveBonus: 0,
        bossHpMul: 0.92,
        gateGoodPairChance: 0.28,
        gatePenaltyChance: 0.62,
        gateGoodValueMul: 1.0,
        gateBadValueMul: 0.95,
        weaponChanceMul: 1.0,
        starterBothBuff: true,
      },
      3: {
        label: 'HARD',
        enemyIntervalMul: 0.88,
        enemyHpMul: 1.18,
        enemySpeedMul: 1.04,
        breachMul: 1.18,
        burstBonus: 1,
        weightWaveBonus: 1,
        bossHpMul: 1.12,
        gateGoodPairChance: 0.16,
        gatePenaltyChance: 0.74,
        gateGoodValueMul: 0.82,
        gateBadValueMul: 1.15,
        weaponChanceMul: 0.9,
        starterBothBuff: true,
      },
      4: {
        label: 'EXPERT',
        enemyIntervalMul: 0.72,
        enemyHpMul: 1.42,
        enemySpeedMul: 1.1,
        breachMul: 1.36,
        burstBonus: 1,
        weightWaveBonus: 3,
        bossHpMul: 1.38,
        gateGoodPairChance: 0.08,
        gatePenaltyChance: 0.84,
        gateGoodValueMul: 0.7,
        gateBadValueMul: 1.35,
        weaponChanceMul: 0.75,
        starterBothBuff: false,
      },
      5: {
        label: 'NIGHTMARE',
        enemyIntervalMul: 0.6,
        enemyHpMul: 1.78,
        enemySpeedMul: 1.18,
        breachMul: 1.62,
        burstBonus: 2,
        weightWaveBonus: 5,
        bossHpMul: 1.72,
        gateGoodPairChance: 0.03,
        gatePenaltyChance: 0.92,
        gateGoodValueMul: 0.58,
        gateBadValueMul: 1.6,
        weaponChanceMul: 0.6,
        starterBothBuff: false,
      },
    },
  },

  scoring: {
    killBase: 1, // 撃破スコアの最低値(実際は max(killBase, maxHp))
  },

  // ===========================================================================
  //  weapons  —  プレイヤーの銃の種類(発射の出方を変える仕掛け)
  // ---------------------------------------------------------------------------
  //  value から導出した shotCount/bulletPower を「ベース」とし、各銃の倍率と
  //  固有挙動(貫通=pierce / 爆風=splash)で出方を変える。
  //  武器ゲート(operator:'weapon')を通過すると weapon が切り替わる。
  //  描画契約: player.weapon と bullet.kind に銃 id を公開する。
  // ===========================================================================
  weapons: {
    list: ['rifle', 'machinegun', 'bazooka', 'rocket'],
    startWeapon: 'rifle',
    defs: {
      // ライフル: 単発を太く速く、2体まで貫通。堅実な万能銃。
      rifle: {
        label: 'ライフル',
        fireRateMul: 0.9, // 連射倍率
        powerMul: 2.2, // 1発の威力倍率
        shotMul: 0.25, // 同時発射数の倍率(数を絞って1発を太く)
        speedMul: 1.65, // 弾速倍率(速い)
        radiusMul: 0.95, // 弾の当たり判定倍率
        pierce: 4, // 貫通体数(0=貫通なし)
        splash: 0, // 爆風半径(0=爆風なし)
      },
      // マシンガン: 超連射・低威力・大きく拡散。手数で押す。
      machinegun: {
        label: 'マシンガン',
        fireRateMul: 3.7,
        powerMul: 0.35,
        shotMul: 0.7,
        speedMul: 1.18,
        radiusMul: 0.55,
        pierce: 0,
        splash: 0,
      },
      // バズーカ: 低連射・超高威力・低速・大爆風。固い敵をまとめて吹き飛ばす。
      bazooka: {
        label: 'バズーカ',
        fireRateMul: 0.28,
        powerMul: 5.2,
        shotMul: 0.16,
        speedMul: 0.58,
        radiusMul: 2.7,
        pierce: 0,
        splash: 5.3,
      },
      // ロケランチャー: 多発拡散・中威力・中爆風。面で制圧する。
      rocket: {
        label: 'ロケラン',
        fireRateMul: 0.55,
        powerMul: 1.65,
        shotMul: 0.95,
        speedMul: 0.82,
        radiusMul: 1.25,
        pierce: 0,
        splash: 1.8,
      },
    },
  },
};

export function normalizeDifficultyLevel(level) {
  const numeric = Number(level);
  const raw = Number.isFinite(numeric) ? Math.round(numeric) : CONFIG.difficulties.defaultLevel;
  return Math.min(CONFIG.difficulties.maxLevel, Math.max(CONFIG.difficulties.minLevel, raw));
}

export function getDifficultyConfig(level) {
  const normalized = normalizeDifficultyLevel(level);
  return CONFIG.difficulties.levels[normalized] || CONFIG.difficulties.levels[CONFIG.difficulties.defaultLevel];
}
