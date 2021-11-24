import * as THREE from '/js/three/build/three.module.js';
import {proj4$1} from '/js/util/proj4-src.js';

export function cvt(lon, lat){
    var p = proj4$1(proj4$1.defs('EPSG:4326'), proj4$1.defs('EPSG:3857')).forward([lon, lat]);
    
    return p;
}

export function cvt3(coordinate, z) {
    if (z === void 0) { z = 0; }
    var p = project(coordinate);
    var p2 = prjToPoint(p);
    return new THREE.Vector3(p2.x, p2.y, z);
}

function project(coord){
    //var delta = 1E-7;
    var rad = Math.PI / 180;
    var metersPerDegree = 6378137 * Math.PI / 180;
    var maxLatitude = 85.0511287798;
    var lon = coord[0];
    var lat = Math.max(Math.min(maxLatitude, coord[1]), -maxLatitude);
    var c;
    if(lat === 0){
        c = 0;
    }else{
        c = Math.log(Math.tan((90 + lat) * rad / 2)) / rad;
    }

    var x = lon * metersPerDegree;
    var y = c * metersPerDegree;

    return {x, y};
}

function prjToPoint(coord){
    var scale = 152.8740565703525;
    var matrix = [1,-1,0,0];
    var x = matrix[0] * (coord.x - matrix[2]) / scale;
    var y = matrix[1] * (coord.y - matrix[3]) / scale;
    return {x, y};
}
 
