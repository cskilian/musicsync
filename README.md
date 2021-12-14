# MusicSync
This application allows a musician to sync a MusicXML score and an audio file.

## Installing and Running the Application
Prerequisites:
- node.js
- npm
- python 3.7+
- PyPI (pip)
- ffmpeg (on Linux only)

You need the above installed and add it to your $PATH

Run the following in the app directory to install dependencies:
```
npm install
pip3 install -r requirements.txt
```
To run the application:
```
node src/server.js
```
Then just navigate to the ip address:port number using a web browser

The server will attempt to store data in $HOME/.musicsync or ./.musicsync. Either of those directories has to be writable for AutoSync to function.

## How to Use
The prerequisite for syncing your MusicXML file with an audio file is to load the files. 
To load the audio file, click on "Select File" next to the Audio field or drag and drop a valid audio file into the audio field.
To load the MusicXML file, click on "Select File" next to the Sheetmusic field or drag and drop a valid MusicXML or a compressed .mxl file into the "Sheetmusic" field.

### Automatic Synchronisation
Click on "AutoSync" after the audio file and sheetmusic have loaded, and wait a few seconds - to a minute while the server is synchronising the files. The "AutoSync" button will have an orange colour while the server is syncrhonising. When it's complete, the "AutoSync" button will turn back to a grey colour and you will see the timepoints populated above the measures.

### Manual Syncrhonisation
Click on "ManualSync" after the audio file and sheetmusic have loaded. The music will begin playing and the application will be in "ManualSync" mode as indicated by the "ManualSync" button's red colour. As the music is playing click on each measure at the desired time. The current timepoint in the audio file will be assigned to the measure that was clicked. The timepoint will be shown above the measure. To stop synchronisation, click on the "ManualSync" button again to turn it off.

### Playback
When "ManualSync" is turned off, click on any bar with a corresponding timepoint and then click "Play". The audio should play back from the time corresponding to the measure.
