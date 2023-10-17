
// TODO create class for circle and draw multiple circles over each other

var points = [];
var mult = 0.005;

var r1, r2, g1, g2, b1, b2;

function setup() {
	createCanvas(windowWidth, windowHeight);
	background('rgba(0,0,0,0.7)');
	angleMode(DEGREES);
	noiseDetail(1);

	var density = 100;
	var space = width / density;

	for (var x = 0; x < width; x += space) {
		for (var y = 0; y < height; y += space) {
			var p = createVector(x + random(-10, 10), y + random(-10, 10));
			points.push(p);
		}
	}

	shuffle(points, true);

	r1 = 50;//random(255);
	r2 = 255;//random(255);
	g1 = 50;//random(255);
	g2 = 255;//random(255);
	b1 = 255;//random(255);
	b2 = 50;//random(255);
}

function draw() {
	noStroke();

	var maxFrameCount = Math.min(frameCount, points.length);

	for (var i = 0; i < maxFrameCount; i++) {

		var distCenter = dist(width / 2, height / 2, points[i].x, points[i].y);
		var circRadius = width / 2;

		var r = map(points[i].x, 0, width, r1, r2);
		var g = map(points[i].y, 0, height, g1, g2);
		var b = map(points[i].x, 0, width, b1, b2);
		var alpha = map(distCenter, 0, circRadius, 200, 0);

		strokeWeight(1);
		stroke(r, g, b, alpha);

		var angle = map(noise(points[i].x * mult, points[i].y * mult), 0, 1, 0, 720);

		var oldX = points[i].x;
		var oldY = points[i].y;

		points[i].add(createVector(cos(angle), sin(angle)))

		if (distCenter < circRadius)
			line(oldX, oldY, points[i].x, points[i].y)
	}
}