"use strict";

// Declare constants
const GLOBE_RADIUS = 100;
const TRAIL_LENGTH = 1200;    //Trail length in seconds
const TRAIL_POINTS = 20;

// Declare global variables
var scene, camera, renderer, controls, stats, position_data, flights, timekeeping, trailMaterial;

// Start main script once data has been loaded
$.get('location_data.json',function(data) 
{
    // Load needed data into the createFlights object which stores all information about plane movement and any THREE objects
    position_data = data;
    createFlights(data);
    initTimekeeping();

    // Perform preliminaries
    initialiseScene();
    createGlobe();

    // Finally, begin animation
    animate();

});

// Fucntion to create the main data object
function createFlights()
{
    // Create flights object that will be populated
    flights = {};

    // initalise our custom shader material
    initTrailMaterial();

    // Loop over each flight
    Object.keys(position_data).forEach(function(flight_ID)
    {
        // Create object which contains lifetime of flight. I.e. start and stop times for displaying it in scene    
        var lifetimes = getLifetimes(flight_ID);

        // create point
        var particle = createPoints(flight_ID);

        // Create catmul rom curve from known positions
        var curve = getCurve(flight_ID);

        //Create x and y lookups for curve
        var curveLookups = createCurveLookups(flight_ID);

        // Create line that will represent the trail behind each plane
        var trail = initTrail(flight_ID, curve);

        // store data in dictionary
        flights[flight_ID] = {lifetime : lifetimes, particle : particle, curve : curve, curveLookupX:curveLookups.x, curveLookupY: curveLookups.y, trail: trail};

        // create function to map time to point on curve
        flights[flight_ID].location = function(time)
        {
            var u = everpolate.linear(time, this.curveLookupX, this.curveLookupY);
            return(this.curve.getPoint(u));
        } 
    });
}

//Function to create our custom shader material for the trails
function initTrailMaterial()
{
    trailMaterial = new THREE.ShaderMaterial({
        uniforms        : {numberOfTrailPoints: {value: TRAIL_POINTS}},
        vertexShader    : document.getElementById( 'trail_vertex_shader' ).textContent,
        fragmentShader  : document.getElementById( 'trail_fragment_shader' ).textContent,
        transparent     : true
    });
}

// Function to create the points (planes) that will be displayed
function createPoints(flight_ID)
{
    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute( 'position', new THREE.Float32BufferAttribute([0, 0, 0], 3)); // just put points at origin for now

    var textureLoader = new THREE.TextureLoader();
    var sprite = textureLoader.load("textures/particle.png");
    var material = new THREE.PointsMaterial( { size: 0.5, map: sprite, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true} );
    var particle = new THREE.Points(geometry, material);

    // store in flights object
    return(particle);
}

// Function to create an object to represent the trail
function initTrail(flight_ID, curve)
{
    var points = curve.getPoints(TRAIL_POINTS - 1);
    var geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create an attribute for each vertex which is the point's relative position with repect to the total
    //length of the trail and add as vertex attribute
    var positionInTrail = new Float32Array( numeric.linspace(1,0,TRAIL_POINTS) );
    geometry.addAttribute('positionInTrail', new THREE.BufferAttribute(positionInTrail, 1));

    // Tell the GPU that these verticies will be updated often
    geometry.attributes.position.dynamic = true;

    // Create the final object which can be added to the scene
    var curveObject = new THREE.Line(geometry, trailMaterial);
    return(curveObject);
}

// Init object to store first, last, and current time
function initTimekeeping()
{
    var firstTime = Infinity;
    var flight = "gfdl"
    var lastTime = 0;
    Object.keys(flights).forEach(function(flight_ID)
    {
        if (flights[flight_ID].lifetime.start < firstTime)
        {
            firstTime = flights[flight_ID].lifetime.start
            flight = flight_ID;
        }

        if (flights[flight_ID].lifetime.stop > lastTime)
        {
            lastTime = flights[flight_ID].lifetime.stop
        }
    });
    console.log("First flight " + flight);
    // store in object
    timekeeping = {first: firstTime, last:lastTime, currentTime: firstTime};
    //timekeeping = {first: firstTime, last:lastTime, currentTime: 1553439935};
}

// Fucntion to create catmaull rom curve from given flight ID
function getCurve(flight_ID)
{
    // Create ordered array of known position times of the flight
    var times = Object.keys(position_data[flight_ID]);
    times = times.sort();

    // Loop over each time of the flight
    var curvePoints = [];
    times.forEach(function(time) 
    {
        // We need to supply an array of Vector3 to the catmull rom constructor. 
        // The polarToCartestian function returns a vector3 given lat, long, alt
        curvePoints.push(polarToCartesian(position_data[flight_ID][time].latitude,
                                            position_data[flight_ID][time].longitude,
                                            altitudeToRadius(position_data[flight_ID][time].altitude)));

    });

    // Use list of curve points to create catmul rom curve and return
    var curve = new THREE.CatmullRomCurve3(curvePoints);
    return(curve);
}

// Function to create a dict of lifetime start and stop times from a given flight ID
function getLifetimes(flight_ID)
{
    var flightTimes = Object.keys(position_data[flight_ID]).map(Number);
    var lifetimes = {start : Math.min.apply(null, flightTimes), stop : Math.max.apply(null, flightTimes)};
    
    return(lifetimes);
}

// fucntion to create t -> u map for moving along curves
function createCurveLookups(flight_ID)
{
    // For each flight (i.e. unique ID), create a lookup array which contains x and y values for point on curve
    // Loop over each flight
    
    // Use position times as our t variabale
    var flightTimes = Object.keys(position_data[flight_ID]).map(Number);

    // u values are simply equually spaced out points where number of points = number of points used to create curve
    var y = numeric.linspace(0,1,flightTimes.length);

    // save to object
    return ({x : flightTimes, y : y});
}

// Function to map altitude in ft to desired radius
function altitudeToRadius(altitudeInFT)
{
    return(altitudeInFT/10000 + GLOBE_RADIUS);
}

function initialiseScene()
{
    // Set up scene and camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.01, 1000 );
    camera.position.set(GLOBE_RADIUS, GLOBE_RADIUS, GLOBE_RADIUS);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Add orbit controls
    controls = new THREE.OrbitControls( camera );

    // Set up WebGL renderer
    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(window.devicePixelRatio); // HiDPI/retina rendering
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );
    

    // Set up handling of resizing browser window
    window.addEventListener('resize', handleResize, false);

    // The X axis is red. The Y axis is green. The Z axis is blue.
    var axesHelper = new THREE.AxesHelper( 150 );
    scene.add( axesHelper );

    // Add FPS stats
    stats = new Stats();
    stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild( stats.dom );
}

// function to create globe
function createGlobe()
{
    var geometry = new THREE.SphereBufferGeometry( GLOBE_RADIUS, 64, 64 );
    
    var texture = new THREE.TextureLoader().load( 'textures/earth.jpg' );
    var material = new THREE.MeshBasicMaterial( { map: texture } );

    
    var sphere = new THREE.Mesh( geometry, material );
    scene.add(sphere);
}

// Handle resizing of the browser window.
function handleResize()
{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animate points, adding and removing from scene when necessary
function animatePoints()
{
    // Loop through all flights
    Object.keys(flights).forEach(function(flight_ID)
    {
        // check if it should even be displayed
        if (timekeeping.currentTime >= flights[flight_ID].lifetime.start && timekeeping.currentTime <= flights[flight_ID].lifetime.stop)
        {
            // Point should be displayed. So, move it into correct position and add to scene
            var position = flights[flight_ID].particle.geometry.attributes.position.array;
            
            var location = flights[flight_ID].location(timekeeping.currentTime);

            // change x, y, z
            position[0] = location.x;
            position[1] = location.y;
            position[2] = location.z;
            flights[flight_ID].particle.geometry.attributes.position.needsUpdate = true;

            // add to scene if necessary
            if (! scene.getObjectById(flights[flight_ID].particle.id))
            {
                scene.add(flights[flight_ID].particle);
            }
        }
        else
        {
            // Object should not be displayed. Remove it from scene if necessary
            if (scene.getObjectById(flights[flight_ID].particle.id))
            {
                scene.remove(flights[flight_ID].particle);
            }
        }
    });
}

function showTrails()
{
    
    // Loop through all flights, adding and removing trails as necessary
    Object.keys(flights).forEach(function(flight_ID)
    {
        // check if it should even be displayed
        if (timekeeping.currentTime >= flights[flight_ID].lifetime.start && timekeeping.currentTime <= flights[flight_ID].lifetime.stop + TRAIL_LENGTH)
        {
            // Trail should be displayed. 
            updateTrailVertecies(flight_ID);

            // Add to scene if necessary
            if (! scene.getObjectById(flights[flight_ID].trail.id))
            {
                scene.add(flights[flight_ID].trail);
            }
        }
        else
        {
            // Trail should not be displayed Remove it from scene if necessary
            if (scene.getObjectById(flights[flight_ID].trail.id))
            {
                scene.remove(flights[flight_ID].trail);
            }
        }
    });
}

// Function to update the vertex positions of our trail line for a given flight
function updateTrailVertecies(flight_ID)
{
    // Loop through each point that we want in our trail
    for(var i = 0; i < TRAIL_POINTS; i++)
    {
        // Calculate the location of this point
        var t = timekeeping.currentTime - ((i/(TRAIL_POINTS - 1)) * TRAIL_LENGTH);

        // Clamp values between takeoff and landing times
        if (t < flights[flight_ID].lifetime.start)
        {
            t = flights[flight_ID].lifetime.start;
        }
        else if (t > flights[flight_ID].lifetime.stop)
        {
            t = flights[flight_ID].lifetime.stop;
        }

        var location = flights[flight_ID].location(t);

        // Update the buffer geometry vertex positions with this point 
        flights[flight_ID].trail.geometry.attributes.position.array[3*i] = location.x;
        flights[flight_ID].trail.geometry.attributes.position.array[3*i + 1] = location.y;
        flights[flight_ID].trail.geometry.attributes.position.array[3*i + 2] = location.z;    
    }
    // Tell geometry it needs to update on next render
    flights[flight_ID].trail.geometry.attributes.position.needsUpdate = true;
}

function animate()
{
    stats.begin();
    
    requestAnimationFrame(animate);
    //controls.update();
    
    animatePoints();
    showTrails();
    timekeeping.currentTime = timekeeping.currentTime + 15;

    renderer.render(scene, camera);
    stats.end();
}