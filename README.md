# MusicSync
This application allows a musician to sync a MusicXML score and an audio file.

## Installing and Running the Application
Run the following in the app directory to install dependencies:
```
npm install
pip install -r requirements.txt
```
To run the application:
```
node server.js
```
Then just navigate to the ip address:port number using a web browser

The server will attempt to store data in $HOME/.musicsync or ./.musicsync. Either of those directories has to be writable for AutoSync to function.

## How to Use
The prerequisite for syncing your MusicXML file with an audio file is to load the files. 
To load the audio file, click on "Select File" next to the Audio field or drag and drop a valid audio file into the audio field.
To load the MusicXML file, click on "Select File" next to the Sheetmusic field or drag and drop a valid MusicXML or a compressed .mxl file into the "Sheetmusic" field.

### Automatic Synchronisation
Click on "AutoSync" after the audio file and sheetmusic have loaded, and wait a few seconds while the server is synchronising the files. The "AutoSync" button will have an orange colour while the server is syncrhonising.

### Manual Syncrhonisation
Click on "ManualSync" after the audio file and sheetmusic have loaded. The music will begin playing and the application will be in "ManualSync" mode as indicated by the "ManualSync" button's red colour. As the music is playing click on each measure at the desired time. The current timepoint in the audio file will be assigned to the measure that was clicked. The timepoint will be shown above the measure. To stop synchronisation, click on the "ManualSync" button again to turn it off.

### Playback
When "ManualSync" is turned off, click on any bar with a corresponding timepoint and then click "Play". The audio should play back from the time corresponding to the measure.
