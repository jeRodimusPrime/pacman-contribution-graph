import { AnimationData } from '../../shared/types';
import { Utils } from '../../shared/utils/utils';
import {
	BURROW_CELL_RADIUS,
	BURROW_DURATION_DIVISOR,
	BURROW_HEADER_HEIGHT,
	BURROW_MIN_DURATION_MS,
	CELL_SIZE,
	DELTA_TIME,
	GAP_SIZE,
	GRID_HEIGHT,
	GRID_WIDTH
} from '../core/constants';
import { BurrowSnapshot, BurrowStore, Position } from '../types';
import { beetleRef, buildSpriteDefs, getBurrowPalette, pebbleRef, wombatRef } from './sprites';

const toX = (x: number) => x * (CELL_SIZE + GAP_SIZE);
const toY = (y: number) => y * (CELL_SIZE + GAP_SIZE) + BURROW_HEADER_HEIGHT;
const centerOf = ({ x, y }: Position) => `${toX(x) + CELL_SIZE / 2} ${toY(y) + CELL_SIZE / 2}`;

export const SVG_KEY_TIMES_PRECISION = 4;

const toKeyTime = (index: number, totalFrames: number) => Number((index / (totalFrames - 1)).toFixed(SVG_KEY_TIMES_PRECISION));

/** Discrete animation that only lists the frames where the value changes. */
const generateChangingValuesAnimation = (changingValues: string[]): AnimationData | null => {
	const totalFrames = changingValues.length;
	if (totalFrames <= 1) return null;

	const keyTimes: number[] = [];
	const values: string[] = [];
	let lastValue: string | null = null;
	let lastIndex: number | null = null;

	changingValues.forEach((currentValue, index) => {
		if (currentValue === lastValue) return;
		if (lastValue !== null && lastIndex !== null && index - 1 !== lastIndex) {
			keyTimes.push(Number(((index - 0.1) / (totalFrames - 1)).toFixed(SVG_KEY_TIMES_PRECISION)));
			values.push(lastValue);
		}
		keyTimes.push(toKeyTime(index, totalFrames));
		values.push(currentValue);
		lastValue = currentValue;
		lastIndex = index;
	});

	if (values.length <= 1) return null;
	if (keyTimes[keyTimes.length - 1] !== 1) {
		keyTimes.push(1);
		values.push(lastValue ?? changingValues[totalFrames - 1]);
	}
	return { keyTimes: keyTimes.join(';'), values: values.join(';') };
};

/**
 * Linear animation for positions: a value holds until the frame before it changes, then glides over one frame,
 * so sprites slide smoothly from cell to cell instead of jumping.
 */
const generateSteppedLinearAnimation = (positions: string[]): AnimationData | null => {
	const totalFrames = positions.length;
	if (totalFrames <= 1) return null;

	const keyTimes: number[] = [];
	const values: string[] = [];
	const push = (index: number, value: string) => {
		const time = toKeyTime(index, totalFrames);
		if (keyTimes[keyTimes.length - 1] === time) values[values.length - 1] = value;
		else {
			keyTimes.push(time);
			values.push(value);
		}
	};
	let lastValue: string | null = null;
	let lastIndex: number | null = null;

	positions.forEach((value, index) => {
		if (value === lastValue) return;
		if (lastValue !== null && lastIndex !== null && index - 1 !== lastIndex) push(index - 1, lastValue);
		push(index, value);
		lastValue = value;
		lastIndex = index;
	});

	if (values.length <= 1) return null;
	if (keyTimes[keyTimes.length - 1] !== 1) push(totalFrames - 1, positions[totalFrames - 1]);
	return { keyTimes: keyTimes.join(';'), values: values.join(';') };
};

interface SpriteTimeline {
	positions: string[];
	refs: string[];
	opacities: string[];
}

const renderSprite = ({ positions, refs, opacities }: SpriteTimeline, durationMs: number) => {
	const animate = (attributeName: string, anim: AnimationData | null) =>
		anim
			? `<animate attributeName="${attributeName}" calcMode="discrete" dur="${durationMs}ms" repeatCount="indefinite" keyTimes="${anim.keyTimes}" values="${anim.values}"/>`
			: '';
	const positionAnim = generateSteppedLinearAnimation(positions);

	if (!opacities.some((o) => o !== '0')) return '';
	let svg = `<use href="${refs[0]}" opacity="${opacities[0]}" transform="translate(${positions[0]})">`;
	svg += animate('href', generateChangingValuesAnimation(refs));
	svg += animate('opacity', generateChangingValuesAnimation(opacities));
	if (positionAnim) {
		svg += `<animateTransform attributeName="transform" type="translate" calcMode="linear" dur="${durationMs}ms" repeatCount="indefinite" keyTimes="${positionAnim.keyTimes}" values="${positionAnim.values}"/>`;
	}
	return svg + `</use>`;
};

const buildMonthLabels = (store: BurrowStore) => {
	if (store.config.showMonthLabels === false) return '';
	let labels = '';
	let last = '';
	const theme = Utils.getCurrentTheme(store);
	for (let x = 0; x < GRID_WIDTH; x++) {
		const month = store.monthLabels[x] ?? '';
		if (!month || month === last) continue;
		labels += `<text x="${toX(x) + CELL_SIZE / 2}" y="16" text-anchor="middle" font-size="10" fill="${theme.textColor}">${month}</text>`;
		last = month;
	}
	return labels;
};

const isInSoil = (snapshot: BurrowSnapshot, { x, y }: Position) => (snapshot.soil[x]?.[y] ?? 0) > 0;

const generateAnimatedSVG = (store: BurrowStore): string => {
	const theme = Utils.getCurrentTheme(store);
	const palette = getBurrowPalette(store.config.gameTheme);
	const width = GRID_WIDTH * (CELL_SIZE + GAP_SIZE);
	const height = GRID_HEIGHT * (CELL_SIZE + GAP_SIZE) + BURROW_HEADER_HEIGHT;
	const totalFrames = Math.max(store.snapshots.length, 1);
	const durationMs = Math.round(Math.max((totalFrames * DELTA_TIME) / BURROW_DURATION_DIVISOR, BURROW_MIN_DURATION_MS));
	const snapshots = store.snapshots;

	const soilColor = (hardness: number) => (hardness > 0 ? theme.intensityColors[hardness] : palette.tunnel);

	let cells = '';
	for (let x = 0; x < GRID_WIDTH; x++) {
		for (let y = 0; y < GRID_HEIGHT; y++) {
			const fills = snapshots.map((s) => soilColor(s.soil[x][y]));
			const anim = generateChangingValuesAnimation(fills);
			cells += `<rect x="${toX(x)}" y="${toY(y)}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="${BURROW_CELL_RADIUS}" fill="${fills[0]}">`;
			if (anim) {
				cells += `<animate attributeName="fill" calcMode="discrete" dur="${durationMs}ms" repeatCount="indefinite" keyTimes="${anim.keyTimes}" values="${anim.values}"/>`;
			}
			cells += `</rect>`;
		}
	}

	const timelines: SpriteTimeline[] = [
		...store.pebbles.map((_, i) => ({
			positions: snapshots.map((s) => centerOf(s.pebbles[i])),
			refs: snapshots.map((s) => pebbleRef(s.pebbles[i])),
			opacities: snapshots.map((s) => (s.pebbles[i].state === 'gone' ? '0' : '1'))
		})),
		...store.beetles.map((_, i) => ({
			positions: snapshots.map((s) => centerOf(s.beetles[i])),
			refs: snapshots.map((s) => beetleRef(s.beetles[i])),
			// A beetle squeezing through soil is only half there.
			opacities: snapshots.map((s) => {
				const beetle = s.beetles[i];
				if (beetle.state === 'hidden' || beetle.state === 'gone') return '0';
				return isInSoil(s, beetle) ? '0.5' : '1';
			})
		})),
		{
			positions: snapshots.map((s) => centerOf(s.wombat)),
			refs: snapshots.map((s) => wombatRef(s.wombat)),
			opacities: snapshots.map((s) => (s.wombat.visible ? '1' : '0'))
		}
	];

	const usedRefs = new Set(timelines.flatMap((t) => t.refs));

	let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" color-interpolation="sRGB">`;
	svg += `<desc>Burrow: a wombat digs cozy tunnels through a contribution graph.</desc>`;
	svg += buildSpriteDefs(palette, usedRefs);
	svg += `<rect width="100%" height="100%" fill="${theme.gridBackground}"/>`;
	svg += buildMonthLabels(store);
	svg += cells;
	svg += timelines.map((t) => renderSprite(t, durationMs)).join('');
	svg += `</svg>`;
	return svg;
};

export const Renderer = {
	generateAnimatedSVG
};
