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

	tabs.forEach(function (tab) {
		tab.addEventListener("click", function (e) {
			e.preventDefault();
			var target = tab.getAttribute("data-tab");

			tabs.forEach(function (t) { t.classList.remove("active"); });
			tab.classList.add("active");

			screens.forEach(function (screen) {
				screen.classList.toggle("active", screen.id === target);
			});

			document.body.classList.toggle("ptz-active", target === "ptz");

			// the scene itself used to hard-cut in via display:none/block
			// while the background around it faded, which looked mismatched.
			// Fade the scene in too, timed with the same background
			// transition. display:block happens instantly above (needed so
			// layout/sizing works), so opacity starts at 0 and the "visible"
			// class is added a couple frames later -- one rAF often isn't
			// enough for the browser to have actually painted the display
			// change yet, so the opacity jump straight to 1 with nothing to
			// transition from.
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
		});
	});
});
