# BrickOut – Meshy generation log
Run: 2026-09-23/24. Supersedes generation_log_v1_superseded.md.

## Status: COMPLETE. 32/32 GLBs and 32/32 preview PNGs delivered.

## Credits
- Starting balance: 2,295 (includes 150 share credits)
- Ending balance: 1,575
- Used: 720
  - 17 drafts at 20 = 340 (12 base models plus 5 brick re-rolls)
  - 13 texture/refine passes at 10 = 130 (12 refines plus one early test texture on the brick_std draft that wasn't used)
  - 25 retextures at 10 = 250
  - Remesh (quad) cost 0. Rigging with built-in walk/run clips appears to have been included; no separate animation charge.

## Pipeline used
Text-to-3D draft (Meshy 6), then Remesh to quad (props/bricks target 3,000 faces, characters 10,000 faces), then Texture/refine with PBR on (2K), with the global style prefix and the spec prompt.
Each Step 2 retexture = Meshy texture pass on the *remeshed step-1 mesh*, so the geometry is identical across all 5 looks of a shape.
Characters: Meshy auto-rig (humanoid). Exported as a single GLB with the rigged mesh and one clip (prisoner = Running, guard = Walking), Mixamo skeleton, 30 fps.

## Delivered
| File | Folder | Tris (quad faces) |
|---|---|---|
| brick_std_<look>.glb/.png ×5 | bricks/<look>/ | 6,263 (3,138) |
| brick_double_<look>.glb/.png ×5 | bricks/<look>/ | 6,545 (3,309) |
| brick_half_<look>.glb/.png ×5 | bricks/<look>/ | 5,590 (2,796) |
| brick_L_<look>.glb/.png ×5 | bricks/<look>/ | 6,200 (3,107) |
| brick_cinder_<look>.glb/.png ×5 | bricks/<look>/ | 5,502 (2,752) |
| brick_gold | bricks/special/ | 4,658 (2,346) |
| brick_cracked | bricks/special/ | 5,808 (2,907) |
| rubble_set | bricks/special/ | 4,955 (2,562) |
| flashlight | props/ | 5,364 (2,682) |
| poster | props/ | 5,452 (2,732) |
| prisoner (rigged, Running) | chars/ | 18,513 (9,260) |
| guard (rigged, Walking) | chars/ | 19,078 (9,545) |
Looks: granite, redbrick, cinder, sandstone, dungeon.

## Download issues and workaround
- Around 02:59 UTC Chrome stopped saving further downloads from the same Meshy tab. This was Chrome's "download multiple files" block, not Dropbox sync. Once downloads started again, files reached /Chrome Downloads within about 2 seconds.
- Workaround: each remaining file was downloaded from its own fresh tab (one download per page), then the tab was closed. All 34 remaining files (2 GLBs + 32 PNGs) arrived.
- The first character exports (Meshy "Animation_*_withSkin.glb", ~75 KB) contained only the skeleton and animation with no mesh. They were replaced by full rigged-mesh GLBs (~11–12 MB).
- Leftovers still in /Chrome Downloads, which can be deleted: prisoner.glb (72 KB), guard.glb (83 KB), brick_std_granite.png (146 B error file).

## Retries
- Step 1 bricks: the first drafts of all 5 shapes came out as multi-stone wall panels. Each was re-rolled once with the same prompt, and the better of the two was kept (std: draft 1, double: draft 2, half: draft 1, L: draft 1, cinder: draft 2).
- No refine or retexture failed.

## Flags (off-style / off-proportion). Not redone yet, per instruction.
- brick_std: square face, but it reads as 4 stones. Depth/face ≈ 0.49 (spec 0.6).
- brick_double: small wall of about 8 stones. Ratio ≈ 2.7:1 instead of 2:1.
- brick_half: two chunks side by side rather than one half-block.
- brick_L: a 2×2 block of 4 cells, **not an L**. Needs regeneration.
- brick_cinder: depth ≈ 0.78 of face height (spec 0.3). Too thick.
- Granite look: came out **pink/rose**, not mauve-grey. brick_half_granite came out pale grey, so the set is inconsistent.
- rubble_set: about 20 chunks instead of 6–8.
- flashlight: the lens ring floats as a separate piece.
- prisoner: arms nearly horizontal (closer to T-pose than A-pose), reads young and slim.
- guard: no flashlight in hand and no round belly. Arms near-horizontal.
- On-style: brick_gold, brick_cracked, poster, and the redbrick/cinder/sandstone/dungeon looks.
