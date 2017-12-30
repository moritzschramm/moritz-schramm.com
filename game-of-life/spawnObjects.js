var mX = 0;
var mY = 0;

function getMiddleX() {

  return (width/2)-size;
}
function getMiddleY() {

  return (height/2)-size;
}

function initSpawn() {

  mX = getMiddleX();    // sets middle of grid
  mY = getMiddleY();

  clearAll();   // clears grid
  closeDropdown();
}

function spawnGlider() {

  initSpawn();

  makeBlack(mX, mY);
  makeBlack(mX -size, mY -size);

  makeBlack(mX, mY +size);
  makeBlack(mX -size, mY +size);
  makeBlack(mX -2*size, mY +size);
}

function spawnPulsar() {

  initSpawn();

  makeBlack(mX, mY);
  makeBlack(mX, mY -size);
  makeBlack(mX, mY -2*size);

  makeBlack(mX -size, mY -2*size);
  makeBlack(mX -2*size, mY -2*size);

  makeBlack(mX -2*size, mY -size);
  makeBlack(mX -2*size, mY);


  makeBlack(mX, mY +2*size);
  makeBlack(mX, mY +3*size);

  makeBlack(mX, mY +4*size);
  makeBlack(mX -size, mY +4*size);
  makeBlack(mX -2*size, mY +4*size);

  makeBlack(mX -2*size, mY +3*size);
  makeBlack(mX -2*size, mY +2*size);
}

function spawnRPentomino() {

  initSpawn();

  makeBlack(mX, mY);
  makeBlack(mX, mY -size);
  makeBlack(mX, mY +size);
  makeBlack(mX +size, mY -size);
  makeBlack(mX -size, mY);
}

function spawnHeavyWeigthSpaceship() {

  initSpawn();

  makeBlack(mX -4*size, mY -size);
  makeBlack(mX -4*size, mY +size);

  makeBlack(mX -2*size, mY +2*size);
  makeBlack(mX -size, mY +2*size);

  makeBlack(mX +size, mY +size);

  makeBlack(mX +2*size, mY);
  makeBlack(mX +2*size, mY -size);

  makeBlack(mX -3*size, mY -2*size);
  makeBlack(mX -2*size, mY -2*size);
  makeBlack(mX -size, mY -2*size);
  makeBlack(mX, mY -2*size);
  makeBlack(mX +size, mY -2*size);
  makeBlack(mX +2*size, mY -2*size);

}


function spawnGliderGun() {

  initSpawn();

  mX = mX - 3*size;     // move everything 4 tiles to the left

  makeBlack(mX, mY);

  makeBlack(mX +size, mY -2*size);
  makeBlack(mX +size, mY +2*size);

  makeBlack(mX +2*size, mY);
  makeBlack(mX +2*size, mY -size);
  makeBlack(mX +2*size, mY +size);

  makeBlack(mX +3*size, mY);

  makeBlack(mX -size, mY +3*size);
  makeBlack(mX -size, mY -3*size);
  makeBlack(mX -2*size, mY +3*size);
  makeBlack(mX -2*size, mY -3*size);

  makeBlack(mX -3*size, mY -2*size);
  makeBlack(mX -3*size, mY +2*size);

  makeBlack(mX -4*size, mY +size);
  makeBlack(mX -4*size, mY);
  makeBlack(mX -4*size, mY -size);

  makeBlack(mX -13*size, mY -size);
  makeBlack(mX -13*size, mY);
  makeBlack(mX -14*size, mY -size);
  makeBlack(mX -14*size, mY);


  makeBlack(mX +6*size, mY -size);
  makeBlack(mX +6*size, mY -2*size);
  makeBlack(mX +6*size, mY -3*size);
  makeBlack(mX +7*size, mY -size);
  makeBlack(mX +7*size, mY -2*size);
  makeBlack(mX +7*size, mY -3*size);

  makeBlack(mX +8*size, mY -4*size);
  makeBlack(mX +8*size, mY);

  makeBlack(mX +10*size, mY +size);
  makeBlack(mX +10*size, mY);
  makeBlack(mX +10*size, mY -4*size);
  makeBlack(mX +10*size, mY -5*size);

  makeBlack(mX +20*size, mY -3*size);
  makeBlack(mX +20*size, mY -2*size);
  makeBlack(mX +21*size, mY -3*size);
  makeBlack(mX +21*size, mY -2*size);
}
