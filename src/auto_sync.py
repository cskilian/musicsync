import sys

def main(audio_file_path, score_file_path, sync_file_path):
    print("audio file path: " + audio_file_path)
    print("score_file_path: " + score_file_path)
    print("sync_file_path: " + sync_file_path)
    with open(sync_file_path, "w") as file:
        file.write(f"{audio_file_path}, {score_file_path}, {sync_file_path}\n")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])