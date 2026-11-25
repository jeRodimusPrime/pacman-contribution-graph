import { BurrowConfig, BurrowStore } from '../types';

export const Store: BurrowStore = {
	contributions: [],
	grid: [],
	monthLabels: [],
	config: undefined as unknown as BurrowConfig,
	gameInterval: 0,
	frameCount: 0,
	soil: [],
	initialSoil: [],
	wombat: {
		x: -1,
		y: 3,
		facing: 'right',
		pose: 'walk',
		digPhase: 0,
		lanternCooldown: 0,
		lanternHold: 0,
		lanternAim: 'side',
		visible: true
	},
	beetles: [],
	pebbles: [],
	snapshots: [],
	score: 0,
	cellsDug: 0,
	beetlesLulled: 0,
	beetlesBonked: 0
};
