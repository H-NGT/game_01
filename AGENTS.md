# Repository Guidelines

## Project Structure & Module Organization

This repository is a small browser game prototype with a separated core logic layer and visual layer.

- `index.html` is the browser entry point.
- `src/core/` contains game rules, state updates, collision, pooling, gates, enemies, bullets, player logic, and input handling.
- `src/visual/` contains Three.js rendering and CSS.
- `src/vendor/three.module.js` is vendored so the app can run without installing packages.
- `tests/smoke.mjs` exercises core behavior in Node without a browser.

Keep gameplay rules in `src/core/`; visual code should consume `window.gameState` and dispatch events rather than own game rules.

## Build, Test, and Development Commands

- `npm test` runs the Node smoke test in `tests/smoke.mjs`.
- `npm run serve` starts a local static server on port `5173`.
- `python3 -m http.server 5173` is the equivalent manual serve command.

After serving, open `http://localhost:5173` to play or inspect the prototype. There is no package install requirement for the current codebase.

## Coding Style & Naming Conventions

Use modern JavaScript ES modules (`import`/`export`) and keep files focused by domain. Existing code uses two-space indentation, semicolons, `const`/`let`, and descriptive camelCase names such as `createPlayer`, `resolveBulletEnemy`, and `recomputeStats`.

Prefer small pure functions in core modules. Use object pools where lifecycle churn matters, and keep IDs stable for pooled render data. Do not replace the vendored Three.js module with a package dependency unless the project intentionally adopts a build step.

## Testing Guidelines

The test suite is currently a smoke test written as a Node script. Add coverage to `tests/smoke.mjs` for gameplay regressions, especially state transitions, collision behavior, gate effects, weapon behavior, pause/reset, and game-over conditions.

Run `npm test` before submitting changes. Name assertions clearly so failures explain the affected behavior.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit prefixes, for example `feat:` and `fix:`, with concise Japanese descriptions. Continue that pattern: `feat: 新しい武器ゲートを追加` or `fix: ポーズ中の入力更新を停止`.

Pull requests should include a short behavior summary, test results (`npm test`), and screenshots or screen recordings for visual/UI changes. Link related issues when applicable and call out any changes to the visual/core state contract.

## Agent-Specific Instructions

Before editing, check for existing user changes and avoid reverting unrelated work. Keep changes scoped to the requested behavior and preserve the core/visual separation described above.
