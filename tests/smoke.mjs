// 非ブラウザ(node)でコアロジックを検証するスモークテスト。
// window/requestAnimationFrame に依存せず game.update(dt) を直接回す。
import { Game } from '../src/core/game.js';
import { ObjectPool } from '../src/core/pool.js';
import { createPlayer, applyOperator, recomputeStats } from '../src/core/player.js';

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
  ok('reset で弾/敵/ゲートが空', g.state.bullets.length === 0 && g.state.enemies.length === 0 && g.state.gates.length === 0);
  ok('reset で value 初期化', g.player.value === 1);
}

console.log(`\n結果: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
