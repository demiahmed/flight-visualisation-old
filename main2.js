"use strict";

// Declare constants
const GLOBE_RADIUS = 100;
const TRAIL_LENGTH = 1200;
const TRAIL_POINTS = 20;

// Declare global variables
var scene, camera, renderer, controls, stats, position_data, flights, timekeeping; // trailMaterial;;

// Start main script once data has been loaded
$.get('location_data.json',function(data) 
{
    // Load needed data into the createFlights object which stores all information about plane movement and any THREE objects
    // Interpolate some of the points to prevent points moving through the globe
    position_data = interpolatePoints(data);
    
    // initalise our custom shader material which renders trails
    //initTrailMaterial();
    
    createFlights(data);
    initTimekeeping();

    // Perform preliminaries
    initialiseScene();
    createGlobe();

    // Finally, begin animation
    animate();

});

function interpolatePoints(position_data)
{
    // Loop over list of flight_IDs
    var flight_IDs = Object.keys(position_data);
    for(var i = 0; i < flight_IDs.length; i++)
    {
        var flight_ID = flight_IDs[i];

        // Get list of known timestamps
        var times = Object.keys(position_data[flight_ID]);
        
        // Loop over known timestamps
        for(var j = 0; j < times.length - 1; j++)
        {
            //var thisPoint = position_data[flight_ID][times[j]];
            var thisPoint = jQuery.extend(true, {}, position_data[flight_ID][times[j]]);
            thisPoint["time"] = parseInt(times[j]);
            var nextPoint = position_data[flight_ID][times[j + 1]];

            // Calculate distance between this and next known point
            var distance = distanceBetween(thisPoint.latitude, thisPoint.longitude, nextPoint.latitude, nextPoint.longitude);
            
            while(distance > 800000)
            {
                // Add points every 400km
                var fraction = 400000 / distance;
                
                // Get interpolated position
                var interpolatedPosition = intermediatePoint(thisPoint.latitude, thisPoint.longitude, nextPoint.latitude, nextPoint.longitude, fraction);

                // Get interpolated altitude
                var interpolatedAltitude = everpolate.linear(fraction, [0, 1], [thisPoint.altitude, nextPoint.altitude])[0];

                // Get interpolated time
                var interpolatedTime = everpolate.linear(fraction, [0, 1], [thisPoint.time, times[j + 1]])[0];

                thisPoint = {"latitude":interpolatedPosition[0], "longitude":interpolatedPosition[1], "altitude":interpolatedAltitude, "time":interpolatedTime};
                
                //Add this point to position_data
                position_data[flight_ID][thisPoint.time] = {"latitude": thisPoint.latitude, "longitude": thisPoint.longitude, "altitude": thisPoint.altitude};

                // update distance between this and next point
                distance = distanceBetween(thisPoint.latitude, thisPoint.longitude, nextPoint.latitude, nextPoint.longitude);
            }
        }
    }

    return(position_data);
}

// Fucntion to create the main data object
function createFlights()
{
    // Create flights object that will be populated
    flights = {};

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

        // create function to map time in seconds to point in space
        flights[flight_ID].location = function(time)
        {
            var t = everpolate.linear(time, this.curveLookupX, this.curveLookupY);
            return(this.curve.getPoint(t));
        } 

        // create function to map time in seconds to point on curve
        flights[flight_ID].t = function(time)
        {
            var t = everpolate.linear(time, this.curveLookupX, this.curveLookupY);
            return(t);
        } 
    });
}

//Function to create our custom shader material for the trails
function initTrailMaterial()
{
    trailMaterial = new THREE.ShaderMaterial({
        uniforms        : {currentPositionCoordinates: {value: new THREE.Vector3(0, 0 , 0)}},
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
    particle.frustumCulled = false;
    // store in flights object
    return(particle);
}

// Function to create an object to represent the trail
function initTrail(flight_ID, curve)
{
    var points = curve.getPoints(TRAIL_POINTS - 1);
    var geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create an attribute for each vertex which is the vertex's location in the trail from 1 to 0.
    var relativePosition = new Float32Array( numeric.linspace(0,0,TRAIL_POINTS) );
    geometry.addAttribute('relativePosition', new THREE.BufferAttribute(relativePosition, 1));
    geometry.attributes.relativePosition.dynamic = true;                            // Tell the GPU that this attribute will change often

    var material = new THREE.ShaderMaterial({
    uniforms        : {currentPositionCoordinates: {value: new Float32Array([0, 0 , 0])}},
    vertexShader    : document.getElementById( 'trail_vertex_shader' ).textContent,
    fragmentShader  : document.getElementById( 'trail_fragment_shader' ).textContent,
    transparent     : true
});


    // Create the final object which can be added to the scene
    var curveObject = new THREE.Line(geometry, material);
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
    // store in object
    timekeeping = {first: firstTime, last:lastTime, currentTime: firstTime};
    //timekeeping = {first: firstTime, last:lastTime, currentTime: 1553439935};
}

// Function to create catmaull rom curve from given flight ID
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
    flightTimes = flightTimes.sort();

    // u values are simply equually spaced out points where number of points = number of points used to create curve
    var y = numeric.linspace(0,1,flightTimes.length);

    // save to object
    return ({x : flightTimes, y : y});
}

// Function to map altitude in ft to desired radius
function altitudeToRadius(altitudeInFT)
{
    return(altitudeInFT/30000 + GLOBE_RADIUS);
}

function initialiseScene()
{
    // Set up scene and camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.001, 1000 );
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
            setTrailDraw(flight_ID);
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

// function to setup anything we need to draw the trail properly
function setTrailDraw(flight_ID)
{    
    // Set vertex attribute relativePosition to tell GPU where the vertex is positioned in the trail, where 1 is 
    // the start of the trail, and 0 the end, with values inbetween being linearly intepolated
    var trailStartVertexIndex = Math.ceil(flights[flight_ID].t(timekeeping.currentTime) * (TRAIL_POINTS - 1));
    var trailEndVertexIndex = Math.ceil(flights[flight_ID].t(timekeeping.currentTime - TRAIL_LENGTH) * (TRAIL_POINTS - 1));
    var numberOfVertexes = trailStartVertexIndex - trailEndVertexIndex + 1;
    var positions = numeric.linspace(0,1,numberOfVertexes);

    if(flight_ID)
    // Assign the positions to the attribute array
    flights[flight_ID].trail.geometry.attributes.relativePosition.array.fill(0);
    for(var i = 0; i < positions.length; i++)
    {
        flights[flight_ID].trail.geometry.attributes.relativePosition.array[trailEndVertexIndex + i] = positions[i];
    }
    flights[flight_ID].trail.geometry.attributes.relativePosition.needsUpdate = true;
    
    // Tell the GPU where the plane currently is
    flights[flight_ID].trail.material.uniforms.currentPositionCoordinates.value = flights[flight_ID].particle.geometry.attributes.position.array;
    
    
    flights[flight_ID].trail.geometry.setDrawRange(0, trailStartVertexIndex);
    
    
    /* // Find start and end t
    var start = flights[flight_ID].t(timekeeping.currentTime);
    var end = flights[flight_ID].t(timekeeping.currentTime - TRAIL_LENGTH);
    if (end < 0)
    {
        end = 0;
    }

    var startVertexIndex = Math.ceil(start * (TRAIL_POINTS - 1));
    var endVertexIndex = Math.floor(end * TRAIL_POINTS);

    // Set vertex attributes to tell GPU how vertexes correspond to position in trail
    flights[flight_ID].trail.geometry.attributes.relativePosition.array.fill(0);
    var relativePositions = numeric.linspace(1,0,startVertexIndex - endVertexIndex);
    for(var i = startVertexIndex; i > endVertexIndex; i--)
    {
        var relativePosition = relativePositions[startVertexIndex - i];
        flights[flight_ID].trail.geometry.attributes.relativePosition.array[i] = relativePosition;
    }
    flights[flight_ID].trail.geometry.attributes.relativePosition.needsUpdate = true;

    
    
    
    // Tell the GPU where the plane currently is
    flights[flight_ID].trail.material.uniforms.currentPositionCoordinates.value = flights[flight_ID].particle.geometry.attributes.position.array;
    
    
    

    //flights[flight_ID].trail.geometry.setDrawRange(endVertexIndex, startVertexIndex - endVertexIndex); */
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