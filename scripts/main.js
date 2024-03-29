var points = [];
var mult = 0.005;
var circRadius;
var halfWidth;
var halfHeight;
var PI4 = 4 * Math.PI;

var r1, r2, g1, g2, b1, b2;

function setup() {
	createCanvas(windowWidth, windowHeight);
	angleMode(RADIANS);
	noiseDetail(1);

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

	r1 = 50;
	r2 = 255;
	g1 = 50;
	g2 = 255;
	b1 = 255;
	b2 = 50;
}

function draw() {

	noStroke();
	strokeWeight(1);

	var maxFrameCount = Math.min(frameCount, points.length);

	for (var i = 0; i < maxFrameCount; i++) {

		var oldX = points[i].x;
		var oldY = points[i].y;

		var distCenter = customDist(halfWidth, halfHeight, oldX, oldY);

		var r = map(oldX, 0, width, r1, r2);
		var g = map(oldY, 0, height, g1, g2);
		var b = map(oldX, 0, width, b1, b2);
		var alpha = map(distCenter, 0, circRadius, 255, 0);

		stroke(r, g, b, alpha);

		var angle = map(noise(oldX * mult, oldY * mult), 0, 1, 0, PI4);

		points[i].add(createVector(Math.cos(angle), Math.sin(angle)))

		if (distCenter < circRadius) line(oldX, oldY, points[i].x, points[i].y)
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
