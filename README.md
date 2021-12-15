# MusicSync
This application allows a musician to sync a MusicXML score and an audio file.

## Installing and Running the Application
Prerequisites:
- node.js
- npm
- python 3.7+
- PyPI (pip)
- ffmpeg (with MIDI support!)

You need all of the above installed and add it to your $PATH

Check that ffmpeg has MIDI support:

On a UNIX system running:
```
ffmpeg -formats | grep MIDI

```
should yield the following line:
```
 D  sds             MIDI Sample Dump Standard
```

Run the following in the app directory to install dependencies:
```
cd ./src
npm install
pip3 install -r requirements.txt
```

Set your Node environment variables in config.js. In particular, PYTHON has to be the name of the Python 3 binary.

To run the application:
```
cd ./src
node server.js
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

## Troubleshooting

### Alternative installation for the Auto Synchronisation feature
You can install python and the dependenices into an Anaconda environment
1. Install conda and add it to your $PATH
2. Create and enter conda environment:
```
conda create --name MusicSync python=3.9
source activate MusicSync 
```
3. Install the dependencies:
```
conda config --add channels conda-forge
conda config --set channel_priority strict
conda install librosa music21 pydub sortedcontainers
pip install libfmp
```
4. Change your Node environment variable in config.js so that PYTHON: 'python'
5. Source your conda environment then run the server:
```
source activate MusicSync
cd ./src
node server.js
```
IMPORTANT: you must be in your conda environment before running the Node server.