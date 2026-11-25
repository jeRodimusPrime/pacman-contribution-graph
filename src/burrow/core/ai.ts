import { Position } from '../types';
import { GRID_HEIGHT, GRID_WIDTH } from './constants';

export const DIRECTIONS: readonly Position[] = [
	{ x: 1, y: 0 },
	{ x: 0, y: 1 },
	{ x: 0, y: -1 },
	{ x: -1, y: 0 }
];

export const inBounds = (p: Position) => p.x >= 0 && p.x < GRID_WIDTH && p.y >= 0 && p.y < GRID_HEIGHT;

export const keyOf = (p: Position) => p.y * GRID_WIDTH + p.x;

export const samePosition = (a: Position, b: Position) => a.x === b.x && a.y === b.y;

export const manhattan = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const getNeighbors = (p: Position): Position[] => DIRECTIONS.map((d) => ({ x: p.x + d.x, y: p.y + d.y })).filter(inBounds);

interface QueueItem {
	cost: number;
	position: Position;
}

/** Ties go to the leftmost, then topmost cell, so the digger sweeps the graph from left to right. */
const isBefore = (a: QueueItem, b: QueueItem) =>
	a.cost !== b.cost ? a.cost < b.cost : a.position.x !== b.position.x ? a.position.x < b.position.x : a.position.y < b.position.y;

/** Minimal binary heap; the grid is small but the search runs once per frame. */
class MinQueue {
	private items: QueueItem[] = [];

	get size() {
		return this.items.length;
	}

	push(item: QueueItem) {
		const items = this.items;
		items.push(item);
		let i = items.length - 1;
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (!isBefore(items[i], items[parent])) break;
			[items[i], items[parent]] = [items[parent], items[i]];
			i = parent;
		}
	}

	pop(): QueueItem {
		const items = this.items;
		const top = items[0];
		const last = items.pop() as QueueItem;
		if (items.length > 0) {
			items[0] = last;
			let i = 0;
			for (;;) {
				const left = i * 2 + 1;
				const right = left + 1;
				let smallest = i;
				if (left < items.length && isBefore(items[left], items[smallest])) smallest = left;
				if (right < items.length && isBefore(items[right], items[smallest])) smallest = right;
				if (smallest === i) break;
				[items[i], items[smallest]] = [items[smallest], items[i]];
				i = smallest;
			}
		}
		return top;
	}
}

const rebuildPath = (start: Position, target: Position, previous: Map<number, Position>): Position[] => {
	const path: Position[] = [];
	let cursor: Position | undefined = target;
	while (cursor && !samePosition(cursor, start)) {
		path.unshift(cursor);
		cursor = previous.get(keyOf(cursor));
	}
	return path;
};

/**
 * Cheapest path from `start` (which may sit just off the grid, in the den) to the nearest cell matching `isTarget`.
 * `costOf` returns the cost of entering a cell, or `null` when it cannot be entered.
 * Returns the path excluding `start`, or `null` when no target is reachable.
 */
export const findCheapestPath = (
	start: Position,
	costOf: (p: Position) => number | null,
	isTarget: (p: Position) => boolean
): Position[] | null => {
	const best = new Map<number, number>();
	const previous = new Map<number, Position>();
	const queue = new MinQueue();
	const startKey = inBounds(start) ? keyOf(start) : -1;
	best.set(startKey, 0);
	queue.push({ cost: 0, position: start });

	while (queue.size > 0) {
		const { cost, position } = queue.pop();
		const key = inBounds(position) ? keyOf(position) : -1;
		if (cost > (best.get(key) ?? Infinity)) continue;
		if (key !== startKey && isTarget(position)) return rebuildPath(start, position, previous);

		for (const neighbor of getNeighbors(position)) {
			const stepCost = costOf(neighbor);
			if (stepCost === null) continue;
			const neighborKey = keyOf(neighbor);
			const total = cost + stepCost;
			if (total >= (best.get(neighborKey) ?? Infinity)) continue;
			best.set(neighborKey, total);
			previous.set(neighborKey, position);
			queue.push({ cost: total, position: neighbor });
		}
	}

	return null;
};

/** Shortest path by step count through cells for which `canEnter` holds. Excludes `start`; `[]` if `start` is already a target. */
export const findShortestPath = (
	start: Position,
	canEnter: (p: Position) => boolean,
	isTarget: (p: Position) => boolean
): Position[] | null => {
	if (isTarget(start)) return [];
	return findCheapestPath(start, (p) => (canEnter(p) ? 1 : null), isTarget);
};
