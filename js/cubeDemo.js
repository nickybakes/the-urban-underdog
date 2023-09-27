"use strict";
const app = new PIXI.Application({
    width: 1024,
    height: 576
});
document.body.appendChild(app.view);

//resolution of the entire canvas area
const sceneWidth = app.view.width;
const sceneHeight = app.view.height;

//resolution that i want my 3d graphics to be displayed at
const inGameResWidth = 128;
const inGameResHeight = 72;

//the scale of a 'pixel' in our 3d view.
const resScale = sceneWidth / inGameResWidth;

//arrays of pixel colors and depth values for our 3d view
let renderBuffer = [];
let depthBuffer = [];

let stage;
let scene;
let render;
let rasterizer;
let camera, testPoint, testPointProjected;
let testTri;

//a mesh of a 1x1x1 cube
let cubeMesh;

let cubeModel;
let cubeModel2;


app.loader.onComplete.add(setUpGame);
app.loader.load();

function setUpGame() {
    // console.log("starting game");

    //set up a simple scene/container
    // console.log(resScale);
    stage = app.stage;
    scene = new PIXI.Container();
    stage.addChild(scene);

    //this renderer is how we will draw individual pixels onto screen
    render = new PIXI.Graphics();
    scene.addChild(render);

    
    testPoint = new Vector3(0, 0, 30);
    //testTri = new Tri(new Vector3(-2, 2, 10), new Vector3(-1, 2, 16), new Vector3(2, 3, 10))
    testTri = new Tri(new Vector3(2, 3, 10), new Vector3(2, 3, 16), new Vector3(6,3, 10))
    // console.log(testTri.normal());
    camera = new Camera();
    // console.log(camera.forward());
    // console.log(Vector3.dot(testTri.normal(), camera.forward()));
    rasterizer = new Rasterizer(camera);

    //lets create our default cube mesh
    cubeMesh = new Mesh();
    //all the points needed to for a cube
    let cubeVerts = [new Vector3(-1, -1, -1), new Vector3(1, -1, -1), new Vector3(1, 1, -1), new Vector3(-1, 1, -1), new Vector3(-1, -1, 1), new Vector3(1, -1, 1), new Vector3(1, 1, 1), new Vector3(-1, 1, 1)];
    //we create 6 'quads' out of these points. these quads get turned into tris and stored within the mesh
    cubeMesh.convertQuadToTrisAndAddThem(cubeVerts[0], cubeVerts[1], cubeVerts[2], cubeVerts[3], Color.RUBIX_RED());
    cubeMesh.convertQuadToTrisAndAddThem(cubeVerts[1], cubeVerts[5], cubeVerts[6], cubeVerts[2], Color.RUBIX_BLUE());
    cubeMesh.convertQuadToTrisAndAddThem(cubeVerts[5], cubeVerts[4], cubeVerts[7], cubeVerts[6], Color.RUBIX_ORANGE());
    cubeMesh.convertQuadToTrisAndAddThem(cubeVerts[4], cubeVerts[0], cubeVerts[3], cubeVerts[7], Color.RUBIX_GREEN());
    cubeMesh.convertQuadToTrisAndAddThem(cubeVerts[4], cubeVerts[5], cubeVerts[1], cubeVerts[0], Color.WHITE());
    cubeMesh.convertQuadToTrisAndAddThem(cubeVerts[3], cubeVerts[2], cubeVerts[6], cubeVerts[7], Color.RUBIX_YELLOW());

    //finally, place the cube model in our 3d scene
    cubeModel = new Model(0, 0, 10, 0, 0, 0, 1, 1, 1, cubeMesh);

    cubeModel2 = new Model(-2, -2, 15, 0, 0, 0, 2, 1, 1, cubeMesh);

    //reset our rendering objects
    render.clear();
    clearRenderBuffer();
    clearDepthBuffer();


    app.ticker.add(updateLoop);
}

function updateLoop() {
    // #1 - Calculate "delta time"
    let dt = 1 / app.ticker.FPS;
    if (dt > 1 / 12) dt = 1 / 12;

    //reset our rendering objects
    render.clear();
    clearRenderBuffer();
    clearDepthBuffer();

    //add some rotation animation to our cubes
    cubeModel.rotPitch(dt * 30);
    cubeModel.rotYaw(dt * 30);
    cubeModel.rotRoll(dt * 30);

    cubeModel2.rotPitch(dt * -30);
    cubeModel2.rotRoll(dt * -30);

    //rasterizer.drawTri(testTri);
    //draw our cube model
    rasterizer.drawModel(cubeModel);
    rasterizer.drawModel(cubeModel2);



    testPointProjected = camera.perspectiveProjectWorldPoint(testPoint);
    
    //renderBuffer[testPointProjected.x - 1][testPointProjected.y - 1] = new Color(255, 0, 0);
    

    for (let y = 0; y < inGameResHeight; y++) {
        for (let x = 0; x < inGameResWidth; x++) {
            let color = new Color(x / inGameResWidth, x / inGameResWidth, x / inGameResWidth);
            render.beginFill(renderBuffer[x][y].toHex(), 1);
            render.drawRect(x * resScale, y * resScale, resScale, resScale);
        }
    }


}

//draws a pixel on the screen depending on the current depth of that pixel
function drawPixelOnScreenWithDepth(color = new Color(), x = 0, y = 0, depth = 0){
    // if the new pixe lis not within the depth range, dont draw it
    if(depth < 0 || depth >= 1){
        return;
    }

    //if its inside the screen resolution
    if(x >= 0 && x < inGameResWidth && y >= 0 && y < inGameResHeight){
        //and its depth is closer to the camera than the current pixel depth is
        if(depthBuffer[x][y] > depth){
            //draw it and store that depth!
            renderBuffer[x][y] = color;
            depthBuffer[x][y] = depth;
        }

    }
}

//resets our array of pixel colors back to black
function clearRenderBuffer(){
    renderBuffer = [];
    for (let x = 0; x < inGameResWidth; x++) {
        renderBuffer[x] = [];
        for (let y = 0; y < inGameResHeight; y++) {
            renderBuffer[x][y] = new Color();
        }
    }
}

//resets our array of depth values back to the max value
function clearDepthBuffer(){
    depthBuffer = [];
    for (let x = 0; x < inGameResWidth; x++) {
        depthBuffer[x] = [];
        for (let y = 0; y < inGameResHeight; y++) {
            depthBuffer[x][y] = 1;
        }
    }
}