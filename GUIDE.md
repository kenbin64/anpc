# How the ANPC app was built, layer by layer

The app was built in five layers, each one its own git commit, so the history tells the story in order. Every file opens with a comment naming the Angular piece it teaches and why it's built that way. Read the layers in order, and at each one run the app, open the files, and change something to see what happens.

To see the commits, run `git log --oneline` in this folder. To see exactly what one layer added, run `git show <commit>`.

## Run it

Ollama has to be running with llama3.1:8b, since the AI writes the characters and speaks for them.

```
cd C:\projects\anpc
npm start
```

Then open http://localhost:4200. To run all the tests, use `npx.cmd ng test --watch=false`.

## The shape of the whole app

The engine in `src/engine` is plain TypeScript with no Angular in it. It holds every rule of the world: who people are, how they live, how they talk, how they decide. The Angular app in `src/app` is the part a player touches. It sets worlds up, stores them, and turns typing into turns of play. The app calls the engine; the engine never knows the app exists. That's why any game could reuse the engine.

The flow of one turn runs like this. The player types into the play page. The page hands the text to the GameSession service, which parses it into a command and asks the engine what happens. The session writes the result into the transcript and saves the world through the WorldStore, which writes it into IndexedDB. The page redraws by itself, because everything it shows is a signal.

## Layer 1: storage

| File | What it teaches |
|---|---|
| `storage/key-value-store.ts` | An interface for storage, and an injection token that picks which one the app gets |
| `storage/indexed-db-store.ts` | IndexedDB, the browser's database: stores, transactions, and turning its events into Promises |
| `storage/memory-store.ts` | The same interface in memory, so tests never touch the browser's database |
| `storage/saved-world.ts` | The shape of one saved world: the engine's scenario plus the player's side of play |
| `storage/world-store.ts` | A service with a signal of saved worlds; relocking a world's rules after a load |

The idea to take away is that code asks for "storage", never for "IndexedDB". Swapping the database later, for a server or a file, changes one line.

## Layer 2: the skeleton

| File | What it teaches |
|---|---|
| `main.ts` | Bootstrapping: the one line that starts the app |
| `app.config.ts` | Providers that switch features on for the whole app, with no NgModule |
| `app.routes.ts` | Routes, lazy loading, route parameters as inputs, and guards |
| `game/world-exists.guard.ts` | A guard that waits for the database before letting a page open |
| `app.ts`, `app.html` | The shell: navigation, `routerLinkActive`, `@switch`, and the router outlet |
| `ai/ai-connection.ts` | A service that wraps the local AI and checks whether it's answering |

At this layer every page was a placeholder, so the whole frame could be built and tested before any screen existed.

## Layer 3: the setup page

| File | What it teaches |
|---|---|
| `pages/setup/setup.ts` | Signal Forms: one draft signal, a schema of rules, a rule on every item of a list, and a rule that applies only in game mode |
| `pages/setup/setup.html` | `[formRoot]`, `[formField]` on every kind of control, and looping over a list in the form |
| `pages/setup/setup.ts` again | `linkedSignal` for the roles, which rebuild when the scope changes |
| `game/unsaved-changes.guard.ts` | A leave guard that asks before losing an unlaunched setup |

## Layer 4: play

| File | What it teaches |
|---|---|
| `game/commands.ts` | Plain-TypeScript parsing: patterns that turn a sentence into a command |
| `game/game-session.ts` | A service provided by one page, not the whole app; one turn at a time through the engine |
| `pages/play/play.ts` | `ngOnInit`, `DestroyRef`, `viewChild`, and `afterRenderEffect` to keep the transcript scrolled |
| `pages/play/play.html` | Template references, key-filtered events like `(keydown.enter)`, and `@for` with `track $index` |
| `shared/transcript-line.ts` | A small presentational component with `host` classes |
| `shared/command-history.directive.ts` | An attribute directive with `host` key listeners and an input |
| `shared/time-of-day.pipe.ts` | A custom pure pipe |

## Layer 5: records

| File | What it teaches |
|---|---|
| `pages/worlds/worlds.ts` | Reading a service's signal, a two-step delete, and the built-in `date` pipe |
| `pages/person/person.ts` | `resource()`, which turns any Promise into loading, value and error signals; `computed` filtering |
| `pages/person/person.html` | `@if (...; as npc)` to unwrap a value once |

## The tests

Every layer has its tests beside it, as `.spec.ts` files. The storage test swaps IndexedDB for memory. The parser test is plain input and output. The game session test plays a real world built by the engine with a stand-in AI. Together with the engine's tests, that's 140 tests, all passing, and every layer was also played through in real Chrome with the real local AI before it was committed.

## What the live runs caught

Playing it for real found problems the tests didn't. A command typed while the AI was still answering was silently lost, so now it stays in the box. NPCs greeted a stranger by name as an old friend, so a first meeting now hears "a stranger". And the world gate worked live: asked "Do you have wifi here?", the baker answered "What manner of question be that?"
