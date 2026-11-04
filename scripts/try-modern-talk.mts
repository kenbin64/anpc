/**
 * A player talks in plain modern English; the NPC hears it in their own world's speech:
 *   npx tsx scripts/try-modern-talk.mts
 */
import { talkToNpc } from '../src/engine/conversation';
import { createDice } from '../src/engine/random';
import { createOllamaChat } from '../src/engine/story-writers';
import { buildTestNpc } from '../src/engine/test-npc';

const chat = createOllamaChat({ model: process.env['ANPC_MODEL'] ?? 'llama3.1:8b', baseUrl: 'http://localhost:11434' });
const player = { id: 'p1', name: 'Kestrel', description: 'a road-worn sellsword' };
let npc = buildTestNpc({ species: 'dwarf', temperament: { disposition: 60, honesty: 70, alignment: 65, randomness: 15 } });

for (const line of ["Hey dude, what's up? You make swords here?", "Okay cool, I'm gonna need one by Friday. Thanks!"]) {
  const turn = await talkToNpc(npc, player, line, chat, createDice('modern'), '1200-02-01', 'a small medieval village');
  npc = turn.npc;
  console.log(`\nPLAYER TYPED: ${line}`);
  console.log(`BRAM HEARD:   ${turn.gate.heardAs}`);
  console.log(`BRAM SAID:    ${turn.reply}`);
}
