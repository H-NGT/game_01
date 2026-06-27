// =============================================================================
//  input.js  —  スマホ向けタッチ / マウス / キーボード入力
// -----------------------------------------------------------------------------
//  横方向の目標位置 targetX(レーン座標) のみを生成する。発射は自動連射のため
//  入力は移動だけを担当する。player.js が targetX へ追従移動する。
//
//  ・タッチ/ポインタ: 画面の横位置を絶対座標としてレーン位置にマップ。
//  ・キーボード(PC検証用): ← → / A D で左右移動。
//  DOM 依存は attach() 内に限定し、非ブラウザ環境でも import 可能。
// =============================================================================

import { CONFIG } from './config.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class InputController {
  constructor() {
    this.targetX = 0;
    this._half = CONFIG.lane.halfWidth;
    this._el = null;
    this._pointerActive = false;
    this._keyLeft = false;
    this._keyRight = false;
    this._keySpeed = 14; // キーボード移動速度 (units/s)
    this._handlers = null;
  }

  /** DOM 要素(canvas 等)へ入力リスナを接続する。省略時は window 全体。 */
  attach(element) {
    if (typeof window === 'undefined') return; // 非ブラウザ環境では何もしない
    const el = element || window;
    this._el = el;

    const onPointerDown = (e) => {
      this._pointerActive = true;
      this._setFromClientX(e.clientX);
    };
    const onPointerMove = (e) => {
      if (this._pointerActive) this._setFromClientX(e.clientX);
    };
    const onPointerUp = () => {
      this._pointerActive = false;
    };
    const onTouchMove = (e) => {
      if (e.touches && e.touches.length) {
        this._pointerActive = true;
        this._setFromClientX(e.touches[0].clientX);
        if (e.cancelable) e.preventDefault();
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this._keyLeft = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this._keyRight = true;
    };
    const onKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this._keyLeft = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this._keyRight = false;
    };

    if (typeof window.PointerEvent !== 'undefined') {
      el.addEventListener('pointerdown', onPointerDown, { passive: true });
      el.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
    } else {
      el.addEventListener('touchstart', onTouchMove, { passive: false });
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onPointerUp, { passive: true });
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    this._handlers = { el, onPointerDown, onPointerMove, onPointerUp, onTouchMove, onKeyDown, onKeyUp };
  }

  /** リスナを解除する。 */
  detach() {
    if (!this._handlers || typeof window === 'undefined') return;
    const h = this._handlers;
    h.el.removeEventListener('pointerdown', h.onPointerDown);
    h.el.removeEventListener('pointermove', h.onPointerMove);
    window.removeEventListener('pointerup', h.onPointerUp);
    h.el.removeEventListener('touchstart', h.onTouchMove);
    h.el.removeEventListener('touchmove', h.onTouchMove);
    window.removeEventListener('touchend', h.onPointerUp);
    window.removeEventListener('keydown', h.onKeyDown);
    window.removeEventListener('keyup', h.onKeyUp);
    this._handlers = null;
  }

  /** 毎フレーム呼び出し。キーボード入力による移動を反映する。 */
  update(dt) {
    if (this._pointerActive) return; // ポインタ操作中はキー入力を無視
    const dir = (this._keyRight ? 1 : 0) - (this._keyLeft ? 1 : 0);
    if (dir !== 0) {
      this.targetX = clamp(this.targetX + dir * this._keySpeed * dt, -this._half, this._half);
    }
  }

  _setFromClientX(clientX) {
    let nx;
    if (this._el && this._el.getBoundingClientRect) {
      const rect = this._el.getBoundingClientRect();
      nx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    } else {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1;
      nx = clientX / w;
    }
    this.targetX = clamp((nx * 2 - 1) * this._half, -this._half, this._half);
  }

  reset() {
    this.targetX = 0;
    this._pointerActive = false;
    this._keyLeft = false;
    this._keyRight = false;
  }
}
