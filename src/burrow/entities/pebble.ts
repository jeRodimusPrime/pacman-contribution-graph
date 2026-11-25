import { addScore, countSoil, isTunnel, pebbleAt } from '../core/board';
import { inBounds, samePosition } from '../core/ai';
import {
	BURROW_BONK_POINTS,
	BURROW_LEVEL_POINTS,
	BURROW_MAX_PEBBLES,
	BURROW_NAP_FRAMES,
	BURROW_PEBBLE_CRUMBLE_FRAMES,
	BURROW_PEBBLE_MIN_X,
	BURROW_PEBBLE_SPACING,
	BURROW_PEBBLE_WOBBLE_FRAMES,
	BURROW_SOIL_PER_PEBBLE,
	GRID_HEIGHT,
	GRID_WIDTH
} from '../core/constants';
import { Random, shuffle } from '../core/random';
import { BurrowStore, Pebble, Position } from '../types';

/**
 * Pebbles sit on the busiest days, always on top of soil so they only fall once the wombat digs underneath.
 * The cell a pebble sits on becomes open tunnel; the pebble itself is scored when it crumbles away.
 */
export const placePebbles = (store: BurrowStore, random: Random): Pebble[] => {
	const limit = Math.min(BURROW_MAX_PEBBLES, Math.floor(countSoil(store.soil) / BURROW_SOIL_PER_PEBBLE));
	const candidates: Position[] = [];
	for (let x = BURROW_PEBBLE_MIN_X; x < GRID_WIDTH; x++) {
		for (let y = 0; y < GRID_HEIGHT - 1; y++) {
			if (store.soil[x][y] === 4 && store.soil[x][y + 1] > 0) candidates.push({ x, y });
		}
	}

	const chosen: Position[] = [];
	for (const candidate of shuffle(candidates, random)) {
		if (chosen.length >= limit) break;
		if (chosen.some((p) => Math.abs(p.x - candidate.x) < BURROW_PEBBLE_SPACING)) continue;
		chosen.push(candidate);
	}

	const pebbles = chosen
		.sort((a, b) => a.x - b.x)
		.map((p, id): Pebble => ({ id, ...p, state: 'resting', timer: 0, level: store.soil[p.x][p.y], spawn: { ...p } }));
	for (const pebble of pebbles) store.soil[pebble.x][pebble.y] = 0;
	return pebbles;
};

/** A falling pebble bonks any awake beetle it lands on; the beetle wobbles off home. */
const bonkBeetles = (store: BurrowStore, pebble: Pebble) => {
	for (const beetle of store.beetles) {
		if (beetle.state !== 'awake' || !samePosition(beetle, pebble)) continue;
		beetle.state = 'dizzy';
		beetle.timer = BURROW_NAP_FRAMES;
		store.beetlesBonked++;
		addScore(store, BURROW_BONK_POINTS);
	}
};

/**
 * Advances every pebble by one frame: a pebble wobbles once the cell under it is open (and the wombat is not
 * standing there), falls one cell per frame, then crumbles away where it lands. Returns true when any pebble
 * moved or changed state.
 */
export const updatePebbles = (store: BurrowStore): boolean => {
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
					bonkBeetles(store, pebble);
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
