const GRID_SIZE = 15;
const RGB_COLOR_RANGE = 255.0;
const CLICKED_ICON_BACKGROUND = "#626366";
const ICON_BACKGROUND = "transparent";
const SELECTION_COLOR_BUFFER_DATA = [vec4(0.0, 0.0, 0.0, 1.0), vec4(0.0, 0.0, 0.0, 1.0), vec4(0.0, 0.0, 0.0, 1.0), vec4(0.0, 0.0, 0.0, 1.0)];
const SELECTED_TRIANGLE_COLOR = vec4(0.0, 0.0, 0.0, 1.0);
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 1000;
const DEF_SLIDER = 100;
const DEF_ZOOM = 1.0;
const MIN_SLIDER = 10;
const MAX_SLIDER = 200;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = calculateMaxZoom();
const IDENTITY_MT4 = mat4()

var zoomFactor = DEF_ZOOM;
var currentSlider = DEF_SLIDER;
var gl;
var canvas;
var canvasContainer;
var isDrawing = true; // defualt mode
var isErasing = false;
var isSelecting = false;
var isMouseDown = false;
var isSliding = false;
var isMoving = false;
var allBuffers = [];//
var pointsGrid = [];
var glGrid = [];
var gridCells = [];//
var program;
var zoom = 1.0;
var panX = 0.0;
var panY = 0.0;
var transX = 0.0;
var transY = 0.0;
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
var selectionBuffer;
var selectionColorBuffer;
var currentColorVec4 = [];
var currentColor = vec4(1.0, 0.0, 0.0, 1.0);
var currentColorHTMLId = null;
var editButtonsToBeUpdated = [];
var viewMatrix;
var currentCanvasWidth = CANVAS_WIDTH;
var sliderValueText;
// move variables
var startX;
var startY;
var updateSelectCoords1 = true;
var selectCoords1;
var selectCoords2;
var selectionRectangleVertices = [];
var selectedTriangleVertices = [];
var selectedTriangleColors = [];
var editButtonsToBeUpdated = []

const StrokeType = {
    Draw: "draw",
    Erase: "erase",
    Unknown: "unknown"
}

class Layer {
    constructor(id) {
        this.id = "l-" + id;
        this.isVisible = true;
    }

    setVisible(isVisible) {
        this.isVisible = isVisible;
    }
}

// layer variables
var layerNo = 0;
var lastLayerIdNo = -1;
var layerStack = [];
var activeLayerId = -1; // l-0
var layerAreaDiv;
console.log(layerStack)

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

function calculateMaxZoom() {
    const sliderRange = MAX_SLIDER - MIN_SLIDER;
    const ratio = (DEF_ZOOM - MIN_ZOOM) / (DEF_SLIDER - MIN_SLIDER)
    return MIN_ZOOM + sliderRange * ratio;
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

function moveCanvasMouseDown(event) {
    startX = event.clientX;
    startY = event.clientY;
}

function moveCanvas(event, canvas) {
    var deltaX = event.clientX - startX;
    var deltaY = event.clientY - startY;

    transX += deltaX;
    transY += deltaY;

    // transX = Math.min(transX, 200);
    // transY = Math.min(transY, 200);

    // Update panX and panY based on mouse movement
    panX += deltaX / (CANVAS_WIDTH / 2);
    panY -= deltaY / (CANVAS_WIDTH / 2);

    console.log("transX", transX)

    // Update the view matrix
    // updateViewMatrixMove();

    canvas.style.transform = `translate(${transX}px, ${transY}px)`;

    // Render the scene
    render();

    startX = event.clientX;
    startY = event.clientY;
}

function handleSelection(event, canvas) {
    if (!isSelecting) {
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // canvasX -> mouseX, canvasY -> mouseY
    var canvasX = (x / canvas.width) * 2 - 1;
    var canvasY = -((y / canvas.height) * 2 - 1);

    if (canvasX < -1) { canvasX = -1; }
    else if (canvasX > 1) { canvasX = 1; }

    if (canvasY < -1) { canvasY = -1; }
    else if (canvasY > 1) { canvasY = 1; }

    if (updateSelectCoords1) {
        selectCoords1 = vec2(canvasX, canvasY);
    }
    else {
        selectCoords2 = vec2(canvasX, canvasY);
    }

    updateSelectCoords1 = !updateSelectCoords1;
}

function handleSelectionContinous(event, canvas) {
    if (!isSelecting) {
        return;
    }
    else if (!updateSelectCoords1) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // canvasX -> mouseX, canvasY -> mouseY
        var canvasX = (x / canvas.width) * 2 - 1;
        var canvasY = -((y / canvas.height) * 2 - 1);

        if (canvasX < -1) { canvasX = -1; }
        else if (canvasX > 1) { canvasX = 1; }

        if (canvasY < -1) { canvasY = -1; }
        else if (canvasY > 1) { canvasY = 1; }

        selectCoords1 = vec2(canvasX, canvasY);

        updateSelectCoords1 = !updateSelectCoords1;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // canvasX -> mouseX, canvasY -> mouseY
    var canvasX = (x / canvas.width) * 2 - 1;
    var canvasY = -((y / canvas.height) * 2 - 1);

    if (canvasX < -1) { canvasX = -1; }
    else if (canvasX > 1) { canvasX = 1; }

    if (canvasY < -1) { canvasY = -1; }
    else if (canvasY > 1) { canvasY = 1; }

    selectCoords2 = vec2(canvasX, canvasY);

    // Calculate the other two coordinates
    if (selectCoords1 == undefined) {
        selectCoords1 = selectCoords2;
    }

    var coord3 = vec2(selectCoords1[0], selectCoords2[1]);
    var coord4 = vec2(selectCoords2[0], selectCoords1[1]);

    selectionRectangleVertices = [];
    selectionRectangleVertices.push(selectCoords1);
    selectionRectangleVertices.push(coord3);
    selectionRectangleVertices.push(selectCoords2);
    selectionRectangleVertices.push(coord4);

    renderSelection();
}

function isTriangleInsideSelection(curTriangle) {
    if (!isSelecting) {
        return false;
    }

    var corner1 = selectionRectangleVertices[0];
    var corner2 = selectionRectangleVertices[2];
    
    var topLeftX = corner1[0] < corner2[0] ? corner1[0] : corner2[0];
    var topLeftY = corner1[1] > corner2[1] ? corner1[1] : corner2[1];

    var bottomRightX = corner1[0] > corner2[0] ? corner1[0] : corner2[0];
    var bottomRightY = corner1[1] < corner2[1] ? corner1[1] : corner2[1];

    // For each vertex in the curTriangle,
    // check if the vertex is inside the selection triangle
    for (let i = 0; i < curTriangle.length; i++) {
        var curVertex = curTriangle[i];
        var curX = curVertex[0];
        var curY = curVertex[1];

        var isXinside = topLeftX <= curX && bottomRightX >= curX;
        var isYinside= topLeftY >= curY && bottomRightY <= curY;

        if (isXinside && isYinside) {
            // If we are here, that means that the current triangle is in the selection region
            return true;
        }
    }
    
    return false;
}

function handleSelectionMouseUp(event, canvas) {
    if (!isSelecting || !updateSelectCoords1) {
        return;
    }

    // Reset both selectedTriangleVertices and selectedTriangleColors (splice way is more performant)
    selectedTriangleVertices.splice(0, selectedTriangleVertices.length);
    selectedTriangleColors.splice(0, selectedTriangleColors.length);

    // We are here if there is a complete selection
    // Traverse all triangles
    for (let i = 0; i < allVertices.length; i = i + 3) {
        // Check if any vertex of the triangle is inside the selected area
        var curTriangle = [allVertices[i], allVertices[i + 1], allVertices[i + 2]];
        
        if (isTriangleInsideSelection(curTriangle)) {
            // If we are here, then the current triangle is inside the selection area
            selectedTriangleVertices.push(allVertices[i]);
            selectedTriangleVertices.push(allVertices[i + 1]);
            selectedTriangleVertices.push(allVertices[i + 2]);

            selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
            selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
            selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
        }
    }

    if (selectedTriangleVertices.length == 0 || selectedTriangleColors.length == 0) {
        // If no selection has been detected, check if the cursor is inside a triangle
        var corner1 = selectionRectangleVertices[0];
        var corner2 = selectionRectangleVertices[2];

        // For every triangle
        for (let i = 0; i < allVertices.length; i = i + 3) {
            var curTriangle = [allVertices[i], allVertices[i + 1], allVertices[i + 2]];

            // Check for intersection between the selection area and the current triangle
            if (pointInTriangle(corner1, curTriangle) || pointInTriangle(corner2, curTriangle)) {
                selectedTriangleVertices.push(allVertices[i]);
                selectedTriangleVertices.push(allVertices[i + 1]);
                selectedTriangleVertices.push(allVertices[i + 2]);

                selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
                selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
                selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
            }
        }
    }

    renderSelectedTriangles();
}

function pointInTriangle(point, triangle) {
    var vertex1 = triangle[0];
    var vertex2 = triangle[1];
    var vertex3 = triangle[2];

    var x1 = vertex1[0];
    var y1 = vertex1[1];

    var x2 = vertex2[0];
    var y2 = vertex2[1];

    var x3 = vertex3[0];
    var y3 = vertex3[1];

    // Calculate the determinant of the matrix formed
    // by the coordinates of the three vertices of the triangle
    // This value (detT) is used for a kind of normalization
    var detT = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);

    // Calculate the barycentric coordinate related to vertex2 of the triangle
    var barycentricVertex2 = ((y2 - y3) * (point[0] - x3) + (x3 - x2) * (point[1] - y3)) / detT;

    // Calculate the barycentric coordinate related to vertex3 of the triangle
    var barycentricVertex3 = ((y3 - y1) * (point[0] - x3) + (x1 - x3) * (point[1] - y3)) / detT;

    // Calculate the barycentric coordinate related to vertex1 of the triangle
    var barycentricVertex1 = 1 - barycentricVertex2 - barycentricVertex3;

    // If all barycentricVertex1, barycentricVertex2 and barycentricVertex3 are greater than or equal to zero, point is in the triangle
    return barycentricVertex1 >= 0 && barycentricVertex2 >= 0 && barycentricVertex3 >= 0;
}

function draw(event, canvas) {
    try {
        drawHandler(event, canvas);
    } catch (error) {
        return;
    }
}

function drawHandler(event, canvas) {
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
    else if (isSelecting) {
        // selectCoords1 = vec2(canvasX, canvasY);
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
  
    render();
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

function updateViewMatrixMove() {
    var translationMatrix = translate(panX, panY, 0);
    viewMatrix = mult(translationMatrix, mat4());
}

function updateViewMatrix() {
    zoomFactor = zoomFactor.toFixed(2);
    // viewMatrix = translate([1,1,0])    
    // viewMatrix = scale(zoomFactor, zoomFactor, 1.0);
    // viewMatrix = scale(2.0, 2.0, 2.0);
    // viewMatrix = mult(viewMatrix, scalingMatrix);

    // Update the canvas size based on the zoom
    const newCanvasWidth = CANVAS_WIDTH * zoomFactor;
    const newCanvasHeight = CANVAS_HEIGHT * zoomFactor;

    canvas.width = Math.floor(newCanvasWidth);
    canvas.height = Math.floor(newCanvasHeight);

    containerStyle =  getComputedStyle(canvasContainer);

    canvasContainer.width = Math.max(parseInt(containerStyle.width, 10), canvas.width + 3000);
    canvasContainer.height = Math.max(parseInt(containerStyle.height, 10), canvas.height + 300);

    console.log("new height", canvasContainer.height)
    // Update the viewport
    gl.viewport(0, 0, newCanvasWidth, newCanvasHeight);
    render();
}

function updateCanvasScale(event, slideBtn) {
    let sliderValue;

    if (isSliding) {
        sliderValue = slideBtn.value;
        zoomFactor = sliderToZoom(sliderValue, MAX_ZOOM, MIN_ZOOM, MAX_SLIDER, MIN_SLIDER);
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

        sliderValue = zoomToSlider(zoomFactor, MAX_ZOOM, MIN_ZOOM, MAX_SLIDER, MIN_SLIDER);
        console.log("value:", sliderValue)
    }

    slideBtn.value = sliderValue;
    sliderValueText.textContent = `${parseInt(sliderValue)}%`;

    updateViewMatrix();
    render();
}

function zoomToSlider(zoom, maxZoom, minZoom, maxSlide, minSlide) {
    // Ensure that the input zoom is valid
    zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    zoomFactor = zoom;

    // Calculate the slide based on the zoom and the range of slides
    const slideRange = maxSlide - minSlide;
    const zoomRange = maxZoom - minZoom;
    const relativeZoom = (zoom - minZoom) / zoomRange;
    const slide = Math.round(minSlide + relativeZoom * slideRange);

    return slide;
}

function sliderToZoom(slide, maxZoom, minZoom, maxSlide, minSlide) {
    // Ensure that the input slide is within the valid range
    slide = Math.max(minSlide, Math.min(maxSlide, slide));

    // Calculate the zoom level based on the slide and the range of slides
    const slideRange = maxSlide - minSlide;
    const zoomRange = maxZoom - minZoom;
    const relativeSlide = (slide - minSlide) / slideRange;
    const zoom = minZoom + relativeSlide * zoomRange;

    return zoom;
}

window.onload = function init() {
    currentStroke = 0;

    // Add event listener for each button
    sliderValueText = document.getElementById("slidertext");
    layerAreaDiv = document.getElementById("layer-area");

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

 

    addFirstLayer();

    var plusLayerButton = document.getElementById("plusbtn");
    plusLayerButton.addEventListener("click", addLayer);

    var deleteLayerButton = document.getElementById("binbtn");
    deleteLayerButton.addEventListener("click", deleteLayer);

    var upLayerButton = document.getElementById("upbtn");
    upLayerButton.addEventListener("click", moveUpLayer);
    
    var downLayerButton = document.getElementById("downbtn");
    downLayerButton.addEventListener("click", moveDownLayer);

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

    // load file related events
    document.getElementById('filebutton').addEventListener('click', () => {
        document.getElementById('tripaintinput').click();
    });

    document.getElementById('tripaintinput').addEventListener('change', function () {
        var selectedFile = this.files[0];

        loadFile(selectedFile);
    });

    canvas = document.getElementById( "gl_canvas" );
    canvasContainer = document.getElementById( "canvas-container" );
    console.log("get container", getComputedStyle(canvasContainer).width)
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
    gl.useProgram( program );
    
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
      
        if (isSelecting) {
            handleSelectionMouseUp(event, canvas);
        }
        else {
            currentStroke++;
        }
    });

    canvas.addEventListener("mousedown", (event) => {
        isOperating = true;
        isMouseDown = true;
      
        if (isMoving) {
            moveCanvasMouseDown(event);
        }
        else {
            draw(event, canvas);
            handleSelectionContinous(event, canvas);
        }        
    });  

    canvas.addEventListener("mousemove", (event) => {
        if (!isMouseDown) {
            return;
        }

        if (isDrawing || isErasing) {
            draw(event, canvas);
        }

        if (isSelecting) {
            handleSelectionContinous(event, canvas);
        }
      
        if (isMoving) {
            moveCanvas(event, canvas);
        }
    });      

    canvas.addEventListener("click", (event) => {
        handleSelection(event, canvas);
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

    selectionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionBuffer);

    theBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, theBuffer);
  
    theColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, theColorBuffer);

    selectionColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionColorBuffer);

    render();
};

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
}

function copySelection() {
    updateButtonBackground();
    resetAllModes();
}

function pasteSelection() {
    updateButtonBackground();
    resetAllModes();
}

function openFile() {
    updateButtonBackground();
    resetAllModes();
}

function saveFile() {
    updateButtonBackground();
    resetAllModes();

    createAndDownloadJSONFile();
}

function changeLayerVis(layerId, img) {
    var curLayer = layerStack.filter((layer) => layer.id == layerId)[0];
    console.log("Alio1", curLayer)

    if (curLayer.isVisible) {
        console.log("Alio2")
        curLayer.setVisible(false);
        img.src = './icons/icons8-not-visible-30.png';
    } else {
        console.log("Alio3")
        curLayer.setVisible(true);
        img.src = './icons/icons8-eye-30.png';
    }
}

function addLayer() {
    lastLayerIdNo++;
    layerNo++;

    layerStack.push(new Layer(lastLayerIdNo));
    const [visButton, layerDiv] = createLayerDiv(lastLayerIdNo);

    visButton.addEventListener("click", function() {
        const layerId = this.getAttribute('value');
        const img = this.querySelector('img');
        console.log("Alio")
        changeLayerVis(layerId, img);
    }); 

    layerDiv.addEventListener("click", function() {
        document.getElementById(activeLayerId).style.backgroundColor = "#c7c7c7bc";
        activeLayerId = this.id;
        layerDiv.style.backgroundColor = "#8d8db2";
    }); 

    return layerDiv;
}

function addFirstLayer() {
    if (layerNo != 0) {
        return;
    }

    const newLayer = addLayer();
    newLayer.style.backgroundColor = "#8d8db2";

    activeLayerId = "l-" + lastLayerIdNo;
}

function createLayerDiv(layerIdNo) {
    // Create a <div> element with the class and ID attributes
    const layerDiv = document.createElement('div');
    layerDiv.classList.add('layer');
    layerDiv.id = 'l-' + layerIdNo;

    // Create a <p> element and set its content
    const pElement = document.createElement('p');
    pElement.textContent = `Layer ${layerIdNo + 1}`;

    // Create a <button> element with the class and value attributes
    const buttonElement = document.createElement('button');
    buttonElement.classList.add('icon-button', 'layer-button', 'visible-button');
    buttonElement.value = 'l-' + layerIdNo;

    // Create an <img> element and set its src and alt attributes
    const imgElement = document.createElement('img');
    imgElement.src = './icons/icons8-eye-30.png';
    imgElement.alt = 'Visible Layer Icon';

    // Append the <img> element to the <button> element
    buttonElement.appendChild(imgElement);

    // Append the <p> element and <button> element to the <div> element
    layerDiv.appendChild(pElement);
    layerDiv.appendChild(buttonElement);

    // Append the <div> element to the document (or any other desired parent element)
    layerAreaDiv.appendChild(layerDiv);

    return [buttonElement, layerDiv];
}

function removeLayerDiv() {
    const layerDiv = document.getElementById(activeLayerId);

    if (layerDiv) {
        layerDiv.remove();
    }
}

function deleteLayer() {
    console.log("active:", activeLayerId)
    // There should be at least one layer
    if (layerNo <= 1) {
        return;
    }

    removeLayerDiv();

    var index = layerStack.findIndex((layer) => layer.id === activeLayerId);
    
    layerStack.splice(index, 1);
    layerNo--;

    if (index != 0) {
        activeLayerId = layerStack[index - 1].id;
    }
    else {
        activeLayerId = layerStack[index].id;
    }

    document.getElementById(activeLayerId).style.backgroundColor = "#8d8db2";
}

function moveDownLayer() {
    const layers = document.querySelectorAll('.layer');
    var index = layerStack.findIndex((layer) => layer.id === activeLayerId);

    if (index < layerStack.length - 1) {
        layerAreaDiv.insertBefore(layers[index + 1], layers[index]);
        swapLayers(index, index + 1)
    }  
}

function moveUpLayer() {
    const layers = document.querySelectorAll('.layer');
    var index = layerStack.findIndex((layer) => layer.id === activeLayerId);

    if (index > 0) {
        layerAreaDiv.insertBefore(layers[index], layers[index - 1]);
        swapLayers(index, index - 1)
    }    
}

function swapLayers(curLayerIndex, swapLayerIndex) {
    var curLayer = layerStack[curLayerIndex];
    var temp = layerStack[swapLayerIndex];

    layerStack[swapLayerIndex] = curLayer;
    layerStack[curLayerIndex] = temp;
}

function loadFile(file) {
    if (file) {
        var reader = new FileReader();

        // Callback function to run after the file is read
        reader.onload = function(event) {
            var jsonContent = event.target.result;

            // Parse the JSON data
            try {
                var jsonData = JSON.parse(jsonContent);

                console.log(jsonData);
            } catch (error) {
                console.error("Error parsing JSON:", error);
            }
        };

        // Read the file
        reader.readAsText(file);
    }
}

function createAndDownloadJSONFile() {
    var jsonData = {
        name: ["John Doe", "abc", 2],
        age: 30,
        email: "john@example.com"
    };

    // Convert the object to a JSON string          // number of spaces before json values
    var jsonContent = JSON.stringify(jsonData, null, 2);
    var blob = new Blob([jsonContent], { type: 'application/json' });

    // Create a URL for the Blob
    var url = window.URL.createObjectURL(blob);

    // Create an anchor element to trigger the download
    var a = document.createElement('a');
    a.href = url;
    a.download = "canvas.tripaint"; // Set the desired file name with a .json extension
    document.body.appendChild(a);

    // Click the anchor to start the download
    a.click();

    // Clean up
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function renderSelectedTriangles() {
    render();

    var borderVertices = [];
    var borderColors = [];

    // For every selected triangle, create relevant border data
    for (var i = 0; i < selectedTriangleVertices.length; i += 3) {
        var vertex1 = selectedTriangleVertices[i];
        var vertex2 = selectedTriangleVertices[i + 1];
        var vertex3 = selectedTriangleVertices[i + 2];

        // Below contains the vertex data for the lines of the border
        var lines = [
            vertex1, vertex2,
            vertex2, vertex3,
            vertex3, vertex1
        ];

        borderVertices.push(lines[0]);
        borderVertices.push(lines[1]);
        borderVertices.push(lines[2]);
        borderVertices.push(lines[3]);
        borderVertices.push(lines[4]);
        borderVertices.push(lines[5]);

        borderColors.push(SELECTED_TRIANGLE_COLOR);
        borderColors.push(SELECTED_TRIANGLE_COLOR);
        borderColors.push(SELECTED_TRIANGLE_COLOR);
        borderColors.push(SELECTED_TRIANGLE_COLOR);
        borderColors.push(SELECTED_TRIANGLE_COLOR);
        borderColors.push(SELECTED_TRIANGLE_COLOR);
    }

    // Selection Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(borderVertices), gl.STATIC_DRAW);

    // Associate shader variables and draw the selection buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Selection Color Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(borderColors), gl.STATIC_DRAW);

    // Associate shader variables and draw the color buffer
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    gl.drawArrays(gl.LINES, 0, selectedTriangleVertices.length * 2); // Double the number of vertices
}

function renderSelection() {
    render();

    // Selection Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(selectionRectangleVertices), gl.STATIC_DRAW);

    // Associate shader variables and draw the selection buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Selection Color Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(SELECTION_COLOR_BUFFER_DATA), gl.STATIC_DRAW);
  
    // Associate shader variables and draw the color buffer
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    gl.drawArrays(gl.LINE_LOOP, 0, 4);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT); 

    const viewMatrixLocation = gl.getUniformLocation(program, "viewMatrix");
    gl.uniformMatrix4fv(viewMatrixLocation, false, flatten(viewMatrix));

    // Vertex Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, theBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(allVertices), gl.STATIC_DRAW); 

    // Associate shader variables and draw the vertex buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Color Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, theColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(currentColorVec4), gl.STATIC_DRAW);
  
    // Associate shader variables and draw the color buffer
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    gl.drawArrays(gl.TRIANGLES, 0, allVertices.length);
}
