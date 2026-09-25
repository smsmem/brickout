# BrickOut – Meshy ROUND 2 generation log
Run: 2026-09-24. Tool: Meshy web (Text-to-3D, Meshy 6), preview → remesh (quad) → texture/refine (PBR on, 2K).
Delivered to: Dropbox /Phantom/Current Gaming/BrickOut/art/round2/ and GitHub smsmem/brickout, folder art/ (flat).

## Credits
- Start: 1,375 (1,225 paid/free + 150 share credits)
- End: 435 displayed (235 + 200 share credits; Meshy added +50 share credits during the run)
- Spent: ~990 credits of generation balance
  - 34 text-to-3D drafts at 20 = 680 (9 props + 6 prop re-rolls; 5 characters x up to 4 attempts)
  - 31 texture passes at 10 = 310 (16 brick retextures incl. retries, 14 refines, 1 alarm_light re-texture)
  - 5 auto-rigs (5 each) + 13 library clips (3 each); remesh is free
  - Estimate before start was ~570–750; overrun came from character re-rolls (A-pose/likeness) and brick texture retries.

## Files (22 GLB + 22 PNG + this log = 45)
| File | Source | Tris (quad faces) |
|---|---|---|
| brick_std_redbrick_v2 | retexture of round-1 brick_std mesh | 6,263 (3,138) |
| brick_L_redbrick_v2 | retexture of round-1 brick_L (redo) mesh | 6,428 (3,214) |
| brick_cinder_redbrick_v2 | retexture of round-1 brick_cinder mesh | 5,502 (2,752) |
| brick_std_granite_b | retexture of brick_std mesh | 6,263 (3,138) |
| brick_std_redbrick_b | retexture of brick_std mesh | 6,263 (3,138) |
| brick_std_cinder_b | retexture of brick_std mesh | 6,263 (3,138) |
| brick_std_sandstone_b | retexture of brick_std mesh | 6,263 (3,138) |
| brick_std_dungeon_b | retexture of brick_std mesh | 6,263 (3,138) |
| walkway_tile | new | 7,133 (3,576) |
| walkway_tile_cracked | new | 6,208 (3,104) |
| walkway_debris | new | 3,644 (1,833) |
| cell_front | new | 8,328 (4,196) |
| cell_interior_kit | new | 8,758 (4,472) |
| alarm_light | new | 10,910 (5,599) |
| soap_bar | new | 5,148 (2,574) |
| playing_cards | new | 10,703 (5,517) |
| flashlight_v2 | new | 6,196 (3,170) |
| prisoner_b | new, rigged + clips | 18,966 (9,485) |
| prisoner_c | new, rigged + clips | 19,160 (9,583) |
| prisoner_d | new, rigged + clips | 18,754 (9,382) |
| guard_v2 | new, rigged + clips | 17,929 (8,967) |
| prisoner_v2 | new, rigged + clips (optional item) | 20,706 (10,391) |
Remesh target was 3,000 quad faces for props (10,000 for characters); Meshy's result lands at ~3–5.6k faces on busier props.

## Animation clips (all in one GLB per character, Mixamo skeleton, 30 fps; each file also contains a "restpose" clip)
- Rigging: Meshy humanoid auto-rig. **No finger-bone option is offered** in the rig flow; the skeleton only has end bones (e.g. mixamorig:LeftHandMiddle4), no articulated fingers.
- Meshy auto-rig always adds Walking + Running; these are included in every file.
- prisoner_b / prisoner_c / prisoner_d: Idle_02 (see note), Cheer_with_Both_Hands_Up (Cheering), Pull_Radish (Grab/Pull; there is no Tug-of-War clip), Wave_One_Hand (Waving), + Walking, Running.
  - Note: the plain "Idle" clip (library id 0) is rejected by Meshy's API ("Invalid animation selection 0"), so Idle_02 was used instead.
- guard_v2: Walking, Fall1 (Falling), Hang_and_Push_with_Foot (closest to Struggling/Kicking; no dedicated struggle/wriggle clip exists), Running.
- prisoner_v2: Running, Cheer_with_Both_Hands_Up (Cheering), + Walking.

## Retries / re-rolls
- brick redbrick textures: std_v2 x2, L_v2 x3, cinder_v2 x3, std_redbrick_b x3, granite_b x2 (texture prompts pushed harder each time).
- walkway_tile x3 drafts (1st came out as a brick wall panel), walkway_debris x3 (1st was a single plate), flashlight_v2 x3 (1st had a clip handle and cord).
- Characters: prisoner_b/c/d and guard_v2 4 drafts each, prisoner_v2 3 drafts (pose/likeness issues).
- alarm_light re-textured once (first texture printed fake text "PRION" on the base).

## Off-spec items (please review)
- **Red brick v2 course count — NOT met.**
  - brick_std_redbrick_v2: face reads as 2 rows (so 2 courses), but the round-1 brick_std mesh has sculpted seams that split the TOP row in two and put an off-centre split in the BOTTOM row. The texture follows those seams, so it is not "one full brick on top, two halves split in the centre". Rotating the brick 180° in-engine gets closer (top = one near-full brick).
  - brick_L_redbrick_v2 and brick_cinder_redbrick_v2: still show many small courses (~7–9) instead of 4. Meshy's texturer ignored the brick scale across 3 attempts. Needs a hand-painted texture or a new mesh with modelled brick seams.
  - brick_std_redbrick_b: same seam-driven 2-row look as v2.
- _b variants: "different stone arrangement" can only differ in texture, since the spec requires the existing brick_std mesh (same sculpted seams).
- brick_std_granite_b: now neutral grey with fine speckle and a faint cool tint — NOT pink (fixed).
- walkway_tile: plate with panels/rivets; the diamond-plate pattern is faint in the texture.
- alarm_light: red dome on a grey block; the wall bracket is minimal. 10.9k tris (over the ~6k prop target).
- playing_cards: 10.7k tris (over target).
- Characters are not a clean 45° A-pose; Meshy's pose mode gave arms at about 20–40° with bent elbows (guard_v2 has arms closer to the body). All rigged successfully.
- guard_v2: round belly and flashlight in right hand present; slightly slimmer-faced than round-1 guard.
- prisoner_c: grey ponytail is small; glasses present.
- prisoner_v2: re-generated (not re-rigged from the round-1 mesh), because the round-1 mesh was in T-pose; the likeness is close but not identical.
