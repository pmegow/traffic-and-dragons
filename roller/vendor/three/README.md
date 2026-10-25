# vendor/three — three.js r186 (0.186.1), vendored

The renderer's only dependency, copied byte for byte from the npm tarball
`https://registry.npmjs.org/three/-/three-0.186.1.tgz`, whose integrity matched the registry's
`sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==`
on 2026-10-24.

| File | From the package | sha256 |
|---|---|---|
| `three.module.js` | `build/three.module.js` | `9052042d676cb0fdc1ddfefe193053f34b7ac0513a616fdac4535d49987812ea` |
| `three.core.js` | `build/three.core.js` | `9edde002b066a9a05676a6127f67735b62baf399bdea529f2f7e31657da769e6` |
| `addons/environments/RoomEnvironment.js` | `examples/jsm/environments/RoomEnvironment.js` | `55f466192cc84298755a424c5e040345006b2ee1455589b3b54126c2ea4123f4` |
| `LICENSE` | `LICENSE` (MIT) | `8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc` |

Pages map the bare specifier `three` to `three.module.js` and `three/addons/` to `addons/` with an
import map — three.js's own convention — so a host that already ships three.js maps both to its
own copy instead. `test/vendor.test.js` pins these hashes:
an upgrade changes the files and this table in the same commit.
