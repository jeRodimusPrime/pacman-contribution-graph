import { AnimationData } from '../../shared/types';
import { Utils } from '../../shared/utils/utils';
import {
	BURROW_DURATION_DIVISOR,
	BURROW_FIELD_RADIUS,
	BURROW_HEADER_HEIGHT,
	BURROW_HUM_FRAMES,
	BURROW_MIN_DURATION_MS,
	BURROW_SOIL_CLUMP,
	CELL_SIZE,
	DELTA_TIME,
	GAP_SIZE,
	GRID_HEIGHT,
	GRID_WIDTH
} from '../core/constants';
import { BurrowSnapshot, BurrowStore, Position } from '../types';
import { beetleRef, buildSpriteDefs, getBurrowPalette, noteRef, pebbleRef, wombatRef } from './sprites';

const PITCH = CELL_SIZE + GAP_SIZE;
const FIELD_TOP = BURROW_HEADER_HEIGHT;
const FIELD_HEIGHT = GRID_HEIGHT * PITCH;

/** How the soil layer looks. Tweak these to change the feel without touching the filter itself. */
const SOIL_LOOK = {
	/** After the clump blur, alpha is mapped to `alpha * slope + offset`: a hard edge where the blurred alpha is
	 * about 0.45, so soil keeps roughly its cell shape but with rounded corners and walls. */
	clumpAlphaSlope: 18,
	clumpAlphaOffset: -8,
	/** Grain: noise is mapped to `noise * slope + offset` as the alpha of dark specks (most noise stays below 0). */
	grainSlope: 1.4,
	grainOffset: -0.74,
	/** The tunnel floor gets the same grain at this fraction of the strength. */
	floorGrainStrength: 0.3,
	/** The shadow the soil casts down into the tunnels. */
	shadowBlur: 1.2,
	shadowDrop: 2.2,
	shadowOpacity: 0.3,
	/** The light caught along the top edge of the soil. */
	rimDepth: 1.4,
	rimOpacity: 0.22
};

/**
 * The soil is one continuous layer of earth with open tunnels carved through it:
 * - a small blur followed by an alpha threshold rounds the soil into soft clods, so neighbouring days run
 *   together and dug-out tunnels get rounded walls, while each day keeps its own colour;
 * - fine grain gives both the soil and the tunnel floor some texture;
 * - the soil casts a short shadow down into the tunnels and catches a little light on its top edges,
 *   so the tunnels read as carved out of it rather than painted on.
 */
const buildSoilDefs = (width: number) => {
	const look = SOIL_LOOK;
	return (
		`<filter id="burrow-soil" filterUnits="userSpaceOnUse" x="0" y="${FIELD_TOP}" width="${width}" height="${FIELD_HEIGHT}" color-interpolation-filters="sRGB">` +
		`<feGaussianBlur in="SourceGraphic" stdDeviation="${BURROW_SOIL_CLUMP}" result="soft"/>` +
		`<feColorMatrix in="soft" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${look.clumpAlphaSlope} ${look.clumpAlphaOffset}" result="clump"/>` +
		`<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise"/>` +
		`<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${look.grainSlope} 0 0 0 ${look.grainOffset}" result="specks"/>` +
		`<feComposite in="specks" in2="clump" operator="in" result="soilGrain"/>` +
		`<feComposite in="specks" in2="clump" operator="out" result="looseFloorGrain"/>` +
		`<feComponentTransfer in="looseFloorGrain" result="floorGrain"><feFuncA type="linear" slope="${look.floorGrainStrength}"/></feComponentTransfer>` +
		`<feGaussianBlur in="clump" stdDeviation="${look.shadowBlur}" result="shadowSoft"/>` +
		`<feOffset in="shadowSoft" dy="${look.shadowDrop}" result="shadowDrop"/>` +
		`<feFlood flood-color="#000000" flood-opacity="${look.shadowOpacity}"/>` +
		`<feComposite in2="shadowDrop" operator="in" result="shadow"/>` +
		`<feOffset in="clump" dy="${look.rimDepth}" result="clumpDown"/>` +
		`<feComposite in="clump" in2="clumpDown" operator="out" result="topEdge"/>` +
		`<feFlood flood-color="#ffffff" flood-opacity="${look.rimOpacity}"/>` +
		`<feComposite in2="topEdge" operator="in" result="rim"/>` +
		`<feMerge><feMergeNode in="floorGrain"/><feMergeNode in="shadow"/><feMergeNode in="clump"/><feMergeNode in="soilGrain"/><feMergeNode in="rim"/></feMerge>` +
		`</filter>` +
		`<clipPath id="burrow-field"><rect x="0" y="${FIELD_TOP}" width="${width - GAP_SIZE}" height="${FIELD_HEIGHT - GAP_SIZE}" rx="${BURROW_FIELD_RADIUS}"/></clipPath>`
	);
};

/** Number of steps a cell shrinks through while it is being dug. */
export const SHRINK_STAGES = 3;
/** Size of a half-dug cell at each shrink stage (index = stage). */
const SHRINK_SCALES = ['1', '0.8', '0.62', '0.45'];

/**
 * Shrink stage (1…SHRINK_STAGES) for a cell with `remaining` of its `initial` hardness left, or 0 when the
 * cell is untouched or fully dug. A level-4 day goes through every stage; a level-1 day opens in one scrape.
 */
export const shrinkStage = (initial: number, remaining: number) =>
	remaining <= 0 || remaining >= initial ? 0 : Math.ceil(((initial - remaining) / initial) * SHRINK_STAGES - 1e-9);

const toX = (x: number) => x * (CELL_SIZE + GAP_SIZE);
const toY = (y: number) => y * (CELL_SIZE + GAP_SIZE) + BURROW_HEADER_HEIGHT;
const centerX = (x: number) => toX(x) + CELL_SIZE / 2;
const centerY = (y: number) => toY(y) + CELL_SIZE / 2;
const centerOf = ({ x, y }: Position) => `${centerX(x)} ${centerY(y)}`;

export const SVG_KEY_TIMES_PRECISION = 4;

const toKeyTime = (index: number, totalFrames: number) => Number((index / (totalFrames - 1)).toFixed(SVG_KEY_TIMES_PRECISION));

/**
 * Discrete animation that only lists the frames where the value changes. A discrete animation holds each
 * value until the next keyframe, so no hold keyframes or closing keyframe at 1 are needed.
 */
const generateChangingValuesAnimation = (changingValues: string[]): AnimationData | null => {
	const totalFrames = changingValues.length;
	if (totalFrames <= 1) return null;

	const keyTimes: number[] = [];
	const values: string[] = [];
	changingValues.forEach((value, index) => {
		if (value === values[values.length - 1]) return;
		const time = toKeyTime(index, totalFrames);
		// Two changes that round to the same key time: the later one wins.
		if (time === keyTimes[keyTimes.length - 1]) values[values.length - 1] = value;
		else {
			keyTimes.push(time);
			values.push(value);
		}
	});

	if (values.length <= 1) return null;
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

/** A discrete <animate> for `attributeName`, or nothing when the value never changes. */
const animateDiscrete = (attributeName: string, anim: AnimationData | null, durationMs: number) =>
	anim
		? `<animate attributeName="${attributeName}" calcMode="discrete" dur="${durationMs}ms" repeatCount="indefinite" keyTimes="${anim.keyTimes}" values="${anim.values}"/>`
		: '';

interface SpriteTimeline {
	positions: string[];
	refs: string[];
	opacities: string[];
}

const renderSprite = ({ positions, refs, opacities }: SpriteTimeline, durationMs: number) => {
	const positionAnim = generateSteppedLinearAnimation(positions);

	let svg = `<use href="${refs[0]}" opacity="${opacities[0]}" transform="translate(${positions[0]})">`;
	svg += animateDiscrete('href', generateChangingValuesAnimation(refs), durationMs);
	svg += animateDiscrete('opacity', generateChangingValuesAnimation(opacities), durationMs);
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

/** How high above the ground a note floats on its way to the beetle. */
const NOTE_LIFT = 8;

/**
 * While the wombat hums, a note floats from it to the beetle it is singing to, bobbing as it goes, and
 * lands on the frame the beetle gets sleepier.
 */
const buildNoteTimeline = (store: BurrowStore): SpriteTimeline => {
	const frames = store.snapshots.map((s) => {
		const { wombat } = s;
		const beetle = s.beetles.find((b) => b.id === wombat.humTarget);
		if (wombat.pose !== 'hum' || !beetle) return null;
		const progress = (BURROW_HUM_FRAMES - wombat.humHold) / BURROW_HUM_FRAMES;
		const x = centerX(wombat.x) + (centerX(beetle.x) - centerX(wombat.x)) * progress;
		const y = centerY(wombat.y) + (centerY(beetle.y) - centerY(wombat.y)) * progress - NOTE_LIFT - (wombat.humHold % 2) * 2;
		return { position: `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`, ref: noteRef(wombat.humHold) };
	});
	let last = frames.find((f) => f !== null) ?? { position: '0 0', ref: noteRef(0) };
	const filled = frames.map((f) => (f ? (last = f) : last));
	return {
		positions: filled.map((f) => f.position),
		refs: filled.map((f) => f.ref),
		opacities: frames.map((f) => (f ? '1' : '0'))
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

	// Tunnel cells are left transparent so the textured tunnel floor shows through underneath.
	const soilColor = (hardness: number) => (hardness > 0 ? theme.intensityColors[hardness] : 'transparent');

	let cells = '';
	for (let x = 0; x < GRID_WIDTH; x++) {
		for (let y = 0; y < GRID_HEIGHT; y++) {
			const fills = snapshots.map((s) => soilColor(s.soil[x][y]));
			if (fills.every((f) => f === 'transparent')) continue;
			// Cells are drawn edge to edge (no gaps) and shrink a step with each scrape while they are being dug.
			// Once a cell is dug out it is transparent, so it keeps its last size until the soil regrows; that
			// saves a keyframe per cell.
			let scale = SHRINK_SCALES[0];
			const scales = snapshots.map((s) => {
				if (s.soil[x][y] > 0) scale = SHRINK_SCALES[shrinkStage(store.initialSoil[x]?.[y] ?? 0, s.soil[x][y])];
				return scale;
			});
			const scaleAnim = generateChangingValuesAnimation(scales);
			cells += `<rect x="${-PITCH / 2}" y="${-PITCH / 2}" width="${PITCH}" height="${PITCH}" fill="${fills[0]}" transform="translate(${centerX(x) + GAP_SIZE / 2} ${centerY(y) + GAP_SIZE / 2})">`;
			cells += animateDiscrete('fill', generateChangingValuesAnimation(fills), durationMs);
			if (scaleAnim) {
				cells += `<animateTransform attributeName="transform" type="scale" additive="sum" calcMode="discrete" dur="${durationMs}ms" repeatCount="indefinite" keyTimes="${scaleAnim.keyTimes}" values="${scaleAnim.values}"/>`;
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
		},
		buildNoteTimeline(store)
	];

	// Sprites that never show (the notes, on a graph with no beetles in reach) are neither drawn nor defined.
	const visible = timelines.filter((t) => t.opacities.some((o) => o !== '0'));
	const usedRefs = new Set(visible.flatMap((t) => t.refs));

	let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" color-interpolation="sRGB">`;
	svg += `<desc>Burrow: a wombat digs cozy tunnels through a contribution graph.</desc>`;
	svg += buildSpriteDefs(palette, usedRefs).replace('<defs>', `<defs>${buildSoilDefs(width)}`);
	svg += `<rect width="100%" height="100%" fill="${theme.gridBackground}"/>`;
	svg += buildMonthLabels(store);
	svg += `<g clip-path="url(#burrow-field)"><rect x="0" y="${FIELD_TOP}" width="${width}" height="${FIELD_HEIGHT}" fill="${palette.tunnel}"/>`;
	svg += `<g filter="url(#burrow-soil)">${cells}</g></g>`;
	svg += visible.map((t) => renderSprite(t, durationMs)).join('');
	svg += `</svg>`;
	return svg;
};

export const Renderer = {
	generateAnimatedSVG
};
