/**
 * Try the engine end to end from the command line, with no app:
 *   npx tsx scripts/try-generate.mts rogue "a widowed baker with a grudge against the miller"
 * It generates an NPC with the local Ollama model, lives one year of their life, and prints what happened.
 */
import { advanceLife } from '../src/engine/life-simulator';
import { Classification } from '../src/engine/npc.model';
import { generateNpc } from '../src/engine/npc-generator';
import { findProblems } from '../src/engine/npc-format';
import { createDice } from '../src/engine/random';
import { createOllamaWriter } from '../src/engine/story-writers';

const classification = (process.argv[2] ?? 'gentleman') as Classification;
const hints = process.argv[3] ?? '';
const seed = process.argv[4] ?? `${classification}-${hints}`;

const writer = createOllamaWriter({ model: process.env['ANPC_MODEL'] ?? 'llama3.1:8b', baseUrl: 'http://localhost:11434' });
const started = Date.now();
const npc = await generateNpc({ classification, setting: 'a small medieval village', hints, seed }, writer, '1200-01-01');
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(`Generated in ${seconds}s. Problems: ${findProblems(npc).length ? findProblems(npc).join('; ') : 'none'}`);
console.log(`${npc.name}, ${npc.age}, ${npc.species} ${npc.classification}, ${npc.maritalStatus}`);
console.log(`Job: ${npc.occupation ? `${npc.occupation.title} at ${npc.occupation.workplace} (${npc.occupation.role})` : 'none'}`);
console.log(`Nature: disposition ${npc.temperament.disposition}, honesty ${npc.temperament.honesty}, alignment ${npc.temperament.alignment}, randomness ${npc.temperament.randomness}`);
console.log(`Backstory: ${npc.backstory}`);
console.log(`Ties: ${npc.relationships.map(tie => `${tie.name} (${tie.kind}, ${tie.affinity})`).join(', ')}`);
console.log(`Groups: ${npc.affiliations.map(group => `${group.name} (${group.kind})`).join(', ') || 'none'}`);
console.log(`Abilities: ${npc.abilities.map(ability => ability.name).join(', ')}`);
console.log(`Routine: ${JSON.stringify(npc.routine)}`);

const lived = advanceLife(npc, '1201-01-01', createDice(seed));
const notable = lived.lifeLog.filter(event => event.kind !== 'created');
console.log(`\nOne year later (${lived.lifeLog.length} log entries, ${notable.length} notable):`);
for (const event of notable.slice(0, 15)) console.log(`  ${event.at} [${event.kind}] ${event.summary}`);
console.log(`Health ${lived.health.condition}${lived.health.alive ? '' : ' (DIED: ' + lived.health.death?.cause + ')'}, reputation ${lived.social.reputation}, age ${lived.age}`);
