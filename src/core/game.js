// =============================================================================
//  game.js  —  ゲームループ統括 / 中央ステート(window.gameState)の構築
// -----------------------------------------------------------------------------
//  各サブシステム(player/bullets/enemies/gates/collision/input)を束ね、
//  1フレーム分の更新 update(dt) と requestAnimationFrame ループを提供する。
//
//  描画層(Codex)との接点:
//   - this.state を window.gameState として公開(座標フラット, 契約準拠)。
//   - state.bullets / enemies / gates は「使用中のみ」を毎フレーム詰め直す配列。
//   - state.events に hit/enemyKilled/gate/playerHit を1フレーム分積む(エフェクト用)。
//   - setRenderHook(fn) で update 後に fn(state, dt) を呼べる(push型連携も可)。
// =============================================================================

import { CONFIG } from './config.js';
import { ObjectPool } from './pool.js';
import { createPlayer, updatePlayer, recomputeStats } from './player.js';
import { createBulletSystem, firePlayer, updateBullets } from './bullets.js';
import { createEnemySystem, spawnEnemy, updateEnemies, burstCount } from './enemies.js';
import { createGateSystem, spawnGatePair, updateGates } from './gates.js';
import { resolveBulletEnemy, resolvePlayerGate, resolvePlayerEnemy } from './collision.js';
import { InputController } from './input.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Game {
  constructor() {
    this.player = createPlayer();
    this.bulletPool = createBulletSystem();
    this.enemyPool = createEnemySystem();
    this.gatePool = createGateSystem();
    this.input = new InputController();

    // 描画層へ公開する中央ステート(座標はすべてフラット x/y/z)
    this.state = {
      status: 'ready', // 'ready' | 'playing' | 'paused' | 'gameover'
      isPaused: false, // 一時停止フラグ(Codex のポーズボタン用)
      score: 0,
      wave: 1,
      time: 0,
      scrollSpeed: CONFIG.world.baseScrollSpeed,
      player: this.player,
      bullets: [], // 使用中の弾(毎フレーム詰め直し)
      enemies: [], // 使用中の敵
      gates: [], // 使用中のゲート
      events: [], // 1フレーム分のイベント(エフェクト用)
    };

    // 内部タイマ
    this._waveTimer = 0;
    this._enemyTimer = 0;
    this._gateTimer = 0;

    this._renderHook = null;
    this._rafId = 0;
    this._lastTime = 0;
    this._running = false;

    // ctx: collision からスコア加算・イベント通知を受ける
    this._ctx = {
      emit: (evt) => this.state.events.push(evt),
      addScore: (n) => {
        this.state.score += n;
      },
    };
  }

  // --- 制御 API ---------------------------------------------------------------

  /** 初期化して開始する。 */
  start() {
    this.reset();
    this.state.status = 'playing';
    this._startLoop();
  }

  /** 状態を初期化する(status は 'ready')。 */
  reset() {
    this.bulletPool.releaseAll();
    this.enemyPool.releaseAll();
    this.gatePool.releaseAll();

    const p = this.player;
    p.x = 0;
    p.targetX = 0;
    p.z = CONFIG.player.zPos;
    p.value = CONFIG.player.startValue;
    p.fireTimer = 0;
    p.fireRate = CONFIG.player.baseFireRate;
    p.weapon = CONFIG.weapons.startWeapon;
    recomputeStats(p);

    this.input.reset();
    this.state.status = 'ready';
    this.state.isPaused = false;
    this.state.score = 0;
    this.state.wave = 1;
    this.state.time = 0;
    this.state.scrollSpeed = CONFIG.world.baseScrollSpeed;
    this.state.events.length = 0;
    this._waveTimer = 0;
    // 猶予明け(firstSpawnDelaySec)に最初の敵が即出るようタイマを先行充填
    this._enemyTimer = CONFIG.enemies.baseSpawnIntervalSec;
    // 最初のゲートが firstSpawnAtSec で出るようタイマを先行させる
    this._gateTimer = CONFIG.gates.spawnIntervalSec - CONFIG.gates.firstSpawnAtSec;
    // スタート強化ゲート: 近距離(starterZ)に両方バフのペアを出し、
    // 最初の敵が到達する前にプレイヤーを強化できるようにする。
    spawnGatePair(this.gatePool, 1, CONFIG.world.baseScrollSpeed, {
      z: CONFIG.gates.starterZ,
      bothBuff: true,
    });
    this._syncRenderArrays();
  }

  /**
   * 一時停止 / 再開を切り替える。戻り値は切り替え後の isPaused。
   * status と isPaused の両方を切り替える:
   *  - isPaused        … ユーザー要求のフラグ(描画層が参照可)
   *  - status='paused' … 描画層(visual.js)のポーズUI判定に使用
   */
  togglePause() {
    if (this.state.status === 'playing') {
      this.state.status = 'paused';
      this.state.isPaused = true;
    } else if (this.state.status === 'paused') {
      this.state.status = 'playing';
      this.state.isPaused = false;
    }
    return this.state.isPaused;
  }

  pause() {
    if (this.state.status === 'playing') {
      this.state.status = 'paused';
      this.state.isPaused = true;
    }
  }

  resume() {
    if (this.state.status === 'paused') {
      this.state.status = 'playing';
      this.state.isPaused = false;
    }
  }

  /** update 後に呼ばれる描画フック(Codex 用)。 */
  setRenderHook(fn) {
    this._renderHook = typeof fn === 'function' ? fn : null;
  }

  /** 入力リスナを DOM 要素へ接続する(Codex は canvas を渡せる)。 */
  attachInput(element) {
    this.input.attach(element);
  }

  // --- メイン更新 -------------------------------------------------------------

  /**
   * 1フレーム進める。dt は秒。テスト時はこれを直接呼べる。
   */
  update(dt) {
    // 一時停止中・プレイ中以外は全更新(移動/弾/敵/生成/タイマー)を完全停止
    if (this.state.status !== 'playing' || this.state.isPaused) return;
    const s = this.state;
    s.events.length = 0; // 前フレームのイベントを破棄
    s.time += dt;

    // wave 進行
    this._waveTimer += dt;
    if (this._waveTimer >= CONFIG.world.waveDurationSec) {
      this._waveTimer -= CONFIG.world.waveDurationSec;
      s.wave += 1;
    }
    s.scrollSpeed = clamp(
      CONFIG.world.baseScrollSpeed + (s.wave - 1) * CONFIG.world.scrollSpeedPerWave,
      CONFIG.world.baseScrollSpeed,
      CONFIG.world.maxScrollSpeed
    );

    // 入力 → プレイヤー移動・連射速度更新
    this.input.update(dt);
    updatePlayer(this.player, this.input, dt, s.wave);

    // 自動連射
    const interval = 1 / this.player.fireRate;
    this.player.fireTimer += dt;
    let volleys = 0;
    while (this.player.fireTimer >= interval && volleys < 8) {
      this.player.fireTimer -= interval;
      firePlayer(this.bulletPool, this.player, this.enemyPool);
      volleys++;
    }
    updateBullets(this.bulletPool, dt);

    // 敵スポーン(開始直後は猶予期間で出さない)
    if (s.time >= CONFIG.enemies.firstSpawnDelaySec) {
      const enemyInterval = Math.max(
        CONFIG.enemies.minSpawnIntervalSec,
        CONFIG.enemies.baseSpawnIntervalSec - (s.wave - 1) * CONFIG.enemies.spawnIntervalPerWave
      );
      this._enemyTimer += dt;
      while (this._enemyTimer >= enemyInterval) {
        this._enemyTimer -= enemyInterval;
        // wave が上がると 1 回のスポーンで複数体まとめて出す(密度を上げる)。
        const burst = burstCount(s.wave);
        for (let k = 0; k < burst; k++) spawnEnemy(this.enemyPool, s.wave, s.scrollSpeed);
      }
    }
    updateEnemies(this.enemyPool, dt);

    // ゲートスポーン
    this._gateTimer += dt;
    if (this._gateTimer >= CONFIG.gates.spawnIntervalSec) {
      this._gateTimer -= CONFIG.gates.spawnIntervalSec;
      spawnGatePair(this.gatePool, s.wave, s.scrollSpeed);
    }
    updateGates(this.gatePool, dt);

    // 衝突解決
    resolveBulletEnemy(this.bulletPool, this.enemyPool, this._ctx);
    resolvePlayerGate(this.player, this.gatePool, this._ctx);
    const alive = resolvePlayerEnemy(this.player, this.enemyPool, this._ctx);

    if (!alive || this.player.value <= 0) {
      this._gameOver();
    }

    this._syncRenderArrays();
  }

  // --- 内部 -------------------------------------------------------------------

  _gameOver() {
    this.state.status = 'gameover';
    this.state.events.push({ type: 'gameover', score: this.state.score, wave: this.state.wave });
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('logic:gameover', { detail: { score: this.state.score, wave: this.state.wave } }));
    }
  }

  /** プールの使用中要素だけを描画用配列へ詰め直す(配列自体は再利用)。 */
  _syncRenderArrays() {
    syncActive(this.state.bullets, this.bulletPool);
    syncActive(this.state.enemies, this.enemyPool);
    syncActive(this.state.gates, this.gatePool);
  }

  _startLoop() {
    if (this._running) return;
    if (typeof requestAnimationFrame === 'undefined') return; // 非ブラウザでは loop なし
    this._running = true;
    this._lastTime = 0;
    const loop = (now) => {
      if (!this._running) return;
      if (this._lastTime === 0) this._lastTime = now;
      const dt = clamp((now - this._lastTime) / 1000, 0, 0.05);
      this._lastTime = now;
      this.update(dt);
      if (this._renderHook) this._renderHook(this.state, dt);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _stopLoop() {
    this._running = false;
    if (this._rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = 0;
  }
}

function syncActive(arr, pool) {
  arr.length = 0;
  const items = pool.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].active) arr.push(items[i]);
  }
}
