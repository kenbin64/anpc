# ANPC, Autonomous NPCs

ANPC creates non-player characters that live their own lives. Each one has a backstory, a family, a job, friends and enemies, a church or guild, health, a reputation and a nature. Nothing about how they behave is scripted. When something happens, they answer from their own traits, and a randomness score decides how often they go against their nature.

They keep living when the game isn't looking. Weeks of work, nights at the tavern, illness, quarrels and birthdays are lived out and written into a life log. So when an NPC steps into play, they arrive up to date with everything that happened to them.

## How it's built

The engine in `src/engine` has no Angular in it, so any game can copy it in and use it. The Angular app around it is the workshop for creating, viewing and testing NPCs.

Making a character takes three steps. Code rolls every number from the classification, so the dice are fair and always in range. Then an AI writes the story to fit those numbers, so a character rolled at honesty 12 gets a past that explains it. Last, code checks and repairs whatever the AI sent before anything is saved. Nothing from the model reaches an NPC unchecked.

The AI runs on your own machine through Ollama, which keeps it free and private. It plugs in through one function shape, a StoryWriter, so Claude or any other model can replace it without touching the rest.

## Extras: the people in the background

Not everyone needs a simulated life. Extras are family members who get talked about but never seen, tavern regulars, and faces that fill a market. They're a name, a species, a line or two and a list of who knows them, so a village can hold hundreds at no cost.

When a player or an NPC chooses to deal with one, the extra is promoted. The AI writes a full NPC around what's already known, while their name, species and ties stay fixed. The ties then run both ways, so the blacksmith's tie to his wife points at her full record and hers points back at him. Her life log opens by saying she was known only as the blacksmith's wife until then.

Known limit: the small local model sometimes drifts from the facts it's given. In one test a blacksmith's promoted wife was described as helping at "the family forge" and, a sentence later, as "a merchant's wife." A larger model, or an automatic check of the backstory against the known facts, would close that gap.

## Setting up a world

Before anything starts, the game maker or player fills in the world setup in `world-setup.ts`. It has three parts.

The mode is either a simulation or a game. A simulation has no objective, so the characters just live their lives and deal with each other. A game lays out an objective for the players. Either way, nothing after setup is scripted.

The era is the time period, and it decides what belongs in the world. A phone is ordinary talk in a modern town and nonsense in a medieval village, so the world gate, the roles a place has and the way the AI writes all follow the era. Talk about the game itself or the AI is out of bounds in every era.

The scope is how big the world is, from a kingdom down to a town, a village, a hamlet, a small stretch of land, a single bar or one house. Each scope includes the roles of the smaller scopes beneath it, so a kingdom has a king and also a blacksmith, while a bar has just its alewife and serving lad.

We start with the medieval era. Other eras are expansions: each one is a single profile of words, roles and writing style, and adding one changes nothing else. A first draft of a modern-day profile is already there for when that expansion comes.

## Violence is play

Fights, theft, cruelty and death happen in the world, because a world without them isn't believable. None of it is real. A brawl costs an NPC health points and reputation, and nobody is hurt. The AI is told this as the writer, never in a character's voice, so it doesn't refuse or water down a fight the story calls for, and it keeps things free of gore. The characters themselves still never know they're in a game.

## What is never allowed

Ordinary combat belongs in the game: fists, swords, brawls, duels, even death in battle. Sexual content of any kind, sexual violence, and cruelty beyond normal fighting, such as torture or mutilation, are never allowed, in any era.

When a player's message crosses that line, it's stopped before anything else happens. The AI never sees it, no NPC hears it, nothing is written to any life log, and no trust or reputation changes. The player gets a plain warning that the simulation doesn't allow it, and the NPC carries on as if nothing was said. The same check runs on everything the AI writes, from backstories to spoken replies, and anything that crosses the line is thrown out. The writer's note in every prompt tells the model the same rules as a second line of defense, because no word list catches every phrasing.

Every ANPC, man or woman, chooses for themselves whether to accept a suitor, so affection has to be earned. A suitor courts them over time with small gestures: kind words, a small gift, a helping hand, a walk together, a song. Each gesture lands or falls flat by the ANPC's own nature and how they already feel. An ANPC who is married, or who dislikes the suitor, isn't open to courting at all, and keeping on after they've made that clear only costs the suitor more.

Players can marry each other or an ANPC, and an ANPC can marry another ANPC. A marriage here is a living arrangement: they share a home and a life, and the log says so plainly. An ANPC answers a proposal by how they feel about the suitor, so deep affection means yes, and someone already married always says no. Two players marrying each other is kept in the game's own records, since players don't keep life logs.

Married couples may have children in the natural course of life. The log says only that a child was born, and nothing about how is ever described or acted out. The newborn arrives as an extra known to both parents, and becomes a full ANPC only if the story brings them into a scene.

## Who drives the story

The game maker, or a player, sets up the opening scenario: the place, the starting cast and any roles that need filling from the start. That is the only scripted part. From then on the story is driven entirely by the characters and the players. Nothing is planned in advance; events come out of the dice, each NPC's nature, and what the people around them choose.

The world keeps moving while the app is off. Each scenario has a world clock set by the game maker, such as one game week per real day. Every time the app starts, the whole cast catches up to today's game date, living their weeks together so their lives can touch.

Here is how that plays out. A miller's worker falls ill; nobody scripted it, it came from the dice and the worker's age and habits. The people tied to him each decide whether to pay for his treatment, by their own nature and by how much they care about him. A kind miller pays, which makes recovery more likely, earns him reputation and earns the worker's gratitude. A cold one refuses, and the worker thinks less of him, and may die. Either way, both lives record it, so when the players next walk into the mill, the history is already there.

The log keeps what matters in play, not every moment. Fights, illness, recoveries, choices, conversations and deaths get their own entries. Ordinary living is rolled into one summary per stretch, listing the net change to every number that moved and why.

## Who is in the world, from heaviest to lightest

Full NPCs live simulated lives and keep a life log. Extras are people someone knows by name, such as a blacksmith's wife or a tavern regular, and they cost almost nothing until promoted. Implied roles are lighter still: every town has a mayor and a constable, but until the story needs one, the role is only a line in the town's list, with no person behind it yet. The first time anyone deals with the constable, a full NPC is made to fit the office, and the same person holds it from then on.

The rule for crossing from implied to real is being in a scene. If the miller pays for a sick worker's treatment, the healer who treats him stays implied: the treatment just happens. If someone organizes a fundraiser and the physician attends, or a player walks into the infirmary, then the physician is in the scene and is created as a full ANPC. Talking about someone never creates them.

A scenario gets the ball rolling. It opens with a starting cast of full NPCs, some written from a request and some filling the roles the story needs from the first moment, such as the innkeeper the players walk in on. Everyone the cast talks about becomes an extra, and every other role stays implied. The world grows only where the story goes.

## Human players and the edge of the world

Player characters are real humans who talk to NPCs directly. Anything they say that doesn't belong in the world, such as phones, the internet, their job, the game itself, or an attempt to talk the AI out of its role, is nonsense to the NPC. That keeps the real world from bleeding into the game, and it stops a player from steering the AI.

It works in three layers. Plain code finds the out-of-world words and blanks them out, so the AI never sees them; it only learns the stranger said something strange. The AI answers in character under rules that keep it inside its world. Then its reply is checked on the way out, and a reply that mentions anything outside the world is swapped for a plain line that fits.

How the NPC takes strange talk comes from its nature. A short temper turns defensive, kindness and good sense turn concerned, most turn suspicious, and a creature that can't speak just goes wary. Each time costs the stranger some trust, which carries into later talks. In a live test, a polite question raised trust to 51, then wifi talk, a "you are ChatGPT" attempt and talk about a boss at work brought it down to 21, and the blacksmith stayed cold after that.

Word lists can't catch every real-world phrase, which is why the AI's own rules and the reply check sit behind them.

## The engine, file by file

| File | Its one job |
|---|---|
| `npc.model.ts` | The NPC format: every trait, and what each 0 to 100 dial means at each end |
| `random.ts` | Seeded dice, so the same seed always gives the same life |
| `life-log.ts` | The only way an NPC changes; every change is logged with its reason |
| `health.ts` | How illness and injury weaken stats, temper and work, and how death is recorded |
| `nature.ts` | How an NPC decides: their nature, against a randomness that tops out at a coin flip |
| `life-simulator.ts` | Lives an NPC forward week by week while the game is elsewhere |
| `archetypes.ts` | What each classification tends toward, and the dice that roll the numbers |
| `story.ts` | The shape the AI must answer in, and the repair of whatever it sends |
| `story-prompt.ts` | What the AI is told before it writes |
| `story-writers.ts` | The plug for an AI, with the Ollama writer |
| `npc-generator.ts` | Puts the numbers and the story together into a complete NPC |
| `npc-format.ts` | Export and import as JSON, with checks before trusting a file |
| `extras.ts` | Background people, crowds to fill a room, and promotion into full NPCs |
| `world-setup.ts` | Mode, era and scope; each era's words, roles and writing style |
| `settlement.ts` | Places and their implied roles, filled only when the story needs them |
| `scenario.ts` | The starting cast that opens a scenario, and catching it up when the app starts |
| `world-clock.ts` | Real time to game time, at the speed the game maker chooses |
| `together.ts` | NPCs living each week side by side, starting with care for the sick |
| `births.ts` | Children born to married couples, recorded plainly, arriving as extras |
| `courtship.ts` | Earning affection over time; every ANPC can accept or turn a suitor away |
| `marriage.ts` | Proposals and marriages, as a shared home and life |
| `conduct-guard.ts` | What is never allowed, checked on players' words and on everything the AI writes |
| `world-gate.ts` | Finds and blanks out anything a human player says from outside the world |
| `strange-talk.ts` | How an NPC reacts to strange talk, by its nature |
| `conversation.ts` | A player talking to an NPC, through all three layers |
| `index.ts` | The front door: one import for a game |

`anpc.schema.json` publishes the NPC format for games written in other languages. It's generated from `npc.model.ts`, so the two can't drift apart.

## Try it

These need Ollama running with llama3.1:8b. The first generates an NPC, lives one year and prints what happened. The second runs the engine tests.

```
cd C:\projects\anpc
npx.cmd tsx scripts/try-generate.mts rogue "a widowed baker with a grudge against the miller"
npx.cmd tsx scripts/try-promote.mts
npx.cmd tsx scripts/try-talk.mts
npx.cmd ng test --watch=false
```

## The screens, built one at a time

Ken directs each screen and Claude builds it. Each one practices a different part of Angular.

| Order | Screen | Angular it practices |
|---|---|---|
| 1 | NPC request form: classification, setting, hints, seed | Signal Forms, validation |
| 2 | Generate button that calls the AI and shows progress | Services, async, loading and error states |
| 3 | NPC sheet with every trait and dial | Components, inputs, computed, pipes |
| 4 | Life log timeline with filters | @for with track, signals, a custom pipe |
| 5 | Live forward: advance a month or a year | Calling the engine, effects |
| 6 | Situation tester: insult them, tempt them, watch them choose | Outputs, event binding |
| 7 | Family and relationship view | Child components, recursion |
| 8 | Save, export and import JSON | Files in the browser, the format checks |
| 9 | The village: several NPCs who know each other, lived forward together | Routing, a shared store, the big test |
