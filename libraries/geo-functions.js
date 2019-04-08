// Some helper function for working with geogrpahic coordinates

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;
const EARTH_RADIUS = 6371e3;

// Convert [lat,lon] polar coordinates to [x,y,z] cartesian coordinates. Returns a float32 array
function polarToCartesian(lat, lon, radius) {
	var phi = ( 90 - lat ) * DEG2RAD
	var theta = ( lon + 180 ) * DEG2RAD

  	return(new THREE.Vector3( -radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), (radius * Math.sin(phi) * Math.sin(theta))));
}

// Helper function for the 
function deg2rad(deg)
{
	return deg * DEG2RAD;
}

function rad2deg(rad)
{
	return rad * RAD2DEG;
}

// The below is adapted from Chris Veness

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/* Latitude/longitude spherical geodesy tools                         (c) Chris Veness 2002-2019  */
/*                                                                                   MIT Licence  */
/* www.movable-type.co.uk/scripts/latlong.html                                                    */
/* www.movable-type.co.uk/scripts/geodesy-library.html#latlon-spherical                           */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

function intermediatePoint(lat1, lon1, lat2, lon2, fraction) 
{
	const φ1 = deg2rad(lat1), λ1 = deg2rad(lon1);
	const φ2 = deg2rad(lat2), λ2 = deg2rad(lon2);

	// distance between points
	const Δφ = φ2 - φ1;
	const Δλ = λ2 - λ1;
	const a = Math.sin(Δφ/2) * Math.sin(Δφ/2)
		+ Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
	const δ = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

	const A = Math.sin((1-fraction)*δ) / Math.sin(δ);
	const B = Math.sin(fraction*δ) / Math.sin(δ);

	const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
	const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
	const z = A * Math.sin(φ1) + B * Math.sin(φ2);

	const φ3 = Math.atan2(z, Math.sqrt(x*x + y*y));
	const λ3 = Math.atan2(y, x);

	const lat = rad2deg(φ3);
	const lon = rad2deg(λ3);

	return ([lat, lon]);
}

function distanceBetween(lat1, lon1, lat2, lon2) 
{
	const φ1 = deg2rad(lat1), λ1 = deg2rad(lon1);
	const φ2 = deg2rad(lat2), λ2 = deg2rad(lon2);

	// a = sin²(Δφ/2) + cos(φ1)⋅cos(φ2)⋅sin²(Δλ/2)
	// δ = 2·atan2(√(a), √(1−a))
	// see mathforum.org/library/drmath/view/51879.html for derivation

	const R = EARTH_RADIUS;

	const Δφ = φ2 - φ1;
	const Δλ = λ2 - λ1;

	const a = Math.sin(Δφ/2)*Math.sin(Δφ/2) + Math.cos(φ1)*Math.cos(φ2) * Math.sin(Δλ/2)*Math.sin(Δλ/2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	const d = R * c;

	return d;
}
