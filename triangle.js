const GRID_SIZE = 15;
const RGB_COLOR_RANGE = 255.0

var gl;
var isDrawing = true; // defualt mode
var isErasing = false;
var isMouseDown = false;
var allBuffers = [];
var pointsGrid = [];
var glGrid = [];
var gridCells = [];
var program;
var zoom = 1.0;
var panX = 0.0;
var panY = 0.0;
var lastMouseX;
var lastMouseY;
var isOperating = false;
var lastOpWasUndoOrRedo = false;
var curOperation;
var operations = [];
var undoneOperations = [];

var currentColorVec4 = [];

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Cell {
    constructor(p1, p2, p3, p4) {
        this.p1 = convertPointToWebGLCoordinates(p1);
        this.p2 = convertPointToWebGLCoordinates(p2);
        this.p3 = convertPointToWebGLCoordinates(p3);
        this.p4 = convertPointToWebGLCoordinates(p4);
        this.p5 = convertPointToWebGLCoordinates(new Point(
            (p1.x + p2.x + p3.x + p4.x) / 4,
            (p1.y + p2.y + p3.y + p4.y) / 4
        ));
    }
}

function moveCanvasIsMouseDown (event) {
    isMouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}

function moveCanvasMouseDrag (event) {
    // if mouse is not down, don't do anything
    if (!isMouseDown) {
        return;
    }

    // find coordinate differences
    var deltaX = event.clientX - lastMouseX;
    var deltaY = event.clientY - lastMouseY;

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    // Update the pan based on mouse drag
    panX += deltaX / (canvas.width / 2 / zoom);
    panY -= deltaY / (canvas.height / 2 / zoom);

    render();
}

function moveCanvasMouseUp (event) {
    isMouseDown = false;
}

function convertPointToWebGLCoordinates(point) {
    return vec2(point.x / GRID_SIZE, point.y / GRID_SIZE);
}

function convertToArray(obj) {
    return [...Object.values(obj)];
}

function distanceToPoint(x1, y1, point) {
    const dx = x1 - point[0];
    const dy = y1 - point[1];

    return Math.sqrt(dx * dx + dy * dy);
}

function draw(event, canvas) {
    if (!isMouseDown) {
        return;
    }
    
    if (operations[curOperation] === undefined) {
        operations[curOperation] = 0;
    }

    if (lastOpWasUndoOrRedo) { // If drawing right after undo, remove previous undone ops
        undoneOperations.splice(0, undoneOperations.length);
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // canvasX -> mouseX, canvasY -> mouseY
    const canvasX = (x / canvas.width) * 2 - 1;
    const canvasY = -((y / canvas.height) * 2 - 1);

    // gridX -> clicked x coordinate (in terms of the grid), girdY -> clicked y coordinate (in terms of the grid)
    const gridX = Math.floor((canvasX + 1) * GRID_SIZE) <= -0 ? 0 : Math.floor((canvasX + 1) * GRID_SIZE);
    const gridY = Math.floor((canvasY + 1) * GRID_SIZE) <= -0 ? 0 : Math.floor((canvasY + 1) * GRID_SIZE);

    // Clicked cell (4 sub-triangles)
    const cellClicked = gridCells[gridX][gridY];

    let dtp1 = distanceToPoint(canvasX, canvasY, cellClicked.p1);
    let dtp2 = distanceToPoint(canvasX, canvasY, cellClicked.p2);
    let dtp3 = distanceToPoint(canvasX, canvasY, cellClicked.p3);
    let dtp4 = distanceToPoint(canvasX, canvasY, cellClicked.p4);

    var distancesToAllPts = [
        [dtp1, 1],
        [dtp2, 2],
        [dtp3, 3],
        [dtp4, 4]
    ];

    // First 2 elements are now the shortest 2 distances
    distancesToAllPts.sort((a, b) => a[0] - b[0]);

    let shortestPt;
    switch (distancesToAllPts[0][1]) {
        case 1:
            shortestPt = cellClicked.p1;
            break;
        case 2:
            shortestPt = cellClicked.p2;
            break;
        case 3:
            shortestPt = cellClicked.p3;
            break;
        case 4:
            shortestPt = cellClicked.p4;
            break;
        default:
            break;
    }

    let secondShortestPt;
    switch (distancesToAllPts[1][1]) {
        case 1:
            secondShortestPt = cellClicked.p1;
            break;
        case 2:
            secondShortestPt = cellClicked.p2;
            break;
        case 3:
            secondShortestPt = cellClicked.p3;
            break;
        case 4:
            secondShortestPt = cellClicked.p4;
            break;
        default:
            break;
    }

    // Clicked sub-triangle
    var clickedTriangle = [
        shortestPt,
        secondShortestPt,
        cellClicked.p5
    ];

    if (isDrawing) {
        operations[curOperation] = operations[curOperation] + 1;
    
        // Load the data into the GPU 
        var bufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(clickedTriangle), gl.STATIC_DRAW);
        allBuffers.push(bufferId);

        var colorBufferId = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBufferId);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(currentColorVec4), gl.STATIC_DRAW);
        allBuffers.push(colorBufferId); // todo
    
        // console.log(clickedTriangle);
    
        // Associate out shader variables with our data buffer
        var vPosition = gl.getAttribLocation(program, "vPosition");
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        var vColor = gl.getAttribLocation(program, "vColor");
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vColor);

    
        lastOpWasUndoOrRedo = false;
    }
    else if (isErasing) {
        // console.log(allBuffers);
    }

    render();
}

function undoLastStroke() {
    // console.log("Num of buffers: " + allBuffers.length);
    // console.log("Num of ops to remove: " + operations[curOperation]);
    
    if (curOperation <= 0) { return; }

    const undoneOperation = allBuffers.splice(allBuffers.length - operations[curOperation - 1], operations[curOperation - 1]);
    
    operations[curOperation - 1] = 0;

    undoneOperations.push(undoneOperation);
    // console.log(undoneOperations);

    curOperation--;

    lastOpWasUndoOrRedo = true;
    render();
}

function redoLastUndoneStroke() {
    if (undoneOperations.length < 1) { return; }

    curOperation++;
    operations[curOperation - 1] = undoneOperations[undoneOperations.length - 1].length;

    for (let i = 0; i < undoneOperations[undoneOperations.length - 1].length; i++) {
        allBuffers.push(undoneOperations[undoneOperations.length - 1][i]);
    }

    undoneOperations.splice(undoneOperations.length - 1, 1);
    
    lastOpWasUndoOrRedo = true;
    render();
}

function eraseMode() {
    resetAllModes();
    isErasing = true;
}

function drawMode() {
    resetAllModes();
    isDrawing = true;
}

function resetAllModes() {
    isDrawing = false;
    isErasing = false;
}

function setTriangleColor(r, g, b) {
    const currentColor = vec4(r, g, b, 1.0);

    currentColorVec4 = [];
    currentColorVec4.push(currentColor);
    currentColorVec4.push(currentColor);
    currentColorVec4.push(currentColor);
}

function pickColor(event) {
    // const selectedColor = event.target.style.backgroundColor;
    const selectedColor = getComputedStyle(event.target).backgroundColor;
    console.log("aloo")
    console.log(selectedColor)

    const colorComponents = selectedColor
        .replace("rgb(", "")
        .replace(")", "")
        .split(",");

    const r = parseFloat(colorComponents[0].trim()) / RGB_COLOR_RANGE;
    const g = parseFloat(colorComponents[1].trim()) / RGB_COLOR_RANGE;
    const b = parseFloat(colorComponents[2].trim()) / RGB_COLOR_RANGE;

    // set current color
    setTriangleColor(r, g, b);
}

function pickColorFromPicker(event) {
    const selectedColorValue = event.target.value

    // convert hex to rgb
    hex = selectedColorValue.replace("#", "");

    const r = parseInt(hex.substring(0, 2), 16) / RGB_COLOR_RANGE;
    const g = parseInt(hex.substring(2, 4), 16) / RGB_COLOR_RANGE;
    const b = parseInt(hex.substring(4, 6), 16) / RGB_COLOR_RANGE;
    
    // set current color
    setTriangleColor(r, g, b);
}

window.onload = function init() {
    curOperation = 0;
    operations[curOperation] = 0;
    
    var undoButton = document.getElementById("undobutton");
    undoButton.addEventListener("click", undoLastStroke);

    var redoButton = document.getElementById("redobutton");
    redoButton.addEventListener("click", redoLastUndoneStroke);

    var eraserButton = document.getElementById("eraserbutton");
    eraserButton.addEventListener("click", eraseMode);

    var pencilButton = document.getElementById("pencilbutton");
    pencilButton.addEventListener("click", drawMode);

    var colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach((option) => {option.addEventListener("click", pickColor)})

    var colorPicker = document.getElementById("colorpicker");
    colorPicker.addEventListener("input", pickColorFromPicker);

    var canvas = document.getElementById( "gl_canvas" );
    canvas.width = 900;
    canvas.height = 900;
    
    gl = WebGLUtils.setupWebGL( canvas );    
    if ( !gl ) { alert( "WebGL isn't available" ); }  

    // Configure WebGL
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    // Load shaders and initialize attribute buffers
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program )
    
    canvas.addEventListener("mouseup", (event) => {
        isOperating = false;
        isMouseDown = false;

        curOperation++;
    });

    canvas.addEventListener("mousedown", (event) => {
        isOperating = true;
        isMouseDown = true;
        draw(event, canvas);
    });  

    canvas.addEventListener("mousemove", (event) => {
        if (isMouseDown) {
            draw(event, canvas);
        }
    });      

    // Setup grids
    for (let i = -GRID_SIZE; i <= GRID_SIZE; i++) {
        pointsGrid[i + GRID_SIZE] = [];
        glGrid[i + GRID_SIZE] = [];

        for (let j = -GRID_SIZE; j <= GRID_SIZE; j++) {
            pointsGrid[i + GRID_SIZE].push(new Point(i, j));
            glGrid[i + GRID_SIZE].push(convertPointToWebGLCoordinates(new Point(i, j)));
        }
    }

    // Setup cells
    for (let i = 0; i < 2*GRID_SIZE; i++) {
        gridCells[i] = [];
        for (let j = 0; j < 2*GRID_SIZE; j++) {
            gridCells[i].push(new Cell(
                pointsGrid[i][j],
                pointsGrid[i + 1][j],
                pointsGrid[i][j + 1],
                pointsGrid[i + 1][j + 1],
            ));
        }
    }

    console.log("on load...")

    /*
    var all = []
    for (let i = 0; i < 2*GRID_SIZE; i++) {
        for (let j = 0; j < 2*GRID_SIZE; j++) {
            all.push(convertCellToArray(gridCells[i][j])[0]);
            all.push(convertCellToArray(gridCells[i][j])[1]);
            all.push(convertCellToArray(gridCells[i][j])[4]);
            all.push(convertCellToArray(gridCells[i][j])[2]);
            all.push(convertCellToArray(gridCells[i][j])[3]);
        }
    }

    //  Configure WebGL
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );        

    // Load the data into the GPU        
    // var bufferId = gl.createBuffer();
    // gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    // gl.bufferData( gl.ARRAY_BUFFER, flatten(all), gl.STATIC_DRAW ); 
        
    // Associate out shader variables with our data buffer
    // var vPosition = gl.getAttribLocation( program, "vPosition" );
    // gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    // gl.enableVertexAttribArray( vPosition );    
    
    //render();
    */
};

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT); 
    // console.log("bitches be rendering")
    for (let i = 0; i < allBuffers.length; i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, allBuffers[i]);

        // Associate shader variables and draw the current buffer
        var vPosition = gl.getAttribLocation(program, "vPosition");
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.TRIANGLES, 0, 3); // Assuming each buffer contains a single triangle
    }
}
