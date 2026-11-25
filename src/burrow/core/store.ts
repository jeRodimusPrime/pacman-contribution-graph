import { createWombat } from '../entities/wombat';
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
	wombat: createWombat(),
	beetles: [],
	pebbles: [],
	snapshots: [],
	score: 0,
	cellsDug: 0,
	beetlesLulled: 0,
	beetlesBonked: 0
};
