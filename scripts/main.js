var points = [];
var mult = 0.005;
var circRadius;
var halfWidth;
var halfHeight;
var PI4 = 4 * Math.PI;

var viridisStops = [
	[68, 1, 84],
	[72, 40, 120],
	[62, 74, 137],
	[49, 104, 142],
	[38, 130, 142],
	[31, 158, 137],
	[53, 183, 121],
	[109, 205, 89],
	[253, 231, 37]
];
var colorOut = [0, 0, 0];

function setup() {
	createCanvas(windowWidth, windowHeight);
	pixelDensity(1);
	angleMode(RADIANS);
	noiseDetail(1);
	strokeWeight(1);

	circRadius = Math.max(width, height) / 2;
  halfWidth = width / 2;
  halfHeight = height / 2

	var density = 100;
	var space = width / density;

	for (var x = 0; x < width; x += space) {
		for (var y = 0; y < height; y += space) {
			var p = createVector(x + random(-10, 10), y + random(-10, 10));
			points.push(p);
		}
	}

	shuffle(points, true);
}

function viridisColor(t, out) {
	t = t < 0 ? 0 : t > 1 ? 1 : t;
	var scaled = t * (viridisStops.length - 1);
	var i = Math.min(Math.floor(scaled), viridisStops.length - 2);
	var frac = scaled - i;
	var a = viridisStops[i];
	var b = viridisStops[i + 1];
	out[0] = a[0] + (b[0] - a[0]) * frac;
	out[1] = a[1] + (b[1] - a[1]) * frac;
	out[2] = a[2] + (b[2] - a[2]) * frac;
	return out;
}

function draw() {

	var maxFrameCount = Math.min(frameCount, points.length);

	for (var i = 0; i < maxFrameCount; i++) {

		var p = points[i];
		var oldX = p.x;
		var oldY = p.y;

		var distCenter = customDist(halfWidth, halfHeight, oldX, oldY);

		var angleFromCenter = Math.atan2(oldY - halfHeight, oldX - halfWidth);
		var normalizedAngle = map(angleFromCenter, -Math.PI, Math.PI, 0, 1);
		viridisColor(1 - Math.abs(2 * normalizedAngle - 1), colorOut);
		var alpha = map(distCenter, 0, circRadius, 255, 0);

		stroke(colorOut[0], colorOut[1], colorOut[2], alpha);

		var angle = map(noise(oldX * mult, oldY * mult), 0, 1, 0, PI4);

		p.x += Math.cos(angle);
		p.y += Math.sin(angle);

		if (distCenter < circRadius) line(oldX, oldY, p.x, p.y);
	}
}

function customDist(x1, y1, x2, y2) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    circRadius = Math.max(width, height) / 2;
    halfWidth = width / 2;
    halfHeight = height / 2;
}
