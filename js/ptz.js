(function () {
	var deskScene = document.getElementById("ptzDesk");
	if (!deskScene) return;

	// hotspot coordinates measured against the source photo's natural pixel size (1672x941)
	var NATURAL_W = 1672;
	var SCREEN = { left: 305, top: 54, right: 1108, bottom: 504 };
	var JOYSTICK_CENTER = { x: 828, y: 585 };
	var JOYSTICK_MAX_RADIUS = 45; // px, natural scale -- how far the nub can travel before clamping
	var ZOOM_BOX = { left: 977, top: 663, right: 1050, bottom: 763 };
	var ZOOM_MAX_RANGE = 40; // px, natural scale -- vertical drag range for full-speed zoom

	var deskPhoto = document.getElementById("ptzDeskPhoto");
	var monitor = document.getElementById("ptzMonitor");
	var field = document.getElementById("ptzField");
	var joystickHit = document.getElementById("ptzJoystickHit");
	var zoomHit = document.getElementById("ptzZoomHit");
	var glow = joystickHit.querySelector(".ptz-joystick-glow");

	var scale = 1; // rendered-px per natural-px, recalculated on layout
	var joystickMaxRadiusPx = JOYSTICK_MAX_RADIUS;
	var zoomMaxRangePx = ZOOM_MAX_RANGE;

	function layout() {
		// the PTZ tab is display:none until active, so clientWidth reads 0 --
		// bail out rather than positioning everything at scale 0
		if (!deskScene.clientWidth) return;
		scale = deskScene.clientWidth / NATURAL_W;

		monitor.style.left = SCREEN.left * scale + "px";
		monitor.style.top = SCREEN.top * scale + "px";
		monitor.style.width = (SCREEN.right - SCREEN.left) * scale + "px";
		monitor.style.height = (SCREEN.bottom - SCREEN.top) * scale + "px";

		var hitPad = 1.35; // hit area a bit larger than the visible knob for easier grabbing
		var rPx = JOYSTICK_MAX_RADIUS * scale * hitPad;
		joystickHit.style.left = JOYSTICK_CENTER.x * scale - rPx + "px";
		joystickHit.style.top = JOYSTICK_CENTER.y * scale - rPx + "px";
		joystickHit.style.width = rPx * 2 + "px";
		joystickHit.style.height = rPx * 2 + "px";
		joystickMaxRadiusPx = JOYSTICK_MAX_RADIUS * scale;

		var zoomPad = 18; // natural px -- bigger forgiving touch target than the visible wheel
		zoomHit.style.left = (ZOOM_BOX.left - zoomPad) * scale + "px";
		zoomHit.style.top = (ZOOM_BOX.top - zoomPad) * scale + "px";
		zoomHit.style.width = (ZOOM_BOX.right - ZOOM_BOX.left + zoomPad * 2) * scale + "px";
		zoomHit.style.height = (ZOOM_BOX.bottom - ZOOM_BOX.top + zoomPad * 2) * scale + "px";
		zoomMaxRangePx = ZOOM_MAX_RANGE * scale;

		clampPan();
		applyTransform();
	}

	var state = { x: -60, y: -60, scale: 0.75 };
	var SCALE_MIN = 0.4, SCALE_MAX = 2.2;
	var PAN_MAX_SPEED = 9; // px per frame at full deflection
	var ZOOM_SPEED = 0.012; // per frame

	function clampPan() {
		var fieldW = field.offsetWidth * state.scale;
		var fieldH = field.offsetHeight * state.scale;
		var monW = monitor.clientWidth;
		var monH = monitor.clientHeight;

		// once zoomed out far enough that the field is smaller than the
		// monitor viewport, center it instead of clamping to (0,0) -- the
		// old clamp forced a hard snap to the top-left corner right at the
		// zoom-out limit, which looked like the camera panning/tilting on
		// its own. This is continuous with the clamped case exactly at the
		// point fieldW/fieldH crosses monW/monH, so there's no jump.
		if (fieldW <= monW) {
			state.x = (monW - fieldW) / 2;
		} else {
			var minX = monW - fieldW;
			state.x = Math.max(minX, Math.min(0, state.x));
		}

		if (fieldH <= monH) {
			state.y = (monH - fieldH) / 2;
		} else {
			var minY = monH - fieldH;
			state.y = Math.max(minY, Math.min(0, state.y));
		}
	}

	function applyTransform() {
		clampPan();
		field.style.transform = "translate(" + state.x + "px, " + state.y + "px) scale(" + state.scale + ")";
	}

	// --- joystick: analog pan while held ---
	var joystickActive = false;
	var rafId = null;
	var nubOffset = { x: 0, y: 0 };

	function joystickLoop() {
		if (!joystickActive) return;
		var mag = Math.hypot(nubOffset.x, nubOffset.y) / joystickMaxRadiusPx;
		if (mag > 0.02) {
			// squared response curve: small pushes (easy to overshoot on touch)
			// move slowly for fine control, only full deflection hits max speed
			var speed = PAN_MAX_SPEED * mag * mag;
			var dirX = nubOffset.x / (joystickMaxRadiusPx * mag);
			var dirY = nubOffset.y / (joystickMaxRadiusPx * mag);
			state.x -= dirX * speed;
			state.y -= dirY * speed;
			applyTransform();
		}
		rafId = requestAnimationFrame(joystickLoop);
	}

	function setNub(dx, dy) {
		var mag = Math.hypot(dx, dy);
		if (mag > joystickMaxRadiusPx) {
			dx = (dx / mag) * joystickMaxRadiusPx;
			dy = (dy / mag) * joystickMaxRadiusPx;
		}
		nubOffset = { x: dx, y: dy };
		glow.style.transform = "translate(" + dx + "px, " + dy + "px)";
	}

	function joystickCenterScreen() {
		var rect = joystickHit.getBoundingClientRect();
		return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
	}

	joystickHit.addEventListener("pointerdown", function (e) {
		joystickHit.setPointerCapture(e.pointerId);
		joystickActive = true;
		joystickHit.classList.add("dragging");
		var c = joystickCenterScreen();
		setNub(e.clientX - c.cx, e.clientY - c.cy);
		rafId = requestAnimationFrame(joystickLoop);
	});
	joystickHit.addEventListener("pointermove", function (e) {
		if (!joystickActive) return;
		var c = joystickCenterScreen();
		setNub(e.clientX - c.cx, e.clientY - c.cy);
	});
	function releaseJoystick() {
		if (!joystickActive) return;
		joystickActive = false;
		joystickHit.classList.remove("dragging");
		setNub(0, 0);
		if (rafId) cancelAnimationFrame(rafId);
	}
	joystickHit.addEventListener("pointerup", releaseJoystick);
	joystickHit.addEventListener("pointercancel", releaseJoystick);

	// --- zoom: analog drag, same pattern as the joystick but vertical-only.
	// Drag up = zoom in, drag down = zoom out, further = faster, pivoting
	// around the viewport center so it feels like a straight dolly in/out.
	var zoomActive = false;
	var zoomRafId = null;
	var zoomOffset = 0; // vertical drag offset, clamped to +-zoomMaxRangePx
	var zoomStartY = 0;

	function zoomLoop() {
		if (!zoomActive) return;
		var mag = Math.abs(zoomOffset) / zoomMaxRangePx;
		if (mag > 0.02) {
			var dir = zoomOffset < 0 ? 1 : -1; // dragging up (negative offset) zooms in
			var speed = ZOOM_SPEED * mag * mag;
			var oldScale = state.scale;
			var newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, oldScale + dir * speed));
			if (newScale !== oldScale) {
				var cx = monitor.clientWidth / 2;
				var cy = monitor.clientHeight / 2;
				var ratio = newScale / oldScale;
				state.x = cx - ratio * (cx - state.x);
				state.y = cy - ratio * (cy - state.y);
				state.scale = newScale;
				applyTransform();
			}
		}
		zoomRafId = requestAnimationFrame(zoomLoop);
	}

	function setZoomOffset(dy) {
		zoomOffset = Math.max(-zoomMaxRangePx, Math.min(zoomMaxRangePx, dy));
	}

	zoomHit.addEventListener("pointerdown", function (e) {
		zoomHit.setPointerCapture(e.pointerId);
		zoomActive = true;
		zoomHit.classList.add("dragging");
		zoomStartY = e.clientY;
		setZoomOffset(0);
		zoomRafId = requestAnimationFrame(zoomLoop);
	});
	zoomHit.addEventListener("pointermove", function (e) {
		if (!zoomActive) return;
		setZoomOffset(e.clientY - zoomStartY);
	});
	function releaseZoom() {
		if (!zoomActive) return;
		zoomActive = false;
		zoomHit.classList.remove("dragging");
		setZoomOffset(0);
		if (zoomRafId) cancelAnimationFrame(zoomRafId);
	}
	zoomHit.addEventListener("pointerup", releaseZoom);
	zoomHit.addEventListener("pointercancel", releaseZoom);

	// --- fallback: direct drag on the monitor screen ---
	var dragActive = false;
	var dragStart = { x: 0, y: 0, fx: 0, fy: 0 };
	monitor.addEventListener("pointerdown", function (e) {
		dragActive = true;
		monitor.classList.add("dragging");
		monitor.setPointerCapture(e.pointerId);
		dragStart = { x: e.clientX, y: e.clientY, fx: state.x, fy: state.y };
	});
	monitor.addEventListener("pointermove", function (e) {
		if (!dragActive) return;
		state.x = dragStart.fx + (e.clientX - dragStart.x);
		state.y = dragStart.fy + (e.clientY - dragStart.y);
		applyTransform();
	});
	function endDrag() {
		dragActive = false;
		monitor.classList.remove("dragging");
	}
	monitor.addEventListener("pointerup", endDrag);
	monitor.addEventListener("pointercancel", endDrag);

	window.addEventListener("resize", layout);
	if (deskPhoto.complete) layout();
	else deskPhoto.addEventListener("load", layout);

	// re-run layout once the PTZ tab actually becomes visible -- it's
	// display:none until then, so clientWidth reads 0 and layout() no-ops
	var ptzTabLink = document.querySelector('[data-tab="ptz"]');
	if (ptzTabLink) {
		ptzTabLink.addEventListener("click", function () {
			requestAnimationFrame(layout);
		});
	}
})();
