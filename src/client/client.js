/* ====================================================================================
 * Constants
 * ====================================================================================
 */
//Element identifiers
const AUDIO_FILE_NAME = "audio-name";
const SCORE_FILE_NAME = "score-name";
const SYNC_FILE_NAME = "sync-name";
const AUDIO_PLAYER_ID = "audio-player";
const PLAY_PAUSE_BUTTON = "play-pause-button";
const MANUAL_SYNC_BUTTON = "manual-sync-button";
const TIMELINE_SEEKER = "seeker";
const TIMELINE = "time-line";
const SHEET_MUSIC_CONTAINER = "osmd-container";
const LOADING_SIGN = "loading-sign";

//VexFlow constants
const UNIT_IN_PIXELS = 10;

//Application specific globals
const REPEAT = {
	off: 0,
	on: 1,
	start: 2,
	end: 3,
	gate: 4,
};

class Measure {
	constructor(repeat) {
		this.timepoint = [];
		this.repeat = repeat;
	}
};

var MusicSync = {
	osmd: undefined,
	isRecording: false,
	measures: [],
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
	for (let i = 0; i < MusicSync.osmd.GraphicSheet.measureList.length; ++i)
	{
		let musicSyncMeasure = null;
		let measure = MusicSync.osmd.GraphicSheet.measureList[i][0].parentSourceMeasure;
		if (0 < measure.lastRepetitionInstructions.length && 0 < measure.firstRepetitionInstructions.length)
		{
			musicSyncMeasure = new Measure(REPEAT.gate);
			repeating = false;
		}
		else if (0 < measure.lastRepetitionInstructions.length)
		{
			musicSyncMeasure = new Measure(REPEAT.end);
			repeating = false;
		}
		else if (0 < measure.firstRepetitionInstructions.length)
		{
			musicSyncMeasure = new Measure(REPEAT.start);
			repeating = true;
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
	MusicSync.measures[0].timepoint.push(0);	//assign audio beginning to 1st measure just in case
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
			measure.timepoint.push(audioPlayer.currentTime);
		}
		else
		{
			measure.timepoint.length == 0 ? measure.timepoint.push(audioPlayer.currentTime) : measure.timepoint[0] = audioPlayer.currentTime;
		}
	}
	else
	{
		if (0 < measure.timepoint.length)
		{
			audioPlayer.currentTime = measure.timepoint[measure.timepoint.length - 1];
		}
	}
}

function changeScore(file)
{
	var fileReader = new FileReader();
	fileReader.onload = (event) => {
		MusicSync.osmd.load(event.target.result).then(() => {
			initMeasures();
			MusicSync.osmd.render();
			createClickBoundingBoxes();
			endLoadingSign();
		});
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
		if (!loadSyncInput(inputFileObject))
		{
			error("Loaded sync file does not match musical score", true);
		}
	};
	fileReader.readAsText(file);
}

function loadSyncInput(inputObject)
{
	let valid = true;
	let measures = MusicSync.measures.length;
	if (Array.isArray(inputObject))
	{
		if (inputObject.length != MusicSync.measures.length)
		{
			measures = (inputObject.length < MusicSync.measures.length ? inputObject.length : measures);
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
		if (inputObject[i].repeat !== MusicSync.measures[i].repeat)
		{
			valid = false;
		}
		if ((MusicSync.measures[i].repeat === REPEAT.off || MusicSync.measures[i].repeat === REPEAT.gate) && 1 < inputObject[i].timepoint.length)
		{
			valid = false;
		}
		for (j in inputObject[i].timepoint)
		{
			if (isNaN(j) || ((MusicSync.measures[i].repeat === REPEAT.off || MusicSync.measures[i].repeat === REPEAT.gate) && 0 < j))
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
					MusicSync.measures[i].timepoint[j] = inputObject[i].timepoint[j];
				}
			}
		}
	}
	return valid;
}

function stopAudioControl()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	audioPlayer.pause();
	audioPlayer.currentTime = 0;
}

function manualSyncControl()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	MusicSync.isRecording = !MusicSync.isRecording;
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

function changeAudioPlayerSource(file)
{
	stopAudioControl()
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	const seeker = document.getElementById(TIMELINE_SEEKER);
	var fileReader = new FileReader();
	fileReader.onload = (event) => {
		audioPlayer.src = event.target.result;
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
  	audioPlayer.currentTime = audioPlayer.duration * (event.clientX - timeline.getBoundingClientRect().left) / timelineWidth;
}

function measuresToJSON()
{
	var jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(MusicSync.measures, null, 2));
	var fileName = document.getElementById(SCORE_FILE_NAME).innerText + ".json";
	return [jsonString, fileName];
}


/* =====================================================================================
 * User Interface 
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
	seeker.style.setProperty('background', 'black');
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
 	}
 	return timeUpdateFn;
}

function updatePlayPauseButton()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	const button = document.getElementById(PLAY_PAUSE_BUTTON);
	if (audioPlayer.src == "" || audioPlayer.paused)
	{
		button.innerText = "Play";
	}
	else
	{
		button.innerText = "Pause";
	}

}

function updateManualSyncButton()
{
	const button = document.getElementById(MANUAL_SYNC_BUTTON);
	if (MusicSync.isRecording)
	{
		button.style.color = "red";
	}
	else
	{
		button.style.color = null;
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
			let x = measure.boundingBox.absolutePosition.x * UNIT_IN_PIXELS;
			let y = measure.boundingBox.absolutePosition.y * UNIT_IN_PIXELS;
			let width = measure.boundingBox.boundingRectangle.width * UNIT_IN_PIXELS;
			let height = measure.boundingBox.boundingRectangle.height * UNIT_IN_PIXELS;
			var boundingBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			boundingBox.setAttribute("x", x);
			boundingBox.setAttribute("y", y);
			boundingBox.setAttribute("width", width);
			boundingBox.setAttribute("height", height);
			boundingBox.setAttribute("style", "pointer-events: bounding-box; opacity: 0;");
			boundingBox.setAttribute("onclick", `measureClick(${bar})`);
			svgCanvas.appendChild(boundingBox);
		}
	}
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

/* =======================================================================================
 * Event Handlers
 * =======================================================================================
 */
function selectSyncFile(input)
{
	const fileName = input.files[0].name;
	loadAndValidateSyncFile(input.files[0]);
	updateLabel(SYNC_FILE_NAME, fileName);
}

/*
 * Updates file label after upload
 */
function selectScoreFile(input) 
{
	const fileName = input.files[0].name;
	startLoadingSign();
	changeScore(input.files[0]);
	updateLabel(SCORE_FILE_NAME, fileName);
}

/*
 * Custom handler for selecting audio file. It sets the source for the player to the given audio file
 */
function selectAudioFile(input)
{
	changeAudioPlayerSource(input.files[0]);
	updateLabel(AUDIO_FILE_NAME, input.files[0].name);
	updateSeeker();
	updatePlayPauseButton();
}

function dropFile(event, select_fn, extensions)
{
	event.preventDefault();
	for (extension in extensions)
	{
		if (event.dataTransfer.files[0].name.toLowerCase().endsWith(extensions[extension]))
		{
			select_fn(event.dataTransfer);
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
	stopAudioControl();
	stopManualSync();
	updatePlayPauseButton();
	updateManualSyncButton();
}

function resetAudio()
{
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
	manualSyncControl();
	updateManualSyncButton();
	updatePlayPauseButton();
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
	if (MusicSync.osmd !== undefined && MusicSync.osmd.Sheet !== undefined)
	{
		MusicSync.osmd.render();
		createClickBoundingBoxes();
	}
}

window.addEventListener("DOMContentLoaded", initAll);
window.addEventListener("resize", pageResize);