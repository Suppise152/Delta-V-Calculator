# Canonical Node Model

This is the normalization layer the calculator should target going forward.

## Node semantics

- `land`
  - Surface of the body.
- `orbit`
  - Circular low orbit above the body.
  - Default altitude is `10 km` above the surface or atmosphere.
  - Packs may override the low-orbit altitude per body when the source map uses a different convention.
- `flyby` / `intercept`
  - Hyperbolic periapsis at the body.
  - Periapsis defaults to `10 km` above the surface or atmosphere.
  - Apoapsis is treated as the SOI edge or just beyond it.

## Design goal

The solver should compute the cost to move between physical states rather than fitting hardcoded map labels.

That gives us:

- consistent costs regardless of origin
- symmetric propulsive branch costs where the branch represents the same two states in either direction
- pack extensibility through data rather than calculator rewrites

## Shared data source

Each pack JSON now carries its own canonical physical data alongside the map layout and labels.

That includes:

- body radius
- body standard gravitational parameter (`mu`)
- atmosphere height
- canonical node-model settings per pack

Examples:

- [stock.json](</c:/Users/Timca/GitHub/Delta-V-Calculator/data/stock.json>)
- [opm.json](</c:/Users/Timca/GitHub/Delta-V-Calculator/data/opm.json>)
- [rss.json](</c:/Users/Timca/GitHub/Delta-V-Calculator/data/rss.json>)

The calculator should only need to look inside the currently loaded pack JSON for the bodies involved in a route.
