//Element identifiers
const AUDIO_FILE_NAME = "audio-name";
const SCORE_FILE_NAME = "score-name";
const SYNC_FILE_NAME = "sync-name";
const AUDIO_PLAYER_ID = "audio-player";
const PLAY_PAUSE_BUTTON = "play-pause-button";
const TIMELINE_SEEKER = "seeker";
const TIMELINE = "time-line";
const SHEET_MUSIC_CONTAINER = "osmd-container";
const LOADING_SIGN = "loading-sign";

//VexFlow constants
const UNIT_IN_PIXELS = 10;

//Globals
var osmd = undefined;

/* ====================================================================================
 * Controllers
 * ====================================================================================
 */
function initOSMD()
{
	osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(SHEET_MUSIC_CONTAINER);
	osmd.setOptions({
		backend: "svg",
		drawTitle: true,
		measureNumberInterval: 1,
		cursorOptions: [{type: 3}],
    	// drawingParameters: "compacttight" // don't display title, composer etc., smaller margins
	});
}

function changeScore(file)
{
	var fileReader = new FileReader();
	fileReader.onload = (event) => {
		osmd.load(event.target.result).then(() => { 
			osmd.render();
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
		window.alert("Invalid or corrupt musicxml file");
	}
}

function createClickBoundingBoxes()
{
	const svgCanvas = document.getElementsByTagName("svg")[0];
	for (let bar = 0; bar < osmd.GraphicSheet.measureList.length; ++bar)
	{
		for (let i = 0; i < osmd.GraphicSheet.measureList[bar].length; ++i)
		{
			let measure = osmd.GraphicSheet.measureList[bar][i];
			let x = measure.boundingBox.absolutePosition.x * UNIT_IN_PIXELS;
			let y = measure.boundingBox.absolutePosition.y * UNIT_IN_PIXELS;
			let width = measure.boundingBox.boundingRectangle.width * UNIT_IN_PIXELS;
			let height = measure.boundingBox.boundingRectangle.height * UNIT_IN_PIXELS;
			var boundingBox = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			boundingBox.setAttribute("x", x);
			boundingBox.setAttribute("y", y);
			boundingBox.setAttribute("width", width);
			boundingBox.setAttribute("height", height);
			boundingBox.setAttribute("style", "pointer-events: bounding-box; fill: none;");
			boundingBox.setAttribute("onclick", `window.alert("${bar + 1}")`);
			svgCanvas.appendChild(boundingBox);
		}
	}
}

function stopAudioControl()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	audioPlayer.pause();
	audioPlayer.currentTime = 0;
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

/* =====================================================================================
 * User Interface 
 * =====================================================================================
 */
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
	const sheetMusicContainer = document.getElementById(SHEET_MUSIC_CONTAINER);
	if (document.getElementById(LOADING_SIGN) == null)
	{
		sheetMusicContainer.innerHTML = `<span id='${LOADING_SIGN}' style='font-size: xx-large;'>Loading ...</span>`;
	}
}

//removes loading sign
function endLoadingSign()
{
	const sheetMusicContainer = document.getElementById(SHEET_MUSIC_CONTAINER);
	const loadingSign = document.getElementById(LOADING_SIGN);
	if (loadingSign !== null)
	{
		sheetMusicContainer.removeChild(loadingSign);
	}
}
/* =======================================================================================
 * Event Handlers
 * =======================================================================================
 */
function selectSyncFile(input)
{
	const fileName = input.files[0].name;
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


function playPauseAudio()
{
	playPauseAudioControl();
	updatePlayPauseButton();
}

function stopAudio()
{
	stopAudioControl();
	updatePlayPauseButton();
}

function resetAudio()
{
	stopAudioControl();
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
 * Page load initialisation
 */
function initAll(event)
{
	initOSMD();
}

window.addEventListener("DOMContentLoaded", initAll);

function measureClick(measure)
{
	console.log("Clicked on measure " + measure);
}