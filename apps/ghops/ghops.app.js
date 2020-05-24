/* TODOs


=== sytnax checker:
https://jshint.com/  
http://www.jslint.com/
https://esprima.org/demo/validate.html 
http://liveditor.com/index.php 
 
https://stackoverflow.com/questions/2120093/how-to-find-javascript-syntax-errors


=== GFX ===

https://www.andreas-rozek.de/Bangle.js/Bitmaps/index_de.html
https://www.espruino.com/Reference#l_Graphics_drawImage

=== 
https://www.andreas-rozek.de/Bangle.js/index_de.html


*/

var W = g.getWidth();
var H = g.getHeight();

var mainInterval;
var running=false;

var monitoringGPS = false;
var hasGPSSignal = false;

var curLocIsValid = false;
var curLoc_grid; // current cell
var curLoc_subgrid; // coords of location!

var newLoc_grid; // newly incoming data
var newLoc_subgrid;

var curLocation;

var imageGhost = new Uint8Array([
      0b00111100,
      0b01111110,
      0b11011011,
      0b11011011,
      0b11111111,
      0b11111111,
      0b11011011,
      0b11001001,
    ]);


// ================================================

var gridWidth = 200; // unit? degrees?
var gpsPrecisionFactor = 10000.0;

class GridCoordinates {

	constructor() {
		this.long_grid = 0; // int
		this.lat_grid  = 0; // int
	}
	
	init( long_grid_i,  lat_grid_i) { 
		this.long_grid = long_grid_i;
		this.lat_grid = lat_grid_i;
	}
	
	initFromGPS(long_gps_i, lat_gps_i) { 
       // TEST
      var lon_grid = Math.floor(long_gps_i * gpsPrecisionFactor) % gridWidth;
      var lat_grid = Math.floor(lat_gps_i  * gpsPrecisionFactor) % gridWidth;
      
	  this.long_grid = lon_grid;
	  this.lat_grid = lat_grid;
	}
  
	copyFrom( coordinates_grid) { 
		this.long_grid = coordinates_grid.long_grid;
		this.lat_grid  = coordinates_grid.lat_grid;
	}
	
	join() { 
		var joinedValue = this.lat_grid + (this.long_grid << 16); // TODO : or 32bit shift?
		return joinedValue;
	}
	
	// @returns true if coordinates are the same
	compare( other) { 
		if (other.long_grid == this.long_grid && other.lat_grid && this.lat_grid)
			return true; // same coordinates
		else
			return false;
	}
}

// ================================================

class SubgridCoordinates {

	constructor() {
		this.long_subgrid = 0; // int
		this.lat_subgrid  = 0; // int
	}
	
	init( long_subgrid_i,  lat_subgrid_i) { 
		this.long_subgrid = long_subgrid_i;
		this.lat_subgrid  = lat_subgrid_i;
	}
	
	initFromGPS( long_gps_i,  lat_gps_i) { 
       // TEST
      var lon_subgrid = Math.floor(long_gps_i * gpsPrecisionFactor);
      var lat_subgrid = Math.floor(lat_gps_i  * gpsPrecisionFactor);
      
	  this.long_subgrid = lon_subgrid;
	  this.lat_subgrid  = lat_subgrid;
	}
  
	copyFrom( coordinates_subgrid) { 
		this.long_subgrid = coordinates_subgrid.long_subgrid;
		this.lat_subgrid  = coordinates_subgrid.lat_subgrid;
	}
	
	// @returns true if coordinates are the same
	compare( other) { 
		if (other.long_subgrid == this.long_subgrid && other.lat_subgrid && this.lat_subgrid)
			return true; // same coordinates
		else
			return false;
	}
}

// ================================================

class RND {

	// from:
	// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript

	// other source: https://github.com/DomenicoDeFelice/jsrand
	
	
	constructor() {
		this.m_w = 123456789;
		this.m_z = 987654321;
		this.mask = 0xffffffff;
	}

	// Takes any integer
	setSeed(newSeed) {
		this.m_w = (123456789 + newSeed) & this.mask;
		this.m_z = (987654321 - newSeed) & this.mask;
	}

	// Returns number between 0 (inclusive) and 1.0 (exclusive),
	// just like Math.random().
	random()
	{
		this.m_z = (36969 * (this.m_z & 65535) + (this.m_z >> 16)) & this.mask;
		this.m_w = (18000 * (this.m_w & 65535) + (this.m_w >> 16)) & this.mask;
		var result = ((this.m_z << 16) + (this.m_w & 65535)) >>> 0;
		result /= 4294967296;
		return result;
	}

	randomFloat(from, to) {
		return (this.random() * (to - from) + from);
	}	
	
	randomInteger(from, to) {
		return Math.floor(this.random() * (to - from) ) + from;
	}
}

// ================================================

class Item {

	constructor() {
		this.defined = false;
		this.name = "";
		this.type = 0;
		this.value1 = 0;
		this.quantity = 1;
	}
	
	generate(seed, TODO ) { 
		RND.setSeed(seed+111);
		
	}
	
	getName() { return this.name; }
	getType() { return this.type; }
	getValue1() { return this.value1; }
	getQuantity() { return this.quantity; }
	
	// @returns true if type is the same
	compareType(other) { 
		if (this.type == other.type)
			return true;
		else
			return false;
	}
	
}

// ================================================

class Inventory {
	
	constructor() {
		this.items = []; // bad: new Array();  https://www.w3schools.com/js/js_arrays.asp
	}
	
	addItem(item) { this.items.push(item); }
	
	removeItem(item) { 
		var index = this.findIndexOf(item);
		this.items.splice(index, 1); 
	}
	
	// returns -1 if nothing is found
	findIndexOf(item) { 
		var arrayLength = this.items.length;
		for (var i = 0; i < arrayLength; i++) {
			if (this.items[i].compareType(item)) {
				return i;
			} 
		}
		
		return -1;
	}
	
	countItemOfType(item) { 
		var count = 0;
		
		var arrayLength = this.items.length;
		for (var i = 0; i < arrayLength; i++) {
			if (this.items[i].compareType(item)) {
				count++;
			} 
		}
		
		return count;
	}
}
	
// ================================================


class NPC {

	constructor() {
		this.defined = false;
		this.name = "";
		this.type = 0;
		this.health = 0;
		this.attitude = 0;
		this.holdsItem = null;
	}
	
	generate(seed, TODO ) { 
		RND.setSeed(seed+11);
		
	}
	
	getName() { return this.name; }
	getType() { return this.type; }
	getHealth() { return this.health; }
	getAttitude() { return this.attitude; }
	
	getActions(TODO) { ; }
	
	dropItem(inventory) { 
		inventory.addItem(this.holdsItem);
		this.holdsItem = null;
	}
	
	calcCombatValue(TODO) { ; }
	calcXPForWin(TODO) { ; }
	calcDamageDealtToPlayer(TODO) { ; }
}

// ================================================

const LocationType = {
  undefined: 0,
  empty: 1,
  tower: 2,
  hauntedHouse: 3
};

const LocationProbability = {
  empty: 0.2,  // 4bdg  should be higher
  tower: 0.4,
  hauntedHouse: 0.4
};

class Location {

	constructor() {
      
		this.cellCoords_grid = new GridCoordinates(); // or new GridCoordinates();
  		this.coordinates_subgrid = new SubgridCoordinates(); // or new 
      
        this.type = LocationType.undefined;
      
		this.curNPC  = null; // new NPC();
		this.curItem = null; // new Item();
		
		// constants
		
		this.maxOffset_subgrid = 30; // for point of interest
	
	}
	
	// functions
	
    deleteAll() {
      
      // needed?
        this.type = LocationType.undefined;
		this.curNPC  = null; // new NPC();
		this.curItem = null; // new Item();
    }
  
	generate(seed, coords_grid) { 
      var localSeed = seed+1;
	  RND.setSeed(localSeed);
	
      var probEmptySpace = 0.4;
      probEmptySpace = 0.2; // <<<<< 4dbg
      
      var diceForType = RND.random();
      if (diceForType <= LocationProbability.empty) {
        this.type = LocationType.empty;
      } else {
        diceForType -= LocationProbability.empty;
        
        if (diceForType <= LocationProbability.tower) {
          this.type = LocationType.tower;
        } else {
          this.type = LocationType.hauntedHouse;
        }
      }
      
     //TODO var diceForNPC = ...;
     //TODO var diceForItem = ...;
      
      // set cellCoords_grid , coordinates_subgrid
      
      this.cellCoords_grid.copyFrom(coords_grid);
      
      var rndCoords_subgrid = calcPointOfInterest_subgrid(this.cellCoords_grid, localSeed);
      this.coordinates_subgrid.copyFrom(rndCoords_subgrid);
      
      if (this.type != LocationType.empty) {
        // set optionally  NPC or item
      
        // TODO
      }
	}
  
    getDescription() {
      switch(this.type) {
             case LocationType.undefined:
             return "nothing";
             
             case LocationType.empty:
             return "nothing";
          
             case LocationType.tower:
             return "a tower";
          
             case LocationType.hauntedHouse:
             return "a haunted house";
          
             default:
             return "nothing";
      }
    }
	
	putItemHere(item) { this.curItem = item; }
	putNPCHere (npc) { this.curNPC = npc; }
	
	removeItem() { this.curItem = null; }
	removeNPC () { this.curNPC = null; }
	
	calcPointOfInterest_subgrid(coords_grid, seed) {
		RND.setSeed(seed);
		
		
		var longOffset_subgrid = RND.randomFloat(-this.maxOffset_subgrid, this.maxOffset_subgrid);
		var latOffset_subgrid  = RND.randomFloat(-this.maxOffset_subgrid, this.maxOffset_subgrid);
		
		var newCoords_subgrid = new SubgridCoordinates();
		newCoords_subgrid.long_subgrid = longOffset_subgrid + coords_grid.long_grid;
		newCoords_subgrid.lat_subgrid  = latOffset_subgrid  + coords_grid.lat_grid;
		
		return newCoords_subgrid;
	}
}



// ================================================

function initAll() {

  // called only once !

  Bangle.setLCDMode("doublebuffered");
  
  curLoc_grid = new GridCoordinates(); // current cell
  curLoc_subgrid = new SubgridCoordinates();
  newLoc_grid = new GridCoordinates();
  newLoc_subgrid = new SubgridCoordinates();


  curLocation = new Location(); // init as empty space!
  curLocation.type = LocationType.empty;
  
  showTitle();
  
  //TODO
  // create inventory
}

function enableGPS() {

    monitoringGPS = true;
    hasGPSSignal = false;
    Bangle.setGPSPower(true);
    Bangle.on('GPS', handleGPSValues);

}

function disableGPS() {

    monitoringGPS = false;
    hasGPSSignal = false;
    Bangle.removeAllListeners('GPS');
    Bangle.setGPSPower(false);

}

function handleGPSValues(gpsValueSet) {

  if (!running) {
    hasGPSSignal = false;
    return;
  }
  
  if (isNaN(gpsValueSet.lat) || isNaN(gpsValueSet.lon)) {
    hasGPSSignal = false;
    return;
  }

  newLoc_grid.initFromGPS(gpsValueSet.lon, gpsValueSet.lat);
  newLoc_subgrid.initFromGPS(gpsValueSet.lon, gpsValueSet.lat);
  
  hasGPSSignal = true;
  
  if (curLocIsValid) {
    
    if (curLoc_grid.compare(newLoc_grid)) {
      // still in the same cell
      
    } else {
      // entering new cell
      
      enteringNewCell();
    }
    
    //curLoc_grid.init();
    //curLoc_subgrid.init();
    
  } else {
  
    // entering first cell
    curLocIsValid = true;
    
    enteringNewCell();
  }
  
  displayMainScreen();
  
  /*
  showGPSValue(ValueSet.satellites, 55,5);
  showGPSValue(ValueSet.lat,   55,25);
  showGPSValue(ValueSet.lon,   55,40);
  showGPSValue(ValueSet.alt,   55,55);
  showGPSValue(ValueSet.speed, 55,70);
  showGPSValue(ValueSet.course,55,85);*/
}

function enteringNewCell() {
  
  curLoc_grid.copyFrom(newLoc_grid);
  
  // calc curLoc_subgrid
  
  curLocation = null;
  
  var cellSeed = curLoc_grid.join();
  
  curLocation = new Location();
  curLocation.generate(cellSeed, curLoc_grid);
  
  if (curLocation.type != LocationType.empty) {
    Bangle.buzz();
  }
}

function displayMainScreen() {
  g.clear();
  
  var msg;
  
  if (hasGPSSignal) {
    msg = "You see " + curLocation.getDescription() + ".";
  } else {
    msg = "-*= no signal =*-";
  }
  
  g.drawString(msg, 10, 30);
  
  
  
  g.flip();
}

function calcDistance_GPS( TODO) {
/*

https://www.movable-type.co.uk/scripts/latlong.html


	
const R = 6371e3; // metres
const Æ1 = lat1 * Math.PI/180; // Æ, » in radians
const Æ2 = lat2 * Math.PI/180;
const ”Æ = (lat2-lat1) * Math.PI/180;
const ”» = (lon2-lon1) * Math.PI/180;

const a = Math.sin(”Æ/2) * Math.sin(”Æ/2) +
          Math.cos(Æ1) * Math.cos(Æ2) *
          Math.sin(”»/2) * Math.sin(”»/2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

const d = R * c; // in metres
*/
}

function gameOver() {
  
  g.clear();
  
  clearInterval(mainInterval);
  mainInterval = undefined;
  
  disabledGPS();
  
  g.setColor(1,1,1);

  g.setColor(1,1,1);
  g.setFont("6x8", 2);

  g.drawString("GAME OVER", 10, 20);
  
  setTimeout(gameOver2, 3*1000);
  
  g.flip();
}

function gameOver2() {
  showTitle();
}

// ==========================================

function mainLoop() {
  
  //g.clear();
  
  // check for game over
  if (running == false) {
    
      gameOver();
      return;
      
  }

  displayMainScreen();
  
  //? g.setFontAlign(0,0); // center font
  
  //g.drawString("loop", 30,30);
  // ======
  
  //g.flip();
}

// ==========================================


// returns the SQUARED distance !! to make calculations faster
function calcDistance(x1, y1, x2, y2) {

  var squaredDistance;

  var diffX = x2 - x1;
  var diffY = y2 - y1;
  
  squaredDistance = diffX * diffX + diffY * diffY;
  //OLD distance = Math.sqrt(squaredDistance);
  
  return squaredDistance;
}

function startGame1() {
  
  if (!mainInterval)
  {
    enableGPS();
   
    g.clear();
    
    g.setColor(1,1,1);
    g.setFont("6x8", 2);
  
    g.drawString("Walk towards\n the light", 40, 30);
    
    g.flip();
    
    curLocIsValid = false;
    
    setTimeout(startGame2, 1000);
    
    
  }
}

function startGame2() {
  
  running = true;
  
  mainInterval = setInterval(mainLoop, 500); // TODO: freq?
   
  g.setColor(1,1,1);
  g.setFont("6x8", 2);
  
  /*
  setWatch(flyUp, BTN1, { repeat: true });
  setWatch(fireLaser, BTN2, { repeat: true });
  setWatch(flyDown, BTN3, { repeat: true });
  */
}

function showTitle() {
  
  g.clear();
  
  running = false;
  
  g.setColor(1,1,1);
  g.setFont("6x8", 2);
  
  g.drawString("Ghops", W/2-30, 5);
  g.drawString("Press 1 to start\n\nWritten by n-o-d\n     and MR", 10, 40);
  
  setWatch(startGame1, BTN1);
  
  g.flip();
}

initAll();


// ########################

