import {
	addScore,
	beetleAt,
	facingTowards,
	isBelowPebble,
	isTunnel,
	LOOSE_PEBBLE_STATES,
	pebbleAt,
	soilAt,
	UNFALLEN_PEBBLE_STATES
} from '../core/board';
import { findCheapestPath, inBounds } from '../core/ai';
import {
	BURROW_DEN,
	BURROW_FREEZE_FRAMES,
	BURROW_HUM_COOLDOWN,
	BURROW_HUM_FRAMES,
	BURROW_HUM_RANGE,
	BURROW_LEVEL_POINTS,
	BURROW_LULL_HITS,
	BURROW_LULL_POINTS,
	BURROW_NAP_FRAMES,
	BURROW_PEBBLE_DANGER_COST,
	BURROW_SWEEP_WIDTH
} from '../core/constants';
import { Beetle, BurrowStore, Position, Wombat } from '../types';

/** The wombat as it starts out: in its den just off the left edge, facing the graph. */
export const createWombat = (): Wombat => ({
	...BURROW_DEN,
	facing: 'right',
	pose: 'walk',
	digPhase: 0,
	humCooldown: 0,
	humHold: 0,
	humTarget: null,
	visible: true
});

/* ───────────────────────── Humming ───────────────────────── */

/**
 * The first awake beetle the wombat's humming can reach: in a straight line, at most BURROW_HUM_RANGE cells away,
 * with only open tunnel in between. The tune does not carry through soil, except right up close.
 */
export const findHumTarget = (store: BurrowStore): Beetle | null => {
	const { wombat } = store;
	const ahead = wombat.facing === 'right' ? 1 : -1;
	const directions = [
		{ x: ahead, y: 0 },
		{ x: -ahead, y: 0 },
		{ x: 0, y: -1 },
		{ x: 0, y: 1 }
	];
	for (const { x: dx, y: dy } of directions) {
		for (let distance = 1; distance <= BURROW_HUM_RANGE; distance++) {
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

/** The wombat closes its eyes and hums; a note sets off towards the beetle, which stops to listen. */
const startHumming = (store: BurrowStore, beetle: Beetle) => {
	const { wombat } = store;
	wombat.pose = 'hum';
	wombat.facing = facingTowards(wombat, beetle, wombat.facing);
	wombat.humTarget = beetle.id;
	wombat.humHold = BURROW_HUM_FRAMES - 1;
	// The cooldown only starts counting once the note has landed.
	wombat.humCooldown = BURROW_HUM_COOLDOWN + 1;
	beetle.frozenFor = BURROW_FREEZE_FRAMES;
};

/** The note reaches the beetle, which gets a little sleepier. */
const landNote = (store: BurrowStore, frame: number) => {
	const beetle = store.beetles.find((b) => b.id === store.wombat.humTarget);
	if (!beetle || beetle.state !== 'awake') return;
	beetle.drowsiness++;
	beetle.frozenFor = BURROW_FREEZE_FRAMES;
	beetle.lastHummedFrame = frame;
	if (beetle.drowsiness >= BURROW_LULL_HITS) {
		beetle.state = 'asleep';
		beetle.timer = BURROW_NAP_FRAMES;
		store.beetlesLulled++;
		addScore(store, BURROW_LULL_POINTS);
	}
};

/* ───────────────────────── Getting around ───────────────────────── */

/** Cost of entering a cell: more for harder soil, a lot more under a pebble that is about to drop. */
const stepCost = (store: BurrowStore, p: Position): number | null => {
	if (pebbleAt(store, p) || beetleAt(store, p)) return null;
	const danger = isBelowPebble(store, p, LOOSE_PEBBLE_STATES) ? BURROW_PEBBLE_DANGER_COST : 0;
	return 1 + store.soil[p.x][p.y] + danger;
};

/** Leftmost column that still has soil in it, or -1 once it is all dug. */
const soilFrontier = (store: BurrowStore) => store.soil.findIndex((column) => column.some((h) => h > 0));

/**
 * Where the wombat heads next:
 * 1. the cheapest soil near the left edge of what is left, so it works through the graph from left to right
 *    instead of leaving dense days behind (or any soil, if that is blocked);
 * 2. once the soil is gone, out from under any pebble still waiting to drop: a pebble never falls onto the
 *    wombat, so standing underneath would stall it;
 * 3. then towards the nearest awake beetle.
 */
export const planWombatPath = (store: BurrowStore): Position[] | null => {
	const { wombat } = store;
	const cost = (p: Position) => stepCost(store, p);

	const frontier = soilFrontier(store);
	if (frontier >= 0) {
		const isSoil = (p: Position) => store.soil[p.x][p.y] > 0;
		return (
			findCheapestPath(wombat, cost, (p) => isSoil(p) && p.x <= frontier + BURROW_SWEEP_WIDTH) ??
			findCheapestPath(wombat, cost, isSoil)
		);
	}
	if (isBelowPebble(store, wombat, UNFALLEN_PEBBLE_STATES)) {
		return findCheapestPath(wombat, cost, (p) => !isBelowPebble(store, p, UNFALLEN_PEBBLE_STATES));
	}
	if (!store.beetles.some((b) => b.state === 'awake')) return null;
	const isAwakeBeetle = (p: Position) => beetleAt(store, p)?.state === 'awake';
	return findCheapestPath(wombat, (p) => (isAwakeBeetle(p) ? 1 : cost(p)), isAwakeBeetle);
};

/* ───────────────────────── One frame ───────────────────────── */

/**
 * Advances the wombat by one frame: it finishes humming a note, hums at a beetle in earshot (waiting between
 * notes rather than wandering off), or moves along its path, scraping one layer off any soil in the way.
 * Returns true when it dug or sang.
 */
export const moveWombat = (store: BurrowStore, frame: number): boolean => {
	const { wombat } = store;
	if (wombat.humHold > 0) {
		if (--wombat.humHold === 0) landNote(store, frame);
		return true;
	}
	wombat.humCooldown = Math.max(0, wombat.humCooldown - 1);
	wombat.pose = 'walk';
	wombat.humTarget = null;

	const beetle = findHumTarget(store);
	if (beetle && wombat.humCooldown === 0) {
		startHumming(store, beetle);
		return true;
	}
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
