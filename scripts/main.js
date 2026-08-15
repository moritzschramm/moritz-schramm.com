(function () {
	'use strict';

	var canvas = document.createElement('canvas');
	canvas.style.display = 'block';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	document.getElementById('flowfield').appendChild(canvas);

	var contentEl = document.getElementById('content');

	var gl = canvas.getContext('webgl', {
		alpha: true,
		antialias: false,
		depth: false,
		stencil: false,
		preserveDrawingBuffer: true
	});

	if (!gl) {
		return;
	}

	var FLOATS_PER_VERTEX = 6; // x, y, r, g, b, a
	var VERTEX_STRIDE = FLOATS_PER_VERTEX * 4;
	var TRAIL_LENGTH = 40; // positions kept per worm (39 segments each)
	var mult = 0.005;
	var PI4 = 4 * Math.PI;

	// adaptive worm count: start at the top tier, then during the first
	// couple of warmup seconds measure actual stepAndDraw() time per worm
	// and pick whichever tier that extrapolates to fit the frame budget
	var QUALITY_LEVELS = [10000, 6000, 3500, 2000, 1000];
	var qualityLevel = 0;
	var qualityCalibrated = false;
	var PROBE_SKIP_FRAMES = 10; // let a few worms activate first so fixed per-call overhead doesn't skew the estimate
	var PROBE_SAMPLE_FRAMES = 40;
	var SLOW_FRAME_BUDGET_MS = 10; // target ceiling for stepAndDraw() at full density
	var probeFrameCount = 0;
	var probeMsPerWormSum = 0;
	var activeCap = Infinity; // ceiling on active worms after calibration; never lowered below what's already visible

	var TARGET_POINT_COUNT = QUALITY_LEVELS[qualityLevel];

	var REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

	var TARGET_FPS = 20; // simulation updates less often than the display refreshes
	var FRAME_INTERVAL = 1000 / TARGET_FPS;
	var REFERENCE_FPS = 60; // the frame rate the movement speed was originally tuned for
	var REFERENCE_INTERVAL = 1000 / REFERENCE_FPS;
	var SPEED_MULTIPLIER = 0.6;
	var MAX_STEP_SCALE = 5; // clamp movement jump after long pauses (e.g. backgrounded tab)
	var TIME_SCALE = 1 / 20000; // z advances 1 noise cell per 15s: field reshapes over tens of seconds
	var COLOR_TIME_SCALE = 1 / 20000; // how fast the color noise drifts over time
	var COLOR_SPATIAL_SCALE = 0.0015; // coarser than the flow noise: nearby trails share color regions
	var WARMUP_DURATION_MS = 15000; // time for all worms to activate, then run at full density forever
	var CLEAR_MARGIN = 50; // extra px beyond the text block's bounding box before trails fade back in
	var ALPHA_CUTOFF = 0.01; // skip drawing segments this faint or fainter - invisible, not worth the vertices

	var startTime = null;
	var lastFrameTime = 0;
	var animating = false;

	var vertexSrc =
		'attribute vec2 aPosition;' +
		'attribute vec4 aColor;' +
		'uniform vec2 uResolution;' +
		'varying vec4 vColor;' +
		'void main() {' +
		'  vec2 clip = (aPosition / uResolution) * 2.0 - 1.0;' +
		'  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);' +
		'  vColor = aColor;' +
		'}';

	var fragmentSrc =
		'precision mediump float;' +
		'varying vec4 vColor;' +
		'void main() {' +
		'  gl_FragColor = vColor;' +
		'}';

	function compileShader(type, source) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		return shader;
	}

	var program = gl.createProgram();
	gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSrc));
	gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSrc));
	gl.linkProgram(program);
	gl.useProgram(program);

	var aPosition = gl.getAttribLocation(program, 'aPosition');
	var aColor = gl.getAttribLocation(program, 'aColor');
	var uResolution = gl.getUniformLocation(program, 'uResolution');

	var buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.enableVertexAttribArray(aPosition);
	gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, VERTEX_STRIDE, 0);
	gl.enableVertexAttribArray(aColor);
	gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, VERTEX_STRIDE, 8);

	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	// ---- p5.js-compatible noise: value noise with cosine interpolation,
	// ported from p5's actual noise() implementation (not gradient/classic
	// Perlin noise) so the flow field matches the original sketch's character.
	// Matches the original's noiseDetail(1) call: a single octave, whose
	// amplitude starts at (and stays at) 0.5, so the practical output range
	// is [0, 0.5), not [0, 1) - reproduced here rather than normalized away.
	var PERLIN_YWRAPB = 4;
	var PERLIN_YWRAP = 1 << PERLIN_YWRAPB;
	var PERLIN_ZWRAPB = 8;
	var PERLIN_ZWRAP = 1 << PERLIN_ZWRAPB;
	var PERLIN_SIZE = 4095;
	var PERLIN_AMP = 0.5;
	var perlin = new Array(4096);
	for (var pi = 0; pi < 4096; pi++) perlin[pi] = Math.random();

	function scaledCosine(x) { return 0.5 * (1 - Math.cos(x * Math.PI)); }

	// z is a slowly-advancing "time" coordinate: sampling a 2D slice of a 3D
	// noise volume that drifts along z makes the flow field's directions
	// gradually reshape while the animation runs, instead of staying fixed.
	// At z = 0 this is identical to the 2D-only version it replaces.
	function noise3(x, y, z) {
		if (x < 0) x = -x;
		if (y < 0) y = -y;
		if (z < 0) z = -z;

		var xi = Math.floor(x);
		var yi = Math.floor(y);
		var zi = Math.floor(z);
		var xf = x - xi;
		var yf = y - yi;
		var zf = z - zi;

		var of = xi + (yi << PERLIN_YWRAPB) + (zi << PERLIN_ZWRAPB);
		var rxf = scaledCosine(xf);
		var ryf = scaledCosine(yf);

		var n1 = perlin[of & PERLIN_SIZE];
		n1 += rxf * (perlin[(of + 1) & PERLIN_SIZE] - n1);
		var n2 = perlin[(of + PERLIN_YWRAP) & PERLIN_SIZE];
		n2 += rxf * (perlin[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n2);
		n1 += ryf * (n2 - n1);

		of += PERLIN_ZWRAP;
		n2 = perlin[of & PERLIN_SIZE];
		n2 += rxf * (perlin[(of + 1) & PERLIN_SIZE] - n2);
		var n3 = perlin[(of + PERLIN_YWRAP) & PERLIN_SIZE];
		n3 += rxf * (perlin[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n3);
		n2 += ryf * (n3 - n2);

		n1 += scaledCosine(zf) * (n2 - n1);

		return n1 * PERLIN_AMP;
	}

	// ---- colormaps: each is a list of [r, g, b] stops sampled evenly
	// across t = 0..1; colormapColor() linearly interpolates between them ----
	var COLOR_MAPS = {
		viridis: [
			[68, 1, 84],
			[72, 40, 120],
			[62, 74, 137],
			[49, 104, 142],
			[38, 130, 142],
			[31, 158, 137],
			[53, 183, 121],
			[109, 205, 89],
			[253, 231, 37]
		],
		inferno: [
			[0, 0, 4],
			[33, 12, 74],
			[87, 16, 110],
			[138, 34, 106],
			[188, 55, 84],
			[228, 90, 49],
			[249, 142, 9],
			[249, 203, 53],
			[252, 255, 164]
		],
		// approximates the very first version of this sketch, which set r/b
		// from x position and g from y position independently rather than
		// looking any of them up from a single 1D colormap - that 2-axis
		// approach can't be reproduced exactly through a t -> RGB lookup, so
		// this is a full-spectrum hue sweep standing in for the same
		// "whole color rainbow" look
		rgb: [
			[128, 0, 255],
			[64, 98, 250],
			[0, 180, 236],
			[64, 236, 212],
			[128, 255, 180],
			[191, 236, 142],
			[255, 180, 98],
			[255, 98, 50],
			[255, 0, 0]
		]
	};

	// ---- change this to switch the flow field's colormap ----
	var COLOR_MAP_NAME = 'rgb';

	var colorStops = COLOR_MAPS[COLOR_MAP_NAME];
	var colorOut = [0, 0, 0];
	function colormapColor(t, out) {
		t = t < 0 ? 0 : t > 1 ? 1 : t;
		var scaled = t * (colorStops.length - 1);
		var i = Math.min(Math.floor(scaled), colorStops.length - 2);
		var frac = scaled - i;
		var a = colorStops[i];
		var b = colorStops[i + 1];
		out[0] = a[0] + (b[0] - a[0]) * frac;
		out[1] = a[1] + (b[1] - a[1]) * frac;
		out[2] = a[2] + (b[2] - a[2]) * frac;
		return out;
	}

	// ---- simulation state ----
	// trailX/trailY are ring buffers: trailX[i * TRAIL_LENGTH + slot] holds
	// worm i's position at that slot. historyHead is the slot that gets
	// overwritten on the *next* step, so it's also the oldest currently-valid
	// sample; walking forward TRAIL_LENGTH - 1 slots from it visits the whole
	// worm from tail to head.
	var width, height, circRadius, halfWidth, halfHeight, clearRadius;
	var trailX, trailY, pointCount, vertexData;
	var historyHead = 0;

	function setupPoints() {
		var space = Math.sqrt((width * height) / TARGET_POINT_COUNT);
		var cols = Math.max(1, Math.floor(width / space));
		var rows = Math.max(1, Math.floor(height / space));

		pointCount = cols * rows;

		var startX = new Float32Array(pointCount);
		var startY = new Float32Array(pointCount);

		var idx = 0;
		for (var xi = 0; xi < cols; xi++) {
			for (var yi = 0; yi < rows; yi++) {
				startX[idx] = xi * space + (Math.random() * 20 - 10);
				startY[idx] = yi * space + (Math.random() * 20 - 10);
				idx++;
			}
		}

		// Fisher-Yates shuffle so worms don't activate in a raster-scan order
		for (var i = pointCount - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var tx = startX[i]; startX[i] = startX[j]; startX[j] = tx;
			var ty = startY[i]; startY[i] = startY[j]; startY[j] = ty;
		}

		trailX = new Float32Array(pointCount * TRAIL_LENGTH);
		trailY = new Float32Array(pointCount * TRAIL_LENGTH);
		for (var p = 0; p < pointCount; p++) {
			for (var s = 0; s < TRAIL_LENGTH; s++) {
				trailX[p * TRAIL_LENGTH + s] = startX[p];
				trailY[p * TRAIL_LENGTH + s] = startY[p];
			}
		}
		historyHead = 0;

		var maxSegments = pointCount * (TRAIL_LENGTH - 1);
		vertexData = new Float32Array(maxSegments * 2 * FLOATS_PER_VERTEX);

		gl.bufferData(gl.ARRAY_BUFFER, vertexData.byteLength, gl.DYNAMIC_DRAW);
	}

	// #content is centered by the page's flex layout, so it shares the same
	// center as the canvas - only its half-diagonal (plus a margin) is needed
	// to know how far the fade-out zone should reach. Called on resize, and
	// again once web fonts finish loading, since a font swap can reflow the
	// text to a different size than whatever fallback font was measured first.
	function updateClearRadius() {
		var contentRect = contentEl.getBoundingClientRect();

		// a near-zero result means the text hasn't actually been laid out yet
		// (seen this read as 0x0 on the very first synchronous measurement in
		// some browsers, even though getBoundingClientRect is supposed to force
		// a layout) - don't trust it, keep a sane fallback and retry next frame
		if (contentRect.width < 10 && contentRect.height < 10) {
			if (clearRadius === undefined) {
				clearRadius = Math.min(width, height) * 0.3;
			}
			requestAnimationFrame(updateClearRadius);
			return;
		}

		clearRadius = Math.sqrt(contentRect.width * contentRect.width + contentRect.height * contentRect.height) / 2 + CLEAR_MARGIN;
	}

	function resize() {
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = width;
		canvas.height = height;
		gl.viewport(0, 0, width, height);
		gl.uniform2f(uResolution, width, height);

		circRadius = Math.max(width, height) / 2;
		halfWidth = width / 2;
		halfHeight = height / 2;

		updateClearRadius();

		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		setupPoints();

		startTime = null;
		lastFrameTime = 0;

		if (REDUCED_MOTION) {
			// no animation: advance every worm through a fixed (non-drifting)
			// field to fill its trail, then draw one settled-looking static
			// frame and stop - no rAF loop at all
			for (var s = 0; s < TRAIL_LENGTH; s++) {
				stepAndDraw(pointCount, 1, 0, 0);
			}
		} else {
			startAnimation();
		}
	}

	function stepAndDraw(maxActive, stepScale, flowTime, colorTime) {
		var prevSlot = (historyHead - 1 + TRAIL_LENGTH) % TRAIL_LENGTH;

		for (var i = 0; i < maxActive; i++) {
			var base = i * TRAIL_LENGTH;
			var oldX = trailX[base + prevSlot];
			var oldY = trailY[base + prevSlot];

			var flowAngle = noise3(oldX * mult, oldY * mult, flowTime) * PI4;
			var newX = oldX + Math.cos(flowAngle) * stepScale;
			var newY = oldY + Math.sin(flowAngle) * stepScale;

			var ndx = newX - halfWidth;
			var ndy = newY - halfHeight;
			if (ndx * ndx + ndy * ndy > circRadius * circRadius) {
				// this worm drifted out of the visible circle for good (the flow
				// field never brings points back) - respawn it fresh elsewhere
				// so the visible worm count stays roughly constant forever
				newX = Math.random() * width;
				newY = Math.random() * height;
				for (var s = 0; s < TRAIL_LENGTH; s++) {
					trailX[base + s] = newX;
					trailY[base + s] = newY;
				}
			} else {
				trailX[base + historyHead] = newX;
				trailY[base + historyHead] = newY;
			}
		}

		historyHead = (historyHead + 1) % TRAIL_LENGTH;
		var headSlot = (historyHead - 1 + TRAIL_LENGTH) % TRAIL_LENGTH; // most recently written slot

		// redraw the whole canvas fresh from the current trails every frame -
		// nothing here is ever appended to a permanent buffer, so a worm's
		// tail (and the field it was drawn from) can freely change shape
		gl.clear(gl.COLOR_BUFFER_BIT);

		var segmentCount = 0;
		var circRadiusSq = circRadius * circRadius;

		for (var p = 0; p < maxActive; p++) {
			var pBase = p * TRAIL_LENGTH;

			// color noise uses a coarse spatial scale, so nearby segments of
			// the same short worm would sample almost the same value anyway -
			// sampling once per worm (at its head) instead of once per segment
			// cuts the noise3()/colormapColor() calls by ~TRAIL_LENGTH times
			var hx = trailX[pBase + headSlot];
			var hy = trailY[pBase + headSlot];
			var noiseT = noise3(hx * COLOR_SPATIAL_SCALE, hy * COLOR_SPATIAL_SCALE, colorTime) * 2;
			colormapColor(noiseT, colorOut);
			var r = colorOut[0] / 255;
			var g = colorOut[1] / 255;
			var b = colorOut[2] / 255;

			for (var k = 0; k < TRAIL_LENGTH - 1; k++) {
				var slotA = (historyHead + k) % TRAIL_LENGTH;
				var slotB = (historyHead + k + 1) % TRAIL_LENGTH;

				var ax = trailX[pBase + slotA];
				var ay = trailY[pBase + slotA];
				var bx = trailX[pBase + slotB];
				var by = trailY[pBase + slotB];

				var dx = ax - halfWidth;
				var dy = ay - halfHeight;
				var distSq = dx * dx + dy * dy;

				// cheap squared-distance rejection first, so segments clearly
				// outside the visible circle never pay for a sqrt at all
				if (distSq >= circRadiusSq) continue;

				var distCenter = Math.sqrt(distSq);

				var ageFade = k / (TRAIL_LENGTH - 2); // 0 at the tail, 1 at the head

				// worms move through the text area completely undisturbed - they
				// just fade out as they get close, with a soft (smoothstep, zero
				// derivative at both ends) curve so there's no visible edge to
				// the fade, unlike a hard-edged movement bias would produce
				var ct = Math.min(1, distCenter / clearRadius);
				var clearFade = ct * ct * (3 - 2 * ct);

				var alpha = ageFade * (1 - distCenter / circRadius) * clearFade;

				// skip vertices for segments too faint to see - saves the
				// buffer writes and the GPU fill/blend cost of drawing them
				if (alpha < ALPHA_CUTOFF) continue;

				var vbase = segmentCount * 2 * FLOATS_PER_VERTEX;

				vertexData[vbase] = ax;
				vertexData[vbase + 1] = ay;
				vertexData[vbase + 2] = r;
				vertexData[vbase + 3] = g;
				vertexData[vbase + 4] = b;
				vertexData[vbase + 5] = alpha;

				vertexData[vbase + 6] = bx;
				vertexData[vbase + 7] = by;
				vertexData[vbase + 8] = r;
				vertexData[vbase + 9] = g;
				vertexData[vbase + 10] = b;
				vertexData[vbase + 11] = alpha;

				segmentCount++;
			}
		}

		if (segmentCount > 0) {
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertexData.subarray(0, segmentCount * 2 * FLOATS_PER_VERTEX));
			gl.drawArrays(gl.LINES, 0, segmentCount * 2);
		}
	}

	function startAnimation() {
		if (animating) return; // guard against a second parallel rAF chain on resize
		animating = true;
		requestAnimationFrame(frame);
	}

	function frame(timestamp) {
		if (startTime === null) {
			startTime = timestamp;
			lastFrameTime = timestamp;
		}
		var elapsed = timestamp - startTime;

		var dt = timestamp - lastFrameTime;
		if (dt < FRAME_INTERVAL) {
			requestAnimationFrame(frame);
			return;
		}
		lastFrameTime = timestamp;

		// fewer updates per second means each one covers proportionally more
		// time, so movement speed (px/sec) stays constant regardless of TARGET_FPS
		var stepScale = Math.min((dt / REFERENCE_INTERVAL) * SPEED_MULTIPLIER, MAX_STEP_SCALE);

		var warmupProgress = Math.min(1, elapsed / WARMUP_DURATION_MS);
		var flowTime = elapsed * TIME_SCALE;
		var colorTime = elapsed * COLOR_TIME_SCALE;
		var maxActiveNow = Math.min(Math.floor(warmupProgress * pointCount), activeCap);

		if (qualityCalibrated) {
			stepAndDraw(maxActiveNow, stepScale, flowTime, colorTime);
		} else {
			var probeStart = performance.now();
			stepAndDraw(maxActiveNow, stepScale, flowTime, colorTime);
			calibrateQuality(maxActiveNow, performance.now() - probeStart);
		}

		requestAnimationFrame(frame);
	}

	function calibrateQuality(maxActiveNow, durationMs) {
		if (maxActiveNow === 0) return; // nothing active yet, not a useful sample

		probeFrameCount++;
		if (probeFrameCount <= PROBE_SKIP_FRAMES) return;

		probeMsPerWormSum += durationMs / maxActiveNow;
		if (probeFrameCount < PROBE_SKIP_FRAMES + PROBE_SAMPLE_FRAMES) return;

		qualityCalibrated = true;

		var avgMsPerWorm = probeMsPerWormSum / PROBE_SAMPLE_FRAMES;
		while (
			qualityLevel < QUALITY_LEVELS.length - 1 &&
			avgMsPerWorm * QUALITY_LEVELS[qualityLevel] > SLOW_FRAME_BUDGET_MS
		) {
			qualityLevel++;
		}

		if (qualityLevel > 0) {
			// qualityLevel only ever increases above its starting value of 0
			// here, so this means the loop above actually picked a lower tier.
			// Cap future growth via activeCap rather than shrinking pointCount -
			// never below maxActiveNow, so nothing already visible disappears,
			// it just stops growing further instead of one smooth animation
			TARGET_POINT_COUNT = QUALITY_LEVELS[qualityLevel];
			activeCap = Math.max(maxActiveNow, TARGET_POINT_COUNT);
		}
	}

	window.addEventListener('resize', resize);
	resize();

	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(updateClearRadius);
	}
})();
