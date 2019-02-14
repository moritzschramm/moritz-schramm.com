
// uses grid, maxX, maxY of app.js
// uses setGridAt(x, y, val)
// uses getGridRawAt(x, y)
// uses redrawState()
// uses run

var invokeEvery = 500; //milliseconds
var loop_id;
var cycle = 1;

function startGame() {

  if(!run) {
    document.getElementById("console").innerHTML = "Starting...";
    run = true;
    runGame();
    loop_id = setInterval(runGame, invokeEvery);
  }
}

function stopGame() {

  document.getElementById("console").innerHTML = "Stopped";
  run = false;
  cycle = 1;
  if(loop_id !== undefined)
    clearInterval(loop_id);
}

function clearAll() {

  document.getElementById("console").innerHTML = "Cleared";
  grid = new Array(maxX * maxY);
  clearGrid();
  drawGrid();
}

function runGame() {

  if(run) {

    document.getElementById("console").innerHTML = "Running... Current cycle: " + cycle;
    cycle++;

    var alive = false;

    var grid_adds = [];
    var grid_removes = [];

    for(var x = 0; x < maxX; x++) {
      for(var y = 0; y < maxY; y++) {

        var amountOfNeighbours = 0;

        if(getGridRawAt(x-1, y+1)) amountOfNeighbours++;
        if(getGridRawAt(x,   y+1)) amountOfNeighbours++;
        if(getGridRawAt(x+1, y+1)) amountOfNeighbours++;

        if(getGridRawAt(x-1,   y)) amountOfNeighbours++;
        if(getGridRawAt(x+1,   y)) amountOfNeighbours++;

        if(getGridRawAt(x-1, y-1)) amountOfNeighbours++;
        if(getGridRawAt(x,   y-1)) amountOfNeighbours++;
        if(getGridRawAt(x+1, y-1)) amountOfNeighbours++;


        if(getGridRawAt(x, y)) {

          alive = true;
          if(amountOfNeighbours < 2 || amountOfNeighbours > 3) grid_removes.push(y * maxX + x);

        } else {

          if(amountOfNeighbours == 3) grid_adds.push(y * maxX + x);
        }
      }
    }
    for(var k = 0; k < grid_adds.length; k++) {
      setGridRaw(grid_adds[k], true);
    }
    for(var i = 0; i < grid_removes.length; i++) {
      setGridRaw(grid_removes[i], false);
    }

    clearGrid();
    drawGrid();
    redrawState();

    if(!alive) stopGame();
  }
}
