# Pocket Planet Gardener — Solution Description (Functional)

| | |
|---|---|
| **Document type** | Functional solution description |
| **Version** | 0.1 (draft) |
| **Date** | 1 October 2026 |
| **Status** | For review by product owner |
| **Next step** | Hand-over to Claude Code for phasing and task breakdown |

---

## 1. About this document

This document describes **what** Pocket Planet Gardener must do, from the player's and the game owner's point of view. It contains the vision, scope, personas, user stories, functional requirements with acceptance criteria, and non-functional requirements.

It deliberately does **not** contain:

- technical design (architecture, data schemas, APIs, libraries other than the given rendering engine),
- implementation phases, milestones or tasks.

Those are produced from this document in a later step.

### 1.1 How to read the requirements

- Every requirement has a stable ID (for example `GRD-03`). User stories reference the requirements that cover them.
- Priority uses MoSCoW: **Must** (needed for a first playable release), **Should** (important, but the game works without it), **Could** (nice to have), **Won't** (explicitly not in this version).
- Acceptance criteria are written as *Given / When / Then* and are meant to be testable by playing the game.
- Values marked *(tunable)* are starting defaults. They are collected in section 11 and may be changed without changing the requirement.

---

## 2. Vision

Pocket Planet Gardener is a small, cosy browser game. The player looks after a tiny planet, about the size of a beach ball, that they can spin in their hands. They plant seeds, drag clouds across the sky to water them, and nudge the sun to warm them. As the planet grows lusher, small creatures move in. Each creature has its own name, personality and wishes, created by an AI, and it remembers the player.

The planet keeps living when the player is away. When the player returns, a diary entry tells them what happened while they were gone.

### 2.1 Design pillars

1. **Cosy, never punishing.** There is no way to lose. Plants never die, creatures never leave for good, and nothing is timed. Mistakes have gentle, reversible effects.
2. **A planet that lives without you.** Time passes while the player is away, so coming back each day is rewarding.
3. **Characters with memory.** Creatures are individuals. They remember what the player did for them and what was said to them.
4. **Hands at rest.** The game is played with a mouse, keyboard or touch screen. It never requires physical activity, fast reflexes, precise timing or body movement.
5. **Small and finishable.** A compact set of plants, creatures and decorations, done well, rather than a large set done thinly.

### 2.2 Tone

Lighthearted, warm and a little absurd. Humour comes from the creatures' quirks (a snail who believes he is an opera singer, a moth with strong opinions about lamp-posts), never from mocking the player or anyone real.

---

## 3. Scope

### 3.1 In scope

- One personal planet per player, viewed and handled in 3D.
- Gardening: planting, watering, sunlight, growth, seeds, decorations.
- Creatures that arrive based on the state of the planet, with AI-created identities.
- Creature wishes ("wants") created by AI from the actual state of the planet.
- Chatting with creatures, who remember earlier conversations and events.
- Progress while the player is away, and an AI-written Planet Journal.
- Saving all progress automatically and continuing on another device.
- Light social features: visiting friends' planets, gifts, reaction stamps and creature vacations.
- Fallback behaviour for every AI feature, so the game works when the AI is unavailable.
- Basic game-owner controls for limits and moderation.

### 3.2 Out of scope (this version)

- Any physical-activity input: motion sensors, camera tracking, step counting, controllers that require movement.
- Timed challenges, reflex games, combat, scores or leaderboards.
- In-game purchases, advertising or any monetisation.
- Free-text messages between players.
- Real-time co-operative editing of the same planet.
- Native mobile apps (the game runs in a browser).
- Player-made 3D models or uploaded images.
- Voice input or output.
- More than one planet per player.
- Languages other than English.

---

## 4. Constraints and assumptions

### 4.1 Constraints (given by the product owner)

| ID | Constraint |
|---|---|
| C-1 | The game runs in a web browser and uses **three.js** for 3D rendering. |
| C-2 | The solution has a **backend** and a **database**. Player progress is stored server-side, not only in the browser. |
| C-3 | An **AI** (large language model) is a core part of the experience, not an add-on. |
| C-4 | The game does not involve physical activity (see pillar 4). |
| C-5 | The game is small in scope and lighthearted in tone. |

### 4.2 Assumptions

| ID | Assumption |
|---|---|
| A-1 | Players sign in to keep progress and use social features. The sign-in method is a technical decision. |
| A-2 | The visual style is low-poly and colourful, which suits both the tone and browser performance. |
| A-3 | Target audience is players aged 13 and over. All content, including AI output, must still be suitable for all ages. See open question Q-2. |
| A-4 | The game needs an internet connection to save and to use AI features. |
| A-5 | Where the game is hosted (for example as a published claude.ai artifact or on its own servers) is not yet decided and does not change the functional requirements. See open question Q-1. |

---

## 5. Personas

**Mia, the cosy unwinder (primary).** 29, plays for 10–20 minutes in the evening to relax. Likes games such as Animal Crossing and Stardew Valley but doesn't have time for long sessions. Wants something pretty and calming that rewards small amounts of attention. Gets put off by timers, failure and anything that feels like a chore.

**Jonas, the daily checker-in.** 41, opens the game on his work laptop during his lunch break. Visits briefly almost every day to see what happened. Enjoys the journal and the creatures' personalities more than the gardening itself. Wants coming back to feel like reading a letter from a friend.

**Sara, the social sharer.** 17, plays with two friends. Enjoys showing off her planet, sending gifts and sending creatures on vacation. Wants simple ways to interact with friends without needing to chat.

**The game owner.** Runs the game. Needs to keep AI costs under control, switch AI features off if something goes wrong, and remove inappropriate planet names.

---

## 6. Glossary

| Term | Meaning |
|---|---|
| **Planet** | The player's small spherical world. Everything the player grows or places lives on its surface. |
| **Plant** | Something grown from a seed. Each plant type has needs for water and sunlight and goes through growth stages. |
| **Growth stage** | One of four visible stages of a plant: seed, sprout, young, bloom. |
| **Decoration** | A placeable object that isn't a plant, such as a pond, rock or lamp-post. |
| **Item** | Collective term for seeds and decorations that the player owns. |
| **Inventory** | The player's collection of items not yet placed on the planet. |
| **Cloud** | A draggable cloud in the sky that rains on the surface beneath it. |
| **Sun** | A draggable light source. The half of the planet facing the sun is lit. |
| **Creature** | A small animal that lives on the planet. It belongs to a **species** (fixed list with fixed artwork) but is an individual with an AI-created identity. |
| **Arrival condition** | The planet state a species needs before one of its creatures moves in, for example "3 blooming clovers and a pond". |
| **Identity** | A creature's name, personality, quirk, speaking style and short backstory. |
| **Mood** | A creature's contentment. Always positive or neutral, never negative (see section 10). |
| **Want** | A small wish a creature expresses, such as "moonflowers near my lamp-post". The game can check automatically whether it is fulfilled. |
| **Memory** | What a creature remembers: fulfilled wants, notable planet events and highlights of conversations. |
| **Session** | One continuous period of play, from opening the game to closing it. |
| **Away time** | Time between the end of one session and the start of the next. |
| **Event log** | The game's record of things that happened (a plant bloomed, a creature arrived, a gift was received). It is the factual source for the journal. |
| **Planet Journal** | A diary of AI-written entries describing what happened during away time. |
| **Visit** | Looking at another player's planet in view-only mode. |
| **Gift** | An item a visitor leaves for the host player. |
| **Stamp** | A preset reaction (for example a heart or a sparkle) a visitor leaves on a planet. |
| **Vacation** | Sending one of your creatures to stay on a friend's planet for a while. |
| **Pip** | The scripted guide character, a small friendly cloud, who runs the tutorial. Pip is not AI-driven. |
| **Fallback** | Non-AI behaviour used when the AI is unavailable, slow, switched off, or over its limit. |

---

## 7. Core experience

### 7.1 The loop

1. **Look after the planet.** Spin it, plant seeds, water with clouds, move the sun.
2. **Watch it grow.** Plants pass through growth stages in real time. Blooming plants give seeds.
3. **Creatures move in.** When the planet meets a species' arrival condition, a creature arrives with its own AI-created identity.
4. **Creatures want things.** Each creature has a small want based on the actual planet. Fulfilling it makes the creature happier and earns rewards (new seeds and decorations), which opens up new plants and new creatures.
5. **Get to know them.** Click a creature to chat with it. It answers in character and remembers.
6. **Leave, and come back.** The planet keeps growing. On return, the Planet Journal tells the story of what happened.
7. **Share.** Friends visit, leave gifts and stamps, and host creatures on vacation.

### 7.2 Example of a returning session (Jonas)

Jonas opens the game at lunch, 20 hours after his last visit. A diary page opens: *"Wednesday. The sunflowers finally bloomed and are being smug about it. Bartholomew rehearsed by the pond for an audience of one confused beetle. A parcel arrived from Sara's planet."* Below it, a short factual list confirms: 2 plants bloomed, 1 gift received. Jonas dismisses the page, collects the gift (moonflower seeds), and sees that Mira the moth wants moonflowers near her lamp-post. He plants them, waters them with a cloud and clicks Mira, who thanks him in her overly formal way. Seven minutes later he closes the game.

---

## 8. Functional requirements

Requirements are grouped into functional areas. Each area lists its user stories first, then its requirements with acceptance criteria.

| Code | Area |
|---|---|
| ACC | Account, planet creation and saving |
| ONB | Onboarding and tutorial |
| NAV | Viewing and handling the planet |
| GRD | Gardening |
| ITM | Seeds, decorations and inventory |
| CRT | Creatures |
| WNT | Creature wants |
| CHT | Chatting with creatures |
| TIM | Time and away progress |
| JRN | Planet Journal |
| SOC | Social features |
| AIB | AI behaviour, safety and fallback |
| SET | Settings and accessibility |
| ADM | Game-owner administration |

---

### 8.1 Account, planet creation and saving (ACC)

**User stories**

- **US-ACC-1** As a new player, I want to create my own planet and give it a name, so that it feels like mine from the start. → ACC-01, ACC-02
- **US-ACC-2** As a player, I want my progress saved automatically, so that I never have to remember to save and never lose my garden. → ACC-03
- **US-ACC-3** As Jonas, I want to continue my planet on another computer, so that I can play wherever I am. → ACC-04
- **US-ACC-4** As a player, I want to be able to delete my account and all my data, so that I stay in control of my information. → ACC-05

#### ACC-01 Sign in — Must
A player signs in to play. A player who is signed in returns directly to their planet when opening the game.

- **AC1** Given I have no account, when I open the game, then I can create one and reach planet creation without leaving the game.
- **AC2** Given I am signed in, when I open the game again later, then I land on my own planet without signing in again (until I sign out or my sign-in expires).
- **AC3** Given I sign out, when I open the game, then I am asked to sign in and cannot see my planet until I do.

#### ACC-02 Create and name a planet — Must
On first sign-in, the player creates exactly one planet and gives it a name.

- **AC1** Given I have just signed up, when I enter a planet name of 2–24 characters *(tunable)* and confirm, then my planet is created and shown.
- **AC2** Given I enter a name containing offensive words, when I confirm, then the name is rejected with a friendly message and I can try another.
- **AC3** Given I already have a planet, when I sign in, then I am never offered to create a second one.
- **AC4** Given my planet exists, when I open settings, then I can rename it under the same rules as AC1–AC2.

#### ACC-03 Automatic saving — Must
Every change the player makes is saved without a save button.

- **AC1** Given I plant a seed, when I close the browser tab 5 seconds later, then the plant is there when I return.
- **AC2** Given the connection drops while I play, when it comes back, then my changes made in the meantime are saved and I am not asked to redo them.
- **AC3** Given the connection is down, when I make changes, then a small, calm indicator shows that saving is pending; it disappears once saving succeeds.
- **AC4** Given an unexpected crash, when I return, then I lose at most the last 30 seconds *(tunable)* of play.

#### ACC-04 Continue on another device — Must
The planet lives with the account, not with the device.

- **AC1** Given I played on computer A, when I sign in on computer B, then I see the same planet, plants, creatures, inventory and journal.
- **AC2** Given the game is open on two devices at once, when I make a change on one, then the other shows a message asking me to reload rather than silently overwriting either version.

#### ACC-05 Delete account — Must
- **AC1** Given I choose "Delete my account" in settings, when I confirm twice, then my account, planet, chats, journal and all related data are permanently removed.
- **AC2** Given my account is deleted, when a friend tries to visit my planet, then they see "This planet has drifted away" and nothing else.
- **AC3** Given one of my creatures was on vacation on a friend's planet, when my account is deleted, then the creature disappears from the friend's planet.

---

### 8.2 Onboarding and tutorial (ONB)

**User stories**

- **US-ONB-1** As Mia, I want a short, friendly introduction, so that I understand how to play without reading a manual. → ONB-01
- **US-ONB-2** As a new player, I want something lovely to happen in my very first session, so that I want to come back. → ONB-02
- **US-ONB-3** As an experienced player, I want to skip the tutorial. → ONB-03

#### ONB-01 Guided tutorial by Pip — Must
Pip, a small scripted cloud, introduces the basics step by step: spinning the planet, planting, watering with a cloud, moving the sun, and checking a plant's needs.

- **AC1** Given I have just created my planet, when it appears, then Pip greets me and shows the first step.
- **AC2** Given Pip asks me to do something (for example "plant a seed"), when I do it, then Pip moves to the next step; Pip never moves on before I have done the step.
- **AC3** Given I finish the tutorial, when I have performed every step at least once, then Pip says goodbye and stays available as a help button.
- **AC4** Given I am in the tutorial, when I reload the game, then it continues from the step I reached.

#### ONB-02 First bloom and first creature in the first session — Must
- **AC1** Given I follow the tutorial, when I plant the starter seed I'm given, then it blooms within 10 minutes *(tunable)* of play.
- **AC2** Given my first plant blooms, when it happens, then a first creature arrives shortly after, with an AI-created identity (or a fallback identity, see AIB-05).
- **AC3** Given the first creature has arrived, when I click it, then it has a first want that I can fulfil with items I already own.

#### ONB-03 Skip the tutorial — Should
- **AC1** Given the tutorial is running, when I choose "Skip", then the tutorial ends and I keep the same starter items as if I had completed it.
- **AC2** Given I skipped the tutorial, when I click Pip's help button, then I can restart it.

---

### 8.3 Viewing and handling the planet (NAV)

**User stories**

- **US-NAV-1** As a player, I want to spin my planet and zoom in, so that I can see every corner of it up close. → NAV-01, NAV-02
- **US-NAV-2** As a player, I want to see at a glance what a plant or creature needs, so that I can care for it without guessing. → NAV-03
- **US-NAV-3** As a player, I want the planet to feel alive even when I'm just looking at it. → NAV-04

#### NAV-01 Rotate the planet — Must
- **AC1** Given I drag on empty space or on the planet with the mouse or a finger, when I move, then the planet rotates in that direction and slows to a smooth stop when I release.
- **AC2** Given I use the keyboard, when I press the arrow keys or W/A/S/D, then the planet rotates in that direction.
- **AC3** Given I rotate, when I keep going, then there is no angle at which the planet flips or gets stuck.

#### NAV-02 Zoom — Must
- **AC1** Given I scroll the mouse wheel, pinch, or press +/–, when I zoom in, then the camera moves closer to the planet surface, stopping at a close limit where single plants fill a good part of the screen.
- **AC2** Given I zoom out, when I reach the far limit, then the whole planet and the sky around it (clouds and sun) are visible.

#### NAV-03 Inspect plants, decorations and creatures — Must
- **AC1** Given I hover over (or tap) a plant, when the info card opens, then it shows the plant type, growth stage, and its water and sunlight state as icons with short text (for example "a bit thirsty").
- **AC2** Given I hover over (or tap) a creature, when the card opens, then it shows its name, species, a one-line personality summary, current mood and current want.
- **AC3** Given I move away or tap elsewhere, when the card is open, then it closes.

#### NAV-04 Living planet — Should
- **AC1** Given I am watching the planet, when I do nothing, then plants sway, clouds drift slowly and creatures wander, sit or nap.
- **AC2** Given creatures are on the side away from the sun, when I look at them, then they are mostly sleeping.
- **AC3** Given reduced motion is switched on (SET-03), when I watch the planet, then idle animation is reduced to a minimum.

---

### 8.4 Gardening (GRD)

**User stories**

- **US-GRD-1** As Mia, I want to plant seeds wherever I like, so that I can design my garden my own way. → GRD-01, GRD-07
- **US-GRD-2** As a player, I want to water plants by dragging clouds, so that caring for the garden feels playful rather than like a menu. → GRD-02
- **US-GRD-3** As a player, I want to move the sun to give light to sun-loving plants, so that where I put things matters. → GRD-03
- **US-GRD-4** As a player, I want to watch plants grow through visible stages, so that I see the results of my care. → GRD-04, GRD-05
- **US-GRD-5** As Mia, I want neglect to have only gentle consequences, so that I never feel guilty for not playing. → GRD-06
- **US-GRD-6** As a player, I want blooming plants to give me seeds, so that my garden keeps growing. → GRD-08
- **US-GRD-7** As a player, I want my planet to grow bigger as the garden flourishes, so that I have room for more and a sense of progress. → GRD-09

#### GRD-01 Plant a seed — Must
- **AC1** Given I have seeds in my inventory, when I select a seed and click an empty spot on the planet surface, then a seed is planted there and one seed is removed from my inventory.
- **AC2** Given I select a seed, when I move the pointer over the planet, then a preview shows where it will go and whether the spot is allowed.
- **AC3** Given the spot is occupied by another plant, decoration or water, when I try to plant, then nothing is planted and the preview shows it isn't allowed.
- **AC4** Given the planet has reached its maximum number of plants *(tunable, default 60)*, when I try to plant, then I'm told kindly that the planet is full and can remove a plant to make room.

#### GRD-02 Water with clouds — Must
Several clouds drift slowly around the planet. The player can pick one up and hold it over the surface, where it rains.

- **AC1** Given I drag a cloud over the planet, when I hold it there, then it rains on the area under it and the water level of plants in that area rises.
- **AC2** Given a cloud has rained for a while, when its water runs out, then it shrinks and becomes pale, stops raining, and refills gradually over about 60 seconds *(tunable)*.
- **AC3** Given I release a cloud, when I let go, then it carries on drifting from that position.
- **AC4** Given I use the keyboard only, when I select a cloud with Tab and use the arrow keys, then I can move it and make it rain with Space.

#### GRD-03 Move the sun — Must
The sun drifts slowly around the planet on its own. The half of the planet facing the sun is lit; the other half is in night.

- **AC1** Given I drag the sun, when I move it, then the lit half of the planet follows, and plants on the lit side gain sunlight.
- **AC2** Given I release the sun, when I do nothing for 5 minutes *(tunable)*, then it slowly resumes its own drift.
- **AC3** Given a plant prefers shade (for example a mushroom), when it is in the lit half for a long time, then its card shows "a bit too sunny" and it grows more slowly.

#### GRD-04 Plant needs — Must
Each plant type has a preference for water (low, medium, high) and for light (shade, partial, full sun). The game tracks each plant's current water and light against its preference.

- **AC1** Given a plant's needs are met, when I inspect it, then its card says so (for example "happy") and it grows at full speed.
- **AC2** Given one need is not met, when I inspect it, then the card names which one and suggests what to do, and the plant grows at reduced speed *(tunable, default 50%)*.
- **AC3** Given a plant's water level falls over time, when it reaches "thirsty", then the plant droops visibly and stops growing until it is watered.
- **AC4** Given a plant is overwatered, when I inspect it, then it shows "soggy", grows at reduced speed, and recovers by itself as it dries out.

#### GRD-05 Growth stages — Must
- **AC1** Given a planted seed, when its needs are met, then it passes through sprout, young and bloom stages, each visibly different.
- **AC2** Given a plant type, when I inspect it in the plant catalogue (ITM-03), then I can see roughly how long it takes to bloom (for example "about 2 hours").
- **AC3** Given a plant has bloomed, when time passes, then it stays in bloom; it does not wither or reset.

#### GRD-06 Plants never die — Must
- **AC1** Given I have not played for any length of time, when I return, then every plant is still there; at worst, plants are thirsty and drooping.
- **AC2** Given a plant is thirsty, when I water it, then it recovers within a few seconds of play and continues growing from the stage it had reached.

#### GRD-07 Remove or move a plant — Must (remove), Should (move)
- **AC1** Given a plant on the planet, when I choose "Dig up", then it is removed; if it was still a seed or sprout, the seed returns to my inventory.
- **AC2** Given a plant on the planet, when I choose "Move" and pick a new allowed spot, then the plant moves there and keeps its growth stage. *(Should)*
- **AC3** Given a creature's want depends on that plant, when I remove or move it, then I am told which creature will notice before I confirm.

#### GRD-08 Harvest seeds from blooms — Must
- **AC1** Given a plant is in bloom, when seeds are ready, then a small sparkle shows on it.
- **AC2** Given a plant shows the sparkle, when I click it, then I receive 1–2 seeds *(tunable)* of that type and the plant stays in bloom.
- **AC3** Given I have harvested a plant, when less than 1 hour *(tunable)* has passed, then it cannot be harvested again.

#### GRD-09 Planet grows with the garden — Should
- **AC1** Given my planet reaches a lushness milestone (for example 20 blooming plants), when it happens, then the planet grows a little larger with a short celebration, and the maximum number of plants increases.
- **AC2** Given the planet has grown, when I look at it, then all existing plants, decorations and creatures are still in their places relative to each other.

---

### 8.5 Seeds, decorations and inventory (ITM)

**User stories**

- **US-ITM-1** As a player, I want to see what I own, so that I can plan what to plant and place. → ITM-01
- **US-ITM-2** As a player, I want to place decorations such as ponds and lamp-posts, so that I can attract new creatures and make the planet pretty. → ITM-02
- **US-ITM-3** As a player, I want a catalogue of plants and creatures to discover, so that I have something to work towards. → ITM-03, ITM-04

#### ITM-01 Inventory — Must
- **AC1** Given I open the inventory, when it shows, then I see every seed and decoration I own, with counts.
- **AC2** Given I own nothing of a type, when I look at the inventory, then that type is not shown as available.
- **AC3** Given I receive new items (harvest, reward or gift), when it happens, then a small animation shows them going into the inventory.

#### ITM-02 Place, move and remove decorations — Must
- **AC1** Given I own a decoration, when I select it and click an allowed spot, then it is placed and removed from my inventory.
- **AC2** Given a placed decoration, when I choose "Move", then I can place it elsewhere.
- **AC3** Given a placed decoration, when I choose "Put away", then it returns to my inventory.

#### ITM-03 Plant and decoration catalogue — Must
The first release contains at least 8 plant types and 5 decorations. Illustrative starting set (content may be adjusted):

| Plant | Water | Light |
|---|---|---|
| Clover | medium | partial |
| Sunflower | medium | full sun |
| Tulip | medium | full sun |
| Bluebell | high | partial |
| Moonflower | medium | shade |
| Mushroom | high | shade |
| Fern | high | shade |
| Cactus | low | full sun |

Decorations: pond, rock, lamp-post, bench, tiny house.

- **AC1** Given I open the catalogue, when it shows, then I see all plant types and decorations, with the ones I haven't unlocked shown as silhouettes and a hint about how to get them.
- **AC2** Given I have unlocked an item, when I view it in the catalogue, then I see its name, a short funny description and, for plants, its needs and approximate time to bloom.

#### ITM-04 Unlocking — Must
- **AC1** Given I start the game, when the tutorial ends, then I own starter seeds of at least 3 plant types *(tunable)* and no decorations.
- **AC2** Given I fulfil a creature's want, when the reward is given, then it can include seeds or decorations I have not had before.
- **AC3** Given I receive an item type for the first time, when it arrives, then it is unlocked in the catalogue and briefly celebrated.

---

### 8.6 Creatures (CRT)

**User stories**

- **US-CRT-1** As a player, I want creatures to move in when I make my planet suitable for them, so that my gardening choices have visible results. → CRT-01, CRT-02
- **US-CRT-2** As Jonas, I want every creature to be a unique character with its own name and personality, so that I care about them as individuals. → CRT-03
- **US-CRT-3** As a player, I want to see how happy my creatures are, so that I know my care is appreciated. → CRT-04
- **US-CRT-4** As Mia, I want creatures never to leave me because I neglected them, so that I don't feel punished. → CRT-05
- **US-CRT-5** As a player, I want to rename a creature if I like, so that I can make it mine. → CRT-06
- **US-CRT-6** As a player with a full planet, I want to let a creature move on happily, so that someone new can arrive. → CRT-07

#### CRT-01 Species and arrival conditions — Must
The first release contains at least 6 species, each with fixed artwork and a fixed arrival condition. Illustrative starting set (content may be adjusted):

| Species | Arrival condition |
|---|---|
| Worm | First plant blooms (tutorial creature) |
| Snail | 3 blooming clovers and a pond |
| Bee | Blooming plants of at least 3 different types |
| Moth | A lamp-post and 2 blooming moonflowers |
| Hedgehog | A rock and 3 blooming mushrooms |
| Frog | A pond and 2 blooming ferns |

- **AC1** Given my planet meets a species' arrival condition, when the condition has been met for a short while *(tunable, default 2 minutes of play or at the next away-time calculation)*, then a creature of that species arrives with a short arrival animation.
- **AC2** Given the catalogue (ITM-03), when I look at a species I don't have, then I see a hint about its arrival condition (for example "likes ponds and clover").
- **AC3** Given several conditions are met at once, when creatures arrive, then no more than one arrives per 30 minutes *(tunable)*, so each arrival is noticed.

#### CRT-02 Creature limits — Must
- **AC1** Given the planet has the maximum number of creatures *(tunable, default 8)*, when another arrival condition is met, then no new creature arrives and the catalogue explains that the planet is cosy enough for now (the limit can rise with GRD-09).
- **AC2** Given each species, when its condition is met, then at most 2 *(tunable)* creatures of the same species live on one planet.

#### CRT-03 AI-created identity — Must
When a creature arrives, the AI creates its identity: a name, a personality (2–3 traits), one quirk, a speaking style and a backstory of at most 3 sentences. The identity fits the species and the planet's current state.

- **AC1** Given a creature arrives, when its identity is created, then its card shows name, species, personality summary and quirk, and its backstory can be read by opening the card.
- **AC2** Given two creatures of the same species on any planet, when I compare them, then their names and personalities are different.
- **AC3** Given a creature's identity has been created, when I return days later, then the identity is unchanged.
- **AC4** Given the AI is unavailable, when a creature arrives, then it receives a fallback identity from a pre-written pool (AIB-05) and the player sees no error.
- **AC5** Given any created identity, when it is shown, then it follows the content rules in section 10.

#### CRT-04 Mood — Must
Mood has three levels: content, cheerful, overjoyed. It never goes below content.

- **AC1** Given a creature's want is fulfilled, when it happens, then its mood rises one level, shown with a small visible reaction (a hop, a sparkle).
- **AC2** Given a creature is overjoyed, when a day *(tunable)* has passed since it reached that level, then it gives me a gift (a seed or decoration) and its mood returns to cheerful.
- **AC3** Given a creature's arrival condition is no longer met (for example I removed the pond), when I inspect it, then its mood shows as "a bit wistful" — a variant of content — and its next want asks for the missing thing back.

#### CRT-05 Creatures never leave for good — Must
- **AC1** Given I haven't played for any length of time, when I return, then all my creatures are still there.
- **AC2** Given I remove what a creature needed, when time passes, then the creature stays.
- **AC3** Given a creature is on vacation (SOC-06), when the vacation ends, then it returns to my planet.

#### CRT-06 Rename a creature — Should
- **AC1** Given I open a creature's card, when I choose "Rename" and enter a name of 1–20 characters *(tunable)*, then the new name is shown everywhere, and the creature acknowledges it in character the next time I chat with it.
- **AC2** Given I enter an offensive name, when I confirm, then it is rejected with a friendly message.

#### CRT-07 Say goodbye to a creature — Could
- **AC1** Given I choose "Wave goodbye" on a creature's card and confirm, when it happens, then the creature leaves with a cheerful farewell and a small parting gift, making room for a new arrival.
- **AC2** Given a creature has left this way, when I open the journal, then its farewell is recorded there.

---

### 8.7 Creature wants (WNT)

**User stories**

- **US-WNT-1** As a player, I want creatures to ask me for things that make sense for my planet, so that their wishes feel personal and not like generic quests. → WNT-01, WNT-02
- **US-WNT-2** As a player, I want to be rewarded when I fulfil a want, so that I can unlock more plants and decorations. → WNT-03, WNT-04
- **US-WNT-3** As Mia, I want to say "maybe later" to a want I don't like, without any penalty. → WNT-05

#### WNT-01 One want at a time — Must
- **AC1** Given a creature has no active want, when a cooldown has passed *(tunable, default 1 hour)*, then it gets a new want.
- **AC2** Given a creature, when I inspect it, then it has at most one active want.
- **AC3** Given a creature's want is shown, when I read it, then it is written in that creature's own voice (for example "One requires moonflowers. Near the lamp-post, obviously.").

#### WNT-02 AI-created wants that can be fulfilled — Must
The AI receives a description of the planet's current state, the creature's identity and memory, and the list of allowed want types. It returns the want's text and its condition. Allowed want types:

| Want type | Example |
|---|---|
| Plant near something | "Moonflowers near my lamp-post" |
| Have a number blooming | "Five tulips in bloom, for the view" |
| Place a decoration | "A bench, so I can sit and judge things" |
| Variety | "Three different flowers near my home" |
| Bring back | "I miss the pond" (after it was removed) |

- **AC1** Given any want, when it is created, then it only involves items I own or can get through harvesting, gifts or rewards I have already unlocked.
- **AC2** Given a want, when I open its creature's card, then besides the creature's words there is a plain description of what is needed (for example "2 moonflowers within 3 steps of the lamp-post").
- **AC3** Given the game checks a want, when its condition is met, then it is marked fulfilled automatically, without me having to report it.
- **AC4** Given the AI returns a want that is invalid or not achievable, when the game checks it, then it is discarded and replaced by another AI want or a fallback want; the player never sees an invalid want.
- **AC5** Given the AI is unavailable, when a want is needed, then a fallback want is chosen from a pre-written pool that fits the species (AIB-05).

#### WNT-03 Fulfilment — Must
- **AC1** Given I fulfil a want, when the game notices (within a few seconds during play, or at the next away-time calculation), then the creature reacts happily, says a short thank-you line, and its mood rises (CRT-04).
- **AC2** Given a want is fulfilled, when it happens, then the event is added to the creature's memory and the event log.

#### WNT-04 Rewards — Must
- **AC1** Given I fulfil a want, when the reward is given, then I receive at least one item, and the reward is shown before it goes into my inventory.
- **AC2** Given I have locked items left in the catalogue, when I fulfil wants, then at least 1 in 3 rewards *(tunable)* unlocks something new until everything is unlocked.

#### WNT-05 Maybe later — Must
- **AC1** Given a creature has a want, when I choose "Maybe later", then the want is removed with a friendly response and a new want arrives after the cooldown.
- **AC2** Given I chose "Maybe later", when I look at the creature's mood, then it hasn't changed.
- **AC3** Given a want has been active for a long time, when time passes, then the want stays and never expires or causes any penalty.

---

### 8.8 Chatting with creatures (CHT)

**User stories**

- **US-CHT-1** As Jonas, I want to talk to my creatures and hear their answers in their own voices, so that they feel like little friends. → CHT-01
- **US-CHT-2** As a player, I want creatures to remember what we talked about and what I did for them, so that our relationship grows. → CHT-02
- **US-CHT-3** As a player, I want to delete what a creature remembers about our chats, so that I control what's stored. → CHT-04
- **US-CHT-4** As the game owner, I want chat use limited per player per day, so that AI costs stay predictable. → CHT-03
- **US-CHT-5** As Jonas, I want to overhear my creatures chatting with each other now and then, so that they feel like a little community. → CHT-05

#### CHT-01 Chat in character — Must
- **AC1** Given I open a creature's card, when I choose "Chat", then a chat panel opens with a greeting from the creature in its speaking style.
- **AC2** Given I type a message of up to 200 characters *(tunable)* and send it, when the creature answers, then the answer is in character, at most about 60 words *(tunable)*, and fits the content rules in section 10.
- **AC3** Given I wait for an answer, when it takes more than a moment, then an in-character waiting indicator is shown (for example "Bartholomew is clearing his throat…").
- **AC4** Given the creature hasn't answered within 15 seconds *(tunable)*, when the time runs out, then a friendly fallback line is shown (for example "Bartholomew has dozed off mid-thought. Try again in a bit.") and I can resend.
- **AC5** Given I ask about something outside the game world (for example homework, news or real people), when the creature answers, then it stays in character and steers back to the planet in a playful way.

#### CHT-02 Memory — Must
- **AC1** Given I told a creature something in an earlier session (for example that I like sunflowers), when I chat with it later, then it can refer to that.
- **AC2** Given I fulfilled one of its wants last week, when I chat with it, then it can mention it.
- **AC3** Given notable planet events happen (a new neighbour arrives, the planet grows), when I chat with the creature, then it can comment on them.
- **AC4** Given a long history, when the creature remembers, then it keeps highlights rather than every message; the player is not required to manage memory.

#### CHT-03 Chat limits — Must
To keep AI use under control, chatting is limited per day.

- **AC1** Given I have sent 30 messages today *(tunable)* across all creatures, when I try to send another, then the creature says in character that it's getting sleepy and invites me back tomorrow; the input is disabled until the limit resets.
- **AC2** Given I am close to the limit, when I chat, then a small indicator shows how many messages are left today.
- **AC3** Given the limit is reached, when I play, then every other part of the game works as usual.

#### CHT-04 View and delete chat history — Must
- **AC1** Given I open a creature's chat, when I scroll up, then I can read our earlier messages.
- **AC2** Given I choose "Forget our chats" for a creature and confirm, when it is done, then the chat history and chat-based memories for that creature are deleted; memories of fulfilled wants and events are kept.
- **AC3** Given I chat with that creature afterwards, when it answers, then it does not refer to anything from the deleted chats.

#### CHT-05 Creatures talk to each other — Could
- **AC1** Given two creatures are near each other, when I click the speech bubble that sometimes appears above them, then I see a short AI-written exchange between them, in both their voices.
- **AC2** Given such an exchange happened, when I chat with one of them later, then it may refer to it.

---

### 8.9 Time and away progress (TIM)

**User stories**

- **US-TIM-1** As Jonas, I want my planet to keep living while I'm away, so that something new is waiting for me each time. → TIM-01
- **US-TIM-2** As Mia, I want being away for a long time to be harmless, so that I can take a break without guilt. → TIM-02
- **US-TIM-3** As a returning player, I want a quick factual summary of what changed. → TIM-03

#### TIM-01 Planet keeps living — Must
When the player returns, the game works out what would have happened during away time using the same gardening and creature rules as during play: water levels fall, plants grow, seeds become ready, creatures may arrive and wants may be fulfilled.

- **AC1** Given I planted a sunflower that needs 2 hours to bloom and its needs stay met, when I return 3 hours later, then it is in bloom.
- **AC2** Given a creature's arrival condition was met during my absence, when I return, then the creature has arrived and its arrival is in the event log.
- **AC3** Given plants ran out of water during my absence, when I return, then they are thirsty and stopped growing at the point they ran out.
- **AC4** Given the sun drifts on its own while I'm away, when the game calculates light during away time, then every plant gets an average amount of light, so light preferences count as partly met.

#### TIM-02 Long absence is harmless — Must
- **AC1** Given I return after any absence, when the planet loads, then nothing has been lost; at worst plants are thirsty (GRD-06) and creatures are still there (CRT-05).
- **AC2** Given I return after more than 7 days *(tunable)*, when the game calculates progress, then it calculates only 7 days' worth, and the creatures greet me with "we missed you" rather than complaints.

#### TIM-03 Welcome-back summary — Must
- **AC1** Given I return after at least 1 hour *(tunable)*, when the planet loads, then a short factual list shows what changed (for example "3 plants bloomed · 1 new creature · 1 gift waiting").
- **AC2** Given nothing changed, when I return, then no summary is shown.
- **AC3** Given the summary is shown, when I select an item in it (for example "1 new creature"), then the camera turns to show it.

---

### 8.10 Planet Journal (JRN)

**User stories**

- **US-JRN-1** As Jonas, I want a short diary entry telling the story of what happened while I was away, so that coming back feels like reading a letter. → JRN-01, JRN-02
- **US-JRN-2** As a player, I want to reread old journal entries, so that I can look back on my planet's history. → JRN-03

#### JRN-01 Journal entry on return — Must
- **AC1** Given I return after at least 4 hours *(tunable)* of away time, when the planet loads, then a diary page opens with a new entry of at most about 150 words *(tunable)*, above the welcome-back summary (TIM-03).
- **AC2** Given the entry, when I read it, then it is dated, written in a warm and funny voice, and mentions creatures by name.
- **AC3** Given I dismiss the page, when I want it back, then I can open it from the journal (JRN-03).
- **AC4** Given I return several times within 4 hours, when the planet loads, then no new entry is written.

#### JRN-02 Journal stays true to facts — Must
The journal entry is based on the event log. The AI may add harmless colour (feelings, small jokes, what creatures "thought"), but must not invent changes to the planet.

- **AC1** Given the event log for my absence, when the entry is written, then every concrete event mentioned (blooms, arrivals, gifts, fulfilled wants) is in the event log.
- **AC2** Given the entry is written, when I compare it with my planet, then it never claims something exists or happened that didn't (for example a creature I don't have, or a gift I didn't get).
- **AC3** Given nothing much happened, when the entry is written, then it is still a short, cosy entry (for example about the weather or a creature's nap) without inventing events.
- **AC4** Given the AI is unavailable, when an entry is due, then a template-based entry is written from the event log (AIB-05).

#### JRN-03 Journal book — Must
- **AC1** Given I open the journal, when it shows, then I can page through all entries, newest first.
- **AC2** Given important moments (first bloom, each creature's arrival, planet growth), when they happen, then they are marked in the journal so I can find them.

---

### 8.11 Social features (SOC)

**User stories**

- **US-SOC-1** As Sara, I want my friends to visit my planet, so that I can show it off. → SOC-01, SOC-02, SOC-03
- **US-SOC-2** As Sara, I want to leave gifts and reactions on a friend's planet without needing to chat, so that we can be nice to each other in a simple way. → SOC-04, SOC-05
- **US-SOC-3** As Sara, I want to send a creature on vacation to a friend's planet and hear about its trip when it comes back. → SOC-06
- **US-SOC-4** As Mia, I want my planet to be private unless I choose otherwise. → SOC-01
- **US-SOC-5** As a player, I want to browse other people's planets for inspiration. → SOC-07
- **US-SOC-6** As a player, I want to report a planet with an inappropriate name. → SOC-08

#### SOC-01 Planet visibility — Should
Three settings: **Private** (default; nobody can visit), **Friends with link** (anyone with my visit link), **Public** (also listed in the galaxy, SOC-07; Could).

- **AC1** Given I have just created my planet, when I check visibility, then it is Private.
- **AC2** Given my planet is Private, when someone opens an old visit link, then they see "This planet is resting" and nothing else.
- **AC3** Given I change visibility, when I save, then it takes effect immediately for new visits.

#### SOC-02 Visit link — Should
- **AC1** Given my planet is "Friends with link", when I choose "Invite a friend", then I get a link and a short code that I can copy.
- **AC2** Given I choose "Make a new link", when I confirm, then the old link and code stop working.

#### SOC-03 Visit mode — Should
- **AC1** Given I open a friend's visit link and I am signed in, when the planet loads, then I can rotate, zoom and inspect plants and creatures, and the planet name and owner's display name are shown.
- **AC2** Given I am visiting, when I try to plant, water, move the sun, move items or chat, then these actions are not available.
- **AC3** Given I inspect a creature while visiting, when the card opens, then I see its name, species, personality summary and mood, but not its want, memory or chats.
- **AC4** Given I finish visiting, when I choose "Go home", then I return to my own planet.

#### SOC-04 Gifts — Should
- **AC1** Given I am visiting, when I choose "Leave a gift", then I can pick one seed or decoration from my own inventory, and it is removed from my inventory.
- **AC2** Given I have already left a gift on this planet today *(tunable)*, when I try again, then I'm told I can give again tomorrow.
- **AC3** Given someone left me a gift, when I next open my planet, then a parcel appears on the planet; opening it adds the item to my inventory and shows who sent it.
- **AC4** Given I receive a gift, when the journal entry is written, then the gift may be mentioned.

#### SOC-05 Stamps — Could
- **AC1** Given I am visiting, when I choose a stamp (for example heart, sparkle, laughing, flower), then it is added to the host's guestbook with my display name.
- **AC2** Given I own the planet, when I open the guestbook, then I see recent stamps and who left them.
- **AC3** Given stamps, when they are chosen, then only preset stamps exist; there is no free text.

#### SOC-06 Creature vacation — Should
- **AC1** Given a friend's planet is visible to me and the friend allows vacationers (a setting, off by default), when I choose "Send on vacation" on one of my creatures and pick that friend, then the creature leaves my planet and appears on theirs with a "on holiday" badge for 24 hours *(tunable)*.
- **AC2** Given a host planet, when one vacationer is already staying, then no other vacationer can be sent there until it leaves.
- **AC3** Given I host a vacationer, when I inspect it, then I see the same information as in visit mode (SOC-03 AC3); I cannot chat with it.
- **AC4** Given the vacation ends, when the creature returns, then I get a short AI-written postcard-style story of its trip, based only on what anyone visiting that planet could see (planet name, plants, decorations, creature names and personality summaries). It never includes the host's wants, memories or chats.
- **AC5** Given my creature is on vacation, when I choose "Call home", then it returns early and the story is still written.
- **AC6** Given the story, when it is written, then it is added to my journal and to the creature's memory.

#### SOC-07 Galaxy of public planets — Could
- **AC1** Given I open the galaxy, when it loads, then I see a selection of public planets shown as small planets I can click to visit.
- **AC2** Given the selection, when I choose "Show me others", then a new selection is shown.

#### SOC-08 Report a planet — Must (when SOC-03 is built)
- **AC1** Given I am visiting, when I choose "Report" and pick a reason (name, other), then the report is sent to the game owner (ADM-03) and I'm thanked.
- **AC2** Given I reported a planet, when I report it again, then the report isn't duplicated.

---

### 8.12 AI behaviour, safety and fallback (AIB)

This area applies to every AI feature: creature identities (CRT-03), wants (WNT-02), chat (CHT-01, CHT-05), journal (JRN-01) and vacation stories (SOC-06).

**User stories**

- **US-AIB-1** As any player, I want AI content to be kind, funny and safe, so that the game always feels cosy. → AIB-01, AIB-07
- **US-AIB-2** As a player, I want the game to work even when the AI is down, so that my play isn't interrupted. → AIB-04, AIB-05
- **US-AIB-3** As a player who is having a hard time, I want a creature to respond kindly and point me towards real help if needed. → AIB-03
- **US-AIB-4** As a player, I want to flag an AI message that feels wrong. → AIB-06
- **US-AIB-5** As the game owner, I want the AI to receive only what it needs, so that player data is protected. → AIB-02

#### AIB-01 Content rules — Must
- **AC1** Given any AI-created text, when it is shown, then it follows the rules in section 10.
- **AC2** Given an AI result breaks the rules or has the wrong form, when the game checks it, then it is not shown; the game tries once more and otherwise uses a fallback (AIB-05).

#### AIB-02 Data given to the AI — Must
- **AC1** Given an AI request, when it is made, then it contains only game information (planet state, creature identity and memory, event log) and, for chat, the player's own messages with that creature.
- **AC2** Given an AI request, when it is made, then it never contains the player's email address, sign-in details or another player's private data (wants, memories, chats).

#### AIB-03 Player wellbeing in chat — Must
- **AC1** Given I write that I'm sad or stressed, when the creature answers, then it responds kindly and gently, without making jokes about it.
- **AC2** Given I write something suggesting I'm in danger or thinking of hurting myself, when the game recognises it, then a calm out-of-character message appears, saying that real people can help, with a link to support resources, and the creature's answer is kind and doesn't continue the game banter.
- **AC3** Given such a message appeared, when I continue chatting, then the game works as normal.

#### AIB-04 Waiting for the AI — Must
- **AC1** Given any AI feature is working, when I wait, then an in-character or cosy waiting indicator is shown; the rest of the game stays usable.
- **AC2** Given an AI result takes longer than 15 seconds *(tunable)*, when the time runs out, then the fallback is used for that request.

#### AIB-05 Fallback for every AI feature — Must

| AI feature | Fallback |
|---|---|
| Creature identity | Pre-written identities per species (at least 10 per species) |
| Wants | Pre-written wants per species and want type, filled in with the planet's real items |
| Chat | Pre-written in-character lines saying the creature is napping and to try later |
| Journal | Template entry built from the event log |
| Vacation story | Template postcard using the host planet's name and visible plant types |
| Creature-to-creature exchange | Not shown |

- **AC1** Given the AI is unavailable, switched off (ADM-01) or over its limit, when any AI feature is needed, then the fallback is used and no technical error is shown to the player.
- **AC2** Given a fallback was used for a creature identity or a want, when the AI is available again, then the fallback content is kept (identities are not swapped later).

#### AIB-06 Flag AI content — Should
- **AC1** Given any AI-written text (chat answer, journal entry, want, story), when I choose "This seems off", then it is sent to the game owner for review (ADM-03) and I'm thanked.
- **AC2** Given I flagged a chat answer, when it is flagged, then it is hidden from my chat view.

#### AIB-07 Consistency with identity and species — Should
- **AC1** Given a creature's identity, when it speaks in chat, wants or stories, then it keeps its name, traits and speaking style.
- **AC2** Given a species, when the creature describes what it does, then it fits the species (a snail doesn't fly; a moth likes lamps).

---

### 8.13 Settings and accessibility (SET)

**User stories**

- **US-SET-1** As a player, I want to control music and sound. → SET-01
- **US-SET-2** As a player with low vision or colour blindness, I want to read text comfortably and see plant needs without relying on colour. → SET-02, SET-04
- **US-SET-3** As a player sensitive to motion, I want to reduce animation. → SET-03
- **US-SET-4** As a player who can't use a mouse, I want to play fully with a keyboard. → SET-05
- **US-SET-5** As a player on a tablet, I want to play with touch. → SET-06
- **US-SET-6** As a player (or a parent), I want to switch off chatting with creatures but keep the rest of the game. → SET-07

#### SET-01 Audio — Must
- **AC1** Given I open settings, when I adjust music or sound effects, then each has its own volume and mute, and the change is heard immediately.
- **AC2** Given I change audio settings, when I return on any device, then they are remembered.

#### SET-02 Text size — Should
- **AC1** Given I choose a larger text size (at least 3 sizes), when I apply it, then all cards, menus, chat and journal use it without text being cut off.

#### SET-03 Reduced motion — Must
- **AC1** Given I switch on reduced motion, or my device asks for reduced motion, when I play, then idle animation, camera swoops and celebrations are reduced or replaced with simple fades.

#### SET-04 Not relying on colour — Must
- **AC1** Given any status (plant needs, mood, allowed/not allowed spot), when it is shown, then it uses an icon or text as well as colour.

#### SET-05 Keyboard-only play — Must
- **AC1** Given I use only a keyboard, when I play, then I can do everything a mouse user can: rotate, zoom, select plants, creatures, clouds and sun, plant, water, move items, open cards, chat and use menus.
- **AC2** Given I use the keyboard, when something is selected, then it is clearly highlighted.

#### SET-06 Touch — Should
- **AC1** Given I use a touch screen, when I play, then drag rotates, pinch zooms, tap inspects, and I can plant, water and move items without a mouse.

#### SET-07 Switch off chat — Could
- **AC1** Given I switch off chat in settings, when I open a creature's card, then the Chat button is hidden; all other AI features continue.

---

### 8.14 Game-owner administration (ADM)

**User stories**

- **US-ADM-1** As the game owner, I want to switch off all AI features instantly, so that I can react if something goes wrong. → ADM-01
- **US-ADM-2** As the game owner, I want to set limits on AI use, so that costs stay predictable. → ADM-02, ADM-04
- **US-ADM-3** As the game owner, I want to review reports and flagged AI content, so that the game stays a nice place. → ADM-03

#### ADM-01 Global AI switch — Must
- **AC1** Given I am the game owner, when I switch AI features off, then within 1 minute every player gets fallback behaviour (AIB-05), without any error.
- **AC2** Given I switch AI features back on, when players continue, then AI features resume.
- **AC3** Given a player who is not the game owner, when they use the game, then they have no access to any administration.

#### ADM-02 Limits — Should
- **AC1** Given I open the limits page, when I change the daily chat limit per player (CHT-03) or the game-wide daily AI budget, then the new limit applies from the next request.
- **AC2** Given the game-wide daily AI budget is reached, when any player needs an AI feature, then the fallback is used until the next day.

#### ADM-03 Moderation — Should (Must when SOC-03 is built)
- **AC1** Given reported planets and flagged AI content, when I open the moderation list, then I see each item with its reason, date and the text concerned.
- **AC2** Given a reported planet name, when I choose "Reset name", then the planet gets a neutral name (for example "Planet 4821") and the owner is asked to choose a new one next time they play.
- **AC3** Given an item, when I choose "Dismiss", then it leaves the list.

#### ADM-04 Usage overview — Could
- **AC1** Given I open the overview, when it loads, then I see per day: active players, AI requests by feature, how often fallbacks were used and how much of the AI budget was spent.

---

## 9. Non-functional requirements

These describe qualities the game must have, stated as observable outcomes rather than technical solutions.

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| NFR-01 | **Browsers.** The game runs in the current versions of Chrome, Edge, Firefox and Safari on desktop. | Must | All Must requirements pass in each of these browsers. |
| NFR-02 | **Smooth play.** The 3D view feels smooth on an ordinary laptop from the last 4 years. | Must | On such a laptop, with a full planet (max plants and creatures), the view stays at or above 30 frames per second during normal play, aiming for 60. |
| NFR-03 | **Fast start.** The game is quick to open. | Must | On a typical home broadband connection, a returning player sees their planet within 10 seconds of opening the game. A loading screen with Pip is shown meanwhile. |
| NFR-04 | **No physical or reflex demands.** Nothing requires speed, precise timing or body movement. | Must | Every action can be done slowly, with pauses, and with mouse, keyboard or touch only. No camera, microphone or motion sensors are used. |
| NFR-05 | **Accessible interface.** The 2D interface (menus, cards, chat, journal, settings) meets WCAG 2.1 level AA. | Must | An accessibility check of the 2D interface finds no AA failures. Information shown in the 3D view is also available as text in a card. |
| NFR-06 | **Privacy.** Only data needed for the game is stored, and players stay in control. | Must | A privacy notice explains what is stored and why. Chat history is kept until the player deletes it (CHT-04) or the account (ACC-05). The game complies with GDPR. |
| NFR-07 | **No lost progress.** | Must | See ACC-03: at most 30 seconds of play can be lost in a crash. |
| NFR-08 | **Fair shared actions.** Actions that affect other players follow the rules. | Must | A player cannot give gifts they don't own, visit private planets, or change another player's planet, even by tampering with the browser. |
| NFR-09 | **Capacity.** The first release supports a small community. | Should | At least 1,000 registered players and 100 playing at the same time without noticeable slowdown. |
| NFR-10 | **Predictable AI cost.** | Must | AI use per player per day is capped (CHT-03, ADM-02) and the game-wide daily budget is never exceeded. |
| NFR-11 | **Consistent tone.** All text, scripted or AI, follows section 10. | Must | A review of all scripted text and a sample of 50 AI outputs per feature finds no breaches. |
| NFR-12 | **AI response time.** | Should | 90% of chat answers start appearing within 5 seconds; journal entries are ready within 10 seconds of the planet loading. |

---

## 10. AI content and tone rules

These rules apply to every piece of AI-created text and also to scripted text (Pip, fallbacks, interface).

### 10.1 Always

- Warm, kind, playful and a little absurd.
- Humour comes from the creature's own quirks and the small world of the planet.
- Suitable for all ages.
- In character: the creature's name, traits, speaking style and species stay consistent.
- True to the game: what is said about the planet matches the planet's actual state and the event log.
- Short: identities ≤ 3 sentences of backstory, wants ≤ 2 sentences, chat answers ≤ about 60 words, journal entries ≤ about 150 words, vacation stories ≤ about 100 words *(all tunable)*.
- English.

### 10.2 Never

- Violence, scary content, romance or sexual content, swearing, alcohol, drugs, politics, religion, or real people and brands.
- Names of well-known fictional characters or celebrities as creature names.
- Guilt-tripping or pressuring the player to play more or come back ("I was so lonely without you", "you forgot about us").
- Begging, sulking or negative moods beyond "a bit wistful".
- Asking for personal information (real name, age, location, school, contact details, photos).
- Advice about real-world matters (health, money, legal, homework). The creature steers back to the planet playfully.
- Claiming to be a real person or a real animal. If asked, the creature happily says it lives on a tiny planet in a game.
- Revealing one player's private information (wants, memories, chats) to another player.

### 10.3 Examples

| Situation | Fine | Not fine |
|---|---|---|
| Player returns after a week | "We kept your bench warm. Mostly Bartholomew did, by sitting on it." | "Where were you? We thought you'd abandoned us." |
| Player asks for homework help | "Sums? I only count in leaves. Seven, by the way, on that fern." | Solves the homework. |
| Player asks "are you real?" | "Real as a snail on a ball-sized planet can be!" | "Yes, I'm a real snail." |
| Journal with few events | "A quiet day. Mira the moth stared at the lamp-post for six hours and called it 'research'." | "Mira found a hidden treasure chest!" (not in the event log) |

---

## 11. Tunable parameters

Starting defaults referenced in the requirements. The product owner may change them during play-testing.

| Parameter | Default | Used in |
|---|---|---|
| Planet name length | 2–24 characters | ACC-02 |
| Maximum progress lost in a crash | 30 seconds | ACC-03 |
| Time to first bloom in tutorial | ≤ 10 minutes | ONB-02 |
| Maximum plants per planet | 60 (rises with planet growth) | GRD-01, GRD-09 |
| Cloud refill time | 60 seconds | GRD-02 |
| Sun returns to drifting after | 5 minutes | GRD-03 |
| Growth speed with one need unmet | 50% | GRD-04 |
| Seeds per harvest | 1–2 | GRD-08 |
| Harvest cooldown per plant | 1 hour | GRD-08 |
| Planet growth milestone | 20 blooming plants | GRD-09 |
| Starter seed types | 3 | ITM-04 |
| Delay before a creature arrives | 2 minutes of play | CRT-01 |
| Minimum time between arrivals | 30 minutes | CRT-01 |
| Maximum creatures per planet | 8 | CRT-02 |
| Maximum creatures per species | 2 | CRT-02 |
| Overjoyed to gift | 1 day | CRT-04 |
| Creature name length | 1–20 characters | CRT-06 |
| New want cooldown | 1 hour | WNT-01 |
| Rewards that unlock something new | at least 1 in 3 | WNT-04 |
| Chat message length | 200 characters | CHT-01 |
| Chat answer length | about 60 words | CHT-01, section 10 |
| AI timeout | 15 seconds | CHT-01, AIB-04 |
| Chat messages per player per day | 30 | CHT-03 |
| Maximum away time calculated | 7 days | TIM-02 |
| Away time before welcome-back summary | 1 hour | TIM-03 |
| Away time before journal entry | 4 hours | JRN-01 |
| Journal entry length | about 150 words | JRN-01 |
| Gifts per visitor per planet | 1 per day | SOC-04 |
| Vacation length | 24 hours | SOC-06 |
| Game-wide daily AI budget | to be set by game owner | ADM-02 |

---

## 12. Open questions

| ID | Question | Why it matters | Current assumption |
|---|---|---|---|
| Q-1 | Where will the game be hosted: as a published claude.ai artifact using its built-in database and AI, or on its own servers? | Affects sign-in (ACC-01), who pays for AI use, and how the game is shared with friends. | Undecided; requirements are written to fit both. |
| Q-2 | May players under 13 play? | If yes, chat and social features need parental controls, and chat may need to be off by default. | 13+ (A-3). |
| Q-3 | Are touch screens and tablets needed for the first release? | Moves SET-06 from Should to Must and affects NFR-01. | Desktop first; touch is Should. |
| Q-4 | Are social features part of the first release? | SOC requirements and ADM-03 depend on it. | Should; can follow after the solo game. |
| Q-5 | Is play without an account (guest mode) wanted? | Lowers the barrier to trying the game but complicates saving and social features. | No guest mode. |
| Q-6 | Who makes the 3D models, music and sounds? | Affects the content catalogue (ITM-03, CRT-01) and art style. | Low-poly, using free-licensed or self-made assets. |
| Q-7 | Who signs off on the catalogue content and the humour voice? | Section 10 and the fallback pools need an owner. | Product owner. |
| Q-8 | What is the daily AI budget? | Sets ADM-02 and NFR-10. | To be decided before release. |

---

## 13. Requirements index

All functional requirements with their priority, in document order. Non-functional requirements are listed in section 9.

| ID | Requirement | Priority |
|---|---|---|
| ACC-01 | Sign in | Must |
| ACC-02 | Create and name a planet | Must |
| ACC-03 | Automatic saving | Must |
| ACC-04 | Continue on another device | Must |
| ACC-05 | Delete account | Must |
| ONB-01 | Guided tutorial by Pip | Must |
| ONB-02 | First bloom and first creature in the first session | Must |
| ONB-03 | Skip the tutorial | Should |
| NAV-01 | Rotate the planet | Must |
| NAV-02 | Zoom | Must |
| NAV-03 | Inspect plants, decorations and creatures | Must |
| NAV-04 | Living planet | Should |
| GRD-01 | Plant a seed | Must |
| GRD-02 | Water with clouds | Must |
| GRD-03 | Move the sun | Must |
| GRD-04 | Plant needs | Must |
| GRD-05 | Growth stages | Must |
| GRD-06 | Plants never die | Must |
| GRD-07 | Remove or move a plant | Must (remove), Should (move) |
| GRD-08 | Harvest seeds from blooms | Must |
| GRD-09 | Planet grows with the garden | Should |
| ITM-01 | Inventory | Must |
| ITM-02 | Place, move and remove decorations | Must |
| ITM-03 | Plant and decoration catalogue | Must |
| ITM-04 | Unlocking | Must |
| CRT-01 | Species and arrival conditions | Must |
| CRT-02 | Creature limits | Must |
| CRT-03 | AI-created identity | Must |
| CRT-04 | Mood | Must |
| CRT-05 | Creatures never leave for good | Must |
| CRT-06 | Rename a creature | Should |
| CRT-07 | Say goodbye to a creature | Could |
| WNT-01 | One want at a time | Must |
| WNT-02 | AI-created wants that can be fulfilled | Must |
| WNT-03 | Fulfilment | Must |
| WNT-04 | Rewards | Must |
| WNT-05 | Maybe later | Must |
| CHT-01 | Chat in character | Must |
| CHT-02 | Memory | Must |
| CHT-03 | Chat limits | Must |
| CHT-04 | View and delete chat history | Must |
| CHT-05 | Creatures talk to each other | Could |
| TIM-01 | Planet keeps living | Must |
| TIM-02 | Long absence is harmless | Must |
| TIM-03 | Welcome-back summary | Must |
| JRN-01 | Journal entry on return | Must |
| JRN-02 | Journal stays true to facts | Must |
| JRN-03 | Journal book | Must |
| SOC-01 | Planet visibility | Should |
| SOC-02 | Visit link | Should |
| SOC-03 | Visit mode | Should |
| SOC-04 | Gifts | Should |
| SOC-05 | Stamps | Could |
| SOC-06 | Creature vacation | Should |
| SOC-07 | Galaxy of public planets | Could |
| SOC-08 | Report a planet | Must (when SOC-03 is built) |
| AIB-01 | Content rules | Must |
| AIB-02 | Data given to the AI | Must |
| AIB-03 | Player wellbeing in chat | Must |
| AIB-04 | Waiting for the AI | Must |
| AIB-05 | Fallback for every AI feature | Must |
| AIB-06 | Flag AI content | Should |
| AIB-07 | Consistency with identity and species | Should |
| SET-01 | Audio | Must |
| SET-02 | Text size | Should |
| SET-03 | Reduced motion | Must |
| SET-04 | Not relying on colour | Must |
| SET-05 | Keyboard-only play | Must |
| SET-06 | Touch | Should |
| SET-07 | Switch off chat | Could |
| ADM-01 | Global AI switch | Must |
| ADM-02 | Limits | Should |
| ADM-03 | Moderation | Should (Must when SOC-03 is built) |
| ADM-04 | Usage overview | Could |

Totals: 74 functional requirements — Must 53, Should 15, Could 6. GRD-07 counts as Must (removing is Must, moving is Should). SOC-08 counts as Must but only applies once visiting (SOC-03) is built.
