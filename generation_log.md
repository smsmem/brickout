# BrickOut – Meshy generation log
Run: 2026-09-23/24. Supersedes generation_log_v1_superseded.md and generation_log_v2_superseded.md.

## Status: COMPLETE. 32/32 GLBs and 32/32 preview PNGs delivered. brick_L was redone on 2026-09-24 (see below).

## Credits
- Starting balance: 2,295 (includes 150 share credits)
- After main run: 1,575 (720 used)
- After brick_L redo: 1,375 (200 used)
- Total used: 920
  - Main run: 17 drafts at 20 = 340, 13 texture/refine passes at 10 = 130, 25 retextures at 10 = 250. Remesh cost 0. Rigging appears to have been included.
  - brick_L redo: 7 drafts at 20 = 140, 1 refine at 10 = 10, 5 retextures at 10 = 50. Remesh cost 0.

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
| brick_L_<look>.glb/.png ×5 (REDONE) | bricks/<look>/ | 6,428 (3,214) |
| brick_cinder_<look>.glb/.png ×5 | bricks/<look>/ | 5,502 (2,752) |
| brick_gold | bricks/special/ | 4,658 (2,346) |
| brick_cracked | bricks/special/ | 5,808 (2,907) |
| rubble_set | bricks/special/ | 4,955 (2,562) |
| flashlight | props/ | 5,364 (2,682) |
| poster | props/ | 5,452 (2,732) |
| prisoner (rigged, Running) | chars/ | 18,513 (9,260) |
| guard (rigged, Walking) | chars/ | 19,078 (9,545) |
Looks: granite, redbrick, cinder, sandstone, dungeon.
The previous brick_L files are kept as brick_L_<look>_old.glb / _old.png in each bricks/<look>/ folder.

## brick_L redo (2026-09-24)
- Previews were checked before refining. 7 drafts in total; only draft 4 was a true L.
  - Draft 1 (prompt A, "three equal square cells… capital letter L"): a cube-like block. Not an L.
  - Drafts 2–3 (prompt B, "thin flat slab… tetris L-piece"): a U/step shape and a flat slab. Not an L.
  - Drafts 4–7 (prompt C, "stone letter L standing upright… vertical column two blocks tall on the left, one block attached to the right of the bottom block"): draft 4 = **true L** (kept). Draft 5 = a frame, draft 6 = a ring of stones, draft 7 = a chair-like shape.
- Kept draft 4, then remeshed to quad (3,214 faces / 6,428 tris), refined (neutral grey), then retextured into 5 looks on the same mesh.
- Granite prompt pushed: "…predominantly grey stone with only a subtle muted mauve tint, low saturation, NOT pink, NOT rose, NOT red".
- No refine or retexture failures.
- Flags on the new brick_L:
  - It is a true L silhouette (2-cell column on the left, 1-cell foot on the right, empty top-right), and one solid piece.
  - Proportions are not exact. Bounding box ≈ 1.23 W × 1.90 H × 0.88 D (normalised). The foot is narrower than a full cell (a true 3-cell L would be 1:1 W:H), and depth is ≈ 0.93 of a cell (spec 0.6). The front face is mostly flat, with a faint seam between the two column cells.
  - Granite is now pale lilac-grey with fine speckle: much closer to mauve-grey than the earlier pink, but on the light side.
  - Dungeon moss is subtle.

## Download issues and workaround
- Chrome's "download multiple files" block stopped repeated downloads from the same tab. Fix: each file downloaded from its own fresh tab (one download per page), then the tab was closed. Dropbox sync was not the problem.
- Leftovers in /Chrome Downloads, which can be deleted: prisoner.glb (72 KB), guard.glb (83 KB), brick_std_granite.png (146 B).

## Retries (main run)
- Step 1 bricks: each shape re-rolled once with the same prompt (std: draft 1, double: draft 2, half: draft 1, L: draft 1 [now replaced], cinder: draft 2).
- No refine or retexture failed.

## Open flags (not redone, per instruction)
- brick_std: reads as 4 stones. Depth/face ≈ 0.49 (spec 0.6).
- brick_double: small wall of about 8 stones. Ratio ≈ 2.7:1 instead of 2:1.
- brick_half: two chunks rather than one half-block.
- brick_cinder: depth ≈ 0.78 of face (spec 0.3).
- Granite look on std/double/half/cinder: still the old pink/rose. Only brick_L_granite was redone.
- rubble_set: about 20 chunks instead of 6–8.
- flashlight: the lens ring floats as a separate piece.
- prisoner: arms nearly horizontal (closer to T-pose), reads young and slim.
- guard: no flashlight in hand and no round belly. Arms near-horizontal.
