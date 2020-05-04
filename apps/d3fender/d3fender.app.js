var curScore = 0;
var mainInterval;
var runnging=false;

var W = g.getWidth();
var H = g.getHeight();


var ship = {};
var shipImage = new Uint8Array([
      0b11000000,
      0b11100000,
      0b11111100,
      0b11111111,
      0b11111111,
      0b11100000,
      0b11000000,
      0b10000000,
    ]);


var mountains = new Array(0, 0);
var numPeaks = 4;
var mountainWidth = W / numPeaks;
numPeaks += 2;

var peakOffset = 0;
var mountainStep = mountainWidth / 4; // horizontal movement value per frame
var firstPeak = 0; // index into mountains array


var maxShots = 3;
var shots;
var shotsStep = 8; // horizontal movement per frame
var DBG_shots = 0;


function initAll() {

  // called only once !
  
  // expand array - TODO : better way?
  for (var i = 1; i < numPeaks; i++) {
    mountains.push(i);
    mountains.push(0);
  }

  var oneShot = { x: 0, y: 0, active: false};
  shots = new Array(oneShot);
  for (var i = 1; i < maxShots; i++) {
    shots.push(oneShot);
  }

  showTitle();
}

function generateMountains() {

  var x = 0;
  var num = mountains.length;
  
  for (var i = 0; i < num; ) {
    mountains[i++] = x;
    mountains[i++] = (H - Math.random() * (H/4));
    
    x += mountainWidth;
  }
}
                     
function gameOver() {
  clearInterval(mainInterval);
  mainInterval = undefined;
  
  Bangle.buzz();
  
  E.showMessage("GAME OVER", "");
  setTimeout(gameOver2, 3*1000);
}

function gameOver2() {
  showTitle();
}

function mainLoop() {
  
  // check for game over
  if (runnging == false) {
    gameOver();
    return;
  }

  g.clear();
  g.setFontAlign(0,0); // center font
  
  msgScore = "score: 0"; // TODO
  
  g.drawString(msgScore, 50, 20);
  
  g.drawImage(shipImage, ship.x, ship.y /*, options*/);
  
  drawBackground();
  drawShots();
  
  g.flip();
}

function drawShots() {

  for (var i = 0; i < maxShots; i++) {
    if (shots[i].active) {
      g.drawLine(shots[i].x, shots[i].y, shots[i].x-8, shots[i].y);
      
      shots[i].x += shotsStep;
      
      if (shots[i].x > W) {
        shots[i].active = false;
        
        DBG_shots--;
      }
    }
  }
  
}

function drawBackground() {

  g.setColor(1, 1, 1);
  
  var x1 = mountains[firstPeak] + peakOffset;
  var y1 = mountains[firstPeak+1];
  var x2 = 0;
  var y2 = 0;
  
  var num = mountains.length;
  for (var i = 2; i < num;) {

    x2 = mountains[ (firstPeak + i) % num ] + peakOffset;
    i++;
    y2 = mountains[ (firstPeak + i) % num ];
    i++;
    
    g.drawLine(x1, y1, x2, y2);

    x1 = x2;
    y1 = y2;
  }
  
  peakOffset -= mountainStep;
  if (peakOffset <= -mountainWidth) {
    peakOffset = 0;
    // ?? needed??? firstPeak = (firstPeak + 2) % num;
    
    // move peaks in mountains array
    // => move only height-values!
    for (var i = 0; i < num;) {
      //mountains[i] = mountains[(i+2)%num];
      i++;
      mountains[i] = mountains[(i+2)%num];
      i++;
    }
    
    //mountains[num-2] = mountainWidth * ;
    mountains[num-1] = (H - Math.random() * (H/4));
  }
}

function flyUp() {
  ship.y = ship.y - 10;
  if (ship.y < 20)
    ship.y = 20;
}

function flyDown() {
  ship.y = ship.y + 10;
  if (ship.y > H-20)
    ship.y = H-20;
}

function fireLaser() {

  //g.drawString("TESTFIRE", W/2, H-50);
  
  for (var i = 0; i < maxShots; i++) {
    if (shots[i].active == false) {
      // found a free slot
      shots[i].active = true;
      shots[i].x = ship.x + shotsStep;
      shots[i].y = ship.y + 4;
      
      DBG_shots++;
      //g.drawString("FIRE", 50, H-50*DBG_shots);
      break;
    }
  }
}

function startGame1() {
  
  if (!mainInterval)
  {
    E.showMessage("Ready Player 1", "");
    setTimeout(startGame2, 1000);
    
    
    // An object with the following fields
    /*
    { width : int, height : int, 
    bpp : optional int, 
    buffer : ArrayBuffer/String, 
    transparent: optional int, 
    palette : optional Uint16Array(2/4/16) }
    */
    shipImage = {width: 8, height: 8, buffer: shipImage.buffer};
    
    ship = { x:40,y:H/2,shootsFired:0,isHit:false };
    
    peakOffset = 0;
    
    generateMountains();
  }
}

function startGame2() {
  runnging = true;
  
  mainInterval = setInterval(mainLoop, 500);
  
  setWatch(flyUp, BTN1, { repeat: true });
  setWatch(fireLaser, BTN2, { repeat: true });
  setWatch(flyDown, BTN3, { repeat: true });
}

function showTitle() {
  runnging = false;
  E.showMessage("Press 1 to start", "D3fender");
  setWatch(startGame1, BTN1);
}

initAll();


// ########################

function debugEnd() {
  runnging=false;
}


/* DOKU

=== GFX ===

https://www.andreas-rozek.de/Bangle.js/Bitmaps/index_de.html
https://www.espruino.com/Reference#l_Graphics_drawImage

=== 
https://www.andreas-rozek.de/Bangle.js/index_de.html


*/