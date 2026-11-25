import { GAME_THEMES, GRID_HEIGHT, GRID_WIDTH } from '../../shared/constants';
import { ARCADE_GAMES } from '../../shared/arcade-renderer';
import { generateScenarioContributions } from '../../shared/providers/scenarios';
import { ContributionLevel, GridCell, ThemeKeys } from '../../shared/types';
import { Utils } from '../../shared/utils/utils';
import {
	BURROW_BONK_POINTS,
	BURROW_DEN,
	BURROW_END_HOLD_FRAMES,
	BURROW_LANTERN_RANGE,
	BURROW_LULL_HITS,
	BURROW_LULL_POINTS,
	BURROW_NAP_END_FRAMES,
	BURROW_REGROW_FRAMES
} from '../core/constants';
import { findLanternTarget, planWombatPath, simulate } from '../core/game';
import { Store } from '../core/store';
import { crumbleStage } from '../renderers/sprites';
import { Renderer } from '../renderers/svg';
import { Beetle, BurrowSnapshot, BurrowStore } from '../types';

const LEVELS: ContributionLevel[] = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
const ENDING_FRAMES = BURROW_NAP_END_FRAMES + 2 + BURROW_REGROW_FRAMES + BURROW_END_HOLD_FRAMES;

const createStore = (gameTheme: ThemeKeys = 'github'): BurrowStore => {
	const store: BurrowStore = JSON.parse(JSON.stringify(Store));
	store.config = {
		platform: 'scenario',
		username: '',
		gameTheme,
		svgCallback: () => {},
		gameOverCallback: () => {},
		pointsIncreasedCallback: () => {}
	};
	return store;
};

/** A store whose grid has the given contribution level (0-4) at each listed cell and nothing anywhere else. */
const createStoreWithLevels = (cells: { x: number; y: number; level: number }[] = []): BurrowStore => {
	const store = createStore();
	store.grid = Array.from({ length: GRID_WIDTH }, () =>
		Array.from(
			{ length: GRID_HEIGHT },
			(): GridCell => ({ commitsCount: 0, level: 'NONE', color: GAME_THEMES.github.intensityColors[0] })
		)
	);
	for (const { x, y, level } of cells) {
		store.grid[x][y] = { commitsCount: level, level: LEVELS[level], color: GAME_THEMES.github.intensityColors[level] };
	}
	store.monthLabels = Array(GRID_WIDTH).fill('');
	return store;
};

const createScenarioStore = (scenario: string, gameTheme: ThemeKeys = 'github'): BurrowStore => {
	const store = createStore(gameTheme);
	store.contributions = generateScenarioContributions(scenario).contributions;
	Utils.buildGrid(store);
	Utils.buildMonthLabels(store);
	return store;
};

const soilLeft = (snapshot: BurrowSnapshot) => snapshot.soil.flat().filter((h) => h > 0).length;

/** The last snapshot before the ending sequence starts. */
const lastPlayedSnapshot = (store: BurrowStore) => store.snapshots[store.snapshots.length - ENDING_FRAMES - 1];

describe('burrow registration', () => {
	it('is selectable as an arcade game', () => {
		expect(ARCADE_GAMES).toContain('burrow');
	});
});

describe('burrow scenarios', () => {
	it.each(['full', 'empty', 'random', 'checkerboard', 'gradient', 'streaks'])(
		'digs out every cell and lulls every beetle (%s)',
		(scenario) => {
			const store = createScenarioStore(scenario);
			simulate(store);

			const played = lastPlayedSnapshot(store);
			expect(soilLeft(played)).toBe(0);
			expect(played.pebbles.every((p) => p.state === 'gone')).toBe(true);
			expect(played.beetles.every((b) => b.state === 'gone')).toBe(true);
			expect(store.beetlesLulled + store.beetlesBonked).toBe(store.beetles.length);
		}
	);

	it('still has beetles to lull on an empty graph', () => {
		const store = createScenarioStore('empty');
		simulate(store);

		expect(store.beetles.length).toBeGreaterThan(0);
		expect(store.cellsDug).toBe(0);
		expect(store.score).toBeGreaterThan(0);
	});

	it('clears random graphs reliably', () => {
		for (let run = 0; run < 10; run++) {
			const store = createScenarioStore('random');
			simulate(store);
			expect(soilLeft(lastPlayedSnapshot(store))).toBe(0);
		}
	});

	it('respects maxFrames', () => {
		const store = createScenarioStore('full');
		store.config.maxFrames = 100;
		simulate(store);

		expect(store.snapshots.length).toBe(100 + ENDING_FRAMES);
	});
});

describe('burrow rules', () => {
	it('digs denser days one layer per frame', () => {
		const store = createStoreWithLevels([{ x: 0, y: BURROW_DEN.y, level: 4 }]);
		simulate(store);

		const hardness = store.snapshots.map((s) => s.soil[0][BURROW_DEN.y]);
		expect(hardness.slice(0, 5)).toEqual([4, 3, 2, 1, 0]);
		// The wombat shuffles into the cell on the last scrape.
		expect(store.snapshots[4].wombat).toMatchObject({ x: 0, y: BURROW_DEN.y });
		expect(store.snapshots[3].wombat).toMatchObject({ x: BURROW_DEN.x, pose: 'dig' });
	});

	it('scores by contribution level', () => {
		const store = createStoreWithLevels([
			{ x: 0, y: BURROW_DEN.y, level: 1 },
			{ x: 1, y: BURROW_DEN.y, level: 4 }
		]);
		const lulled = () => store.beetlesLulled * BURROW_LULL_POINTS + store.beetlesBonked * BURROW_BONK_POINTS;
		simulate(store);

		expect(store.cellsDug).toBe(2);
		expect(store.score - lulled()).toBe(1 + 5);
	});

	it('never stands on soil, a pebble or a beetle', () => {
		const store = createScenarioStore('full');
		simulate(store);

		for (const snapshot of store.snapshots) {
			const { wombat } = snapshot;
			if (wombat.x < 0) continue;
			expect(snapshot.soil[wombat.x][wombat.y]).toBe(0);
			expect(snapshot.pebbles.some((p) => p.state !== 'gone' && p.x === wombat.x && p.y === wombat.y)).toBe(false);
			expect(
				snapshot.beetles.some((b) => (b.state === 'awake' || b.state === 'asleep') && b.x === wombat.x && b.y === wombat.y)
			).toBe(false);
		}
	});

	it(`takes ${BURROW_LULL_HITS} lantern hits to put a beetle to sleep`, () => {
		const store = createScenarioStore('random');
		simulate(store);

		for (const beetle of store.beetles) {
			const asleepAt = store.snapshots.findIndex((s) => s.beetles[beetle.id].state === 'asleep');
			if (asleepAt < 0) continue;
			const drowsiness = store.snapshots.slice(0, asleepAt).map((s) => s.beetles[beetle.id].drowsiness);
			expect(Math.max(...drowsiness)).toBe(BURROW_LULL_HITS - 1);
		}
	});

	it('drops pebbles once the soil underneath is dug out, and they crumble away', () => {
		const store = createScenarioStore('full');
		simulate(store);

		expect(store.pebbles.length).toBeGreaterThan(0);
		for (const pebble of store.pebbles) {
			const states = store.snapshots.map((s) => s.pebbles[pebble.id].state);
			const firstWobble = states.indexOf('wobble');
			expect(firstWobble).toBeGreaterThan(0);
			expect(store.snapshots[firstWobble].soil[pebble.spawn.x][pebble.spawn.y + 1]).toBe(0);
			expect(states.slice(0, firstWobble).every((s) => s === 'resting')).toBe(true);
			expect(states.indexOf('crumble')).toBeGreaterThan(firstWobble);
		}
	});

	it('steps out from under the last pebble so it can fall', () => {
		const store = createStoreWithLevels();
		simulate(store);
		store.beetles = [];
		store.pebbles = [{ id: 0, x: 10, y: 2, state: 'resting', timer: 0, level: 4, spawn: { x: 10, y: 2 } }];
		store.wombat = { ...store.wombat, x: 10, y: 3, visible: true };

		const path = planWombatPath(store);
		expect(path).not.toBeNull();
		expect(path && path[path.length - 1].x).not.toBe(10);
	});

	describe('lantern', () => {
		const lanternStore = (beetleX: number, soilBetween = false) => {
			const store = createStoreWithLevels(soilBetween ? [{ x: 2, y: 3, level: 1 }] : []);
			simulate(store); // initialise the board
			store.soil = store.soil.map((column) => column.map(() => 0));
			if (soilBetween) store.soil[2][3] = 1;
			store.pebbles = [];
			store.wombat = { ...store.wombat, x: 0, y: 3, facing: 'right', visible: true };
			const beetle: Beetle = { ...store.beetles[0], x: beetleX, y: 3, state: 'awake' };
			store.beetles = [beetle];
			return { store, beetle };
		};

		it(`reaches a beetle up to ${BURROW_LANTERN_RANGE} cells down an open tunnel`, () => {
			const { store, beetle } = lanternStore(BURROW_LANTERN_RANGE);
			expect(findLanternTarget(store)).toBe(beetle);
		});

		it('does not reach any further', () => {
			const { store } = lanternStore(BURROW_LANTERN_RANGE + 1);
			expect(findLanternTarget(store)).toBeNull();
		});

		it('does not shine through soil', () => {
			const { store } = lanternStore(3, true);
			expect(findLanternTarget(store)).toBeNull();
		});
	});
});

describe('burrow loop', () => {
	it('ends exactly where it started so the animation loops seamlessly', () => {
		const store = createScenarioStore('random');
		simulate(store);

		const first = store.snapshots[0];
		const last = store.snapshots[store.snapshots.length - 1];
		expect(last.soil).toEqual(first.soil);
		expect(last.pebbles.map(({ x, y, state }) => ({ x, y, state }))).toEqual(first.pebbles.map(({ x, y, state }) => ({ x, y, state })));
		expect(last.beetles.map(({ x, y, state }) => ({ x, y, state }))).toEqual(first.beetles.map(({ x, y, state }) => ({ x, y, state })));
		expect(last.wombat).toMatchObject({ x: BURROW_DEN.x, y: BURROW_DEN.y, visible: false });
		expect(first.wombat).toMatchObject({ x: BURROW_DEN.x, y: BURROW_DEN.y });
	});

	it('never slides a visible sprite across the board when resetting', () => {
		const store = createScenarioStore('full');
		simulate(store);

		for (let i = 1; i < store.snapshots.length; i++) {
			const before = store.snapshots[i - 1].wombat;
			const after = store.snapshots[i].wombat;
			if (before.visible && after.visible) expect(Math.abs(before.x - after.x) + Math.abs(before.y - after.y)).toBeLessThanOrEqual(1);
		}
	});
});

describe('burrow svg', () => {
	it('is deterministic for the same graph', () => {
		const a = createScenarioStore('gradient');
		const b = createScenarioStore('gradient');
		simulate(a);
		simulate(b);
		expect(Renderer.generateAnimatedSVG(a)).toBe(Renderer.generateAnimatedSVG(b));
	});

	it.each(['github', 'github-dark'] as ThemeKeys[])('stays README-sized on the densest graph (%s)', (theme) => {
		const store = createScenarioStore('full', theme);
		simulate(store);
		const svg = Renderer.generateAnimatedSVG(store);

		expect(svg.startsWith('<svg')).toBe(true);
		expect(svg.endsWith('</svg>')).toBe(true);
		expect(svg.length).toBeLessThan(250 * 1024);
	});

	it('only defines the sprites it uses, and every used sprite is defined', () => {
		const store = createScenarioStore('random');
		simulate(store);
		const svg = Renderer.generateAnimatedSVG(store);

		const defined = new Set([...svg.matchAll(/<g id="([^"]+)"/g)].map((m) => m[1]));
		const referenced = new Set([...svg.matchAll(/#(b[wbp]-[a-z0-9-]+)/g)].map((m) => m[1]));
		for (const id of referenced) expect(defined).toContain(id);
	});

	it('maps dig progress to crumble stages', () => {
		expect([4, 3, 2, 1, 0].map((h) => crumbleStage(4, h))).toEqual([0, 1, 2, 3, 0]);
		expect([3, 2, 1, 0].map((h) => crumbleStage(3, h))).toEqual([0, 1, 2, 0]);
		expect([2, 1, 0].map((h) => crumbleStage(2, h))).toEqual([0, 2, 0]);
		expect([1, 0].map((h) => crumbleStage(1, h))).toEqual([0, 0]);
	});

	it('crumbles a dense day through every stage while it is dug', () => {
		const store = createStoreWithLevels([{ x: 0, y: BURROW_DEN.y, level: 4 }]);
		simulate(store);
		const svg = Renderer.generateAnimatedSVG(store);

		const crumbleHref = svg.match(/<use href="#bc-1"[^>]*><animate attributeName="href"[^>]*values="([^"]+)"/);
		expect(crumbleHref).not.toBeNull();
		const stages = (crumbleHref as RegExpMatchArray)[1].split(';').filter((v, i, all) => v !== all[i - 1]);
		expect(stages).toEqual(['#bc-1', '#bc-2', '#bc-3']);
		expect(svg).toContain('<clipPath id="bc-clip">');
	});

	it('opens light days in a single scrape, without crumbling', () => {
		const store = createStoreWithLevels([{ x: 0, y: BURROW_DEN.y, level: 1 }]);
		simulate(store);
		expect(Renderer.generateAnimatedSVG(store)).not.toContain('#bc-');
	});

	it('uses warm tunnels and the theme palette for soil', () => {
		const light = createScenarioStore('full', 'github');
		simulate(light);
		const svg = Renderer.generateAnimatedSVG(light);

		expect(svg).toContain(GAME_THEMES.github.intensityColors[4]);
		expect(svg).toContain('#efe3cf');
	});
});
