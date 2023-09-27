//Classes that have to do with the UI of the game

//the HUD element for the rotating steering wheel
class SteeringWheel extends PIXI.Sprite {
    constructor(x = 0, y = 0) {
        super(app.loader.resources["steeringWheel"].texture);
        this.anchor.set(.5, .5);
        this.scale.set(1.4);
        this.x = x;
        this.y = y;
    }

    //rotate the steering wheel sprite so it faces where the mouse is on screen
    update(dt) {
        let mouseTurn = (mousePosition.x - sceneWidth / 2) / (sceneWidth / 2);
        mouseTurn = clamp(mouseTurn, -1, 1);
        this.angle = 40 * mouseTurn;
    }
}

//A slider UI element. lets the user slide a handle across a horizontal trackbar
class TrackBar extends PIXI.Graphics {
    //color values
    barColor;
    handleColor;

    //state for whether its ebing dragged or not
    dragging;

    //the UI object that is the draggable handle
    handle;

    //the value of this track bar (0 to 1 inclusive)
    value;

    //size values
    width;
    height;

    //functions to call
    dragFunction;
    endDragFunction;

    //inits this trackbar and stores its values
    constructor(x = 0, y = 0, width, height, barColor, dragFunction, endDragFunction = dragFunction) {
        super();
        this.beginFill(0x000000);
        this.drawRoundedRect(x - 8, y - 4, width + 16, height + 8, 4);
        this.endFill();
        this.beginFill(barColor);
        this.drawRoundedRect(x, y, width, height, 4);
        this.endFill();
        this.width = width;
        this.height = height;
        this.x = x;
        this.y = y;
        this.interactive = true;
        this.buttonMode = true;
        this.on('pointerover', function(e) {buttonHoverSound.play(); e.target.alpha = 0.7;});
        this.on('pointerout', e => e.currentTarget.alpha = 1.0);

        // events for drag start
        this.on('pointerdown', this.onDragStart)
        // events for drag end
        this.on('pointerup', this.onDragEnd)
        this.on('pointerupoutside', this.onDragEnd)
        // events for drag move
        this.on('pointermove', this.onDragMove)

        this.dragFunction = dragFunction;
        this.endDragFunction = endDragFunction;

        this.handle = new PIXI.Graphics();
        this.handle.x = x;
        this.handle.y = y;
        this.handle.beginFill(0x000000);
        this.handle.drawRoundedRect(-4, -14, 20, 40, 3);
        this.handle.endFill();
        this.handle.beginFill(barColor);
        this.handle.drawRoundedRect(0, -10, 12, 32, 3);
        this.handle.endFill();
        this.addChild(this.handle);
    }


    //when the user clicks on this trackbar, start dragging the handle to the mouse positon
    onDragStart(e) {
        this.alpha = 0.5;
        this.dragging = true;
        selectedButton = this;
        buttonClickSound.play();
    }

    //when  the user stops dragging the handle
    onDragEnd(e) {
        this.alpha = 1;
        this.dragging = false;
        this.endDragFunction();
    }


    //dragging the handle to the mouse positon
    onDragMove(e) {
        if (this.dragging) {
            let value = (mousePosition.x - this.position.x*2)/this.width;
            this.setValue(value)
            this.dragFunction();
        }
    }

    //set the value of this trackbar. will move the handle to its respective position for this value
    setValue(x) {
        x = clamp(x, 0, 1);
        this.handle.position.x = this.width*x + this.position.x - 6;
        this.value = x;
    }
}