/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
var defaultEye = vec3.fromValues(7.0,3.0,-8.0); // default eye position in world space
var defaultCenter = vec3.fromValues(7.0,6.0,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(7.0,5.0,-15.0); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* webgl and geometry data */
/** @type {WebGLRenderingContext} */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var uvCoordBuffers = []; // this contains UV coordinates by set, in doubles
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
var viewDelta = 0; // how much to displace view with each key press

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc; // where to put normals for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var textureULoc; // where to put the texture for the fragment shader
var uvCoordAttribLoc; // where to put UV coords for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var alphaULoc; // where to put alpha value for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var blendingULoc; // where to put blending flag for fragment shader
var blending = true;

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space

var assets = {};
var default_homes = [2, 4, 6, 8, 10];
var homes = JSON.parse(JSON.stringify(default_homes));
var score = 0;

var theme = new Audio("https://jjoseph.me/csc561-textures/theme.mp3");
theme.preload = 'auto';
theme.addEventListener('ended', function() {
    this.currentTime = 0;
    this.play();
}, false);
var theme_playing = false;

var hop = new Audio("https://jjoseph.me/csc561-textures/hop.mp3");
hop.preload = 'auto';

var drown = new Audio("https://jjoseph.me/csc561-textures/drown.mp3");
drown.preload = 'auto';

var squash = new Audio("https://jjoseph.me/csc561-textures/squash.mp3");
squash.preload = 'auto';

var home = new Audio("https://jjoseph.me/csc561-textures/home.mp3");
home.preload = 'auto';

var win = new Audio("https://jjoseph.me/csc561-textures/win.mp3");
win.preload = 'auto';
win.addEventListener('play', function() {
    theme.volume = 0;
}, false);
win.addEventListener('ended', function() {
    theme.volume = 1;
}, false);

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input json file

function updateScore() {
    document.getElementById('score').innerHTML = `Score: <b class="green">${score}</b>`;
}

function updateStatus(message, color, time) {
    document.getElementById('status').style.fontWeight = 'bold';
    document.getElementById('status').innerHTML = message;
    document.getElementById('status').className = color;
    triggerVibration(300);

    setTimeout(() => {
        document.getElementById('status').style.fontWeight = '';
        document.getElementById('status').innerHTML = '';
        document.getElementById('status').className = '';
    }, time);
}

function triggerVibration(time) {
    if (navigator.vibrate) {
        navigator.vibrate(time);
    }
}

// does stuff when keys are pressed
function handleKeyDown(event) {
    
    const modelEnum = {TRIANGLES: "triangles", ELLIPSOID: "ellipsoid"}; // enumerated model type
    const dirEnum = {NEGATIVE: -1, POSITIVE: 1}; // enumerated rotation direction

    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector

    function checkWin(play_frog) {
        var frog_pos_x = Math.round(play_frog.pos.x);
        if (homes.includes(frog_pos_x)) {
            home.currentTime = 0;
            home.play();
            if (homes.length > 1) {
                updateStatus("Thank you for taking me home!", "green", 2000);
            }
            score += 50;
            updateScore();
            var map_tile_index = inputTriangles.findIndex(obj => (obj.type === "map_tile")
                                                      && (obj.pos.x === frog_pos_x)
                                                      && (obj.pos.y === play_frog.pos.y));
            var map_tile = inputTriangles[map_tile_index];
            map_tile.material.texture = "frog_home.png";
            map_tile.loadedTexture = loadTexture(`${map_tile.material.texture}`);
            map_tile.material.diffuse = [0.8, 0.8, 0.8];

            homes = homes.filter(home => home !== frog_pos_x);
            if (homes.length === 0) {
                win.currentTime = 0;
                win.play();
                updateStatus("You win!", "green", 5000);
                homes = JSON.parse(JSON.stringify(default_homes));
                homes.forEach(home => {
                    var map_tile_index = inputTriangles.findIndex(obj => (obj.type === "map_tile")
                                                              && (obj.pos.x === home)
                                                              && (obj.pos.y === 12));
                    var map_tile = inputTriangles[map_tile_index];
                    map_tile.material.texture = "";
                    map_tile.loadedTexture = loadTexture(`${map_tile.material.texture}`);
                    map_tile.material.diffuse = [0.0, 0.0, 0.6];
                });
                score += 1000;
                updateScore();
            }
        } else {
            squash.currentTime = 0;
            squash.play();
            updateStatus("You got squashed!", "red", 2000);
        }
        play_frog.pos = JSON.parse(JSON.stringify(play_frog.default_pos));
        vec3.set(play_frog.translation, 0, 0, 0);
    }

    function moveFrog(x, y) {
        if (!theme_playing) {
            theme.play();
            theme_playing = true;
        }
        var play_frog_index = inputTriangles.findIndex(obj => obj.type === "play_frog");
        var play_frog = inputTriangles[play_frog_index];
        var pos = play_frog.pos;

        var pos_x = pos.x;
        var pos_y = pos.y;
        pos.x += x;
        pos.y += y;
        pos.y = Math.max(0, Math.min(pos.y, 12));
        if (pos.y <= 6) {
            pos.x = Math.max(0, Math.min(pos.x, 13));
        }

        var x_offset = pos.x - pos_x;
        var y_offset = pos.y - pos_y;
        var offset;

        if (x_offset !== 0) {
            offset = vec3.scale(temp, viewRight, x_offset);
        }
        if (y_offset !== 0) {
            offset = vec3.scale(temp, Up, y_offset);
        }

        if (x_offset === 0 && y_offset === 0) {
            return;
        }
        if (pos.y === 12) {
            checkWin(play_frog);
            return;
        }

        hop.currentTime = 0;
        hop.play();
        if (y_offset === 1) {
            score += 10;
            updateScore();
        }
        vec3.add(play_frog.translation, play_frog.translation, offset);
    }

    function translateModel(offset) {
        if (handleKeyDown.modelOn != null)
            vec3.add(handleKeyDown.modelOn.translation,handleKeyDown.modelOn.translation,offset);
    } // end translate model

    function rotateModel(axis,direction) {
        if (handleKeyDown.modelOn != null) {
            var newRotation = mat4.create();

            mat4.fromRotation(newRotation,direction*rotateTheta,axis); // get a rotation matrix around passed axis
            vec3.transformMat4(handleKeyDown.modelOn.xAxis,handleKeyDown.modelOn.xAxis,newRotation); // rotate model x axis tip
            vec3.transformMat4(handleKeyDown.modelOn.yAxis,handleKeyDown.modelOn.yAxis,newRotation); // rotate model y axis tip
        } // end if there is a highlighted model
    } // end rotate model

    // highlight static variables
    handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
    handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

    switch (event.code) {
        case "ArrowRight":
            moveFrog(1, 0);
            break;
        case "ArrowLeft":
            moveFrog(-1, 0);
            break;
        case "ArrowUp":
            moveFrog(0, 1);
            break;
        case "ArrowDown":
            moveFrog(0, -1);
            break;
    } // end switch
    triggerVibration(100);
} // end handleKeyDown

function generateMap() {
    const map = [];

    const default_tile = {
      material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.6, 0.6, 0.6], specular: [0.3, 0.3, 0.3], n: 10, alpha: 1.0, texture: "" },
      vertices: null,
      normals: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
      triangles: [[0, 1, 2], [2, 3, 0]],
      type: "map_tile",
      pos: { x: null, y: null }
    };

    for (var y=0; y <= 13; y++) {
        for (var x=13; x >= 0; x--) {
            var tile = JSON.parse(JSON.stringify(default_tile));
            tile.pos.x = 13 - x;
            tile.pos.y = y;

            tile.vertices = [
              [x,     y,     1.0],
              [x,     y + 1, 1.0],
              [x + 1, y + 1, 1.0],
              [x + 1, y,     1.0]
            ];

            if (y === 0 || y === 6) {
                tile.material.texture = "pavement.png";
            }

            if (y > 0 && y < 6) {
                tile.material.ambient = [0.0, 0.0, 0.0];
                tile.material.diffuse = [0.129, 0.145, 0.167];
                tile.material.specular = [0.0, 0.0, 0.0];
            }

            if (y > 6 && y < 12) {
                tile.material.diffuse = [0.0, 0.0, 0.6];
            }

            if (y === 12) {
                if (!homes.includes(tile.pos.x)) {
                    tile.material.texture = "bush.png";
                } else {
                    tile.material.diffuse = [0.0, 0.0, 0.6];
                }
            }

            if (y === 13) {
                tile.material.texture = "bush.png";
            }

            map.push(tile);
        }
    }

    return map;
}

function generateWalls() {
    const walls = [
        {
            material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.6, 0.7, 0.6], specular: [0.3, 0.3, 0.3], n: 10, alpha: 1.0, texture: "empty.png", default_texture: "wall.jpg" },
          vertices: [
            [0.0, 0.1,   1.0],
            [0.0, 0.1,  -4.0],
            [0.0, 14.0, -4.0],
            [0.0, 14.0,  1.0]
          ],
          normals: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]],
          uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
          triangles: [[0, 1, 2], [2, 3, 0]],
          type: "map_wall",
          pos: { x: null, y: null }
        },
        {
          material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.6, 0.7, 0.6], specular: [0.3, 0.3, 0.3], n: 10, alpha: 1.0, texture: "empty.png", default_texture: "wall.jpg" },
          vertices: [
            [14.0, 0.1,   1.0],
            [14.0, 0.1,  -4.0],
            [14.0, 14.0, -4.0],
            [14.0, 14.0,  1.0]
          ],
          normals: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]],
          uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
          triangles: [[0, 1, 2], [2, 3, 0]],
          type: "map_wall",
          pos: { x: null, y: null }
        },
        {
          material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.6, 0.7, 0.6], specular: [0.3, 0.3, 0.3], n: 10, alpha: 1.0, texture: "empty.png", default_texture: "wall.jpg" },
          vertices: [
            [14.0, 0.1, 1.0],
            [14.0, 0.1, -3.0],
            [0.0,  0.1, -3.0],
            [0.0,  0.1, 1.0]
          ],
          normals: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]],
          uvs: [[0, 0], [0, 1], [1, 1], [1, 0]],
          triangles: [[0, 1, 2], [2, 3, 0]],
          type: "map_wall",
          pos: { x: null, y: null }
        },
        {
          material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.6, 0.7, 0.6], specular: [0.3, 0.3, 0.3], n: 10, alpha: 1.0, texture: "empty.png", default_texture: "frogger.png" },
          vertices: [
            [14.0, 14.0, 1.0],
            [14.0, 14.0, -2.8],
            [0.0,  14.0, -2.8],
            [0.0,  14.0, 1.0]
          ],
          normals: [[0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]],
          uvs: [
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0]
          ],
          triangles: [[0, 1, 2], [2, 3, 0]],
          type: "map_wall",
          pos: { x: null, y: null }
        }
    ];

    return walls;
}

function generateFrogs() {
    const frogs = [];

    const frog = {
      material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.6, 0.6, 0.6], specular: [0.3, 0.3, 0.3], n: 10, alpha: 1.0, texture: "frog.png" },
      vertices: [
            [6.0, 0.0, 0.8],
            [6.0, 1.0, 0.8],
            [7.0, 1.0, 0.8],
            [7.0, 0.0, 0.8],
            [6.0, 0.0, 0.7],
            [6.0, 1.0, 0.7],
            [7.0, 1.0, 0.7],
            [7.0, 0.0, 0.7]
      ],
      normals: [
            [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
            [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]
      ],
      uvs: [
            [-10, -10], [-10, -10], [-10, -10], [-10, -10],
            [0, 0], [0, 1], [1, 1], [1, 0]
      ],
      triangles: [
            [4, 6, 7], [4, 5, 6], [0, 2, 3], [0, 1, 2], [2, 3, 7], [2, 6, 7],
            [0, 1, 4], [1, 4, 5], [0, 3, 7], [0, 4, 7], [1, 2, 6], [1, 5, 6]
      ],
      type: "play_frog",
      default_pos: { x: 7.0, y: 0.0 },
      pos: { x: 7.0, y: 0.0 }
    };
    frog.default_pos = { x: (13 - frog.vertices[0][0]), y: frog.vertices[0][1] };
    frog.pos = { x: (13 - frog.vertices[0][0]), y: frog.vertices[0][1] };

    frogs.push(frog);

    return frogs;
}

function generateCars() {
    const cars = [];

    const default_car = {
      material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.6, 0.6, 0.6], specular: [0.3, 0.3, 0.3], n: 10, alpha: 1.0, texture: "" },
      vertices: null,
      normals: [
            [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
            [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]
      ],
      uvs: [
            [-10, -10], [-10, -10], [-10, -10], [-10, -10],
            [0, 0], [0, 1], [1, 1], [1, 0]
      ],
      triangles: [
            [4, 6, 7], [4, 5, 6], [0, 2, 3], [0, 1, 2], [2, 3, 7], [2, 6, 7],
            [0, 1, 4], [1, 4, 5], [0, 3, 7], [0, 4, 7], [1, 2, 6], [1, 5, 6]
      ],
      type: "car",
      length: null,
      default_pos: null,
      pos: null,
      dir: null,
      speed: null,
      start: null,
      startOffset: null
    };

    for (var y = 1; y <= 5; y++) {
        for (var i = 1; i <= 3; i++) {
            var car = JSON.parse(JSON.stringify(default_car));
            car.length = 1;
            car.dir = (y % 2 === 0) ? 1 : -1;
            car.material.texture = `car${y}.png`;
            car.startOffset = 4 * (i - 1);
            car.start = true;

            if (y === 1 || y === 2) {
                car.speed = 0.01;
            }
            if (y === 3 || y === 4) {
                car.speed = 0.015;
            }
            if (y === 5) {
                car.speed = 0.01;
                car.length = 2;
                car.material.texture = `truck.png`;
                car.startOffset = 5 * (i - 1);
                car.type = "truck";
            }

            var car_x = null;
            var car_y = y;
            if (car.dir === -1) {
                car_x = -1.0;
            } else {
                car_x = 14.0;
            }
            car.vertices = [
                [car_x,              car_y,     0.7],
                [car_x,              car_y + 1, 0.7],
                [car_x + car.length, car_y + 1, 0.7],
                [car_x + car.length, car_y,     0.7],
                [car_x,              car_y,     0.6],
                [car_x,              car_y + 1, 0.6],
                [car_x + car.length, car_y + 1, 0.6],
                [car_x + car.length, car_y,     0.6]
            ];
            car.default_pos = { x: (13 - car.vertices[0][0]), y: car.vertices[0][1] };
            car.pos = { x: (13 - car.vertices[0][0]), y: car.vertices[0][1] };

            cars.push(car);
        }
    }

    return cars;
}

function moveCars() {
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector

    inputTriangles.forEach(obj => {
        if ((obj.type === "car") || (obj.type === "truck")) {
            var x_offset = obj.dir * obj.speed;
            if (obj.start) {
                x_offset += obj.dir * obj.startOffset;
                obj.start = false;
            }
            var offset = vec3.scale(temp, viewRight, x_offset);
            obj.pos.x += x_offset;

            if (obj.pos.x > 14 || obj.pos.x < -1) {
                obj.pos = JSON.parse(JSON.stringify(obj.default_pos));
                vec3.set(obj.translation, 0, 0, 0);
            } else {
                vec3.add(obj.translation, obj.translation, offset);
            }
        }
    });
}

function generateLogs() {
    const logs = [];

    const default_log = {
      material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.6, 0.6, 0.6], specular: [0.3, 0.3, 0.3], n: 10, alpha: 1.0, texture: "" },
      vertices: null,
      normals: [
            [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
            [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]
      ],
      uvs: [
            [-10, -10], [-10, -10], [-10, -10], [-10, -10],
            [0, 0], [0, 1], [1, 1], [1, 0]
      ],
      triangles: [
            [4, 6, 7], [4, 5, 6], [0, 2, 3], [0, 1, 2], [2, 3, 7], [2, 6, 7],
            [0, 1, 4], [1, 4, 5], [0, 3, 7], [0, 4, 7], [1, 2, 6], [1, 5, 6]
      ],
      type: "log",
      length: null,
      default_pos: null,
      pos: null,
      dir: null,
      speed: null,
      start: null,
      startOffset: null
    };

    [8, 9, 11].forEach(y => {
        for (var i = 1; i <= 3; i++) {
            var log = JSON.parse(JSON.stringify(default_log));
            log.length = Math.random() < 0.3 ? 2 : 3;

            if (y === 8) {
                log.speed = 0.015;
            }
            if (y === 9) {
                log.speed = 0.02;
            }
            if (y === 11) {
                log.speed = 0.01;
            }
            log.dir = 1;
            log.material.texture = `log.png`;

            var log_x = 14.0;
            var log_y = y;
            log.startOffset = 5 * (i - 1);
            log.start = true;
            log.vertices = [
                [log_x,              log_y,     0.9],
                [log_x,              log_y + 1, 0.9],
                [log_x + log.length, log_y + 1, 0.9],
                [log_x + log.length, log_y,     0.9],
                [log_x,              log_y,     0.8],
                [log_x,              log_y + 1, 0.8],
                [log_x + log.length, log_y + 1, 0.8],
                [log_x + log.length, log_y,     0.8]
            ];
            log.default_pos = { x: (13 - log.vertices[0][0]), y: log.vertices[0][1] };
            log.pos = { x: (13 - log.vertices[0][0]), y: log.vertices[0][1] };

            logs.push(log);
        }
    });

    return logs;
}

function moveLogs() {
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector

    inputTriangles.forEach(obj => {
        if ((obj.type === "log")) {
            var x_offset = obj.dir * obj.speed;
            if (obj.start) {
                x_offset += obj.dir * obj.startOffset;
                obj.start = false;
            }
            var offset = vec3.scale(temp, viewRight, x_offset);
            obj.pos.x += x_offset;

            if (obj.pos.x > 14) {
                obj.pos = JSON.parse(JSON.stringify(obj.default_pos));
                vec3.set(obj.translation, 0, 0, 0);
            } else {
                vec3.add(obj.translation, obj.translation, offset);
            }
        }
    });
}

function generateTurtles() {
    const turtles = [];

    const default_turtle = {
      material: { ambient: [0.1, 0.1, 0.1], diffuse: [0.6, 0.6, 0.6], specular: [0.3, 0.3, 0.3], n: 10, alpha: 1.0, texture: "" },
      vertices: null,
      normals: [
            [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
            [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1]
      ],
      uvs: [
            [-10, -10], [-10, -10], [-10, -10], [-10, -10],
            [0, 0], [0, 1], [1, 1], [1, 0]
      ],
      triangles: [
            [4, 6, 7], [4, 5, 6], [0, 2, 3], [0, 1, 2], [2, 3, 7], [2, 6, 7],
            [0, 1, 4], [1, 4, 5], [0, 3, 7], [0, 4, 7], [1, 2, 6], [1, 5, 6]
      ],
      type: "turtle",
      length: null,
      default_pos: null,
      pos: null,
      dir: null,
      speed: null,
      start: null,
      startOffset: null
    };

    [7, 10].forEach(y => {
        for (var i = 1; i <= 3; i++) {
            var turtle = JSON.parse(JSON.stringify(default_turtle));
            turtle.length = Math.random() < 0.3 ? 2 : 3;

            if (y === 7) {
                turtle.speed = 0.01;
            }
            if (y === 10) {
                turtle.speed = 0.02;
            }
            turtle.dir = -1;
            turtle.material.texture = `turtle${turtle.length}.png`;

            var turtle_x = -1.0;
            var turtle_y = y;
            turtle.startOffset = 5 * (i - 1);
            turtle.start = true;
            turtle.vertices = [
                [turtle_x,                 turtle_y,     0.9],
                [turtle_x,                 turtle_y + 1, 0.9],
                [turtle_x + turtle.length, turtle_y + 1, 0.9],
                [turtle_x + turtle.length, turtle_y,     0.9],
                [turtle_x,                 turtle_y,     0.8],
                [turtle_x,                 turtle_y + 1, 0.8],
                [turtle_x + turtle.length, turtle_y + 1, 0.8],
                [turtle_x + turtle.length, turtle_y,     0.8]
            ];
            turtle.default_pos = { x: (13 - turtle.vertices[0][0]), y: turtle.vertices[0][1] };
            turtle.pos = { x: (13 - turtle.vertices[0][0]), y: turtle.vertices[0][1] };

            turtles.push(turtle);
        }
    });

    return turtles;
}

function moveTurtles() {
    // set up needed view params
    var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
    lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
    viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector

    inputTriangles.forEach(obj => {
        if ((obj.type === "turtle")) {
            var x_offset = obj.dir * obj.speed;
            if (obj.start) {
                x_offset += obj.dir * obj.startOffset;
                obj.start = false;
            }
            var offset = vec3.scale(temp, viewRight, x_offset);
            obj.pos.x += x_offset;

            if (obj.pos.x < -1) {
                obj.pos = JSON.parse(JSON.stringify(obj.default_pos));
                vec3.set(obj.translation, 0, 0, 0);
            } else {
                vec3.add(obj.translation, obj.translation, offset);
            }
        }
    });
}

function getInputTriangles() {
    return Object.values(assets).flat();
}

function setupAssets() {
    const map = generateMap();
    const walls = generateWalls();
    const frogs = generateFrogs();
    const cars = generateCars();
    const logs = generateLogs();
    const turtles = generateTurtles();

    assets = {
        map,
        walls,
        frogs,
        cars,
        logs,
        turtles
    };
}

function rangesOverlap(range1, range2, limit) {
  return Math.max(range1.min, range2.min) <=
         Math.min(range1.max + limit, range2.max + limit);
}

function checkCollisions() {
    var play_frog_index = inputTriangles.findIndex(obj => obj.type === "play_frog");
    var play_frog = inputTriangles[play_frog_index];
    var play_frog_x = play_frog.pos.x;
    var play_frog_y = play_frog.pos.y;

    if (play_frog_y >= 1 && play_frog_y <= 5) {
        inputTriangles.forEach(obj => {
            if ((obj.type === "car" || obj.type === "truck") && (obj.pos.y === play_frog_y)) {
                var car_x = obj.pos.x;
                var car_range = {}
                var frog_range = {}
                car_range.min = car_x - obj.length;
                car_range.max = car_x;
                frog_range.min = play_frog_x - 1;
                frog_range.max = play_frog_x;

                if (rangesOverlap(car_range, frog_range, -0.2)) {
                    squash.currentTime = 0;
                    squash.play();
                    updateStatus("You got squashed!", "red", 2000);
                    play_frog.pos = JSON.parse(JSON.stringify(play_frog.default_pos));
                    vec3.set(play_frog.translation, 0, 0, 0);
                }
            }
        });
    }

    if (play_frog_y >= 7 && play_frog_y <= 11) {
        if (play_frog_x < 0 || play_frog_x >= 14) {
            drown.currentTime = 0;
            drown.play();
            updateStatus("You fell into the river!", "red", 2000);
            play_frog.pos = JSON.parse(JSON.stringify(play_frog.default_pos));
            vec3.set(play_frog.translation, 0, 0, 0);
        }
        var overlap = false;
        var obj_index = null;
        for (var index = 0; index < inputTriangles.length; index++) {
            var obj = inputTriangles[index];
            if ((obj.type === "turtle" || obj.type === "log") && (obj.pos.y === play_frog_y)) {
                var obj_x = obj.pos.x;
                var obj_range = {}
                var frog_range = {}
                obj_range.min = obj_x - obj.length;
                obj_range.max = obj_x;
                frog_range.min = play_frog_x - 1;
                frog_range.max = play_frog_x;

                if (rangesOverlap(obj_range, frog_range, -0.2)) {
                    overlap = true;
                    obj_index = index;
                    break;
                }
            }
        }

        if (!overlap) {
            drown.currentTime = 0;
            drown.play();
            updateStatus("You fell into the river!", "red", 2000);
            play_frog.pos = JSON.parse(JSON.stringify(play_frog.default_pos));
            vec3.set(play_frog.translation, 0, 0, 0);
        } else {
            // set up needed view params
            var lookAt = vec3.create(), viewRight = vec3.create(), temp = vec3.create(); // lookat, right & temp vectors
            lookAt = vec3.normalize(lookAt,vec3.subtract(temp,Center,Eye)); // get lookat vector
            viewRight = vec3.normalize(viewRight,vec3.cross(temp,lookAt,Up)); // get view right vector

            var x_offset = inputTriangles[obj_index].dir * inputTriangles[obj_index].speed;
            play_frog.pos.x += x_offset;
            var offset = vec3.scale(temp, viewRight, x_offset);
            vec3.add(play_frog.translation, play_frog.translation, offset);
        }
    }

}

// set up the webGL environment
function setupWebGL() {
    
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed

    // Get the canvas and context
    var canvas = document.getElementById("webGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.129, 0.145, 0.167, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read models in, load them into webgl buffers
function loadModels() {
    
    // make an ellipsoid, with numLongSteps longitudes.
    // start with a sphere of radius 1 at origin
    // Returns verts, tris and normals.
    function makeEllipsoid(currEllipsoid,numLongSteps) {
        
        try {
            if (numLongSteps % 2 != 0)
                throw "in makeSphere: uneven number of longitude steps!";
            else if (numLongSteps < 4)
                throw "in makeSphere: number of longitude steps too small!";
            else { // good number longitude steps
            
                console.log("ellipsoid xyz: "+ ellipsoid.x +" "+ ellipsoid.y +" "+ ellipsoid.z);
                
                // make vertices
                var ellipsoidVertices = [0,-1,0]; // vertices to return, init to south pole
                var angleIncr = (Math.PI+Math.PI) / numLongSteps; // angular increment 
                var latLimitAngle = angleIncr * (Math.floor(numLongSteps/4)-1); // start/end lat angle
                var latRadius, latY; // radius and Y at current latitude
                for (var latAngle=-latLimitAngle; latAngle<=latLimitAngle; latAngle+=angleIncr) {
                    latRadius = Math.cos(latAngle); // radius of current latitude
                    latY = Math.sin(latAngle); // height at current latitude
                    for (var longAngle=0; longAngle<2*Math.PI; longAngle+=angleIncr) // for each long
                        ellipsoidVertices.push(latRadius*Math.sin(longAngle),latY,latRadius*Math.cos(longAngle));
                } // end for each latitude
                ellipsoidVertices.push(0,1,0); // add north pole
                ellipsoidVertices = ellipsoidVertices.map(function(val,idx) { // position and scale ellipsoid
                    switch (idx % 3) {
                        case 0: // x
                            return(val*currEllipsoid.a+currEllipsoid.x);
                        case 1: // y
                            return(val*currEllipsoid.b+currEllipsoid.y);
                        case 2: // z
                            return(val*currEllipsoid.c+currEllipsoid.z);
                    } // end switch
                }); 

                // make normals using the ellipsoid gradient equation
                // resulting normals are unnormalized: we rely on shaders to normalize
                var ellipsoidNormals = ellipsoidVertices.slice(); // start with a copy of the transformed verts
                ellipsoidNormals = ellipsoidNormals.map(function(val,idx) { // calculate each normal
                    switch (idx % 3) {
                        case 0: // x
                            return(2/(currEllipsoid.a*currEllipsoid.a) * (val-currEllipsoid.x));
                        case 1: // y
                            return(2/(currEllipsoid.b*currEllipsoid.b) * (val-currEllipsoid.y));
                        case 2: // z
                            return(2/(currEllipsoid.c*currEllipsoid.c) * (val-currEllipsoid.z));
                    } // end switch
                }); 
                
                // make triangles, from south pole to middle latitudes to north pole
                var ellipsoidTriangles = []; // triangles to return
                for (var whichLong=1; whichLong<numLongSteps; whichLong++) // south pole
                    ellipsoidTriangles.push(0,whichLong,whichLong+1);
                ellipsoidTriangles.push(0,numLongSteps,1); // longitude wrap tri
                var llVertex; // lower left vertex in the current quad
                for (var whichLat=0; whichLat<(numLongSteps/2 - 2); whichLat++) { // middle lats
                    for (var whichLong=0; whichLong<numLongSteps-1; whichLong++) {
                        llVertex = whichLat*numLongSteps + whichLong + 1;
                        ellipsoidTriangles.push(llVertex,llVertex+numLongSteps,llVertex+numLongSteps+1);
                        ellipsoidTriangles.push(llVertex,llVertex+numLongSteps+1,llVertex+1);
                    } // end for each longitude
                    ellipsoidTriangles.push(llVertex+1,llVertex+numLongSteps+1,llVertex+2);
                    ellipsoidTriangles.push(llVertex+1,llVertex+2,llVertex-numLongSteps+2);
                } // end for each latitude
                for (var whichLong=llVertex+2; whichLong<llVertex+numLongSteps+1; whichLong++) // north pole
                    ellipsoidTriangles.push(whichLong,ellipsoidVertices.length/3-1,whichLong+1);
                ellipsoidTriangles.push(ellipsoidVertices.length/3-2,ellipsoidVertices.length/3-1,
                                        ellipsoidVertices.length/3-numLongSteps-1); // longitude wrap
            } // end if good number longitude steps
            return({vertices:ellipsoidVertices, normals:ellipsoidNormals, triangles:ellipsoidTriangles});
        } // end try
        
        catch(e) {
            console.log(e);
        } // end catch
    } // end make ellipsoid
    
    inputTriangles = getInputTriangles(); // read in the triangle data

    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var normToAdd; // vtx normal to add to the coord array
            var uvCoordToAdd; // UV coords to add to the coord array
            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner
        
            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                
                // set up hilighting, modeling translation and rotation
                inputTriangles[whichSet].center = vec3.fromValues(0,0,0);  // center point of tri set
                inputTriangles[whichSet].on = false; // not highlighted
                inputTriangles[whichSet].translation = vec3.fromValues(0,0,0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1,0,0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0,1,0); // model Y axis 

                // set up the vertex and normal arrays, define model center and axes
                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
                inputTriangles[whichSet].glUVCoords = []; // flat UV coord list for webgl
                var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    uvCoordToAdd = inputTriangles[whichSet].uvs[whichSetVert]; // get normal to add
                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set coord list
                    inputTriangles[whichSet].glUVCoords.push(uvCoordToAdd[0],uvCoordToAdd[1]); // put UV coord in set coord list
                    vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center,inputTriangles[whichSet].center,vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center,inputTriangles[whichSet].center,1/numVerts); // avg ctr sum

                // send the vertex coords and normals to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glVertices),gl.STATIC_DRAW); // data in
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glNormals),gl.STATIC_DRAW); // data in

                uvCoordBuffers[whichSet] = gl.createBuffer(); // init empty webgl set UV coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,uvCoordBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glUVCoords),gl.STATIC_DRAW); // data in
            
                // load the texture
                inputTriangles[whichSet].loadedTexture = loadTexture(`${inputTriangles[whichSet].material.texture}`);

                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set

            if (inputEllipsoids == String.null)
                throw "Unable to load ellipsoids file!";
            else {
                
                // init ellipsoid highlighting, translation and rotation; update bbox
                var ellipsoid; // current ellipsoid
                var ellipsoidModel; // current ellipsoid triangular model
                var temp = vec3.create(); // an intermediate vec3
                var minXYZ = vec3.create(), maxXYZ = vec3.create();  // min/max xyz from ellipsoid
                numEllipsoids = inputEllipsoids.length; // remember how many ellipsoids
                for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
                    
                    // set up various stats and transforms for this ellipsoid
                    ellipsoid = inputEllipsoids[whichEllipsoid];
                    ellipsoid.on = false; // ellipsoids begin without highlight
                    ellipsoid.translation = vec3.fromValues(0,0,0); // ellipsoids begin without translation
                    ellipsoid.xAxis = vec3.fromValues(1,0,0); // ellipsoid X axis
                    ellipsoid.yAxis = vec3.fromValues(0,1,0); // ellipsoid Y axis 
                    ellipsoid.center = vec3.fromValues(ellipsoid.x,ellipsoid.y,ellipsoid.z); // locate ellipsoid ctr
                    vec3.set(minXYZ,ellipsoid.x-ellipsoid.a,ellipsoid.y-ellipsoid.b,ellipsoid.z-ellipsoid.c); 
                    vec3.set(maxXYZ,ellipsoid.x+ellipsoid.a,ellipsoid.y+ellipsoid.b,ellipsoid.z+ellipsoid.c); 
                    vec3.min(minCorner,minCorner,minXYZ); // update world bbox min corner
                    vec3.max(maxCorner,maxCorner,maxXYZ); // update world bbox max corner

                    // make the ellipsoid model
                    ellipsoidModel = makeEllipsoid(ellipsoid,32);
    
                    // send the ellipsoid vertex coords and normals to webGL
                    vertexBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex coord buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[vertexBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.vertices),gl.STATIC_DRAW); // data in
                    normalBuffers.push(gl.createBuffer()); // init empty webgl ellipsoid vertex normal buffer
                    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[normalBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ellipsoidModel.normals),gl.STATIC_DRAW); // data in
        
                    triSetSizes.push(ellipsoidModel.triangles.length);
    
                    // send the triangle indices to webGL
                    triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[triangleBuffers.length-1]); // activate that buffer
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ellipsoidModel.triangles),gl.STATIC_DRAW); // data in
                } // end for each ellipsoid
                
                viewDelta = vec3.length(vec3.subtract(temp,maxCorner,minCorner)) / 100; // set global
            } // end if ellipsoid file loaded
        } // end if triangle file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

function glsl(strings) {
  return strings.raw[0];
}

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = glsl`
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader

        attribute vec2 aUVCoord;
        varying highp vec2 vUVCoord;

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z)); 

            vUVCoord = vec2(1, 1) - aUVCoord;
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = glsl`
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uAlpha; // the alpha value
        uniform float uShininess; // the specular exponent

        // blending properties
        uniform bool uBlending;
        
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment

        // texture properties
        varying highp vec2 vUVCoord;
        uniform sampler2D uTexture;

        void main(void) {
        
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient;
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal);
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term
            
            // combine to output color
            vec3 colorOut = ambient + diffuse + specular; // no specular yet
            highp vec4 texture = texture2D(uTexture, vUVCoord);

            if (uBlending) {
                gl_FragColor = vec4(colorOut.rgb * texture.rgb, uAlpha * texture.a);
            } else {
                gl_FragColor = texture;
            }
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                
                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat
                
                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                alphaULoc = gl.getUniformLocation(shaderProgram, "uAlpha"); // ptr to alpha
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess

                blendingULoc = gl.getUniformLocation(shaderProgram, "uBlending"); // ptr to blending

                // locate and enable UV coord attributes
                uvCoordAttribLoc = gl.getAttribLocation(shaderProgram, "aUVCoord"); // ptr to UV coord attrib
                gl.enableVertexAttribArray(uvCoordAttribLoc); // connect attrib to array
                // locate texture uniform
                textureULoc = gl.getUniformLocation(shaderProgram, "uTexture"); // ptr to uTexture

                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 

    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

function loadTexture(texture_url) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    var level = 0;
    var internalFormat = gl.RGBA;
    var srcFormat = gl.RGBA;
    var srcType = gl.UNSIGNED_BYTE;
    var width = 1;
    var height = 1;
    var border = 0;
    var pixel = new Uint8Array([255, 255, 255, 255]);
    gl.texImage2D(gl.TEXTURE_2D,level,internalFormat,width,height,border,srcFormat,srcType,pixel);

    var image = new Image();
    image.crossOrigin = "Anonymous";
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D,level,internalFormat,srcFormat,srcType,image);

        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    if (texture_url.length > 0) {
        image.src = `https://jjoseph.me/csc561-textures/${texture_url}`;
    }

    return texture;
}

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

// render the loaded model
function renderModels() {
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.center)); 
        
        // scale for highlighting if needed
        if (currModel.on)
            mat4.multiply(mMatrix,mat4.fromScaling(temp,vec3.fromValues(1.2,1.2,1.2)),mMatrix); // S(1.2) * T(-ctr)
        
        // rotate the model to current interactive orientation
        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)
        
        // translate back to model center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.center),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)
        
    } // end make model transform
    
    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices
    
    window.requestAnimationFrame(renderModels); // set up frame render callback
    
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,100); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(pvMatrix,pvMatrix,pMatrix); // projection
    mat4.multiply(pvMatrix,pvMatrix,vMatrix); // projection * view

    moveCars();
    moveLogs();
    moveTurtles();
    checkCollisions();

    gl.uniform1f(blendingULoc,blending); // pass in the blending flag
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var opaqueTriSetIndices = inputTriangles.filter(triSet => triSet.material.alpha === 1.0).map((_, index) => index);
    var transparentTriSetIndices = inputTriangles.filter(triSet => triSet.material.alpha < 1.0).map((_, index) => index);
    transparentTriSetIndices.sort((a, b) =>
        (inputTriangles[b].center[2] + inputTriangles[b].translation[2]) -
        (inputTriangles[a].center[2] + inputTriangles[a].translation[2])
    );
    var triSetIndices = opaqueTriSetIndices.concat(transparentTriSetIndices);

    // render each triangle set
    var currSet; // the tri set and its material properties
    for (var whichTriSet in triSetIndices) {
        currSet = inputTriangles[whichTriSet];
        
        if (currSet.material.alpha < 1.0) {
            gl.depthMask(false);
        }

        // make model transform, add to view project
        makeModelTransform(currSet);
        mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
        gl.uniform1f(alphaULoc,currSet.material.alpha); // pass in the alpha
        gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent
        
        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed

        // load texture UVs
        gl.bindBuffer(gl.ARRAY_BUFFER,uvCoordBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(uvCoordAttribLoc,2,gl.FLOAT,false,0,0); // feed

        // pre-multiply the alpha
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        // tell WebGL we want to affect texture unit 0
        gl.activeTexture(gl.TEXTURE0);
        // bind the texture to texture unit 0
        gl.bindTexture(gl.TEXTURE_2D, currSet.loadedTexture);
        // tell the shader we bound the texture to texture unit 0
        gl.uniform1i(textureULoc, 0);

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
        
    } // end for each triangle set
    
    // render each ellipsoid
    var ellipsoid, instanceTransform = mat4.create(); // the current ellipsoid and material
    
    for (var whichEllipsoid=0; whichEllipsoid<numEllipsoids; whichEllipsoid++) {
        ellipsoid = inputEllipsoids[whichEllipsoid];
        
        // define model transform, premult with pvmMatrix, feed to vertex shader
        makeModelTransform(ellipsoid);
        pvmMatrix = mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // premultiply with pv matrix
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in model matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in project view model matrix

        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc,ellipsoid.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,ellipsoid.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,ellipsoid.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,ellipsoid.n); // pass in the specular exponent

        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[numTriangleSets+whichEllipsoid]); // activate vertex buffer
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed vertex buffer to shader
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[numTriangleSets+whichEllipsoid]); // activate normal buffer
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed normal buffer to shader
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[numTriangleSets+whichEllipsoid]); // activate tri buffer
        
        // draw a transformed instance of the ellipsoid
        gl.drawElements(gl.TRIANGLES,triSetSizes[numTriangleSets+whichEllipsoid],gl.UNSIGNED_SHORT,0); // render
    } // end for each ellipsoid
} // end render model

/* MAIN -- HERE is where execution begins after window load */

function main() {
  setupAssets(); // set up the structure that contains the map, frogs and vehicles
  setupWebGL(); // set up the webGL environment
  loadModels(); // load in the models from tri file
  setupShaders(); // setup the webGL shaders
  renderModels(); // draw the triangles using webGL
} // end main
