//mocks
let musicSyncTimepointToMeasure = {
	add: (i, timepoint) => {},
	delete: (timepoint) => {}
}
let viewCallback = () => {}

// parse sync file
describe('Parsing input sync file', () => {
	it('should fail when input measures are fewer than sheetmusic measures', () => {
		const musicSyncMeasures = [{ timepoint: [], repeat: REPEAT.off}, { timepoint: [], repeat: REPEAT.off}, { timepoint: [], repeat: REPEAT.off}];
		const inputObject = [{ timepoint: [], repeat: REPEAT.off}, { timepoint: [], repeat: REPEAT.off}];
		chai.assert.equal(loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback), false);
	});
	it('should fail when input measures are greater than sheetmusic measures', () => {
		const musicSyncMeasures = [{ timepoint: [], repeat: REPEAT.off}, { timepoint: [], repeat: REPEAT.off}];
		const inputObject = [{ timepoint: [], repeat: REPEAT.off}, { timepoint: [], repeat: REPEAT.off}, { timepoint: [], repeat: REPEAT.off}];
		chai.assert.equal(loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback), false);
	});
	it('should fail when input measure has more than 1 timepoint and corresponding measure in sheet music is NOT repeated', () => {
		const musicSyncMeasures = [{ timepoint: [0], repeat: REPEAT.off}];
		const inputObject = [{ timepoint: [0, 1], repeat: REPEAT.off}];
		chai.assert.equal(loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback), false);
	});
	it('should fail when input measure has different repetition type than corresponding measure in sheet music', () => {
		const musicSyncMeasures = [{ timepoint: [0], repeat: REPEAT.off}];
		const inputObject = [{ timepoint: [0], repeat: REPEAT.start}];
		chai.assert.equal(loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback), false);
	});
	it('should succeed when input measure has more timepoints than corresponding measure in sheet music and measure is repeated', () => {
		const musicSyncMeasures = [{ timepoint: [0, 1], repeat: REPEAT.on}];
		const inputObject = [{ timepoint: [0, 1, 2], repeat: REPEAT.on}];
		chai.assert.equal(loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback), true);
	});
	it('should succeed when input measure has fewer timepoints than corresponding measure in sheet music and measure is repeated', () => {
		const musicSyncMeasures = [{ timepoint: [0, 1, 2], repeat: REPEAT.on}];
		const inputObject = [{ timepoint: [0, 1], repeat: REPEAT.on}];
		chai.assert.equal(loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback), true);
	});
	it('should succeed when input measures have exactly the same number of timepoints and measures are both repeated', () => {
		const musicSyncMeasures = [{ timepoint: [0, 1, 2], repeat: REPEAT.on}];
		const inputObject = [{ timepoint: [0, 1, 2], repeat: REPEAT.on}];
		chai.assert.equal(loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback), true);
	});
});

