var gl;
var totalCells = 0;
var totalPolygons = 0;
var isMouseDown = false;
var allBuffers = [];
var pointsGrid = [];
var glGrid = [];
var gridCells = [];
const GRID_SIZE = 15;
var program;
var zoom = 1.0;
var panX = 0.0;
var panY = 0.0;
var mouseDown = false;
var lastMouseX;
var lastMouseY;

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

function moveCanvasMouseDown (event) {
    mouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}

function moveCanvasMouseDrag (event) {
    // if mouse is not down, don't do anything
    if (!mouseDown) {
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
    mouseDown = false;
}

function convertPointToWebGLCoordinates(point) {
    return vec2(point.x / GRID_SIZE, point.y / GRID_SIZE);
}

function convertCellToArray(cell) {
    return [cell.p1, cell.p2, cell.p3, cell.p4, cell.p5];
}

function distanceToPoint(x1, y1, point) {
    const dx = x1 - point[0];
    const dy = y1 - point[1];

    return Math.sqrt(dx * dx + dy * dy);
}

function draw(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const canvasX = (x / canvas.width) * 2 - 1;
    const canvasY = -((y / canvas.height) * 2 - 1);

    // console.log("Mouse clicked at (x, y): ", canvasX, canvasY);

    const gridX = Math.floor((canvasX + 1) * GRID_SIZE) <= -0 ? 0 : Math.floor((canvasX + 1) * GRID_SIZE);
    const gridY = Math.floor((canvasY + 1) * GRID_SIZE) <= -0 ? 0 : Math.floor((canvasY + 1) * GRID_SIZE);

    // console.log("Mouse clicked on grid cell (x, y): ", gridX, gridY);

    const cellClicked = gridCells[gridX][gridY];
    // console.log("Clicked on grid cell:", cellClicked);

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

    var clickedTriangle = [
        shortestPt,
        secondShortestPt,
        cellClicked.p5
    ];

    totalPolygons++;

    // Load the data into the GPU 
    var bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(clickedTriangle), gl.STATIC_DRAW);
    allBuffers.push(bufferId);

    // console.log(clickedTriangle);

    // Associate out shader variables with our data buffer
    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    render();
}

window.onload = function init() {
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
        isMouseDown = false;
    });

    canvas.addEventListener("mousedown", (event) => {
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
            totalCells++;
        }
    }

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
    
    for (let i = 0; i < allBuffers.length; i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, allBuffers[i]);

        // Associate shader variables and draw the current buffer
        var vPosition = gl.getAttribLocation(program, "vPosition");
        gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(vPosition);

        gl.drawArrays(gl.TRIANGLES, 0, 3); // Assuming each buffer contains a single triangle
    }
}
