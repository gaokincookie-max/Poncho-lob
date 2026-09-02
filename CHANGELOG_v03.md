# POCHO LAB v0.3

- Added real-time Observation Play mode.
- Human mode: drag the loaded Pocho and release to launch in the opposite direction.
- AI mode: switches on the same board between Random / Strong / Weak / Center / Crowd launch strategies.
- Added live contact log showing NONE / STICK / POP, selected rule, relative speed, and all shadow-matched rules.
- Added observer CSV export.
- Exposed the same simulation world/condition engine to the observer, so human and AI use the same physics and behavior rules.
- Versioned frontend asset filenames (`lab_v03.js`, `data_v03.js`, `observer_v03.js`) to bypass stale GitHub Pages/Safari caches.
- Re-audited source: no `q.velocity`, `q.position`, `q.speed`, or `q.mass` metadata/body mixups remain in executable JS.
