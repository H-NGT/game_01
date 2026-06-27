// =============================================================================
//  pool.js  —  汎用オブジェクトプール (Object Pooling)
// -----------------------------------------------------------------------------
//  大量に生成/破棄される弾・敵・ゲートを GC 負荷なく再利用するための仕組み。
//   - 起動時に size 個を一括生成し、以後は active フラグで使用中/空きを管理。
//   - 各オブジェクトは安定した id (`prefix + slot`) を持つ。
//     描画層(Codex)は id をキーに Mesh をマッピングし、消滅時に Mesh を隠す。
// =============================================================================

export class ObjectPool {
  /**
   * @param {object}   opts
   * @param {number}   opts.size    プール容量
   * @param {string}   opts.prefix  id の接頭辞 (例: 'b','e','g')
   * @param {(slot:number)=>object} opts.create  空オブジェクト生成関数
   * @param {(obj:object, init:any)=>void} [opts.reset] 取得時の初期化関数
   */
  constructor({ size, prefix, create, reset }) {
    this.size = size;
    this.prefix = prefix;
    this.reset = reset || null;
    this.items = new Array(size);
    this._free = new Array(size); // 空きスロットのスタック
    for (let i = 0; i < size; i++) {
      const obj = create(i);
      obj.id = prefix + i;
      obj._slot = i;
      obj.active = false;
      this.items[i] = obj;
      this._free[i] = size - 1 - i; // 先頭スロットから順に確保されるよう逆順で積む
    }
    this._freeCount = size;
  }

  /** 空きスロットを1つ確保して返す。枯渇時は null。 */
  acquire(init) {
    if (this._freeCount === 0) return null;
    const slot = this._free[--this._freeCount];
    const obj = this.items[slot];
    obj.active = true;
    if (this.reset) this.reset(obj, init);
    return obj;
  }

  /** オブジェクトをプールへ返却する。 */
  release(obj) {
    if (!obj.active) return;
    obj.active = false;
    this._free[this._freeCount++] = obj._slot;
  }

  /** すべての使用中オブジェクトを一括返却する。 */
  releaseAll() {
    for (let i = 0; i < this.size; i++) {
      this.items[i].active = false;
      this._free[i] = this.size - 1 - i;
    }
    this._freeCount = this.size;
  }

  /** 使用中オブジェクトに対してコールバックを実行する。 */
  forEachActive(fn) {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].active) fn(items[i]);
    }
  }

  get activeCount() {
    return this.size - this._freeCount;
  }
}
