#!/bin/bash
REDHAT_CMD="sudo dnf install nodejs npm python3 python3-pip ffmpeg libsndfile fluidsynth \
		fluid-soundfont-gm"
DISTRO="$(grep -Po '(?<=^ID=).+' /etc/os-release | sed 's/"//g')"
if [ "$DISTRO" = "fedora" ] || ["$DISTRO" = "redhat" ] || [ "$DISTRO" = "centos" ]; then
	eval $REDHAT_CMD
fi
