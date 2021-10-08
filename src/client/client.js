//Element identifiers
const AUDIO_PLAYER_ID = "audio-player";
const PLAY_PAUSE_BUTTON = "play-pause-button";
const TIMELINE_SEEKER = "seeker";
const TIMELINE = "time-line";

/*
 * Updates file label after upload
 */
function selectFile(input, labelText) 
{
    document.getElementById(labelText).innerHTML = input.files[0].name;
}

/*
 * Custom handler for selecting audio file. It sets the source for the player to the given audio file
 */
function selectAudioFile(input, labelText)
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	var fileReader = new FileReader();
	fileReader.onload = (event) => {
		audioPlayer.src = event.target.result;
	}
	fileReader.readAsDataURL(input.files[0]);
	//update UI
	selectFile(input, labelText);
	const seeker = document.getElementById(TIMELINE_SEEKER);
	seeker.style.setProperty('background', 'black');
	audioPlayer.addEventListener('canplaythrough', () => {
		var duration = audioPlayer.duration;
		audioPlayer.addEventListener('timeupdate', timeUpdate(duration), false);
	}, false);

}

/*
 * Handler for pressing play/pause button
 */
function playPauseAudio(button)
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	if (audioPlayer.src == "")
	{
		return;
	}
	if (audioPlayer.paused)
	{
		audioPlayer.play();
		button.innerText = "Pause";
	}
	else
	{
		audioPlayer.pause();
		button.innerText = "Play";
	}
}

/*
 * Handler for pressing stop button
 */
function stopAudio(button)
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	const playPauseButton = document.getElementById(PLAY_PAUSE_BUTTON);
	if (!audioPlayer.paused)
	{
		playPauseAudio(playPauseButton);
	}
	audioPlayer.currentTime = 0;
}

/*
 * Handler for when the audio has stopped playing
 */
function resetAudio()
{
	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
	const playPauseButton = document.getElementById(PLAY_PAUSE_BUTTON);
	audioPlayer.currentTime = 0;
	playPauseButton.innerText = "Play";
}

/*
 * Returns an event handler that gets called by the audio-player to update the UI of the timeline
 */
 function timeUpdate(duration)
 {
 	var timeUpdateFn = function() {
 		const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
 		const seeker = document.getElementById(TIMELINE_SEEKER);
 		let currentPlace = 100 * (audioPlayer.currentTime / duration);
 		seeker.style.marginLeft = currentPlace + '%';
 	}
 	return timeUpdateFn;
 }

/* 
 * Event handler for clicking on the timeline
 */
 function seekOnTimeline(event)
 {
 	const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
 	const seeker = document.getElementById(TIMELINE_SEEKER);
 	const timeline = document.getElementById(TIMELINE);
 	const timelineWidth = timeline.offsetWidth - seeker.offsetWidth;
  	function moveSeeker(event)
 	{
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
 	if (audioPlayer.src == "")
	{
		return;
	}
 	moveSeeker(event);
 	audioPlayer.currentTime = audioPlayer.duration * (event.clientX - timeline.getBoundingClientRect().left) / timelineWidth; 
 }

/*
 * Initialize
 */
 function initAll()
 {

 }