var gl;
var canvas;
var points;
var view;
var projection;
var program;

var zoom = 1.0;
var panX = 0.0;
var panY = 0.0;

var mouseDown = false;
var lastMouseX;
var lastMouseY;

// Add mouse event listeners
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

window.onload = function init() {
    canvas = document.getElementById( "gl_canvas" );
    gl = WebGLUtils.setupWebGL( canvas );    
    if ( !gl ) { alert( "WebGL isn't available" ); }        

    // Three Vertices        

    var vertices = [
        vec2( -1, -1 ),
        vec2(  0,  1 ),
        vec2(  1, -1 )    
    ];  
    
    canvas.addEventListener("mousedown", moveCanvasMouseDown);
    canvas.addEventListener("mousemove", moveCanvasMouseDrag);
    canvas.addEventListener("mouseup", moveCanvasMouseUp);

    //  Configure WebGL   
    //    
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );   
     
    //  Load shaders and initialize attribute buffers

    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );        

    // Load the data into the GPU        

    var bufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW ); 
	
    // Associate out shader variables with our data buffer

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );    
    render();
};

function render() {
    console.log("bitches this is render")
    gl.clear( gl.COLOR_BUFFER_BIT ); 

    gl.drawArrays( gl.TRIANGLES, 0, 3 );
}
