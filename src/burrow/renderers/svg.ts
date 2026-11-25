import { AnimationData } from '../../shared/types';
import { Utils } from '../../shared/utils/utils';
import {
	BURROW_FIELD_RADIUS,
	BURROW_DURATION_DIVISOR,
	BURROW_HEADER_HEIGHT,
	BURROW_MIN_DURATION_MS,
	BURROW_SOIL_BLUR,
	CELL_SIZE,
	DELTA_TIME,
	GAP_SIZE,
	GRID_HEIGHT,
	GRID_WIDTH
} from '../core/constants';
import { BurrowSnapshot, BurrowStore, Position } from '../types';
import { beetleRef, buildSpriteDefs, crumbleRef, crumbleStage, getBurrowPalette, lanternGlowRef, pebbleRef, wombatRef } from './sprites';

const PITCH = CELL_SIZE + GAP_SIZE;
const FIELD_TOP = BURROW_HEADER_HEIGHT;
const FIELD_HEIGHT = GRID_HEIGHT * PITCH;

/**
 * The soil is drawn as one continuous field: neighbouring days blur into each other like layers of earth.
 * The blur would fade the field's outer edge into the background, so alpha is forced back to fully opaque
 * (feComponentTransfer works on un-premultiplied colour, so edge colours come out true, not darkened).
 */
const buildSoilDefs = (width: number) =>
	`<filter id="burrow-soil" filterUnits="userSpaceOnUse" x="0" y="${FIELD_TOP}" width="${width}" height="${FIELD_HEIGHT}" color-interpolation-filters="sRGB">` +
	`<feGaussianBlur stdDeviation="${BURROW_SOIL_BLUR}" edgeMode="duplicate"/>` +
	`<feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer>` +
	`</filter>` +
	`<clipPath id="burrow-field"><rect x="0" y="${FIELD_TOP}" width="${width - GAP_SIZE}" height="${FIELD_HEIGHT - GAP_SIZE}" rx="${BURROW_FIELD_RADIUS}"/></clipPath>`;

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

/** At most this many half-dug cells crumble at once; the wombat digs one at a time, so one spare is plenty. */
const CRUMBLE_SLOTS = 2;

interface CrumbleFrame {
	position: Position;
	stage: number;
}

/**
 * Crumble overlays for every frame, one timeline per slot. A cell keeps the same slot for as long as it is
 * half-dug, so its overlay never jumps between slots mid-crumble.
 */
const buildCrumbleTimelines = (store: BurrowStore): SpriteTimeline[] => {
	const slots: (CrumbleFrame | null)[][] = Array.from({ length: CRUMBLE_SLOTS }, () => []);
	let assigned: (string | null)[] = Array(CRUMBLE_SLOTS).fill(null);

	for (const snapshot of store.snapshots) {
		const crumbling = new Map<string, CrumbleFrame>();
		for (let x = 0; x < GRID_WIDTH; x++) {
			for (let y = 0; y < GRID_HEIGHT; y++) {
				const stage = crumbleStage(store.initialSoil[x]?.[y] ?? 0, snapshot.soil[x][y]);
				if (stage > 0) crumbling.set(`${x}:${y}`, { position: { x, y }, stage });
			}
		}
		assigned = assigned.map((key) => (key !== null && crumbling.has(key) ? key : null));
		for (const key of crumbling.keys()) {
			if (assigned.includes(key)) continue;
			const free = assigned.indexOf(null);
			if (free >= 0) assigned[free] = key;
		}
		assigned.forEach((key, slot) => slots[slot].push(key === null ? null : (crumbling.get(key) as CrumbleFrame)));
	}

	return slots.map((frames) => {
		// An idle slot stays where it last was (hidden) so it never slides across the board.
		let last: CrumbleFrame = frames.find((f) => f !== null) ?? { position: { x: 0, y: 0 }, stage: 1 };
		const filled = frames.map((f) => (f ? (last = f) : last));
		return {
			positions: filled.map((f) => centerOf(f.position)),
			refs: filled.map((f) => crumbleRef(f.stage)),
			opacities: frames.map((f) => (f ? '1' : '0'))
		};
	});
};

/** The lantern glow follows the wombat and only shows while the lantern is up. */
const buildLanternGlowTimeline = (store: BurrowStore): SpriteTimeline => {
	const refs = store.snapshots.map((s) => lanternGlowRef(s.wombat));
	let last = refs.find((r) => r !== null) ?? '#bg-side-r';
	return {
		positions: store.snapshots.map((s) => centerOf(s.wombat)),
		refs: refs.map((r) => (r ? (last = r) : last)),
		opacities: refs.map((r) => (r ? '1' : '0'))
	};
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
			// Cells cover the gaps too: the soil is one continuous field, softened by the blur below.
			cells += `<rect x="${toX(x)}" y="${toY(y)}" width="${PITCH}" height="${PITCH}" fill="${fills[0]}">`;
			if (anim) {
				cells += `<animate attributeName="fill" calcMode="discrete" dur="${durationMs}ms" repeatCount="indefinite" keyTimes="${anim.keyTimes}" values="${anim.values}"/>`;
			}
			cells += `</rect>`;
		}
	}

	const timelines: SpriteTimeline[] = [
		...buildCrumbleTimelines(store),
		...store.pebbles.map((_, i) => ({
			positions: snapshots.map((s) => centerOf(s.pebbles[i])),
			refs: snapshots.map((s) => pebbleRef(s.pebbles[i])),
			opacities: snapshots.map((s) => (s.pebbles[i].state === 'gone' ? '0' : '1'))
		})),
		buildLanternGlowTimeline(store),
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

	// Sprites that never show (an unused crumble slot, say) are neither drawn nor defined.
	const visible = timelines.filter((t) => t.opacities.some((o) => o !== '0'));
	const usedRefs = new Set(visible.flatMap((t) => t.refs));

	let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" color-interpolation="sRGB">`;
	svg += `<desc>Burrow: a wombat digs cozy tunnels through a contribution graph.</desc>`;
	svg += buildSpriteDefs(palette, usedRefs).replace('<defs>', `<defs>${buildSoilDefs(width)}`);
	svg += `<rect width="100%" height="100%" fill="${theme.gridBackground}"/>`;
	svg += buildMonthLabels(store);
	svg += `<g filter="url(#burrow-soil)" clip-path="url(#burrow-field)">${cells}</g>`;
	svg += visible.map((t) => renderSprite(t, durationMs)).join('');
	svg += `</svg>`;
	return svg;
};

export const Renderer = {
	generateAnimatedSVG
};
