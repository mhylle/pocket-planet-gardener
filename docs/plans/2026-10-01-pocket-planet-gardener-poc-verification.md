# Pocket Planet Gardener PoC — verification record

Evidence for the acceptance criteria that need more than a unit or e2e spec: manual checklists, audits and measurements. The plan is `2026-10-01-pocket-planet-gardener-poc.md`; its section 9 is the progress log.

Live checks run against the local dev servers. A check marked **pending (live)** could not run yet because the servers were down; its spec-level evidence is listed beside it.

## SET-04 — Colour independence (Task 16.4)

AC1: every status shows an icon, words or both, as well as any colour. Spec paths are under `frontend/src/app/`.

**Specs.**
- `core/helpers/status-text.spec.ts` finds every table and single status that `status-text.ts` exports by its shape, so a new one is checked without being listed. It checks all 24 entries across the 10 exports for a non-empty icon and text, and that every status a creature card can show has its own icon (30 tests).
- `ui/status-icon/status-icon.component.spec.ts` renders each of the 20 `StatusIcon` values. The list is type-checked against the union, so adding or removing a value fails compilation. Each renders as a hidden SVG with at least one shape, and no two drawings are the same (21 tests).
- `ui/colour-independence.spec.ts` covers the statuses kept outside `status-text.ts`. The placement verdicts (`PLACEMENT_STATUS`, 5 reasons, 4 icons) and the cloud states (`cloudStatus`: raining, full, half full, low, empty, 5 icons) each have words and their own icon (7 tests).

**Status surfaces audited.**

| Status | Where | Colour | Icon | Words | Spec |
|---|---|---|---|---|---|
| Plant stage, seeds ready | Info card | — | seed, sprout, young, bloom, sparkle | "Sprout", "In bloom, seeds ready — tap it to collect them" | `ui/info-card/…spec.ts` |
| Water need | Info card | — | empty, low, full drop, puddle | "Thirsty — hold a cloud over it" etc. | same |
| Light need | Info card | — | sun, moon, sun with tick | "A bit too dark — drag the sun over it" etc. | same |
| Plant type's needs | Catalogue | — | drop, drops, sun, sun-cloud, moon | "Likes some water", "Likes full sun" | `ui/catalogue/…spec.ts` |
| Mood, wistful | Creature card | — | four faces | "Cheerful", "A bit wistful" | `ui/info-card/…spec.ts` |
| Napping on the night side | Creature card; in the scene it lies low under a "z" | — | moon | "Napping" | same |
| Want | Creature card | — | wish bubble | the creature's words, a plain description, or "No wish right now" | same |
| Placement validity | 3D ghost tinted green or red; placement HUD | ghost tint; refused text in `--danger-fg` | tick, crossed circle, drop, no-entry | "Free spot", "Something is already there", "That's water", "Planet is full", in a `role="status"` region shown whenever the ghost is | `ui/placement-hud/…spec.ts`, `ui/colour-independence.spec.ts` |
| Spot refused by the server | Placement HUD live region | danger border and text | — | the server's reason | `ui/placement-hud/…spec.ts` |
| Cloud water, rain | Sky list | — | full, half, low, empty drop; rain cloud | "full", "half full", "low", "empty", "raining" (also in its name) | `ui/sky-list/…spec.ts`, `ui/colour-independence.spec.ts` |
| Selected cloud, sun, garden object, inventory item | Sky list, garden list, inventory | accent | — | thicker border or inset ring, bold name, filled count; `aria-selected` / `aria-pressed` | sky-list, garden-list, inventory specs |
| Save state | Save indicator | — | cloud with slash, upload | "Offline — your changes will be saved when you're back", "Saving…" | `ui/save-indicator/…spec.ts` |
| Reload needed | Reload banner | — | — | "This planet changed on another device…" (`role="alert"`) | `ui/reload-banner/…spec.ts` |
| AI switch, saved | Admin page | lighter button when off | tick or no-entry circle; tick | "AI features are on/off", the saved line | `ui/admin/…spec.ts` |
| Form and chat errors | Name and code forms, budget, chat, settings | `--danger-fg` | — | the message in a live region; `aria-invalid` on the field | the component specs |
| Locked catalogue entry | Catalogue | muted, dashed border | plain silhouette | "Not found yet" and a hint | `ui/catalogue/…spec.ts` |
| Pip's target | Global `.pip-target` | accent glow | dashed outline, arrow | "Here!" | `ui/planet-page/…spec.ts` |
| Journal milestone | Journal page and book | accent pill | star | the milestone's words | `ui/journal-book/…spec.ts` |
| Who said a chat line | Chat panel | your lines on accent | your lines on the right, the creature's on the left; notices dashed | hidden "You:" / name before each line; "From the game" on notices | `ui/chat-panel/…spec.ts` |

**Grep audit.** I checked every class-bound state in the templates (`[class.*]`) and every state selector in the component SCSS: `.refused`, `.selected`, `[aria-pressed]`, `.error`, `button.danger`. Each one comes with an icon, words or a change of shape as well as its colour, so none needed a fix. The 3D-only cues are a drooping thirsty plant, sparkles on a ready bloom and a sleeping "z". All three are also in the cards as words (see NFR-05 below).

**Live: pending (live).** Take a Playwright screenshot of the planet view with:
- a hovered plant's info card: stage, water and light icons beside their words;
- the placement HUD on a refused spot: the crossed-circle icon and "Something is already there" beside the red ghost;
- the sky list with a full and an empty cloud.

Check that the icons show beside the colours at 100% and 200% zoom.

## SET-05 — Keyboard-only play (Task 16.5)

**Design.** The keyboard's surface cursor is the middle of the view. The keys turn the planet under it, and a ring marks it while the canvas has the keyboard focus. Enter plants, places or opens a card there. When the keyboard is used, the placement ghost moves back to the middle, even with the mouse resting on the canvas. This replaces the plan's separate `KeyboardSurfaceCursor`. Tab goes from the canvas to the garden list (one Tab stop, roving tabindex), then the sky list, Pip and the placement help, the inventory, the menu buttons and an open panel. `?` (or the Shortcuts button) lists every key.

AC1 — every verb with the keyboard alone. Spec paths are under `frontend/src/app/`.

| Verb | Keys | Spec evidence | Live |
|---|---|---|---|
| Rotate | Canvas focused: arrow keys or W A S D | `scene/camera-controls.service.spec.ts` "turns at a fixed rate while a key is held" | pending (live) |
| Zoom | Canvas focused: `+` / `=` in, `-` out | `scene/camera-controls.service.spec.ts` "zooms in with plus or equals and out with minus" | pending (live) |
| Select plants | Tab to the garden list; arrows, Home, End. The planet turns to the plant, which is ringed and read out ("Sunflower, in bloom, thirsty") | `ui/garden-list/garden-list.component.spec.ts` "is one Tab stop…", "rings the option moved to…" | pending (live) |
| Select creatures | As for plants ("Mira the moth, cheerful") | same specs | pending (live) |
| Select clouds and sun | Tab through the sky list | `ui/sky-list/sky-list.component.spec.ts` "selects, outlines and holds the cloud…" | pending (live) |
| Plant | Tab to the inventory, Enter on a seed. The focus moves to the canvas, and the page says politely "Turn the planet with the arrows, then press Enter to plant at the ring". Turn the planet, then Enter plants at the ring | `ui/planet-page/planet-page.component.spec.ts` "hands the keys to the planet once a seed is chosen…"; `ui/inventory-panel/inventory-panel.component.spec.ts` "says which kind of item was chosen…"; `scene/garden-input.service.spec.ts` "places at the middle of the view on Enter…", "brings the preview back to the middle of the view on a key…" | pending (live) |
| Water | Sky list: arrows move the cloud over the plant (the number of plants below it is read out); Space rains and Space again stops | `ui/sky-list/sky-list.component.spec.ts` "moves the selected cloud a step per arrow key…", "starts rain commands with Space…" | pending (live) |
| Move items | Decorations: open the card (garden list Enter, or canvas Enter at the ring), then Move; turn the planet; Enter puts it down. Plants cannot be moved by anyone: plant Move (GRD-07 AC2, a Should) is not in the game | `ui/info-card/info-card.component.spec.ts` "offers Move and Put away for a decoration"; `scene/garden-input.service.spec.ts` (Enter at the middle) | pending (live) |
| Open cards | Garden list: Enter or Space. Canvas: Enter on what is under the ring. Card actions (Collect seeds, Dig up, Put away) are buttons | `ui/garden-list/garden-list.component.spec.ts` "opens a creature's card on Enter…", "opens a plant's card on Space"; `ui/planet-page/planet-page.component.spec.ts` "opens a creature's card from the garden list with Enter, and the card leads on to chat" | pending (live) |
| Chat | Creature card: the focus lands on Chat; Enter opens the chat with the focus in the box; Enter sends, Shift+Enter starts a new line, Esc closes | `ui/planet-page/planet-page.component.spec.ts` (same test); `ui/info-card/info-card.component.spec.ts` "opens the creature's chat from the pinned card" | pending (live) |
| Use menus | Tab to Catalogue, Journal, Settings or Shortcuts; Enter opens; Tab goes on into the panel; Esc closes with the focus back on the button | `ui/planet-page/planet-page.component.spec.ts` "goes from the canvas to the garden list, then the sky, the inventory and the menus", "goes on from a menu button into the panel it opened", catalogue and journal Escape tests | pending (live) |
| Shortcut help | `?` anywhere except while typing; Esc closes, with the focus back | `ui/planet-page/planet-page.component.spec.ts` "opens the shortcut help on "?"…"; `ui/shortcut-help/shortcut-help.component.spec.ts` | pending (live) |

AC2 — selection is clearly highlighted:

| What is selected | Highlight | Spec evidence | Live |
|---|---|---|---|
| Garden list option | Accent border, bold name and focus outline in the list. In the scene, a steady dark blue ring (`#073b73`, at least 4.3:1 against every ground colour) with a white edge and an arrow above it; the ring follows a wandering creature | `ui/garden-list/garden-list.component.spec.ts` "rings the option moved to…"; `scene/selection-ring.service.spec.ts`, including "stands out at 3:1 or better against every colour of the ground" | pending (live) |
| Cloud or sun | Outline in the scene, accent border in the list | `ui/sky-list/sky-list.component.spec.ts` | pending (live) |
| Inventory item | Thick accent border, filled count, `aria-pressed` | `ui/inventory-panel/inventory-panel.component.spec.ts` | pending (live) |
| Canvas cursor | Ring in the middle of the view while the canvas has keyboard focus (global `.keyboard-cursor`) | CSS only; no jsdom layout | pending (live) |

Known limits: a card's Escape and its actions send the focus to the canvas, not back to the garden list. One Tab returns there, to the same option. Choosing an item in the inventory sends the focus to the canvas (see Plant), so no Shift+Tab is needed. The canvas's accessible name ends "Enter acts at the middle of the view; press ? for all keys" (`scene/planet-view/planet-view.component.spec.ts`).

Live check: whether NVDA/JAWS in browse mode pass the arrow keys to the canvas (role img); if not, consider role application.

## NFR-05 — WCAG 2.1 AA (Task 16.6)

AC: an accessibility check of the 2D interface finds no AA failures, and the information shown in the 3D view is also in a card as text. Spec paths are under `frontend/src/app/`.

**Method.** `axe-core` 4.14 is a frontend dev dependency. `testing/axe.ts` (`axeViolations(element)`) runs it in jsdom over a rendered fixture with the tags `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa`. That is 68 of the 69 rules: `color-contrast` is off, and only there, because jsdom computes no colours. The token contrast spec below covers contrast instead. axe's `label-content-name-mismatch` rule draws text on a canvas to spot icon-font ligatures, and jsdom has no canvas. The helper therefore lends it a stand-in canvas on which all text measures as plain words, which is true here: the app's icons are SVG, with no icon font. This keeps that rule running. The page-level rules don't apply to a fixture; they were checked by hand in `src/index.html`: `lang="en"`, a `<title>`, a viewport that allows zoom, and one `<main>`.

**Axe specs.** `ui/wcag-aa.spec.ts` has 18 tests covering 24 states. Every state reports 0 violations, and 0 results need review:
- create-planet, as first shown, then with the code form open and a refused name (`aria-invalid`);
- the planet page HUD with Pip (step 4), the garden list, the sky list, the inventory with seeds picked and the placement help;
- the info card: a plant hovered, pinned with "Collect seeds", and asking before "Dig up"; a decoration pinned;
- the creature card: hovered while napping, and pinned with its want and the story under "More" open;
- the chat panel: earlier messages, a game notice with its link and the greeting; then asking before "Forget our chats";
- the journal book with milestones and "Older entries";
- the journal page and the welcome-back summary on return;
- the settings panel, as first shown, then asking before deleting the planet;
- the catalogue with found and locked items;
- the reward reveal with the thank-you;
- the sky list with a full and an empty cloud and the sun;
- the inventory with an item chosen, then empty;
- the garden list and the shortcut help (Task 16.5's components): 0 violations, no edits needed;
- the game owner's page.

**Fixes.**
1. Chat panel: `role="log"` moved from the `<ol>` onto a wrapping `<div>`. The rule was `listitem`: a list item's parent list may not have another role. The chat-panel spec now finds the log as the list's parent.
2. Sky list: the name changed from "Cloud 1 (full)" to "Cloud 1, full", and a space now separates the shown name from the status. The rule was `label-content-name-mismatch`: axe drops words in brackets from a name, so the shown "full" was missing from it. The sky-list spec labels were updated.
3. Inventory: a space between the item's name and its count. Same rule: the shown "Pond1" was not in the name "Pond, 1".
4. Inventory buttons are edged with `--fg-muted` rather than `--border`. Contrast against the panel goes from 1.41:1 to 6.46:1 (WCAG 1.4.11).
5. The locked catalogue silhouette is filled with the muted text colour rather than `--border`. Contrast goes from 1.41:1 to 6.46:1.
6. The creature card now says "Napping" (moon icon) while the creature sleeps on the night side. The scene and the card share one rule, `isNapping` in `core/helpers/nap-rule.ts`. The info card works it out from the sun, as it does a plant's light, and hands it to the creature card.

**Contrast.** `src/styles.spec.ts` imports `styles.scss` as text, reads the hex tokens on `:root` and works out WCAG ratios (17 tests). No token value had to change. `--border` (#d3dae3, 1.41:1 on surface) now only edges cards and panels; it never edges a control on its own. No component SCSS or template hard-codes a colour (grep). The colours in `scene/*.ts` belong to the 3D view, not the 2D interface.

| Foreground | Background | Ratio | Needs | Used for |
|---|---|---|---|---|
| fg #1f2933 | bg #eef1f5 | 13.02 | 4.5 | page text, creature chat lines, thank-you bubble |
| fg | surface #ffffff | 14.76 | 4.5 | card and panel text, status icons |
| fg | sky-top #bfe2fb | 10.88 | 4.5 | loading text over the sky |
| fg | sky-bottom #fdf2df | 13.31 | 4.5 | journal pages, loading text |
| fg-muted #52606d | bg | 5.70 | 4.5 | hints on create-planet, code input border |
| fg-muted | surface | 6.46 | 4.5 | hints, labels, counts; input, inventory and `kbd` borders |
| fg-muted | sky-bottom | 5.82 | 4.5 | journal page kicker |
| accent #0b5cad | bg | 5.89 | 4.5 | "I already have a planet code"; focus ring |
| accent | surface | 6.67 | 4.5 | secondary buttons, milestones, receipts; focus ring, selection, keyboard cursor ring |
| accent | sky-top | 4.92 | 3 | focus ring and Pip's outline on the planet view |
| accent | sky-bottom | 6.02 | 3 | focus ring on journal pages |
| danger-fg #8a1c1c | bg | 8.19 | 4.5 | errors on create-planet |
| danger-fg | surface | 9.28 | 4.5 | errors, refused spot |
| surface | accent | 6.67 | 4.5 | primary buttons, your chat lines, "Here!" label |
| surface | danger-fg | 9.28 | 4.5 | danger buttons |

**3D information as text.**
- The canvas is `role="img"`. Its `aria-label` names the planet and the controls: "Mossy, your planet. Drag or use the arrow keys to turn it… Enter acts at the middle of the view; press ? for all keys." The `scene/planet-view/planet-view.component.spec.ts` test "is a focusable picture named for the planet and its controls" checks it.
- The info card gives a plant's name, its stage or "seeds ready", and its water and light with what would help. For a decoration, it gives the name.
- The creature card gives the name, species, summary, quirk, mood or wistful, "Napping" on the night side, and the want or "No wish right now".
- The tests that check all this are in `ui/info-card/info-card.component.spec.ts`: "shows a plant's type, stage, water and light…", "shows its name, species, summary, quirk, and its mood and want…" and the new "says it is napping once the night reaches it…". The shared rule has its own spec, `core/helpers/nap-rule.spec.ts`.
- The card judges the nap by the creature's home spot; the scene uses where it has wandered to, at most 1.5 steps away. Right at dusk the two can disagree for a moment.

**Live: pending (live).** Run an axe scan of the running app through the Playwright MCP (inject `axe.min.js` or use `@axe-core/playwright`), with the same tags and `color-contrast` on. Cover:
- create-planet;
- the planet HUD with Pip, the placement help and an info card hovered and pinned;
- the creature card, the chat, the journal book and page, settings, catalogue, welcome-back, the reward reveal, the shortcut help and the admin page.

It must report 0 violations. It must also check what jsdom cannot:
- contrast as actually rendered, including panels over the 3D view;
- the focus ring and keyboard cursor against the rendered planet;
- reflow at 320 CSS px and 200% zoom (1.4.10, 1.4.4);
- text spacing (1.4.12).

## NFR-02 — Performance (Task 17.1)

AC: at least 30 fps in Chrome and Firefox with the full fixture, and no per-frame allocations in the render loop (profiler check noted). Spec paths are under `frontend/src/app/`.

**A full planet costs draw calls per model, not per plant.**
- Plants are one `InstancedMesh` per plant type and stage (`scene/surface-item-layer.ts`). Decorations use the same layer, one `InstancedMesh` per decoration type (`scene/decoration-mesh.service.ts`). All the sparkles share one `InstancedMesh` (`scene/sparkles.ts`). Each model's parts are merged into one geometry (`merge` in `scene/low-poly.ts`), so each mesh is one draw.
- Deviation: the plan says "merged geometry for decorations". Decorations were already instanced per type, which gives the same bound (one draw per decoration type in use), so they were not rewritten.
- The fixture is `testing/full-planet.ts`. It has 60 plants (`maxPlants`), cycling through the 8 types and 4 stages. Every fifth plant is thirsty, so it is tinted and droops, and the 12 blooms have seeds ready, so they sparkle. It also has 8 creatures (`maxCreatures`) of all 6 species, 3 clouds and one of each of the 5 decorations.
- `scene/performance.spec.ts` "grow with the plant models and the creatures, not with the plants" draws it with the null renderer. The result is 32 plant meshes holding 60 instances, 77 scene objects and 55 draw calls. The 55 are: 2 for the empty planet (ground and sun), 32 plant models, 1 for the sparkles, 5 decorations, 3 clouds, 8 creature bodies and 4 "z"s over napping creatures.
- With twice the plants (120), the scene still has 55 draw calls and 77 objects. With the same 60 plants all of one model, it has 32 fewer draw calls. Each creature adds a group and its body, plus its "z" while it naps.
- Things that come and go during play: each raining cloud adds a wet patch and streaks, the selection ring 3 meshes, the placement ghost 2, and a cheering creature 3 sparkles.

**Pixel ratio.** `scene/webgl-scene-renderer.ts` has capped it at 2 since Phase 4. The cap is now `pixelRatioFor(devicePixelRatio)`, and `scene/webgl-scene-renderer.spec.ts` checks it: 1 stays 1, 1.25 stays 1.25, and 3 or 4 become 2. Only the function is specced, because the renderer needs WebGL.

**Allocation audit.** These are the paths that run on every frame, or every few frames.

| Path | When it runs | What it allocated | Fix |
|---|---|---|---|
| Frame loop, `scene/scene.service.ts` | every frame | a closure for `requestAnimationFrame` and one for `steps.forEach` | one callback field (`nextFrame`) and a `for…of` loop |
| Camera controls, `scene/camera-controls.service.ts` `update()` | every frame while turning, spinning, gliding or zooming | `heldTurn()` spread the held keys into an array, with a closure, 4 times a frame. `distance` (read by `placeCamera()` every frame) built a `{ near, far }` object | the held directions are worked out on key events. `distance` uses `nearLimit()` and `farLimit()`. `zoomLimits()` still returns an object, for the event paths |
| `standOn()`, `scene/low-poly.ts` | every creature pose, ring move and ghost move | 3 `Vector3` and 2 `Quaternion` per call, and a `Matrix4` unless a target was passed | module scratch objects (`STANCE`). The per-frame callers pass a matrix they keep |
| Creature arrival, cheer and wander, `scene/creature-mesh.service.ts` `pose()` | every frame while one arrives or cheers, and for every creature on the 125 ms wander tick | `standOn()` as above, plus `new Matrix4().makeTranslation(...)`. The nap "z" and the cheer sparkles were re-added on every pose (remove, splice, push) | two kept matrices (`stance`, `lift`). The "z" and the sparkles are added only when they are not there yet |
| Creature setting off, `headingOf()` | each walk start (every 2–6 s per creature) | 4 `Vector3` and 1 `Quaternion` | module scratch (`HEADING`) |
| Sparkles, `scene/sparkles.ts` `twinkle()` | every frame while a bloom has seeds ready | a `Matrix4`, plus a `Vector3` per sparkle (36 a frame on the full planet), and a closure | a kept matrix and vector, and an index loop |
| Rain streaks, `scene/rain-streaks.ts` `fall()` | every frame for each raining cloud | a closure | an index loop |
| Sky frame step, `scene/sky.service.ts` | every frame | the cloud map spread into an array, a filtered array and 2 closures | `fall()` loops over the map once |
| Clouds and sun, `place()` in `scene/sky.service.ts` | once a second for each cloud, the sun, wet patches and rain, and on every drag step | a `Vector3` per object | a module scratch vector |
| Selection ring, `scene/selection-ring.service.ts` | every frame while a creature is ringed | `update()` on every frame: a `find` closure, a spot object, a string and `standOn()` | the frame step only compares the creature's drawn point, which is a new object only after it moves (at most 8 times a second). `update()` passes a kept matrix |
| Placement ghost, `scene/placement-ghost.service.ts` | each move of the preview (every frame while the planet turns under a placement) | `standOn()` | a kept matrix |
| Garden input and picking, `scene/garden-input.service.ts`, `scene/picking.service.ts` | every frame while the mouse is over the canvas or an item is being placed | a raycast on every frame, even when nothing had moved. three.js makes an intersection record with vectors for each hit. Our code also spread the registered objects into an array and cloned the hit point | a frame picks again only when the planet turned or the camera moved (`viewMoved()`). `PickingService` keeps the object list between registrations, and reuses the hits array and a scratch vector |
| Celebration, `ui/celebration` | while it shows | CSS animation only, no script per frame | none needed |
| Frame-rate meter, `scene/fps-meter.ts` (new) | every frame with `?perf=1` | nothing (one string every 5 s) | — |

**What is left, and why.**
- While the planet turns under a resting mouse or a placement preview, the garden input still picks once per frame. Each hit makes an intersection record inside three.js's `Raycaster`, and the pick result and surface point are new objects, because they become signal values. Avoiding this would take our own ray test. The spec "picks on every frame while the planet turns under the mouse" pins this behaviour. Turning by keyboard clears the pointer, so it does not pick.
- Three `for…of` loops per frame run over the creature and cloud Maps. Each makes an iterator, which optimising JITs normally remove.
- The tutorial listens to `turned`. Each `Subject.next` in rxjs makes a small closure, once per turning frame.
- The 125 ms creature tick makes a new surface point for each walking creature (`along()`), which is how the ring sees a move. It also makes a `forEach` closure and, when the ring follows a creature, a spot object and a string. A walk start makes a walk object.
- Once a second the sky makes the cloud list (a signal value), a `Date` and look objects.
- Snapshot redraws (plants, decorations, sparkles) allocate freely. They follow a server change, not a frame.

**Allocation spec.** `testing/three-allocations.ts` counts constructor calls of `Vector2/3/4`, `Quaternion`, `Euler`, `Matrix3/4`, `Color`, `Sphere` and `Box3`. A setter on each prototype stands in for the first property the constructor sets. three.js r186 sets its `is…` flags in static blocks, so it can't count those. `scene/performance.spec.ts` has three tests:
- "counts the three.js math objects made, not those used, and leaves them working" checks the counter itself.
- "make no three.js math objects while everything moves at once, after warming up" runs the full planet with everything moving at once. A creature drops in and another cheers. The ringed creature walks on the wander tick. Two clouds rain, the sparkles twinkle and the sky makes its 1 s update. A held arrow key turns the planet and the zoom eases out. After 10 warm-up frames, it counts 300 frames (about 4.8 s): 0 objects made. The test also checks that each of these moved during the window and that every frame was drawn.
- "picks nothing again, and makes nothing, while only the sparkles move" has a seed selected and the mouse resting over the planet. Over 120 frames there is no pick and 0 objects are made.

As a before-and-after check, I put the Phase 16 versions of the 11 changed scene files back for one run, then restored them. The same tests then counted:
- 12,167 `Vector3`, 890 `Quaternion` and 1,169 `Matrix4` in the 300 frames (about 47 a frame);
- 5,288 `Vector3`, 360 `Matrix4`, 240 `Quaternion` and 120 `Vector2` in the 120 placing frames (about 50 a frame).

To check that the spec notices a regression, I put a single `new THREE.Vector3` back into `twinkle()`. The spec failed with 10,800 `Vector3` (36 sparkles × 300 frames).

**Frame-rate meter.**
- `scene/planet-view` loads `scene/fps-meter.ts` only with `?perf=1`, through a dynamic import. It is its own 749-byte chunk, which is never downloaded without the flag.
- Over each 5 s window it logs `[ppg perf] fps avg 58.2 min 41.0 over 5 s` with `console.info`. `min` is the rate of the longest frame in the window.
- The scene draws on demand, so a planet at rest would read as 0 fps. While the meter is loaded, it asks for a drawn frame on every frame. The scene therefore draws continuously, and the reading is what the device can do with that planet.
- A hidden tab pauses the frames, and the window that spans the pause shows a low `min`. Keep the tab in front.
- `scene/fps-meter.spec.ts` uses a fake clock. It checks that the meter draws every frame, and that 301 frames in 5 s, the longest 166 ms, give "avg 60.2 min 6.0". It also checks that each window starts afresh.
- `scene/planet-view/planet-view.component.spec.ts` has two tests. "is absent without ?perf=1": 6 s of frames give one draw and no line. "with ?perf=1 draws every frame and logs the frame rate every 5 s".

**Live procedure: pending (live).** Run it in Chrome, then repeat it in Firefox:
1. Health-check the verification servers: backend http://localhost:3102 and frontend http://localhost:4302, and restart any that are down. Serve the frontend as a production build, which is what players get: `ng serve --configuration production`, with `/api` proxied to 3102.
2. In `backend/`, run `npm run seed:full-planet` and copy the planet id it prints.
3. Open http://localhost:4302/ once. In the DevTools console, run `localStorage.setItem('ppg.planetId', '<id>')`.
4. Open http://localhost:4302/?perf=1 and filter the console on `[ppg perf]`. Use the laptop's usual window size at 100% zoom. Note the browser version, the laptop and GPU, and `devicePixelRatio`.
5. Wait 30 s and read the 6 lines. Then play normally for another 30 s and read 6 more. Normal play means spinning the planet by drag and letting it coast, holding an arrow key, zooming in and out with the wheel, holding a cloud over plants so it rains, and hovering plants and creatures.
6. Pass: every window's `avg` is 30 or more. Also note any window whose `min` is below 30, which means a single frame took more than 33 ms.
7. Profiler check, in Chrome only. Open DevTools > Performance and tick "Memory". With the canvas focused, record 10 s of holding an arrow key, which turns the planet without picking. The JS heap line should stay flat between minor collections. Note how many minor GCs there are, and save a screenshot.

| Browser | Version | Laptop, GPU | Window, `devicePixelRatio` | Lowest `avg` at rest | Lowest `avg` in play | Lowest `min` | Result |
|---|---|---|---|---|---|---|---|
| Chrome | pending (live) | pending (live) | pending (live) | pending (live) | pending (live) | pending (live) | pending (live) |
| Firefox | pending (live) | pending (live) | pending (live) | pending (live) | pending (live) | pending (live) | pending (live) |
| Chrome heap check (10 s turning) | pending (live) | — | — | — | — | — | pending (live) |

## NFR-03 — Start time (Task 17.2)

AC: a returning player sees the planet within 10 s on a DevTools "Fast 3G" profile, logged. Spec paths are under `frontend/src/app/`.

**Lazy chunks.** Five `@defer` blocks and one dynamic import:
- The settings panel, catalogue and journal book are each `@defer (on immediate)` inside their `@case` in `ui/planet-page/planet-page.component.html`. Each chunk loads when its panel first opens, and later opens reuse it.
- The journal page is `@defer (when diaryWaiting())`. It loads with the first diary page that waits for the player, that is, a welcome-back with a journal entry. The welcome-back summary stays in the main bundle.
- The admin page is `@defer (on immediate)` inside the admin `@case` in `app.html`.
- The frame-rate meter is a dynamic import that runs only with `?perf=1` (see NFR-02).
- There are no `@placeholder` or `@loading` blocks: each panel chunk is 1–3 kB compressed. On Fast 3G, the first open of a panel waits about one round trip (about 0.6 s). The button already shows `aria-expanded="true"` during that wait.
- Specs: a component with `@defer` resolves its metadata asynchronously, so `ui/planet-page/planet-page.component.spec.ts` and the planet-page test in `ui/wcag-aa.spec.ts` now `await TestBed.compileComponents()`. Every existing panel test still passes with the default `DeferBlockBehavior.Playthrough`, including the Phase 16 focus tests. Opening by button and pressing Tab goes into the panel, and the catalogue and journal take the focus and give it back on Escape. A new test, "loads the diary page only once one waits (NFR-03)", checks that `app-journal-page` is absent until then.

**Bundle (`npm run build`).**

| | Before (Phase 16) | After |
|---|---|---|
| Initial, raw | 908.93 kB in 2 files (main 906.63 kB, styles 2.30 kB) | 892.38 kB in 12 files: main 146.14 kB, three.js 560.89 kB, Angular 164.90 kB, styles 2.30 kB and 8 small shared chunks (18.1 kB) |
| Initial, estimated transfer | 208.20 kB | 211.34 kB |
| Lazy chunks, raw (transfer) | none | settings-panel 8.51 kB (2.76 kB), admin 6.05 kB (2.15 kB), catalogue 5.56 kB (2.07 kB), journal-book 4.37 kB (1.69 kB), journal-page 2.68 kB (1.18 kB), the journal entry shared by book and page 1.52 kB (757 B), fps-meter 749 B |

Lazy loading saves 16.5 kB of initial script (1.8%). The estimated transfer goes up by 3.1 kB, though, and the initial files go from 2 to 12. That is because esbuild moves code that the main bundle shares with the lazy chunks into chunks of its own: the status icon, the planet name form (shared by create-planet and settings) and small helpers. `index.html` preloads all of them in parallel, but on HTTP/1.1 (6 connections per host) that can cost one more round trip. three.js (561 kB, 63%) and Angular (165 kB, 18%) set the start time, not the panels.

Measured but not applied: Angular's experimental chunk optimiser (`NG_BUILD_OPTIMIZE_CHUNKS=1 ng build`, built into a scratch folder) merges those chunks back. It gives 2 initial files, 899.14 kB raw and 206.06 kB transfer, with the same 7 lazy chunks. Applying it needs an environment variable in the build script, which takes `cross-env` on Windows, so it is left as an option.

**Time to planet.**
- When a returning player's planet is first drawn, `ui/planet-page` calls `markPlanetVisible()` from `core/helpers/perf.ts`. "First drawn" is the scene's `ready` signal, which also takes Pip's loading screen away.
- It sets the mark `ppg:planet-visible` and the measure `ppg:time-to-planet`. The measure runs from time 0, the navigation start, to the mark. Both are set once per page load.
- "Returning" means the page opened straight onto the stored planet and has shown no other view since (`ViewStateService.returning`). A planet opened from create-planet, or by code, is not timed.
- With `?perf=1` it also logs `[ppg perf] planet visible after 1234 ms`.
- An effect sets the mark just after the frame that drew the planet, so it can be up to one frame late.
- Specs: `core/helpers/perf.spec.ts` checks the flag, the mark, the measure from 0 and once per page load. `ui/planet-page/planet-page.component.spec.ts` "timing a returning player's start (NFR-03)" checks that it marks once, logs only with `?perf=1` and sets no mark after create-planet. `core/services/view-state.service.spec.ts` checks `returning`.

**Live procedure: pending (live).** Run it in Chrome:
1. Health-check the servers (3102 and 4302), and restart any that are down. Serve the frontend as a production build: `ng serve --configuration production`, with `/api` proxied to 3102. The development build is not minified and is several times larger, so it must not be used here.
2. Angular's dev server sends the files uncompressed, so the run moves about 892 kB of script instead of about 211 kB. That makes the result pessimistic. Note the `Content-Encoding` of `main-*.js` in the Network tab.
3. Make the player a returning one. Open http://localhost:4302/ once, and in the console run `localStorage.setItem('ppg.planetId', '<id>')`. Use the seeded full planet from NFR-02 (`npm run seed:full-planet` in `backend/`) or any existing planet.
4. In DevTools, on the Network tab, tick "Disable cache" and set throttling to "Fast 3G". Filter the console on `[ppg perf]`. Keep DevTools open, because the throttling applies only while it is open.
5. Load http://localhost:4302/?perf=1. Check that Pip's loading screen shows, then read `[ppg perf] planet visible after N ms`. The same number is in `performance.getEntriesByName('ppg:time-to-planet')[0].duration`.
6. Reload and read the line again, for 3 runs in all. Pass: the largest N is at most 10,000 ms.

| Run | Browser, version | Planet (plants, creatures) | `Content-Encoding` of `main-*.js` | Planet visible after (ms) | Result |
|---|---|---|---|---|---|
| 1 | pending (live) | pending (live) | pending (live) | pending (live) | pending (live) |
| 2 | pending (live) | pending (live) | pending (live) | pending (live) | pending (live) |
| 3 | pending (live) | pending (live) | pending (live) | pending (live) | pending (live) |

## NFR-01 — Browser smoke (Task 17.3)

AC (SD NFR-01): the game runs in the current desktop versions of Chrome, Edge, Firefox and Safari, and all Must requirements pass in each. The PoC's evidence is the smoke list below: the Must acceptance criteria a player touches, run by hand in each browser. Every rule behind these steps is also covered by a backend e2e or a frontend spec. The smoke list checks that each browser renders and drives them.

**Result: pending (live).** The verification servers were down for memory, so no browser has run it yet.

**How to run it.**
- **Servers.** Health-check both first, and restart any that are down: the memory reaper stops idle servers. The backend runs from source, as the verification backend on 3102 (`node --watch -r ts-node/register`) or `npm run start:dev` on 3101, against `epikrise-demo` on 5443. The real model is configured in `backend/.env`. Don't run `npm run test:e2e` during the smoke: it empties the planets table.
- **Frontend: the production build**, which is what players get: `npx ng serve --configuration production`, with `/api` proxied to the backend. Plain `npm start` serves the development build, which is unminified and not what players get. If you use it anyway, note that in the results.
- **`?perf=1` off.** With it, the scene draws every frame and the console fills with `[ppg perf]` lines. Open the plain URL.
- **Per browser:** use a fresh profile or cleared site data, so there is no `ppg.planetId`, at 100% zoom, with the DevTools console open. Note each console error. Each refused spot leaves one expected 400 line.
- **Safari** needs a Mac. Without one, use WebKit through Playwright (`npx playwright install webkit`) and write "WebKit (Playwright)" in place of the version. Note that WebKit on Windows is not Safari.
- **Firefox must be 121 or later**: the global CSS uses `:has()` (selection and focus styles).
- **Two planets per browser.** Planet A is created fresh in step 1 and goes through the whole story. Planet B is a full planet from `npm run seed:full-planet` in `backend/`; seed one per browser. Open it with `localStorage.setItem('ppg.planetId', '<id>')` and a reload. B has ready blooms, five placed decorations, eight creatures and a full garden.
- **Time away (step 19).** `X-Test-Now` works only under `NODE_ENV=test`, so age the planet in the database instead. Close the tab, then run `docker exec epikrise-postgres psql -U postgres -d epikrise-demo -c "UPDATE planets SET last_simulated_at = last_simulated_at - interval '5 hours', last_seen_at = last_seen_at - interval '5 hours' WHERE id = '<id>'"`, and reopen.

**Live items left from Phase 16.** Do these in the same run, and record each in its own section:
- NVDA and JAWS in browse mode: do they pass the arrow keys to the canvas (`role="img"`)? Check in Chrome, Edge and Firefox on Windows. If not, consider `role="application"` (SET-05 above).
- The live axe scan, with rendered contrast, reflow at 320 CSS px and 200% zoom, and text spacing (NFR-05 above).
- The SET-04 screenshots: the info card's icons, the refused spot, and a full and an empty cloud, at 100% and 200% zoom (SET-04 above).
- `:has()` in Firefox 121+: the selection and focus styles show (step 24).

**Smoke list.**

| # | Step: do, then check | SD Must ACs |
|---|---|---|
| 1 | Open the game with no stored planet: create-planet shows. Enter a name with a rude word: a friendly refusal. Enter "Mossy": Pip's loading screen, then the planet, then Pip greets. | ACC-01 AC1, ACC-02 AC1–AC2, NFR-03, ONB-01 AC1 |
| 2 | Drag the planet: it turns and coasts to a stop. Keep turning over a pole: no flip, no stick. | NAV-01 AC1, AC3 |
| 3 | Wheel in to the close limit: single plants fill much of the view. Wheel out to the far limit: the whole planet, the clouds and the sun show. | NAV-02 AC1–AC2 |
| 4 | Follow Pip one step, then reload: Pip resumes at the same step. | ONB-01 AC2, AC4 |
| 5 | Open the inventory and pick a clover seed. A preview follows the pointer, with "Free spot" or a refusal and its icon. Plant on a free spot: a seed mound appears and the count drops by 1. Try the same spot again: "Something is already there", and nothing is planted. | GRD-01 AC1–AC3, ITM-01 AC1–AC2, SET-04 |
| 6 | Hover the plant: the info card shows the type, stage, water and light, each as an icon with words. Move away: the card closes. | NAV-03 AC1, AC3, GRD-04 AC1–AC2 |
| 7 | Drag a cloud over the plant and hold it: rain falls and the card's water rises. Hold until it is empty: it pales and stops. Let go: it drifts on from there. | GRD-02 AC1–AC3 |
| 8 | Drag the sun: the lit half follows. | GRD-03 AC1 |
| 9 | Finish Pip's tour: Pip says goodbye and "Ask Pip" stays. Within 10 minutes of play, the clover blooms and the first creature arrives with a toast. | ONB-01 AC3, ONB-02 AC1–AC2, CRT-01 AC1 |
| 10 | Click the creature: its card shows the name, species, summary, quirk, mood and want, as words and a plain description. "More" shows the backstory. | NAV-03 AC2, CRT-03 AC1, WNT-02 AC2 |
| 11 | Fulfil its want with what you own: the creature hops. A reward reveal shows the thank-you, then the items go into the inventory with a receipt. The mood rises. | ONB-02 AC3, WNT-03 AC1, WNT-04 AC1, CRT-04 AC1, ITM-01 AC3 |
| 12 | Open a creature's chat from its card: a greeting. Send a message: a waiting line, then an in-character answer, and the messages left today. | CHT-01 AC1–AC3, CHT-03 AC2, AIB-04 AC1 |
| 13 | Scroll up for earlier messages. Choose "Forget our chats" and confirm: the history is gone. | CHT-04 AC1–AC2 |
| 14 | Open the Catalogue: found items show their needs and time to bloom; locked ones are silhouettes with a hint. | ITM-03 AC1–AC2, GRD-05 AC2, CRT-01 AC2 |
| 15 | Plant, then close the tab within 5 s. Reopen: the plant is there. | ACC-03 AC1, NFR-07 |
| 16 | Set DevTools to Offline and plant: the save indicator says "Offline — your changes will be saved when you're back". Go back online: the change is saved and the indicator goes. | ACC-03 AC2–AC3 |
| 17 | In a second browser profile, choose "I already have a planet code" and enter the code shown in Settings: the same planet opens. Plant in one: the other shows the reload banner. | ACC-04 AC1–AC2 |
| 18 | Open Settings. Move the Music and Sound effects sliders: heard at once. Mute each. Reload: the settings are kept. | SET-01 AC1–AC2 |
| 19 | Age planet A by 5 hours (above) and reopen it. A diary page opens, dated and naming the creature, above the welcome-back summary. Click a summary line: the camera turns to it. Plants grew; thirsty ones droop but are all there. | JRN-01 AC1–AC2, TIM-01 AC1, TIM-03 AC1, AC3, GRD-06 AC1, CRT-05 AC1 |
| 20 | Close the diary page, then open the Journal: the entry is there. Entries page newest first, and milestones are marked. | JRN-01 AC3, JRN-03 AC1–AC2 |
| 21 | Planet B: a sparkling bloom gives 1–2 seeds on a click, with a receipt. Click it again: refused (cooldown). Pick a seed and try to plant: "Planet is full". | GRD-08 AC1–AC3, GRD-01 AC4 |
| 22 | Planet B: open a decoration's card and choose Move, then put it down elsewhere. Put it away: it returns to the inventory. Place it again from the inventory. | ITM-02 AC1–AC3 |
| 23 | Planet B: on a creature with a wish, choose "Maybe later": a friendly reply, and the mood is unchanged. | WNT-05 AC1–AC2 |
| 24 | Keyboard only. Tab to the planet: arrows or W A S D turn it, `+` and `-` zoom. Tab to the garden list: arrows pick, the ring shows the choice, Enter opens the card. In the sky list, arrows move a cloud and Space rains. In the inventory, Enter on a seed, then turn the planet and press Enter to plant. `?` opens the shortcut help, and Esc closes it with the focus back. | SET-05 AC1–AC2, NAV-01 AC2, GRD-02 AC4, NFR-04 |
| 25 | Settings, reduced motion "On": celebrations and creature hops only fade, the camera does not swoop, and rain has no streaks. "Auto" follows the device's setting. | SET-03 AC1 |
| 26 | Open `?admin=1`. Switch AI off: saved. A new chat message gets the dozing fallback line, with no error. Switch it back on. | ADM-01 AC1, AIB-05 AC1 |
| 27 | Planet A: Settings, "Delete my planet", "Yes, delete it", "Delete forever": back to create-planet. Enter the old code: "This planet has drifted away". | ACC-05 AC1–AC2 |

**Results.** Each cell is pass, fail with a note, or pending (live).

| # | Area | Chrome | Edge | Firefox | Safari (or WebKit via Playwright) |
|---|---|---|---|---|---|
| — | Browser version, OS | pending (live) | pending (live) | pending (live) | pending (live) |
| 1 | Create and name a planet | pending (live) | pending (live) | pending (live) | pending (live) |
| 2 | Rotate | pending (live) | pending (live) | pending (live) | pending (live) |
| 3 | Zoom | pending (live) | pending (live) | pending (live) | pending (live) |
| 4 | Pip resumes after reload | pending (live) | pending (live) | pending (live) | pending (live) |
| 5 | Plant, preview, refused spot | pending (live) | pending (live) | pending (live) | pending (live) |
| 6 | Plant info card | pending (live) | pending (live) | pending (live) | pending (live) |
| 7 | Water with a cloud | pending (live) | pending (live) | pending (live) | pending (live) |
| 8 | Move the sun | pending (live) | pending (live) | pending (live) | pending (live) |
| 9 | Tutorial end, first bloom, first creature | pending (live) | pending (live) | pending (live) | pending (live) |
| 10 | Creature card | pending (live) | pending (live) | pending (live) | pending (live) |
| 11 | Want fulfilled, reward | pending (live) | pending (live) | pending (live) | pending (live) |
| 12 | Chat | pending (live) | pending (live) | pending (live) | pending (live) |
| 13 | Chat history, forget | pending (live) | pending (live) | pending (live) | pending (live) |
| 14 | Catalogue | pending (live) | pending (live) | pending (live) | pending (live) |
| 15 | Saved without a button | pending (live) | pending (live) | pending (live) | pending (live) |
| 16 | Offline indicator | pending (live) | pending (live) | pending (live) | pending (live) |
| 17 | Another device, reload banner | pending (live) | pending (live) | pending (live) | pending (live) |
| 18 | Settings: audio | pending (live) | pending (live) | pending (live) | pending (live) |
| 19 | Time away, welcome back, diary | pending (live) | pending (live) | pending (live) | pending (live) |
| 20 | Journal book | pending (live) | pending (live) | pending (live) | pending (live) |
| 21 | Harvest, planet full | pending (live) | pending (live) | pending (live) | pending (live) |
| 22 | Place, move, put away a decoration | pending (live) | pending (live) | pending (live) | pending (live) |
| 23 | Maybe later | pending (live) | pending (live) | pending (live) | pending (live) |
| 24 | Keyboard-only basics, `:has()` styles | pending (live) | pending (live) | pending (live) | pending (live) |
| 25 | Settings: reduced motion | pending (live) | pending (live) | pending (live) | pending (live) |
| 26 | Admin AI switch, fallback | pending (live) | pending (live) | pending (live) | pending (live) |
| 27 | Delete planet | pending (live) | pending (live) | pending (live) | pending (live) |
| — | Console errors (beyond expected 400s) | pending (live) | pending (live) | pending (live) | pending (live) |

## NFR-06 / ACC-05 — Delete planet completeness (Task 17.4)

**Result: passed (e2e, 6 Oct 2026).** `backend/test/delete-planet.e2e-spec.ts`, 2 tests; `npm run test:e2e` gave 240/240, exit 0.

How it works:
- **Finding the tables.** The spec walks the TypeORM metadata (`entityMetadatas` and their `foreignKeys`). A table is planet-owned when a chain of foreign keys leads from it to `planets`. Each chain becomes one SQL condition, for example `creature_memories → creatures → planets`. A table with more than one chain, such as `wants` or `chat_messages` (creature and planet), uses all of them.
- **Every table on one side.** Each table in the `public` schema must be planet-owned or on a commented global list: `admin_settings` (game-wide AI settings) and `migrations` (TypeORM's bookkeeping, which has no entity). The tables in the database must equal the entity tables plus that list, so a table that only a migration knows about also fails the test.
- **Two planets, built through the real routes.** Each is created (inventory, unlocks), plants a sunflower, syncs after 5 hours away (growth events, the worm and its identity, a journal entry), syncs again for the worm's first want, and sends 5 chat messages (the 5th keeps a memory highlight). Then it places a pond. The pond is the only item granted through `InventoryService`, because no route grants items. The fake AI answers every model call, and each call logs an `ai_usage` row. One `admin_settings` row is added as well.
- **Populated before the delete.** Every one of the 12 planet-owned tables has at least one row for each planet: `planets` 1, `inventory_items` 3, `unlocks` 4, `plants` 1, `decorations` 1, `events` 4, `creatures` 1, `wants` 1, `creature_memories` 1, `chat_messages` 10, `journal_entries` 1, `ai_usage` 9. A new table without data fails the test.
- **After `DELETE /api/planet`** with `{ "confirm": "DELETE" }` (204):
  - 0 rows in any table lead to planet A.
  - Planet B's rows are unchanged in every table: same count and the same md5 over the row contents.
  - Each table's total dropped by exactly A's rows, so the rows were deleted rather than cut loose. `ai_usage` is the one exception (below).
  - `admin_settings` is untouched, and `GET /api/planet` for A answers 404.

**No orphans were found, so there was no cascade fix and no migration.** One design decision to note: `ai_usage` rows are kept but unlinked (`ON DELETE SET NULL`, from Phase 10). The game-wide daily AI budget counts them. A kept row holds only the feature, the fallback flag, the reason, the latency and the time, so no player data. The spec lists this exception explicitly, with its reason, in `KEPT_UNLINKED`.

## NFR-11 — Tone review (Task 17.5)

**Scripted text: 0 violations (6 Oct 2026).** `backend/src/content/tone-review.spec.ts` has 18 tests and passes; `npm test` gave 1019/1019 after the want fix below, exit 0.
- The spec loads every module in `backend/src/content/` from disk and runs `checkText` over every string its exports hold, however deeply nested. That covers names, descriptions, hints, Pip's lines, the greeting, chat, thank-you and fallback-want templates, and the fallback identities. A new content file is picked up without being listed: a probe file holding a URL and "beer" made the spec fail and name the string.
- It skips only the six rule lists themselves (blocked words and names, guilt phrases, sensitive terms, tone phrases, wellbeing phrases). It also checks that those modules hold nothing but lists of words.
- It also checks every wording of the journal template (`templateEntry`: quiet and busy days, every species, wishes and gifts, with and without a name), and the wellbeing notice and its helpline label.
- No content needed a wording change.

**AI sample: 50 requests per feature against the real model (6 Oct 2026).** `npm run tone:sample` (`backend/scripts/tone-sample.ts`) sent each request through the real feature service and the real gateway, with no database writes. The full report is `2026-10-01-pocket-planet-gardener-poc-tone-sample.md`, next to this file.

| Feature | First replies valid | Flagged by checkText (all replies) | Rejected by validation (all replies) | Failed or timed out | Player got the model's text |
|---|---|---|---|---|---|
| identity | 50/50 | 0 | 0 | 0 | 50 |
| want | 7/50 | 56 of 93: too-many-sentences 56, sensitive-topic 1 | 20 | 0 | 17 (33 used the pre-written fallback) |
| chat | 50/50 | 0 | 0 | 0 | 50 |
| memory | 50/50 | 0 | 0 | 0 | 50 |
| journal | 48/50 | 0 | 2 (fact check: invented bloom) | 0 | 50 (2 after the retry) |

Findings:
- **No breach reached a player.** The gateway caught every flagged or invalid reply and retried once; if the retry was also unusable, it used the fallback.
- **Wants broke the 2-sentence limit** (`WANT_TEXT_LIMITS`), so most AI wants (33 of 50) ended as fallback wants.
  - In 33 of the 56 flags, an ellipsis counted as a sentence end, for example "Hmm... I wonder if…? Could you…?".
  - The other 23 were three real sentences, for example "Teehee! I'd love to see a tulip bloom! It would be so bouncy!".
- **Fixed, and the limit is kept at 2 sentences (SD 10.1).**
  - `sentenceCount` in `content-rules.ts` now ends a sentence only at . ! or ?. An ellipsis is a pause, and a trailing "…?" still ends a sentence through its "?". `content-rules.spec.ts` covers "Hmm... I wonder if you could plant a moonflower?" (1 sentence) and "Hmm. I wonder. Could you?" (3).
  - The want prompt asks for at most 2 short sentences, each ending with . ! or ?, with no ellipses. It gives the SD's example: "One requires moonflowers. Near the lamp-post, obviously."
  - Want re-run, 50 requests, before → after:

| Want | Before | After |
|---|---|---|
| First replies valid | 7/50 | 31/50 |
| Outputs flagged by checkText | 56 of 93 | 11 of 69 (too-many-sentences 9, sensitive-topic 2) |
| Model text used | 17 | 38 (31 first try, 7 after retry) |
| Fallback | 33 | 12 |

  The 9 sentence flags that remain are real three-sentence wants opening with an interjection ("Oh boy! … ! … !").
- **"Pray" stays flagged.** The sensitive-topic hit is archaic "Pray, return the sunflower…" (1 request in the first run, 1 request with both its replies in the re-run). `pray` is on the religion list. It is a word-level false positive, and it stays flagged on purpose: erring safe suits this audience, and the gateway only retries or falls back.
