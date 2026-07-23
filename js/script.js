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

	tabs.forEach(function (tab) {
		tab.addEventListener("click", function (e) {
			e.preventDefault();
			var target = tab.getAttribute("data-tab");

			tabs.forEach(function (t) { t.classList.remove("active"); });
			tab.classList.add("active");

			screens.forEach(function (screen) {
				screen.classList.toggle("active", screen.id === target);
			});
		});
	});
});
