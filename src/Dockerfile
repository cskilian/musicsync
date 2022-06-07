FROM ubuntu
RUN apt-get update && apt-get upgrade -y
RUN apt-get install nodejs npm -y
RUN apt-get install python3-pip -y
RUN apt-get install ffmpeg gstreamer1.0-plugins-base gstreamer1.0-plugins-ugly libsndfile1 -y
RUN pip3 install libfmp librosa music21 pydub sortedcontainers soundfile midi2audio
RUN apt-get install fluidsynth fluid-soundfont-gm fluid-soundfont-gs -y
RUN git clone https://github.com/cskilian/musicsync.git
RUN cd musicsync/src && npm install
EXPOSE 3000
CMD ["node", "/musicsync/src/server.js"]
