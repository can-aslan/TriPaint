const GRID_SIZE = 15;
const RGB_COLOR_RANGE = 255.0;
const CLICKED_ICON_BACKGROUND = "#626366";
const ICON_BACKGROUND = "transparent";
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const IDENTITY_MT4 = mat4()

var gl;
var canvas;
var isDrawing = true; // defualt mode
var isErasing = false;
var isSelecting = false;
var isMouseDown = false;
var isSliding = false;
var isMoving = false;

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
var strokes = [];
var undoneStrokes = [];
var currentStroke = 0;
var allVertices = [];
var theBuffer;
var theColorBuffer;
var currentColorVec4 = [];
var currentColor = vec4(1.0, 0.0, 0.0, 1.0);
var currentColorHTMLId = null;

var editButtonsToBeUpdated = [];
var viewMatrix;
var zoomFactor = 1.0
var currentCanvasWidth = CANVAS_WIDTH;

var sliderValueText;

const StrokeType = {
    Draw: "draw",
    Erase: "erase",
    Unknown: "unknown"
}

class Stroke {
    constructor(triangle, color, type) {
        this.triangle = triangle;
        this.color = color;

        switch (type) {
            case StrokeType.Draw:
                this.type = StrokeType.Draw;
                break;
            case StrokeType.Erase:
                this.type = StrokeType.Erase;
                break;
            default:
                this.type = StrokeType.Unknown;
                break;
        }
    }
}

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
    // panX += deltaX / (canvas.width / 2 / zoom);
    // panY -= deltaY / (canvas.height / 2 / zoom);

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
    
    if (strokes[currentStroke] === undefined) {
        strokes[currentStroke] = [];
    }

    if (lastOpWasUndoOrRedo) { // If drawing right after undo, remove previous undone ops
        undoneStrokes.splice(0, undoneStrokes.length);
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
        allVertices.push(clickedTriangle[0]);
        allVertices.push(clickedTriangle[1]);
        allVertices.push(clickedTriangle[2]);

        currentColorVec4.push(currentColor);
        currentColorVec4.push(currentColor);
        currentColorVec4.push(currentColor);

        strokes[currentStroke].push(new Stroke(clickedTriangle, currentColor, StrokeType.Draw));

        gl.bindBuffer(gl.ARRAY_BUFFER, theBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(allVertices), gl.STATIC_DRAW);
    }
    else if (isErasing) {
        for (let i = 0; i < allVertices.length; i = i + 3) {
            if (isSameTriangle(i, clickedTriangle)) {
                strokes[currentStroke].push(new Stroke(allVertices.splice(i, 3), currentColorVec4.splice(i, 3)[0], StrokeType.Erase));
            }
        }
    }

    lastOpWasUndoOrRedo = false;
    render();
}

// Checks if the given clicked triangle exists in the
// first three (after allVerticesStartingIndex) items in the allVertices array
function isSameTriangle(allVerticesStartingIndex, clickedTriangle) {
    let clickedShortestExists =
        allVertices[allVerticesStartingIndex] == clickedTriangle[0]
        || allVertices[allVerticesStartingIndex + 1] == clickedTriangle[0]
        || allVertices[allVerticesStartingIndex + 2] == clickedTriangle[0];

    let clickedSecondShortestExists =
        allVertices[allVerticesStartingIndex] == clickedTriangle[1]
        || allVertices[allVerticesStartingIndex + 1] == clickedTriangle[1]
        || allVertices[allVerticesStartingIndex + 2] == clickedTriangle[1];

    let clickedCenterExists =
        allVertices[allVerticesStartingIndex] == clickedTriangle[2]
        || allVertices[allVerticesStartingIndex + 1] == clickedTriangle[2]
        || allVertices[allVerticesStartingIndex + 2] == clickedTriangle[2];

    return clickedShortestExists && clickedSecondShortestExists && clickedCenterExists;
}

function isVertexInArray(x, y, verticesToRemove) {
    for (let i = 0; i < verticesToRemove.length; i += 2) {
        const removeX = verticesToRemove[i];
        const removeY = verticesToRemove[i + 1];
        if (x === removeX && y === removeY) {
            return true;
        }
    }
    return false;
}

function undoLastStroke() {
    updateButtonBackground();
  
    if (currentStroke <= 0) { return; }
    
    var undoneStroke = strokes.splice(currentStroke - 1, 1);
    undoneStrokes.push(undoneStroke[0]);

    for (let index = 0; index < undoneStroke[0].length; index++) {
        var currentStrokeObj = undoneStroke[0][index];
        var curTriangle = currentStrokeObj.triangle;
        var curColor = currentStrokeObj.color;

        if (currentStrokeObj.type == StrokeType.Draw) {
            for (let i = 0; i < allVertices.length; i = i + 3) {
                if (currentColorVec4[i] == curColor && isSameTriangle(i, curTriangle)) {
                    allVertices.splice(i, 3);
                    currentColorVec4.splice(i, 3);

                    break;
                }
            }
        }
        else if (currentStrokeObj.type == StrokeType.Erase) {
            allVertices.push(curTriangle[0]);
            allVertices.push(curTriangle[1]);
            allVertices.push(curTriangle[2]);

            currentColorVec4.push(curColor);
            currentColorVec4.push(curColor);
            currentColorVec4.push(curColor);
        }
    }

    currentStroke--;

    lastOpWasUndoOrRedo = true;
    render();
}

function redoLastUndoneStroke() {
    updateButtonBackground();
    
    if (undoneStrokes.length < 1) { return; }

    var redoneStroke = undoneStrokes.splice(undoneStrokes.length - 1, 1);

    for (let index = 0; index < redoneStroke[0].length; index++) {
        var currentStrokeObj = redoneStroke[0][index];
        var curTriangle = currentStrokeObj.triangle;
        var curColor = currentStrokeObj.color;

        if (currentStrokeObj.type == StrokeType.Draw) {
            allVertices.push(curTriangle[0]);
            allVertices.push(curTriangle[1]);
            allVertices.push(curTriangle[2]);

            currentColorVec4.push(curColor);
            currentColorVec4.push(curColor);
            currentColorVec4.push(curColor);
        }
        else if (currentStrokeObj.type == StrokeType.Erase) {
            for (let i = 0; i < allVertices.length; i = i + 3) {
                if (currentColorVec4[i] == curColor && isSameTriangle(i, curTriangle)) {
                    allVertices.splice(i, 3);
                    currentColorVec4.splice(i, 3);

                    break;
                }
            }
        }
    }

    strokes.push(redoneStroke[0]);
    currentStroke++;

    lastOpWasUndoOrRedo = true;
    render();
}

function eraseMode(eraserButton) {
    updateButtonBackground(eraserButton);
    resetAllModes();
    isErasing = true;
}

function drawMode(pencilButton) {
    updateButtonBackground(pencilButton);
    resetAllModes();
    isDrawing = true;
}

function selectMode(selectionButton) {
    updateButtonBackground(selectionButton);
    resetAllModes();
    isSelecting = true;
}

function moveMode(moveButton) {
    updateButtonBackground(moveButton);
    resetAllModes();
    isMoving = true;
}

function cutSelection() {
    updateButtonBackground();
    resetAllModes();
    isDrawing = false;
}

function copySelection() {
    updateButtonBackground();
    resetAllModes();
    isDrawing = false;
}

function pasteSelection() {
    updateButtonBackground();
    resetAllModes();
    isDrawing = false;
}

function openFile() {
    updateButtonBackground();
    resetAllModes();
    isDrawing = false;
}

function saveFile() {
    updateButtonBackground();
    resetAllModes();
    isDrawing = false;
}

function updateButtonBackground(button = null) {
    editButtonsToBeUpdated.forEach(btn => btn.style.backgroundColor = ICON_BACKGROUND);

    if (button != null) {
        button.style.backgroundColor = CLICKED_ICON_BACKGROUND;
    }
}

function resetAllModes() {
    isDrawing = false;
    isErasing = false;
    isSelecting = false;
    isSliding = false;
    isMoving = false;
}

function setTriangleColor(r, g, b) {
    currentColor = vec4(r, g, b, 1.0);
}

function pickColor(event) {
    if (currentColorHTMLId != null) {
        document.getElementById(currentColorHTMLId).style.border = "transparent"
    }

    currentColorHTMLId = event.target.id;

    event.target.style.border = "2px solid white";
    const selectedColor = getComputedStyle(event.target).backgroundColor;

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

function updateViewMatrix() {
    zoomFactor = zoomFactor.toFixed(2);
    // viewMatrix = translate([1,1,0])
    
    console.log("aloo",viewMatrix)
    // viewMatrix = scale(zoomFactor, zoomFactor, 1.0);
    // viewMatrix = scale(2.0, 2.0, 2.0);
    // viewMatrix = mult(viewMatrix, scalingMatrix);

    // Update the canvas size based on the zoom
    const newCanvasWidth = CANVAS_WIDTH * zoomFactor;
    const newCanvasHeight = CANVAS_HEIGHT * zoomFactor;

    console.log("fnew width", newCanvasWidth)
    console.log("fnew heightht", newCanvasHeight)

    canvas.width = Math.floor(newCanvasWidth);
    canvas.height = Math.floor(newCanvasHeight);

    // Update the viewport to match the canvas size
    gl.viewport(0, 0, newCanvasWidth, newCanvasHeight);
    render();
}

function updateCanvasScale(event, slideBtn) {
    let sliderValue;

    if (isSliding) {
        sliderValue = slideBtn.value;
        zoomFactor = sliderToZoom(sliderValue);
        console.log("value:", zoomFactor)
        isSliding = false;
    }
    else {
        if (event.deltaY > 0) {
            // Zoom out
            zoomFactor /= 1.1;
        } else {
            // Zoom in
            zoomFactor *= 1.1;
        }

        if (zoomFactor < MIN_ZOOM) {
            zoomFactor = MIN_ZOOM;
        } else if (zoomFactor > MAX_ZOOM) {
            zoomFactor = MAX_ZOOM;
        }

        sliderValue = zoomToSlider(zoomFactor);
    }

    slideBtn.value = sliderValue;
    sliderValueText.textContent = `${parseInt(sliderValue)}%`;

    updateViewMatrix();
    render();
}

function normalizeValue(value, min, max) {
    return (value - min) / (max - min);
}

function sliderToZoom(sliderValue) {
    const sliderRange = 100;
    const normalizedSlider = sliderValue / sliderRange;
    return MIN_ZOOM + normalizedSlider * (MAX_ZOOM - MIN_ZOOM);
}

function zoomToSlider(zoomFactor) {    
    const normalizedZoom = normalizeValue(zoomFactor, MIN_ZOOM, MAX_ZOOM);
    const sliderRange = 100;

    return normalizedZoom * sliderRange;    
}

window.onload = function init() {
    currentStroke = 0;

    // Add event listener for each button
    sliderValueText = document.getElementById("slidertext");

    var undoButton = document.getElementById("undobutton");
    undoButton.addEventListener("click", undoLastStroke);

    var redoButton = document.getElementById("redobutton");
    redoButton.addEventListener("click", redoLastUndoneStroke);
    
    var fileButton = document.getElementById("filebutton");
    fileButton.addEventListener("click", openFile);
    
    var saveButton = document.getElementById("savebutton");
    saveButton.addEventListener("click", saveFile);
    
    var cutButton = document.getElementById("cutbutton");
    cutButton.addEventListener("click", cutSelection);
    
    var copyButton = document.getElementById("copybutton");
    copyButton.addEventListener("click", copySelection);
    
    var pasteButton = document.getElementById("pastebutton");
    pasteButton.addEventListener("click", pasteSelection);

    var eraserButton = document.getElementById("eraserbutton");
    eraserButton.addEventListener("click", function() {
        eraseMode(eraserButton);
    });

    var pencilButton = document.getElementById("pencilbutton");
    pencilButton.addEventListener("click", function() {
        drawMode(pencilButton);
    });
   
    var selectionButton = document.getElementById("selectionbutton");
    selectionButton.addEventListener("click", function() {
        selectMode(selectionButton);
    });
    
    var moveButton = document.getElementById("movebutton");
    moveButton.addEventListener("click", function() {
        moveMode(moveButton);
    });

    editButtonsToBeUpdated.push(eraserButton);
    editButtonsToBeUpdated.push(pencilButton);
    editButtonsToBeUpdated.push(selectionButton);
    editButtonsToBeUpdated.push(moveButton);

    editButtonsToBeUpdated.forEach((btn) => {btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = CLICKED_ICON_BACKGROUND;
    })});

    // Add hover effect to the icons
    editButtonsToBeUpdated.forEach((btn) => {btn.addEventListener("mouseleave", () => {
        if (!((btn == eraserButton && isErasing)
            || (btn == pencilButton && isDrawing)
            || (btn == selectionButton && isSelecting)
            || (btn == moveButton && isMoving))) {

            btn.style.backgroundColor = ICON_BACKGROUND;        
        }        
    })});

    var colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach((option) => {option.addEventListener("click", pickColor)});

    var colorPicker = document.getElementById("colorpicker");
    colorPicker.addEventListener("input", pickColorFromPicker);

    var zoomSlider = document.getElementById("zoomslide");
    zoomSlider.addEventListener("input", (event) => {
        isSliding = true;
        updateCanvasScale(event, zoomSlider);
    });

    canvas = document.getElementById( "gl_canvas" );
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    gl = WebGLUtils.setupWebGL( canvas );    
    if ( !gl ) { alert( "WebGL isn't available" ); }  

    // Configure WebGL
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    // Create a view matrix (identity matrix)
    viewMatrix = mat4();

    // Load shaders and initialize attribute buffers
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program )
    
    canvas.addEventListener('wheel', (event) => {
        if (event.ctrlKey) {
            updateCanvasScale(event, zoomSlider);

            // Prevent the default scroll behavior
            event.preventDefault();
          }
    });

    canvas.addEventListener("mouseup", (event) => {        
        isOperating = false;
        isMouseDown = false;
        if (isMoving) {
            console.log("move1");
        } else {    
            currentStroke++;
        }
    });

    canvas.addEventListener("mousedown", (event) => {
        isOperating = true;
        isMouseDown = true;

        if (isMoving) {
            console.log("move2");
        } else {
            draw(event, canvas);
        }        
    });  

    canvas.addEventListener("mousemove", (event) => {
        if (isMouseDown && isMoving) {
            console.log("move3");
        } if (isMouseDown) {
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

    theBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, theBuffer);
  
    theColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, theColorBuffer);

    // updateViewMatrix();
};

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT); 

    const viewMatrixLocation = gl.getUniformLocation(program, "viewMatrix");
    gl.uniformMatrix4fv(viewMatrixLocation, false, flatten(viewMatrix));
    
    gl.bindBuffer(gl.ARRAY_BUFFER, theBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(allVertices), gl.STATIC_DRAW); 

    // Associate shader variables and draw the current buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, theColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(currentColorVec4), gl.STATIC_DRAW);
  
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    gl.drawArrays(gl.TRIANGLES, 0, allVertices.length);
}
