/* ====================================================================================
 * Constants
 * ====================================================================================
 */
//Element identifiers
const AUDIO_FILE_NAME = "audio-name";
const AUDIO_FILE_INPUT = "audio";
const SCORE_FILE_NAME = "score-name";
const SCORE_FILE_INPUT = "score";
const SYNC_FILE_NAME = "sync-name";
const SYNC_FILE_INPUT = "sync";
const AUDIO_PLAYER_ID = "audio-player";
const PLAY_PAUSE_BUTTON = "play-pause-button";
const MANUAL_SYNC_BUTTON = "manual-sync-button";
const AUTO_SYNC_BUTTON = "auto-sync-button";
const TIMELINE_SEEKER = "seeker";
const TIMELINE = "time-line";
const SHEET_MUSIC_CONTAINER = "osmd-container";
const LOADING_SIGN = "loading-sign";
const TIMEPOINT_EDITOR = "timepoint-editor";
const TIMEPOINT_SELECTOR = "timepoint-selector";

//VexFlow constants
const UNIT_IN_PIXELS = 10;
const TIMEPOINT_EDITOR_WIDTH = 510;
const REPETITION_SELECTOR_WIDTH = 100;

//Application constants and global
const REPEAT = {
	off: 0,
	on: 1,
	start: 2,
	end: 3,
	gate: 4,
};

const SYNC_COMPLETE = 4;
const SYNC_FAILED = 5;
const READY_TO_SYNC = 2;

class Measure {
	constructor(repeat) {
		this.timepoint = [];
		this.repeat = repeat;
	}
};

var MusicSync = {
	osmd: undefined,                 //holds the opensheetmusicdisplay data structures
	isRecording: false,              //this is a flag whether we are manually syncing when playing
	recordingClickCounts: undefined, //this is an object for recording the number of times we click on a measure during manual sync, it is cleared when manual sync stops
	measures: [],                    //this holds the Measure object containing synced timepoints and repetition information
	timepointToMeasure: undefined,   //this holds mapping from timepoint to measure
	timepointIterator: undefined, //this holds an iterator for timepoints in timepointToMeasure mapping
	nextTimepoint: undefined,
	previousTimepoint: undefined,
	scoreFileData: undefined,
	audioFileData: undefined,
	isSyncing: false,
	syncId: undefined,
};

/* ====================================================================================
 * Controllers
 * ====================================================================================
 */
function initOSMD()
{
	MusicSync.osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(SHEET_MUSIC_CONTAINER);
	MusicSync.osmd.setOptions({
		autoResize: false,
		backend: "svg",
		drawTitle: true,
		measureNumberInterval: 1,
		cursorOptions: [{type: 3}],
    	// drawingParameters: "compacttight" // don't display title, composer etc., smaller margins
	});
}

function initMeasures()
{
	MusicSync.measures = [];
	let repeating = false;
	let firstRepeatStart = undefined;
	let firstRepeatEnd = undefined;
	for (let i = 0; i < MusicSync.osmd.GraphicSheet.measureList.length; ++i)
	{
		let musicSyncMeasure = null;
		if (MusicSync.osmd.GraphicSheet.measureList[i][0] === undefined || MusicSync.osmd.GraphicSheet.measureList[i][0] === null)
		{
			continue;
		}
		let measure = MusicSync.osmd.GraphicSheet.measureList[i][0].parentSourceMeasure;
		if ((0 < measure.lastRepetitionInstructions.length && 0 < measure.firstRepetitionInstructions.length) ||
			(0 < measure.firstRepetitionInstructions.length && measure.firstRepetitionInstructions[0].type == 3))
		{
			musicSyncMeasure = new Measure(REPEAT.gate);
			repeating = false;
		}
		else if (0 < measure.lastRepetitionInstructions.length)
		{
			musicSyncMeasure = new Measure(REPEAT.end);
			repeating = false;
			if (firstRepeatEnd == undefined)	//this is to keep track of the first repeat sign, we have to do another pass to get the repetitions correct
			{
				firstRepeatEnd = i;
			}
		}
		else if (0 < measure.firstRepetitionInstructions.length)
		{
			musicSyncMeasure = new Measure(REPEAT.start);
			repeating = true;
			if (firstRepeatStart == undefined)
			{
				firstRepeatStart = i;
			}
		}
		else if (repeating)
		{
			musicSyncMeasure = new Measure(REPEAT.on);
		}
		else
		{
			musicSyncMeasure = new Measure(REPEAT.off);
		}
		MusicSync.measures.push(musicSyncMeasure);
	}
	if (firstRepeatEnd < firstRepeatStart)
	{
		for (i = firstRepeatEnd; 0 <= i; --i)
		{
			if (MusicSync.measures[i].repeat == REPEAT.off)
			{
				MusicSync.measures[i].repeat = REPEAT.on;
			}
		}
	}
	MusicSync.measures[0].timepoint.push(0);	//assign audio beginning to 1st measure just in case
}

function initTimepointToMeasure()
{
	MusicSync.timepointToMeasure = SortedMap();
	for (let i = 0; i < MusicSync.measures.length; ++i)
	{
		for (let j = 0; j < MusicSync.measures[i].timepoint.length; ++j)
		{
			MusicSync.timepointToMeasure.add(i, MusicSync.measures[i].timepoint[j]);
		}
	}
}

function measureClickControl(measureIndex)
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	const measure = MusicSync.measures[measureIndex];
	const repeating = (REPEAT.on <= measure.repeat && measure.repeat <= REPEAT.end); 
	if (MusicSync.isRecording)
	{
		if (repeating)
		{
			if (MusicSync.recordingClickCounts == undefined || MusicSync.recordingClickCounts[measureIndex] == undefined)
			{
				MusicSync.timepointToMeasure.delete(measure.timepoint[0]);
				measure.timepoint[0] = audioPlayer.currentTime;
				MusicSync.timepointToMeasure.add(measureIndex, measure.timepoint[0]);
				MusicSync.recordingClickCounts[measureIndex] = 1;
			}
			else
			{
				measure.timepoint[MusicSync.recordingClickCounts[measureIndex]] = audioPlayer.currentTime;
				MusicSync.timepointToMeasure.add(measureIndex, measure.timepoint[MusicSync.recordingClickCounts[measureIndex]]);
				MusicSync.recordingClickCounts[measureIndex]++;
			}
		}
		else
		{
			MusicSync.timepointToMeasure.delete(measure.timepoint[0]);
			measure.timepoint[0] = audioPlayer.currentTime;
			MusicSync.timepointToMeasure.add(measureIndex, measure.timepoint[0]);
		}
	}
	else
	{
		if (1 == measure.timepoint.length)
		{
			changeAudioPlayerPositionControl(measure.timepoint[0]);
		}
		else if (1 < measure.timepoint.length)
		{
			changeAudioPlayerPositionControl(measure.timepoint[measure.timepoint.length - 1]);
			createRepetitionSelector(measureIndex);
		}
	}
}

function changeAudioPlayerPositionControl(timepoint)
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	audioPlayer.currentTime = timepoint;
	findNextTimepoint();
}

function findNextTimepoint()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	if (MusicSync.timepointToMeasure !== undefined)
	{
		MusicSync.timepointIterator = MusicSync.timepointToMeasure.keys();
		MusicSync.nextTimepoint = MusicSync.timepointIterator.next().value;
		while (MusicSync.nextTimepoint !== undefined && MusicSync.nextTimepoint <= audioPlayer.currentTime)
		{
			MusicSync.nextTimepoint = MusicSync.timepointIterator.next().value;
		}
	}
}

function changeScore(file)
{
	let fileReader = new FileReader();
	fileReader.onload = (event) => {
		MusicSync.osmd.load(event.target.result).then(() => {
			initMeasures();
			initTimepointToMeasure();
			MusicSync.osmd.render();
			createClickBoundingBoxes();
			endLoadingSign();
		});
		fileNameArray = file.name.toLowerCase().split(".")
		MusicSync.scoreFileData = {extension: fileNameArray[fileNameArray.length - 1], data: btoa(event.target.result)};
	};
	if (file.name.toLowerCase().endsWith(".xml") || file.name.toLowerCase().endsWith(".musicxml"))
	{
		fileReader.readAsText(file);
	}
	else if (file.name.toLowerCase().endsWith(".mxl"))
	{
		fileReader.readAsBinaryString(file);
	}
	else
	{
		error("Invalid or corrupt musicxml file", true);
	}
}

function loadAndValidateSyncFile(file)
{
	var fileReader = new FileReader();
	fileReader.onload = (event) => {
		const inputFileString = event.target.result;
		const inputFileObject = JSON.parse(inputFileString);
		if (!loadSyncInput(MusicSync.measures, MusicSync.timepointToMeasure, inputFileObject, updateMeasureTimepointLabelAndTurnOffHighlighting))
		{
			error("Loaded sync file does not match musical score", true);
		}
		findNextTimepoint();
	};
	fileReader.readAsText(file);
}

function loadSyncInput(musicSyncMeasures, musicSyncTimepointToMeasure, inputObject, viewCallback)
{
	let valid = true;
	let measures = musicSyncMeasures.length;
	if (Array.isArray(inputObject))
	{
		if (inputObject.length != musicSyncMeasures.length)
		{
			measures = (inputObject.length < musicSyncMeasures.length ? inputObject.length : measures);
			valid = false;
		}
	}
	else
	{
		valid = false;
		return valid;
	}
	for (var i = 0; i < measures; ++i)
	{
		if (inputObject[i] === undefined ||
			!Array.isArray(inputObject[i].timepoint))
		{
			valid = false;
			continue;
		}
		if (inputObject[i].repeat !== musicSyncMeasures[i].repeat)
		{
			valid = false;
		}
		if ((musicSyncMeasures[i].repeat === REPEAT.off || musicSyncMeasures[i].repeat === REPEAT.gate) && 1 < inputObject[i].timepoint.length)
		{
			valid = false;
		}
		let j = undefined;
		for (j in inputObject[i].timepoint)
		{
			if (isNaN(j) || ((musicSyncMeasures[i].repeat === REPEAT.off || musicSyncMeasures[i].repeat === REPEAT.gate) && 0 < j))
			{
				valid = false;
				continue;
			}
			else
			{
				if (isNaN(inputObject[i].timepoint[j]))
				{
					valid = false;
					continue;
				}
				else
				{
					musicSyncTimepointToMeasure.delete(musicSyncMeasures[i].timepoint[j]);
					musicSyncMeasures[i].timepoint[j] = inputObject[i].timepoint[j];
					musicSyncTimepointToMeasure.add(i, musicSyncMeasures[i].timepoint[j]);
					viewCallback(i);
				}
			}
		}
	}
	return valid;
}

function autosyncTimepointsToMeasures(timepoints, musicSyncMeasures)
{
	importedMeasures = []
	for (let i = 0; i < timepoints.length; ++i)
	{
		let measure = new Object();
		measure.repeat = musicSyncMeasures[i].repeat;
		measure.timepoint = timepoints[i];
		importedMeasures.push(measure);
	}
	return importedMeasures;
}


function stopAudioControl()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	audioPlayer.pause();
	changeAudioPlayerPositionControl(0);
}

function manualSyncControl()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	MusicSync.isRecording = !MusicSync.isRecording;
	MusicSync.recordingClickCounts = [];
	if (MusicSync.isRecording && audioPlayer.paused)
	{
		audioPlayer.play();
	}
	else if (!MusicSync.isRecording)
	{
		audioPlayer.pause();
	}
}

function stopManualSync()
{
	MusicSync.isRecording = false;
}

function stopAutoSync()
{
	MusicSync.isSyncing = false;
	if (MusicSync.syncId !== undefined)
	{
		let xhr = new XMLHttpRequest();
		xhr.open("DELETE", `/autosync/${MusicSync.syncId}`, true);
		xhr.send();
	}
	MusicSync.syncId = undefined;
}

function changeAudioPlayerSource(file)
{
	stopAudioControl()
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	const seeker = document.getElementById(TIMELINE_SEEKER);
	var fileReader = new FileReader();
	fileReader.onload = (event) => {
		audioPlayer.src = event.target.result;
		fileNameArray = file.name.toLowerCase().split(".");
		MusicSync.audioFileData = {extension: fileNameArray[fileNameArray.length - 1], data: audioPlayer.src};
	}
	fileReader.readAsDataURL(file);
	audioPlayer.addEventListener('canplaythrough', () => {
		var duration = audioPlayer.duration;
		audioPlayer.addEventListener('timeupdate', timeUpdate(duration), false);
	}, false);

}

function playPauseAudioControl()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	if (audioPlayer.src == "")
	{
		return;
	}
	if (audioPlayer.paused)
	{
		audioPlayer.play();
	}
	else
	{
		audioPlayer.pause();
	}
}

function changeAudioPlayerPosition(event)
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
 	const timeline = document.getElementById(TIMELINE);
 	const timelineWidth = timeline.offsetWidth - seeker.offsetWidth;
  	changeAudioPlayerPositionControl(audioPlayer.duration * (event.clientX - timeline.getBoundingClientRect().left) / timelineWidth);
}

function measuresToJSON()
{
	var jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(MusicSync.measures, null, 2));
	var fileName = document.getElementById(SCORE_FILE_NAME).innerText + ".json";
	return [jsonString, fileName];
}

function resetInput(inputId)
{
	const input = document.getElementById(inputId);
	input.value = "";
}

function clearCurrentMeasure()
{
	let timepoints = []
	timepoints.push(MusicSync.nextTimepoint);
	timepoints.push(MusicSync.previousTimepoint);
	MusicSync.nextTimepoint = undefined;
	MusicSync.previousTimepoint = undefined;
	return timepoints;
}

function autoSyncSendAudio(id)
{
	let audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	let xhr = new XMLHttpRequest();
	xhr.open("POST", `/autosync/${id}/audio`, true);
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.send(JSON.stringify(MusicSync.audioFileData));
}

function autoSyncSendScore(id)
{
	let xhr = new XMLHttpRequest();
	xhr.open("POST", `/autosync/${id}/score`, true);
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.send(JSON.stringify(MusicSync.scoreFileData));
}

function autoSyncStartSync(id)
{
	let xhr = new XMLHttpRequest();
	xhr.open("POST", `/autosync/${id}/sync`, true);
	xhr.send();
}

function getAutoSyncStatus(id)
{
	return new Promise(resolve => {
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = () => {
			if (xhr.readyState == 4 && xhr.status == 200)
			{
				let status = JSON.parse(xhr.responseText).status;
				resolve(status);
			}
		};
		xhr.onerror = () => {
			resolve(-1);
		};
		xhr.open("GET", `/autosync/${id}`, true);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send();	
	});
}

async function waitWhileUploadCompletes(id)
{
	while (MusicSync.isSyncing && (await getAutoSyncStatus(id)) < READY_TO_SYNC)
	{
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
}

async function waitWhileAutoSyncing(id)
{
	while (MusicSync.isSyncing && (await getAutoSyncStatus(id)) < SYNC_COMPLETE)
	{
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	return (await getAutoSyncStatus(id))
}

async function getSyncInfo(id)
{
	return new Promise(resolve => {
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = () => {
			if (xhr.readyState == 4 && xhr.status == 200)
			{
				console.log(xhr.responseText);
				let syncData = JSON.parse(xhr.responseText);
				resolve(syncData);
			}
		};
		xhr.onerror = () => {
			reject(xhr.status);
		};
		xhr.open("GET", `/autosync/${id}/sync`, true);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send();
	});
}

async function initAutoSyncRequest()
{
	return new Promise(resolve => {
		let xhr = new XMLHttpRequest();
		xhr.onreadystatechange = () => {
			if (xhr.readyState == 4 && xhr.status == 200)
			{
				let id = JSON.parse(xhr.responseText).id;
				resolve(id);
			}
		};
		xhr.onerror = () => {
			reject(xhr.status);
		};
		xhr.open("POST", "/autosync", true);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send();
	});
}

function autoSyncControlError(error)
{
	error(`Autosynchronisation failed due to communication breakdown: ${error}`, true);
	stopAutoSync();
	updateAutoSyncButton();
}

async function autoSyncControl()
{
	MusicSync.isSyncing = !MusicSync.isSyncing;
	if (MusicSync.isSyncing)
	{
		let id = await initAutoSyncRequest().catch((error) => {autoSyncControlError(error); return;});
		MusicSync.syncId = id;
		autoSyncSendAudio(MusicSync.syncId);
		autoSyncSendScore(MusicSync.syncId);
		await waitWhileUploadCompletes(MusicSync.syncId);
		autoSyncStartSync(MusicSync.syncId);
		let status = await waitWhileAutoSyncing(MusicSync.syncId);
		if (status == SYNC_COMPLETE)
		{
			let syncData = await getSyncInfo(MusicSync.syncId).catch((error) => {autoSyncControlError(error); return;});
			let syncedMeasures = autosyncTimepointsToMeasures(syncData, MusicSync.measures);
			loadSyncInput(MusicSync.measures, MusicSync.timepointToMeasure, syncedMeasures, updateMeasureTimepointLabelAndTurnOffHighlighting);
			findNextTimepoint();
		}
		else
		{
			error("Autosynchronisation failed due to server error", true);
		}
		stopAutoSync();
		updateAutoSyncButton();
	}
	else
	{
		stopAutoSync();
	}
}


/* =====================================================================================
 * View (User Interface)
 * =====================================================================================
 */
function error(errorMessage, alert)
{
	if (alert)
	{
		window.alert(errorMessage);
	}
	console.log(errorMessage);
}

function updateLabel(labelId, fileName)
{
	document.getElementById(labelId).innerHTML = fileName;
}

function updateSeeker()
{
	const seeker = document.getElementById(TIMELINE_SEEKER);
	seeker.style.setProperty("background", "linear-gradient(white, #878787)");
}
/*
 * Returns an event handler that gets called by the audio-player to update the UI of the timeline
 */
function timeUpdate(duration)
{
	var timeUpdateFn = function() {
 		const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
 		const seeker = document.getElementById(TIMELINE_SEEKER);
 		const timeline = document.getElementById(TIMELINE);
 		const timelineWidth = timeline.offsetWidth - seeker.offsetWidth;
 		const currentPlace = audioPlayer.currentTime / duration;
 		const newMarginLeft = currentPlace * timelineWidth;
 		if (0 <= newMarginLeft && newMarginLeft <= timelineWidth)
 		{
 			seeker.style.marginLeft = newMarginLeft + "px";
 		}
 		else if (newMarginLeft < 0)
 		{
 			seeker.style.marginLeft = "0px";
 		}
 		else
 		{
 			seeker.style.maginLeft = timelineWidth + "px";
 		}
 		if (MusicSync.nextTimepoint !== undefined && !MusicSync.isRecording && MusicSync.nextTimepoint <= audioPlayer.currentTime)
 		{
 			const currentMeasure = MusicSync.timepointToMeasure.get(MusicSync.nextTimepoint);
 			setMeasureHighlighting(currentMeasure, true);
 			autoScrollPageOnPlayback(currentMeasure);
  			if (MusicSync.previousTimepoint !== undefined)
 			{
 				const previousMeasure = MusicSync.timepointToMeasure.get(MusicSync.previousTimepoint);
 				setMeasureHighlighting(previousMeasure, false);
 			}
 			MusicSync.previousTimepoint = MusicSync.nextTimepoint;
 			MusicSync.nextTimepoint = MusicSync.timepointIterator.next().value;
 		}
 	}
 	return timeUpdateFn;
}

function setMeasureHighlighting(measureIndex, onOff)
{
	const measureBoxes = document.getElementsByClassName(`measure-box-${measureIndex}`);
	for (let i = 0; i < measureBoxes.length; ++i)
 	{
 		const currentMeasureBox = measureBoxes[i];
 		if (onOff)
 		{
 			currentMeasureBox.style.fill = "green";
 			currentMeasureBox.style.opacity = 0.3;
 		}
 		else
 		{
 			currentMeasureBox.style.fill = null;
 			currentMeasureBox.style.opacity = 0;
 		}
 	}
}

function autoScrollPageOnPlayback(measureIndex)
{
	const osmdContainer = document.getElementById(SHEET_MUSIC_CONTAINER);
	const measureBoxes = document.getElementsByClassName(`measure-box-${measureIndex}`);
	const firstMeasureBox = measureBoxes[0];
	const lastMeasureBox = measureBoxes[measureBoxes.length - 1];
	const lastMeasureBoxPosition = parseFloat(lastMeasureBox.getAttribute("y")) + parseFloat(lastMeasureBox.getAttribute("height"));
	const firstMeasureBoxPosition = parseInt(firstMeasureBox.getAttribute("y"));
	if ((osmdContainer.scrollTop + osmdContainer.clientHeight < lastMeasureBoxPosition + 50) || (firstMeasureBoxPosition < osmdContainer.scrollTop))
	{
		osmdContainer.scrollTop = Math.max(0, firstMeasureBoxPosition - 100);
	}
}

function turnOffAllMeasureHighlighting()
{
	for (let i = 0; i < MusicSync.measures.length; ++i)
	{
		setMeasureHighlighting(i, false);
	}
}

function updatePlayPauseButton()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	const button = document.getElementById(PLAY_PAUSE_BUTTON);
	const label = button.children[0].children[1];
	const icon = button.children[0].children[0];
	if (audioPlayer.src == "" || audioPlayer.paused)
	{
		label.innerText = "Play";
		icon.setAttribute("class", "fa fa-play");
	}
	else
	{
		label.innerText = "Pause";
		icon.setAttribute("class", "fa fa-pause");
	}
}

function updateManualSyncButton()
{
	const button = document.getElementById(MANUAL_SYNC_BUTTON);
	if (MusicSync.isRecording)
	{
		button.style.setProperty("background", "red");
	}
	else
	{
		button.style.setProperty("background", "linear-gradient(white, #878787)");
	}
}

function updateAutoSyncButton()
{
	const button = document.getElementById(AUTO_SYNC_BUTTON);
	if (MusicSync.isSyncing)
	{
		button.style.setProperty("background", "orange");
	}
	else
	{
		button.style.setProperty("background", "linear-gradient(white, #878787)");
	}
}

function moveSeeker(event)
{
 	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
 	const seeker = document.getElementById(TIMELINE_SEEKER);
 	const timeline = document.getElementById(TIMELINE);
 	const timelineWidth = timeline.offsetWidth - seeker.offsetWidth;
 	const newMarginLeft = event.clientX - timeline.getBoundingClientRect().left;
 	if (0 <= newMarginLeft && newMarginLeft <= timelineWidth)
 	{
 		seeker.style.marginLeft = newMarginLeft + "px";
 	}
 	else if (newMarginLeft < 0)
 	{
 		seeker.style.marginLeft = "0px";
 	}
 	else
 	{
 		seeker.style.maginLeft = timelineWidth + "px";
 	}
}

//displays loading sign while xml is rendered
function startLoadingSign()
{
	const loadingSign = document.getElementById(LOADING_SIGN);
	loadingSign.setAttribute("style", "display: visible;");

}

//removes loading sign
function endLoadingSign()
{
	const loadingSign = document.getElementById(LOADING_SIGN);
	loadingSign.setAttribute("style", "display: none;");
}

function createClickBoundingBoxes()
{
	const svgCanvas = document.getElementsByTagName("svg")[0];
	for (let bar = 0; bar < MusicSync.osmd.GraphicSheet.measureList.length; ++bar)
	{
		for (let i = 0; i < MusicSync.osmd.GraphicSheet.measureList[bar].length; ++i)
		{
			let measure = MusicSync.osmd.GraphicSheet.measureList[bar][i];
			if (measure === undefined || measure === null)
			{
				continue;
			}
			let x = measure.boundingBox.absolutePosition.x * UNIT_IN_PIXELS;
			let y = measure.boundingBox.absolutePosition.y * UNIT_IN_PIXELS;
			let width = measure.boundingBox.boundingRectangle.width * UNIT_IN_PIXELS;
			let height = measure.boundingBox.boundingRectangle.height * UNIT_IN_PIXELS;
			let stave_height = measure.stave.height;
			height = (height < stave_height ? stave_height : height); 
			var boundingBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			boundingBox.setAttribute("x", x);
			boundingBox.setAttribute("y", y);
			boundingBox.setAttribute("width", width);
			boundingBox.setAttribute("height", height);
			boundingBox.setAttribute("style", "pointer-events: bounding-box; opacity: 0;");
			boundingBox.setAttribute("onclick", `measureClick(${bar})`);
			boundingBox.setAttribute("class", `measure-box-${bar}`);
			svgCanvas.appendChild(boundingBox);
		}
	}
}

function createMeasureTimepointLabels()
{
	for (let i = 0; i < MusicSync.measures.length; ++i)
	{
		updateMeasureTimepointLabel(i);
	}
}

function updateMeasureTimepointLabel(measureIndex)
{
	const svgCanvas = document.getElementsByTagName("svg")[0];
	let oldMeasureContainer = document.getElementById(`measure-label-${measureIndex}`);
	if (oldMeasureContainer != null)
	{
		svgCanvas.removeChild(oldMeasureContainer);
	}
	const measure = MusicSync.osmd.GraphicSheet.measureList[measureIndex][0];
	const x = (measure.boundingBox.absolutePosition.x + measure.rules.MeasureNumberLabelXOffset) * UNIT_IN_PIXELS;
	const measureY = (measure.boundingBox.absolutePosition.y + measure.boundingBox.borderMarginTop) * UNIT_IN_PIXELS;
	const measureContainer = document.createElementNS("http://www.w3.org/2000/svg", "g");
	measureContainer.setAttribute("id", `measure-label-${measureIndex}`);
	measureContainer.setAttribute("onclick", `measureLabelClick(${measureIndex})`);
	for (let i = 0; i < MusicSync.measures[measureIndex].timepoint.length; ++i)
	{
		let y = measureY - (1.7 * UNIT_IN_PIXELS * (i + 1));
		const offset = MusicSync.measures[measureIndex].timepoint.length - i - 1;
		let minutes = (MusicSync.measures[measureIndex].timepoint[offset] / 60) >> 0;
		let seconds = MusicSync.measures[measureIndex].timepoint[offset] % 60;
		let measureLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
		measureLabel.setAttribute("x", x);
		measureLabel.setAttribute("y", y);
		measureLabel.setAttribute("stroke-width", "0.3");
		measureLabel.setAttribute("fill", "black");
		measureLabel.setAttribute("stroke", "none");
		measureLabel.setAttribute("stroke-dasharray", "none");
		measureLabel.setAttribute("font-family", "Times New Roman");
		measureLabel.setAttribute("font-size", "15px");
		measureLabel.setAttribute("font-weight", "normal");
		measureLabel.setAttribute("font-style", "normal");
		measureLabel.textContent = `${minutes}:${seconds.toFixed(3)}`;
		measureContainer.appendChild(measureLabel);
	}
	svgCanvas.appendChild(measureContainer);
}

function updateMeasureTimepointLabelAndTurnOffHighlighting(measureIndex)
{
	setMeasureHighlighting(measureIndex, false);
	updateMeasureTimepointLabel(measureIndex);
}

function makeAndClickDownloadAnchor(saved)
{
	var downloadAnchor = document.createElement("a");
	downloadAnchor.setAttribute("href", saved[0]);
	downloadAnchor.setAttribute("download", saved[1]);
	document.body.appendChild(downloadAnchor);
	downloadAnchor.click();
	downloadAnchor.remove();
}

function createTimepointEditor(measureIndex)
{
	let editor = document.createElement("div");
	const measureLabelContainer = document.getElementById(`measure-label-${measureIndex}`);
	const osmdContainer = document.getElementById(SHEET_MUSIC_CONTAINER);
	const x = Number.parseInt(measureLabelContainer.children[0].getAttributeNode("x").nodeValue) + osmdContainer.getBoundingClientRect().left;
	const y = Number.parseInt(measureLabelContainer.children[0].getAttributeNode("y").nodeValue) - osmdContainer.scrollTop + osmdContainer.getBoundingClientRect().top;
	editor.setAttribute("id", TIMEPOINT_EDITOR);
	editor.setAttribute("style", `position: absolute; top: ${y}px; left: ${x}px; z-index: 10; display: table-cell; vertical-align: middle`);
	for (i in MusicSync.measures[measureIndex].timepoint)
	{
		const absolute_seconds = MusicSync.measures[measureIndex].timepoint[i];
		let minutes = (MusicSync.measures[measureIndex].timepoint[i] / 60) >> 0;
		let seconds = MusicSync.measures[measureIndex].timepoint[i] % 60;
		let timepointHTML = `
			<div style="border-width: 0px 0px 1px 0px; border-style: solid;" id="${TIMEPOINT_EDITOR}-${i}">
				<input type="number" min="0" value="${minutes}">
				<span style="padding: 3px;">:</span>
				<input type="number" min="0" max="59.999" step="0.1" value="${seconds.toFixed(3)}">
				<span style="padding: 3px;" onclick="timepointEditorSave(${measureIndex}, ${i}, ${absolute_seconds})"><i class="fa fa-edit" aria-hidden="true"></i></span>
				<span style="padding: 3px;" onclick="timepointEditorDelete(${measureIndex}, ${i}, ${absolute_seconds})"><i class="fa fa-eraser" aria-hidden="true"></i></span>
			</div>
		`;
		editor.insertAdjacentHTML("beforeend", timepointHTML);
	}
	document.body.appendChild(editor);
	if (osmdContainer.getBoundingClientRect().right < x + TIMEPOINT_EDITOR_WIDTH)
	{
		editor.style.left = `${x - ((x + TIMEPOINT_EDITOR_WIDTH) - osmdContainer.getBoundingClientRect().right)}px`;
	}
	const svgCanvas = document.getElementsByTagName("svg")[0];
	svgCanvas.addEventListener("click", deleteTimepointEditor, true);
}

function createRepetitionSelector(measureIndex)
{
	let selector = document.createElement("div");
	const measureLabelContainer = document.getElementById(`measure-label-${measureIndex}`);
	const osmdContainer = document.getElementById(SHEET_MUSIC_CONTAINER);
	const x = Number.parseInt(measureLabelContainer.children[0].getAttributeNode("x").nodeValue) + osmdContainer.getBoundingClientRect().left;
	const y = Number.parseInt(measureLabelContainer.children[0].getAttributeNode("y").nodeValue) - osmdContainer.scrollTop + osmdContainer.getBoundingClientRect().top;
	selector.setAttribute("id", TIMEPOINT_SELECTOR);
	selector.setAttribute("style", `position: absolute; top: ${y}px; left: ${x}px; z-index: 10;`);
	for (i in MusicSync.measures[measureIndex].timepoint)
	{
		let timepointHTML = `
			<div style="border-width: 0px 1px 1px 0px; border-style: solid; display: inline-block;" id="${TIMEPOINT_SELECTOR}-${i}">
				<span style="padding: 3px; font-size: xx-large;" onclick="repetitionSelection(${measureIndex}, ${i})">${Number(i) + 1}</span>
			</div>
		`;
		selector.insertAdjacentHTML("beforeend", timepointHTML);
	}
	document.body.appendChild(selector);
	if (osmdContainer.getBoundingClientRect().right < x + REPETITION_SELECTOR_WIDTH)
	{
		selector.style.left = `${x - ((x + REPETITION_SELECTOR_WIDTH) - osmdContainer.getBoundingClientRect().right)}px`;
	}
	const svgCanvas = document.getElementsByTagName("svg")[0];
	svgCanvas.addEventListener("click", deleteRepetitionSelector, true);
}

function deleteTimepointEditor()
{
	if (document.getElementById(TIMEPOINT_EDITOR) !== null)
	{
		document.getElementById(TIMEPOINT_EDITOR).remove();
	}
	const svgCanvas = document.getElementsByTagName("svg")[0];
	if (svgCanvas !== undefined)
	{
		svgCanvas.removeEventListener("click", deleteTimepointEditor);
	}
}

function deleteRepetitionSelector()
{
	if (document.getElementById(TIMEPOINT_SELECTOR) !== null)
	{
		document.getElementById(TIMEPOINT_SELECTOR).remove();
	}
	const svgCanvas = document.getElementsByTagName("svg")[0];
	if (svgCanvas !== undefined)
	{
		svgCanvas.removeEventListener("click", deleteRepetitionSelector);
	}
}

function extractTimepointEditorRowData(id)
{
	let timepointEditor = document.getElementById(TIMEPOINT_EDITOR);
	let timepointEditorRow = document.getElementById(TIMEPOINT_EDITOR + "-" + id);
	let inputs = [];
	let timepointIndex = 0;
	for (let i = 0; i < timepointEditor.children.length; ++i)
	{
		if (timepointEditor.children[i] === timepointEditorRow)
		{
			timepointIndex = i;
			break;
		}
	}
	for (let i = 0; i < timepointEditorRow.children.length; ++i)
	{
		if (timepointEditorRow.children[i].tagName === "INPUT")
		{
			inputs.push(timepointEditorRow.children[i]);
		}
	}
	let minutes = Number(inputs[0].value);
	let seconds = Number(inputs[1].value);
	return [minutes, seconds, timepointIndex];
}

function deleteTimepointEditorRow(id)
{
	let timepointEditor = document.getElementById(TIMEPOINT_EDITOR);
	let timepointEditorRow = document.getElementById(TIMEPOINT_EDITOR + "-"+ id);
	let timepointIndex = 0;
	for (let i = 0; i < timepointEditor.children.length; ++i)
	{
		if (timepointEditor.children[i] === timepointEditorRow)
		{
			timepointIndex = i;
			break;
		}
	}
	timepointEditorRow.remove();
	if (timepointEditor.children.length == 0)
	{
		deleteTimepointEditor();
	}
	return timepointIndex;
}

function endMeasureHighlight(timepoints)
{
	for (timepoint in timepoints)
	{
		if (timepoints[timepoint] !== undefined && MusicSync.timepointToMeasure !== undefined)
		{
			const measure = MusicSync.timepointToMeasure.get(timepoints[timepoint]);
 			const measureBoxes = document.getElementsByClassName(`measure-box-${measure}`);
 			for (let i = 0; i < measureBoxes.length; ++i)
 			{
 				const measureBox = measureBoxes[i];
 				measureBox.style.fill = null;
 				measureBox.style.opacity = 0;
 			}
 		}
	}
}

/* =======================================================================================
 * Event Handlers
 * =======================================================================================
 */
function selectSyncFile(input)
{
	const fileName = input.files[0].name;
	loadAndValidateSyncFile(input.files[0]);
	updateLabel(SYNC_FILE_NAME, fileName);
	resetInput(SYNC_FILE_INPUT);
}

/*
 * Updates file label after upload
 */
function selectScoreFile(input) 
{
	const fileName = input.files[0].name;
	stopAutoSync();
	startLoadingSign();
	changeScore(input.files[0]);
	updateLabel(SCORE_FILE_NAME, fileName);
	resetInput(SCORE_FILE_INPUT);
}

/*
 * Custom handler for selecting audio file. It sets the source for the player to the given audio file
 */
function selectAudioFile(input)
{
	stopAutoSync();
	changeAudioPlayerSource(input.files[0]);
	updateLabel(AUDIO_FILE_NAME, input.files[0].name);
	updateSeeker();
	updatePlayPauseButton();
	resetInput(AUDIO_FILE_INPUT);
}

function dropFile(event, selectFunction, extensions)
{
	event.preventDefault();
	for (extension in extensions)
	{
		if (event.dataTransfer.files[0].name.toLowerCase().endsWith(extensions[extension]))
		{
			selectFunction(event.dataTransfer);
			return;
		}
	}
	error(`You need to drag a valid ${extensions[0]} file`, true);
}

function playPauseAudio()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	if (audioPlayer.src == "")
	{
		error("You need to load an audio file before playing", true);
		return;
	}
	playPauseAudioControl();
	updatePlayPauseButton();
}

function stopAudio()
{
	endMeasureHighlight(clearCurrentMeasure());
	stopAudioControl();
	stopManualSync();
	updatePlayPauseButton();
	updateManualSyncButton();
}

function resetAudio()
{
	endMeasureHighlight(clearCurrentMeasure());
	stopAudioControl();
	stopManualSync();
	updatePlayPauseButton();
	updateManualSyncButton();
}

function manualSync()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	if (audioPlayer.src == "")
	{
		error("You need to load an audio file and MusicXML score before synchronising", true);
		return;
	}
	stopAutoSync();
	turnOffAllMeasureHighlighting();
	manualSyncControl();
	updateAutoSyncButton();
	updateManualSyncButton();
	updatePlayPauseButton();
}

function autoSync()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	if (audioPlayer.src == "" || MusicSync.scoreFileData == undefined)
	{
		error("You need to load an audio file and MusicXML score before synchronising", true);
		return;
	}
	autoSyncControl();
	updateAutoSyncButton();
}


/* 
 * Event handler for clicking on the timeline
 */
function seekOnTimeline(event)
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	if (audioPlayer.src == "")
	{
		return;
	}
	changeAudioPlayerPosition(event);
	moveSeeker(event);
}

/*
 * Event handler for clicking on a bar
 */
function measureClick(measure)
{
	if (MusicSync.measures.length <= measure)
	{
		error("Clicked on a bounding box for a non-existent measure", false);
		return;
	}
	measureClickControl(measure);
	updateMeasureTimepointLabel(measure);
}

function measureLabelClick(measure)
{
	if (MusicSync.measures.length <= measure)
	{
		error("Clicked on timepoint label for a non-existent measure", false);
		return;
	}
	deleteTimepointEditor();
	createTimepointEditor(measure);
}

function timepointEditorSave(measureIndex, id, oldTimepoint)
{
	MusicSync.timepointToMeasure.delete(oldTimepoint);
	const data = extractTimepointEditorRowData(id);
	const minutes = data[0];
	const seconds = data[1];
	const timepointIndex = data[2];
	MusicSync.measures[measureIndex].timepoint[timepointIndex] = minutes * 60 + seconds;
	MusicSync.timepointToMeasure.add(measureIndex, MusicSync.measures[measureIndex].timepoint[timepointIndex]);
	updateMeasureTimepointLabel(measureIndex);
}

function timepointEditorDelete(measureIndex, id, oldTimepoint)
{
	MusicSync.timepointToMeasure.delete(oldTimepoint);
	const timepointIndex = deleteTimepointEditorRow(id);
	MusicSync.measures[measureIndex].timepoint.splice(timepointIndex, 1);
	updateMeasureTimepointLabel(measureIndex);
}

function repetitionSelection(measureIndex, timepointIndex)
{
	const timepoint = MusicSync.measures[measureIndex].timepoint[timepointIndex];
	changeAudioPlayerPositionControl(timepoint);
	deleteRepetitionSelector();
}

function save()
{
	if (MusicSync.measures.length <= 0)
	{
		error("You need to load a score and sync before downloading", true);
		return;
	}
	let saved = measuresToJSON();
	makeAndClickDownloadAnchor(saved);
}


/*
 * Page load initialisation
 */
function initAll(event)
{
	initOSMD();
}

function pageResize(event)
{
	deleteTimepointEditor();
	deleteRepetitionSelector();
	if (MusicSync.osmd !== undefined && MusicSync.osmd.Sheet !== undefined)
	{
		MusicSync.osmd.render();
		createClickBoundingBoxes();
		createMeasureTimepointLabels();
	}
}

window.addEventListener("DOMContentLoaded", initAll);
window.addEventListener("resize", pageResize);