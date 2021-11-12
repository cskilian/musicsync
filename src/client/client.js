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
const TIMELINE_SEEKER = "seeker";
const TIMELINE = "time-line";
const SHEET_MUSIC_CONTAINER = "osmd-container";
const LOADING_SIGN = "loading-sign";
const TIMEPOINT_EDITOR = "timepoint-editor";

//VexFlow constants
const UNIT_IN_PIXELS = 10;
const TIMEPOINT_EDITOR_WIDTH = 510;

//Application constants and global
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
	recordingClickCounts: undefined,
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
				measure.timepoint[0] = audioPlayer.currentTime;
				MusicSync.recordingClickCounts[measureIndex] = 1;
			}
			else
			{
				measure.timepoint[MusicSync.recordingClickCounts[measureIndex]++] = audioPlayer.currentTime;
			}
		}
		else
		{
			measure.timepoint[0] = audioPlayer.currentTime;
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
		if (!loadSyncInput(MusicSync.measures, inputFileObject, updateMeasureTimepointLabel))
		{
			error("Loaded sync file does not match musical score", true);
		}
	};
	fileReader.readAsText(file);
}

function loadSyncInput(musicSyncMeasures, inputObject, viewCallback)
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
					musicSyncMeasures[i].timepoint[j] = inputObject[i].timepoint[j];
					viewCallback(i);
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

function resetInput(inputId)
{
	const input = document.getElementById(inputId);
	input.value = "";
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
		button.style.backgroundColor = "red";
	}
	else
	{
		button.style.backgroundColor = null;
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
	const measureY = (measure.boundingBox.absolutePosition.y - measure.rules.MeasureNumberLabelOffset - measure.rules.MeasureNumberLabelHeight) * UNIT_IN_PIXELS;
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
	editor.setAttribute("style", `position: absolute; top: ${y}px; left: ${x}px; z-index: 10; background-color: grey; border: 2px solid; display: table-cell; vertical-align: middle`);
	for (i in MusicSync.measures[measureIndex].timepoint)
	{
		let minutes = (MusicSync.measures[measureIndex].timepoint[i] / 60) >> 0;
		let seconds = MusicSync.measures[measureIndex].timepoint[i] % 60;
		let timepointHTML = `
			<div style="border-width: 0px 0px 1px 0px; border-style: solid;" id="${TIMEPOINT_EDITOR}-${i}">
				<input type="number" min="0" value="${minutes}">
				<span style="padding: 3px;">:</span>
				<input type="number" min="0" max="59.999" step="0.1" value="${seconds.toFixed(3)}">
				<span style="padding: 3px;" onclick="timepointEditorSave(${measureIndex}, ${i})"><i class="fa fa-edit" aria-hidden="true"></i></span>
				<span style="padding: 3px;" onclick="timepointEditorDelete(${measureIndex}, ${i})"><i class="fa fa-eraser" aria-hidden="true"></i></span>
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

function deleteTimepointEditor()
{
	if (document.getElementById(TIMEPOINT_EDITOR) !== null)
	{
		document.getElementById(TIMEPOINT_EDITOR).remove();
	}
	const svgCanvas = document.getElementsByTagName("svg")[0];
	svgCanvas.removeEventListener("click", deleteTimepointEditor);
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

function timepointEditorSave(measureIndex, id)
{
	const data = extractTimepointEditorRowData(id);
	const minutes = data[0];
	const seconds = data[1];
	const timepointIndex = data[2];
	MusicSync.measures[measureIndex].timepoint[timepointIndex] = minutes * 60 + seconds;
	updateMeasureTimepointLabel(measureIndex);
}

function timepointEditorDelete(measureIndex, id)
{
	const timepointIndex = deleteTimepointEditorRow(id);
	MusicSync.measures[measureIndex].timepoint.splice(timepointIndex, 1);
	updateMeasureTimepointLabel(measureIndex);
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
	if (MusicSync.osmd !== undefined && MusicSync.osmd.Sheet !== undefined)
	{
		MusicSync.osmd.render();
		createClickBoundingBoxes();
		createMeasureTimepointLabels();
	}
}

window.addEventListener("DOMContentLoaded", initAll);
window.addEventListener("resize", pageResize);