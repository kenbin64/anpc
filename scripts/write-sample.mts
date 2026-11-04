/** Writes a sample NPC that has lived one year, for checking against anpc.schema.json. */
import { writeFileSync } from 'node:fs';
import { advanceLife } from '../src/engine/life-simulator';
import { exportNpc } from '../src/engine/npc-format';
import { createDice } from '../src/engine/random';
import { buildTestNpc } from '../src/engine/test-npc';

writeFileSync('samples/bram-one-year.json', exportNpc(advanceLife(buildTestNpc(), '1201-01-01', createDice('sample'))));
