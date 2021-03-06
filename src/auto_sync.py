import os
import sys
import music21
import librosa
import libfmp.c3
from pydub import AudioSegment
from sortedcontainers import SortedDict
from midi2audio import FluidSynth
import pdb

TMP_MIDI = "score.mid"
TMP_WAV = "score.wav"
SAMPLE_RATE = 22050
WINDOW_LENGTH = 4410
HOP_SIZE = 2205
DEFAULT_BPM = 120

def frame_to_seconds(frame, hop_size, sample_rate):
    return (frame * hop_size) / sample_rate

def audio_file_to_wave(audio_file_path):
    audio_wave, sample_rate = librosa.load(audio_file_path, sr = SAMPLE_RATE)
    return audio_wave, sample_rate

def score_file_to_score(score_file_path):
    source = music21.converter.parse(score_file_path)
    try:
        source_unrolled = source.expandRepeats()
    except music21.repeat.ExpanderException:
        source_unrolled = source # this is a workaround for https://github.com/cuthbertLab/music21/issues/355. Hopefully, the failure is due to the lack of repetitions and not a malformed file
    return source, source_unrolled

def strip_metronome_markings(stream):
    boundaries = stream.metronomeMarkBoundaries()
    for i in boundaries:
        stream.remove(i[2], recurse = True)

def score_file_to_score_without_metronome_markings(score_file_path):
    source, source_unrolled = score_file_to_score(score_file_path)
    strip_metronome_markings(source)
    strip_metronome_markings(source_unrolled)
    return source, source_unrolled

def dynamic_time_warping(score_chroma, audio_chroma):
    C = libfmp.c3.compute_cost_matrix(score_chroma, audio_chroma)
    D = libfmp.c3.compute_accumulated_cost_matrix(C)
    P = libfmp.c3.compute_optimal_warping_path(D)
    return P

def approximate_expanded_measure_time_positions(source_expanded, optimal_warping_path, hop_size, sample_rate):
    expanded_measure_time_positions = SortedDict()
    score_timepoint_before = 0
    score_timepoint_after = frame_to_seconds(optimal_warping_path[0][0], hop_size, sample_rate)
    path_index = 0
    for measure in source_expanded.parts[0].getElementsByClass("Measure"):
        measure_timepoint_star = float(measure.getOffsetBySite(source_expanded.parts[0])) * 60 / DEFAULT_BPM
        while path_index < len(optimal_warping_path) and not (score_timepoint_before <= measure_timepoint_star and measure_timepoint_star < score_timepoint_after):
            # find the nearest note onsets for a measure onset estimate within the score domain
            path_index += 1
            score_timepoint_before = score_timepoint_after
            score_timepoint_after = frame_to_seconds(optimal_warping_path[path_index][0], hop_size, sample_rate)
        if score_timepoint_before <= measure_timepoint_star and measure_timepoint_star < score_timepoint_after:
            # approximate the measure onset in the audio from the note onsets within the corresponding audio domain
            local_metric_distance = (measure_timepoint_star - score_timepoint_before) / (score_timepoint_after - score_timepoint_before)
            audio_timepoint_before = frame_to_seconds(optimal_warping_path[path_index - 1][1], hop_size, sample_rate)
            audio_timepoint_after = frame_to_seconds(optimal_warping_path[path_index][1], hop_size, sample_rate)
            approx_audio_timepoint = audio_timepoint_before + local_metric_distance * (audio_timepoint_after - audio_timepoint_before)
            if measure.number in expanded_measure_time_positions:
                expanded_measure_time_positions[measure.number].append(approx_audio_timepoint)
            else:
                expanded_measure_time_positions[measure.number] = [approx_audio_timepoint]
        elif not measure.number in expanded_measure_time_positions:
            expanded_measure_time_positions[measure.number] = []
    return expanded_measure_time_positions

def timepoints_to_sync_file(measure_sync, sync_file_path):
    with open(sync_file_path, "w") as file:
        file.write("[\n")
        i = 0
        for measure in measure_sync:
            file.write(f"{str(measure_sync[measure])}")
            file.write("\n") if i == len(measure_sync) - 1 else file.write(",\n")
            i += 1
        file.write("]\n")

def clean_up(temporary_files_path):
    success = True
    for file_path in temporary_files_path:
        try:
            os.unlink(file_path)
        except:
            success = False
    return success

def pipeline(audio_file_path, score_file_path, sync_file_path):
    try:
        # Autosync pipeline:
        # 1. Load audio file to wave array
        audio_wave, sample_rate = audio_file_to_wave(audio_file_path)
        # 2. Load sheet-music to music21 stream object
        source, source_expanded = score_file_to_score_without_metronome_markings(score_file_path)
        # 3. Export unrolled sheet-music to temporary midi file
        source_expanded.write("midi", TMP_MIDI)
        FluidSynth().midi_to_audio(TMP_MIDI, TMP_WAV)
        # 4. Load and export midi to wave array
        score_wave, sample_rate = librosa.load(TMP_WAV, sr = SAMPLE_RATE)
        # 5. Generate chroma graph from wave arrays
        audio_chroma = librosa.feature.chroma_stft(y = audio_wave, sr = SAMPLE_RATE, tuning = 0, norm = 2, hop_length = HOP_SIZE, n_fft = WINDOW_LENGTH)
        score_chroma = librosa.feature.chroma_stft(y = score_wave, sr = SAMPLE_RATE, tuning = 0, norm = 2, hop_length = HOP_SIZE, n_fft = WINDOW_LENGTH)
        # 6. Run dynamic time warping algorithm
        optimal_warping_path = dynamic_time_warping(score_chroma, audio_chroma)
        # 7. Approximate audio timepoints for expanded score's measures
        measure_sync = approximate_expanded_measure_time_positions(source_expanded, optimal_warping_path, HOP_SIZE, sample_rate)
        # 8. Write out synchronisation info
        timepoints_to_sync_file(measure_sync, sync_file_path)
    except:
        sys.exit(1)
    finally:
        # 9. Clean-up
        clean_up([TMP_MIDI, TMP_WAV])

if __name__ == "__main__":
    pipeline(sys.argv[1], sys.argv[2], sys.argv[3])
    sys.exit(0);