# Number Gate Runner (3Dランナーゲーム プロトタイプ)

Three.js を使用した、数値ゲート式 3D ランナーゲームのプロトタイプです。
本プロジェクトは、**コアロジック層（Core Logic Layer）**と**描画・UI層（Visual/UI Layer）**が明確に分離された設計となっています。

外部パッケージをインストールすることなく、ローカルの静的サーバーを起動するだけでブラウザから直接プレイできます（Three.js は `src/vendor/` にバンドルされています）。

---

## 🚀 起動方法

### ローカルサーバーの起動

```bash
# npm を使用する場合
npm run serve

# または python を使用する場合
python3 -m http.server 5173
```

サーバー起動後、ブラウザで `http://localhost:5173` にアクセスしてください。

### テストの実行

Node.js 環境でコアゲームロジックのシミュレーションと単体テスト（スモークテスト）を実行します。

```bash
npm test
```

---

## 📁 ディレクトリ構成

- `index.html`: ブラウザの動作エントリーポイント
- `src/core/`: ゲームルール、プレイヤー、敵、弾丸、ゲート、衝突判定、オブジェクトプール、入力処理などのコアロジック
- `src/visual/`: Three.js を用いた 3D レンダリング、パーティクル、CSS / HTML による UI 表示
- `src/vendor/three.module.js`: ローカルで動作させるためにベンダーインされた Three.js モジュール
- `tests/smoke.mjs`: コアロジック層の挙動（衝突、スコア、状態遷移等）を検証する Node.js 用テストスクリプト

---

## ⚙️ 結合仕様（Core ⇄ Visual インターフェース）

描画層は `window.gameState` からデータを読み取って画面を描画します。ゲームのルール、衝突判定、オブジェクトの生成・消滅処理などはすべてコアロジック層が担当し、描画層はゲーム状態を直接書き換えません。

### 1. ゲーム状態（`window.gameState`）

描画層は毎フレーム `window.gameState` の内容を参照します（すべて読み取り専用です）。

```js
window.gameState = {
  status: 'playing',       // ゲーム状態: 'ready' | 'playing' | 'paused' | 'gameover'
  isPaused: false,        // 一時停止フラグ（true のとき描画は継続、ロジックは停止）
  score: 120,             // 現在のスコア
  wave: 2,                // 現在のウェーブ数
  player: {
    id: 'p1',
    x: 0, y: 0, z: 4,     // 座標（朝顔状のレーン移動。z 座標はプレイヤーの固定位置）
    value: 12,            // プレイヤーの主数値（弾数・攻撃力に影響）
    shotCount: 6,         // 1回あたりの同時発射数
    fireRate: 5,          // 連射速度 (volleys/s)
    bulletPower: 2,       // 弾1発あたりの威力
    weapon: 'rifle'       // 現在の武器: 'rifle' | 'machinegun' | 'bazooka' | 'rocket'
  },
  bullets: [
    { id: 'b1', x: 0, y: 0, z: -4, power: 3, kind: 'rifle', radius: 0.3 }
  ],
  enemies: [
    { id: 'e1', x: 1, y: 0, z: -14, hp: 20, maxHp: 30, kind: 'tank', radius: 1.7 }
  ],
  gates: [
    { id: 'g1', x: -2, y: 0, z: -8, operator: 'multiply', value: 2, weapon: null },
    { id: 'g2', x: 2, y: 0, z: -8, operator: 'weapon', value: 0, weapon: 'bazooka' }
  ],
  events: [
    // 発生したイベント（1フレームのみ保持され、エフェクトや効果音のトリガーに使用）
    // type: 'hit' | 'enemyKilled' | 'gate' | 'playerHit' | 'explosion' | 'gameover'
    { type: 'explosion', x: 0, y: 0, z: -4, radius: 3.4, kind: 'bazooka' }
  ]
};
```

> [!NOTE]
> オブジェクトはプール管理されているため、不要になったオブジェクトは `active: false` になるか配列から削除されます。id は生存期間中固定されるため、描画オブジェクトのマッピングキーとして使用可能です。

### 2. コアの制御 API（`window.GameAPI`）

描画層や外部デバッグツールからゲームの挙動を操作するために、以下の API がグローバルに公開されています。

- `window.GameAPI.start()`: ゲームの開始 / リスタート
- `window.GameAPI.reset()`: 状態の初期化
- `window.GameAPI.pause()`: ゲームの一時停止
- `window.GameAPI.resume()`: 一時停止の解除
- `window.GameAPI.togglePause()`: 一時停止/再開の切り替え（グローバル関数 `window.togglePause()` からも呼び出し可能）
- `window.GameAPI.attachInput(element)`: 入力（スワイプ/キー）を受け取る基準となる DOM 要素を設定（デフォルトは `window`）
- `window.GameAPI.setRenderHook(function(state, dt) {})`: コアロジックが更新された後に実行する描画更新用のコールバックを設定

### 3. コアへ通知するカスタムイベント

UIパーツ（STARTやRETRYボタンなど）のインタラクションからコアを制御するために、以下の CustomEvent を `window` にディスパッチします。

- `'visual:start-requested'`: ゲーム開始またはリスタート要求
- `'visual:restart-requested'`: リスタート要求
- `'visual:pause-requested'`: ポーズの切り替え要求

---

## 🎮 ゲームシステム仕様

### 🚪 ゲート演算子（`gate.operator`）

プレイヤーがゲートを通過した際の適用ルール：
- `add`: プレイヤーの数値を `value` 分加算します。
- `subtract`: プレイヤーの数値を `value` 分減算します。
- `multiply`: プレイヤーの数値を `value` 倍にします。
- `divide`: プレイヤーの数値を `value` 分の1にします（小数点以下切り捨て）。
- `weapon`: プレイヤーの武器を `gate.weapon` に切り替えます（`value` は無視されます）。

### 🔫 プレイヤーの武器（`player.weapon`）

武器ごとに特性（攻撃速度・ダメージ・範囲など）が変化します。

1. **ライフル (`rifle`)**
   - 特徴：堅実な万能銃。単発の弾が速く、最大2体の敵を貫通する。
2. **マシンガン (`machinegun`)**
   - 特徴：超高速連射。1発の威力は低いが、弾を扇状に広範囲にばら撒く。
3. **バズーカ (`bazooka`)**
   - 特徴：低速連射・超高威力。着弾時に広範囲の爆風（スプラッシュダメージ）を発生させる。
4. **ロケットランチャー (`rocket`)**
   - 特徴：中威力のロケットを複数同時発射し、中範囲の爆風を発生させる面制圧向け武器。

### 👾 敵のタイプ（`enemy.kind`）

ウェーブの進行に伴い、出現率や同時出現数が増加します。

- `normal`: 標準的な敵。
- `tank`: 巨大で移動速度は遅いが、HPが非常に高く、プレイヤーの背後に突破された際のダメージ（breach damage）が大きい。
- `rusher`: 小型でHPは低いが、移動速度が極めて速く、突破された際のダメージも大きい。
- `weaver`: 左右にヘビのように蛇行しながらプレイヤーに向かって進む。
