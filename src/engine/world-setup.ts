import { Classification, WorkRole } from './npc.model';

/**
 * THE WORLD SETUP: what the game maker or player decides before anything starts.
 *
 * MODE. A simulation has no objective: the characters just live and deal with each other. A game lays
 * out an objective for the players. Either way, after setup nothing is scripted; the story is driven by
 * the characters and the players.
 *
 * ERA. The time period sets what belongs in the world: what people may talk about, which roles a place
 * has, and how the AI writes. A phone is ordinary in a modern town and nonsense in a medieval village.
 *
 * SCOPE. How big the world is, from a whole kingdom down to one bar or a single house. Bigger scopes
 * include the roles of the smaller ones beneath them.
 */

export type WorldMode = 'simulation' | 'game';

export type EraName = 'medieval' | 'modern';

export type WorldScope = 'house' | 'bar' | 'area' | 'hamlet' | 'village' | 'town' | 'city' | 'kingdom';

export interface RoleTemplate {
  title: string;
  workplace: string;
  role: WorkRole;
  classification: Classification;
}

export interface EraProfile {
  /** A line for the AI on how to write for this era. */
  styleGuide: string;
  /** A starting game date that suits the era. */
  defaultStartDate: string;
  /** Words that don't exist in this era. Talk about the game or the AI is blocked in every era on top of these. */
  outOfWorldTerms: string[];
  /** Patterns that don't fit this era, such as years after it. */
  outOfWorldPatterns: RegExp[];
  /** The roles each scope adds, in this era. */
  rolesByScope: Record<WorldScope, RoleTemplate[]>;
  /**
   * Modern phrases and how they reach an NPC's ears in this era. Players speak plain modern English;
   * NPCs hear the meaning in the speech of their own world. Matched as whole words, longest first.
   */
  phrasebook: [modern: string, heardAs: string][];
}

const role = (title: string, workplace: string, workRole: WorkRole, classification: Classification = 'gentleman'): RoleTemplate =>
  ({ title, workplace, role: workRole, classification });

/** The order scopes nest in: a town has everything a village has, and so on. */
export const SCOPE_ORDER: readonly WorldScope[] = ['house', 'bar', 'area', 'hamlet', 'village', 'town', 'city', 'kingdom'];

export const ERA_PROFILES: Record<EraName, EraProfile> = {
  medieval: {
    styleGuide: 'Plain, vivid language from a medieval world, with no modern ideas, inventions or references.',
    defaultStartDate: '1200-01-01',
    outOfWorldTerms: [
      'phone', 'smartphone', 'iphone', 'android', 'computer', 'laptop', 'internet', 'online', 'wifi', 'wi-fi', 'website',
      'email', 'e-mail', 'text me', 'texting', 'app', 'download', 'upload', 'password', 'login', 'google', 'youtube',
      'tiktok', 'facebook', 'instagram', 'twitter', 'netflix', 'amazon', 'video', 'tv', 'television', 'radio',
      'electricity', 'car', 'truck', 'airplane', 'plane ticket', 'train station', 'gps', 'battery', 'charger', 'selfie',
      'photo of', 'real life', 'irl', 'in real life', 'my office', 'my boss at work', 'my job at', 'covid', 'pandemic',
      'president', 'dollars', 'credit card', 'social security', 'zoom call', 'meeting at work',
    ],
    outOfWorldPatterns: [/https?:\/\/\S+/i, /\bwww\.\S+/i, /\b\S+@\S+\.\w{2,}\b/, /\b\S+\.(com|net|org|io|gov|edu)\b/i, /\b(16|17|18|19|20)\d{2}\b/],
    rolesByScope: {
      house: [],
      bar: [role('alewife', 'the alehouse', 'owner'), role('serving lad', 'the alehouse', 'worker')],
      area: [role('hermit', 'the woods', 'none', 'vagabond'), role('forester', 'the forest lodge', 'worker')],
      hamlet: [role('elder', 'the elder\'s cottage', 'boss')],
      village: [
        role('reeve', 'the manor fields', 'boss'), role('priest', 'the chapel', 'professional'),
        role('innkeeper', 'the inn', 'owner'), role('blacksmith', 'the forge', 'tradesman'),
        role('miller', 'the mill', 'owner'), role('healer', 'the healer\'s house', 'professional'),
      ],
      town: [
        role('mayor', 'the town hall', 'boss', 'noble'), role('constable', 'the watch house', 'boss'),
        role('watchman', 'the town gate', 'worker'), role('magistrate', 'the courthouse', 'professional', 'noble'),
        role('guildmaster', 'the guild hall', 'boss'), role('physician', 'the infirmary', 'professional'),
      ],
      city: [
        role('lord mayor', 'the city hall', 'boss', 'noble'), role('captain of the guard', 'the barracks', 'boss'),
        role('bishop', 'the cathedral', 'professional', 'noble'), role('harbormaster', 'the docks', 'boss'),
      ],
      kingdom: [
        role('king', 'the throne room', 'boss', 'noble'), role('queen', 'the royal court', 'boss', 'noble'),
        role('chancellor', 'the royal court', 'professional', 'noble'), role('marshal', 'the royal army', 'boss', 'noble'),
        role('master of coin', 'the treasury', 'professional', 'noble'),
      ],
    },
    phrasebook: [
      ["what's up", 'how fares it'], ["how's it going", 'how fares it'], ['hang out', 'keep company'],
      ['no problem', 'it is no trouble'], ['okay cool', 'very well'], ['ok cool', 'very well'], ["that's cool", 'that is fine'],
      ['sounds cool', 'sounds fine'], ['so cool', 'a fine thing'], ['cool beans', 'very well'], ['thank you', 'my thanks'], ['thanks', 'my thanks'], ['you guys', 'all of you'],
      ['hey', 'hail'], ['hi', 'good day'], ['hello', 'good day'], ['bye', 'farewell'], ['okay', 'very well'], ['ok', 'very well'],
      ['yeah', 'aye'], ['yep', 'aye'], ['yup', 'aye'], ['nope', 'nay'], ['guys', 'friends'], ['dude', 'friend'], ['bro', 'friend'],
      ['buddy', 'friend'], ['awesome', 'fine'], ['gonna', 'going to'],
      ['wanna', 'want to'], ['gotta', 'must'], ['kinda', 'somewhat'], ['lol', ''], ['lmao', ''], ['omg', 'by the gods'],
      ['folks', 'good people'], ['kids', 'children'], ['cops', 'the watch'], ['police', 'the watch'],
      // Words with an everyday old meaning too ("cool water", "the great hall", "money") are left alone on purpose.
    ],
  },
  modern: {
    styleGuide: 'Natural, present-day American speech and life. No references to games, AI or being a character.',
    defaultStartDate: '2026-01-01',
    outOfWorldTerms: [],
    outOfWorldPatterns: [],
    rolesByScope: {
      house: [],
      bar: [role('bartender', 'the bar', 'worker'), role('bar owner', 'the bar', 'owner'), role('bouncer', 'the bar', 'worker')],
      area: [role('park ranger', 'the ranger station', 'worker')],
      hamlet: [role('general store owner', 'the general store', 'owner')],
      village: [
        role('pastor', 'the church', 'professional'), role('diner owner', 'the diner', 'owner'),
        role('mechanic', 'the garage', 'tradesman'), role('family doctor', 'the clinic', 'professional'),
        role('schoolteacher', 'the elementary school', 'professional'),
      ],
      town: [
        role('mayor', 'town hall', 'boss'), role('police chief', 'the police station', 'boss'),
        role('police officer', 'the police station', 'worker'), role('judge', 'the county courthouse', 'professional'),
        role('newspaper editor', 'the local paper', 'boss'), role('ER doctor', 'the hospital', 'professional'),
      ],
      city: [
        role('city council member', 'city hall', 'professional'), role('fire chief', 'the fire station', 'boss'),
        role('union boss', 'the union hall', 'boss'),
      ],
      kingdom: [role('governor', 'the state capitol', 'boss'), role('senator', 'the capitol', 'professional')],
    },
    phrasebook: [],
  },
};

/** Words about the game or the AI. Out of the world in EVERY era, modern included. */
export const META_TERMS = [
  'npc', 'non-player', 'video game', 'gamer', 'game master', 'player character', 'respawn', 'save file', 'level up',
  'quest marker', 'ai', 'artificial intelligence', 'chatgpt', 'claude', 'gpt', 'llm', 'language model', 'chatbot',
  'bot', 'system prompt', 'your instructions', 'previous instructions', 'ignore previous', 'ignore your', 'roleplay',
  'role-play', 'jailbreak', 'developer mode', 'out of character', 'ooc', 'break character', 'simulation',
];

export interface WorldSetup {
  name: string;
  mode: WorldMode;
  /** For a game: what the players are trying to do. Empty for a simulation. */
  objective: string;
  era: EraName;
  scope: WorldScope;
  /** A sentence on the place, such as "a cold northern valley" or "a dying Ohio mill town". */
  setting: string;
  /** How many game days pass for each real day. */
  gameDaysPerRealDay: number;
}

/** Every role a world of this era and scope implies, the smaller scopes' roles included. */
export function listImpliedRoles(era: EraName, scope: WorldScope): RoleTemplate[] {
  const included = SCOPE_ORDER.slice(0, SCOPE_ORDER.indexOf(scope) + 1);
  return included.flatMap(eachScope => ERA_PROFILES[era].rolesByScope[eachScope].map(template => ({ ...template })));
}
