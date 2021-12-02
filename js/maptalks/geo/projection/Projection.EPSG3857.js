import { wrap, sign } from '../../core/util/index.js';
import Coordinate from '../Coordinate.js';

const delta = 1E-7;

export default class Projection {
    /**
     * "EPSG:3857", Code of the projection
     * @type {String}
     * @constant
     */
    constructor(){
        this.code = 'EPSG:3857';
        this.rad = Math.PI / 180;
        this.metersPerDegree = 6378137 * Math.PI / 180;
        this.maxLatitude = 85.0511287798;
    }

    project(lnglat, out) {
        const rad = this.rad,
            metersPerDegree = this.metersPerDegree,
            max = this.maxLatitude;
        const lng = lnglat.x,
            lat = Math.max(Math.min(max, lnglat.y), -max);
        let c;
        if (lat === 0) {
            c = 0;
        } else {
            c = Math.log(Math.tan((90 + lat) * rad / 2)) / rad;
        }
        const x = lng * metersPerDegree;
        const y = c * metersPerDegree;
        if (out) {
            out.x = x;
            out.y = y;
            return out;
        }
        return new Coordinate(x, y);
    }
    

    unproject (pLnglat, out) {
        const rad = this.rad;
        const metersPerDegree = this.metersPerDegree;
        let x = pLnglat.x / metersPerDegree;
        const y = pLnglat.y;
        let c;
        if (y === 0) {
            c = 0;
        } else {
            c = y / metersPerDegree;
            c = (2 * Math.atan(Math.exp(c * rad)) - Math.PI / 2) / rad;
        }
        if (Math.abs(Math.abs(x) - 180) < delta) {
            x = sign(x) * 180;
        }
        if (Math.abs(Math.abs(c) - this.maxLatitude) < delta) {
            c = sign(c) * this.maxLatitude;
        }
        const rx = wrap(x, -180, 180);
        const ry = wrap(c, -this.maxLatitude, this.maxLatitude);
        if (out) {
            out.x = rx;
            out.y = ry;
            return out;
        }
        return new Coordinate(rx, ry);
    }

    measureLength (c1, c2) {
        if (!Array.isArray(c1)) {
            return this.measureLenBetween(c1, c2);
        }
        let len = 0;
        for (let i = 0, l = c1.length; i < l - 1; i++) {
            len += this.measureLenBetween(c1[i], c1[i + 1]);
        }
        return len;
    }

    /**
     * Measure the length between 2 coordinates.
     * @param  {Coordinate} c1
     * @param  {Coordinate} c2
     * @return {Number}
     */
    measureLenBetween (c1, c2) {
        if (!c1 || !c2) {
            return 0;
        }
        try {
            return Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2));
        } catch (err) {
            return 0;
        }
    }
    /**
     * Measure the area closed by the given coordinates.
     * @param  {Coordinate[]} coordinates
     * @return {number}
     */
    measureArea (coordinates) {
        if (!Array.isArray(coordinates)) {
            return 0;
        }
        let area = 0;
        for (let i = 0, len = coordinates.length; i < len; i++) {
            const c1 = coordinates[i];
            let c2 = null;
            if (i === len - 1) {
                c2 = coordinates[0];
            } else {
                c2 = coordinates[i + 1];
            }
            area += c1.x * c2.y - c1.y * c2.x;
        }
        return Math.abs(area / 2);
    }

    locate (c, xDist, yDist) {
        c = new Coordinate(c.x, c.y);
        return this._locate(c, xDist, yDist);
    }

    /**
     * Locate a coordinate from the given source coordinate with a x-axis distance and a y-axis distance.
     * @param  {Coordinate} c     - source coordinate
     * @param  {Number} xDist     - x-axis distance
     * @param  {Number} yDist     - y-axis distance
     * @return {Coordinate}
     */
    _locate(c, xDist, yDist) {
        if (!c) {
            return null;
        }
        if (!xDist) {
            xDist = 0;
        }
        if (!yDist) {
            yDist = 0;
        }
        if (!xDist && !yDist) {
            return c;
        }
        c.x = c.x + xDist;
        c.y = c.y + yDist;
        return c;
    }

    rotate(c, pivot, angle) {
        c = new Coordinate(c.x, c.y);
        return this._rotate(c, pivot, angle);
    }

    /**
     * Rotate a coordinate of given angle around pivot
     * @param {Coordinate} c  - source coordinate
     * @param {Coordinate} pivot - pivot
     * @param {Number} angle - angle in degree
     * @return {Coordinate}
     */
    _rotate () {
        const tmp = new Point(0, 0);
        return function (c, pivot, angle) {
            tmp.x = c.x - pivot.x;
            tmp.y = c.y - pivot.y;
            tmp._rotate(angle * Math.PI / 180);
            c.x = pivot.x + tmp.x;
            c.y = pivot.y + tmp.y;
            return c;
        };
    }
}