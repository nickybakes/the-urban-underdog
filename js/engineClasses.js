
//CLASSES that have to do with 3D RENDERING ENGINE

//represents an RGB color value, can convert to Hex
class Color {
    red;
    green;
    blue;
    constructor(red = 0, green = 0, blue = 0) {
        this.red = clamp(parseInt(red), 0, 255);
        this.green = clamp(parseInt(green), 0, 255);
        this.blue = clamp(parseInt(blue), 0, 255);
    }

    //converts a r/g/b component into a hex value
    componentToHexValue(component) {
        let hexValue = component.toString(16);
        //we need to add padding zeros in case the length is not 2
        if (hexValue.length == 1) {
            return "0" + hexValue;
        }
        else {
            return hexValue;
        }
    }

    //returns this color as a HEX string
    toHex() {
        return "0x" + this.componentToHexValue(this.red) + this.componentToHexValue(this.green) + this.componentToHexValue(this.blue);
    }

    //static colors that we can use
    static RED() {
        return new Color(255, 0, 0);
    }

    static BLUE() {
        return new Color(0, 0, 255);
    }

    static GREEN() {
        return new Color(0, 255, 0);
    }
    static YELLOW() {
        return new Color(255, 255, 0);
    }
    static MAGENTA() {
        return new Color(255, 0, 255);
    }

    static WHITE() {
        return new Color(255, 255, 255);
    }

    static BLACK() {
        return new Color(0, 0, 0);
    }

    //the official colors of a Rubik's Cube. Looks great on a default cube mesh :)
    static RUBIX_GREEN() {
        return new Color(0, 155, 72);
    }
    static RUBIX_RED() {
        return new Color(185, 0, 0);
    }
    static RUBIX_BLUE() {
        return new Color(0, 69, 173);
    }
    static RUBIX_ORANGE() {
        return new Color(255, 89, 0);
    }
    static RUBIX_YELLOW() {
        return new Color(255, 213, 0);
    }
}

//represents an object in 3d space, with a position and rotation
class GameObject {
    //represents the location in 3d space of this object
    pos;
    //represents pitch, yaw, and roll of this game object
    rot;
    constructor(xPos = 0, yPos = 0, zPos = 0, pitch = 0, yaw = 0, roll = 0) {
        this.pos = new Vector3(xPos, yPos, zPos);
        this.rot = new Vector3(0, 0, 0);
        this.rotPitch(pitch);
        this.rotYaw(yaw);
        this.rotRoll(roll);
    }

    //the direction this object is facing
    forward() {
        return new Vector3(Math.cos(this.rot.x) * Math.sin(this.rot.y), Math.sin(this.rot.x), Math.cos(this.rot.x) * Math.cos(this.rot.y)).getNormal();
    }

    //rotate the object around the X axis
    rotPitch(deg) {
        //rotate the object on this axis
        this.rot.x += rad(deg);

        //limits our angle to within 0 and 360 degrees
        this.rot.x = moveIntoRange(this.rot.x, 0, 2 * Math.PI);
    }

    //rotate the object around the Y axis
    rotYaw(deg) {
        //rotate the object on this axis
        this.rot.y += rad(deg);

        //limits our angle to within 0 and 360 degrees
        this.rot.y = moveIntoRange(this.rot.y, 0, 2 * Math.PI);
    }

    //rotate the object around the Z axis
    rotRoll(deg) {
        //rotate the object on this axis
        this.rot.z += rad(deg);

        //limits our angle to within 0 and 360 degrees
        this.rot.z = moveIntoRange(this.rot.z, 0, 2 * Math.PI);
    }
}

//a camera is an object in 3d space that can project points in space onto itself
//it gives us data for rendering 3d objects on screen
class Camera extends GameObject {
    fov;
    nearZ;
    farZ;
    //inits values
    constructor(xPos = 0, yPos = 0, zPos = 0, pitch = 0, yaw = 0, roll = 0, fov = 90, nearZ = 1.2, farZ = 1000) {
        super(xPos, yPos, zPos, pitch, yaw, roll);
        this.fov = fov;
        this.nearZ = nearZ;
        this.farZ = farZ;
    }

    //returns the position of the plane for this camera's display
    screenPoint() {
        return new Vector3(this.pos.x, this.pos.y, 1 / Math.tan(rad(this.fov) / 2));
    }

    //takes a point in world space and projects it onto the camera's display
    //returns a point on screen
    perspectiveProjectWorldPoint(worldPoint) {
        //move point so that it is orientated about the camera's origin 0,0,0
        let pointInCameraSpace = Vector3.subtract(worldPoint, this.pos);

        //get rotating matrices ready (we negate them because we rotate everying around the camera
        //the opposite direction that the camera is currently rotated in to give the illusion of rotation)
        let yawRotMatrix = Matrix3.CreateRotationY(-this.rot.y);
        let pitchRotMatrix = Matrix3.CreateRotationX(-this.rot.x);
        let rollRotMatrix = Matrix3.CreateRotationZ(-this.rot.z);

        //rotate everything around our camera
        let pointRotatedInCameraSpace = Vector3.transform(pointInCameraSpace, yawRotMatrix);
        pointRotatedInCameraSpace = Vector3.transform(pointRotatedInCameraSpace, pitchRotMatrix);
        pointRotatedInCameraSpace = Vector3.transform(pointRotatedInCameraSpace, rollRotMatrix);
        //finding where the line is when Z is a certain amount in front of our camera.
        //(finding where the line intersects the camera plane)
        let f = this.screenPoint().z;
        let s = f / Math.abs(pointRotatedInCameraSpace.z);
        if(pointRotatedInCameraSpace.z <= 0){
            s = f * Math.abs(pointRotatedInCameraSpace.z);
        }
        let x3d = pointRotatedInCameraSpace.x * s;
        let y3d = pointRotatedInCameraSpace.y * s;

        //convert from 3d camera space to 2d screen space, adjusting for depth, aspect ratio, and fov
        let aspectRatio = inGameResWidth / inGameResHeight;
        let x2d = x3d - (s / 2) + 0.5;
        let y2d = (y3d * aspectRatio) - (s / 2) + 0.5;

        //if a point is behind the camera, then its projection needs to be reversed
        // if (pointRotatedInCameraSpace.z <= 0) {
        //     if (y2d >= 0)
        //         y2d = clamp(-y2d, -.5, -2048);
        //     else
        //         y2d = clamp(y2d, 2048, .5);
        //     if (x2d >= 0)
        //         x2d = clamp(-x2d, -.5, -2048);
        //     else
        //         x2d = clamp(x2d, 2048, .5);
        //     //x2d *= -1;
        //     //y2d *= -1;
        // }

        //return the new point on screen, along with the depth of the point (how far away it is from the camera in 3D space.)
        //we will use this depth amount to determine how drawn faces are layered on screen
        return new Vector3(parseInt(inGameResWidth * x2d), parseInt(inGameResHeight * y2d), pointRotatedInCameraSpace.z);
    }
}

//the rasterizer works with the camera to convert objects into a bitmap image that can actually
//be drawn on screen
class Rasterizer {
    camera;
    constructor(camera) {
        this.camera = camera;
    }

    //takes a triangle, and an option for backface culling or not (T/F)
    //and draws the tri to the screen
    drawTri(tri = new Tri(), backFaceCulling = true) {
        let color = tri.color;

        //get all of our onscreen points for this tri
        let aOnScreen = camera.perspectiveProjectWorldPoint(tri.a);
        let bOnScreen = camera.perspectiveProjectWorldPoint(tri.b);
        let cOnScreen = camera.perspectiveProjectWorldPoint(tri.c);

        //A on screen should always be on one specific side of the line made by B and C. 
        //if its on the other side, that means the tri is being flipped, meaning we are drawing
        //its backside. we dont want to draw the backside of a tri if back-face-culling is enabled, just return nothing!
        if (backFaceCulling && ((bOnScreen.x - cOnScreen.x) * (aOnScreen.y - cOnScreen.y) - (bOnScreen.y - cOnScreen.y) * (aOnScreen.x - cOnScreen.x)) > 0) {
            return;
        }

        let points = [aOnScreen, bOnScreen, cOnScreen];


        //determine the bounding box of the tri on screen
        let xmin = inGameResWidth; let xmax = 0; let ymin = inGameResHeight; let ymax = 0;
        for (let p of points) {
            if (p.x < xmin)
                xmin = p.x;
            if (p.x > xmax)
                xmax = p.x;
            if (p.y < ymin)
                ymin = p.y;
            if (p.y > ymax)
                ymax = p.y;
        }
        //clamp it to the screen size
        xmin = clamp(xmin, 0, inGameResWidth);
        xmax = clamp(xmax, 0, inGameResWidth);
        ymin = clamp(ymin, 0, inGameResHeight);
        ymax = clamp(ymax, 0, inGameResHeight);


        //loop thru each pixel in the bounding box of the triangle and determine if its inside the triangle\
        //and should therefore be drawn
        //let areaTotal = areaOfTriangle(aOnScreen.x, aOnScreen.y, bOnScreen.x, bOnScreen.y, cOnScreen.x, cOnScreen.y);
        for (let x = xmin; x <= xmax; x++) {
            for (let y = ymin; y <= ymax; y++) {
                //w1,w2,w3 are barycentric coords about this triangle
                //this code segment converts the current pixel on screen to a barycentric coord
                //for the triangle we are drawing on screen. this will let us interpolate
                //data between the 3 points of the triangle, such as the depth or color!
                let cyMinusAy = cOnScreen.y - aOnScreen.y;
                let cxMinusAx = cOnScreen.x - aOnScreen.x;
                let byMinusAy = bOnScreen.y - aOnScreen.y;
                let bxMinusAx = bOnScreen.x - aOnScreen.x;
                let yMinusAy = y - aOnScreen.y;
                let w2 = aOnScreen.x * cyMinusAy + yMinusAy * cxMinusAx - x * cyMinusAy;
                w2 = w2 / (byMinusAy * cxMinusAx - bxMinusAx * cyMinusAy);
                let w3 = aOnScreen.x * byMinusAy + yMinusAy * bxMinusAx - x * byMinusAy;
                w3 = w3 / (cyMinusAy * bxMinusAx - cxMinusAx * byMinusAy);
                let w1 = 1 - w2 - w3;

                //once we have the barycentric coords, we check to see if they are all positive,
                //meaning they all point to inside the triangle
                if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
                    let depth = (((aOnScreen.z - camera.nearZ) * w1) + ((bOnScreen.z - camera.nearZ) * w2) + ((cOnScreen.z - camera.nearZ) * w3)) / camera.farZ;
                    drawPixelOnScreenWithDepth(color, x, y, depth);
                }
            }
        }
        //debug, draw verts on screen
        // drawPixelOnScreenWithDepth(new Color(255, 0, 0), aOnScreen.x, aOnScreen.y);
        // drawPixelOnScreenWithDepth(new Color(0, 255, 0), bOnScreen.x, bOnScreen.y);
        // drawPixelOnScreenWithDepth(new Color(0, 100, 255), cOnScreen.x, cOnScreen.y);
    }

    //rasterize a line between points a and b
    drawLine(a, b) {

    }

    //loops through all of the tries in a model's mesh and draws them on screen!
    drawModel(model = new Model()) {
        for (let i = 0; i < model.getNumTris(); i++) {
            this.drawTri(model.getTransformedTri(i));
        }
    }
}

//a model is an object in the game that is visually represented by a mesh. it can be positioned, rotated, and scaled
class Model extends GameObject {
    scale;
    mesh;
    //stores and inits values
    constructor(xPos = 0, yPos = 0, zPos = 0, pitch = 0, yaw = 0, roll = 0, xScale = 1, yScale = 1, zScale = 1, mesh = new Mesh()) {
        super(xPos, yPos, zPos, pitch, yaw, roll);
        this.scale = new Vector3(xScale, yScale, zScale);
        this.mesh = mesh;
    }

    //gets the number of tris in this model's mesh
    getNumTris() {
        return this.mesh.tris.length;
    }

    //returns a tri from the mesh with position, rotation, and scale transformations applied to it
    getTransformedTri(index = 0) {
        //get the tri at this index
        let triPreTransform = this.mesh.tris[index];
        //get its points
        let pointsPreTransform = [triPreTransform.a, triPreTransform.b, triPreTransform.c];
        let pointsPostTransform = [];
        for (let p of pointsPreTransform) {
            //scale the point
            let newPoint = Vector3.transform(p, Matrix3.CreateScaleMatrix(this.scale.x, this.scale.y, this.scale.z));

            //then apply any rotations
            newPoint = Vector3.transform(newPoint, Matrix3.CreateRotationX(this.rot.x));
            newPoint = Vector3.transform(newPoint, Matrix3.CreateRotationY(this.rot.y));
            newPoint = Vector3.transform(newPoint, Matrix3.CreateRotationZ(this.rot.z));

            //then finally move it to where it is in the final 3d scene
            newPoint = Vector3.add(newPoint, this.pos);

            pointsPostTransform.push(newPoint);

        }
        //finally return this transformed tri
        return new Tri(pointsPostTransform[0], pointsPostTransform[1], pointsPostTransform[2], triPreTransform.color, triPreTransform.aUV, triPreTransform.bUV, triPreTransform.cUV);
    }
}

//a mesh stores tris that make up a 3d object
class Mesh {
    tris;
    //takes an array of tris and stores it
    constructor(tris = []) {
        this.tris = tris;
    }

    //splits up a quad into 2 tris and adds them to the mesh
    convertQuadToTrisAndAddThem(a = new Vector3(), b = new Vector3(), c = new Vector3(), d = new Vector3(), color = new Color(255, 255, 255), aUV = new Vector3(), bUV = new Vector3(), cUV = new Vector3(), dUV = new Vector3()) {
        let tri1 = new Tri(a, b, d, color, aUV, bUV, dUV);
        let tri2 = new Tri(b, c, d, color, bUV, cUV, dUV);
        this.tris.push(tri1);
        this.tris.push(tri2);
    }
}

//represents 3 points of data. could be a rotation, a coordinate in 3d space, 3 barycentric coords, whatever you want.
class Vector3 {
    x;
    y;
    z;
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    //gets the length of this vector
    magnitude() {
        return Math.sqrt(Vector3.dot(this, this));
    }

    //gets the non-squareroot length of this vector
    magnitudeSquared() {
        return Vector3.dot(this, this);
    }

    //gets a vector of the same direction but with length 1
    getNormal() {
        let mag = this.magnitude();
        return new Vector3(this.x / mag, this.y / mag, this.z / mag);
    }

    //makes this vector be of length 1
    normalize() {
        let mag = this.magnitude();
        this.x = this.x / mag;
        this.y = this.y / mag;
        this.z = this.z / mag;
    }

    //converts this vector3 into a 2D vector looking from a top-down view
    toVector2XZ() {
        return new Vector2(this.x, this.z);
    }

    //adds components of a to b and returns the vector
    static add(a, b) {
        return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    //subtracts comps like a - b and returns
    static subtract(a, b) {
        return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    //multiplies components by a scalar and returns
    static multiply(a, scalar) {
        return new Vector3(a.x * scalar, a.y * scalar, a.z * scalar);
    }

    //divides components by a scalar and returns
    static divide(a, scalar) {
        return new Vector3(a.x / scalar, a.y / scalar, a.z / scalar);
    }

    //returns the dot product of 2 vectors
    static dot(a, b) {
        return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
    }

    //returns the cross product of 2 vectors
    static cross(a, b) {
        let cx = a.y * b.z - a.z * b.y;
        let cy = a.z * b.x - a.x * b.z;
        let cz = a.x * b.y - a.y * b.x;
        return new Vector3(cx, cy, cz);
    }

    //transforms a vector3 v by matrix3 m
    static transform(v, m) {
        let x1 = (m.a1 * v.x) + (m.b1 * v.y) + (m.c1 * v.z);
        let y1 = (m.a2 * v.x) + (m.b2 * v.y) + (m.c2 * v.z);
        let z1 = (m.a3 * v.x) + (m.b3 * v.y) + (m.c3 * v.z);
        return new Vector3(x1, y1, z1);
    }

    //linearly interpolate between 2 vectors a and b by amount t
    static lerp(a, b, t) {
        return Vector3.add(a, Vector3.multiply(Vector3.subtract(b, a), t));
    }
}

//represents 2 points of data, such as a point in 2d space
class Vector2 {
    x;
    y;
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }


    //gets the length of this vector
    magnitude() {
        return Math.sqrt(Vector2.dot(this, this));
    }

    //gets the non-squareroot length of this vector
    magnitudeSquared() {
        return Vector2.dot(this, this);
    }

    //gets a vector of the same direction but with length 1
    getNormal() {
        let mag = this.magnitude();
        return new Vector2(this.x / mag, this.y / mag);
    }

    //makes this vector be of length 1
    normalize() {
        let mag = this.magnitude();
        this.x = this.x / mag;
        this.y = this.y / mag;
    }

    //gets the perpidicular vector to this one, going around clock wise
    perpCW() {
        return new Vector2(this.y, -1 * this.x);
    }

    //gets the perpidicular vector to this one, going around counter clock wise
    perpCCW() {
        return new Vector2(-1 * this.y, this.x);
    }

    //adds components of a to b and returns the vector
    static add(a, b) {
        return new Vector2(a.x + b.x, a.y + b.y);
    }

    //subtracts comps like a - b and returns
    static subtract(a, b) {
        return new Vector2(a.x - b.x, a.y - b.y);
    }

    //multiplies components by a scalar and returns
    static multiply(a, scalar) {
        return new Vector2(a.x * scalar, a.y * scalar);
    }

    //divides components by a scalar and returns
    static divide(a, scalar) {
        return new Vector2(a.x / scalar, a.y / scalar);
    }

    //returns the dot product of 2 vectors
    static dot(a, b) {
        return (a.x * b.x) + (a.y * b.y);
    }

    //returns the cross product of 2 vectors
    static cross(a, b) {
        return b.y * a.x - a.y * b.x;
    }

    //return the cross product of 3 vectors
    static cross3(a, b, c) {
        let y1 = a.y - b.y;
        let y2 = a.y - c.y;
        let x1 = a.x - b.x;
        let x2 = a.x - c.x;
        return y2 * x1 - y1 * x2;
    }

    //linearly interpolate between 2 vectors a and b by amount t
    static lerp(a, b, t) {
        return Vector2.add(a, Vector2.multiply(Vector2.subtract(b, a), t));
    }

    static dist(a, b) {
        return dist(a.x, a.y, b.x, b.y);
    }

    //get the barycentric coords of point p in triangle ABC
    static triBarycentricCoords(a, b, c, p) {
        let totalArea = areaOfTriangle(a, b, c);
        let w1 = areaOfTriangle(p, b, c) / totalArea;
        let w2 = areaOfTriangle(p, c, a) / totalArea;
        let w3 = areaOfTriangle(a, p, b) / totalArea;
        return new Vector3(w1, w2, w3);
    }

    //takes the w2 and w3 values of a barycentric coord in a tri and turns them into UV coords on a quadrilateral
    static bilinearCoords(uv) {
        let d = Vector2.multiply(new Vector2(0, 0), (1 - uv.x) * (1 - uv.y));
        let c = Vector2.multiply(new Vector2(1, 0), (uv.x) * (1 - uv.y));
        let b = Vector2.multiply(new Vector2(1, 1), (uv.x) * (uv.y));
        let a = Vector2.multiply(new Vector2(0, 1), (1 - uv.x) * (uv.y));
        return Vector2.add(Vector2.add(d, c), Vector2.add(a, b));
    }

    //takes bilinear coods UV, and interps between 4 values
    static bilinearInterp(uv, a, b, c, d) {
        return Vector2.lerp(Vector2.lerp(d, a, uv.y), Vector2.lerp(c, b, uv.y), uv.x);
    }
}

//represents a 3x3 matrix
class Matrix3 {
    //data points on matrix
    a1; b1; c1;
    a2; b2; c2;
    a3; b3; c3;

    //stores values
    constructor(a1 = 0, a2 = 0, a3 = 0, b1 = 0, b2 = 0, b3 = 0, c1 = 0, c2 = 0, c3 = 0) {
        this.a1 = a1;
        this.a2 = a2;
        this.a3 = a3;
        this.b1 = b1;
        this.b2 = b2;
        this.b3 = b3;
        this.c1 = c1;
        this.c2 = c2;
        this.c3 = c3;
    }

    //creates a rotation transform matrix around the X axis based on the radians inputted
    static CreateRotationX(radians) {
        return new Matrix3(1, 0, 0, 0, Math.cos(radians), Math.sin(radians), 0, -1 * Math.sin(radians), Math.cos(radians));
    }

    //creates a rotation transform matrix around the Y axis based on the radians inputted
    static CreateRotationY(radians) {
        return new Matrix3(Math.cos(radians), 0, -1 * Math.sin(radians), 0, 1, 0, Math.sin(radians), 0, Math.cos(radians));
    }

    //creates a rotation transform matrix around the Z axis based on the radians inputted
    static CreateRotationZ(radians) {
        return new Matrix3(Math.cos(radians), Math.sin(radians), 0, -1 * Math.sin(radians), Math.cos(radians), 0, 0, 0, 1);
    }

    //creates a 3x3 scale matrix based on the input
    static CreateScaleMatrix(scaleX, scaleY, scaleZ) {
        return new Matrix3(scaleX, 0, 0, 0, scaleY, 0, 0, 0, scaleZ);
    }
}

//represents a 3 sided face of a mesh (in 3D space)
class Tri {
    //vertices should be in CW order, starting at A on the top left
    a;
    b;
    c;
    color;
    aUV;
    bUV;
    cUV;

    //takes in verticles as Vector3s
    constructor(a = new Vector3(), b = new Vector3(), c = new Vector3(), color = new Color(255, 255, 255), aUV = new Vector3(), bUV = new Vector3(), cUV = new Vector3()) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.color = color;
    }

    //the direction this tri is facing
    normal() {
        return Vector3.cross(Vector3.subtract(this.c, this.a), Vector3.subtract(this.b, this.a)).getNormal();
    }

    //gets the center point of this tri
    centroid() {
        return Vector3.divide(Vector3.add(Vector3.add(this.a, this.b), this.c), 3);
    }

    //checks if this tri is facing a point in the world
    //returns true if so
    checkIfPointOnFrontSide(point) {
        let centroid = this.centroid();
        let normal = this.normal();
        let a1 = normal.x * -1 * centroid.x;
        let b1 = normal.y * -1 * centroid.y;
        let c1 = normal.z * -1 * centroid.z;
        let d1 = a1 + b1 + c1;
        let answer = a1 * point.x + b1 * point.y + c1 * point.z + d1;

        point = Vector3.add(centroid, normal);
        let answer2 = a1 * point.x + b1 * point.y + c1 * point.z + d1;
        return Math.sign(answer) == Math.sign(answer2);
    }

}