# Booth Forge delivery checkpoint — 2026-09-17

Owner: Codex Booth Forge worker, isolated branch `repair/booth-exports-20260917` from `7c93c51`. Original checkout and four alternate untracked files untouched.

| User workflow | Evidence | Remaining |
| --- | --- | --- |
| Generate layout | Local missing-provider request displays truthful configuration message; all five AI routes return 503 before provider invocation when key absent | Actual provider credentials/model compatibility and paid generation not tested |
| View fixture layout | Browser intercepted generation response with a six-by-four-metre fixture; 3D canvas and SVG floor plan displayed without page errors | Validate representative real generated designs and aesthetic/layout fidelity |
| SVG output | XML text escaped, colors restricted to hex, geometry checked, sort no longer mutates source | SVG is a plan approximation; not verified fabrication drawing |
| Ruby output | Untrusted labels escaped, Ruby interpolation disabled, generated IDs made safe, invalid numbers rejected; fixture and hostile-label script pass Ruby syntax-only checks | SketchUp geometry execution deliberately not performed |
| Download GLB | Browser downloaded 8,020-byte GLB; valid GLB v2 header/length and four meshes | Import into target downstream software |
| Download USDZ | Browser downloaded 15,192-byte archive; ZIP CRC and USD scene validated | Target software/device import |
| Unready model | Export callbacks now report loading error rather than silently returning | GPU/device-specific behavior beyond local Chrome remains unverified |

Validation: production build; four unit/geometry/export regression checks; installed-Chrome browser fixture generation, Ruby/GLB/USDZ downloads, floor-plan display, no page errors. No paid provider calls, SketchUp script execution, live scenes, database changes or explicit deployment.

Run `npm test` (requires Ruby for syntax-only test), `npm run build`, then local production server on port4327. Optional browser runner: `PLAYWRIGHT_MODULE=/path/to/@playwright/test node tests/browser-exports.cjs`; requires installed Chrome and fixture file produced by unit tests. It intercepts `/api/generate`; it is fixture evidence, not proof of live provider generation.

No main merge. Branch push must be read back by exact SHA; hosting/provider setup is still an operational acceptance gate.
