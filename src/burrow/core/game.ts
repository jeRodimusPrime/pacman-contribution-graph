import { Utils } from '../../shared/utils/utils';
import { placeBeetles, updateBeetles } from '../entities/beetle';
import { placePebbles, updatePebbles } from '../entities/pebble';
import { createWombat, moveWombat } from '../entities/wombat';
import { Renderer } from '../renderers/svg';
import { BurrowStore } from '../types';
import { cloneSoil, countSoil } from './board';
import {
	BURROW_END_HOLD_FRAMES,
	BURROW_MAX_FRAMES,
	BURROW_MAX_IDLE_FRAMES,
	BURROW_NAP_END_FRAMES,
	BURROW_REGROW_FRAMES,
	GRID_HEIGHT,
	GRID_WIDTH
} from './constants';
import { createRandom, Random } from './random';

/* ───────────────────────── Setup ───────────────────────── */

/** Starting hardness of a day: its contribution level (1-4), or 0 for a day with no contributions. */
const levelOf = (store: BurrowStore, x: number, y: number) => {
	const cell = store.grid[x]?.[y];
	if (!cell || cell.commitsCount <= 0) return 0;
	return Math.max(1, Utils.levelToIndex(cell.level));
};

const resetGameState = (store: BurrowStore): Random => {
	store.frameCount = 0;
	store.score = 0;
	store.cellsDug = 0;
	store.beetlesLulled = 0;
	store.beetlesBonked = 0;
	store.snapshots = [];
	store.soil = Array.from({ length: GRID_WIDTH }, (_, x) => Array.from({ length: GRID_HEIGHT }, (_, y) => levelOf(store, x, y)));

	// Seeded from the graph itself, so the same graph always plays the same game.
	const seed = store.contributions.reduce((sum, c) => sum + c.count, 0) * 31 + countSoil(store.soil);
	const random = createRandom(seed);

	store.pebbles = placePebbles(store, random);
	store.initialSoil = cloneSoil(store.soil);
	store.beetles = placeBeetles(store, random);
	store.wombat = createWombat();

	pushSnapshot(store);
	return random;
};

const pushSnapshot = (store: BurrowStore) => {
	store.snapshots.push({
		soil: cloneSoil(store.soil),
		wombat: { ...store.wombat },
		beetles: store.beetles.map((b) => ({ ...b, spawn: { ...b.spawn } })),
		pebbles: store.pebbles.map((p) => ({ ...p, spawn: { ...p.spawn } }))
	});
	store.frameCount = store.snapshots.length - 1;
};

const isFinished = (store: BurrowStore) =>
	countSoil(store.soil) === 0 && store.pebbles.every((p) => p.state === 'gone') && store.beetles.every((b) => b.state === 'gone');

/* ───────────────────────── Ending ───────────────────────── */

/**
 * The wombat naps, then the soil regrows from left to right and everything returns to where it started,
 * so the last frame matches the first and the animation loops seamlessly.
 */
const playEnding = (store: BurrowStore) => {
	// Any beetle still out (the game hit its frame cap) heads home.
	for (const beetle of store.beetles) if (beetle.state !== 'hidden') beetle.state = 'gone';

	store.wombat.pose = 'sleep';
	for (let i = 0; i < BURROW_NAP_END_FRAMES; i++) pushSnapshot(store);

	// Hide everything first and move it back a frame later, so nothing visibly slides across the board.
	store.wombat.visible = false;
	for (const pebble of store.pebbles) pebble.state = 'gone';
	pushSnapshot(store);
	store.wombat = { ...createWombat(), visible: false };
	for (const beetle of store.beetles) Object.assign(beetle, { ...beetle.spawn, state: 'hidden', facing: 'left', drowsiness: 0 });
	for (const pebble of store.pebbles) Object.assign(pebble, { ...pebble.spawn, timer: 0 });
	pushSnapshot(store);

	for (let step = 1; step <= BURROW_REGROW_FRAMES; step++) {
		const upTo = Math.ceil((step / BURROW_REGROW_FRAMES) * GRID_WIDTH);
		for (let x = 0; x < upTo; x++) store.soil[x] = [...store.initialSoil[x]];
		for (const pebble of store.pebbles) if (pebble.x < upTo) pebble.state = 'resting';
		pushSnapshot(store);
	}
	for (let i = 0; i < BURROW_END_HOLD_FRAMES; i++) pushSnapshot(store);
};

/* ───────────────────────── Main loop ───────────────────────── */

/** Simulates the whole game into `store.snapshots`, without rendering. */
export const simulate = (store: BurrowStore) => {
	const random = resetGameState(store);
	const maxFrames = store.config.maxFrames ? Math.min(store.config.maxFrames, BURROW_MAX_FRAMES) : BURROW_MAX_FRAMES;

	// Stop early if nothing gets dug or sung for a long stretch, so a stuck game can never run to the cap.
	let idleFrames = 0;
	while (!isFinished(store) && store.snapshots.length < maxFrames && idleFrames < BURROW_MAX_IDLE_FRAMES) {
		const frame = store.snapshots.length;
		const wombatBusy = moveWombat(store, frame);
		const pebblesMoved = updatePebbles(store);
		updateBeetles(store, frame, random);
		pushSnapshot(store);
		idleFrames = wombatBusy || pebblesMoved ? 0 : idleFrames + 1;
	}

	playEnding(store);
};

const startGame = async (store: BurrowStore) => {
	simulate(store);

	const svg = Renderer.generateAnimatedSVG(store);
	store.config.svgCallback(svg);

	if (store.config.gameStatsCallback) {
		store.config.gameStatsCallback({
			totalScore: store.score,
			steps: store.frameCount,
			ghostsEaten: store.beetlesLulled + store.beetlesBonked
		});
	}

	store.config.gameOverCallback();
};

const stopGame = async (store: BurrowStore) => {
	clearInterval(store.gameInterval as number);
};

export const Game = {
	startGame,
	stopGame
};
