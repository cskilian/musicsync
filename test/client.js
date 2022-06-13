//mocks
let musicSyncTimepointToMeasure = {
	add: (i, timepoint) => {},
	delete: (timepoint) => {}
}
let viewCallback = () => {}

// parse sync file
describe('loadSyncInput', () => {
	it('should fail when measure lengths are different', () => {
		const musicSyncMeasures = [{ timepoint: [], repeat: REPEAT.off}, { timepoint: [], repeat: REPEAT.off}, { timepoint: [], repeat: REPEAT.off}];
		const inputObject = [{ timepoint: [], repeat: REPEAT.off}, { timepoint: [], repeat: REPEAT.off}];
		chai.assert.equal(loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback), false);
	});
	it('should fail when input measure has more timepoints than corresponding measure in sheet music', () => {
		const musicSyncMeasures = [{ timepoint: [0, 1], repeat: REPEAT.off}];
		const inputObject = [{ timepoint: [0, 1, 2], repeat: REPEAT.off}];
		chai.assert.equal(loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback), false);
	});
});

