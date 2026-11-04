/**
 * Generates an NPC, registers the people they know as extras, then promotes one into a full NPC:
 *   npx tsx scripts/try-promote.mts
 */
import { linkPromotion, promoteExtra, registerExtras } from '../src/engine/extras';
import { generateNpc } from '../src/engine/npc-generator';
import { findProblems } from '../src/engine/npc-format';
import { createOllamaWriter } from '../src/engine/story-writers';

const writer = createOllamaWriter({ model: process.env['ANPC_MODEL'] ?? 'llama3.1:8b', baseUrl: 'http://localhost:11434' });
const setting = 'a small medieval village';
const parent = await generateNpc(
  { classification: 'gentleman', setting, hints: 'the village blacksmith, proud of his work, quietly in debt', seed: 'gentleman-the village blacksmith, proud of his work, quietly in debt' },
  writer, '1200-01-01',
);
const { npc: registered, extras } = registerExtras(parent, '1200-01-01');
console.log(`${parent.name} knows: ${extras.map(extra => `${extra.name} (${extra.description})`).join('; ')}`);

const chosen = extras.find(extra => extra.knownBy[0].kind === 'child') ?? extras[0];
const started = Date.now();
const promoted = await promoteExtra(chosen, writer, setting, '1200-06-01');
const linked = linkPromotion(registered, promoted, '1200-06-01');

console.log(`\nPromoted in ${((Date.now() - started) / 1000).toFixed(1)}s. Problems: ${findProblems(promoted).join('; ') || 'none'}`);
console.log(`${promoted.name}, ${promoted.age}, ${promoted.classification}. Job: ${promoted.occupation?.title ?? 'none'}`);
console.log(`Backstory: ${promoted.backstory}`);
console.log(`Ties: ${promoted.relationships.map(tie => `${tie.name} (${tie.kind}${tie.npcId ? ', full NPC' : ''})`).join(', ')}`);
console.log(`Log: ${promoted.lifeLog[0].summary}`);
console.log(`${linked.name}'s tie now points at: ${linked.relationships.find(tie => tie.npcId === promoted.id)?.name ?? 'nobody'}`);
