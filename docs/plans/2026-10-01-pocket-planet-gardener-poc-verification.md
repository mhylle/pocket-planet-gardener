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
