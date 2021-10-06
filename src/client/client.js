//Element identifiers
const AUDIO_PLAYER_ID = "audio-player";
const PLAY_PAUSE_BUTTON = "play-pause-button";

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
	var fileReader = new FileReader();
	fileReader.onload = (event) => {
		const audioPlayer = document.getElementById(AUDIO_PLAYER_ID);
		audioPlayer.src = event.target.result;
	}
	fileReader.readAsDataURL(input.files[0]);
	selectFile(input, labelText);
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