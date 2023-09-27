
//CLASSES that have to do with GAME/RACING LOGIC

//represents a point where the racetrack turns, an inside corner of a track segment, or a vertex of the racetrack mesh
class TrackPoint {

    //trackpoints linked to this one
    previousPoint;
    nextPoint;

    //vector3 position of this trackpoint
    pos;

    //the vector3 position of this trackpoint's extrusion
    outsidePoint;
    //half the width of the track, similar to the radius of a circle
    width;
    constructor(x = 0, y = 0, z = 0, width = 4) {
        this.pos = new Vector3(parseInt(x), parseInt(heightMap.getHeight(new Vector2(x, z))), parseInt(z));
        this.width = width;
    }


    //extrudes this trackpoint outward, and returns the final position
    getOutsidePoint() {
        //get the position of the next and previous points
        let beforePoint = this.previousPoint.pos;
        let afterPoint = this.nextPoint.pos;

        //convert to 2D
        beforePoint = beforePoint.toVector2XZ();
        afterPoint = afterPoint.toVector2XZ();
        let pos2 = this.pos.toVector2XZ();

        //the normal direction is the direction from previous point to next point, orthogonalized clockwise, and normalized (length of 1)
        let normalDirection = Vector2.subtract(afterPoint, beforePoint).perpCW().getNormal();

        //the outsidePoint (our extrusion position) moves along the normal direction, a distance of this trackpoint's width
        let outsidePoint = Vector2.add(pos2, Vector2.multiply(normalDirection, this.width));

        //get the vertical coord of the point by using the heightmap
        outsidePoint = new Vector3(parseInt(outsidePoint.x), parseInt(heightMap.getHeight(new Vector2(outsidePoint.x, outsidePoint.y))), parseInt(outsidePoint.y));
        
        //store the outside point
        this.outsidePoint = outsidePoint;

        //finally were done, return it!
        return outsidePoint;
    }
}

//represents a very simple height map that is used to add height variation to the track
class HeightMap extends Matrix3 {
    constructor() {
        super();
        this.randomize();
    }

    //randomizes the height value (0 to 1) of the 4 corners of the map as well as the middle position
    //and interpolates with random adjustments the values for the points between these
    randomize() {
    //randomizes the height value (0 to 1) of the 4 corners of the map as well as the middle position
        this.a1 = Math.random();
        this.a3 = Math.random();
        this.c1 = Math.random();
        this.c3 = Math.random();
        this.b2 = Math.random();

    //and interpolates with random adjustments the values for the points between these
        this.a2 = lerp(this.a1, this.a3, lerp(.1, .95, Math.random()));
        this.b1 = lerp(this.a1, this.c1, lerp(.1, .95, Math.random()));
        this.b3 = lerp(this.a3, this.c3, lerp(.1, .95, Math.random()));
        this.c2 = lerp(this.c1, this.c3, lerp(.1, .95, Math.random()));
    }

    //give it a point in 3D game space and it will give back the height value of that
    //by interpolating between its main height points
    getHeight(point) {
        //convert the point down to be from 0 to 1
        point = new Vector2(point.x / mapWidth, point.y / mapLength);
        if (point.x < 0) {
            //1st quadrant
            if (point.y >= 0) {
                //bilinearly interpolate the iehgt values in the 1st quad 
                let leftValue = lerp(this.b1, this.a1, point.y);
                let rightValue = lerp(this.b2, this.a2, point.y);
                return mapHeight * (lerp(rightValue, leftValue, -1 * point.x) - .5);
            }
            //4th quadrant
            else {
                //bilinearly interpolate the iehgt values in the 4th quad 
                let leftValue = lerp(this.b1, this.c1, -1 * point.y);
                let rightValue = lerp(this.b2, this.c2, -1 * point.y);
                return mapHeight * (lerp(rightValue, leftValue, -1 * point.x) - .5);
            }
        }
        else {
            //2nd quadrant
            if (point.y >= 0) {
                //bilinearly interpolate the iehgt values in the 2nd quad 
                let leftValue = lerp(this.b2, this.a2, point.y);
                let rightValue = lerp(this.b3, this.a3, point.y);
                return mapHeight * (lerp(rightValue, leftValue, point.x) - .5);
            }
            //3rd quadrant
            else {
                //bilinearly interpolate the iehgt values in the 3rd quad 
                let leftValue = lerp(this.b2, this.c2, -1 * point.y);
                let rightValue = lerp(this.b3, this.c3, -1 * point.y);
                return mapHeight * (lerp(rightValue, leftValue, point.x) - .5);
            }
        }
    }
}


//A segment of the race track as defined by 4 corners of the track.
//encompasses 2 tris of the track mesh
class TrackSegment {
    //the verts and mesh tris that make up this segment
    a; b; c; d;
    tri1; tri2;

    //the meshes for this segments barrier
    insideBarrierMesh;
    outsideBarrierMesh;

    //start and end track points for this segment
    point1; point2;

    //linked to the rest of them
    previousSegment;
    nextSegment;

    //distance from starting trackpoint to end trackpoint
    length;

    //race track completion percentages tied to this segment
    completionPercentageStart;
    completionPercentageFull;

    //index of this segment in the track
    index;

    //the optimal yaw rotation of a car driving forward in this segment
    forwardYawRot;
    //the pitch the car should be at when on this segment
    forwardPitchRot;

    //stores and inits values
    constructor(a, b, c, d, tri1, tri2, point1, point2, index) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.tri1 = tri1;
        this.tri2 = tri2;
        this.insideBarrierMesh = new Mesh();
        this.outsideBarrierMesh = new Mesh();
        this.point1 = point1;
        this.point2 = point2;
        this.index = index;
        this.length = Vector2.dist(this.point1.pos.toVector2XZ(), this.point2.pos.toVector2XZ());
        this.completionPercentageStart = 0;


        //i was having trouble calculating the forward yaw rotation of the segments using ArcTan,
        //as ArcTan is limited to -90 to 90 and i needed a full 360.
        //so instead i creat 2 vectors, one is the forward vector of the segment, one points in every angle o to -360.
        //if they point in the same general direction (their dot product is close to 1), then that angle must be the forward angle!
        let midLine = Vector2.subtract(Vector2.lerp(a.toVector2XZ(), b.toVector2XZ(), .5), Vector2.lerp(d.toVector2XZ(), c.toVector2XZ(), .5)).getNormal();
        let bestDotProduct = -1;
        for (let i = 0; i > -360; i--) {
            let dot = Vector2.dot(midLine, new Vector2(Math.sin(rad(i)), Math.cos(rad(i))));
            if (dot > bestDotProduct) {
                bestDotProduct = dot;
                this.forwardYawRot = i;
            }
        }

        //use the heights of the 4 verts to figure out an approximate pitch rotation
        let forwardPitchRotAD = deg(Math.asin(Vector3.subtract(d, a).getNormal().y));
        let forwardPitchRotBC = deg(Math.asin(Vector3.subtract(c, b).getNormal().y));
        this.forwardPitchRot = lerp(forwardPitchRotAD, forwardPitchRotBC, .5);
    }

    //sets the color of the 2 tris this segment owns
    setMeshColor(color) {
        this.tri1.color = color;
        this.tri2.color = color;
    }
}

//represents our race track. has segments, has cars on it, is update each frame during play.
class RaceTrack {
    //the model/mesh of this track
    model;
    mesh;
    //the segments of this track
    segments;
    //the segments sorted into separate arrays based on what quadrant they are in
    segmentsQuad1;
    segmentsQuad2;
    segmentsQuad3;
    segmentsQuad4;

    //which segment is highlighted 
    highlightedTrackSegmentIndex;

    //length of the track
    fullLength;

    //whether the race has started or not
    raceStarted;

    //amount of time left in the countdown, in seconds
    countDownTime;

    //array of cars added to this track
    cars;

    //inits values
    constructor() {
        this.segments = [];
        this.segmentsQuad1 = [];
        this.segmentsQuad2 = [];
        this.segmentsQuad3 = [];
        this.segmentsQuad4 = [];
        this.quadsPercentageMaxMins = [];
        this.cars = [];
        this.highlightedTrackSegmentIndex = -1;
        this.raceStarted = false;
        this.countDownTime = 3;
        lapAlertLabel.text = "";
        wrongWayAlertLabel.text = "";
    }

    //resets the racetrack to be ready for a new race
    resetTrack() {
        gameMusic.stop();
        countDownSound.stop();
        countDownSound.play();
        this.cars = [];
        this.highlightedTrackSegmentIndex = -1;
        this.raceStarted = false;
        this.countDownTime = 3;
        lapAlertLabel.text = "";
        wrongWayAlertLabel.text = "";
    }

    //goes through each car and places it on a point in the track
    placeCarsOnTrack() {
        for (let i = 0; i < this.cars.length; i++) {
            let position = this.trackLocationToPoint(new Vector2(.5, .96));
            this.cars[i].pos = new Vector3(position.x, 0, position.y);
            this.cars[i].carYawRot = this.segments[this.segments.length - 1].forwardYawRot;
            this.cars[i].rot.y = rad(this.cars[i].carYawRot);
        }
    }

    //takes track segments and sorts them based on the quadrant of the graph they are in
    //this means when we are searching for a segment to determine which segment a point is in, 
    //we can immediately narrow it down to segments in a specific quadrant
    addAndSortSegments(trackSegments) {
        this.segments = trackSegments;
        //sorts them into respective quads
        for (let i = 0; i < trackSegments.length; i++) {
            let verts = [trackSegments[i].a.toVector2XZ(), trackSegments[i].b.toVector2XZ(), trackSegments[i].c.toVector2XZ(), trackSegments[i].d.toVector2XZ()];
            let quadsAddedTo = [false, false, false, false];
            for (let j = 0; j < 4; j++) {
                if (verts[j].x >= 0 && verts[j].y >= 0 && !quadsAddedTo[0]) {
                    quadsAddedTo[0] = true;
                    this.segmentsQuad1.push(trackSegments[i]);
                }
                else if (verts[j].x < 0 && verts[j].y >= 0 && !quadsAddedTo[1]) {
                    quadsAddedTo[1] = true;
                    this.segmentsQuad2.push(trackSegments[i]);
                }
                else if (verts[j].x < 0 && verts[j].y < 0 && !quadsAddedTo[2]) {
                    quadsAddedTo[2] = true;
                    this.segmentsQuad3.push(trackSegments[i]);
                }
                else if (verts[j].x >= 0 && verts[j].y < 0 && !quadsAddedTo[3]) {
                    quadsAddedTo[3] = true;
                    this.segmentsQuad4.push(trackSegments[i]);
                }
            }
        }
    }


    //calculates the length of this racetrack, and the completion percentages tied to each segment
    calculateLengthAndPercentages() {

        //calculate length by adding up the lengths of each segment
        this.fullLength = 0;
        for (let i = 0; i < this.segments.length; i++) {
            this.fullLength += this.segments[i].length;
        }

        //completion percentage means: how much of the track as been completed, which lets us take a point in world space and
        //map it somewhere on the track
        let completionPercentage = 0;
        for (let i = 1; i < this.segments.length; i++) {
            //each track knows where on the percentage of the track it starts in
            this.segments[i].completionPercentageStart = completionPercentage + this.segments[i].length / this.fullLength;
            completionPercentage = this.segments[i].completionPercentageStart;
        }

        //and each track also needs to know how much percentage of the track it takes up.
        for (let i = 0; i < this.segments.length; i++) {
            if (i == this.segments.length - 1) {
                this.segments[i].completionPercentageFull = 1 - this.segments[i].completionPercentageStart;
            } else {
                this.segments[i].completionPercentageFull = this.segments[i].nextSegment.completionPercentageStart - this.segments[i].completionPercentageStart;
            }
        }
    }

    //call this every frame, updates countdown timer, or if race is already started, updates cars and figures out what segment they are in
    update(dt) {
        //figure out which track segment each car is in
        for (let i = 0; i < this.cars.length; i++) {
            //use the cars position to do this
            let segmentCarIsIn = this.getSegmentDataPointIsIn(this.cars[i].pos.toVector2XZ());

            //if they are outside the track
            if (segmentCarIsIn == undefined || segmentCarIsIn == null) {

                //then get the last segment they were in and move it outside the track
                segmentCarIsIn = this.cars[i].segmentData;
                if (segmentCarIsIn.uv.x < 0)
                    segmentCarIsIn.uv.x = -2;
                else
                    segmentCarIsIn.uv.x = 2;
            }

            //then set the car's segment data and its 'track location'
            this.cars[i].setSegmentData(segmentCarIsIn);
            this.cars[i].trackLocation = this.pointToTrackLocation(this.cars[i].pos.toVector2XZ(), this.cars[i].segmentData);
        }

        //if the race has not started yet
        if (!this.raceStarted) {

            if (this.countDownTime == 3) {
                //update all the cars just ONCE
                for (let i = 0; i < this.cars.length; i++) {
                    this.cars[i].update(dt);
                }
            }
            //count down on the countdown timer and display time on the countdown label
            this.countDownTime -= dt;
            countDownLabel.text = parseInt(this.countDownTime + 1);
            if (this.countDownTime <= 0) {
                if (!gameMusic.playing())
                    gameMusic.play();
                countDownLabel.text = "GO!"
                this.raceStarted = true;
            }
        } else {

            //if the race started, update countdown label then hide it
            if (this.countDownTime > -.75) {
                this.countDownTime -= dt;
                countDownLabel.text = "GO!"
            } else {
                countDownLabel.text = "";
            }
            // get the places of each car in the race
            // for (let i = 0; i < this.cars.length; i++) {
            //     this.cars[i].placeInRace = this.cars.length + 1;
            //     for (let j = 0; j < this.cars.length; j++) {
            //         if (i != j && this.cars[i].getCompletionPercentage() > this.cars[j].getCompletionPercentage()) {
            //             this.cars[i].placeInRace--;
            //         }
            //     }
            // }

            //update cars on this track
            for (let i = 0; i < this.cars.length; i++) {
                this.cars[i].update(dt);
            }
        }

    }

    //this method only draws the track segments closest to the player
    drawOptimizedTrack(rasterizer) {
        //how many segments ahead we should draw
        let renderDist = 6;
        //start with the segment behind the player
        let segmentToDraw = playerCar.segmentData.segment.previousSegment;
        for (let i = 0; i < renderDist; i++) {
            //draw the tris and barriers for each segment
            rasterizer.drawTri(segmentToDraw.tri1);
            rasterizer.drawTri(segmentToDraw.tri2);
            for (let j = 0; j < segmentToDraw.insideBarrierMesh.tris.length; j++) {
                rasterizer.drawTri(segmentToDraw.insideBarrierMesh.tris[j], false);
                rasterizer.drawTri(segmentToDraw.outsideBarrierMesh.tris[j], false);
            }
            //move to next segment
            segmentToDraw = segmentToDraw.nextSegment;
        }
    }

    //resets the colors of the tris of this track's mesh to a slight grey gradient
    resetColors() {
        for (let i = 0; i < this.segments.length; i++) {
            this.segments[i].setMeshColor(new Color(50 + 60 * ((i + 1) / (trackPoints.length)), 50 + 60 * ((i + 1) / (trackPoints.length)), 50 + 60 * ((i + 1) / (trackPoints.length))));
        }
    }

    //returns an object that has the segment that the point is in, the tri that point is in, 
    //the barycentric coords of that point in that tri, and the bilinear coords of the point on that segment
    getSegmentDataPointIsIn(point) {

        //narrow down our segment search to just segments in one of the quadrants of the map
        let segmentsToSearch;
        if (point.x >= 0 && point.y >= 0) {
            segmentsToSearch = this.segmentsQuad1;
        }
        else if (point.x < 0 && point.y >= 0) {
            segmentsToSearch = this.segmentsQuad2;
        }
        else if (point.x < 0 && point.y < 0) {
            segmentsToSearch = this.segmentsQuad3;
        }
        else if (point.x >= 0 && point.y < 0) {
            segmentsToSearch = this.segmentsQuad4;
        }

        
        for (let i = 0; i < segmentsToSearch.length; i++) {
            //check the first tri of the segment
            let triBarycentricCoord = Vector2.triBarycentricCoords(segmentsToSearch[i].tri1.a.toVector2XZ(), segmentsToSearch[i].tri1.b.toVector2XZ(), segmentsToSearch[i].tri1.c.toVector2XZ(), point);
            //if the barycentric coord of the point on the tri is within the tri
            if (triBarycentricCoord.x + triBarycentricCoord.y + triBarycentricCoord.z <= 1.2) {
                //then the point is in this segment, get UVs and return object!
                let bilinearCoord = Vector2.bilinearCoords(new Vector2(triBarycentricCoord.y, 1 - triBarycentricCoord.z));
                return { segment: segmentsToSearch[i], tri: segmentsToSearch[i].tri1, bary: triBarycentricCoord, uv: bilinearCoord };
            }
            //check the second tri of the segment
            triBarycentricCoord = Vector2.triBarycentricCoords(segmentsToSearch[i].tri2.b.toVector2XZ(), segmentsToSearch[i].tri2.c.toVector2XZ(), segmentsToSearch[i].tri2.a.toVector2XZ(), point);
            //if the barycentric coord of the point on the tri is within the tri
            if (triBarycentricCoord.x + triBarycentricCoord.y + triBarycentricCoord.z <= 1.2) {
                //then the point is in this segment, get UVs and return object!
                let bilinearCoord = Vector2.bilinearCoords(new Vector2(1 - triBarycentricCoord.y, triBarycentricCoord.z));
                return { segment: segmentsToSearch[i], tri: segmentsToSearch[i].tri2, bary: triBarycentricCoord, uv: bilinearCoord };
            }
        }
    }

    //converts a point in 2D space (top-down) to a location on the track
    //with the Y value of the location being the completion percentage of the track, and the X value being the width of the track
    pointToTrackLocation(point, segmentData) {
        //if not segment is defined, then find it with the method above!
        if (segmentData == null)
            segmentData = this.getSegmentDataPointIsIn(point);

            //calculate completion percentage with regards to the segment point is in
        let y = segmentData.segment.completionPercentageStart + (segmentData.uv.y * segmentData.segment.completionPercentageFull);

        return new Vector2(segmentData.uv.x, y);
    }

    //Converts a track location to a 2D 9top-down) point in game space
    trackLocationToPoint(location) {
        //find which segment this locatio is in
        let segmentLocationIsIn = this.segments[this.segments.length - 1];
        for (let i = 1; i < this.segments.length; i++) {
            if (location.y <= this.segments[i].completionPercentageStart) {
                segmentLocationIsIn = this.segments[i - 1];
                break
            }
        }
        //get the Y value of the segments quad
        let percentageY = (location.y - segmentLocationIsIn.completionPercentageStart) / segmentLocationIsIn.completionPercentageFull;

        //and then bilinearly interpolate between the positions of the 4 vertices of the segment and return the result!
        return Vector2.bilinearInterp(new Vector2(location.x, percentageY), segmentLocationIsIn.a.toVector2XZ(), segmentLocationIsIn.b.toVector2XZ(),
            segmentLocationIsIn.c.toVector2XZ(), segmentLocationIsIn.d.toVector2XZ());
    }

    //highlights the next segment of the track (used to make that colorful, 'snake' looking thing on the track preview)
    highlightNextSegment() {
        this.highlightedTrackSegmentIndex++;
        //if we hit the end, move back to start
        if (this.highlightedTrackSegmentIndex == this.segments.length)
            this.highlightedTrackSegmentIndex = 0;
        this.resetColors();
        //for loop adds a nice gradient
        for (let i = 0; i < 4; i++) {
            this.segments[moveIntoRange(this.highlightedTrackSegmentIndex - i, 0, this.segments.length)].setMeshColor(new Color(playerCarColor.red - i * 50, playerCarColor.green - i * 50, playerCarColor.blue - i * 50));
        }
    }
}


//represents the player controlled car! 
class Car extends Model {
    //having to deal with physics/control of the vehicle
    vel;
    acc;
    bumpVel;
    accMagnitude;
    speed;
    currentMaxSpeed = 500;
    maxSpeed = 500;
    minSpeed = -120;
    drifting;
    wasDrifting;
    mirror;
    turnAmount;
    autoAccelerate;

    //bump speed is the speed the car is moving after it hits a barrier
    //while the bump speed is greater than the minimum bump speed, the player has not control over the car (this is basically a small stun)
    bumpSpeed;
    minBumpSpeed = 10;


    //keeping track of time spent on the track
    timeSpent = 0;
    lapTimes;
    numberOfLaps = 5;

    //vehicle properties
    currentMaxAccMagnitude = 11;
    maxAccMagnitude = 11;
    carYawRot;

    //having to do with location on track
    segmentData;
    trackLocation;
    lapCount;
    placeInRace;
    //to make sure the car has gone all the way around the track to count a lap
    //we keep track of which segments the player has entered.
    segmentsEntered = [];


    //just takes the car mesh, inits the rest of the values
    constructor(mesh) {
        super(0, 0, 0, 0, 0, 0, 2, 2, 2, mesh);
        this.lapCount = -1;
        this.segmentsEntered = [];
        this.vel = new Vector2();
        this.acc = new Vector2();
        this.carYawRot = 0;
        this.speed = 0;
        this.bumpSpeed = 0;
        this.turnAmount = 0;
        this.carYawRot = 0;
        this.autoAccelerate = false;
        this.timeSpent = 0;
        this.lapTimes = [];
        for (let i = 0; i < this.numberOfLaps; i++) {
            this.lapTimes.push(0);
        }

        //reset all of the car sounds
        carDriveSound.stop();
        carDriveSound.play();
        carDriveSound.volume(0);

        carIdleSound.stop();
        carIdleSound.play();
    }

    //when the player actually crosses the finish line to complete a lap
    //either finishes the race or updates lap alert label
    increaseLapCount() {
        //increment lap count
        this.lapCount++;
        if (this.lapCount + 1 < this.numberOfLaps) {
            //update hud element/play animation here
            lapAlertLabel.text = "LAP " + (this.lapCount + 1) + "/" + this.numberOfLaps;
            lapCountSound.play();
        }
        //display 'final lap' if its the last lap
        else if (this.lapCount + 1 == this.numberOfLaps) {
            lapAlertLabel.text = "FINAL LAP!";
            lapCountSound.play();
        }
        //if that wasthe last lap, end the race!
        else if (this.lapCount + 1 > this.numberOfLaps) {
            //sort through our lap times to find the best lap
            let bestLap = 0;
            for (let i = 0; i < this.lapTimes.length; i++) {
                if (this.lapTimes[i] < this.lapTimes[bestLap]) {
                    bestLap = i;
                }
            }

            //set the HUD labels to the times, highlight the best one in yellow
            for (let i = 0; i < this.lapTimes.length; i++) {
                resultsLapTimeLabels[i].text = secondsToTimeString(this.lapTimes[i]);
                resultsLapNumberLabels[i].style = hudLabelStyleWhite;
                resultsLapTimeLabels[i].style = hudLabelStyleWhite;
                if (i == bestLap) {
                    resultsLapTimeLabels[i].style = hudLabelStyleYellow;
                    resultsLapNumberLabels[i].style = hudLabelStyleYellow;
                }
            }

            resultsTotalTimeLabel.text = secondsToTimeString(this.timeSpent);

            //stop all  car sounds
            carDriveSound.stop();
            carIdleSound.stop();
            gameMusic.stop();

            //play victory sound! yay!
            victorySound.play();

            //set gamestate to results
            setGameState(6);
        }
    }


    //the the segment data that represents that segment this car is in
    setSegmentData(segmentData) {
        //stor values
        this.segmentData = segmentData;
        this.trackLocation = segmentData.uv;

        //if we are on the first segment 
        if (segmentData.segment.index == 0) {
            //at the start of the race
            if (this.lapCount == -1) {
                //just reset the lap counter when you first cross the finish line
                this.lapCount = 0;
            } 
            //if the user has completed/entered the segments leading up to this one, count the lap!
            else if (this.segmentsEntered[segmentData.segment.previousSegment.index] || this.segmentsEntered[segmentData.segment.previousSegment.previousSegment.index]) {
                this.increaseLapCount();
            }

            //reset the entered segments array when they cross the finish line/enter this segment
            this.segmentsEntered = [];
            for (let i = 0; i < raceTrack.segments.length; i++) {
                this.segmentsEntered.push(false);
            }
            this.segmentsEntered[0] = true;
        } 
        //if we are not at the first segment, and we have actually started the race
        else if (this.lapCount != -1) {
            //then count this segment as 'complete'. the user has to enter/complete almost all segments to count a lap
            if (this.segmentsEntered[segmentData.segment.previousSegment.index] || this.segmentsEntered[segmentData.segment.previousSegment.previousSegment.index]) {
                this.segmentsEntered[segmentData.segment.index] = true;
            }
        }
    }

    //gets the FULL completion percentage for the full race (used for determine this cars 'place' in the race)
    getCompletionPercentage() {
        return this.lapCount + this.trackLocation.y;
    }

    //call this every frame. updates controls, physics, rotation angle, sounds, you name it
    update(dt) {
        //store if this car was drifting in the previous frame
        this.wasDrifting = this.drifting;

        //update time septn HUD label
        timeLabel.text = secondsToTimeString(this.timeSpent);

        //count up on time spent
        if (this.lapCount != -1 && this.lapCount < this.numberOfLaps) {
            this.timeSpent += dt;
            this.lapTimes[this.lapCount] += dt;
            if (this.lapTimes[this.lapCount] > 1) {
                lapAlertLabel.text = "";
            }
        }

        //update Speed HUD label
        if (this.bumpSpeed >= this.minBumpSpeed) {
            speedLabel.text = parseInt(Math.abs(this.bumpSpeed / 6)) + " mph";
        } else {
            speedLabel.text = parseInt(Math.abs(this.speed / 6)) + " mph";
        }

        //update lap count HUD label
        if (this.lapCount + 1 == 0) {
            lapCountLabel.text = "LAP 1/" + this.numberOfLaps;
        } else {
            lapCountLabel.text = "LAP " + (this.lapCount + 1) + "/" + this.numberOfLaps;
        }

        //reset drifting
        this.drifting = false;
        this.mirror = false;
        //W is gas
        if (this.autoAccelerate || keysHeld["87"]) {
            this.accMagnitude = this.currentMaxAccMagnitude;
        }
        //q is mirror
        if (keysHeld["81"]) {
            this.mirror = true;
        }
        //Shift is break/reverse
        if (keysHeld["16"] || keysHeld["83"]) {
            this.accMagnitude = -this.currentMaxAccMagnitude;
        }
        //space is drift, they have to have some speed first tho
        if (keysHeld["32"] && this.speed > 30 && this.bumpSpeed < this.minBumpSpeed) {
            this.drifting = true;
        }
        //reset acceleration if no gas/reverse is beign pressed
        if (!this.autoAccelerate && !keysHeld["87"] && !keysHeld["83"] && !keysHeld["16"]) {
            this.accMagnitude = 0;
        }

        //get the amount the player is turning
        if (this.drifting) {
            //drifting has sharper, more imprecise steering
            this.turnAmount = lerp(this.turnAmount, Math.sign(mousePosition.x - sceneWidth / 2) * .8, 2 * dt);
            this.turnAmount = clamp(this.turnAmount, -.8, .8);
        } else {
            //normal steering is less sensitive
            //split the screen up into thirds, middle section has no steering, left and right steer respectively
            let screenThird = sceneWidth / 3;
            if (mousePosition.x < screenThird) {
                this.turnAmount = lerp(this.turnAmount, (mousePosition.x - screenThird) / (screenThird) * .3, 2 * dt);
            } else if (mousePosition.x > screenThird && mousePosition.x < screenThird * 2) {
                this.turnAmount = 0;
            } else {
                this.turnAmount = lerp(this.turnAmount, (mousePosition.x - screenThird * 2) / (screenThird) * .3, 2 * dt);
            }
            this.turnAmount = clamp(this.turnAmount, -.3, .3);
        }


        //drifting has a higher max speed and acceleration at the cost of sharper turning
        if (this.drifting) {
            //the more you turn during a drift, the faster you can go!
            this.currentMaxSpeed = this.maxSpeed + 200 * Math.abs(this.turnAmount);
            this.currentMaxAccMagnitude = this.maxAccMagnitude + 100 * Math.abs(this.turnAmount);
        } else {
            this.currentMaxSpeed = this.maxSpeed;
            this.currentMaxAccMagnitude = this.maxAccMagnitude;
        }

        //if the car is not being affected by 'bump speed' (speed applied after crashing into a barrier)
        if (this.bumpSpeed < this.minBumpSpeed) {
            //then increase its speed by the acceleration
            this.speed += this.accMagnitude * dt * 100;
        }
        //lerp between the current speed and max speed
        this.speed = lerp(this.speed, clamp(this.speed, this.minSpeed, this.currentMaxSpeed), 20 * dt);
        //but also let the car slow down due to friction
        this.speed = lerp(this.speed, 0, dt);

        //rotate our accleeration vector/direction based on the car's rotation
        this.acc = new Vector2(Math.sin(rad(this.carYawRot)), Math.cos(rad(this.carYawRot)));

        //rotate the car based on how much its steering
        if (this.drifting) {
            this.carYawRot += this.turnAmount * (this.speed) * dt * 1.2;
        } else {
            this.carYawRot += this.turnAmount * (this.speed) * dt;
        }

        //if the car has been bumped, 
        if (this.bumpSpeed >= this.minBumpSpeed) {
            //half the affectiveness of the acceleration/steering direction
            this.acc = Vector2.multiply(this.acc, .5);
        }

        //turn the cars velocity direction by the acceleration direction
        if (this.speed != 0) {
            this.vel = Vector2.add(this.vel, this.acc).getNormal();
        }

        //if we get too close to the inside edge of the track
        if (this.trackLocation.x <= .03) {

            //move us back inside
            let position = raceTrack.trackLocationToPoint(new Vector2(.17, this.trackLocation.y));
            this.pos.x = position.x;
            this.pos.z = position.y;

            //and bounce us inward
            let bounceDirection = Vector2.subtract(this.segmentData.segment.d.toVector2XZ(), this.segmentData.segment.a.toVector2XZ()).getNormal().perpCCW();
            this.bumpSpeed = this.speed / 1.25;
            this.vel = bounceDirection;

            //also play the car impact sound depending on how faast we were going
            if (this.speed / 6 > 70) {
                carImpactLargeSound.play();
            } else {
                carImpactSmallSound.play();
            }
        }
        else if (this.trackLocation.x >= .97) {
        //if we get too close to the OUTSIDE edge of the track
            let position = raceTrack.trackLocationToPoint(new Vector2(.83, this.trackLocation.y));
            this.pos.x = position.x;
            this.pos.z = position.y;

            //and bounce us outward
            let bounceDirection = Vector2.subtract(this.segmentData.segment.c.toVector2XZ(), this.segmentData.segment.b.toVector2XZ()).getNormal().perpCW();
            this.bumpSpeed = this.speed / 1.25;
            this.vel = bounceDirection;

            //also play the car impact sound depending on how faast we were going
            if (this.speed / 6 > 70) {
                carImpactLargeSound.play();
            } else {
                carImpactSmallSound.play();
            }
        }

        //if affected by bump speed,
        if (this.bumpSpeed >= this.minBumpSpeed) {
            //finally move the cars x and z position based on the bump speed
            this.pos.x += this.vel.x * this.bumpSpeed * dt;
            this.pos.z += this.vel.y * this.bumpSpeed * dt;
            this.bumpSpeed = lerp(this.bumpSpeed, 0, 6 * dt);
        } else {
        //if not affected by bump speed
            //finally move the cars x and z position based on its velocity
            this.pos.x += this.vel.x * this.speed * dt;
            this.pos.z += this.vel.y * this.speed * dt;
        }

        //clamp speed to zero if its close enough
        if (this.speed < 1 && this.speed > -1) {
            this.speed = 0;
        }

        //change camera fov depending on how fast we were moving
        camera.fov = 75 + 22 * (this.speed / this.maxSpeed);

        //change the pitch and volume of the car driving sound effect depending on how fast it was moving
        if (this.drifting) {
            carDriveSound.volume(.3 * Math.abs((this.speed) / this.maxSpeed));
            carDriveSound.rate(Math.abs((this.speed) / this.maxSpeed));
        } else {
            carDriveSound.volume(.4 * Math.abs((this.speed) / this.maxSpeed));
            carDriveSound.rate(Math.abs((this.speed) / this.maxSpeed));
        }

        //if the car starts a drift, play the drift sound affect with a random pitch
        if (!this.wasDrifting && this.drifting) {
            carDriftSound.play();
            carDriftSound.rate(Math.abs((this.speed) / this.maxSpeed) + .3 * (Math.random() - .5));
        }

        //this.rot.y = rad(this.carYawRot - (Math.sign(this.carYawRot) * this.turnAmount * (this.speed / 2) * 1.2)/2);

        //rotate the car's yaw depending on the turn amount
        if (this.drifting) {
            this.rot.y = lerp(this.rot.y, rad(this.carYawRot - Math.sign(this.carYawRot) * this.turnAmount * (this.speed / 6) * 1.2), 20 * dt);
        } else {
            this.rot.y = lerp(this.rot.y, rad(this.carYawRot - Math.sign(this.carYawRot) * this.turnAmount * (this.speed / 6)), 20 * dt);
        }

        //forward vector of car
        let a = new Vector2(Math.sin(rad(this.carYawRot)), Math.cos(rad(this.carYawRot)));
        //forward vector of segment car is in
        let b = new Vector2(Math.sin(rad(this.segmentData.segment.forwardYawRot)), Math.cos(rad(this.segmentData.segment.forwardYawRot)));
        //use these to determine if the car is facing forwards/backwards on the track

        //rotate the car's pitch so it looks like it is going up/down hills
        this.rot.x = lerp(this.rot.x, Vector2.dot(a, b) * rad(this.segmentData.segment.forwardPitchRot), 5 * dt);

        //if you are facing backwards and actually driving backwards, show the "wrong way" text
        if (Vector2.dot(a, b) < -.7) {
            wrongWayAlertLabel.text = "WRONG WAY!";
        } else {
            wrongWayAlertLabel.text = "";
        }

        //finally, after all that, determine the cars height by bilinearly interpolating between the height of this car's segment's 4 vertices
        let yPos = bilinearInterp(this.segmentData.uv, this.segmentData.segment.a.y, this.segmentData.segment.b.y, this.segmentData.segment.c.y, this.segmentData.segment.d.y);
        this.pos.y = yPos;
    }
}
