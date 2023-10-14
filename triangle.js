/* eslint-disable no-undef */

var gl;
var points;

window.onload = function init() {
    var canvas = document.getElementById( "gl_canvas" );
    gl = WebGLUtils.setupWebGL( canvas );    
    if ( !gl ) { alert( "WebGL isn't available" ); }        

    var vertices = [
        vec2( -1, -1 ),
        vec2(  0,  1 ),
        vec2(  1, -1 )    
    ];    

    let points = [][30]; 
    for (let i = 0; i <= 30; i++) {
        for (let j = 0; j <= 30; j++) {
            points.push(vec2(-1 + j/15, -1 + i/15));
        }
    }

    var vertices1 = [
        points[0],
        points[90],
        points[40]    
    ];

    //  Configure WebGL 
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );   
     
    //  Load shaders and initialize attribute buffers
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );        

    // Load the data into the GPU        
    var bufferId = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices1), gl.STATIC_DRAW ); 
	
    // Associate out shader variables with our data buffer
    var vPosition = gl.getAttribLocation( program, "vPosition" );

    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition ); 

    render();
};

function render() {
    gl.clear( gl.COLOR_BUFFER_BIT ); 
    gl.drawArrays( gl.TRIANGLES, 0, 3 );
}
