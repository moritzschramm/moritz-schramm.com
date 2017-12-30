var canvas = document.getElementById("canvas");

canvas.width = canvas.scrollWidth;
canvas.height = canvas.scrollHeight;
var width = canvas.width;
var height = canvas.height;

var ctx = canvas.getContext("2d");

ctx.lineWidth = 1;
ctx.strokeStyle = "#999";

var run = false;

var amountX;
var amountY;
var size = 50;

var maxX = 300;
var maxY = 300;

var grid = new Array(maxX * maxY);

init();

function init() {

  drawGrid();
  initGrid();
}
function drawGrid() {

  ctx.beginPath();

  amountX = 0;
  amountY = 0;

  for(var x = width/2; x < width; x += size) {

    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    amountX++;
  }
  for(var x2 = width/2 - size; x2 > 0; x2 -= size) {

    ctx.moveTo(x2, 0);
    ctx.lineTo(x2, height);
    ctx.stroke();
  }

  for(var y = height/2; y < height; y += size) {

    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

      amountY++;
  }
  for(var y2 = height/2 - size; y2 > 0; y2 -= size) {

    ctx.moveTo(0, y2);
    ctx.lineTo(width, y2);
    ctx.stroke();
  }

  amountX++;
  amountY++;
}
function initGrid() {

  for(var x = 0; x < maxX; x++) {
    for(var y = 0; y < maxY; y++) {

      setGridAt(x, y, false);
      setGridAt(x*-1, y, false);
      setGridAt(x, y*-1, false);
      setGridAt(x*-1, y*-1, false);
    }
  }
}
function clearGrid() {

  ctx.clearRect(0, 0, width, height);
}
function redrawState() {

  ctx.fillStyle = "#111";

  for(var x = 0; x < amountX; x++) {
    for(var y = 0; y < amountY; y++) {


      if(getGridAt(x, y)) {
        ctx.fillRect(translateToPixelX(x), translateToPixelY(y), size, size);
      }
      if(getGridAt(x*-1, y)) {
        ctx.fillRect(translateToPixelX(x*-1), translateToPixelY(y), size, size);
      }
      if(getGridAt(x, y*-1)) {
        ctx.fillRect(translateToPixelX(x), translateToPixelY(y*-1), size, size);
      }
      if(getGridAt(x*-1, y*-1)) {
        ctx.fillRect(translateToPixelX(x*-1), translateToPixelY(y*-1), size, size);
      }


    }
  }
  renewLines();
}
function renewLines() {

  ctx.stroke(); //works surprisingly, but should be used with caution
}


function getXFromIndex(index, y) {

  return index - y * amountX;
}
function getYFromIndex(index) {

  var i = 0;
  while(i * amountX < index) {
    i++;
  }
  return i-1;
}

function makeBlack(rawX, rawY) {

  var x = getGridPosX(rawX);
  var y = getGridPosY(rawY);

  makeBlackRaw(x, y);
}
function makeBlackRaw(x, y) {

  setGridAt(x, y, true);

  ctx.fillStyle = "#111";
  ctx.fillRect(translateToPixelX(x), translateToPixelY(y), size, size);
  renewLines();
}
function makeWhite(rawX, rawY) {

  var x = getGridPosX(rawX);
  var y = getGridPosY(rawY);

  makeWhiteRaw(x, y);
}
function makeWhiteRaw(x, y) {

  setGridAt(x, y, false);

  ctx.fillStyle = "#fff";
  ctx.fillRect(translateToPixelX(x), translateToPixelY(y), size, size);
  renewLines();
}
function getGridPosX(rawX) {

  var x = Math.floor((rawX - width/2) / size);

  return x;
}
function getGridPosY(rawY) {

  var y = Math.floor((rawY - height/2) / size);

  return y;
}
function translateToPixelX(gridX) {

  return (gridX * size + width/2);
}
function translateToPixelY(gridY) {

  return (gridY * size + height/2);
}

function setGridAt(x, y, val) {

  var grid_x = maxX/2 + x;
  var grid_y = maxY/2 + y;

  if(grid_x < 0 || grid_y < 0 || grid_x > maxX-1 || grid_y > maxY-1) return;

  grid[ grid_y * maxX + grid_x ] = val;
}
function getGridAt(x, y) {

  var grid_x = maxX/2 + x;
  var grid_y = maxY/2 + y;

  if(grid_x < 0 || grid_y < 0 || grid_x > maxX-1 || grid_y > maxY-1) return false;

  return grid[ grid_y * maxX + grid_x ];
}

function setGridRawAt(grid_x, grid_y, val) {

  if(grid_x < 0 || grid_y < 0 || grid_x > maxX-1 || grid_y > maxY-1) return;

  grid[ grid_y * maxX + grid_x ] = val;
}
function setGridRaw(position, val) {
  if(position < 0 || position > grid.length) return;

  grid[position] = val;
}
function getGridRawAt(grid_x, grid_y) {

  if(grid_x < 0 || grid_y < 0 || grid_x > maxX-1 || grid_y > maxY-1) return false;

  return grid[ grid_y * maxX + grid_x ];
}

/* MOUSE STUFF */
var isMouseLeftDown = false;
var isMouseRightDown = false;
canvas.onmousemove = function(e) {

  if(!run) {
    if(isMouseLeftDown) {
      makeBlack(e.clientX, e.clientY);
    }
    if(isMouseRightDown) {
      makeWhite(e.clientX, e.clientY);
    }
  }
}
canvas.onmousedown = function(e) {

  if(e.which === 1) {
    isMouseLeftDown = true;
  }
  if(e.which === 3) {
    isMouseRightDown = true;
  }
}
canvas.onmouseup = function(e) {

  if(!run) {
    if(e.which === 1) {
      isMouseLeftDown = false;
      makeBlack(e.clientX, e.clientY);
    }
    if(e.which === 3) {
      isMouseRightDown = false;
      makeWhite(e.clientX, e.clientY);
    }
  }
}
canvas.onmouseleave = function() {
  isMouseRightDown = false;
  isMouseLeftDown = false;
}
canvas.addEventListener('contextmenu', function(evt) {
  evt.preventDefault();
}, false);

canvas.onwheel = function(e) {

  e.preventDefault();

  if(e.deltaY < 0 && size >= 20) {

    size -= 10;

  } else if(e.deltaY > 0 && size <= 300) {

    size += 10;
  }

  clearGrid();
  drawGrid();
  redrawState();
}

window.onresize = function(event) {

  clearGrid();

  canvas.width = canvas.scrollWidth;
  canvas.height = canvas.scrollHeight;
  width = canvas.width;
  height = canvas.height;

  drawGrid();

  ctx.lineWidth = 1;
  ctx.strokeStyle = "#999";

  redrawState();
  renewLines();
};
