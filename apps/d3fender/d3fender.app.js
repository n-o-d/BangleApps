/* TODOs
laser color: red
enemy laser shots
collision detection / response
add score
add beep()

=== sytnax checker:
https://jshint.com/  
http://www.jslint.com/
https://esprima.org/demo/validate.html 
http://liveditor.com/index.php 
 
https://stackoverflow.com/questions/2120093/how-to-find-javascript-syntax-errors

*/

var curScore = 0;
var hiScore = 0;
var mainInterval;
var runnging=false;
var shipIsExploding=false;
var shipExpAnimLength = 20;
var shipExplosionCounter = shipExpAnimLength;

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
      0b11000000,
    ]);

var enemyImage = new Uint8Array([
      0b00011110,
      0b00111000,
      0b01110001,
      0b11111111,
      0b11111111,
      0b01110001,
      0b00111000,
      0b00011110,
    ]);
var enemyDrawing = 0; // 0 := use lines&circle;  1 := use bitmap

var mountains = new Array(0, 0);
var numPeaks = 4;
var mountainWidth = W / numPeaks;
numPeaks += 2;
var peakOffset = 0;
var mountainStep = mountainWidth / 4; // horizontal movement value per frame
var firstPeak = 0; // index into mountains array

var maxShots = 4;
var shots;
var enemyShots;
var shotsStep = 16; // horizontal movement per frame
var maxHitDistance_sqr = 16*16; // TODO : Test

var maxEnemies = 2;
var enemies;
var enemyStep_x = 4; // movement per frame
var enemyStep_y = 6; // movement per frame
var shootingPause = 6;
var moveInterval = 10;
var expAnimLength = 10;
var enemyShotStep = 16;// movement per frame
var maxHitDistanceToPlayer_sqr = 8*8; // TODO


// ================================================

function initAll() {

  // called only once !
  
  // expand array - TODO : better way?
  for (var i = 1; i < numPeaks; i++) {
    mountains.push(i);
    mountains.push(0);
  }

  shots = new Array(maxShots);
  for ( i = 0; i < maxShots; i++) {
    var aShot = { x: 0, y: 0, active: false};
    shots[i] = aShot;
  }

  enemies = new Array(maxEnemies);
  enemyShots = new Array(maxEnemies);
  for ( i = 0; i < maxEnemies; i++) {
    var anEnemy = { x: 0, y: 0, 
                   active: false, 
                   shootingCounter: shootingPause , 
                   moveCounter: 5, 
                   direction: 0,
                   isExploding : false};
    enemies[i] = anEnemy;
    
    var aShot = { x: 0, y: 0, active: false};
    enemyShots[i] = aShot;
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
  
  g.setColor(1,1,1);
  E.showMessage("GAME OVER", "");
  
  var msgScore = "Final score: " + curScore.toString();
  g.drawString(msgScore, W/2, 3*(H/4)-20);
  
  if (curScore > hiScore) {
    hiScore = curScore;
    g.drawString("New Hi Score!", W/2, H-20);
  }
  
  setTimeout(gameOver2, 3*1000);
}

function gameOver2() {
  showTitle();
}

// ==========================================
function mainLoop() {
  
  g.clear();
  
  // check for game over
  if (runnging == false) {
    
    if (shipIsExploding) {
      
      if (shipExplosionCounter-- <= 0) {      
          shipIsExploding = false;
      } else {
      
        // draw explosion
        var ll = shipExpAnimLength - shipExplosionCounter + 3;
        ll *= 2;
        var ss = ll - 16;
        if (ss < 0)
          ss = 0;
        
        var x = ship.x;
        var y = ship.y;
        
        g.setColor(1,1,1);
        
        g.drawLine(x-ss, y-ss,
                   x-ll, y-ll);
        g.drawLine(x+ss, y-ss,
                   x+ll, y-ll);
        g.drawLine(x, y+ss,
                   x, y+ll);
        g.drawLine(x+ss, y,
                   x+ll, y);
        
        g.drawLine(x-ss, y+ss,
                   x-ll, y+ll);
        g.drawLine(x+ss, y+ss,
                   x+ll, y+ll);
        g.drawLine(x, y-ss,
                   x, y-ll);
        g.drawLine(x-ss, y,
                   x-ll, y);
      }
      

    } else {
    
      gameOver();
      return;
      
    }
    
  }

  g.setFontAlign(0,0); // center font
  
  msgScore = "score: " + curScore.toString();
  
  g.setColor(1,1,1);
  g.drawString(msgScore, 60, 20);
  
  if (!shipIsExploding) { 
    g.setColor(0.5, 0.5, 1);
    g.drawImage(shipImage, ship.x, ship.y /*, options*/);
  }
  
  animateBackground();
  animateShots();
  runCollisionDetection();
  animateEnemies();
  runCollisionDetection();
  animateEnemyShots();
  
  if (!shipIsExploding)
    spawnEnemies();

  // ======
  
  g.flip();
}
// ==========================================

function shiphasBeenHit() {

  runnging = false;
  shipIsExploding = true;
  
  Bangle.buzz();
  
}

function animateEnemies() {
  
  var radius = 8;
  
  for (var i = 0; i < maxEnemies; i++) {
    if (enemies[i].active) {
      
      // moving
      
      // always forward
      enemies[i].x -= enemyStep_x;
      enemies[i].x -= Math.random() * enemyStep_x; // sudden leaps
      
      enemies[i].moveCounter -= 1;
      if (enemies[i].moveCounter <= 0) {
        enemies[i].moveCounter = moveInterval; // TODO Math.random() * ;
        
        enemies[i].direction = Math.random() * 3;
      }
      
      if (enemies[i].direction < 1) {
          // up  & forward
          enemies[i].y -= enemyStep_y;
          if (enemies[i].y < 30)
            enemies[i].y = 30;
      } else if (enemies[i].direction >= 2) {
          // down & forward
          enemies[i].y += enemyStep_y;
          if (enemies[i].y > H-30)
            enemies[i].y = H-30;
      } // else : only forward
        
      if (enemies[i].x < 1) {
        // remove
        enemies[i].active = false;
        
      }
    } // if (enemies[i].active) 
      
    if (enemies[i].active) {
        
      // draw
      
      g.setColor(1,0.3,0.3);
      if (enemyDrawing == 0) {
        
        g.drawCircle(enemies[i].x, enemies[i].y, radius);
        g.drawLine(enemies[i].x - radius*1.5, enemies[i].y-3, enemies[i].x, enemies[i].y-3);
        g.drawLine(enemies[i].x - radius*1.5, enemies[i].y+3, enemies[i].x, enemies[i].y+3);
        
      } else {
      
        g.drawImage(enemyImage, enemies[i].x, enemies[i].y /*, options*/);
        
      }
      
      // collision detection with player's ship
        
      var distance = calcDistance(enemies[i].x, enemies[i].y, ship.x, ship.y);
      if (distance <= maxHitDistanceToPlayer_sqr) {
          
        // KAWOOOMM
        shiphasBeenHit();
          
      }
      
      // shooting
      enemies[i].shootingCounter--;
      if (enemies[i].shootingCounter <= 0) {
        enemies[i].shootingCounter = shootingPause;
        
        if (!enemyShots[i].active) {
          // fire enemy shot
          enemyShots[i].active = true;
          enemyShots[i].x = enemies[i].x - radius;
          enemyShots[i].y = enemies[i].y;
        }
      }
    } // if (enemies[i].active) 
    else if (enemies[i].isExploding)
    {
      if (enemies[i].moveCounter-- > 0) {
     
        var ll = expAnimLength - enemies[i].moveCounter + 2;
        var ss = expAnimLength - enemies[i].moveCounter - 2;
        if (ss < 0)
          ss = 0;
        
        g.setColor(1,0,0);
        g.drawLine(enemies[i].x-ss, enemies[i].y-ss,
                   enemies[i].x-ll, enemies[i].y-ll);
        g.drawLine(enemies[i].x+ss, enemies[i].y-ss,
                   enemies[i].x+ll, enemies[i].y-ll);
        g.drawLine(enemies[i].x, enemies[i].y+ss,
                   enemies[i].x, enemies[i].y+ll);
        
      } else {
        
        enemies[i].isExploding = false;
        
      }
    }
    
  } // for (var i = 0; i < maxEnemies; i++) 
  
}

function animateEnemyShots() {

  g.setColor(1,1,1);
  
  for (var i = 0; i < maxEnemies; i++) {
    if (enemyShots[i].active) {
      
      enemyShots[i].x -= enemyShotStep;
      if (enemyShots[i].x <= 0) {
        
        enemyShots[i].active = false;
        
      } else {
      
        g.drawLine(enemyShots[i].x, enemyShots[i].y, enemyShots[i].x-5, enemyShots[i].y);
      
        // collision detection with player's ship
        
        var distance = calcDistance(enemyShots[i].x, enemyShots[i].y, ship.x, ship.y);
        if (distance < maxHitDistanceToPlayer_sqr) {
          
          // KAWOOOMM
          shiphasBeenHit();
          
        }
      }
      
    } // if (enemyShots[i].active)
  } // for (var i = 0; i < maxEnemies; i++)
  
}

function animateShots() {

  g.setColor(1,0,0);
  
  for (var i = 0; i < maxShots; i++) {
    if (shots[i].active) {
      
      shots[i].x += shotsStep;
      
      g.drawLine(shots[i].x, shots[i].y, shots[i].x-8, shots[i].y);
      
      if (shots[i].x > W) {
        shots[i].active = false;
      } 
      
    } // if (shots[i].active)
  } // for (var i = 0; i < maxShots; i++)

}

function runCollisionDetection() {
  
  for (var i = 0; i < maxShots; i++) {
    if (shots[i].active) {
    
        for (var ee = 0; ee < maxEnemies; ee++) {
          if (enemies[ee].active) {
            
            // calc distance of laser shot to enemy
            var distance = calcDistance(shots[i].x, shots[i].y, enemies[ee].x, enemies[ee].y);
            
            var isEnemyHit = false;
            
            // 4dbg
            //var msg = "dist: " + distance.toString() + " max: " + maxHitDistance_sqr.toString();
            //console.log(msg);
            
            if (distance <= maxHitDistance_sqr) {
              isEnemyHit = true;
            } else {
              distance = calcDistance(shots[i].x - maxHitDistance_sqr, shots[i].y, enemies[ee].x, enemies[ee].y);
              if (distance <= maxHitDistance_sqr) {
                isEnemyHit = true;
              }
            }
            
            if (isEnemyHit) {
              
              Bangle.buzz();
              shots[i].active = false;
              
              enemies[ee].active = false;
              enemies[ee].isExploding = true;
              enemies[ee].moveCounter = expAnimLength;
              curScore += 10;
              
            }
            
          } // if (enemies[ee].active)
        } // for (var ee = 0; ee < maxEnemies; ee++)
      
    } // if (shots[i].active)
  } // for (var i = 0; i < maxShots; i++)
  
}

function spawnEnemies() {
  
        for (var ee = 0; ee < maxEnemies; ee++) {
          if (!enemies[ee].active &&
              !enemies[ee].isExploding) {
            
              // spawn immediately
            
              enemies[ee].active = true;
              enemies[ee].x = W;
              enemies[ee].y = H/2;
              enemies[ee].shootingCounter = 2;
              enemies[ee].moveCounter = 1 + ee*5;
              
          } // if (enemies[ee].active)
        } // for (var ee = 0; ee < maxEnemies; ee++)
      
}

// returns the SQUARED distance !! to make calculations faster
function calcDistance(x1, y1, x2, y2) {

  var squaredDistance;

  var diffX = x2 - x1;
  var diffY = y2 - y1;
  
  squaredDistance = diffX * diffX + diffY * diffY;
  //OLD distance = Math.sqrt(squaredDistance);
  
  return squaredDistance;
}

function animateBackground() {

  g.setColor(0.7,0,0.7);
  
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
    
    // move peaks in mountains array
    // => move only height-values!
    for ( i = 0; i < num;) {
      i++;
      mountains[i] = mountains[(i+2)%num];
      i++;
    }
    
    mountains[num-1] = (H - Math.random() * (H/4));
  }
}

function flyUp() {
  
  if (!shipIsExploding) {
    
    ship.y = ship.y - 10;
    if (ship.y < 20)
      ship.y = 20;
  
  } 
  
}

function flyDown() {
  
  if (!shipIsExploding) {
  
    ship.y = ship.y + 10;
    if (ship.y > H-20)
      ship.y = H-20;
    
  }
  
}

function fireLaser() {

  if (!shipIsExploding) {
  
    for (var i = 0; i < maxShots; i++) {
    
      if (shots[i].active == false) {
        // found a free slot
        shots[i].active = true;
        shots[i].x = ship.x + shotsStep;
        shots[i].y = ship.y + 4;

        break;
      }
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
    
    enemyImage = {width: 8, height: 8, buffer: enemyImage.buffer};
    
    ship = { x:40,y:H/2,shootsFired:0,isHit:false };
    
    curScore = 0;
    
    peakOffset = 0;
    
    generateMountains();
    
    for (var i = 0; i < maxShots; i++) {
      shots[i].active = false;
    }

    for ( i = 0; i < maxEnemies; i++) {
      enemies[i].active = false;
      enemyShots[i].active = false;
    }
    
    shipIsExploding = false;
    shipExplosionCounter = shipExpAnimLength;
  }
}

function startGame2() {
  runnging = true;
  
  mainInterval = setInterval(mainLoop, 300);
  
  setWatch(flyUp, BTN1, { repeat: true });
  setWatch(fireLaser, BTN2, { repeat: true });
  setWatch(flyDown, BTN3, { repeat: true });
}

function showTitle() {
  runnging = false;
  E.showMessage("Press 1 to start\n\nWritten by n-o-d", "D3fender");
  
  var msgScore = "Hi score: " + hiScore.toString();
  
  g.setColor(1,1,1);
  g.drawString(msgScore, W/2,H-50);
  
  setWatch(startGame1, BTN1);
}

initAll();


// ########################


/* DOKU

=== GFX ===

https://www.andreas-rozek.de/Bangle.js/Bitmaps/index_de.html
https://www.espruino.com/Reference#l_Graphics_drawImage

=== 
https://www.andreas-rozek.de/Bangle.js/index_de.html


*/