import { Utils } from '../../shared/utils/utils';
import { Renderer } from '../renderers/svg';
import { Beetle, BurrowStore, Facing, Pebble, Position } from '../types';
import { findCheapestPath, findShortestPath, getNeighbors, inBounds, manhattan, samePosition } from './ai';
import {
	BURROW_BEETLE_APPEAR_FRAME,
	BURROW_BEETLE_CHASE_RANGE,
	BURROW_BEETLE_MIN_X,
	BURROW_BEETLE_PATIENCE,
	BURROW_BEETLE_SOIL_STEP,
	BURROW_BEETLE_TUNNEL_STEP,
	BURROW_BONK_POINTS,
	BURROW_DEN,
	BURROW_END_HOLD_FRAMES,
	BURROW_FREEZE_FRAMES,
	BURROW_LANTERN_COOLDOWN,
	BURROW_LANTERN_HOLD_FRAMES,
	BURROW_LANTERN_RANGE,
	BURROW_LEVEL_POINTS,
	BURROW_LULL_HITS,
	BURROW_LULL_POINTS,
	BURROW_MAX_BEETLES,
	BURROW_MAX_FRAMES,
	BURROW_MAX_IDLE_FRAMES,
	BURROW_MAX_PEBBLES,
	BURROW_NAP_END_FRAMES,
	BURROW_NAP_FRAMES,
	BURROW_PEBBLE_CRUMBLE_FRAMES,
	BURROW_PEBBLE_DANGER_COST,
	BURROW_PEBBLE_SPACING,
	BURROW_PEBBLE_WOBBLE_FRAMES,
	BURROW_REGROW_FRAMES,
	BURROW_SWEEP_WIDTH,
	BURROW_WAKE_FRAMES,
	GRID_HEIGHT,
	GRID_WIDTH
} from './constants';
import { createRandom, Random } from './random';

/* ───────────────────────── Board queries ───────────────────────── */

const cloneSoil = (soil: number[][]) => soil.map((column) => [...column]);

const soilAt = (store: BurrowStore, p: Position) => (inBounds(p) ? store.soil[p.x][p.y] : 0);

const isTunnel = (store: BurrowStore, p: Position) => inBounds(p) && store.soil[p.x][p.y] === 0;

const countSoil = (soil: number[][]) => soil.reduce((sum, column) => sum + column.filter((h) => h > 0).length, 0);

const isSolidPebble = (pebble: Pebble) => pebble.state !== 'gone';

const pebbleAt = (store: BurrowStore, p: Position) => store.pebbles.find((pebble) => isSolidPebble(pebble) && samePosition(pebble, p));

const isActiveBeetle = (beetle: Beetle) => beetle.state === 'awake' || beetle.state === 'asleep' || beetle.state === 'dizzy';

const beetleAt = (store: BurrowStore, p: Position, except?: Beetle) =>
	store.beetles.find((beetle) => beetle !== except && isActiveBeetle(beetle) && samePosition(beetle, p));

const facingTowards = (from: Position, to: Position, current: Facing): Facing =>
	to.x > from.x ? 'right' : to.x < from.x ? 'left' : current;

/** A cell under a pebble that is about to come down. */
const isUnderLoosePebble = (store: BurrowStore, p: Position) =>
	store.pebbles.some((pebble) => (pebble.state === 'wobble' || pebble.state === 'falling') && pebble.x === p.x && pebble.y < p.y);

const isFinished = (store: BurrowStore) =>
	countSoil(store.soil) === 0 && store.pebbles.every((p) => p.state === 'gone') && store.beetles.every((b) => b.state === 'gone');

/* ───────────────────────── Setup ───────────────────────── */

const levelOf = (store: BurrowStore, x: number, y: number) => {
	const cell = store.grid[x]?.[y];
	if (!cell || cell.commitsCount <= 0) return 0;
	return Math.max(1, Utils.levelToIndex(cell.level));
};

const shuffle = <T>(items: T[], random: Random): T[] => {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
};

/** Pebbles sit on the busiest days, always on top of soil so they only fall once the wombat digs underneath. */
const placePebbles = (store: BurrowStore, random: Random): Pebble[] => {
	const soilCells = countSoil(store.soil);
	const limit = Math.min(BURROW_MAX_PEBBLES, Math.floor(soilCells / 30));
	const candidates: Position[] = [];
	for (let x = 2; x < GRID_WIDTH; x++) {
		for (let y = 0; y < GRID_HEIGHT - 1; y++) {
			if (store.soil[x][y] === 4 && store.soil[x][y + 1] > 0) candidates.push({ x, y });
		}
	}

	const pebbles: Pebble[] = [];
	for (const candidate of shuffle(candidates, random)) {
		if (pebbles.length >= limit) break;
		if (pebbles.some((p) => Math.abs(p.x - candidate.x) < BURROW_PEBBLE_SPACING)) continue;
		pebbles.push({
			id: pebbles.length,
			...candidate,
			state: 'resting',
			timer: 0,
			level: store.soil[candidate.x][candidate.y],
			spawn: { ...candidate }
		});
	}
	for (const pebble of pebbles) store.soil[pebble.x][pebble.y] = 0;
	return pebbles.sort((a, b) => a.x - b.x).map((p, id) => ({ ...p, id }));
};

/** Beetles start spread across the right of the graph, in open tunnels where possible. */
const placeBeetles = (store: BurrowStore, random: Random): Beetle[] => {
	const soilCells = countSoil(store.soil);
	const count = soilCells === 0 ? 2 : Math.min(BURROW_MAX_BEETLES, 1 + Math.floor(soilCells / 90));
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
			lastLitFrame: 0,
			moveCooldown: 0,
			stuckFrames: 0,
			timer: 0,
			spawn: { ...spot }
		});
	}
	return beetles;
};

const resetGameState = (store: BurrowStore): Random => {
	store.frameCount = 0;
	store.score = 0;
	store.cellsDug = 0;
	store.beetlesLulled = 0;
	store.beetlesBonked = 0;
	store.snapshots = [];
	store.soil = Array.from({ length: GRID_WIDTH }, (_, x) => Array.from({ length: GRID_HEIGHT }, (_, y) => levelOf(store, x, y)));

	const seed = store.contributions.reduce((sum, c) => sum + c.count, 0) * 31 + countSoil(store.soil);
	const random = createRandom(seed);

	store.pebbles = placePebbles(store, random);
	store.initialSoil = cloneSoil(store.soil);
	store.beetles = placeBeetles(store, random);
	store.wombat = {
		...BURROW_DEN,
		facing: 'right',
		pose: 'walk',
		digPhase: 0,
		lanternCooldown: 0,
		lanternHold: 0,
		lanternAim: 'side',
		visible: true
	};

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

const addScore = (store: BurrowStore, points: number) => {
	if (points <= 0) return;
	store.score += points;
	store.config.pointsIncreasedCallback(store.score);
};

/* ───────────────────────── Wombat ───────────────────────── */

/**
 * The first awake beetle the lantern can reach: in a straight line, at most BURROW_LANTERN_RANGE cells away,
 * with only open tunnel in between. Light does not pass through soil, except right up close.
 */
export const findLanternTarget = (store: BurrowStore): Beetle | null => {
	const { wombat } = store;
	for (const { x: dx, y: dy } of [
		{ x: wombat.facing === 'right' ? 1 : -1, y: 0 },
		{ x: wombat.facing === 'right' ? -1 : 1, y: 0 },
		{ x: 0, y: -1 },
		{ x: 0, y: 1 }
	]) {
		for (let distance = 1; distance <= BURROW_LANTERN_RANGE; distance++) {
			const p = { x: wombat.x + dx * distance, y: wombat.y + dy * distance };
			if (!inBounds(p) || pebbleAt(store, p)) break;
			const beetle = beetleAt(store, p);
			if (beetle) {
				if (beetle.state === 'awake' && (distance === 1 || isTunnel(store, p))) return beetle;
				break;
			}
			if (!isTunnel(store, p)) break;
		}
	}
	return null;
};

const raiseLantern = (store: BurrowStore, beetle: Beetle, frame: number) => {
	const { wombat } = store;
	wombat.pose = 'lantern';
	wombat.facing = facingTowards(wombat, beetle, wombat.facing);
	wombat.lanternAim = beetle.y < wombat.y ? 'up' : beetle.y > wombat.y ? 'down' : 'side';
	wombat.digPhase = 0;
	// The flash frame counts as the first held frame; the cooldown starts once the lantern comes down.
	wombat.lanternHold = BURROW_LANTERN_HOLD_FRAMES - 1;
	wombat.lanternCooldown = BURROW_LANTERN_COOLDOWN + 1;

	beetle.drowsiness++;
	beetle.frozenFor = BURROW_FREEZE_FRAMES;
	beetle.lastLitFrame = frame;
	if (beetle.drowsiness >= BURROW_LULL_HITS) {
		beetle.state = 'asleep';
		beetle.timer = BURROW_NAP_FRAMES;
		store.beetlesLulled++;
		addScore(store, BURROW_LULL_POINTS);
	}
};

const wombatStepCost = (store: BurrowStore, p: Position): number | null => {
	if (pebbleAt(store, p) || beetleAt(store, p)) return null;
	const danger = isUnderLoosePebble(store, p) ? BURROW_PEBBLE_DANGER_COST : 0;
	return 1 + store.soil[p.x][p.y] + danger;
};

/** Leftmost column that still has soil in it. */
const soilFrontier = (store: BurrowStore) => store.soil.findIndex((column) => column.some((h) => h > 0));

/** A cell somewhere below a pebble that has yet to fall. A pebble never falls onto the wombat, so standing here stalls it. */
const isUnderPebble = (store: BurrowStore, p: Position) =>
	store.pebbles.some((pebble) => pebble.state !== 'gone' && pebble.state !== 'crumble' && pebble.x === p.x && pebble.y < p.y);

/**
 * Where the wombat heads next: the cheapest soil near the left edge of what is left (so it works through the
 * graph from left to right instead of leaving dense days behind), any soil if that is blocked, or, once the soil
 * is gone, out from under any pebble still waiting to drop, then the nearest awake beetle.
 */
export const planWombatPath = (store: BurrowStore): Position[] | null => {
	const { wombat } = store;
	const frontier = soilFrontier(store);
	if (frontier >= 0) {
		const stepCost = (p: Position) => wombatStepCost(store, p);
		const isSoil = (p: Position) => store.soil[p.x][p.y] > 0;
		return (
			findCheapestPath(wombat, stepCost, (p) => isSoil(p) && p.x <= frontier + BURROW_SWEEP_WIDTH) ??
			findCheapestPath(wombat, stepCost, isSoil)
		);
	}
	if (isUnderPebble(store, wombat)) {
		return findCheapestPath(
			wombat,
			(p) => wombatStepCost(store, p),
			(p) => !isUnderPebble(store, p)
		);
	}
	if (!store.beetles.some((b) => b.state === 'awake')) return null;
	return findCheapestPath(
		wombat,
		(p) => {
			const beetle = beetleAt(store, p);
			if (beetle) return beetle.state === 'awake' ? 1 : null;
			return wombatStepCost(store, p);
		},
		(p) => beetleAt(store, p)?.state === 'awake'
	);
};

/** Returns true when the wombat dug or lulled something this frame. */
const moveWombat = (store: BurrowStore, frame: number): boolean => {
	const { wombat } = store;
	if (wombat.lanternHold > 0) {
		wombat.lanternHold--;
		wombat.digPhase = 1 - wombat.digPhase;
		return true;
	}
	wombat.lanternCooldown = Math.max(0, wombat.lanternCooldown - 1);
	wombat.pose = 'walk';

	const beetle = findLanternTarget(store);
	if (beetle && wombat.lanternCooldown === 0) {
		raiseLantern(store, beetle, frame);
		return true;
	}
	// Mid-lullaby: wait for the lantern to be ready again rather than wandering out of reach.
	if (beetle && beetle.drowsiness > 0) {
		wombat.facing = facingTowards(wombat, beetle, wombat.facing);
		return true;
	}

	const next = planWombatPath(store)?.[0];
	if (!next) return false;
	wombat.facing = facingTowards(wombat, next, wombat.facing);

	const occupied = () => !!beetleAt(store, next) || !!pebbleAt(store, next);
	if (soilAt(store, next) === 0) {
		if (!occupied()) Object.assign(wombat, { x: next.x, y: next.y });
		return false;
	}

	// Scrape one layer off; the last scrape opens the cell and the wombat shuffles in.
	wombat.pose = 'dig';
	wombat.digPhase = 1 - wombat.digPhase;
	store.soil[next.x][next.y]--;
	if (store.soil[next.x][next.y] === 0) {
		store.cellsDug++;
		addScore(store, BURROW_LEVEL_POINTS[store.initialSoil[next.x][next.y]] ?? 1);
		if (!occupied()) Object.assign(wombat, { x: next.x, y: next.y });
	}
	return true;
};

/* ───────────────────────── Pebbles ───────────────────────── */

/** Returns true when any pebble moved or changed state. */
const updatePebbles = (store: BurrowStore): boolean => {
	let changed = false;
	for (const pebble of store.pebbles) {
		const below = { x: pebble.x, y: pebble.y + 1 };
		const canDrop = () => inBounds(below) && isTunnel(store, below) && !pebbleAt(store, below) && !samePosition(store.wombat, below);

		switch (pebble.state) {
			case 'resting':
				if (canDrop()) {
					pebble.state = 'wobble';
					pebble.timer = BURROW_PEBBLE_WOBBLE_FRAMES;
					changed = true;
				}
				break;
			case 'wobble':
				if (--pebble.timer <= 0) pebble.state = 'falling';
				changed = true;
				break;
			case 'falling':
				if (canDrop()) {
					pebble.y++;
					for (const beetle of store.beetles) {
						if (beetle.state === 'awake' && samePosition(beetle, pebble)) {
							beetle.state = 'dizzy';
							beetle.timer = BURROW_NAP_FRAMES;
							store.beetlesBonked++;
							addScore(store, BURROW_BONK_POINTS);
						}
					}
				} else {
					pebble.state = 'crumble';
					pebble.timer = BURROW_PEBBLE_CRUMBLE_FRAMES;
				}
				changed = true;
				break;
			case 'crumble':
				if (--pebble.timer <= 0) {
					pebble.state = 'gone';
					store.cellsDug++;
					addScore(store, BURROW_LEVEL_POINTS[pebble.level] ?? 1);
				}
				changed = true;
				break;
		}
	}
	return changed;
};

/* ───────────────────────── Beetles ───────────────────────── */

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

	// No tunnel leads to the wombat: amble for a while, then squeeze through the soil.
	if (++beetle.stuckFrames < BURROW_BEETLE_PATIENCE && tunnelSteps.length > 0) return amble();
	if (nextToWombat(beetle)) return null;
	return findShortestPath(beetle, free, nextToWombat)?.[0] ?? null;
};

const updateBeetles = (store: BurrowStore, frame: number, random: Random) => {
	for (const beetle of store.beetles) {
		if (beetle.state === 'hidden' && frame >= BURROW_BEETLE_APPEAR_FRAME) beetle.state = 'awake';

		if (beetle.state === 'asleep' || beetle.state === 'dizzy') {
			if (--beetle.timer <= 0) beetle.state = 'gone';
			continue;
		}
		if (beetle.state !== 'awake') continue;

		if (beetle.drowsiness > 0 && frame - beetle.lastLitFrame >= BURROW_WAKE_FRAMES) {
			beetle.drowsiness--;
			beetle.lastLitFrame = frame;
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

/* ───────────────────────── Ending ───────────────────────── */

/**
 * The wombat naps, then the soil regrows from left to right and everything returns to where it started,
 * so the last frame matches the first and the animation loops seamlessly.
 */
const playEnding = (store: BurrowStore) => {
	for (const beetle of store.beetles) beetle.state = beetle.state === 'hidden' ? 'hidden' : 'gone';

	store.wombat.pose = 'sleep';
	for (let i = 0; i < BURROW_NAP_END_FRAMES; i++) pushSnapshot(store);

	// Hide everything first and move it back a frame later, so nothing visibly slides across the board.
	store.wombat.visible = false;
	for (const pebble of store.pebbles) pebble.state = 'gone';
	pushSnapshot(store);
	Object.assign(store.wombat, {
		...BURROW_DEN,
		facing: 'right',
		pose: 'walk',
		digPhase: 0,
		lanternCooldown: 0,
		lanternHold: 0,
		lanternAim: 'side'
	});
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

	let idleFrames = 0;
	while (!isFinished(store) && store.snapshots.length < maxFrames && idleFrames < BURROW_MAX_IDLE_FRAMES) {
		const frame = store.snapshots.length;
		const progressed = moveWombat(store, frame);
		const pebblesMoved = updatePebbles(store);
		updateBeetles(store, frame, random);
		pushSnapshot(store);
		idleFrames = progressed || pebblesMoved ? 0 : idleFrames + 1;
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
