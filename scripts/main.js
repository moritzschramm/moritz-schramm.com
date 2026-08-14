(function () {
	'use strict';

	var canvas = document.createElement('canvas');
	canvas.style.display = 'block';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	document.getElementById('flowfield').appendChild(canvas);

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
	var TARGET_POINT_COUNT = 6000;
	var mult = 0.005;
	var PI4 = 4 * Math.PI;

	var REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

	var TARGET_FPS = 20; // simulation updates less often than the display refreshes
	var FRAME_INTERVAL = 1000 / TARGET_FPS;
	var REFERENCE_FPS = 60; // the frame rate the movement speed was originally tuned for
	var REFERENCE_INTERVAL = 1000 / REFERENCE_FPS;
	var SPEED_MULTIPLIER = 1.8;
	var MAX_STEP_SCALE = 5; // clamp movement jump after long pauses (e.g. backgrounded tab)
	var WARMUP_DURATION_MS = 60000; // time for all points to activate
	var SETTLE_DURATION_MS = 30000; // extra time to run at full density before stopping
	var STOP_DURATION_MS = WARMUP_DURATION_MS + SETTLE_DURATION_MS;

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
	var PERLIN_SIZE = 4095;
	var PERLIN_AMP = 0.5;
	var perlin = new Array(4096);
	for (var pi = 0; pi < 4096; pi++) perlin[pi] = Math.random();

	function scaledCosine(x) { return 0.5 * (1 - Math.cos(x * Math.PI)); }

	function noise2(x, y) {
		if (x < 0) x = -x;
		if (y < 0) y = -y;

		var xi = Math.floor(x);
		var yi = Math.floor(y);
		var xf = x - xi;
		var yf = y - yi;

		var of = xi + (yi << PERLIN_YWRAPB);
		var rxf = scaledCosine(xf);
		var ryf = scaledCosine(yf);

		var n1 = perlin[of & PERLIN_SIZE];
		n1 += rxf * (perlin[(of + 1) & PERLIN_SIZE] - n1);
		var n2 = perlin[(of + PERLIN_YWRAP) & PERLIN_SIZE];
		n2 += rxf * (perlin[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n2);
		n1 += ryf * (n2 - n1);

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
	var COLOR_MAP_NAME = 'inferno';

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
	var width, height, circRadius, halfWidth, halfHeight;
	var pointsX, pointsY, pointCount, vertexData;

	function setupPoints() {
		var space = Math.sqrt((width * height) / TARGET_POINT_COUNT);
		var cols = Math.max(1, Math.floor(width / space));
		var rows = Math.max(1, Math.floor(height / space));

		pointCount = cols * rows;
		pointsX = new Float32Array(pointCount);
		pointsY = new Float32Array(pointCount);

		var idx = 0;
		for (var xi = 0; xi < cols; xi++) {
			for (var yi = 0; yi < rows; yi++) {
				pointsX[idx] = xi * space + (Math.random() * 20 - 10);
				pointsY[idx] = yi * space + (Math.random() * 20 - 10);
				idx++;
			}
		}

		// Fisher-Yates shuffle so points don't activate in a raster-scan order
		for (var i = pointCount - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var tx = pointsX[i]; pointsX[i] = pointsX[j]; pointsX[j] = tx;
			var ty = pointsY[i]; pointsY[i] = pointsY[j]; pointsY[j] = ty;
		}

		vertexData = new Float32Array(pointCount * 2 * FLOATS_PER_VERTEX);

		gl.bufferData(gl.ARRAY_BUFFER, vertexData.byteLength, gl.DYNAMIC_DRAW);
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

		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		setupPoints();

		startTime = null;
		lastFrameTime = 0;

		if (REDUCED_MOTION) {
			// no animation: draw one fully-settled-looking static frame and stop
			stepAndDraw(pointCount, 1);
		} else {
			startAnimation();
		}
	}

	function stepAndDraw(maxActive, stepScale) {
		var segmentCount = 0;

		for (var i = 0; i < maxActive; i++) {
			var oldX = pointsX[i];
			var oldY = pointsY[i];

			var dx = oldX - halfWidth;
			var dy = oldY - halfHeight;
			var distCenter = Math.sqrt(dx * dx + dy * dy);

			var normalizedAngle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
			colormapColor(1 - Math.abs(2 * normalizedAngle - 1), colorOut);

			var flowAngle = noise2(oldX * mult, oldY * mult) * PI4;
			var newX = oldX + Math.cos(flowAngle) * stepScale;
			var newY = oldY + Math.sin(flowAngle) * stepScale;

			pointsX[i] = newX;
			pointsY[i] = newY;

			if (distCenter < circRadius) {
				var base = segmentCount * 2 * FLOATS_PER_VERTEX;
				var r = colorOut[0] / 255;
				var g = colorOut[1] / 255;
				var b = colorOut[2] / 255;
				var a = 1 - distCenter / circRadius;

				vertexData[base] = oldX;
				vertexData[base + 1] = oldY;
				vertexData[base + 2] = r;
				vertexData[base + 3] = g;
				vertexData[base + 4] = b;
				vertexData[base + 5] = a;

				vertexData[base + 6] = newX;
				vertexData[base + 7] = newY;
				vertexData[base + 8] = r;
				vertexData[base + 9] = g;
				vertexData[base + 10] = b;
				vertexData[base + 11] = a;

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

		if (elapsed >= STOP_DURATION_MS) {
			animating = false;
			return; // fully settled: stop scheduling further frames
		}

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
		stepAndDraw(Math.floor(warmupProgress * pointCount), stepScale);

		requestAnimationFrame(frame);
	}

	window.addEventListener('resize', resize);
	resize();
})();
