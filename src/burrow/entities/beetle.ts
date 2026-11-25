import { beetleAt, countSoil, facingTowards, isTunnel, pebbleAt } from '../core/board';
import { findShortestPath, getNeighbors, manhattan, samePosition } from '../core/ai';
import {
	BURROW_BEETLE_APPEAR_FRAME,
	BURROW_BEETLE_CHASE_RANGE,
	BURROW_BEETLE_MIN_X,
	BURROW_BEETLE_PATIENCE,
	BURROW_BEETLE_SOIL_STEP,
	BURROW_BEETLE_TUNNEL_STEP,
	BURROW_EMPTY_GRAPH_BEETLES,
	BURROW_MAX_BEETLES,
	BURROW_SOIL_PER_BEETLE,
	BURROW_WAKE_FRAMES,
	GRID_HEIGHT,
	GRID_WIDTH
} from '../core/constants';
import { Random } from '../core/random';
import { Beetle, BurrowStore, Position } from '../types';

/** Beetles start spread across the right of the graph, in open tunnels where possible. */
export const placeBeetles = (store: BurrowStore, random: Random): Beetle[] => {
	const soilCells = countSoil(store.soil);
	const count =
		soilCells === 0 ? BURROW_EMPTY_GRAPH_BEETLES : Math.min(BURROW_MAX_BEETLES, 1 + Math.floor(soilCells / BURROW_SOIL_PER_BEETLE));
	const span = (GRID_WIDTH - BURROW_BEETLE_MIN_X) / count;
	const beetles: Beetle[] = [];

	for (let i = 0; i < count; i++) {
		const fromX = Math.floor(BURROW_BEETLE_MIN_X + i * span);
		const toX = Math.floor(BURROW_BEETLE_MIN_X + (i + 1) * span);
		const cells: Position[] = [];
		for (let x = fromX; x < toX; x++) {
			for (let y = 0; y < GRID_HEIGHT; y++) {
				if (!pebbleAt(store, { x, y })) cells.push({ x, y });
			}
		}
		const tunnels = cells.filter((p) => isTunnel(store, p));
		const pool = tunnels.length > 0 ? tunnels : cells;
		if (pool.length === 0) continue;
		const spot = pool[Math.floor(random() * pool.length)];
		beetles.push({
			id: i,
			...spot,
			state: 'hidden',
			facing: 'left',
			drowsiness: 0,
			frozenFor: 0,
			lastHummedFrame: 0,
			moveCooldown: 0,
			stuckFrames: 0,
			timer: 0,
			spawn: { ...spot }
		});
	}
	return beetles;
};

/**
 * Where a beetle steps next. Close by, it chases the wombat through the tunnels; far away it half chases,
 * half ambles. With no tunnel leading to the wombat it ambles for a while, then squeezes through the soil.
 */
const pickBeetleStep = (store: BurrowStore, beetle: Beetle, random: Random): Position | null => {
	const { wombat } = store;
	const free = (p: Position) => !samePosition(p, wombat) && !pebbleAt(store, p) && !beetleAt(store, p, beetle);
	const nextToWombat = (p: Position) => manhattan(p, wombat) === 1;
	const tunnelSteps = getNeighbors(beetle).filter((p) => isTunnel(store, p) && free(p));
	const amble = () => (tunnelSteps.length > 0 ? tunnelSteps[Math.floor(random() * tunnelSteps.length)] : null);

	const tunnelPath = findShortestPath(beetle, (p) => isTunnel(store, p) && free(p), nextToWombat);
	if (tunnelPath) {
		beetle.stuckFrames = 0;
		if (tunnelPath.length === 0) return null; // already nibbling at the wombat's heels
		if (tunnelPath.length <= BURROW_BEETLE_CHASE_RANGE || random() < 0.5) return tunnelPath[0];
		return amble();
	}

	if (++beetle.stuckFrames < BURROW_BEETLE_PATIENCE && tunnelSteps.length > 0) return amble();
	if (nextToWombat(beetle)) return null;
	return findShortestPath(beetle, free, nextToWombat)?.[0] ?? null;
};

/**
 * Advances every beetle by one frame: peeking out, dozing or wobbling off home, drowsiness wearing off, and
 * stepping (more slowly through soil than through tunnels) unless it is stopped to listen to the wombat.
 */
export const updateBeetles = (store: BurrowStore, frame: number, random: Random) => {
	for (const beetle of store.beetles) {
		if (beetle.state === 'hidden' && frame >= BURROW_BEETLE_APPEAR_FRAME) beetle.state = 'awake';

		if (beetle.state === 'asleep' || beetle.state === 'dizzy') {
			if (--beetle.timer <= 0) beetle.state = 'gone';
			continue;
		}
		if (beetle.state !== 'awake') continue;

		if (beetle.drowsiness > 0 && frame - beetle.lastHummedFrame >= BURROW_WAKE_FRAMES) {
			beetle.drowsiness--;
			beetle.lastHummedFrame = frame;
		}
		if (beetle.frozenFor > 0) {
			beetle.frozenFor--;
			continue;
		}
		if (beetle.moveCooldown > 0) {
			beetle.moveCooldown--;
			continue;
		}

		const step = pickBeetleStep(store, beetle, random);
		if (!step) continue;
		beetle.facing = facingTowards(beetle, step, beetle.facing);
		beetle.x = step.x;
		beetle.y = step.y;
		beetle.moveCooldown = (isTunnel(store, step) ? BURROW_BEETLE_TUNNEL_STEP : BURROW_BEETLE_SOIL_STEP) - 1;
	}
};
