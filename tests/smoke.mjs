// 非ブラウザ(node)でコアロジックを検証するスモークテスト。
// window/requestAnimationFrame に依存せず game.update(dt) を直接回す。
import { Game } from '../src/core/game.js';
import { ObjectPool } from '../src/core/pool.js';
import { createPlayer, applyOperator, recomputeStats, setWeapon, cycleWeapon } from '../src/core/player.js';
import { createBulletSystem, firePlayer, pickAimTarget } from '../src/core/bullets.js';
import { createEnemySystem, spawnEnemy, spawnBoss, rollEnemyType, burstCount } from '../src/core/enemies.js';
import { resolveBulletEnemy, resolvePlayerEnemy } from '../src/core/collision.js';

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass++;
    console.log('  ok  -', name);
  } else {
    fail++;
    console.error('  FAIL-', name);
  }
}

// --- 1. ObjectPool の確保/返却 ---------------------------------------------
{
  const pool = new ObjectPool({ size: 3, prefix: 't', create: () => ({}), reset: (o, v) => (o.n = v) });
  const a = pool.acquire(1);
  const b = pool.acquire(2);
  ok('pool acquire は安定idを付与(先頭から)', a.id === 't0' && b.id === 't1');
  ok('pool activeCount 反映', pool.activeCount === 2);
  pool.release(a);
  ok('pool release で空きが戻る', pool.activeCount === 1);
  const c = pool.acquire(3);
  const d = pool.acquire(4);
  ok('pool 枯渇時は null', pool.acquire(5) === null && c && d);
  pool.releaseAll();
  ok('pool releaseAll で全解放', pool.activeCount === 0);
}

// --- 2. ゲート演算 -----------------------------------------------------------
{
  const p = createPlayer();
  p.value = 10;
  recomputeStats(p);
  applyOperator(p, 'multiply', 3);
  ok('multiply: 10*3=30', p.value === 30);
  applyOperator(p, 'add', 5);
  ok('add: 30+5=35', p.value === 35);
  applyOperator(p, 'subtract', 5);
  ok('subtract: 35-5=30', p.value === 30);
  applyOperator(p, 'divide', 2);
  ok('divide: 30/2=15', p.value === 15);
  ok('shotCap で同時発射数が上限', p.shotCount === 15);
  applyOperator(p, 'multiply', 10); // 150
  ok('value超過分は威力へ', p.shotCount === 16 && p.bulletPower === Math.ceil(150 / 16));
}

// --- 3. 弾が敵を撃破する ----------------------------------------------------
{
  const g = new Game();
  g.start();
  g.player.value = 20;
  recomputeStats(g.player);
  let killed = false;
  for (let i = 0; i < 600 && g.state.status === 'playing'; i++) {
    g.update(1 / 60);
    if (g.state.events.some((e) => e.type === 'enemyKilled')) killed = true;
  }
  ok('一定時間で敵を撃破できる', killed);
  ok('スコアが加算される', g.state.score > 0);
  ok('描画配列に使用中の弾のみ入る', g.state.bullets.every((b) => b.active));
}

// --- 4. ゲート通過で value が変化し、ペアは片方のみ適用される ----------------
{
  const g = new Game();
  g.start();
  g.gatePool.releaseAll(); // スタート強化ゲートを除去して手動ペアのみ検証
  g.player.x = 0;
  g.player.value = 10;
  recomputeStats(g.player);
  // 自機のすぐ奥に左右ペアを直接配置(他のスポーンは猶予中で干渉しない)
  const z0 = g.player.z - 5;
  g.gatePool.acquire({ x: -2.0, z: z0, operator: 'add', value: 7, speed: g.state.scrollSpeed });
  g.gatePool.acquire({ x: 2.0, z: z0, operator: 'multiply', value: 9, speed: g.state.scrollSpeed });

  let gateEvents = 0;
  for (let i = 0; i < 60 && g.state.status === 'playing'; i++) {
    g.input.targetX = 0;
    g.update(1 / 60);
    gateEvents += g.state.events.filter((e) => e.type === 'gate').length;
  }
  ok('ゲート通過イベントが発生', gateEvents >= 1);
  ok('ペアは片方のみ適用される', gateEvents === 1);
  ok('ゲートで value が変化する', g.player.value !== 10);
}

// --- 5. リセットで初期化される ----------------------------------------------
{
  const g = new Game();
  g.start();
  for (let i = 0; i < 300; i++) g.update(1 / 60);
  g.reset();
  ok('reset で score=0', g.state.score === 0);
  ok('reset で wave=1', g.state.wave === 1);
  ok('reset で弾/敵が空', g.state.bullets.length === 0 && g.state.enemies.length === 0);
  ok('reset でスタート強化ゲートのみ存在', g.state.gates.length === 2);
  ok('reset で value 初期化', g.player.value === 1);
  ok('reset で isPaused=false', g.state.isPaused === false);
}

// --- 6. ポーズ中は全更新が停止する ------------------------------------------
{
  const g = new Game();
  g.start();
  g.player.value = 9999; // 4秒間生き延びさせる
  recomputeStats(g.player);
  for (let i = 0; i < 240; i++) {
    g.input.targetX = 0;
    g.update(1 / 60);
  }
  ok('ポーズ前にプレイ継続', g.state.status === 'playing');
  const snap = {
    time: g.state.time,
    score: g.state.score,
    enemies: g.state.enemies.length,
    px: g.player.x,
  };
  const paused = g.togglePause();
  ok('togglePause で isPaused=true', paused === true && g.state.isPaused === true);
  for (let i = 0; i < 120; i++) {
    g.input.targetX = 3; // 動かそうとしても無効のはず
    g.update(1 / 60);
  }
  ok('ポーズ中: time 停止', g.state.time === snap.time);
  ok('ポーズ中: score 停止', g.state.score === snap.score);
  ok('ポーズ中: 敵数固定', g.state.enemies.length === snap.enemies);
  ok('ポーズ中: プレイヤー移動なし', g.player.x === snap.px);
  g.togglePause();
  ok('再開で isPaused=false', g.state.isPaused === false);
  const t2 = g.state.time;
  for (let i = 0; i < 60; i++) g.update(1 / 60);
  ok('再開後: time 進行', g.state.time > t2);
}

// --- 7. 敵がライン突破でゲームオーバー ---------------------------------------
{
  const g = new Game();
  g.start();
  g.player.value = 1;
  recomputeStats(g.player);
  // 防衛ラインを越えた位置に敵を直接配置。突破ダメージは残HPでなく固定値(breach)。
  // HP が高くても breach=1 しか奪わない(残HP非依存)が、value=1 なので 0 で GO。
  g.enemyPool.acquire({ x: 0, z: g.player.z + 0.5, hp: 50, speed: 0, breach: 1 });
  g.update(1 / 60);
  ok('ライン突破でゲームオーバー', g.state.status === 'gameover');
  ok('突破で value が枯渇', g.player.value <= 0);
}

// --- 8. 敵が開始直後(約1.2秒)に出現する ------------------------------------
{
  // デフォルト value(=1)の弱い火力なら敵は即殲滅されず配列に滞留する。
  const g = new Game();
  g.start();
  let firstSpawn = null;
  for (let i = 0; i < 180 && g.state.status === 'playing'; i++) {
    g.update(1 / 60);
    if (firstSpawn === null && g.state.enemies.length > 0) firstSpawn = g.state.time;
  }
  ok('敵が約1.5秒以内に出現', firstSpawn !== null && firstSpawn <= 1.6);
}

// --- 9. 武器の切替 ----------------------------------------------------------
{
  const p = createPlayer();
  ok('初期武器は rifle', p.weapon === 'rifle');
  setWeapon(p, 'bazooka');
  ok('setWeapon で武器を切替', p.weapon === 'bazooka');
  setWeapon(p, 'unknown-gun');
  ok('未知の武器 id は無視される', p.weapon === 'bazooka');
  cycleWeapon(p); // list順: rifle,machinegun,bazooka,rocket → bazooka の次は rocket
  ok('cycleWeapon で次の武器へ巡回', p.weapon === 'rocket');
}

// --- 10. 武器ゲート通過で銃が切り替わる -------------------------------------
{
  const g = new Game();
  g.start();
  g.gatePool.releaseAll();
  g.player.x = 0;
  g.player.weapon = 'rifle';
  const v0 = g.player.value;
  // 自機のすぐ奥に武器ゲートを直接配置
  g.gatePool.acquire({ x: 0, z: g.player.z - 5, operator: 'weapon', weapon: 'bazooka', speed: g.state.scrollSpeed });
  for (let i = 0; i < 60 && g.state.status === 'playing'; i++) {
    g.input.targetX = 0;
    g.update(1 / 60);
  }
  ok('武器ゲート通過で銃が切り替わる', g.player.weapon === 'bazooka');
  ok('武器ゲートは value を変えない', g.player.value === v0);
}

// --- 11. 貫通弾(pierce)は複数の敵を撃ち抜く ---------------------------------
{
  const bp = createBulletSystem();
  const ep = createEnemySystem();
  // 同一地点に弱い敵2体。貫通2の弾(power10)で両方倒せて弾は残るはず。
  ep.acquire({ x: 0, z: -10, hp: 5, speed: 0, kind: 'normal', radius: 1.2 });
  ep.acquire({ x: 0, z: -10, hp: 5, speed: 0, kind: 'normal', radius: 1.2 });
  const b = bp.acquire({ x: 0, y: 0, z: -10, vx: 0, vz: 0, power: 10, kind: 'rifle', radius: 0.3, pierce: 2, splash: 0 });
  let killed = 0;
  const ctx = { emit: (e) => { if (e.type === 'enemyKilled') killed++; }, addScore: () => {} };
  resolveBulletEnemy(bp, ep, ctx);
  ok('貫通弾が複数の敵を撃破', killed === 2);
  ok('貫通上限内なら弾は残る', b.active === true);
}

// --- 12. 爆風弾(splash)は範囲内の敵を巻き込む -------------------------------
{
  const bp = createBulletSystem();
  const ep = createEnemySystem();
  ep.acquire({ x: 0, z: -10, hp: 5, speed: 0, kind: 'normal', radius: 1.2 }); // 直撃
  ep.acquire({ x: 1, z: -10, hp: 5, speed: 0, kind: 'normal', radius: 1.2 }); // 爆風圏内
  ep.acquire({ x: 10, z: -10, hp: 5, speed: 0, kind: 'normal', radius: 1.2 }); // 圏外
  const b = bp.acquire({ x: 0, y: 0, z: -10, vx: 0, vz: 0, power: 10, kind: 'bazooka', radius: 0.5, pierce: 0, splash: 3.4 });
  let killed = 0;
  const ctx = { emit: (e) => { if (e.type === 'enemyKilled') killed++; }, addScore: () => {} };
  resolveBulletEnemy(bp, ep, ctx);
  ok('爆風が直撃+範囲内の敵を撃破', killed === 2);
  ok('爆風は射程外の敵に届かない', ep.items.filter((e) => e.active && e.x === 10).length === 1);
  ok('爆風弾は着弾で消滅(貫通なし)', b.active === false);
}

// --- 13. 敵タイプ: 抽選と密度・固さ ------------------------------------------
{
  const known = ['normal', 'tank', 'rusher', 'weaver'];
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(rollEnemyType(5));
  ok('rollEnemyType は既知タイプのみ返す', [...seen].every((t) => known.includes(t)));
  ok('wave が上がると同時出現数が増える', burstCount(1) >= 1 && burstCount(20) > burstCount(1));

  const ep = createEnemySystem();
  let tankHp = 0;
  let normalHp = 0;
  for (let i = 0; i < 500 && (!tankHp || !normalHp); i++) {
    const e = spawnEnemy(ep, 1, 16);
    if (e.kind === 'tank' && !tankHp) tankHp = e.maxHp;
    if (e.kind === 'normal' && !normalHp) normalHp = e.maxHp;
    ep.release(e);
  }
  ok('tank は normal より固い', tankHp > normalHp);
}

// --- 14. オートエイム: 移動方向の敵を優先し、その方向へ撃つ -----------------
{
  const player = createPlayer();
  player.x = 0;
  const ep = createEnemySystem();
  const right = ep.acquire({ x: 3, z: player.z - 12, hp: 5, speed: 0, kind: 'normal', radius: 1.2 });
  const left = ep.acquire({ x: -3, z: player.z - 12, hp: 5, speed: 0, kind: 'normal', radius: 1.2 });
  player.moveDir = 1;
  ok('移動方向(右)側の敵を優先して狙う', pickAimTarget(player, ep) === right);
  player.moveDir = -1;
  ok('移動方向(左)側の敵を優先して狙う', pickAimTarget(player, ep) === left);
  player.moveDir = 0;
  ok('停止中でもいずれかの敵を狙う', pickAimTarget(player, ep) !== null);

  // 右の敵だけ残し、発射方向が右(vx>0)へ向くか
  ep.release(left);
  const bp = createBulletSystem();
  player.weapon = 'rifle';
  recomputeStats(player);
  firePlayer(bp, player, ep);
  const fired = bp.items.filter((b) => b.active);
  ok('オートエイムで右の敵へ vx>0 の弾が出る', fired.length > 0 && fired.every((b) => b.vx > 0));
  ok('発射時に aimTargetId が設定される', player.aimTargetId === right.id);
}

// --- 15. 狙う敵がいなければ正面へ撃つ ---------------------------------------
{
  const player = createPlayer();
  player.x = 0;
  player.weapon = 'rifle';
  recomputeStats(player);
  const ep = createEnemySystem(); // 空(敵なし)
  const bp = createBulletSystem();
  firePlayer(bp, player, ep);
  const fired = bp.items.filter((b) => b.active);
  ok('敵不在なら正面(vx≈0, vz<0)へ撃つ', fired.length > 0 && Math.abs(fired[0].vx) < 1e-6 && fired[0].vz < 0);
  ok('敵不在なら aimTargetId は null', player.aimTargetId === null);
}

// --- 16. 突破ダメージは残HP非依存の固定値(breach) --------------------------
{
  const player = createPlayer();
  player.value = 1000;
  recomputeStats(player);
  player.x = 0;
  const ep = createEnemySystem();
  const dmgs = [];
  const ctx = { emit: (e) => { if (e.type === 'playerHit') dmgs.push(e.damage); }, addScore: () => {} };
  // 同 breach で残HPが大きく違う2体を突破させ、奪われる value が等しいことを確認
  ep.acquire({ x: 0, z: player.z + 0.5, hp: 5, speed: 0, kind: 'tank', radius: 1.2, breach: 4 });
  resolvePlayerEnemy(player, ep, ctx);
  ep.acquire({ x: 0, z: player.z + 0.5, hp: 999, speed: 0, kind: 'tank', radius: 1.2, breach: 4 });
  resolvePlayerEnemy(player, ep, ctx);
  ok('突破ダメージは breach 固定(残HP5→4)', dmgs[0] === 4);
  ok('高HP(999)でも突破ダメージは同じ(=4)', dmgs[1] === 4);
}

// --- 17. 難易度設定: 5段階で敵密度と固さが変わる ---------------------------
{
  const g = new Game();
  ok('デフォルト難易度は3', g.state.difficulty.level === 3);
  g.setDifficulty(5);
  ok('setDifficulty で state に反映', g.state.difficulty.level === 5 && g.state.difficulty.label === 'NIGHTMARE');
  g.setDifficulty(99);
  ok('難易度は1-5に丸められる', g.state.difficulty.level === 5);
  ok('高難易度ほど同時出現数が増える', burstCount(1, 5) > burstCount(1, 1));

  const originalRandom = Math.random;
  Math.random = () => 0; // normal を固定抽選
  const ep = createEnemySystem();
  const easy = spawnEnemy(ep, 1, 16, 0, 1);
  const hard = spawnEnemy(ep, 1, 16, 0, 5);
  Math.random = originalRandom;
  ok('高難易度ほど敵HPが高い', hard.maxHp > easy.maxHp);
  ok('高難易度ほど突破ダメージが重い', hard.breach > easy.breach);
}

// --- 18. 武器ごとの弾の出方が分かれる --------------------------------------
{
  const ep = createEnemySystem();
  ep.acquire({ x: 0, z: -20, hp: 500, speed: 0, kind: 'normal', radius: 1.2 });
  const stats = {};
  for (const weapon of ['rifle', 'machinegun', 'bazooka', 'rocket']) {
    const p = createPlayer();
    p.value = 32;
    p.weapon = weapon;
    recomputeStats(p);
    const bp = createBulletSystem();
    firePlayer(bp, p, ep);
    const fired = bp.items.filter((b) => b.active);
    stats[weapon] = {
      count: fired.length,
      power: fired[0]?.power ?? 0,
      radius: fired[0]?.radius ?? 0,
      splash: fired[0]?.splash ?? 0,
      pierce: fired[0]?.pierce ?? 0,
    };
  }
  ok('マシンガンはライフルより低威力で連射寄り', stats.machinegun.power < stats.rifle.power);
  ok('バズーカは最大級の単発威力と爆風を持つ', stats.bazooka.power > stats.rifle.power && stats.bazooka.splash > stats.rocket.splash);
  ok('ロケットはライフルより多弾・爆風あり', stats.rocket.count > stats.rifle.count && stats.rocket.splash > 0);
  ok('ライフルは貫通性能を持つ', stats.rifle.pierce > 0);
}

// --- 19. ボス: 定期出現し、通常敵より大きく固い -----------------------------
{
  const ep = createEnemySystem();
  const normal = spawnEnemy(ep, 1, 16, 0, 3);
  const boss = spawnBoss(ep, 1, 16, 3);
  ok('ボスは kind=boss と isBoss を持つ', boss.kind === 'boss' && boss.isBoss === true);
  ok('ボスは通常敵よりかなり固い', boss.maxHp > normal.maxHp * 10);
  ok('ボスは通常敵より大きい', boss.radius > normal.radius * 2);

  const g = new Game();
  g.start();
  g.player.value = 9999;
  recomputeStats(g.player);
  let bossSeen = false;
  for (let i = 0; i < 1500 && g.state.status === 'playing'; i++) {
    g.update(1 / 60);
    if (g.state.events.some((e) => e.type === 'bossSpawned') || g.state.enemies.some((e) => e.kind === 'boss')) {
      bossSeen = true;
      break;
    }
  }
  ok('一定時間後にボスが出現する', bossSeen);
}

console.log(`\n結果: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
