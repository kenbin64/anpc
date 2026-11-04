/**
 * THE ENGINE'S FRONT DOOR: everything a game or the Angular app needs, from one import.
 *
 *   import { generateNpc, advanceLife, decideAndRecord, createDice } from './engine';
 *
 * Nothing in the engine imports Angular, so this folder can be copied into any TypeScript or JavaScript
 * game as it is.
 */
export * from './npc.model';
export { createDice, type Dice } from './random';
export { recordEvent, changeField, shiftDial, eventsSince, readField } from './life-log';
export { calculateEffectiveStats, calculateEffectiveTemperament, calculateEffectiveWorkEthic, calculateFrailty, recordDeath } from './health';
export { decide, decideAndRecord, calculateChanceAgainstNature, type Situation, type Decision } from './nature';
export { advanceLife, CARE_BONUS } from './life-simulator';
export { advanceTogether, offerCare, type LivedTogether } from './together';
export { welcomeBirths } from './births';
export { proposeMarriage, recordMarriage, type Suitor } from './marriage';
export { court, type Gesture, type CourtshipResult } from './courtship';
export { ARCHETYPES, rollNumbers, isCreatureClass } from './archetypes';
export { exportNpc, importNpc, findProblems, type ImportResult } from './npc-format';
export { generateNpc } from './npc-generator';
export { registerExtras, createCrowd, promoteExtra, linkPromotion } from './extras';
export { buildStoryPrompt, type NpcRequest } from './story-prompt';
export { createOllamaWriter, createOllamaChat, type StoryWriter, type ChatModel, type OllamaOptions } from './story-writers';
export { checkAgainstWorld, mentionsOutsideWorld, type GateResult } from './world-gate';
export { chooseStrangeReaction, type StrangeReaction } from './strange-talk';
export { talkToNpc, type ConversationTurn } from './conversation';
export { checkConduct, CONDUCT_WARNING, type ConductResult, type ConductProblem } from './conduct-guard';
export { createSettlement, summonRoleHolder, type Settlement, type RoleSlot, type SettlementSize, type Summoned } from './settlement';
export { startScenario, catchUpScenario, type Scenario, type ScenarioPlan } from './scenario';
export { readGameDate, catchUpEveryone, type WorldClock } from './world-clock';
export {
  ERA_PROFILES, META_TERMS, SCOPE_ORDER, listImpliedRoles,
  type WorldSetup, type WorldMode, type EraName, type WorldScope, type EraProfile, type RoleTemplate,
} from './world-setup';
export { addDays } from './game-date';
