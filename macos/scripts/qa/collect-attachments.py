"""Sorts a persona run's exported XCTest attachments (xcresulttool export attachments) into
traces/<persona>.json and shots/<name>.jpg, so the results can be read without Xcode.
Usage: python3 -I collect-attachments.py <attachments-folder> <report-folder>"""
import json
import os
import re
import shutil
import subprocess
import sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, "traces"), exist_ok=True)
os.makedirs(os.path.join(out, "shots"), exist_ok=True)
with open(os.path.join(src, "manifest.json")) as f:
    manifest = json.load(f)
summary = []
for test in manifest:
    name = test.get("testIdentifier", "?")
    for a in test.get("attachments", []):
        file = a.get("exportedFileName", "")
        human = a.get("suggestedHumanReadableName", "")
        path = os.path.join(src, file)
        if human.startswith("trace-") and file.endswith(".json"):
            shutil.copy(path, os.path.join(out, "traces", re.sub(r"_\d+_[0-9A-F-]+\.json$", ".json", human)))
        elif file.endswith(".png") and re.match(r"^[a-z-]+-\d\d-", human):
            base = re.sub(r"_\d+_[0-9A-F-]+\.png$", "", human)
            subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "60", "-Z", "1400",
                            path, "--out", os.path.join(out, "shots", base + ".jpg")], capture_output=True)
        elif file.endswith(".mp4"):
            summary.append(f"{name}: screen recording {file}")
with open(os.path.join(out, "README.txt"), "w") as f:
    f.write("Launch-QA persona run: traces/ and shots/ (macos/docs/qa/LAUNCH_QA.md).\n")
    f.write("\n".join(summary) + "\n")
print(f"{len(os.listdir(os.path.join(out, 'traces')))} traces, {len(os.listdir(os.path.join(out, 'shots')))} screenshots")
