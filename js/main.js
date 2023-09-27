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
const inGameResWidth = 96;
const inGameResHeight = 54;

//the scale of a 'pixel' in our 3d view.
const resScale = sceneWidth / inGameResWidth;

//arrays of pixel colors and depth values for our 3d view
let renderBuffer = [];
let depthBuffer = [];

//the pixi graphics object we are drawing our 3d render to
let render;

//objects that are involved with projecting 3d points to the scene and filling in triangles with specific colors
let rasterizer;
let camera;

//the stage we are rendering everything to
let stage;

//all the HUDs for each game state
let titleScene;
let howToPlayScene;
let customizeCarScene;
let trackPreviewScene;
let raceScene;
let pauseScene;
let resultsScene;
let scenes = [];

//the state the game is currently in. defines behavior and sounds at that time
let gameState = 0;
//0 - title screen;
//1 - how to play
//2 - car customization
//3 - track preview
//4 - racing/gameplay
//5 - paused
//6 - results/gameover

//meshes and models needed for the 'customize car color' scene
let displayTrackMesh;
let displayCarModel;
let displayTrackModel;

//meshes amd models for the generated track that the user will play on
let trackMesh;
let trackBumperMesh;
let trackFinishLineMesh;
let trackBoostPadsMesh;
let trackModel;
let trackBumperModel;
let trackFinishLineModel;
let trackBoostPadsModel;


//randomized sizes for the race track
let mapWidth;
let mapLength;
let mapHeight;

//during track generation: place randomized points in here
let randomPoints = [];

//during track generation: place points on the convex hull here
let convexHull = [];

//stores vertices of the race track
let trackPoints = [];

//stored generated speed boost pads
let boostPads = [];

//the finalized race track object
let raceTrack;

//the interpolated, randomized height map for the track
let heightMap;
let highlightCycleTimer = 0;

//all of the sound effects and music used
let buttonClickSound;
let buttonHoverSound;
let carDriftSound;
let carDriveSound;
let carIdleSound;
let carImpactLargeSound;
let carImpactSmallSound;
let carStartSound;
let countDownSound;
let crowdAmbienceSound;
let gameMusic;
let lapCountSound;
let mainMenuMusic;
let victorySound;

//the mesh for the player's racecar
let carMesh;

//the color of the player's car
let playerCarColor = new Color(255, 217, 0);

//Key names for local storage
const prefix = "nmb9745-";
const carColorKey = prefix + "carColor";

//the Car object that our player controls
let playerCar;

//objects that store the states of user's input/controls
let mousePosition;
let keysHeld = [];
let keysReleased = [];

//Backgrounds for the game and menus
let bgEvening;
let bgMenuNear;
let bgMenuFar;
let bgMenuSky;
let bgDarken;

//HUD elements we need to update in menus
let steeringWheel;
let buttonStyle;
let buttonStyleSmall;
let countDownStyle;
let hudLabelStyleYellow;
let hudLabelStyleYellowSmall;
let hudLabelStyleWhite;
let customizeCarRedLabel;
let customizeCarGreenLabel;
let customizeCarBlueLabel;
let redTrackBar;
let greenTrackBar;
let blueTrackBar;
let volumeTrackBar;
let volumeLabel;
let muteMusicButton;
let unmuteMusicButton;
let musicMuted = false;
let selectedButton;

//HUD elements used during racing gameplay and results screen
let countDownLabel;
let lapAlertLabel;
let wrongWayAlertLabel;
let lapCountLabel;
let autoAccelerateLabel;
let timeLabel;
let speedLabel;
let resultsLapTimeLabels;
let resultsLapNumberLabels;
let resultsTotalTimeLabel;

//load in our various image textures
app.loader
    .add("bgEvening", "media/bg-evening.jpg")
    .add("bgMenuNear", "media/evening-near.png")
    .add("bgMenuFar", "media/evening-far.png")
    .add("bgMenuSky", "media/evening-sky.png")
    .add("steeringWheel", "media/steering-wheel.png")
    .add("logo", "media/urban-underdog-logo.png")
    .add("howToPlay", "media/how-to-play.png")
    .add("screenDarken", "media/screen-darken.png");

//once finished, call the setUpGame function
app.loader.onComplete.add(setUpGame);
app.loader.load();

//initializes all the objects needed to run the game from the title screen
function setUpGame() {
    //add our window keyboard listener
    window.addEventListener("keydown", keysDown);
    window.addEventListener("keyup", keysUp);

    //set up our scenes/containers
    stage = app.stage;

    //init our HUD containers for different game states
    titleScene = new PIXI.Container();
    howToPlayScene = new PIXI.Container();
    customizeCarScene = new PIXI.Container();
    trackPreviewScene = new PIXI.Container();
    raceScene = new PIXI.Container();
    pauseScene = new PIXI.Container();
    resultsScene = new PIXI.Container();

    //init backgrounds
    bgEvening = createBg(app.loader.resources["bgEvening"].texture, stage);
    bgMenuSky = createBg(app.loader.resources["bgMenuSky"].texture, stage);
    bgMenuFar = createBg(app.loader.resources["bgMenuFar"].texture, stage);
    bgMenuNear = createBg(app.loader.resources["bgMenuNear"].texture, stage);

    //this goes between backgrounds and the 3D render, for when we want to darken the background
    bgDarken = new PIXI.Sprite.from(app.loader.resources["screenDarken"].texture);
    stage.addChild(bgDarken);

    //this renderer is how we will draw individual pixels onto screen
    render = new PIXI.Graphics();
    render.interactiveChildren = false
    stage.addChild(render);

    //finally, add our scenes to the main stage
    stage.addChild(titleScene);
    stage.addChild(howToPlayScene);
    stage.addChild(customizeCarScene);
    stage.addChild(trackPreviewScene);
    stage.addChild(raceScene);
    stage.addChild(pauseScene);
    stage.addChild(resultsScene);

    //store our scenes for easy access later
    scenes = [titleScene, howToPlayScene, customizeCarScene, trackPreviewScene, raceScene, pauseScene, resultsScene];

    //create all of our sound objects using Howl
    buildSounds();

    //init and add our HUD elements to their respective scenes
    buildHUD();


    //objects needed to project and rasterize 3D graphics
    camera = new Camera(0, -60, -140, -25);
    rasterizer = new Rasterizer(camera);

    //load the user's car color from local storage
    loadCarColor();

    //build meshes/models we will need
    buildCarMesh();
    buildDisplayTrackMesh();
    displayCarModel = new Model(0, 4, 7, 0, 0, 0, 2, 2, 2, carMesh);
    displayTrackModel = new Model(10, 4, 4, 0, 0, 0, 1, 1, 2, displayTrackMesh);

    //our game state starts at 0 (title screen)
    setGameState(0);


    //reset our rendering objects for our first frame of rendering
    render.clear();
    clearRenderBuffer();
    clearDepthBuffer();

    //finally, run our update loop!
    app.ticker.add(updateLoop);
}

//switches the game between its various states and runs specific 
//code depending on which state its switching to
function setGameState(state) {
    //0 - title screen;
    //1 - how to play
    //2 - car customization
    //3 - track preview
    //4 - racing/gameplay
    //5 - paused
    //6 - results/gameover

    //store our new state
    gameState = state;

    //hide all HUD containers
    for (let i = 0; i < scenes.length; i++) {
        scenes[i].visible = false;
    }
    //and unhide the one for the state we are switching to
    scenes[state].visible = true;

    //state 3 (track preview) needs the screen darken image present
    if (state == 3) {
        bgDarken.visible = true;
    } else {
        bgDarken.visible = false;
    }

    //if we switch to track preview state and no track has been generated, generate one!
    if (state == 3 && (raceTrack == null || raceTrack == undefined)) {
        generateTrack();
    }

    //switching to gameplay state hides volume controls
    if (state == 4) {
        volumeLabel.visible = false;
        volumeTrackBar.visible = false;
        muteMusicButton.visible = false;
        unmuteMusicButton.visible = false;

        //if the player pauses the game during the countdown timer, pause the 
        //countdown sound, then resume it when the player resumes the game
        if (raceTrack.countDownTime < 3 && !raceTrack.raceStarted) {
            countDownSound.play();
        }
    } else {
        //on any other state, show volume controls
        volumeLabel.visible = true;
        volumeTrackBar.visible = true;
        muteMusicButton.visible = !musicMuted;
        unmuteMusicButton.visible = musicMuted;
    }

    //when on the track, dont have menu music playing or the menu backgrounds showing
    if (state == 4 || state == 5 || state == 6) {
        mainMenuMusic.stop();
        bgMenuNear.visible = false;
        bgMenuFar.visible = false;
        bgMenuSky.visible = false;
    } else {
        //when ON the menu, play menu music if its stopped, sotp all car sounds
        if (!mainMenuMusic.playing())
            mainMenuMusic.play();
        gameMusic.stop();
        carDriveSound.stop();
        carIdleSound.stop();
        //and show menu BGs!
        bgMenuNear.visible = true;
        bgMenuFar.visible = true;
        bgMenuSky.visible = true;
    }
}

//loads the user's car color from local storage
function loadCarColor() {
    //get the color string from local storage and parse it
    let loadedCarColorString = localStorage.getItem(carColorKey);
    let loadedCarColor = JSON.parse(loadedCarColorString);

    //if it exists, then set our 'playercar color object to its values'
    if (loadedCarColor) {
        playerCarColor = new Color(loadedCarColor.red, loadedCarColor.green, loadedCarColor.blue);
    }
    else {
        //if it doesnt exist, then ue default value
        playerCarColor = new Color(255, 217, 0);
    }

    //update the color sliders to be in the position of the loaded color
    redTrackBar.setValue(playerCarColor.red / 255);
    greenTrackBar.setValue(playerCarColor.green / 255);
    blueTrackBar.setValue(playerCarColor.blue / 255);
    setCarColorRed();
    setCarColorGreen();
    setCarColorBlue();
}

//saves the player's car color to local storage
function saveCarColor() {
    let playerCarColorStringified = JSON.stringify(playerCarColor);
    localStorage.setItem(carColorKey, playerCarColorStringified);
}

//Loads all of our sound effects, music, and ambience and inits their Howl objects
function buildSounds() {
    buttonClickSound = new Howl({
        src: ['media/button-click.mp3'],
        volume: .6
    });

    buttonHoverSound = new Howl({
        src: ['media/button-hover.mp3'],
        volume: .5
    });

    carDriftSound = new Howl({
        src: ['media/car-drift.mp3'],
        volume: .52
    });

    //i'd comment more in this function but its pretty self explanatory

    carDriveSound = new Howl({
        src: ['media/car-drive.mp3'],
        volume: .5,
        loop: true
    });

    carIdleSound = new Howl({
        src: ['media/car-idle.mp3'],
        volume: .4,
        loop: true
    });

    carImpactLargeSound = new Howl({
        src: ['media/car-impact-large.mp3'],
        volume: .55,
    });

    carImpactSmallSound = new Howl({
        src: ['media/car-impact-small.mp3'],
        volume: .85,
    });

    carStartSound = new Howl({
        src: ['media/car-start.mp3'],
        volume: .5,
    });

    countDownSound = new Howl({
        src: ['media/count-down.mp3'],
        volume: .9,
    });

    crowdAmbienceSound = new Howl({
        src: ['media/crowd-ambience.mp3'],
        volume: .9,
        loop: true,
        autoplay: true
    });

    gameMusic = new Howl({
        src: ['media/game-music.mp3'],
        volume: 1,
        loop: true,
    });

    lapCountSound = new Howl({
        src: ['media/lap-count.mp3'],
        volume: 1.5,
    });

    mainMenuMusic = new Howl({
        src: ['media/main-menu-music.mp3'],
        volume: .75,
        loop: true,
    });

    victorySound = new Howl({
        src: ['media/victory.mp3'],
        volume: .5,
    });

}

//initalizes our HUD/UI objects and adds them as children to our different scenes
function buildHUD() {

    //init some button and label styles we can use for almost everything
    buttonStyle = new PIXI.TextStyle({
        fill: 0xFFFF00,
        fontSize: 48,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        stroke: 0x00000,
        strokeThickness: 8
    });

    buttonStyleSmall = new PIXI.TextStyle({
        fill: 0xFFFF00,
        fontSize: 36,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 8
    });

    countDownStyle = new PIXI.TextStyle({
        fill: 0xFFFF00,
        fontSize: 106,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 12
    });

    hudLabelStyleYellowSmall = new PIXI.TextStyle({
        fill: 0xFFFF00,
        fontSize: 24,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 8
    });

    hudLabelStyleYellow = new PIXI.TextStyle({
        fill: 0xFFFF00,
        fontSize: 42,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 8
    });

    hudLabelStyleWhite = new PIXI.TextStyle({
        fill: 0xFFFFFF,
        fontSize: 42,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 8
    });

    let titleTextStyle = new PIXI.TextStyle({
        fill: 0xFFFFFF,
        fontSize: 72,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        fontStyle: 'italic',
    });

    // TITLE SCREEN

    //add our logo to the title screen
    titleScene.addChild(new PIXI.Sprite.from(app.loader.resources["logo"].texture))

    //make the start game button
    titleScene.addChild(createButton("Start Your Engine!", sceneWidth / 2, 300, function () { setGameState(1); carStartSound.play(); }));

    // HOW TO PLAY
    howToPlayScene.addChild(new PIXI.Sprite.from(app.loader.resources["howToPlay"].texture));
    //buttons go back to title or next to car color screen
    howToPlayScene.addChild(createButton("Next", 800, 460, function () { setGameState(2); }));
    howToPlayScene.addChild(createButton("Back", 220, 460, function () { setGameState(0); }));


    //init styles for our color sliders
    let sliderTextRed = new PIXI.TextStyle({
        fill: 0xFF0000,
        fontSize: 36,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        fontStyle: 'italic',
        stroke: 0x00000,
        strokeThickness: 7
    });

    let sliderTextGreen = new PIXI.TextStyle({
        fill: 0x00FF00,
        fontSize: 36,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        fontStyle: 'italic',
        stroke: 0x00000,
        strokeThickness: 7
    });

    let sliderTextBlue = new PIXI.TextStyle({
        fill: 0x0000FF,
        fontSize: 36,
        fontFamily: "Goldman",
        fontWeight: 'bold',
        fontStyle: 'italic',
        stroke: 0x00000,
        strokeThickness: 7
    });


    //CAR COLOR CUSTOMIZE

    //add the title
    let customizeCarTitle = new PIXI.Text(" Customize Car Color! ");
    customizeCarTitle.style = titleTextStyle;
    customizeCarTitle.x = sceneWidth / 2;
    customizeCarTitle.y = 60;
    customizeCarTitle.anchor.set(.5);

    //add 3 labels that shpow the value for RGB respectively
    customizeCarRedLabel = new PIXI.Text(" Red ");
    customizeCarRedLabel.style = sliderTextRed;
    customizeCarRedLabel.x = 100;
    customizeCarRedLabel.y = 115;

    customizeCarGreenLabel = new PIXI.Text(" Green ");
    customizeCarGreenLabel.style = sliderTextGreen;
    customizeCarGreenLabel.x = 100;
    customizeCarGreenLabel.y = 205;

    customizeCarBlueLabel = new PIXI.Text(" Blue ");
    customizeCarBlueLabel.style = sliderTextBlue;
    customizeCarBlueLabel.x = 100;
    customizeCarBlueLabel.y = 305;

    //add our 3 sliders
    redTrackBar = new TrackBar(60, 85, 360, 12, 0xFF0000, setCarColorRed, saveCarColor);
    greenTrackBar = new TrackBar(60, 135, 360, 12, 0x00FF00, setCarColorGreen, saveCarColor);
    blueTrackBar = new TrackBar(60, 185, 360, 12, 0x0000FF, setCarColorBlue, saveCarColor);

    //add them all to the scene
    customizeCarScene.addChild(customizeCarTitle);
    customizeCarScene.addChild(customizeCarRedLabel);
    customizeCarScene.addChild(customizeCarGreenLabel);
    customizeCarScene.addChild(customizeCarBlueLabel);
    customizeCarScene.addChild(createButton("Done", 820, 480, function () { setGameState(3); }, buttonStyle));
    customizeCarScene.addChild(createButton("Back", 200, 480, function () { setGameState(1); }, buttonStyleSmall));
    customizeCarScene.addChild(redTrackBar);
    customizeCarScene.addChild(greenTrackBar);
    customizeCarScene.addChild(blueTrackBar);

    //TRACK PREVIEW SCENE

    //this scene just has a bunch of buttons for different functions
    trackPreviewScene.addChild(createButton("Play!", 900, 480, function () { startRace(); carStartSound.play(); }, buttonStyle));
    trackPreviewScene.addChild(createButton("New Track", sceneWidth / 2, 50, function () { generateTrack(); }, buttonStyle));
    trackPreviewScene.addChild(createButton("Back", 100, 480, function () { setGameState(2); }, buttonStyleSmall));
    trackPreviewScene.addChild(createButton("Copy Track\n        Code", 150, 50, function () { copyTrackCode(); }, buttonStyleSmall));
    trackPreviewScene.addChild(createButton("Input Track\n from Code", 870, 50, function () { loadTrackCode(); }, buttonStyleSmall));

    //PAUSE SCENE

    //pause scene has screen darken effect
    pauseScene.addChild(new PIXI.Sprite.from(app.loader.resources["screenDarken"].texture));

    //add the 'paused' title
    let pausedTitle = new PIXI.Text(" Paused! ");
    pausedTitle.style = titleTextStyle;
    pausedTitle.x = sceneWidth / 2;
    pausedTitle.y = 120;
    pausedTitle.anchor.set(.5);
    pauseScene.addChild(pausedTitle);

    //add standard pause menu buttons
    pauseScene.addChild(createButton("Resume", sceneWidth / 2, 260, function () { setGameState(4); }));
    pauseScene.addChild(createButton("Restart", sceneWidth / 2, 320, function () { startRace(); carStartSound.play(); }));
    pauseScene.addChild(createButton("Quit to Menu", sceneWidth / 2, 380, function () { setGameState(3); }));


    // GAMEPLAY/RACING SCENE

    //3..2..1..GO! label
    countDownLabel = new PIXI.Text("3");
    countDownLabel.style = countDownStyle;
    countDownLabel.x = sceneWidth / 2;
    countDownLabel.y = sceneHeight / 2;
    countDownLabel.anchor.set(.5);

    //label that says "FINAL LAP", etc whe nthe user crosses the finish line
    lapAlertLabel = new PIXI.Text("");
    lapAlertLabel.style = countDownStyle;
    lapAlertLabel.x = sceneWidth / 2;
    lapAlertLabel.y = sceneHeight / 2 + 70;
    lapAlertLabel.anchor.set(.5);

    //label that tells the user they are facing the wrong way
    wrongWayAlertLabel = new PIXI.Text("");
    wrongWayAlertLabel.style = countDownStyle;
    wrongWayAlertLabel.x = sceneWidth / 2;
    wrongWayAlertLabel.y = sceneHeight / 2 - 100;
    wrongWayAlertLabel.anchor.set(.5);

    //label in bottom right that shows lap count
    lapCountLabel = new PIXI.Text("");
    lapCountLabel.style = hudLabelStyleYellow;
    lapCountLabel.x = 900;
    lapCountLabel.y = sceneHeight - 50;
    lapCountLabel.anchor.set(.5);

    //label for bottom right that shows current time count
    timeLabel = new PIXI.Text("");
    timeLabel.style = hudLabelStyleYellow;
    timeLabel.x = 60;
    timeLabel.y = sceneHeight - 100;

    //bottom left label hat shows user's current speed in MPH
    speedLabel = new PIXI.Text("");
    speedLabel.style = hudLabelStyleYellow;
    speedLabel.x = 900;
    speedLabel.y = sceneHeight - 100;
    speedLabel.anchor.set(.5);

    //if the user has auto accelerate toggled on, show this in bottom left
    autoAccelerateLabel = new PIXI.Text("");
    autoAccelerateLabel.style = hudLabelStyleYellowSmall;
    autoAccelerateLabel.x = 110;
    autoAccelerateLabel.y = sceneHeight - 30;
    autoAccelerateLabel.anchor.set(.5);

    //finally add them to the scene
    raceScene.addChild(lapAlertLabel);
    raceScene.addChild(wrongWayAlertLabel);
    raceScene.addChild(countDownLabel);
    raceScene.addChild(lapCountLabel);
    raceScene.addChild(timeLabel);
    raceScene.addChild(speedLabel);
    raceScene.addChild(autoAccelerateLabel);

    //RESULTS SCENE

    //add dark BG and title
    resultsScene.addChild(new PIXI.Sprite.from(app.loader.resources["screenDarken"].texture));
    let resultsTitle = new PIXI.Text(" Nice Driving! ");
    resultsTitle.style = titleTextStyle;
    resultsTitle.x = sceneWidth / 2;
    resultsTitle.y = 50;
    resultsTitle.anchor.set(.5);
    resultsScene.addChild(resultsTitle);

    //buttons for play again or go back to menu
    resultsScene.addChild(createButton("   Play\n Again", 820, 440, function () { startRace(); carStartSound.play(); }));
    resultsScene.addChild(createButton("Quit to\n  Menu", 200, 440, function () { setGameState(3); }));

    //init the laps for showing Lap #'s and the times for each lap
    resultsLapTimeLabels = [];
    resultsLapNumberLabels = [];

    for (let i = 0; i < 5; i++) {
        //creat labels for "Lap 1" on the left
        let lapNumberLabel = new PIXI.Text("LAP " + (i + 1));
        lapNumberLabel.style = hudLabelStyleWhite;
        lapNumberLabel.x = sceneWidth / 2 - 90;
        lapNumberLabel.y = 120 + 40 * i;
        lapNumberLabel.anchor.set(1, .5);
        resultsLapNumberLabels.push(lapNumberLabel);
        resultsScene.addChild(lapNumberLabel);

        //create labels for lap times on the right
        let lapTimeLabel = new PIXI.Text("");
        lapTimeLabel.style = hudLabelStyleWhite;
        lapTimeLabel.x = sceneWidth / 2 + 5;
        lapTimeLabel.y = 120 + 40 * i;
        lapTimeLabel.anchor.set(0, .5);
        resultsLapTimeLabels.push(lapTimeLabel);
        resultsScene.addChild(lapTimeLabel);
    }

    //show the TOTAl time spent on the whole track
    let resultsTotalLabel = new PIXI.Text("TOTAL");
    resultsTotalLabel.style = hudLabelStyleWhite;
    resultsTotalLabel.x = sceneWidth / 2 - 90;
    resultsTotalLabel.y = 340;
    resultsTotalLabel.anchor.set(1, .5);
    resultsScene.addChild(resultsTotalLabel);

    resultsTotalTimeLabel = new PIXI.Text("");
    resultsTotalTimeLabel.style = hudLabelStyleWhite;
    resultsTotalTimeLabel.x = sceneWidth / 2 + 5;
    resultsTotalTimeLabel.y = 340;
    resultsTotalTimeLabel.anchor.set(0, .5);
    resultsScene.addChild(resultsTotalTimeLabel);

    //finally, add our volume controls and music mute buttons
    volumeLabel = new PIXI.Text("Vol - 50%");
    volumeLabel.style = hudLabelStyleYellowSmall;
    volumeLabel.x = 10;
    volumeLabel.y = 500;
    volumeTrackBar = new TrackBar(10, 270, 100, 8, 0xFFFF00, setVolume, setVolume);
    //our volume starts at 50% so we dont blast anyones ear drums
    volumeTrackBar.setValue(.5);
    setVolume();
    muteMusicButton = createButton("Mute Music", 225, 540, muteMusic, hudLabelStyleYellowSmall);
    unmuteMusicButton = createButton("Unmute Music", 230, 540, unmuteMusic, hudLabelStyleYellowSmall);
    unmuteMusicButton.visible = false;

    //we add these controls to the STAGE cuz they exist on multiple HUDs
    stage.addChild(volumeLabel);
    stage.addChild(volumeTrackBar);
    stage.addChild(muteMusicButton);
    stage.addChild(unmuteMusicButton);

    //finally, add our cute little steering wheel graphic
    steeringWheel = new SteeringWheel(512, 596);
    stage.addChild(steeringWheel);
}

//creates a button for our menus and sets its properties
//returns said button
function createButton(text, x, y, func, style = buttonStyle) {
    //store the text and position values
    let button = new PIXI.Text(text);
    button.style = style;
    button.x = x;
    button.y = y;
    button.anchor.set(.5, .5);
    //make it interactive
    button.interactive = true;
    button.buttonMode = true;
    //when the user clicks down, set our selected button to this one
    button.on('pointerdown', function (e) { selectedButton = button });
    //when the user releases the click; if this is the same button their clicked down on, then call its function and play a sound!
    button.on('pointerup', function (e) { if (button == selectedButton) { func(); buttonClickSound.play(); } });
    //if the user hovers over the button, change alpha and play a sound
    button.on('pointerover', function (e) { buttonHoverSound.play(); e.target.alpha = 0.7; });
    //if the user unhovers this button, return alpha back to normal
    button.on('pointerout', e => e.currentTarget.alpha = 1.0);
    return button;
}

//Copies a track code to the user's clipboard
function copyTrackCode() {
    //if no track exists, return with nothing
    if (raceTrack == null || raceTrack == undefined) {
        return;
    }

    //we have convert our trackpoints into smaller, shareableTrackPoints that only have the data we need.
    //this will keep the track code as small as possible
    let shareableTrackPoints = [];
    for (let i = 0; i < trackPoints.length; i++) {
        shareableTrackPoints.push({
            a: trackPoints[i].pos,
            b: trackPoints[i].outsidePoint
        });
    }

    //stringify our shareable track points
    let trackCodeString = JSON.stringify(shareableTrackPoints);
    //creates an area of text in the document
    const codeArea = document.createElement('textarea');
    //makes its value our url link
    codeArea.value = trackCodeString;
    //add it to the doc and select it
    document.body.appendChild(codeArea);
    codeArea.select();
    //copy the selected region to the clipboard, then remove it from our doc
    document.execCommand("copy");
    document.body.removeChild(codeArea);

    //finally, show the user some feedback
    showMessage("COPIED!");
}

//Loads a track code from the input-track-code text box
function loadTrackCode() {
    //get the inputted track code
    let trackCode = document.querySelector("#track-code-input").value;
    //if noting was inputted, say so!
    if (trackCode.length < 1) {
        showMessage("No code inputted!");
        return;
    }

    //the code must always start with a bracket
    if(trackCode[0] != "["){
        showMessage("Invalid track code!");
        return;
    }

    //surround this with a try statement in case anything goes wrong.
    //you can never trust user input
    try {
        //try to parse the inputted code
        let inputtedTrackPoints = JSON.parse(trackCode);

        //we cant make a track out of nothing or out of just 1 track point!
        if (inputtedTrackPoints == null || inputtedTrackPoints == undefined || inputtedTrackPoints.length < 2) {
            throw new Error();
        }

        //store track points in this separate array.
        let newTrackPoints = [];

        for (let i = 0; i < inputtedTrackPoints.length; i++) {
            try {
                //go through each inputted shareable track point and convert its data into Vector3's and actual track points
                let point = new TrackPoint();
                let pos = new Vector3(inputtedTrackPoints[i].a.x, inputtedTrackPoints[i].a.y, inputtedTrackPoints[i].a.z);
                point.pos = pos;
                let outsidePoint = new Vector3(inputtedTrackPoints[i].b.x, inputtedTrackPoints[i].b.y, inputtedTrackPoints[i].b.z);
                point.outsidePoint = outsidePoint;
                //add them to our array
                newTrackPoints.push(point);
            } catch (e) {
                //if anything goes wrong, stop the process and show an error message
                throw new Error();
            }
        }

        //if everything goes alright, then move track poitns to the main array
        trackPoints = newTrackPoints;
        highlightCycleTimer = 0;
        raceTrack = new RaceTrack();

        //we now have our track points, we can now link them up and build a mesh out of them
        linkTrackPoints();
        buildTrackMesh();
        //re-initialize our models
        trackModel = new Model(0, 0, 0, 0, 0, 0, .0625, .25, .0625, trackMesh);
        trackBumperModel = new Model(0, 0, 0, 0, 0, 0, .0625, .25, .0625, trackBumperMesh);
        trackFinishLineModel = new Model(0, 0, 0, 0, 0, 0, .0625, .25, .0625, trackFinishLineMesh);
    } catch (e) {
        //if anything goes wrong, tell the user
        showMessage("Invalid track code!");
    }

}

//shows our message box and then hides it after a second
function showMessage(message) {
    //get our message box
    let messageBox = document.querySelector(".message");
    //set its text to our custom message
    messageBox.innerHTML = message;

    //show the message box!
    messageBox.style.opacity = 1;
    messageBox.style.visibility = "visible";
    messageBox.style.transform = "scaleY(1)";

    //after about a second, hide the message box again
    setTimeout(hideMessage, 1300);
}

//hides our message box
function hideMessage() {
    //get our message box and hide it
    let messageBox = document.querySelector(".message");
    messageBox.style.opacity = 0;
    messageBox.style.visibility = "hidden";
    messageBox.style.transform = "scaleY(0)";
}

//when the user adjusts the RED color slider, change the red value of their car color, and update the respective label
function setCarColorRed() {
    let value = parseInt(255 * redTrackBar.value);
    customizeCarRedLabel.text = " Red - " + value + " ";
    playerCarColor.red = value;
}

//when the user adjusts the GREEN color slider, change the green value of their car color, and update the respective label
function setCarColorGreen() {
    let value = parseInt(255 * greenTrackBar.value);
    customizeCarGreenLabel.text = " Green - " + value + " ";
    playerCarColor.green = value;
}
//when the user adjusts the BLUE color slider, change the blue value of their car color, and update the respective label
function setCarColorBlue() {
    let value = parseInt(255 * blueTrackBar.value);
    customizeCarBlueLabel.text = " Blue - " + value + " ";
    playerCarColor.blue = value;
}

//when the user adjusts the volume slider, set the Howler global volume
function setVolume() {
    let value = volumeTrackBar.value;
    volumeLabel.text = "Vol - " + (parseInt(value * 100)) + "%";
    Howler.volume(value);
}

//if the user mutes the music, show the 'unmute button' and mute the music
function muteMusic() {
    gameMusic.mute(true);
    mainMenuMusic.mute(true);
    unmuteMusicButton.visible = true;
    muteMusicButton.visible = false;
    musicMuted = true;
}

//if the user unmutes the music, show the 'mute button' and unmute the music
function unmuteMusic() {
    gameMusic.mute(false);
    mainMenuMusic.mute(false);
    unmuteMusicButton.visible = false;
    muteMusicButton.visible = true;
    musicMuted = false;
}

//builds the mesh for our the track that appears on the Customize Car Color menu screen
function buildDisplayTrackMesh() {
    displayTrackMesh = new Mesh();
    //concrete base
    displayTrackMesh.convertQuadToTrisAndAddThem(new Vector3(-100, 0, 20), new Vector3(100, 0, 40), new Vector3(100, 0, -50), new Vector3(-100, 0, -50), new Color(70, 70, 70));

    //railings
    displayTrackMesh.convertQuadToTrisAndAddThem(new Vector3(-100, -8, 20), new Vector3(-50, -8, 25), new Vector3(-50, 0, 25), new Vector3(-100, 0, 20), Color.WHITE());
    displayTrackMesh.convertQuadToTrisAndAddThem(new Vector3(-50, -8, 25), new Vector3(0, -8, 30), new Vector3(0, 0, 30), new Vector3(-50, 0, 25), Color.RED());
    displayTrackMesh.convertQuadToTrisAndAddThem(new Vector3(0, -8, 30), new Vector3(50, -8, 35), new Vector3(50, 0, 35), new Vector3(0, 0, 30), Color.WHITE());
    displayTrackMesh.convertQuadToTrisAndAddThem(new Vector3(50, -8, 35), new Vector3(100, -8, 40), new Vector3(100, 0, 40), new Vector3(50, 0, 35), Color.RED());
}

//builds the mesh for our player's race car
//YES i put all of these in by hand and YES it took a while but it was fun :)
function buildCarMesh() {
    //build our car mesh
    carMesh = new Mesh();
    //left side bottom
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-5, -4, 8), new Vector3(-5, -5, -12), new Vector3(-5, -.5, -8), new Vector3(-5, 0, 10), playerCarColor);
    //back bottom
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-5, -5, -12), new Vector3(5, -5, -12), new Vector3(5, -.5, -8), new Vector3(-5, -.5, -8), playerCarColor);
    //right bottom
    carMesh.convertQuadToTrisAndAddThem(new Vector3(5, -5, -12), new Vector3(5, -4, 8), new Vector3(5, 0, 10), new Vector3(5, -.5, -8), playerCarColor);
    //front bottom
    carMesh.convertQuadToTrisAndAddThem(new Vector3(5, -4, 8), new Vector3(-5, -4, 8), new Vector3(-5, 0, 10), new Vector3(5, 0, 10), playerCarColor);

    // //left side mid
    // carMesh.convertQuadToTrisAndAddThem(new Vector3(-4, -5, 4), new Vector3(-4, -5, -6), new Vector3(-5, -5, -12), new Vector3(-5, -4, 8), playerCarColor);
    // //back mid
    // carMesh.convertQuadToTrisAndAddThem(new Vector3(-4, -5, -6), new Vector3(4, -5, -6), new Vector3(5, -5, -12), new Vector3(-5, -5, -12), playerCarColor);
    // //right mid
    // carMesh.convertQuadToTrisAndAddThem(new Vector3(4, -5, -6), new Vector3(4, -5, 4), new Vector3(5, -4, 8), new Vector3(5, -5, -12), playerCarColor);
    // //front mid
    // carMesh.convertQuadToTrisAndAddThem(new Vector3(4, -5, 4), new Vector3(-4, -5, 4), new Vector3(-5, -4, 8), new Vector3(5, -4, 8), playerCarColor);

    carMesh.convertQuadToTrisAndAddThem(new Vector3(-5, -4, 8), new Vector3(5, -4, 8), new Vector3(5, -5, -12), new Vector3(-5, -5, -12), playerCarColor);

    //left side top
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-3, -8, 3), new Vector3(-3, -7, -4), new Vector3(-4, -4, -6), new Vector3(-4, -4, 4), playerCarColor);
    //back top
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-3, -7, -4), new Vector3(3, -7, -4), new Vector3(4, -4, -6), new Vector3(-4, -4, -6), playerCarColor);
    //right top
    carMesh.convertQuadToTrisAndAddThem(new Vector3(3, -7, -4), new Vector3(3, -8, 3), new Vector3(4, -4, 4), new Vector3(4, -4, -6), playerCarColor);
    //front top
    carMesh.convertQuadToTrisAndAddThem(new Vector3(3, -8, 3), new Vector3(-3, -8, 3), new Vector3(-4, -4, 4), new Vector3(4, -4, 4), playerCarColor);

    //top top
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-3, -8, 3), new Vector3(3, -8, 3), new Vector3(3, -7, -4), new Vector3(-3, -7, -4), playerCarColor);

    //left front wheel
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-5.2, -3, 8), new Vector3(-5.2, -3, 4), new Vector3(-5.2, 1, 4), new Vector3(-5.2, 1, 8), new Color(25, 25, 25));
    //left back wheel
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-5.2, -3, -3), new Vector3(-5.2, -3, -7), new Vector3(-5.2, 1, -7), new Vector3(-5.2, 1, -3), new Color(25, 25, 25));
    //right front wheel
    carMesh.convertQuadToTrisAndAddThem(new Vector3(5.2, -3, 4), new Vector3(5.2, -3, 8), new Vector3(5.2, 1, 8), new Vector3(5.2, 1, 4), new Color(25, 25, 25));
    //right back wheel
    carMesh.convertQuadToTrisAndAddThem(new Vector3(5.2, -3, -7), new Vector3(5.2, -3, -3), new Vector3(5.2, 1, -3), new Vector3(5.2, 1, -7), new Color(25, 25, 25));

    //windows on car
    //left side window
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-3.5, -7, 2), new Vector3(-3.5, -6, -3), new Vector3(-4.5, -5.5, -5), new Vector3(-4.5, -5.5, 3), new Color(87, 81, 99));
    //back window
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-2, -6.5, -4.5), new Vector3(2, -6.5, -4.5), new Vector3(3, -5.5, -6.5), new Vector3(-3, -5.5, -6.5), new Color(87, 81, 99));
    //right window
    carMesh.convertQuadToTrisAndAddThem(new Vector3(3.5, -6, -3), new Vector3(3.5, -7, 2), new Vector3(4.5, -5.5, 3), new Vector3(4.5, -5.5, -5), new Color(87, 81, 99));
    //front window
    carMesh.convertQuadToTrisAndAddThem(new Vector3(2, -7.5, 3.5), new Vector3(-2, -7.5, 3.5), new Vector3(-3, -5.5, 4.5), new Vector3(3, -5.5, 4.5), new Color(87, 81, 99));


    //front grill and back lights
    //back left light
    carMesh.convertQuadToTrisAndAddThem(new Vector3(-4, -4, -11.5), new Vector3(-2, -4, -11.5), new Vector3(-2, -3, -10.5), new Vector3(-4, -3, -10.5), new Color(200, 200, 200));
    //back right light
    carMesh.convertQuadToTrisAndAddThem(new Vector3(2, -4, -11.5), new Vector3(4, -4, -11.5), new Vector3(4, -3, -10.5), new Vector3(2, -3, -10.5), new Color(200, 200, 200));
    //front grill
    carMesh.convertQuadToTrisAndAddThem(new Vector3(3.1, -3, 9.1), new Vector3(-3.1, -3, 9.1), new Vector3(-3.1, -1.5, 10.1), new Vector3(3.1, -1.5, 10.1), new Color(45, 45, 45));
}

//the big daddy function that generates our random tracks!!!
//runs through the process of placing random points, creating a convex hull, linking track points, and building a mesh
function generateTrack() {
    //randomize our track size
    mapWidth = 1300 + 128 * (Math.random() - .5);
    mapLength = 1300 + 128 * (Math.random() - .5);
    mapHeight = 200 + 100 * (Math.random() - .5);

    //clear our arrays
    randomPoints = [];
    convexHull = [];
    trackPoints = [];
    boostPads = [];
    highlightCycleTimer = 0;

    //init our race track and randomized height map
    raceTrack = new RaceTrack();
    heightMap = new HeightMap();

    //place points in a 2D space from 0 to 1.
    placeRandomPoints();

    //debug draw the points on the screen
    //drawRandomPoints();

    //run Jarvis March algorithm to build our convex hull polygon
    buildConvexHull();

    //add indents at random points on the track to add variation
    for (let i = 0; i < 10; i++) {
        addIndents();
    }

    //push the points away from eachother to make sure no track segments overlap
    for (let i = 0; i < 3; i++) {
        pushPointsAway();
    }

    // for(let i = 0; i < 6; i++){
    //     smoothTrackMesh();
    // }

    //scale our convex hull polygon into 3D gameplay space
    scaleConvexHull();

    //drawConvexHull();

    //build our track points based on our convex hull vertices
    buildTrackPoints();

    //link the track points together
    linkTrackPoints();

    //extrude the track points outward
    extrudePoints();

    //finally, generate our racetrack mesh and the track segments needed for gameplay
    buildTrackMesh();

    //also init our racetrack models
    trackModel = new Model(0, 0, 0, 0, 0, 0, .0625, .25, .0625, trackMesh);
    trackBumperModel = new Model(0, 0, 0, 0, 0, 0, .0625, .25, .0625, trackBumperMesh);
    trackFinishLineModel = new Model(0, 0, 0, 0, 0, 0, .0625, .25, .0625, trackFinishLineMesh);
}

//places points in random places on a 2D space.
function placeRandomPoints() {
    //randomize our number of points
    let numOfPoints = 50 + 15 * (Math.random() - .5);
    for (let i = 0; i < numOfPoints; i++) {
        //our points go on domain and range 0 to 1
        randomPoints.push(new Vector2(Math.random(), Math.random()));
    }
}

//debug, draws the points on the screen in red
function drawRandomPoints() {
    for (let p of randomPoints) {
        render.beginFill(Color.RED().toHex(), 1);
        render.drawRect(p.x * sceneWidth, p.y * sceneHeight, 5, 5);
    }
}

//runs through a modified Jarvis March algorithm to build our convex hull
function buildConvexHull() {
    //find the right most point (point with largest x)
    let rightMostPoint = randomPoints[0];
    for (let p of randomPoints) {
        if (p.x > rightMostPoint.x)
            rightMostPoint = p;
    }

    let a = rightMostPoint;
    convexHull = [];
    //our hull starts with our rightmost point: a
    convexHull.push(a);
    do {
        let b = randomPoints[0];
        for (let c of randomPoints) {
            //skip this point if its the same as the one we are on right now
            if (c.x == a.x && c.y == a.y)
                continue;

            //cross poduct gives us relative angle between these points, find the biggest one (the most CCW)
            let crossProduct = Vector2.cross3(a, b, c);
            if (crossProduct >= 0) {
                b = c;
            }
        }

        //once we find the most CCW point, add it to our convex hull
        if (b != a) {
            convexHull.push(b);
            a = b;
        }
        //stop adding points once we hit our starting point
    } while (a != rightMostPoint);

    convexHull.pop();
}

//debug draws the points in the convex hull shape in green
function drawConvexHull() {
    for (let p of convexHull) {
        render.beginFill(Color.GREEN().toHex(), 1);
        render.drawRect(p.x * sceneWidth, p.y * sceneHeight, 5, 5);
    }

    render.beginFill(Color.WHITE().toHex(), 1);
    render.drawRect(convexHull[0].x * sceneWidth, convexHull[0].y * sceneHeight, 5, 5);
}

//cuts up long pieces of track in random spots, and moves those new vertices a random amount.
//this adds nice variation and barriers that the player can drift around
function addIndents() {
    //go through each point in the convex hull
    for (let i = 0; i < convexHull.length; i++) {
        let a, b;
        //a = the point
        //b = the point that comes after this one
        if (i == convexHull.length - 1) {
            a = convexHull[i];
            b = convexHull[0];
        } else {
            a = convexHull[i];
            b = convexHull[i + 1];
        }
        //if the dist between the 2 is great enough
        if (Vector2.dist(a, b) > .25) {
            // get point C that is between the 2 points (at a random spot between them)
            let c = Vector2.lerp(a, b, .5 + .3 * (Math.random() - .5));
            //get the direction we can move the point
            let normalDirection = Vector2.subtract(b, a).perpCW().getNormal();
            //move C a random amount
            c = Vector2.add(c, Vector2.multiply(normalDirection, .25 * (Math.random() - .5)));
            //insert C into our convex hull
            convexHull.splice(i + 1, 0, c);
        }
    }
}

//attempts to push the points on our convex hull away from eachother to prevent overlapping
function pushPointsAway() {
    let distance = .15;
    //loop through every point in the convex hull
    for (let i = 0; i < convexHull.length; i++) {
        for (let j = i + 1; j < convexHull.length; j++) {
            //if 2 points are close enough
            if (Vector2.dist(convexHull[i], convexHull[j]) < distance) {
                //determine the vector direction between the 2, and push them in the opposite way of one another
                let movementDirection = Vector2.subtract(convexHull[j], convexHull[i]).getNormal();
                convexHull[i] = Vector2.add(convexHull[i], Vector2.multiply(movementDirection, -1 * (distance - Vector2.dist(convexHull[i], convexHull[j]))));
                convexHull[j] = Vector2.add(convexHull[j], Vector2.multiply(movementDirection, distance - Vector2.dist(convexHull[i], convexHull[j])));
            }
        }
    }
}

//converts our convex hull vertices that are in the 2D domain/range 0 to 1 to our actual-sized gameplay space
function scaleConvexHull() {
    for (let i = 0; i < convexHull.length; i++) {
        convexHull[i] = new Vector2(convexHull[i].x * mapWidth - (mapWidth / 2), mapLength - convexHull[i].y * mapLength - (mapLength / 2));
    }
}

//never used, was too unstable, but it did sometimes smooth curves in the track
function smoothTrackMesh() {
    for (let i = 0; i < convexHull.length; i++) {
        let a, b;
        if (i == convexHull.length - 1) {
            a = convexHull[i];
            b = convexHull[0];
        } else {
            a = convexHull[i];
            b = convexHull[i + 1];
        }
        if (Vector2.dist(a, b) > .15) {
            console.log(i);
            let c = Vector2.lerp(a, b, .5);
            convexHull.splice(i + 1, 0, c);
        }
    }
}

//we take the vertices of our convex hull, and build 'track points' in 3D space based on them
function buildTrackPoints() {
    trackPoints = [];
    //these points will be extruded by a random amount to give the racetrack some width
    let widthBase = average(mapWidth, mapLength) / 5;
    let widthVariation = widthBase / (2);
    for (let i = 0; i < convexHull.length; i++) {
        //create our new track points with randomized widths
        trackPoints.push(new TrackPoint(convexHull[i].x, 0, convexHull[i].y, widthBase + widthVariation * (Math.random() - .5), true));
    }
}

//the track points have 'next point'and 'previou point' properties
//we set those up here
function linkTrackPoints() {
    for (let i = 0; i < trackPoints.length; i++) {
        //if its the first point, link it to the last point in the list
        if (i == 0) {
            trackPoints[0].previousPoint = trackPoints[trackPoints.length - 1];
            trackPoints[0].nextPoint = trackPoints[1];
        }
        //if its the last point, link it to the first point
        else if (i == trackPoints.length - 1) {
            trackPoints[i].previousPoint = trackPoints[trackPoints.length - 2];
            trackPoints[i].nextPoint = trackPoints[0];
        }
        //any other point, just link to the ones next to it
        else {
            trackPoints[i].previousPoint = trackPoints[i - 1];
            trackPoints[i].nextPoint = trackPoints[i + 1];
        }
    }
}

//we extrude our points by getting their 'outside point', as we are extruding them outward
function extrudePoints() {
    for (let i = 0; i < trackPoints.length; i++) {
        trackPoints[i].getOutsidePoint();
    }
}

//would have been used to add speed boost pads to the track
function addBoostPads() {

}

//builds our track mesh along with the red/white striped side barriers, and the finish line
//also generates 'track segments' which are used for gameplay
function buildTrackMesh() {
    trackMesh = new Mesh();
    trackBumperMesh = new Mesh();

    //these track segments are used a lot in game, they represent quads of the track
    let trackSegments = [];
    for (let i = 0; i < trackPoints.length; i++) {
        //get the positions ofthe 4 verts for this segment
        let a = trackPoints[i].nextPoint.pos;
        let b = trackPoints[i].nextPoint.outsidePoint;
        let c = trackPoints[i].outsidePoint;
        let d = trackPoints[i].pos;
        //build this part of the mesh
        trackMesh.convertQuadToTrisAndAddThem(a, b, c, d, new Color(255 * ((i + 1) / (trackPoints.length)), 255 * ((i + 1) / (trackPoints.length)), 255 * ((i + 1) / (trackPoints.length))))
        trackSegments.push(new TrackSegment(a, b, c, d, trackMesh.tris[trackMesh.tris.length - 2], trackMesh.tris[trackMesh.tris.length - 1], trackPoints[i], trackPoints[i].nextPoint, i));

        //start creating the side barrier mesh

        //barriers on the inside edge of the track
        let bumperFullInsideA = new Vector3(d.x, d.y - 8, d.z);
        let bumperFullInsideB = new Vector3(a.x, a.y - 8, a.z);
        let numberOfStripes = 4;
        for (let j = 0; j < numberOfStripes; j++) {
            //4 verts of a barrier stripe
            let stripeA = Vector3.lerp(bumperFullInsideA, bumperFullInsideB, j / numberOfStripes);
            let stripeB = Vector3.lerp(bumperFullInsideA, bumperFullInsideB, 1 / numberOfStripes + j / numberOfStripes);
            let stripeC = Vector3.lerp(d, a, 1 / numberOfStripes + j / numberOfStripes);
            let stripeD = Vector3.lerp(d, a, j / numberOfStripes);

            //alternate between red and white colors
            let stripeColor = Color.RED();
            if (j % 2 == 0)
                stripeColor = Color.WHITE();

            //finally build the mesh
            trackBumperMesh.convertQuadToTrisAndAddThem(stripeA, stripeB, stripeC, stripeD, stripeColor);
            trackSegments[i].insideBarrierMesh.convertQuadToTrisAndAddThem(stripeA, stripeB, stripeC, stripeD, stripeColor);
        }

        let bumperFullOutsideA = new Vector3(b.x, b.y - 8, b.z);
        let bumperFullOutsideB = new Vector3(c.x, c.y - 8, c.z);
        for (let j = 0; j < numberOfStripes; j++) {
        //barriers on the OUTSIDE edge of the track
            let stripeA = Vector3.lerp(bumperFullOutsideA, bumperFullOutsideB, j / numberOfStripes);
            let stripeB = Vector3.lerp(bumperFullOutsideA, bumperFullOutsideB, 1 / numberOfStripes + j / numberOfStripes);
            let stripeC = Vector3.lerp(b, c, 1 / numberOfStripes + j / numberOfStripes);
            let stripeD = Vector3.lerp(b, c, j / numberOfStripes);

            //alternate between red and white colors

            let stripeColor = Color.RED();
            if (j % 2 == 0)
                stripeColor = Color.WHITE();

            //finally build the mesh
            trackBumperMesh.convertQuadToTrisAndAddThem(stripeA, stripeB, stripeC, stripeD, stripeColor);
            trackSegments[i].outsideBarrierMesh.convertQuadToTrisAndAddThem(stripeA, stripeB, stripeC, stripeD, stripeColor);
        }
    }


    trackFinishLineMesh = new Mesh();
    let finishLineA = Vector3.lerp(trackPoints[0].pos, trackPoints[0].nextPoint.pos, .2);
    let finishLineB = Vector3.lerp(trackPoints[0].outsidePoint, trackPoints[0].nextPoint.outsidePoint, .2);
    let finishLineC = Vector3.lerp(trackPoints[0].outsidePoint, trackPoints[0].previousPoint.outsidePoint, .2);
    let finishLineD = Vector3.lerp(trackPoints[0].pos, trackPoints[0].previousPoint.pos, .2);
    finishLineA.y -= .1;
    finishLineB.y -= .1;
    finishLineC.y -= .1;
    finishLineD.y -= .1;
    for (let i = 0; i < 8; i++) {
        let color = Color.WHITE();
        if (i % 2 == 0)
            color = new Color();
        trackFinishLineMesh.convertQuadToTrisAndAddThem(Vector3.lerp(finishLineA, finishLineB, i / 8),
            Vector3.lerp(finishLineA, finishLineB, 1 / 8 + i / 8),
            Vector3.lerp(trackPoints[0].pos, trackPoints[0].outsidePoint, 1 / 8 + i / 8),
            Vector3.lerp(trackPoints[0].pos, trackPoints[0].outsidePoint, i / 8),
            color);
    }

    for (let i = 0; i < 8; i++) {
        let color = new Color();
        if (i % 2 == 0)
            color = Color.WHITE();
        trackFinishLineMesh.convertQuadToTrisAndAddThem(Vector3.lerp(trackPoints[0].pos, trackPoints[0].outsidePoint, i / 8),
            Vector3.lerp(trackPoints[0].pos, trackPoints[0].outsidePoint, 1 / 8 + i / 8),
            Vector3.lerp(finishLineD, finishLineC, 1 / 8 + i / 8),
            Vector3.lerp(finishLineD, finishLineC, i / 8),
            color);
    }

    raceTrack.addAndSortSegments(trackSegments);
    for (let i = 0; i < raceTrack.segments.length; i++) {
        if (i == 0) {
            raceTrack.segments[0].previousSegment = raceTrack.segments[raceTrack.segments.length - 1];
            raceTrack.segments[0].nextSegment = raceTrack.segments[1];
        }
        else if (i == trackPoints.length - 1) {
            raceTrack.segments[i].previousSegment = raceTrack.segments[raceTrack.segments.length - 2];
            raceTrack.segments[i].nextSegment = raceTrack.segments[0];
        }
        else {
            raceTrack.segments[i].previousSegment = raceTrack.segments[i - 1];
            raceTrack.segments[i].nextSegment = raceTrack.segments[i + 1];
        }
    }
    raceTrack.calculateLengthAndPercentages();
    highlightCycleTimer = 0;
    raceTrack.highlightNextSegment();
    raceTrack.mesh = trackMesh;
    raceTrack.model = trackModel;
}

//prepares our race track, player car, and meshes for the start of a race!
function startRace() {
    //reset our track
    raceTrack.resetTrack();
    //switch our game state to the racing one
    setGameState(4);

    //set our player's auto accel option
    let autoAccel = false;
    if (playerCar)
        autoAccel = playerCar.autoAccelerate;
    playerCar = new Car(carMesh);
    playerCar.autoAccelerate = autoAccel;

    //add our car to he track
    raceTrack.cars.push(playerCar);
    raceTrack.placeCarsOnTrack();

    //reset our meshes to the right place
    camera.rot = new Vector3(0, 0, 0);
    camera.rotPitch(-32);
    trackModel.scale = new Vector3(1, 1, 1);
    trackModel.rot = new Vector3(0, 0, 0);
    trackBumperModel.scale = new Vector3(1, 1, 1);
    trackBumperModel.rot = new Vector3(0, 0, 0);
    trackFinishLineModel.scale = new Vector3(1, 1, 1);
    trackFinishLineModel.rot = new Vector3(0, 0, 0);
    raceTrack.resetColors();
}

//this gets called every frame, updates and renders our 3D graphics
function updateLoop() {
    // #1 - Calculate "delta time"
    let dt = 1 / app.ticker.FPS;
    if (dt > 1 / 12) dt = 1 / 12;

    //reset our rendering objects
    render.clear();
    clearRenderBuffer();
    clearDepthBuffer();

    //get our mouse position
    mousePosition = app.renderer.plugins.interaction.mouse.global;

    //update our steering wheel HUD element
    steeringWheel.update(dt);


    //This huge if else positions the camera, models, and updates objects depending on what state the game is in

    if (gameState == 0) { 
        //title screen: spin the car and move background
        displayCarModel.pos = new Vector3(0, 0, 0);
        camera.pos = new Vector3(0, -27, -80);
        camera.rot = new Vector3(rad(-14), 0, 0);
        camera.fov = 90;
        displayCarModel.rotYaw(dt * -30);
        rasterizer.drawModel(displayCarModel);
        moveMenuBackground(dt);
    } else if (gameState == 1) {
        //How to play: hide car, move backgorund
        camera.pos = new Vector3(0, -27, -80);
        camera.rot = new Vector3(rad(-14), 0, 0);
        camera.fov = 90;
        displayCarModel.rotYaw(dt * -30);
        moveMenuBackground(dt);
    } else if (gameState == 2) {
        //car color customize: spin car, move background, draw track display mesh
        displayCarModel.pos.x = 17;
        camera.pos = new Vector3(0, -27, -80);
        camera.rot = new Vector3(rad(-14), 0, 0);
        camera.fov = 90;
        displayCarModel.rotYaw(dt * -30);
        moveMenuBackground(dt);
        rasterizer.drawModel(displayCarModel);
        rasterizer.drawModel(displayTrackModel);
    } else if (gameState == 3) {
        // track preview scene: spin track models and draw them, highligh track segments, movebackgorund
        camera.pos = new Vector3(0, -60, -140);
        camera.rot = new Vector3(rad(-25), 0, 0);
        camera.fov = 90;
        trackModel.scale = new Vector3(.0625, .25, .0625);
        trackBumperModel.scale = new Vector3(.0625, .25, .0625);
        trackFinishLineModel.scale = new Vector3(.0625, .25, .0625);
        trackModel.rotYaw(dt * 30);
        trackBumperModel.rotYaw(dt * 30);
        trackFinishLineModel.rotYaw(dt * 30);
        moveMenuBackground(dt);
        highlightCycleTimer += dt;
        if (highlightCycleTimer > .05) {
            highlightCycleTimer = 0;
            raceTrack.highlightNextSegment();
        }
        rasterizer.drawModel(trackModel);
        rasterizer.drawModel(trackBumperModel);
        rasterizer.drawModel(trackFinishLineModel);
    } else if (gameState == 4) {
        // gameplay/racing state: update our race track,
        raceTrack.update(dt);
        //check for pause button press
        if (keysReleased["27"] && !keysHeld["27"] || keysReleased["82"] && !keysHeld["82"]) {
            if (countDownSound.playing()) {
                countDownSound.pause();
            }
            setGameState(5);
        }
        //check for E press to toggle auto accel and display the HUD label for it
        if (keysReleased["69"] && !keysHeld["69"]) {
            playerCar.autoAccelerate = !playerCar.autoAccelerate;
        }
        if (playerCar.autoAccelerate) {
            autoAccelerateLabel.text = "Auto-Accelerate";
        } else {
            autoAccelerateLabel.text = "";
        }

        //reset game music volume (the pause menu lowers it)
        gameMusic.volume(.9);

        //position camera behind the car and rotate it with the car's turn
        let carForwardDirection = new Vector2(Math.sin(rad(playerCar.carYawRot)), Math.cos(rad(playerCar.carYawRot)));
        camera.pos = new Vector3(playerCar.pos.x, playerCar.pos.y - 40, playerCar.pos.z);
        if (playerCar.mirror) {
            camera.pos.x = playerCar.pos.x + 120 * carForwardDirection.x;
            camera.pos.z = playerCar.pos.z + 120 * carForwardDirection.y;
            camera.rot = new Vector3(rad(-10), rad(180 + playerCar.carYawRot), 0);
        } else {
            camera.pos.x = playerCar.pos.x - 120 * carForwardDirection.x;
            camera.pos.z = playerCar.pos.z - 120 * carForwardDirection.y;
            camera.rot = new Vector3(rad(-10), rad(playerCar.carYawRot), 0);
        }

        //draw our track and move the background depending on car rotation
        drawInGameTrackGraphics();
    }
    else if (gameState == 5) {
        //pause state: lower volume of sound/music, check for Unpause key press, draw racetrack
        carDriveSound.volume(.1);
        carIdleSound.volume(.3);
        gameMusic.volume(.35);
        if (keysReleased["27"] && !keysHeld["27"] || keysReleased["82"] && !keysHeld["82"]) {
            setGameState(4);
        }
        drawInGameTrackGraphics();
    }
    else if (gameState == 6) {
        //results state, just draw the 3D racetrack graphics
        drawInGameTrackGraphics();
    }

    //finally, actually display our 3D graphics onto the display
    for (let y = 0; y < inGameResHeight; y++) {
        for (let x = 0; x < inGameResWidth; x++) {
            if (renderBuffer[x][y] != null) {
                render.beginFill(renderBuffer[x][y].toHex(), 1);
                render.drawRect(x * resScale, y * resScale, resScale, resScale);
                render.endFill();
            }
        }
    }

    //reset our controls for next frame
    keysReleased = [];
}

//moves the menu background to the left a bit every frame
function moveMenuBackground(dt){
    bgMenuNear.tilePosition.x -= dt * 70;
    bgMenuFar.tilePosition.x -= dt * 40;
    bgMenuSky.tilePosition.x -= dt * 20;
}

//draws the racetrack, player car, finishline, and moves the track background to match the player car's rotation
function drawInGameTrackGraphics(){
    raceTrack.drawOptimizedTrack(rasterizer);
    rasterizer.drawModel(playerCar);
    if (playerCar.segmentData.segment.index < 2 || playerCar.segmentData.segment.index > raceTrack.segments.length - 6)
        rasterizer.drawModel(trackFinishLineModel);
    bgEvening.tilePosition.x = -16 * playerCar.carYawRot;
}

//event for key press downward
function keysDown(e) {
    //prevent Space bar from scrollin down to the middle of the page
    if (e.keyCode == 32 && e.target == document.body) {
        e.preventDefault();
    }

    //store this key press
    keysHeld[e.keyCode] = true;
    keysReleased[e.keyCode] = false;
}

//event for letting go of a key
function keysUp(e) {
    //store this key release
    keysHeld[e.keyCode] = false;
    keysReleased[e.keyCode] = true;
}

//draws a pixel on the screen depending on the current depth of that pixel
function drawPixelOnScreenWithDepth(color = new Color(), x = 0, y = 0, depth = 0) {
    // if the new pixe lis not within the depth range, dont draw it
    if (depth < 0 || depth >= 1) {
        return;
    }

    //if its inside the screen resolution
    if (x >= 0 && x < inGameResWidth && y >= 0 && y < inGameResHeight) {
        //and its depth is closer to the camera than the current pixel depth is
        if (depthBuffer[x][y] > depth) {
            //draw it and store that depth!
            renderBuffer[x][y] = color;
            depthBuffer[x][y] = depth;
        }

    }
}

//resets our array of pixel colors back to black
function clearRenderBuffer() {
    renderBuffer = [];
    for (let x = 0; x < inGameResWidth; x++) {
        renderBuffer[x] = [];
        for (let y = 0; y < inGameResHeight; y++) {
            renderBuffer[x][y] = null;
        }
    }
}

//resets our array of depth values back to the max value
function clearDepthBuffer() {
    depthBuffer = [];
    for (let x = 0; x < inGameResWidth; x++) {
        depthBuffer[x] = [];
        for (let y = 0; y < inGameResHeight; y++) {
            depthBuffer[x][y] = 1;
        }
    }
}

//creates a tiling background from a texture and adds it to a scene
//also returns the tiling background
function createBg(texture, scene) {
    //create new bG based on the texture
    let tiling = new PIXI.TilingSprite(texture, 1024, 576);

    //reset its position and add to scene
    tiling.position.set(0, 0);
    scene.addChild(tiling);

    //return it
    return tiling;
}
