import os
import sys
import music21
import librosa
import libfmp.c3
from pydub import AudioSegment
import pdb

TMP_MIDI = "score.midi"
SAMPLE_RATE = 22050
WINDOW_LENGTH = 4410
HOP_SIZE = 2205
DEFAULT_BPM = 120

def frame_to_seconds(frame, hop_size, sample_rate):
    return (frame * hop_size) / sample_rate

def audio_file_to_wave(audio_file_path):
    try:
        source = AudioSegment.from_mp3(audio_file_path)
        source.export(audio_file_path, format = "wav")
    finally:
        audio_wave, sample_rate = librosa.load(audio_file_path, sr = SAMPLE_RATE)
        return audio_wave, sample_rate

def score_file_to_score(score_file_path):
    file_type_extension = ".musicxml"
    with open(score_file_path, "rb") as file:
        if file.read(4) == b'\x50\x4b\x03\x04':
            file_type_extension = ".mxl"
    os.rename(score_file_path, score_file_path + file_type_extension)
    source = music21.converter.parse(score_file_path + file_type_extension)
    source_unrolled = source.expandRepeats()
    os.rename(score_file_path + file_type_extension, score_file_path)
    return source, source_unrolled

def strip_metronome_markings(stream):
    boundaries = stream.metronomeMarkBoundaries()
    for i in boundaries:
        stream.remove(i[2], recurse = True)

def main(audio_file_path, score_file_path, sync_file_path):
    audio_wave, sample_rate = audio_file_to_wave(audio_file_path)
    source, source_unrolled = score_file_to_score(score_file_path)
    strip_metronome_markings(source)
    strip_metronome_markings(source_unrolled)
    source_unrolled.write("midi", TMP_MIDI)
    pdb.set_trace()
    score_wave, sample_rate = librosa.load(TMP_MIDI, sr = SAMPLE_RATE)
    audio_chroma = librosa.feature.chroma_stft(y = audio_wave, sr = SAMPLE_RATE, tuning = 0, norm = 2, hop_length = HOP_SIZE, n_fft = WINDOW_LENGTH)
    score_chroma = librosa.feature.chroma_stft(y = score_wave, sr = SAMPLE_RATE, tuning = 0, norm = 2, hop_length = HOP_SIZE, n_fft = WINDOW_LENGTH)
    C = libfmp.c3.compute_cost_matrix(score_chroma, audio_chroma)
    D = libfmp.c3.compute_accumulated_cost_matrix(C)
    P = libfmp.c3.compute_optimal_warping_path(D)
    pdb.set_trace()
    """
    with open(sync_file_path, "w") as file:
        file.write(f"{audio_file_path}, {score_file_path}, {sync_file_path}\n")
    """

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])