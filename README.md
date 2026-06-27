# game_01

Three.js based visual/UI layer for a number gate runner prototype. The Three.js
module is vendored under `src/vendor/` so the prototype runs from a local static
server without a package install.

## Run

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Integration

The visual layer reads from `window.gameState` and does not own game rules,
collision, gate calculations, or array lifecycle. The expected shape is tolerant:

```js
window.gameState = {
  status: 'playing',
  score: 120,
  wave: 2,
  player: { x: 0, y: 0, z: 3.2, value: 12 },
  bullets: [{ id: 'b1', x: 0, y: 0, z: -4 }],
  enemies: [{ id: 'e1', x: 1, y: 0, z: -14, hp: 20, maxHp: 30 }],
  gates: [{ id: 'g1', x: -2, y: 0, z: -8, operator: 'multiply', value: 2 }]
};
```

Items with `active: false` are ignored, so pooled arrays can be passed directly.
Gate operators support `add`, `subtract`, `multiply`, and `divide`.

Start/restart buttons dispatch `visual:start-requested` and
`visual:restart-requested` CustomEvents so the logic layer can subscribe without
the visual layer mutating core game state.
