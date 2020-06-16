/* 

GHOPS

modified: 2020-06-16


=== TODOs

O  dropItemFromInventory


===
4dbg means 'for debugging' - can be removed for the release version

https://github.com/n-o-d/BangleApps/tree/master/apps/ghops


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

var useFakeGPS = true; // 4dbg set to true
var createFakeGPSOnlyOnce = 0; // 4dbg


var W = g.getWidth();
var H = g.getHeight();

var mainInterval;
var running=false;

var monitoringGPS = false;
var hasGPSSignal = false;

var curLocIsValid = false; // whether the values in curLoc_grid are valid
var curLoc_grid; // current cell
var curLoc_subgrid; // coords of location!

var newLoc_grid; // newly incoming data
var newLoc_subgrid;

var curLong_gps; // last measured GPS coordinates; only valid if hasGPSSignal is true
var curLat_gps;

var curLocation; // Location object
var inv; // Inventory object

var actionStack = []; // last action is exeuted in mainLoop; type: Action or subclass
var btnActionMap = []; // array size max is 3 - which actions are currently mapped on the BTNs

var coming1stTimeToAction = false;
var comingBackToAction = false;

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

var gridWidth = 40; //4dbg  - use 100
//unit? degrees? mircominiarcsecondsw WTF?
// 10 = 1m ???
var locationVisibilityRange = gridWidth/3; // unit: subgrid?
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
      var lon_grid = Math.floor(long_gps_i * gpsPrecisionFactor) / gridWidth;
      var lat_grid = Math.floor(lat_gps_i  * gpsPrecisionFactor) / gridWidth;
      
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
		if (other.long_grid == this.long_grid && 
            other.lat_grid  == this.lat_grid)
			return true; // same coordinates
		else
			return false;
	}
  
    toString() {
      var s = this.long_grid.toString() + " " + this.lat_grid.toString();
      return s;
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
      var lon_subgrid = Math.floor(long_gps_i * gpsPrecisionFactor) % gridWidth;
      var lat_subgrid = Math.floor(lat_gps_i  * gpsPrecisionFactor) % gridWidth;
      
	  this.long_subgrid = lon_subgrid;
	  this.lat_subgrid  = lat_subgrid;
	}
  
	copyFrom( coordinates_subgrid) { 
		this.long_subgrid = coordinates_subgrid.long_subgrid;
		this.lat_subgrid  = coordinates_subgrid.lat_subgrid;
	}
	
	// @returns true if coordinates are the same
	compare( other) { 
		if (other.long_subgrid == this.long_subgrid &&
            other.lat_subgrid  == this.lat_subgrid)
			return true; // same coordinates
		else
			return false;
	}
  
    toString() {
      var s = this.long_subgrid.toString() + " " + this.lat_subgrid.toString();
      return s;
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

const ItemType = {
  undefined: 0,
  ghopFood : 1,
  psyEnergyCell: 2
};
  
class Action {
  
  constructor(name, GUIName, action) {
    this.actionName = name; // internal ID
    this.actionGUIName = GUIName; //  shown in UI
    this.actionFunction = action;
  }
  
  getName() { return this.actionName; }
  getGUIName() { return this.actionGUIName; }
  getFunction() { this.actionFunction; }
  
  execute() { 
    if (this.actionFunction != null) { 
        this.actionFunction(); 
    }
  }
}

class ItemAction extends Action {
  
  constructor(item, name, GUIName, action) {
    
    super(name, GUIName, action);
    
    this.targetItem = item; // always first parameter of actionFunction
  }
  
  execute() { this.actionFunction(this.targetItem); }
}

class MenuAction extends Action { // NEEDED ???
  
  constructor(name, GUIName, action) {

    super(name, GUIName, action);
    
  }
  
}

// ================================================

// take item which lies at the current location
function takeItemFromLocation(item) {
  
  if (!coming1stTimeToAction && !comingBackToAction)
    return;
      
  g.clear(); 
  
  var collectedActions = []; // type: Action or subclass
  
  collectedActionsIndexShown = 0;
     
  // draw content...
  
  var msg = "";
  
  if (curLocation.isItemPresent()) {
      
    var numItemsInInv = inv.items.length;
    if (inv.items.length >= inv.getMaxNumItems()) {
      msg = "Cannot take.\nInventory is full.";
    } else {
      
      var presentItem = curLocation.getItem();

      msg = "I took the ";
      if (presentItem.getQuantity() > 1) {
        msg += presentItem.getQuantity()+ " " + presentItem.getNamePlural();
      } else {
        msg += presentItem.getName();
      }
      msg += ".\n\n";
      msg += presentItem.getDescription() + "\n";

      inv.addItem(presentItem);
      curLocation.removeItem(presentItem);
    }

    
  } else {
    // should never happen
    msg = "There's is nothing here.\n";
  }
  
  g.drawString(msg, 5 , 30)

  // fill collectedActions...
  var backAction = new Action("AID_back", "back", returnFromAction); 
  collectedActions.push(backAction);
    
  mapActionsToButtons(collectedActions, collectedActionsIndexShown);
  displayCurButtonActions();
  
  g.flip();
}

// ================================================

function examineItem(item) {
  
  if (!coming1stTimeToAction && !comingBackToAction)
    return;
      
  g.clear(); 
  
  var collectedActions = []; // type: Action or subclass
  
  collectedActionsIndexShown = 0;
     
  // draw content...
  
  var msg = "";
  
  if (curLocation.isItemPresent()) {
      
    var presentItem = curLocation.getItem();
  
    msg = presentItem.getDescription() + "\n";
  }

  g.drawString(msg, 5 , 30)

  // fill collectedActions...
  var backAction = new Action("AID_back", "back", returnFromAction); 
  collectedActions.push(backAction);
    
  mapActionsToButtons(collectedActions, collectedActionsIndexShown);
  displayCurButtonActions();
  
  g.flip();
}

// ================================================

function dropItemFromInventory(item) {
  
  if (!coming1stTimeToAction && !comingBackToAction)
    return;
      
  g.clear(); 
  
  var collectedActions = []; // type: Action or subclass
  
  collectedActionsIndexShown = 0;
  
  var msg = "";

  // check item
  if (!inv.contains(item)) {
    
    msg = "Invalid item.";
    
  } else {

    var destroyItem = false;

    if (curLocation == null || curLocation.getType() == LocationType.empty) {

      destroyItem = true;

    } else {

      if (curLocation.isItemPresent()) {

        // place is taken - just destroy item in inv
        destroyItem = true;

      } else {
        // drop to current location
        destroyItem = false;
      }
    }

    if (destroyItem) {
      // TODO : confirm by player?

      if (item.getQuantity() > 1) {
        msg += item.getQuantity()+ " " + item.getNamePlural() + "\nwere destroyed.";
      
      } else {
        msg += item.getName() + "\nwas destroyed.";
      }
      
      inv.removeItem();
      
      // TODO: delete item;

    } else {

      // drop to current location

      if (item.getQuantity() > 1) {
        msg += item.getQuantity()+ " " + item.getNamePlural() + "\nwere dropped.";
      
      } else {
        msg += item.getName() + "\nwas dropped.";
      }
    }

    var numItemsInInv = inv.items.length;
    if (numItemsInInv == 0) {
      msg = "\nInventory is now empty.";
    }
  }
    
  g.drawString(msg, 5 , 30)

  // fill collectedActions...
  var backAction = new Action("AID_back", "back", returnFromAction); 
  collectedActions.push(backAction);
    
  mapActionsToButtons(collectedActions, collectedActionsIndexShown);
  displayCurButtonActions();
  
  g.flip();
}

// ================================================

function showItem(item) {
  
  if (!coming1stTimeToAction && !comingBackToAction)
    return;
      
  g.clear();
  
  var collectedActions = []; // type: Action or subclass
  collectedActionsIndexShown = 0;
  
  // draw content...
  var num = item.getQuantity();
  if (num == 1) {
    msg += item.getName():
  } else {
    msg += num.toString() + " " + item.getNamePlural();
  }
  msg += "\n";
  msg += item.getDescription() + "\n";
  
  // fill collectedActions...
  
  var backAction = new Action("AID_back", "back", returnFromAction);
  collectedActions.push(backAction);

  var inInvActions = item.getActionsInInv();
  
  for (var aa = 0; aa < inInvActions.length; aa++) {

    var anAction = inInvActions[aa];
    collectedActions.push(anAction);

  }
  
  mapActionsToButtons(collectedActions, collectedActionsIndexShown);
  displayCurButtonActions();
  
  g.flip();
}

// ================================================

function selectNextItem() {
  
  inventorySelectedItem++;
  if (inventorySelectedItem >= inv.items.length)
      inventorySelectedItem = 0;
      
  actionStack.pop(); // pops this action
  comingBackToAction = true;
}

// ================================================

function returnFromAction() {
  
  console.log("<< returnFromAction - #actionStack: " + actionStack.length.toString());
  
  actionStack.pop(); // pops this action
  actionStack.pop(); // pops the action which wants to go back
  comingBackToAction = true;
}

// ================================================

function nop() {
  
  actionStack.pop(); // pops this action
  //comingBackToAction = true;
}

// ================================================

function showInventory() {
    
  if (!coming1stTimeToAction && !comingBackToAction)
    return;
      
  g.clear(); 
  
  if (coming1stTimeToAction) {
    if (inv.items.length == 0)
      inventorySelectedItem = -1;
    else
      inventorySelectedItem = 0;
  }
  var selectedItem = null;
  
  
  var collectedActions = []; // type: Action or subclass
  
  collectedActionsIndexShown = 0;
  
  // draw content...
  
  g.drawString("Inventory:\n", 5 , 5);
  
  var msg = "";
  
  if (inv.items.length == 0) {
    msg += "is empty";
  } else {
  
    for (var ii = 0; ii < inv.items.length; ii++) {
      var curItem = inv.items[ii];
      if (curItem != null) {
        
        if (ii == inventorySelectedItem) {
          msg += "> ";
          selectedItem = curItem;
        } else {
          msg += "  ";
        }
        
        var num = curItem.getQuantity();
        if (num == 1) {
          msg += curItem.getName() + "\n";
        } else {
          msg += num.toString() + " " + curItem.getNamePlural() + "\n";
        }
      }
      // TODO: handle displaying many items on several pages
    } // for (var ii = 0; ii < inv.items.length; ii++) 
  }
  
  g.drawString(msg, 5 , 25);
    
  // fill collectedActions...
  
  //var noAction = new Action("AID_nop", "", nop); // just keep this slot taken
  var backAction = new Action("AID_back", "back", returnFromAction); 
  var showItemAction = new ItemAction(selectedItem, "AID_showItem", "show", showItem);
  var selectNextItemAction = new Action("AID_nextItem", "next", selectNextItem); 
  
  collectedActions.push(backAction);
  if (inv.items.length == 0) {
    //collectedActions.push(noAction);
    //collectedActions.push(noAction);
  } else if (inv.items.length == 1) {
    collectedActions.push(showItemAction);
  } else {
    collectedActions.push(showItemAction);
    collectedActions.push(selectNextItemAction);
  }
    
  mapActionsToButtons(collectedActions, collectedActionsIndexShown);
  displayCurButtonActions();
  
  g.flip();
}

// ================================================

class Item {

	constructor() {
		this.defined = false;
		this.name = "";
		this.namePlural = "";
		this.description = "";
		this.type = 0; // see ItemType
		this.value1 = 0;
		this.quantity = 1;
      
        this.actionsAtLoc = []; // array of ItemActions
      // valid while the item lies at a location
      
        this.actionsInInv = []; // array of ItemActions
      // vaid while the item is in the inventory
	}
	
	generate(seed /*, TODO*/ ) { 
		var rnd = new RND(); 
        rnd.setSeed(seed+111);
		
      
        console.log("Item::generating");
        // 4dbg
      
		this.defined = true;
		this.name = "Ghop food";
		this.namePlural = "Ghop foods";
		this.description = "Wanted by ghops!";
		this.type = ItemType.ghopFood;
      
        // These actions are valid when the item is found.
        var takeAction = new ItemAction(this, "AID_take", "take", takeItemFromLocation);
        this.actionsAtLoc.push(takeAction);
      
        var examineAction = new ItemAction(this, "AID_examine", "examine", examineItem);
        this.actionsAtLoc.push(examineAction);
      
        var dropAction = new ItemAction(this, "AID_drop", "drop", dropItemFromInventory);
        this.actionsInInv.push(dropAction);
      
        this.actionsInInv.push(examineAction);
      
        // TODO: use action
      
      
      //4dbg
      console.log("  Item:#actLoc: " + this.actionsAtLoc.length.toString());
	}
	
    isDefined() { return this.defined; }
	getName() { return this.name; }
	getNamePlural() { return this.namePlural; }
    getDescription() { return this.description; }
	getType() { return this.type; }
	getValue1() { return this.value1; }
	getQuantity() { return this.quantity; }
  
	getActionsAtLoc() { return this.actionsAtLoc; }
	getActionsInInv() { return this.actionsInInv; }
  
	deleteAllActions() { 
      for (var aa3 = this.actionsAtLoc.length-1; aa3 >= 0; aa3--) { this.actionsAtLoc.pop(); }
      for (var aa3 = this.actionsInInv.length-1; aa3 >= 0; aa3--) { this.actionsInInv.pop(); }
    }
	
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
	
	addItem(item) {
      
      this.items.push(item); 
    }
	
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
	
	// returns false if nothing is found
	contains(item) { 
		var i = this.findIndexOf(item);
        if (i != -1)
		  return true;
        else
          return false;
	}
	
	// returns an item or null if index is invalid
	getItemAtIndex(index) {
		var arrayLength = this.items.length;
		if (index >= 0 && index < arrayLength) {
		  return this.items[index];
		} else {
          return null;
        }
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
  
    getMaxNumItems() {
      return 5; // TODO <<<<<<<<<<<<<<<<
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
		var rnd = new RND(); 
        rnd.setSeed(seed+11);
		
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
  empty: 0.2,  // 4dbg - TODO:  should be higher
  tower: 0.4,
  hauntedHouse: 0.4,
  
  itemPresent: 0.3,
  NPCPresent: 0.2
};

class Location {

	constructor() {
      
		this.cellCoords_grid = new GridCoordinates(); // or new GridCoordinates();
  		this.coordinates_subgrid = new SubgridCoordinates(); // or new 
      
        this.type = LocationType.undefined;
      
		this.curNPC  = null; // new NPC();
		this.curItem = null; // new Item();
		
        this.actions = []; //array of Action's
      
		// constants
		
		this.maxOffset_subgrid = 1; // for point of interest
	
	}
	
	// functions
	
    getType() { return this.type; }
  
    deleteAll() {
      
      // needed?
        this.type = LocationType.undefined;
		this.curNPC  = null; // new NPC();
		this.curItem = null; // new Item();
        for (var aa3 = this.actions.length-1; aa3 >= 0; aa3--) { this.actions.pop(); }
    }
  
	calcPointOfInterest_subgrid(coords_grid, seed) {
	    var rnd = new RND(); 
        rnd.setSeed(seed);

		
		
		var longOffset_subgrid = rnd.randomFloat(-this.maxOffset_subgrid, this.maxOffset_subgrid);
		var latOffset_subgrid  = rnd.randomFloat(-this.maxOffset_subgrid, this.maxOffset_subgrid);
		
		var newCoords_subgrid = new SubgridCoordinates();
		newCoords_subgrid.long_subgrid = longOffset_subgrid + coords_grid.long_grid;
		newCoords_subgrid.lat_subgrid  = latOffset_subgrid  + coords_grid.lat_grid;
		
		return newCoords_subgrid;
	}
  
	generate(seed, coords_grid) { 
      var localSeed = seed+1;
	  var rnd = new RND(); 
      rnd.setSeed(localSeed);
	
      var probEmptySpace = 0.4;
      probEmptySpace = 0.2; // <<<<< 4dbg
      
      var diceForType = rnd.random();
      var diceForNPC  = rnd.random();
      var diceForItem = rnd.random();
      
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
      
      // 4dbg  -  just generate locations in a pattern
      if (coords_grid.long_grid % 2 == 0)
        this.type = LocationType.tower;
      else
        this.type = LocationType.hauntedHouse;
      //4dbg
      
      
      
      
      // set cellCoords_grid , coordinates_subgrid
      
      this.cellCoords_grid.copyFrom(coords_grid);
      
      var rndCoords_subgrid = this.calcPointOfInterest_subgrid(this.cellCoords_grid, localSeed);
      this.coordinates_subgrid.copyFrom(rndCoords_subgrid);
      
      if (this.type != LocationType.empty) {
        // set optionally  NPC or item
      
        if (diceForItem <= LocationProbability.itemPresent 
            || true /* 4dbg */) {
          
          console.log("generating new item...");
          
          var newItem = new Item();
          newItem.generate(localSeed);
	      this.putItemHere(newItem);
        }
        
        
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
	
    isItemPresent() { 
      if (this.curItem != null && this.curItem.isDefined())
        return true
      else
        return false;
    }
    getItem() { return this.curItem; }
	putItemHere(item) { this.curItem = item; }
  
	putNPCHere (npc) { this.curNPC = npc; }
	
	removeItem() { this.curItem = null; }
	removeNPC () { this.curNPC = null; }
	
	getActions() { return this.actions; }
  
	deleteAllActions() { 
      for (var aa3 = this.actions.length-1; aa3 >= 0; aa3--) { this.actions.pop(); }
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
  
  inv = new Inventory();

  var mainAction = new Action("describeLocation", "", displayMainScreen); 
  actionStack.push(mainAction);
  
  showTitle();
  
  //TODO
  // create inventory
}

function enableGPS() {

    monitoringGPS = true;
    hasGPSSignal = false;
    if (!useFakeGPS) {
      Bangle.setGPSPower(true);
      Bangle.on('GPS', handleGPSValues);
    }
}

function disableGPS() {

    monitoringGPS = false;
    hasGPSSignal = false;
    if (!useFakeGPS) {
      Bangle.removeAllListeners('GPS');
      Bangle.setGPSPower(false);
    }
}

function createFakeGPS() {
  if (!useFakeGPS)
    return;
  
  curLong_gps = 1;
  curLat_gps  = 2;
  newLoc_grid.initFromGPS(curLong_gps, curLat_gps);
  newLoc_subgrid.initFromGPS(curLong_gps, curLat_gps);
  
  hasGPSSignal = true;
  
  enteringNewCell();
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

  curLong_gps = gpsValueSet.lon;
  curLat_gps  = gpsValueSet.lat;
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
  
  // TODO: use visibility range !!
  if (curLocation.type != LocationType.empty) {
    Bangle.buzz();
  }
}

function displayMainScreen() {
  
  if (!coming1stTimeToAction && !comingBackToAction)
    return;
  
  g.clear();
  
  var msg;
  var cellCoords = "cc";
  
  var collectedActions = []; // type: Action or subclass
  collectedActionsIndexShown = 0;
  
  if (hasGPSSignal && curLocation != null) {
    msg = "You see " + curLocation.getDescription() + ".\n";
    
    if (curLocation.isItemPresent()) {
      
      var presentItem = curLocation.getItem();
      msg += "There ";
      if (presentItem.getQuantity() > 1) {
        msg += "are " + presentItem.getQuantity()+ " " + presentItem.getNamePlural() + ".";
      
      } else {
        msg += "is a "+ presentItem.getName() + ".";
      }
      msg += "\n";

      var itemActions = presentItem.getActionsAtLoc();
      
      //4dbg
      console.log("  presentItem:#actLoc: " + itemActions.length.toString());
      
      for (var aa = 0; aa < itemActions.length; aa++) {
        
        //console.log("  pushing action No " + aa.toString() + "\n");
        var anAction = itemActions[aa];
        collectedActions.push(anAction);
        
      }
      
    } else {
      // ... ?
    }
    
    
    var showInvAction = new MenuAction("AID_showInv", "inv", showInventory);
    
    collectedActions.push(showInvAction);
    
    
    // 4dbg
    for (var a2 = 0; a2 < collectedActions.length; a2++) {
      var curAction = collectedActions[a2];
      var actMsg = "BTN" + a2.toString() + ": " + curAction.getName() + "\n";
      console.log(actMsg);
    }
    
    //4dbg
    console.log("  :#collectedActions: " + collectedActions.length.toString());
      
    // 4dbg
    
    
    
    
    // map to BTNs and display
    
    mapActionsToButtons(collectedActions, collectedActionsIndexShown);
    displayCurButtonActions();
    
    // 4dbg: show cell coords:
    cellCoords = "Grid: " + curLoc_grid.toString() + "\n";
    cellCoords +=  "SG: " + newLoc_subgrid.toString();
    
  } else {
    msg = "no signal :(";
  }
  
  // 4dbg:
  msg += "\n" + cellCoords;
  
  g.drawString(msg, 1, 30);
  
  g.flip();
}

function fctTemplate() {
  
  if (!coming1stTimeToAction && !comingBackToAction)
    return;
      
  g.clear();  
  var collectedActions = []; // type: Action or subclass
  collectedActionsIndexShown = 0;
  
  // draw content...
  // fill collectedActions...
  
  mapActionsToButtons(collectedActions, collectedActionsIndexShown);
  displayCurButtonActions();
  
  g.flip();
}

function mapActionsToButtons(actions_i, indexShown_i) {
  
  clearWatch();
  
  // ALT I  btnActionMap.length = 0;  <<<=== not working!!!
  for (var aa3 = btnActionMap.length-1; aa3 >= 0; aa3--) {
    btnActionMap.pop();
  }
  
  /* needed? TODO
  for (var aa = 0; aa < actions_i.length; aa++) {
    var a = new Action("AID_none", "-", null);
    btnActionMap.push(a);
    // ALT II btnActionMap.push(null);
  }
  */

  
  console.log("   mapActionsToButtons:  #actions_i: " + actions_i.length.toString()); // 4dbg
  
  if (actions_i.length > 3 ) {
    
    // TODO 
    
  } else {
   
    for (var aa = 0; aa < actions_i.length; aa++) {
      
      switch(aa) {
        case 0:
          {
            var watchID1 = setWatch(btn1Pressed, BTN1, { repeat: false });
            var act1 = actions_i[aa];
             // ALT I btnActionMap[aa] = act1;
            btnActionMap.push(act1); // ALT II

            console.log("     mapping BTN " + aa.toString() + " to " + act1.getName()); // 4dbg
            //console.log("     #btnActionMap: " + btnActionMap.length.toString()); // 4dbg
          }
          break;
        case 1:
          {
            var watchID2 = setWatch(btn2Pressed, BTN2, { repeat: false });
            var act2 = actions_i[aa];
             // ALT I btnActionMap[aa] = act2;
            btnActionMap.push(act2); // ALT II
            console.log("     mapping BTN " + aa.toString() + " to " + act2.getName()); // 4dbg
            //console.log("     #btnActionMap: " + btnActionMap.length.toString()); // 4dbg
          }
          break;
          
        case 2:
          {
            var watchID3 = setWatch(btn3Pressed, BTN3, { repeat: false });
            var act3 = actions_i[aa];
             // ALT I btnActionMap[aa] = act3;
            btnActionMap.push(act3); // ALT II
            console.log("     mapping BTN " + aa.toString() + " to " + act3.getName()); // 4dbg
            //console.log("     #btnActionMap: " + btnActionMap.length.toString()); // 4dbg
          }
          break;
      }
      
    } // for (var aa = 0; aa < actions_i.length; aa++)
    
  }
  
  //var num = btnActionMap.length;
  //console.log("   #btnActionMap after init: " + num.toString() + "\n"); // 4dbg
}

function btn1Pressed() {
  btnPressed(0);
}

function btn2Pressed() {
  btnPressed(1);
}

function btn3Pressed() {
  btnPressed(2);
}

function btnPressed(index) {
  if (index < btnActionMap.length) {
    if (btnActionMap[index] != null) {
      var curAction = btnActionMap[index];
      actionStack.push(curAction);
      coming1stTimeToAction = true;
      
      console.log("   >> btnPressed - #actionStack: " + actionStack.length.toString());
    }
  }
}

function displayCurButtonActions() {
  
  //console.log("#ACTs: " + btnActionMap.length.toString()); // 4dbg
  
  for (var aa = 0; aa < btnActionMap.length; aa++) {
    
    if (btnActionMap[aa] != null) {
      
      var actionName = btnActionMap[aa].getGUIName();
      console.log("ACTION: " + actionName); // 4dbg
      g.drawString(actionName,  W-60, 10 + aa*60);
    }
  }
  
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
  g.setFont("6x8", 2);

  g.drawString("GAME OVER", 10, 50);
  
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

  
  if (useFakeGPS) {
    
    if (createFakeGPSOnlyOnce < 1) {
      createFakeGPS();
      createFakeGPSOnlyOnce++;
    }
    
  } 
  
  var resetBackToAction = false;
  if (comingBackToAction)
      resetBackToAction = true;
  
  // execute CURRENT action!
  if (actionStack.length > 0) {
    var curAction = actionStack[actionStack.length-1];
    curAction.execute();
    
  } else {
    // error 
    console.log("*error* no action defined");
  }
  
  coming1stTimeToAction = false;
  if (resetBackToAction) 
    comingBackToAction = false;
  
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
  
    g.drawString("Walk towards\n the light", 10, 30);
    
    g.flip();
    
    curLocIsValid = false;
    
    setTimeout(startGame2, 1000); // Waiting period to get some GPS signal...
    
    
  }
}

function startGame2() {
  
  running = true;
  
  // init stuff for main loop here...
  
  g.setColor(1,1,1);
  g.setFont("6x8", 2);
  
  mainInterval = setInterval(mainLoop, 500); // TODO: freq?
  
  coming1stTimeToAction = true;
  
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
  g.drawString("Press 1\nto start\n\nWritten by\nn-o-d and MR", 10, 50);
  
  setWatch(startGame1, BTN1);
  
  g.flip();
}

initAll();


// ########################

