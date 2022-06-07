FROM ubuntu
RUN apt-get update && apt-get upgrade -y
RUN apt-get install nodejs npm -y
RUN apt-get install python3-pip -y
RUN apt-get install ffmpeg gstreamer1.0-plugins-base gstreamer1.0-plugins-ugly libsndfile1 -y
RUN apt-get install fluidsynth libfluidsynth-dev fluid-soundfont-gm fluid-soundfont-gs -y
RUN git clone --branch dev https://github.com/cskilian/musicsync.git
RUN cd musicsync/src && npm install
RUN pip3 install -r requirements.txt
EXPOSE 3000
WORKDIR /musicsync/src
CMD ["node", "server.js"]
