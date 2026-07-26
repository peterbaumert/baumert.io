function currentTime() {
	var date = new Date();
	document.getElementById("time").innerText = date.toLocaleTimeString();
	document.getElementById("date").innerText = date.toLocaleDateString();
}

setInterval(currentTime, 1000);
currentTime();

document.addEventListener("DOMContentLoaded", function () {
	var tabs = document.querySelectorAll("#windows .tab");
	var screens = document.querySelectorAll(".screen");
	var ptzDesk = document.getElementById("ptzDesk");
	var validTabs = [];
	tabs.forEach(function (t) { validTabs.push(t.getAttribute("data-tab")); });

	// shared by both an actual click and the initial #hash check below, so
	// a direct link to e.g. #ptz goes through the exact same activation
	// (including the PTZ fade-in and the "tabactivated" event ptz.js needs
	// to re-run its own layout) as clicking the tab normally would.
	function activateTab(target, updateHash) {
		var tab = document.querySelector('#windows .tab[data-tab="' + target + '"]');
		if (!tab) return;

		tabs.forEach(function (t) { t.classList.remove("active"); });
		tab.classList.add("active");

		screens.forEach(function (screen) {
			screen.classList.toggle("active", screen.id === target);
		});

		document.body.classList.toggle("ptz-active", target === "ptz");

		// the scene itself used to hard-cut in via display:none/block while
		// the background around it faded, which looked mismatched. Fade the
		// scene in too, timed with the same background transition.
		// display:block happens instantly above (needed so layout/sizing
		// works), so opacity starts at 0 and the "visible" class is added a
		// couple frames later -- one rAF often isn't enough for the browser
		// to have actually painted the display change yet, so the opacity
		// jump straight to 1 with nothing to transition from.
		if (ptzDesk) {
			if (target === "ptz") {
				ptzDesk.classList.remove("visible");
				requestAnimationFrame(function () {
					requestAnimationFrame(function () {
						ptzDesk.classList.add("visible");
					});
				});
			} else {
				ptzDesk.classList.remove("visible");
			}
		}

		if (updateHash) {
			// replaceState (not pushState/location.hash) so tab switches
			// don't (a) pile up in browser history one entry per click, or
			// (b) trigger the browser's native jump-to-anchor scrolling
			history.replaceState(null, "", "#" + target);
		}

		document.dispatchEvent(new CustomEvent("tabactivated", { detail: { target: target } }));
	}

	tabs.forEach(function (tab) {
		tab.addEventListener("click", function (e) {
			e.preventDefault();
			activateTab(tab.getAttribute("data-tab"), true);
		});
	});

	var initialHash = window.location.hash.replace("#", "");
	if (validTabs.indexOf(initialHash) !== -1) {
		activateTab(initialHash, false);
	}

	// covers navigating between two URLs that differ only by hash fragment
	// (e.g. a same-tab link, or manually editing the address bar) -- that
	// doesn't reload the page/re-fire DOMContentLoaded, so without this the
	// tab would silently not update even though the URL changed
	window.addEventListener("hashchange", function () {
		var hash = window.location.hash.replace("#", "");
		if (validTabs.indexOf(hash) !== -1) {
			activateTab(hash, false);
		}
	});

	// --- dev projects: built from js/dev-projects.json (generated from
	// dev-projects/*.json, see scripts/build_dev_projects.py). Unlike the
	// PTZ cards, this is a plain CSS grid -- no position/measurement needed,
	// so it can render as soon as the fetch resolves regardless of whether
	// the Dev tab is currently visible.
	var projectsGrid = document.getElementById("devProjectsGrid");
	if (projectsGrid) {
		fetch("js/dev-projects.json")
			.then(function (r) { return r.json(); })
			.then(function (projects) {
				var frag = document.createDocumentFragment();
				projects.forEach(function (project) {
					var card = document.createElement("div");
					card.className = "card";

					var header = document.createElement("div");
					header.className = "card-header mono";
					header.textContent = project.name;
					card.appendChild(header);

					var body = document.createElement("div");
					body.className = "card-body";

					var desc = document.createElement("p");
					desc.className = "project-desc";
					desc.textContent = project.description;
					body.appendChild(desc);

					// repoUrl is omitted entirely for private repos (see
					// dev-projects/*.json) -- no public page to link to, and
					// badges can't resolve without auth either, so those
					// projects only ever get a name + description, no link,
					// no badges section at all.
					if (project.repoUrl) {
						var link = document.createElement("a");
						link.className = "repo-link";
						link.href = project.repoUrl;
						link.target = "_blank";
						link.rel = "noopener";
						link.textContent = "view repo →";
						body.appendChild(link);
					}

					// badges are opt-in per project (see dev-projects/*.json's
					// "badges" field) -- stars/version derive from repoUrl
					// alone via shields.io's generic GitHub endpoints, but ci
					// needs the actual workflow filename (badges.ci), which
					// varies per repo and can't be derived from anything else
					var badges = project.badges;
					var repoMatch = project.repoUrl && /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/.exec(project.repoUrl);
					if (badges && repoMatch) {
						var owner = repoMatch[1], repo = repoMatch[2];
						var badgeRow = document.createElement("div");
						badgeRow.className = "repo-badges";

						function addBadge(src, alt) {
							var img = document.createElement("img");
							img.src = src;
							img.alt = alt;
							img.loading = "lazy";
							badgeRow.appendChild(img);
						}

						if (badges.stars) {
							addBadge("https://img.shields.io/github/stars/" + owner + "/" + repo, "GitHub stars");
						}
						if (badges.version) {
							addBadge("https://img.shields.io/github/v/release/" + owner + "/" + repo, "latest release");
						}
						if (badges.ci) {
							addBadge("https://github.com/" + owner + "/" + repo + "/actions/workflows/" + badges.ci + "/badge.svg", "CI status");
						}

						if (badgeRow.childNodes.length) body.appendChild(badgeRow);
					}

					card.appendChild(body);
					frag.appendChild(card);
				});
				projectsGrid.appendChild(frag);
			});
	}
});
