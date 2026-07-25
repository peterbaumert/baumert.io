#!/usr/bin/env python3
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOBS_DIR = os.path.join(REPO_ROOT, "ptz-jobs")
THUMB_DIR = os.path.join(REPO_ROOT, "img", "ptz")
OUT_PATH = os.path.join(REPO_ROOT, "js", "ptz-cards.json")

REQUIRED_FIELDS = ("title", "meta", "thumbnail", "description")


def load_job(filename):
    path = os.path.join(JOBS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        try:
            job = json.load(f)
        except json.JSONDecodeError as e:
            sys.exit("{}: invalid JSON ({})".format(filename, e))

    if not isinstance(job, dict):
        sys.exit("{}: must be a JSON object".format(filename))

    for field in REQUIRED_FIELDS:
        value = job.get(field)
        if not isinstance(value, str) or not value.strip():
            sys.exit("{}: missing or empty required field '{}'".format(filename, field))

    thumb_path = os.path.join(THUMB_DIR, job["thumbnail"])
    if not os.path.isfile(thumb_path):
        sys.exit("{}: thumbnail '{}' not found in img/ptz/".format(filename, job["thumbnail"]))

    return {field: job[field] for field in REQUIRED_FIELDS}


def main():
    if not os.path.isdir(JOBS_DIR):
        sys.exit("ptz-jobs/ directory not found")

    filenames = sorted(f for f in os.listdir(JOBS_DIR) if f.endswith(".json"))
    if not filenames:
        sys.exit("no job files found in ptz-jobs/")

    jobs = [load_job(f) for f in filenames]

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(jobs, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("wrote {} jobs to {}".format(len(jobs), os.path.relpath(OUT_PATH, REPO_ROOT)))


if __name__ == "__main__":
    main()
