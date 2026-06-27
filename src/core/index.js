// =============================================================================
//  index.js  —  コア層エントリポイント / グローバル公開・UI連携
// -----------------------------------------------------------------------------
//  ブラウザで <script type="module" src="src/core/index.js"> として読み込む。
//   - Game を生成し、window.gameState / window.GameAPI を公開。
//   - Codex UI が発火する CustomEvent を購読してゲームを制御。
//   - 入力(タッチ/キー)を接続し、ループを開始。
// =============================================================================

import { Game } from './game.js';
import { CONFIG } from './config.js';

const game = new Game();

if (typeof window !== 'undefined') {
  // 描画層が参照する中央ステート(README の契約準拠)
  window.gameState = game.state;

  // 制御 API(Codex/デバッグ用)
  window.GameAPI = {
    start: () => game.start(),
    reset: () => game.reset(),
    pause: () => game.pause(),
    resume: () => game.resume(),
    togglePause: () => game.togglePause(),
    setDifficulty: (level) => game.setDifficulty(level),
    attachInput: (el) => game.attachInput(el),
    setRenderHook: (fn) => game.setRenderHook(fn),
    config: CONFIG,
    _game: game,
  };

  // 一時停止トグル(Codex のポーズボタンから直接呼べるグローバル関数)
  window.togglePause = () => game.togglePause();

  // Codex UI のボタンから飛んでくる開始/リスタート/ポーズ要求を購読
  window.addEventListener('visual:start-requested', () => game.start());
  window.addEventListener('visual:restart-requested', () => game.start());
  window.addEventListener('visual:pause-requested', () => game.togglePause());
  window.addEventListener('visual:difficulty-requested', (event) => {
    game.setDifficulty(event.detail?.level);
  });

  // 入力接続とループ開始
  const boot = () => {
    game.attachInput(window);
    // ready 状態でループを回し、開始要求が来たら playing へ。
    // 開始要求が来ない環境でも描画できるよう、最初の更新ループは回しておく。
    game._startLoop();
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}

/* =============================================================================
 * CODEX_START: VISUAL_AND_UI
 * -----------------------------------------------------------------------------
 * この下/別ファイル(src/visual/)に描画・UI を実装してください。
 * コア層とのインターフェースは以下に固定されています(これ以外には依存しないこと):
 *
 *  [読み取り] window.gameState  ※すべて読み取り専用・座標はフラット x/y/z
 *    .status   : 'ready' | 'playing' | 'paused' | 'gameover'
 *    .isPaused : boolean  // 一時停止中は true(描画は継続・ロジックは停止)
 *    .score    : number
 *    .wave     : number
 *    .player   : { id, x, y, z, value, shotCount, fireRate, bulletPower, weapon }
 *               weapon = 'rifle' | 'machinegun' | 'bazooka' | 'rocket' (現在の銃)
 *    .bullets  : Array<{ id, x, y, z, power, kind, radius }>        // kind=銃id, radius=見た目/当たり
 *    .enemies  : Array<{ id, x, y, z, hp, maxHp, kind, radius }>    // 使用中のみ
 *               kind = 'normal' | 'tank' | 'rusher' | 'weaver' (敵タイプ。radius=サイズ)
 *    .gates    : Array<{ id, x, y, z, operator, value, weapon }>   // 使用中のみ
 *               operator='weapon' のとき weapon(銃id)を適用し value は使わない
 *    .events   : Array<{ type, x, y, z, ... }>            // 1フレーム分(エフェクト用)
 *               type = 'hit' | 'enemyKilled' | 'gate' | 'playerHit' | 'explosion' | 'gameover'
 *               hit/enemyKilled は kind を持つ。explosion は { radius, kind }(爆風用)。
 *               gate は operator='weapon' のとき weapon を持つ。
 *
 *  ※ id は安定。id をキーに Mesh をマッピングし、配列から消えた id は隠す/破棄する。
 *
 *  [制御] 以下の CustomEvent を window へ dispatch(コア層が購読):
 *    'visual:start-requested'    // 開始 / リスタート
 *    'visual:restart-requested'  // リスタート
 *    'visual:pause-requested'    // 一時停止 / 再開トグル
 *  または window.GameAPI.start()/reset()/pause()/resume()/togglePause()、
 *  もしくは window.togglePause() を直接呼ぶ。
 *
 *  [描画フック] 任意: window.GameAPI.setRenderHook((state, dt) => { ... })
 *    update 後に毎フレーム呼ばれる(独自 RAF を持つ場合は不要)。
 *
 *  [入力] canvas を使う場合は window.GameAPI.attachInput(canvasElement) を呼ぶと
 *    その要素基準でタッチ座標を計算します(既定は window 全体)。
 * =============================================================================
 * CODEX_END
 */

export { game };
