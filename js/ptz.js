(function () {
	var deskScene = document.getElementById("ptzDesk");
	if (!deskScene) return;

	// hotspot coordinates measured against the source photo's natural pixel size (1672x941)
	var NATURAL_W = 1672;
	var NATURAL_H = 941;
	var SCREEN = { left: 305, top: 54, right: 1108, bottom: 504 };
	var JOYSTICK_CENTER = { x: 828, y: 585 };
	var JOYSTICK_MAX_RADIUS = 45; // px, natural scale -- how far the nub can travel before clamping
	var ZOOM_BOX = { left: 977, top: 663, right: 1050, bottom: 763 };
	var ZOOM_MAX_RANGE = 40; // px, natural scale -- vertical drag range for full-speed zoom
	// must match .ptz-desk-photo's object-position in CSS -- 0 = crop window
	// anchored to the photo's left edge, 1 = anchored to its right edge,
	// 0.5 = centered. The interactive content sits well left of the photo's
	// true geometric center, so a centered crop cuts into the monitor itself
	// on narrow (cropped) aspect ratios; this shifts the anchor left instead.
	var OBJECT_POSITION_X = 0.33;
	var OBJECT_POSITION_Y = 0.5;

	var deskPhoto = document.getElementById("ptzDeskPhoto");
	var monitor = document.getElementById("ptzMonitor");
	var field = document.getElementById("ptzField");
	var joystickHit = document.getElementById("ptzJoystickHit");
	var zoomHit = document.getElementById("ptzZoomHit");
	var glow = joystickHit.querySelector(".ptz-joystick-glow");

	var scale = 1; // effective rendered-px per natural-px (object-fit:cover scale)
	var offsetX = 0, offsetY = 0; // crop offset when the container's aspect ratio is narrower/wider than the photo's
	var joystickMaxRadiusPx = JOYSTICK_MAX_RADIUS;
	var zoomMaxRangePx = ZOOM_MAX_RANGE;

	function layout() {
		// the PTZ tab is display:none until active, so clientWidth reads 0 --
		// bail out rather than positioning everything at scale 0
		if (!deskScene.clientWidth) return;
		var containerW = deskScene.clientWidth;
		var containerH = deskScene.clientHeight;

		// same math as CSS object-fit:cover: scale by whichever dimension
		// needs MORE scaling to fully cover the container, which crops the
		// other dimension. On mobile .ptz-desk is narrower than the photo's
		// native ~16:9 shape, so this crops the sides (see the media query).
		// When the container's aspect ratio matches the photo's exactly
		// (desktop), offsetX/offsetY come out to 0 -- same as before.
		scale = Math.max(containerW / NATURAL_W, containerH / NATURAL_H);
		offsetX = (NATURAL_W * scale - containerW) * OBJECT_POSITION_X;
		offsetY = (NATURAL_H * scale - containerH) * OBJECT_POSITION_Y;

		monitor.style.left = SCREEN.left * scale - offsetX + "px";
		monitor.style.top = SCREEN.top * scale - offsetY + "px";
		monitor.style.width = (SCREEN.right - SCREEN.left) * scale + "px";
		monitor.style.height = (SCREEN.bottom - SCREEN.top) * scale + "px";

		var hitPad = 1.35; // hit area a bit larger than the visible knob for easier grabbing
		var rPx = JOYSTICK_MAX_RADIUS * scale * hitPad;
		joystickHit.style.left = JOYSTICK_CENTER.x * scale - offsetX - rPx + "px";
		joystickHit.style.top = JOYSTICK_CENTER.y * scale - offsetY - rPx + "px";
		joystickHit.style.width = rPx * 2 + "px";
		joystickHit.style.height = rPx * 2 + "px";
		joystickMaxRadiusPx = JOYSTICK_MAX_RADIUS * scale;

		var zoomPad = 18; // natural px -- bigger forgiving touch target than the visible wheel
		zoomHit.style.left = (ZOOM_BOX.left - zoomPad) * scale - offsetX + "px";
		zoomHit.style.top = (ZOOM_BOX.top - zoomPad) * scale - offsetY + "px";
		zoomHit.style.width = (ZOOM_BOX.right - ZOOM_BOX.left + zoomPad * 2) * scale + "px";
		zoomHit.style.height = (ZOOM_BOX.bottom - ZOOM_BOX.top + zoomPad * 2) * scale + "px";
		zoomMaxRangePx = ZOOM_MAX_RANGE * scale;

		clampPan();
		applyTransform();
	}

	// The camera's "aim point" -- panX/panY are a position in the FIELD's own
	// natural coordinate space (0..fieldWidth, 0..fieldHeight), independent of
	// zoom. This is the key property a real PTZ camera has that the earlier
	// version didn't: the pannable range doesn't shrink or grow with zoom --
	// zoomed out or in, you can aim anywhere across the same fixed range.
	// Zoom is then pure magnification around that fixed aim point: it never
	// touches panX/panY at all, so it can never "reposition" the camera.
	var state = { panX: 700, panY: 450, scale: 0.75 };
	var SCALE_MIN = 0.4, SCALE_MAX = 2.2;
	var PAN_MAX_SPEED = 9; // screen px per frame at full deflection
	var ZOOM_SPEED = 0.012; // per frame

	function clampPan() {
		var fieldW = field.offsetWidth;
		var fieldH = field.offsetHeight;
		state.panX = Math.max(0, Math.min(fieldW, state.panX));
		state.panY = Math.max(0, Math.min(fieldH, state.panY));
	}

	var GRID_CELL = 40; // px, natural scale -- must match .ptz-monitor's background-image period

	function applyTransform() {
		var monW = monitor.clientWidth;
		var monH = monitor.clientHeight;
		var x = monW / 2 - state.panX * state.scale;
		var y = monH / 2 - state.panY * state.scale;
		field.style.transform = "translate(" + x + "px, " + y + "px) scale(" + state.scale + ")";
		// keep the monitor's own background grid (see .ptz-monitor CSS) in
		// perfect sync with the field's pan/zoom so it reads as one endless
		// grid instead of visibly stopping at the field element's edges
		var gridSize = GRID_CELL * state.scale;
		monitor.style.backgroundPosition = x + "px " + y + "px";
		monitor.style.backgroundSize = gridSize + "px " + gridSize + "px";
	}

	function clampAndApply() {
		clampPan();
		applyTransform();
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
			var speed = PAN_MAX_SPEED * mag * mag; // screen px/frame
			var dirX = nubOffset.x / (joystickMaxRadiusPx * mag);
			var dirY = nubOffset.y / (joystickMaxRadiusPx * mag);
			// convert screen-space speed to field-space so panning feels the
			// same on screen at any zoom level (same screen speed = less
			// field distance covered per frame when zoomed in, more when out)
			state.panX += (dirX * speed) / state.scale;
			state.panY += (dirY * speed) / state.scale;
			clampAndApply();
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
	// Drag up = zoom in, drag down = zoom out, further = faster. Pure
	// magnification around the fixed aim point (panX/panY) -- never touches
	// pan at all, so it can never reposition the camera, matching how a real
	// camera's zoom doesn't move its pan/tilt.
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
			var newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, state.scale + dir * speed));
			if (newScale !== state.scale) {
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
	var dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
	monitor.addEventListener("pointerdown", function (e) {
		dragActive = true;
		monitor.classList.add("dragging");
		monitor.setPointerCapture(e.pointerId);
		dragStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
	});
	monitor.addEventListener("pointermove", function (e) {
		if (!dragActive) return;
		state.panX = dragStart.panX - (e.clientX - dragStart.x) / state.scale;
		state.panY = dragStart.panY - (e.clientY - dragStart.y) / state.scale;
		clampAndApply();
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

	// --- job cards: built from js/ptz-cards.json (generated from
	// ptz-jobs/*.json, see scripts/build_ptz_cards.py), scattered around the
	// field's center with a little randomness -- mirrors how the cards used
	// to be hand-placed (spread out across the desk, not a tidy grid), but
	// computed instead of hand-measured.

	// FIELD_W/H match .ptz-field's size in style.css, CARD_W is a fallback
	// for the width estimate (real width/height are measured post-layout,
	// same "mirror the CSS" pattern as NATURAL_W etc. above). Cards scatter
	// around the camera's default aim point (state.panX/panY, declared
	// above) so the initial view opens roughly centered on them.
	var FIELD_W = 1400, FIELD_H = 900, CARD_W = 240, MARGIN = 40, GUTTER = 36;
	var CENTER_X = state.panX, CENTER_Y = state.panY;
	var builtCards = null;

	function buildCard(job) {
		var card = document.createElement("div");
		card.className = "ptz-card";
		var thumb = document.createElement("div");
		thumb.className = "ptz-thumb";
		thumb.style.backgroundImage = "url(img/ptz/" + job.thumbnail + ")";
		var h3 = document.createElement("h3");
		h3.textContent = job.title;
		var meta = document.createElement("div");
		meta.className = "ptz-meta";
		meta.textContent = job.meta;
		var desc = document.createElement("p");
		desc.textContent = job.description;
		card.appendChild(thumb);
		card.appendChild(h3);
		card.appendChild(meta);
		card.appendChild(desc);
		return card;
	}

	// small deterministic PRNG (mulberry32) seeded from a hash of the card's
	// own title -- not array index or load order -- so a given job always
	// scatters to roughly the same spot on every visit, and adding/removing
	// a *different* job never reshuffles the ones already placed.
	function hashSeed(str) {
		var h = 0;
		for (var i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
		return h;
	}
	function mulberry32(seed) {
		return function () {
			seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
			var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	// scatters already-built (but unpositioned) cards radially around
	// CENTER_X/Y: each card gets its own evenly-spaced slice of the full
	// circle (360deg / card count, in stable card order) so N cards always
	// fan out in N different directions instead of random angles clustering
	// together by chance (which is what a fully-random angle did with only
	// a handful of cards). A little jitter within the slice plus a
	// randomized radius keeps it from looking like a rigid polygon.
	// Collision-avoidance is a fallback, not the primary driver of
	// direction: if a jittered angle still overlaps an already-placed card,
	// the radius nudges outward and retries within the same slice. Only
	// runs once #ptzField is actually visible, since offsetHeight reads 0
	// inside a display:none subtree (same constraint layout() above has).
	function scatterCards() {
		if (!builtCards || !field.clientWidth) return;
		var placed = [];
		var n = builtCards.length;
		builtCards.forEach(function (card, index) {
			var w = card.offsetWidth || CARD_W;
			var h = card.offsetHeight;
			var rand = mulberry32(hashSeed(card.dataset.seed));
			var baseAngle = (index / n) * Math.PI * 2;
			var sliceWidth = (Math.PI * 2) / n;
			var left, top, tries = 0, maxTries = 30, ok = false;
			while (tries < maxTries && !ok) {
				var jitter = (rand() - 0.5) * sliceWidth * 0.6;
				var angle = baseAngle + jitter;
				var radius = 240 + rand() * 260 + tries * 14;
				var cx = CENTER_X + Math.cos(angle) * radius;
				var cy = CENTER_Y + Math.sin(angle) * radius * 0.6; // field is wider than tall
				left = Math.max(MARGIN, Math.min(FIELD_W - MARGIN - w, cx - w / 2));
				top = Math.max(MARGIN, Math.min(FIELD_H - MARGIN - h, cy - h / 2));
				ok = !placed.some(function (p) {
					return left < p.left + p.w + GUTTER && left + w + GUTTER > p.left &&
						top < p.top + p.h + GUTTER && top + h + GUTTER > p.top;
				});
				tries++;
			}
			card.style.left = left + "px";
			card.style.top = top + "px";
			placed.push({ left: left, top: top, w: w, h: h });
		});
	}

	fetch("js/ptz-cards.json").then(function (r) { return r.json(); }).then(function (jobs) {
		builtCards = jobs.map(function (job) {
			var card = buildCard(job);
			card.dataset.seed = job.title;
			field.appendChild(card);
			return card;
		});
		scatterCards();
	});

	// re-run layout/scatter once the PTZ tab actually becomes visible --
	// it's display:none until then, so clientWidth reads 0 and
	// layout()/scatterCards() no-op. Listens for script.js's "tabactivated"
	// event rather than a click on the tab link specifically, so a direct
	// #ptz link on page load (which activates the tab without any click
	// happening) still triggers this.
	document.addEventListener("tabactivated", function (e) {
		if (e.detail.target === "ptz") {
			requestAnimationFrame(layout);
			scatterCards();
		}
	});
})();
