# BrickOut – Meshy generation log
Run: 2026-09-23 (evening, local time)

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
Step 1 base bricks were textured "neutral grey stone" but are not part of the delivered set, per the 32-file spec.

## Delivered (30 of 32 GLBs)
| File | Folder | Tris (quad faces) |
|---|---|---|
| brick_std_<look>.glb ×5 | bricks/<look>/ | 6,263 (3,138) |
| brick_double_<look>.glb ×5 | bricks/<look>/ | 6,545 (3,309) |
| brick_half_<look>.glb ×5 | bricks/<look>/ | 5,590 (2,796) |
| brick_L_<look>.glb ×5 | bricks/<look>/ | 6,200 (3,107) |
| brick_cinder_<look>.glb ×5 | bricks/<look>/ | 5,502 (2,752) |
| brick_gold.glb | bricks/special/ | 4,658 (2,346) |
| brick_cracked.glb | bricks/special/ | 5,808 (2,907) |
| rubble_set.glb | bricks/special/ | 4,955 (2,562) |
| flashlight.glb | props/ | 5,364 (2,682) |
| poster.glb | props/ | 5,452 (2,732) |

## NOT delivered yet (blocked)
- chars/prisoner.glb (18,513 tris, rigged, Running clip) and chars/guard.glb (19,078 tris, rigged, Walking clip). Both are done in Meshy. Chrome stopped saving downloads at about 02:59 UTC.
- All 32 preview PNGs: same cause.
- Probable cause: Chrome's "download multiple files" permission for meshy.ai / assets.meshy.ai is blocked or waiting for an answer, or Dropbox sync of "/Chrome Downloads" has stopped.
- Leftovers in /Chrome Downloads to delete: prisoner.glb (72 KB) and guard.glb (83 KB) are animation-only files with no mesh, and brick_std_granite.png (146 B) is an error file. All three are unusable.

## Retries
- Step 1 bricks: the first drafts of all 5 shapes came out as multi-stone wall panels rather than single blocks. Each was re-rolled once with the same prompt, and the better of the two was kept:
  - brick_std: kept draft 1. brick_double: kept draft 2. brick_half: kept draft 1. brick_L: kept draft 1. brick_cinder: kept draft 2.
- No refine or retexture failed. Every task succeeded on the first try.

## Flags (off-style / off-proportion)
- brick_std: square face, but it reads as 4 stones (cross-shaped seams). Depth/face ≈ 0.49 (spec 0.6).
- brick_double: reads as a small wall of about 8 stones. Ratio ≈ 2.7:1 instead of 2:1. Off-proportion.
- brick_half: two chunks side by side rather than one half-block. Ratio doesn't match 0.5:1. Off-proportion.
- brick_L: came out as a 2×2 block of 4 cells, **not an L**. Off-shape. Needs a regeneration (a multi-view/image-to-3D input will probably be needed).
- brick_cinder: square face OK, but depth ≈ 0.78 of face height (spec 0.3 for a 2×2×0.6 block). Too thick.
- Granite look: came out **pink/rose**, not mauve-grey. brick_half_granite came out pale grey instead, so the set is inconsistent. Off-style.
- brick_gold, brick_cracked (glowing orange cracks present), rubble_set (more than 8 chunks, about 20 small pieces), sandstone, redbrick, cinder, dungeon: on-style.
- flashlight: the lens ring is a separate floating piece in front of the body.
- poster: OK. Palm tree is modelled in relief, and the tacks are not clearly visible.
- prisoner: arms nearly horizontal (closer to T-pose than A-pose), reads young and slim. Jumpsuit, number patch and sneakers OK.
- guard: **no flashlight in hand and no round belly**. Arms near-horizontal.
