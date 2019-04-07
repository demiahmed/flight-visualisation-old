var RAD2DEG = 180 / Math.PI
var DEG2RAD = Math.PI / 180

/**
 * Convert [lat,lon] polar coordinates to [x,y,z] cartesian coordinates. Returnas a float32 array
 * @param {Number} lon
 * @param {Number} lat
 * @param {Number} radius
 * @return {Vector3}
 */
function polarToCartesian(lat, lon, radius) {
	var phi = ( 90 - lat ) * DEG2RAD
	var theta = ( lon + 180 ) * DEG2RAD

  	return(new THREE.Vector3( -radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), (radius * Math.sin(phi) * Math.sin(theta))));
}

/**
 * Convert [x,y,z] cartesian coordinates to polar [lat,lon]. TODO: Buggy fix!!!
 * @param {Vector3} coord
 * @return {Array<Number>}
 */
function cartesianToPolar( coord, radius ) {

  var lon = Math.atan2( coord.x, -coord.z ) * RAD2DEG
  var length = Math.sqrt( coord.x * coord.x + coord.z * coord.z )
  var lat = Math.atan2( coord.y, length ) * RAD2DEG

  return [ lon, lat ]

}
