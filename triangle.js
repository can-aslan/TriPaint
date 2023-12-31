const GRID_SIZE = 15;
const RGB_COLOR_RANGE = 255.0;
const UNDO_MAX_OPS = 50;
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
var isMoveSelectionButtonMode = false;
var isCopying = false;
var hasCompleteSelection = false;
var isMovingCompleteSelection = false;
var startSelectionX;
var startSelectionY;
var isMouseDown = false;
var isSliding = false;
var isMoving = false;
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
var allVertices = {};
var theBuffer = {};
var currentColorVec4 = {};
var theColorBuffer = {};
var selectionBuffer;
var selectionColorBuffer;
var currentColor = vec4(1.0, 0.0, 0.0, 1.0);
var currentColorHTMLId = null;
var editButtonsToBeUpdated = [];
var viewMatrix;
var currentCanvasWidth = CANVAS_WIDTH;
var sliderValueText;
var startX;
var startY;
var updateSelectCoords1 = true;
var selectCoords1;
var selectCoords2;
var selectionRectangleVertices = [];
var selectedTriangleVertices = [];
var newSelectedTrianglesVertices = [];
var originalSelectedTriangleVertices = [];
var selectedTriangleColors = [];
var selectedTriangleActualColors = [];
var selectedAreaStartTriangle = [];
var selectedAreaStartCell = [];
var editButtonsToBeUpdated = [];
var layerNo = 0;
var lastLayerIdNo = -1;
var layerStack = [];
var activeLayerId = -1; // l-0
var activeLayer = null;
var layerAreaDiv;

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

class Stroke {
    constructor(triangle, color, type, layerId) {
        this.triangle = triangle;
        this.color = color;
        this.layerId = layerId;

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

    isSameAs(otherCell) {
        return (
            this.p1[0] === otherCell.p1[0] &&
            this.p1[1] === otherCell.p1[1] &&
            this.p2[0] === otherCell.p2[0] &&
            this.p2[1] === otherCell.p2[1] &&
            this.p3[0] === otherCell.p3[0] &&
            this.p3[1] === otherCell.p3[1] &&
            this.p4[0] === otherCell.p4[0] &&
            this.p4[1] === otherCell.p4[1] &&
            this.p5[0] === otherCell.p5[0] &&
            this.p5[1] === otherCell.p5[1]
        );
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

    // Update panX and panY based on mouse movement
    panX += deltaX / (CANVAS_WIDTH / 2);
    panY -= deltaY / (CANVAS_WIDTH / 2);

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

function getClickedCell(event, canvas) {
    // Find the triangle the mouse is on
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
    return gridCells[gridX][gridY];
}

function getClickedSubTriangle(event, canvas) {
    // Find the triangle the mouse is on
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
    return [
        shortestPt,
        secondShortestPt,
        cellClicked.p5
    ];
}

function moveSelectionContinuos(event, canvas) {
    if ((!isMoveSelectionButtonMode && !isCopying) || !hasCompleteSelection || selectedTriangleVertices.length <= 0) {
        return;
    }

    // Find the triangle the mouse is on
    if (selectedAreaStartTriangle.length <= 0 || selectedAreaStartCell.length <= 0) {
        // selectedAreaStartTriangle is the starting triangle (that the mouse is on)
        selectedAreaStartTriangle = getClickedSubTriangle(event, canvas); // <- DO NOT REMOVE!
        selectedAreaStartCell = getClickedCell(event, canvas);
    }

    var xChange = 0.0;
    var yChange = 0.0;

    var currentCell = getClickedCell(event, canvas);

    // If we are here, we have to change cells
    if (!selectedAreaStartCell.isSameAs(currentCell)) {
        newSelectedTrianglesVertices.splice(0, newSelectedTrianglesVertices.length);

        xChange = currentCell.p5[0] - selectedAreaStartCell.p5[0];
        yChange = currentCell.p5[1] - selectedAreaStartCell.p5[1];

        for (let i = 0; i < selectedTriangleVertices.length; i++) {
            newSelectedTrianglesVertices.push(new vec2(selectedTriangleVertices[i][0] + xChange, selectedTriangleVertices[i][1] + yChange));
        }

        selectedTriangleVertices.splice(0, selectedTriangleVertices.length);
        
        for (let j = 0; j < newSelectedTrianglesVertices.length; j++) {
            selectedTriangleVertices.push(newSelectedTrianglesVertices[j]);
        }

        selectedAreaStartCell = currentCell;
    }

    renderSelectedTrianglesWithBorderAndColor();
}

function handleSelectionMovementMouseUp(event, canvas) {
    if (!isMoveSelectionButtonMode || !hasCompleteSelection) {
        return;
    }

    var visitedVertex = [];
    var visitedBefore = false;
                
    if (strokes[currentStroke] === undefined) {
        strokes[currentStroke] = [];
    }

    if (lastOpWasUndoOrRedo) { // If drawing right after undo, remove previous undone ops
        undoneStrokes.splice(0, undoneStrokes.length);
    }

    currentStroke++; // increased for adding all
                
    if (strokes[currentStroke] === undefined) {
        strokes[currentStroke] = [];
    }

    if (lastOpWasUndoOrRedo) { // If drawing right after undo, remove previous undone ops
        undoneStrokes.splice(0, undoneStrokes.length);
    }

    const allVerticesActive = allVertices[activeLayerId]; 
    const currentColorVec4Active = currentColorVec4[activeLayerId]; 

    // Move all in the original to the locations in the selectedTriangleVertices
    for (let i = 0; i < originalSelectedTriangleVertices.length; i = i + 3) {
        var originalVertex1 = originalSelectedTriangleVertices[i];
        var originalVertex2 = originalSelectedTriangleVertices[i + 1];
        var originalVertex3 = originalSelectedTriangleVertices[i + 2];

        var movedVertex1 = selectedTriangleVertices[i];
        var movedVertex2 = selectedTriangleVertices[i + 1];
        var movedVertex3 = selectedTriangleVertices[i + 2];

        for (let j = 0; j < visitedVertex.length; j++) {
            if (
                visitedVertex[j][0] == originalVertex1[0] && visitedVertex[j][1] == originalVertex1[1]
                && visitedVertex[j + 1][0] == originalVertex2[0] && visitedVertex[j + 1][1] == originalVertex2[1]
                && visitedVertex[j + 2][0] == originalVertex3[0] && visitedVertex[j + 2][1] == originalVertex3[1]
            ) {
                // If we are here, vertex is visited before
                visitedBefore = true;
                break;
            }
        }

        if (visitedBefore) {
            visitedBefore = false;
            continue;
        }
        
        visitedVertex.push(originalVertex1);
        visitedVertex.push(originalVertex2);
        visitedVertex.push(originalVertex3);

        for (let k = 0; k < allVerticesActive.length; k = k + 3) {
            var curV1 = allVerticesActive[k];
            var curV2 = allVerticesActive[k + 1];
            var curV3 = allVerticesActive[k + 2];

            if (
                curV1[0] == originalVertex1[0] && curV1[1] == originalVertex1[1]
                && curV2[0] == originalVertex2[0] && curV2[1] == originalVertex2[1]
                && curV3[0] == originalVertex3[0] && curV3[1] == originalVertex3[1]
            ) {
                // Save remove step as a erase operation so we can undo/redo
                var triV = [
                    allVerticesActive[k],
                    allVerticesActive[k + 1],
                    allVerticesActive[k + 2]
                ];

                var triC = [
                    currentColorVec4Active[k],
                    currentColorVec4Active[k + 1],
                    currentColorVec4Active[k + 2]
                ];

                strokes[currentStroke - 1].push(new Stroke(triV, triC[0], StrokeType.Erase, activeLayerId));
            }
        }

        for (let k = 0; k < allVerticesActive.length; k = k + 3) {
            var curV1 = allVerticesActive[k];
            var curV2 = allVerticesActive[k + 1];
            var curV3 = allVerticesActive[k + 2];

            if (
                curV1[0] == originalVertex1[0] && curV1[1] == originalVertex1[1]
                && curV2[0] == originalVertex2[0] && curV2[1] == originalVertex2[1]
                && curV3[0] == originalVertex3[0] && curV3[1] == originalVertex3[1]
            ) {
                // If we are here, this vertex needs to be moved to the correct position
                allVerticesActive[k] = new vec2(movedVertex1[0], movedVertex1[1]);
                allVerticesActive[k + 1] = new vec2(movedVertex2[0], movedVertex2[1]);
                allVerticesActive[k + 2] = new vec2(movedVertex3[0], movedVertex3[1]);

                // Save add step as a draw operation so we can undo/redo
                var newTri = [
                    allVerticesActive[k],
                    allVerticesActive[k + 1],
                    allVerticesActive[k + 2]
                ]

                strokes[currentStroke].push(new Stroke(newTri, currentColorVec4Active[k], StrokeType.Draw, activeLayerId));

                lastOpWasUndoOrRedo = false;
                
                continue;
            }
        }

        lastOpWasUndoOrRedo = false;
    }

    currentStroke++;
}

function handleCopyMovementMouseUp(event, canvas) {
    if (!isCopying || !hasCompleteSelection) {
        return;
    }

    var visitedVertex = [];
    var visitedBefore = false;

    const allVerticesActive = allVertices[activeLayerId]; 
    const currentColorVec4Active = currentColorVec4[activeLayerId]; 

    if (strokes[currentStroke] === undefined) {
        strokes[currentStroke] = [];
    }

    if (lastOpWasUndoOrRedo) { // If drawing right after undo, remove previous undone ops
        undoneStrokes.splice(0, undoneStrokes.length);
    }

    // Move all in the original to the locations in the selectedTriangleVertices
    for (let i = 0; i < originalSelectedTriangleVertices.length; i = i + 3) {
        var originalVertex1 = originalSelectedTriangleVertices[i];
        var originalVertex2 = originalSelectedTriangleVertices[i + 1];
        var originalVertex3 = originalSelectedTriangleVertices[i + 2];

        var movedVertex1 = selectedTriangleVertices[i];
        var movedVertex2 = selectedTriangleVertices[i + 1];
        var movedVertex3 = selectedTriangleVertices[i + 2];

        for (let j = 0; j < visitedVertex.length; j++) {
            if (
                visitedVertex[j][0] == originalVertex1[0] && visitedVertex[j][1] == originalVertex1[1]
                && visitedVertex[j + 1][0] == originalVertex2[0] && visitedVertex[j + 1][1] == originalVertex2[1]
                && visitedVertex[j + 2][0] == originalVertex3[0] && visitedVertex[j + 2][1] == originalVertex3[1]
            ) {
                // If we are here, vertex is visited before
                visitedBefore = true;
                break;
            }
        }

        if (visitedBefore) {
            visitedBefore = false;
            continue;
        }
        
        visitedVertex.push(originalVertex1);
        visitedVertex.push(originalVertex2);
        visitedVertex.push(originalVertex3);

        for (let k = 0; k < allVerticesActive.length; k = k + 3) {
            var curV1 = allVerticesActive[k];
            var curV2 = allVerticesActive[k + 1];
            var curV3 = allVerticesActive[k + 2];

            if (
                curV1[0] == originalVertex1[0] && curV1[1] == originalVertex1[1]
                && curV2[0] == originalVertex2[0] && curV2[1] == originalVertex2[1]
                && curV3[0] == originalVertex3[0] && curV3[1] == originalVertex3[1]
            ) {
                // If we are here, this vertex needs to be moved to the correct position
                allVerticesActive.push(new vec2(movedVertex1[0], movedVertex1[1]));
                allVerticesActive.push(new vec2(movedVertex2[0], movedVertex2[1]));
                allVerticesActive.push(new vec2(movedVertex3[0], movedVertex3[1]));

                currentColorVec4Active.push(currentColorVec4Active[k]);
                currentColorVec4Active.push(currentColorVec4Active[k]);
                currentColorVec4Active.push(currentColorVec4Active[k]);

                // Save add step as a draw operation so we can undo/redo
                var newTri = [
                    new vec2(movedVertex1[0], movedVertex1[1]),
                    new vec2(movedVertex2[0], movedVertex2[1]),
                    new vec2(movedVertex3[0], movedVertex3[1])
                ]

                strokes[currentStroke].push(new Stroke(newTri, currentColorVec4Active[k], StrokeType.Draw, activeLayerId));

                lastOpWasUndoOrRedo = false;
                
                continue;
            }
        }

        lastOpWasUndoOrRedo = false;
    }

    currentStroke++;
    render();
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
    
    const allVerticesActive = allVertices[activeLayerId]; 
    const currentColorVec4Active = currentColorVec4[activeLayerId]; 

    // Reset selectedTriangleVertices, selectedTriangleColors and selectedTriangleActualColors (splice way is more performant)
    selectedTriangleVertices.splice(0, selectedTriangleVertices.length);
    selectedTriangleColors.splice(0, selectedTriangleColors.length);
    selectedTriangleActualColors.splice(0, selectedTriangleActualColors.length);

    // We are here if there is a complete selection
    // Traverse all triangles
    for (let i = 0; i < allVerticesActive.length; i = i + 3) {
        // Check if any vertex of the triangle is inside the selected area

        var curTriangle = [allVerticesActive[i], allVerticesActive[i + 1], allVerticesActive[i + 2]];

        if (isTriangleInsideSelection(curTriangle)) {
            // If we are here, then the current triangle is inside the selection area
            selectedTriangleVertices.push(allVerticesActive[i]);
            selectedTriangleVertices.push(allVerticesActive[i + 1]);
            selectedTriangleVertices.push(allVerticesActive[i + 2]);

            selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
            selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
            selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);

            selectedTriangleActualColors.push(currentColorVec4Active[i]);
            selectedTriangleActualColors.push(currentColorVec4Active[i + 1]);
            selectedTriangleActualColors.push(currentColorVec4Active[i + 2]);
        }
    }

    if (selectedTriangleVertices.length == 0 || selectedTriangleColors.length == 0 || selectedTriangleActualColors.length == 0) {
        // If no selection has been detected, check if the cursor is inside a triangle
        var corner1 = selectionRectangleVertices[0];
        var corner2 = selectionRectangleVertices[2];

        // For every triangle
        for (let i = 0; i < allVerticesActive.length; i = i + 3) {
            var curTriangle = [allVerticesActive[i], allVerticesActive[i + 1], allVerticesActive[i + 2]];

            // Check for intersection between the selection area and the current triangle
            if (pointInTriangle(corner1, curTriangle) || pointInTriangle(corner2, curTriangle)) {
                selectedTriangleVertices.push(allVerticesActive[i]);
                selectedTriangleVertices.push(allVerticesActive[i + 1]);
                selectedTriangleVertices.push(allVerticesActive[i + 2]);

                selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
                selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);
                selectedTriangleColors.push(SELECTED_TRIANGLE_COLOR);

                selectedTriangleActualColors.push(currentColorVec4Active[i]);
                selectedTriangleActualColors.push(currentColorVec4Active[i + 1]);
                selectedTriangleActualColors.push(currentColorVec4Active[i + 2]);
            }
        }
    }

    originalSelectedTriangleVertices.splice(0, originalSelectedTriangleVertices.length);
    for (let j = 0; j < selectedTriangleVertices.length; j++) {
        originalSelectedTriangleVertices.push(selectedTriangleVertices[j]);
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
        // Get allVertices of the active layer
        const allVerticesActive = allVertices[activeLayerId]; 
        const currentColorVec4Active = currentColorVec4[activeLayerId]; 

        allVerticesActive.push(clickedTriangle[0]);
        allVerticesActive.push(clickedTriangle[1]);
        allVerticesActive.push(clickedTriangle[2]);

        currentColorVec4Active.push(currentColor);
        currentColorVec4Active.push(currentColor);
        currentColorVec4Active.push(currentColor);

        strokes[currentStroke].push(new Stroke(clickedTriangle, currentColor, StrokeType.Draw, activeLayerId));
    }
    else if (isErasing) {
        const allVerticesActive = allVertices[activeLayerId]; 
        const currentColorVec4Active = currentColorVec4[activeLayerId]; 

        for (let i = 0; i < allVerticesActive.length; i = i + 3) {
            if (isSameTriangle(i, clickedTriangle, activeLayerId)) {
                strokes[currentStroke].push(new Stroke(allVerticesActive.splice(i, 3), currentColorVec4Active.splice(i, 3)[0], StrokeType.Erase, activeLayerId));
            }
        }
    }

    lastOpWasUndoOrRedo = false;
    render();
}

function comparePointFloationPointWithAccuracy(i, j, accuracy) {
    return (i[0] == j[0] || Math.abs(i[0] - j[0]) <= accuracy) && (i[1] == j[1] || Math.abs(i[1] - j[1]) <= accuracy);
}

// Checks if the given clicked triangle exists in the
// first three (after allVerticesStartingIndex) items in the allVertices array
function isSameTriangle(allVerticesStartingIndex, clickedTriangle, layerId) {
    const allVerticesActive = allVertices[layerId]; 
    const ACCURACY = 0.01;

    let clickedShortestExists =
        comparePointFloationPointWithAccuracy(allVerticesActive[allVerticesStartingIndex], clickedTriangle[0], ACCURACY)
        || comparePointFloationPointWithAccuracy(allVerticesActive[allVerticesStartingIndex + 1], clickedTriangle[0], ACCURACY)
        || comparePointFloationPointWithAccuracy(allVerticesActive[allVerticesStartingIndex + 2], clickedTriangle[0], ACCURACY);

    let clickedSecondShortestExists =
        comparePointFloationPointWithAccuracy(allVerticesActive[allVerticesStartingIndex], clickedTriangle[1], ACCURACY)
        || comparePointFloationPointWithAccuracy(allVerticesActive[allVerticesStartingIndex + 1], clickedTriangle[1], ACCURACY)
        || comparePointFloationPointWithAccuracy(allVerticesActive[allVerticesStartingIndex + 2], clickedTriangle[1], ACCURACY);

    let clickedCenterExists =
        comparePointFloationPointWithAccuracy(allVerticesActive[allVerticesStartingIndex], clickedTriangle[2], ACCURACY)
        || comparePointFloationPointWithAccuracy(allVerticesActive[allVerticesStartingIndex + 1], clickedTriangle[2], ACCURACY)
        || comparePointFloationPointWithAccuracy(allVerticesActive[allVerticesStartingIndex + 2], clickedTriangle[2], ACCURACY);

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
    
    if (strokes.length >= UNDO_MAX_OPS) {
        strokes.splice(0, 1);
        currentStroke--;
    }
    
    var undoneStroke = strokes.splice(currentStroke - 1, 1);
    undoneStrokes.push(undoneStroke[0]);

    for (let index = 0; index < undoneStroke[0].length; index++) {
        var currentStrokeObj = undoneStroke[0][index];
        var curTriangle = currentStrokeObj.triangle;
        var curColor = currentStrokeObj.color;

        if (currentStrokeObj.type == StrokeType.Draw) {
            for (let i = 0; i < allVertices[currentStrokeObj.layerId].length; i = i + 3) {
                if (currentColorVec4[currentStrokeObj.layerId][i] == curColor && isSameTriangle(i, curTriangle, currentStrokeObj.layerId)) {
                    allVertices[currentStrokeObj.layerId].splice(i, 3);
                    currentColorVec4[currentStrokeObj.layerId].splice(i, 3);

                    break;
                }
            }
        }
        else if (currentStrokeObj.type == StrokeType.Erase) {
            allVertices[currentStrokeObj.layerId].push(curTriangle[0]);
            allVertices[currentStrokeObj.layerId].push(curTriangle[1]);
            allVertices[currentStrokeObj.layerId].push(curTriangle[2]);

            currentColorVec4[currentStrokeObj.layerId].push(curColor);
            currentColorVec4[currentStrokeObj.layerId].push(curColor);
            currentColorVec4[currentStrokeObj.layerId].push(curColor);
        }
    }

    currentStroke--;

    lastOpWasUndoOrRedo = true;
    render();
}

function redoLastUndoneStroke() {
    updateButtonBackground();
    
    if (undoneStrokes.length < 1) { return; }

    if (strokes.length >= UNDO_MAX_OPS) {
        strokes.splice(0, 1);
        currentStroke--;
    }

    var redoneStroke = undoneStrokes.splice(undoneStrokes.length - 1, 1);

    for (let index = 0; index < redoneStroke[0].length; index++) {
        var currentStrokeObj = redoneStroke[0][index];
        var curTriangle = currentStrokeObj.triangle;
        var curColor = currentStrokeObj.color;

        if (currentStrokeObj.type == StrokeType.Draw) {
            allVertices[currentStrokeObj.layerId].push(curTriangle[0]);
            allVertices[currentStrokeObj.layerId].push(curTriangle[1]);
            allVertices[currentStrokeObj.layerId].push(curTriangle[2]);

            currentColorVec4[currentStrokeObj.layerId].push(curColor);
            currentColorVec4[currentStrokeObj.layerId].push(curColor);
            currentColorVec4[currentStrokeObj.layerId].push(curColor);
        }
        else if (currentStrokeObj.type == StrokeType.Erase) {
            for (let i = 0; i < allVertices[currentStrokeObj.layerId].length; i = i + 3) {
                if (currentColorVec4[currentStrokeObj.layerId][i] == curColor && isSameTriangle(i, curTriangle, currentStrokeObj.layerId)) {
                    allVertices[currentStrokeObj.layerId].splice(i, 3);
                    currentColorVec4[currentStrokeObj.layerId].splice(i, 3);

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
    isMoveSelectionButtonMode = false;
    isCopying = false;
  
    render();
}

function setTriangleColor(r, g, b) {
    currentColor = vec4(r, g, b, 1.0);
}

function pickColor(event) {
    if (currentColorHTMLId != null) {
        document.getElementById(currentColorHTMLId).style.border = "transparent";
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

    // Update the canvas size based on the zoom
    const newCanvasWidth = CANVAS_WIDTH * zoomFactor;
    const newCanvasHeight = CANVAS_HEIGHT * zoomFactor;

    canvas.width = Math.floor(newCanvasWidth);
    canvas.height = Math.floor(newCanvasHeight);

    containerStyle =  getComputedStyle(canvasContainer);

    canvasContainer.width = Math.max(parseInt(containerStyle.width, 10), canvas.width + 3000);
    canvasContainer.height = Math.max(parseInt(containerStyle.height, 10), canvas.height + 300);

    // Update the viewport
    gl.viewport(0, 0, newCanvasWidth, newCanvasHeight);
    render();
}

function updateCanvasScale(event, slideBtn) {
    let sliderValue;

    if (isSliding) {
        sliderValue = slideBtn.value;
        zoomFactor = sliderToZoom(sliderValue, MAX_ZOOM, MIN_ZOOM, MAX_SLIDER, MIN_SLIDER);
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
    
    var copyButton = document.getElementById("copybutton");
    copyButton.addEventListener("click", function() {
        copySelection(copyButton);
    });

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

    var moveSelectionButton = document.getElementById("moveselectionbutton");
    moveSelectionButton.addEventListener("click", function() {
        moveSelectionMode(moveSelectionButton);
    });

    editButtonsToBeUpdated.push(eraserButton);
    editButtonsToBeUpdated.push(pencilButton);
    editButtonsToBeUpdated.push(selectionButton);
    editButtonsToBeUpdated.push(moveButton);
    editButtonsToBeUpdated.push(moveSelectionButton);
    editButtonsToBeUpdated.push(copyButton);

    editButtonsToBeUpdated.forEach((btn) => {btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = CLICKED_ICON_BACKGROUND;
    })});

    // Add hover effect to the icons
    editButtonsToBeUpdated.forEach((btn) => {btn.addEventListener("mouseleave", () => {
        if (!((btn == eraserButton && isErasing)
            || (btn == pencilButton && isDrawing)
            || (btn == selectionButton && isSelecting)
            || (btn == moveButton && isMoving)
            || (btn == copyButton && isCopying)
            || (btn == moveSelectionButton && isMoveSelectionButtonMode))
        ) {
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

        this.value = null;
    });

    canvas = document.getElementById( "gl_canvas" );
    canvasContainer = document.getElementById( "canvas-container" );
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    gl = WebGLUtils.setupWebGL( canvas );    
    if ( !gl ) { alert( "WebGL isn't available" ); }  

    // Configure WebGL
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    addFirstLayer();

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
        else if (isDrawing || isErasing) {
            currentStroke++;
        }
        else if (isMoveSelectionButtonMode && hasCompleteSelection) {
            handleSelectionMovementMouseUp(event, canvas);
            resetSelectionData();
        }
        else if (isCopying && hasCompleteSelection) {
            handleCopyMovementMouseUp(event, canvas);
            resetSelectionData();
        }
    });

    canvas.addEventListener("mousedown", (event) => {
        isOperating = true;
        isMouseDown = true;
      
        if (isMoving) {
            moveCanvasMouseDown(event);
        }
        else if (isDrawing || isErasing) {
            draw(event, canvas);
        }
        else if (isSelecting) {
            handleSelectionContinous(event, canvas);
        }
        else if (isMoveSelectionButtonMode || isCopying) {
            moveSelectionContinuos(event, canvas);
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

        if (isMoveSelectionButtonMode || isCopying) {
            moveSelectionContinuos(event, canvas);
        }
    });      

    canvas.addEventListener("click", (event) => {
        if (isSelecting) {
            handleSelection(event, canvas);
        }
        else if (isMoveSelectionButtonMode) {
            renderSelectedTriangles();
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

    selectionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionBuffer);

    selectionColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionColorBuffer);

    render();
};

function resetSelectionData() {
    hasCompleteSelection = false;
    isMovingCompleteSelection = false;
    startSelectionX = undefined;
    startSelectionY = undefined;
    updateSelectCoords1 = true;
    selectCoords1 = undefined;
    selectCoords2 = undefined;
    selectionRectangleVertices = [];
    selectedTriangleVertices = [];
    newSelectedTrianglesVertices = [];
    originalSelectedTriangleVertices = [];
    selectedTriangleColors = [];
    selectedTriangleActualColors = [];
    selectedAreaStartTriangle = [];
    selectedAreaStartCell = [];
}

function eraseMode(eraserButton) {
    updateButtonBackground(eraserButton);
    resetAllModes();
    resetSelectionData();
    isErasing = true;
}

function drawMode(pencilButton) {
    updateButtonBackground(pencilButton);
    resetAllModes();
    resetSelectionData();
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
    resetSelectionData();
    isMoving = true;
}

function moveSelectionMode(moveSelectionButton) {
    updateButtonBackground(moveSelectionButton);
    resetAllModes();
    isMoveSelectionButtonMode = true;

    renderSelectedTriangles();
}

function copySelection(copyButton) {
    updateButtonBackground(copyButton);
    resetAllModes();
    isCopying = true;
    renderSelectedTriangles();
}

function openFile() {
    updateButtonBackground();
    resetAllModes();
    resetSelectionData();
}

function saveFile() {
    // update buttons ui
    updateButtonBackground();
    resetAllModes();
    resetSelectionData();
    
    // create a file and download
    createAndDownloadJSONFile();
}

function changeLayerVis(layerId, img) {
    var curLayer = layerStack.filter((layer) => layer.id == layerId)[0];

    if (curLayer.isVisible) {
        curLayer.setVisible(false);
        img.src = './icons/icons8-not-visible-30.png';
    } else {
        curLayer.setVisible(true);
        img.src = './icons/icons8-eye-30.png';
    }

    render();
}

function getLayerById(layerId) {
    return layerStack.filter((layer) => layer.id == layerId)[0];
}

function addLayer() {
    lastLayerIdNo++;
    layerNo++;

    const newLayer = new Layer(lastLayerIdNo);

    layerStack.push(newLayer);

    allVertices[newLayer.id] = [];

    currentColorVec4[newLayer.id] = [];

    theBuffer[newLayer.id] = gl.createBuffer();
    theColorBuffer[newLayer.id] = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, theBuffer[newLayer.id]);  
    gl.bindBuffer(gl.ARRAY_BUFFER, theColorBuffer[newLayer.id]);

    const [visButton, layerDiv] = createLayerDiv(lastLayerIdNo);

    visButton.addEventListener("click", function() {
        const layerId = this.getAttribute('value');
        const img = this.querySelector('img');
        changeLayerVis(layerId, img);
    }); 

    layerDiv.addEventListener("click", function() {
        document.getElementById(activeLayerId).style.backgroundColor = "#c7c7c7bc";
        activeLayerId = this.id;
        activeLayer = getLayerById(activeLayerId);
        layerDiv.style.backgroundColor = "#8d8db2";
    }); 

    return [layerDiv, newLayer];
}

function addLayerFromFile(newLayerIdNo) {
    layerNo++;

    const newLayer = new Layer(newLayerIdNo);

    layerStack.push(newLayer);

    allVertices[newLayer.id] = [];

    currentColorVec4[newLayer.id] = [];

    theBuffer[newLayer.id] = gl.createBuffer();
    theColorBuffer[newLayer.id] = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, theBuffer[newLayer.id]);  
    gl.bindBuffer(gl.ARRAY_BUFFER, theColorBuffer[newLayer.id]);

    const [visButton, layerDiv] = createLayerDiv(newLayerIdNo);

    visButton.addEventListener("click", function() {
        const layerId = this.getAttribute('value');
        const img = this.querySelector('img');
        changeLayerVis(layerId, img);
    }); 

    layerDiv.addEventListener("click", function() {
        document.getElementById(activeLayerId).style.backgroundColor = "#c7c7c7bc";
        activeLayerId = this.id;
        activeLayer = getLayerById(activeLayerId);
        layerDiv.style.backgroundColor = "#8d8db2";
    }); 

    return [layerDiv, newLayer];
}

function addFirstLayer() {
    if (layerNo != 0) {
        return;
    }

    const [newLayerDiv, newLayer] = addLayer();
    newLayerDiv.style.backgroundColor = "#8d8db2";

    activeLayerId = "l-" + lastLayerIdNo;
    activeLayer = newLayer;
}

function addFirstLayerFromFile(newLayerIdNo) {
    const [newLayerDiv, newLayer] = addLayerFromFile(newLayerIdNo);
    newLayerDiv.style.backgroundColor = "#8d8db2";

    activeLayerId = "l-" + newLayerIdNo;
    activeLayer = newLayer;
}

// Creates the HTML div of Layer Info Card
function createLayerDiv(layerIdNo) {
    const layerDiv = document.createElement('div');
    layerDiv.classList.add('layer');
    layerDiv.id = 'l-' + layerIdNo;

    const pElement = document.createElement('p');
    pElement.textContent = `Layer ${layerIdNo + 1}`;

    const buttonElement = document.createElement('button');
    buttonElement.classList.add('icon-button', 'layer-button', 'visible-button');
    buttonElement.value = 'l-' + layerIdNo;

    const imgElement = document.createElement('img');
    imgElement.src = './icons/icons8-eye-30.png';
    imgElement.alt = 'Visible Layer Icon';

    buttonElement.appendChild(imgElement);

    layerDiv.appendChild(pElement);
    layerDiv.appendChild(buttonElement);

    layerAreaDiv.appendChild(layerDiv);

    return [buttonElement, layerDiv];
}

function removeLayerDiv(layerId) {
    const layerDiv = document.getElementById(layerId);

    if (layerDiv) {
        layerDiv.remove();
    }
}

function deleteLayer() {
    // There should be at least one layer
    if (layerNo <= 1) {
        return;
    }

    removeLayerDiv(activeLayerId);

    // Remove the current layer data from the all vertices
    delete allVertices.activeLayer;
    delete currentColorVec4.activeLayer;

    var index = layerStack.findIndex((layer) => layer.id === activeLayerId);
    
    layerStack.splice(index, 1);
    layerNo--;

    if (index != 0) {
        activeLayerId = layerStack[index - 1].id;
    }
    else {
        activeLayerId = layerStack[index].id;
    }

    activeLayer = getLayerById(activeLayerId);

    document.getElementById(activeLayerId).style.backgroundColor = "#8d8db2";

    render();
}

function moveDownLayer() {
    const layers = document.querySelectorAll('.layer');
    var index = layerStack.findIndex((layer) => layer.id === activeLayerId);

    if (index < layerStack.length - 1) {
        layerAreaDiv.insertBefore(layers[index + 1], layers[index]);
        swapLayers(index, index + 1);
    }  

    render();
}

function moveUpLayer() {
    const layers = document.querySelectorAll('.layer');
    var index = layerStack.findIndex((layer) => layer.id === activeLayerId);

    if (index > 0) {
        layerAreaDiv.insertBefore(layers[index], layers[index - 1]);
        swapLayers(index, index - 1);
    }  
    
    render();
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

                // remove old layers
                layerStack.forEach(layer => removeLayerDiv(layer.id));
                layerStack.splice(0, layerStack.length);

                const prevLayerStack = jsonData.layerStack;

                if (prevLayerStack.length > 0) {
                    addFirstLayerFromFile(parseInt(prevLayerStack[0].id.match(/\d+/)[0], 10));

                    for (let i = 1; i < prevLayerStack.length; i++) {
                        addLayerFromFile(parseInt(prevLayerStack[i].id.match(/\d+/)[0], 10));
                    }
                } 

                // set data
                pointsGrid = jsonData.pointsGrid;
                glGrid = jsonData.glGrid;
                gridCells = jsonData.gridCells;
                allVertices = jsonData.allVertices;
                currentColorVec4 = jsonData.currentColorVec4;
                lastLayerIdNo = jsonData.lastLayerIdNo;
                layerNo = layerNo;    

                render();
            } catch (error) {
                console.error("Error parsing JSON:", error);
            }
        };

        // Read the file
        reader.readAsText(file);
        render();
    }
}

function createAndDownloadJSONFile() {
    var jsonData = createSaveData();

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

function createSaveData() {
    var data = {
        pointsGrid: pointsGrid,
        glGrid: glGrid,
        gridCells: gridCells,
        allVertices: allVertices,
        theBuffer: theBuffer,
        currentColorVec4: currentColorVec4,
        theColorBuffer: theColorBuffer,
        layerStack: layerStack,
        lastLayerIdNo: lastLayerIdNo
    };

    return data;
}

function renderMovingSelection() {
    isMovingCompleteSelection = true;
    
    render();

    // Selection Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(selectedTriangleVertices), gl.STATIC_DRAW);

    // Associate shader variables and draw the selection buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Selection Color Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(selectedTriangleActualColors), gl.STATIC_DRAW);
  
    // Associate shader variables and draw the color buffer
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    gl.drawArrays(gl.TRIANGLES, 0, selectedTriangleVertices.length);

    isMovingCompleteSelection = false;
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

    if (selectedTriangleVertices.length > 0) { hasCompleteSelection = true; }
}

function renderSelectedTrianglesWithBorderAndColor() {
    render();

    var selectionMovement = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionMovement);

    var selectionMovementColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionMovementColorBuffer);

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

    // Selection Movement Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionMovement);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(selectedTriangleVertices), gl.STATIC_DRAW);

    // Associate shader variables and draw the selection buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Selection Movement Color Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, selectionMovementColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(selectedTriangleActualColors), gl.STATIC_DRAW);
  
    // Associate shader variables and draw the color buffer
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    gl.drawArrays(gl.TRIANGLES, 0, selectedTriangleVertices.length);

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

    if (selectedTriangleVertices.length > 0) { hasCompleteSelection = true; }
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

function renderWithoutSelectionInAllVertices() {
    if (!isMovingCompleteSelection) { hasCompleteSelection = false; }

    var visitedVertex = [];
    var visitedBefore = false;

    var verticesToRender = [];
    var colorsToRender = [];

    const allVerticesActive = allVertices[activeLayerId]; 
    const currentColorVec4Active = currentColorVec4[activeLayerId];

    // Move all in the original to the locations in the selectedTriangleVertices
    for (let i = 0; i < originalSelectedTriangleVertices.length; i = i + 3) {
        var originalVertex1 = originalSelectedTriangleVertices[i];
        var originalVertex2 = originalSelectedTriangleVertices[i + 1];
        var originalVertex3 = originalSelectedTriangleVertices[i + 2];

        for (let j = 0; j < visitedVertex.length; j++) {
            if (
                visitedVertex[j][0] == originalVertex1[0] && visitedVertex[j][1] == originalVertex1[1]
                && visitedVertex[j + 1][0] == originalVertex2[0] && visitedVertex[j + 1][1] == originalVertex2[1]
                && visitedVertex[j + 2][0] == originalVertex3[0] && visitedVertex[j + 2][1] == originalVertex3[1]
            ) {
                // If we are here, vertex is visited before
                visitedBefore = true;
                break;
            }
        }

        if (visitedBefore) {
            visitedBefore = false;
            continue;
        }
        
        visitedVertex.push(originalVertex1);
        visitedVertex.push(originalVertex2);
        visitedVertex.push(originalVertex3);

        // Add all "non-selected" triangles back to rendering data
        for (let k = 0; k < allVerticesActive.length; k = k + 3) {
            var curV1 = allVerticesActive[k];
            var curV2 = allVerticesActive[k + 1];
            var curV3 = allVerticesActive[k + 2];

            if (
                curV1[0] == originalVertex1[0] && curV1[1] == originalVertex1[1]
                && curV2[0] == originalVertex2[0] && curV2[1] == originalVertex2[1]
                && curV3[0] == originalVertex3[0] && curV3[1] == originalVertex3[1]
            ) {
                continue;
            }

            verticesToRender.push(allVerticesActive[k]);
            verticesToRender.push(allVerticesActive[k + 1]);
            verticesToRender.push(allVerticesActive[k + 2]);

            colorsToRender.push(currentColorVec4Active[k]);
            colorsToRender.push(currentColorVec4Active[k + 1]);
            colorsToRender.push(currentColorVec4Active[k + 2]);
        }
    }

    gl.clear(gl.COLOR_BUFFER_BIT); 

    const viewMatrixLocation = gl.getUniformLocation(program, "viewMatrix");
    gl.uniformMatrix4fv(viewMatrixLocation, false, flatten(viewMatrix));

    // Vertex Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, theBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(verticesToRender), gl.STATIC_DRAW); 

    // Associate shader variables and draw the vertex buffer
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Color Buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, theColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsToRender), gl.STATIC_DRAW);
    
    // Associate shader variables and draw the color buffer
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    gl.drawArrays(gl.TRIANGLES, 0, allVerticesActive.length);
}

function render() {
    if (!isMovingCompleteSelection) { hasCompleteSelection = false; }    

    const viewMatrixLocation = gl.getUniformLocation(program, "viewMatrix");
    gl.uniformMatrix4fv(viewMatrixLocation, false, flatten(viewMatrix));
    gl.clear(gl.COLOR_BUFFER_BIT); 

    for (let i = layerStack.length - 1; i >= 0; i--) {
        let verticeNumberToRender = allVertices[layerStack[i].id].length;
        // If layer is not visible do not render it
        if (!layerStack[i].isVisible) {
            verticeNumberToRender = 0;
        }

        // Vertex Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, theBuffer[layerStack[i].id]);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(allVertices[layerStack[i].id]), gl.STATIC_DRAW); 

        // Associate shader variables and draw the vertex buffer
        var vPosition = gl.getAttribLocation(program, "vPosition");
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        // Color Buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, theColorBuffer[layerStack[i].id]);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(currentColorVec4[layerStack[i].id]), gl.STATIC_DRAW);
    
        // Associate shader variables and draw the color buffer
        var vColor = gl.getAttribLocation(program, "vColor");
        gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vColor);

        gl.drawArrays(gl.TRIANGLES, 0, verticeNumberToRender);
    }
}
