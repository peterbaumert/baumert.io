#!/usr/bin/env python3
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS_DIR = os.path.join(REPO_ROOT, "dev-projects")
OUT_PATH = os.path.join(REPO_ROOT, "js", "dev-projects.json")

REQUIRED_FIELDS = ("name", "description")

# repoUrl is optional -- omit it for private repos (no public page to link to,
# and badges can't resolve without auth for a private repo either, so a
# missing repoUrl means "no link, no badges", not "forgot to fill this in").

# badges is optional -- a project with no "badges" key (or an empty object)
# shows none. Each sub-field independently opts a single badge in: stars/
# version are booleans, ci is the workflow's bare filename (there's no way
# to derive that from repoUrl -- it varies per repo and isn't guessable).
BADGE_BOOL_FIELDS = ("stars", "version")


def load_badges(filename, project):
    badges = project.get("badges", {})
    if badges in (None, {}):
        return {}
    if not isinstance(badges, dict):
        sys.exit("{}: 'badges' must be an object".format(filename))

    result = {}
    for field in BADGE_BOOL_FIELDS:
        if field in badges:
            if not isinstance(badges[field], bool):
                sys.exit("{}: badges.{} must be true/false".format(filename, field))
            if badges[field]:
                result[field] = True
    if "ci" in badges and badges["ci"] is not None:
        if not isinstance(badges["ci"], str) or not badges["ci"].strip():
            sys.exit("{}: badges.ci must be a non-empty workflow filename".format(filename))
        result["ci"] = badges["ci"]
    return result


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

    result = {field: project[field] for field in REQUIRED_FIELDS}

    repo_url = project.get("repoUrl")
    if repo_url is not None:
        if not isinstance(repo_url, str) or not repo_url.startswith("https://"):
            sys.exit("{}: repoUrl must start with https://".format(filename))
        result["repoUrl"] = repo_url
        badges = load_badges(filename, project)
        if badges:
            result["badges"] = badges
    elif "badges" in project and project["badges"]:
        sys.exit("{}: 'badges' requires 'repoUrl' to be set".format(filename))

    return result


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
