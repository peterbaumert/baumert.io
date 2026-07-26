#!/usr/bin/env python3
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS_DIR = os.path.join(REPO_ROOT, "dev-projects")
OUT_PATH = os.path.join(REPO_ROOT, "js", "dev-projects.json")

REQUIRED_FIELDS = ("name", "description", "repoUrl")


def load_project(filename):
    path = os.path.join(PROJECTS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        try:
            project = json.load(f)
        except json.JSONDecodeError as e:
            sys.exit("{}: invalid JSON ({})".format(filename, e))

    if not isinstance(project, dict):
        sys.exit("{}: must be a JSON object".format(filename))

    for field in REQUIRED_FIELDS:
        value = project.get(field)
        if not isinstance(value, str) or not value.strip():
            sys.exit("{}: missing or empty required field '{}'".format(filename, field))

    if not project["repoUrl"].startswith("https://"):
        sys.exit("{}: repoUrl must start with https://".format(filename))

    return {field: project[field] for field in REQUIRED_FIELDS}


def main():
    if not os.path.isdir(PROJECTS_DIR):
        sys.exit("dev-projects/ directory not found")

    filenames = sorted(f for f in os.listdir(PROJECTS_DIR) if f.endswith(".json"))
    if not filenames:
        sys.exit("no project files found in dev-projects/")

    projects = [load_project(f) for f in filenames]

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(projects, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("wrote {} projects to {}".format(len(projects), os.path.relpath(OUT_PATH, REPO_ROOT)))


if __name__ == "__main__":
    main()
