import {
    now,
    extend,
    isNil,
    isString,
    isFunction,
    sign,
    UID,
} from '../core/util';
import Class from '../core/Class';
import Point from '../geo/Point';
import Size from '../geo/Size';
import PointExtent from '../geo/PointExtent';
import Extent from '../geo/Extent';
import Coordinate from '../geo/Coordinate';
import Layer from '../layer/Layer';
import SpatialReference from './spatial-reference/SpatialReference';

const TEMP_COORD = new Coordinate(0, 0);

const options = {
    'maxVisualPitch': 70,
    'maxPitch': 80,
    'centerCross': false,

    'zoomInCenter': false,
    'zoomOrigin': null,

    'zoomable': true,
    'enableInfoWindow': true,

    'maxZoom': null,
    'minZoom': null,
    'maxExtent': null,
    'fixCenterOnResize': true,
};

/**
 * The central class of the library, to create a map on a container.
 * @category map
 * @extends Class
 *
 * @mixes Eventable
 * @mixes Handlerable
 * @mixes ui.Menuable
 * @mixes Renderable
 *
 * @example
 * var map = new maptalks.Map("map",{
 *      center:     [180,0],
 *      zoom:  4,
 *      baseLayer : new maptalks.TileLayer("base",{
 *          urlTemplate:'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
 *          subdomains:['a','b','c']
 *      }),
 *      layers : [
 *          new maptalks.VectorLayer('v', [new maptalks.Marker([180, 0])])
 *      ]
 * });
 */
class Map extends Class {

    /**
     * @param {(string|HTMLElement|object)} container - The container to create the map on, can be:<br>
     *                                          1. A HTMLElement container.<br/>
     *                                          2. ID of a HTMLElement container.<br/>
     *                                          3. Any canvas compatible container
     * @param {Object} options - construct options
     * @param {(Number[]|Coordinate)} options.center - initial center of the map.
     * @param {Number} options.zoom - initial zoom of the map.
     * @param {Object} [options.spatialReference=null] - map's spatial reference, default is using projection EPSG:3857 with resolutions used by google map/osm.
     * @param {Layer} [options.baseLayer=null] - base layer that will be set to map initially.
     * @param {Layer[]} [options.layers=null] - layers that will be added to map initially.
     * @param {*} options.* - any other option defined in [Map.options]{@link Map#options}      [description]
     */
    constructor( options) {
        if (!options) {
            throw new Error('Invalid options when creating map.');
        }
        if (!options['center']) {
            throw new Error('Invalid center when creating map.');
        }
        // prepare options
        const opts = extend({}, options);
        const zoom = opts['zoom'];
        delete opts['zoom'];
        const center = new Coordinate(opts['center']);
        delete opts['center'];

        const baseLayer = opts['baseLayer'];
        delete opts['baseLayer'];
        const layers = opts['layers'];
        delete opts['layers'];
        super(opts);

        /**
         * @property {String}  - Version of library
         * @constant
         * @static
         */
        this.VERSION = Map.VERSION;

        Object.defineProperty(this, 'id', {
            value: UID(),
            writable: false
        });

        this._loaded = false;

        this._panels = {};

        //Layers
        this._baseLayer = null;
        this._layers = [];

        this._zoomLevel = zoom;
        this._center = center;

        this.setSpatialReference(opts['spatialReference'] || opts['view']);

        this.setMaxExtent(opts['maxExtent']);


        this._mapViewPoint = new Point(0, 0);

        //this._initRenderer();
        this._updateMapSize({width:0, height:0});

        if (baseLayer) {
            this.setBaseLayer(baseLayer);
        }
        if (layers) {
            this.addLayer(layers);
        }

        this._Load();
    }

    /**
     * Add hooks for additional codes when map's loading complete, useful for plugin developping.
     * Note that it can only be called before the map is created.
     * @param {Function} fn
     * @returns {Map}
     * @protected
     */
    static addOnLoadHook(fn) { // (Function) || (String, args...)
        const args = Array.prototype.slice.call(arguments, 1);
        const onload = typeof fn === 'function' ? fn : function () {
            this[fn].apply(this, args);
        };
        this.prototype._onLoadHooks = this.prototype._onLoadHooks || [];
        this.prototype._onLoadHooks.push(onload);
        return this;
    }

    /**
     * Whether the map is loaded or not.
     * @return {Boolean}
     */
    isLoaded() {
        return !!this._loaded;
    }

    /**
     * Get map's container
     * @returns {HTMLElement}
     */
    getContainer() {
        return this._containerDOM;
    }

    /**
     * Get the spatial reference of the Map.
     * @return {SpatialReference} map's spatial reference
     */
    getSpatialReference() {
        return this._spatialReference;
    }

    /**
     * Change the spatial reference of the map. <br>
     * A SpatialReference is a series of settings to decide the map presentation:<br>
     * 1. the projection.<br>
     * 2. zoom levels and resolutions. <br>
     * 3. full extent.<br>
     * There are some [predefined spatial references]{@link http://www.foo.com}, and surely you can [define a custom one.]{@link http://www.foo.com}.<br>
     * SpatialReference can also be updated by map.config('spatialReference', spatialReference);
     * @param {SpatialReference} spatialReference - spatial reference
     * @returns {Map} this
     * @fires Map#spatialreferencechange
     * @example
     *  map.setSpatialReference({
            projection:'EPSG:4326',
            resolutions: (function() {
                const resolutions = [];
                for (let i=0; i < 19; i++) {
                    resolutions[i] = 180/(Math.pow(2, i)*128);
                }
                return resolutions;
            })()
     *  });
       @example
     *  map.config('spatialReference', {
            projection:'EPSG:4326',
            resolutions: (function() {
                const resolutions = [];
                for (let i=0; i < 19; i++) {
                    resolutions[i] = 180/(Math.pow(2, i)*128);
                }
                return resolutions;
            })()
        });
     */
    setSpatialReference(ref) {
        const oldRef = this.options['spatialReference'];
        if (this._loaded && SpatialReference.equals(oldRef, ref)) {
            return this;
        }
        this._updateSpatialReference(ref, oldRef);
        return this;
    }

    _updateSpatialReference(ref, oldRef) {
        if (isString(ref)) {
            ref = SpatialReference.getPreset(ref);
        }
        ref = extend({}, ref);
        this._center = this.getCenter();
        this.options['spatialReference'] = ref;
        this._spatialReference = new SpatialReference(ref);
        if (this.options['spatialReference'] && isFunction(this.options['spatialReference']['projection'])) {
            const projection = this._spatialReference.getProjection();
            //save projection code for map profiling (toJSON/fromJSON)
            this.options['spatialReference']['projection'] = projection['code'];
        }
        this._resetMapStatus();
        /**
         * spatialreferencechange event, fired when map's spatial reference is updated.
         *
         * @event Map#spatialreferencechange
         * @type {Object}
         * @property {String} type - spatialreferencechange
         * @property {Map} target - map
         * @property {Map} old - the old spatial reference
         * @property {Map} new - the new spatial reference changed to
         */
        this._fireEvent('spatialreferencechange', {
            'old': oldRef,
            'new': extend({}, this.options['spatialReference'])
        });
        return this;
    }

    // _syncWorld() {
    //     const projection = this.getProjection();
    //     if (!projection) {
    //         return false;
    //     }
    //     const pcenter = this._getPrjCenter();
    //     if (projection.isOutSphere(pcenter)) {
    //         const wrapped = projection.wrapCoord(pcenter);
    //         this._setPrjCenter(wrapped);
    //         this._fireEvent('syncworld', { 'old' : pcenter.toArray(), 'new' : wrapped.toArray() });
    //         return true;
    //     }
    //     return false;
    // }

    /**
     * Callback when any option is updated
     * @private
     * @param  {Object} conf - options to update
     * @return {Map}   this
     */
    onConfig(conf) {
        const ref = conf['spatialReference'] || conf['view'];
        if (!isNil(ref)) {
            this._updateSpatialReference(ref, null);
        }
        return this;
    }

    /**
     * Get the projection of the map. <br>
     * Projection is an algorithm for map projection, e.g. well-known [Mercator Projection]{@link https://en.wikipedia.org/wiki/Mercator_projection} <br>
     * A projection must have 2 methods: <br>
     * 1. project(coordinate) - project the input coordinate <br>
     * 2. unproject(coordinate) - unproject the input coordinate <br>
     * Projection also contains measuring method usually extended from a measurer: <br>
     * 1. measureLength(coord1, coord2) - compute length between 2 coordinates.  <br>
     * 2. measureArea(coords[]) - compute area of the input coordinates. <br>
     * 3. locate(coord, distx, disty) - compute the coordinate from the coord with xdist on axis x and ydist on axis y.
     * @return {Object}
     */
    getProjection() {
        if (!this._spatialReference) {
            return null;
        }
        return this._spatialReference.getProjection();
    }

    /**
     * Get map's full extent, which is defined in map's spatial reference. <br>
     * eg: {'left': -180, 'right' : 180, 'top' : 90, 'bottom' : -90}
     * @return {Extent}
     */
    getFullExtent() {
        if (!this._spatialReference) {
            return null;
        }
        return this._spatialReference.getFullExtent();
    }

    /**
     * Set map's cursor style, cursor style is same with CSS.
     * @param {String} cursor - cursor style
     * @returns {Map} this
     * @example
     * map.setCursor('url(cursor.png) 4 12, auto');
     */
    setCursor(cursor) {
        delete this._cursor;
        this._trySetCursor(cursor);
        this._cursor = cursor;
        return this;
    }

    /**
     * Reset map's cursor style.
     * @return {Map} this
     * @example
     * map.resetCursor();
     */
    resetCursor() {
        return this.setCursor(null);
    }

    /**
     * Get center of the map.
     * @return {Coordinate}
     */
    getCenter() {
        if (!this._loaded || !this._prjCenter) {
            return this._center;
        }
        const projection = this.getProjection();
        return projection.unproject(this._prjCenter);
    }

    /**
     * Set a new center to the map.
     * @param {Coordinate} center
     * @return {Map} this
     */
    setCenter(center) {
        if (!center) {
            return this;
        }
        center = new Coordinate(center);
        const projection = this.getProjection();
        const pcenter = projection.project(center);
        if (!this._verifyExtent(pcenter)) {
            return this;
        }
        if (!this._loaded) {
            this._center = center;
            return this;
        }
        this.onMoveStart();
        this._setPrjCenter(pcenter);
        this.onMoveEnd(this._parseEventFromCoord(this.getCenter()));
        return this;
    }

    /**
     * Get map's size (width and height) in pixel.
     * @return {Size}
     */
    getSize() {
        if (isNil(this.width) || isNil(this.height)) {
            return this._getContainerDomSize();
        }
        return new Size(this.width, this.height);
    }

    /**
     * Get container extent of the map
     * @return {PointExtent}
     */
    getContainerExtent() {
        let visualHeight = this.height;
        const pitch = this.getPitch(),
            maxVisualPitch = this.options['maxVisualPitch'];
        if (maxVisualPitch && pitch > maxVisualPitch) {
            visualHeight = this._getVisualHeight(maxVisualPitch);
        }
        return new PointExtent(0, this.height - visualHeight, this.width, this.height);
    }

    _getVisualHeight(visualPitch) {
        // const pitch = this.getPitch();
        // const visualDistance = this.height / 2 * Math.tan(visualPitch * Math.PI / 180);
        // return this.height / 2 + visualDistance *  Math.tan((90 - pitch) * Math.PI / 180);
        visualPitch = visualPitch || 1E-2;

        const pitch = (90 - this.getPitch()) * Math.PI / 180;
        const fov = this.getFov() * Math.PI / 180;
        visualPitch *= Math.PI / 180;

        const cameraToCenter = this.cameraCenterDistance / this.getGLScale();
        const tanB = Math.tan(fov / 2);
        const tanP = Math.tan(visualPitch);

        const visualDistance = (cameraToCenter * tanB) / (1 / tanP - tanB) / Math.sin(visualPitch);
        const x = cameraToCenter * (Math.sin(pitch) * visualDistance / (cameraToCenter + Math.cos(pitch) * visualDistance));

        return this.height / 2 + x;
    }

    /**
     * Get the geographical extent of map's current view extent.
     *
     * @return {Extent}
     */
    getExtent() {
        return this._pointToExtent(this._get2DExtent());
    }

    /**
     * Get the projected geographical extent of map's current view extent.
     *
     * @return {Extent}
     */
    getProjExtent() {
        const extent2D = this._get2DExtent();
        return new Extent(
            this._pointToPrj(extent2D.getMin()),
            this._pointToPrj(extent2D.getMax())
        );
    }

    /**
     * Alias for getProjExtent
     *
     * @return {Extent}
     */
    getPrjExtent() {
        return this.getProjExtent();
    }

    /**
     * Get the max extent that the map is restricted to.
     * @return {Extent}
     */
    getMaxExtent() {
        if (!this.options['maxExtent']) {
            return null;
        }
        return new Extent(this.options['maxExtent'], this.getProjection());
    }

    /**
     * Sets the max extent that the map is restricted to.
     * @param {Extent}
     * @return {Map} this
     * @example
     * map.setMaxExtent(map.getExtent());
     */
    setMaxExtent(extent) {
        if (extent) {
            const maxExt = new Extent(extent, this.getProjection());
            this.options['maxExtent'] = maxExt;
            if (!this._verifyExtent(this._getPrjCenter())) {
                this._panTo(this._prjMaxExtent().getCenter());
            }
            const projection = this.getProjection();
            this._prjMaxExtent = maxExt.convertTo(c => projection.project(c));
        } else {
            delete this.options['maxExtent'];
            delete this._prjMaxExtent;
        }
        return this;
    }

    /**
     * Get map's current zoom.
     * @return {Number}
     */
    getZoom() {
        return this._zoomLevel;
    }

    /**
     * Caculate the target zoom if scaling from "fromZoom" by "scale"
     * @param  {Number} scale
     * @param  {Number} fromZoom
     * @param  {Boolean} isFraction - can return fractional zoom
     * @return {Number} zoom fit for scale starting from fromZoom
     */
    getZoomForScale(scale, fromZoom, isFraction) {
        const zoom = this.getZoom();
        if (isNil(fromZoom)) {
            fromZoom = zoom;
        }
        if (scale === 1 && fromZoom === zoom) {
            return zoom;
        }
        const res = this._getResolution(fromZoom),
            targetRes = res / scale;
        const scaleZoom = this.getZoomFromRes(targetRes);
        if (isFraction) {
            return scaleZoom;
        } else {
            const delta = 1E-6; //avoid precision
            return this.getSpatialReference().getZoomDirection() < 0 ?
                Math.ceil(scaleZoom - delta) : Math.floor(scaleZoom + delta);
        }
    }

    getZoomFromRes(res) {
        const resolutions = this._getResolutions(),
            minRes = this._getResolution(this.getMinZoom()),
            maxRes = this._getResolution(this.getMaxZoom());
        if (minRes <= maxRes) {
            if (res <= minRes) {
                return this.getMinZoom();
            } else if (res >= maxRes) {
                return this.getMaxZoom();
            }
        } else if (res >= minRes) {
            return this.getMinZoom();
        } else if (res <= maxRes) {
            return this.getMaxZoom();
        }

        const l = resolutions.length;
        for (let i = 0; i < l - 1; i++) {
            if (!resolutions[i]) {
                continue;
            }
            const gap = resolutions[i + 1] - resolutions[i];
            const test = res - resolutions[i];
            if (sign(gap) === sign(test) && Math.abs(gap) >= Math.abs(test)) {
                return i + test / gap;
            }
        }
        return l - 1;
    }

    /**
     * Sets zoom of the map
     * @param {Number} zoom
     * @param {Object} [options=null] options
     * @param {Boolean} [options.animation=true] whether zoom is animation, true by default
     * @returns {Map} this
     */
    setZoom(zoom, options = { 'animation': true }) {
        if (isNaN(zoom) || isNil(zoom)) {
            return this;
        }
        zoom = +zoom;
        if (this._loaded && this.options['zoomAnimation'] && options['animation']) {
            this._zoomAnimation(zoom);
        } else {
            this._zoom(zoom);
        }
        return this;
    }

    /**
     * Get the max zoom that the map can be zoom to.
     * @return {Number}
     */
    getMaxZoom() {
        if (!isNil(this.options['maxZoom'])) {
            return this.options['maxZoom'];
        }
        return this.getMaxNativeZoom();
    }

    /**
     * Sets the max zoom that the map can be zoom to.
     * @param {Number} maxZoom
     * @returns {Map} this
     */
    setMaxZoom(maxZoom) {
        const viewMaxZoom = this.getMaxNativeZoom();
        if (maxZoom > viewMaxZoom) {
            maxZoom = viewMaxZoom;
        }
        if (maxZoom !== null && maxZoom < this._zoomLevel) {
            this.setZoom(maxZoom);
            maxZoom = +maxZoom;
        }
        this.options['maxZoom'] = maxZoom;
        return this;
    }

    /**
     * Get the min zoom that the map can be zoom to.
     * @return {Number}
     */
    getMinZoom() {
        if (!isNil(this.options['minZoom'])) {
            return this.options['minZoom'];
        }
        return this._spatialReference.getMinZoom();
    }

    /**
     * Sets the min zoom that the map can be zoom to.
     * @param {Number} minZoom
     * @return {Map} this
     */
    setMinZoom(minZoom) {
        if (minZoom !== null) {
            minZoom = +minZoom;
            const viewMinZoom = this._spatialReference.getMinZoom();
            if (minZoom < viewMinZoom) {
                minZoom = viewMinZoom;
            }
            if (minZoom > this._zoomLevel) {
                this.setZoom(minZoom);
            }
        }
        this.options['minZoom'] = minZoom;
        return this;
    }

    /**
     * Maximum zoom the map has
     * @return {Number}
     */
    getMaxNativeZoom() {
        const ref = this.getSpatialReference();
        if (!ref) {
            return null;
        }
        return ref.getMaxZoom();
    }

    /**
     * Resolution for world point in WebGL context
     * @returns {Number}
     */
    getGLRes() {
        if (this._glRes) {
            return this._glRes;
        }
        const fullExtent = this.getSpatialReference().getFullExtent();
        this._glRes = (fullExtent.right - fullExtent.left) / Math.pow(2, 19);
        return this._glRes;
        // return this._getResolution(14);
        // return this._getResolution(this.getMaxNativeZoom() / 2);
    }

    /**
     * Caculate scale from gl zoom to given zoom (default by current zoom)
     * @param {Number} [zoom=undefined] target zoom, current zoom by default
     * @returns {Number}
     * @examples
     * const point = map.coordToPoint(map.getCenter());
     * // convert to point in gl zoom
     * const glPoint = point.multi(this.getGLScale());
     */
    getGLScale(zoom) {
        if (isNil(zoom)) {
            zoom = this.getZoom();
        }
        return this._getResolution(zoom) / this.getGLRes();
    }

    /**
     * zoom in
     * @return {Map} this
     */
    zoomIn() {
        return this.setZoom(this.getZoom() + 1);
    }

    /**
     * zoom out
     * @return {Map} this
     */
    zoomOut() {
        return this.setZoom(this.getZoom() - 1);
    }

    /**
     * Whether the map is zooming
     * @return {Boolean}
     */
    isZooming() {
        return !!this._zooming;
    }

    /**
     * Whether the map is being interacted
     * @return {Boolean}
     */
    isInteracting() {
        return this.isZooming() || this.isMoving() || this.isRotating();
    }

    /**
     * Sets the center and zoom at the same time.
     * @param {Coordinate} center
     * @param {Number} zoom
     * @return {Map} this
     */
    setCenterAndZoom(center, zoom) {
        if (!isNil(zoom) && this._zoomLevel !== zoom) {
            this.setCenter(center);
            this.setZoom(zoom, { animation: false });
        } else {
            this.setCenter(center);
        }
        return this;
    }


    /**
     * Caculate the zoom level that contains the given extent with the maximum zoom level possible.
     * @param {Extent} extent
     * @param  {Boolean} isFraction - can return fractional zoom
     * @return {Number} zoom fit for scale starting from fromZoom
     */
    getFitZoom(extent, isFraction) {
        if (!extent || !(extent instanceof Extent)) {
            return this._zoomLevel;
        }
        //It's a point
        if (extent['xmin'] === extent['xmax'] && extent['ymin'] === extent['ymax']) {
            return this.getMaxZoom();
        }
        const size = this.getSize();
        const containerExtent = extent.convertTo(p => this.coordToPoint(p));
        const w = containerExtent.getWidth(),
            h = containerExtent.getHeight();
        const scaleX = size['width'] / w,
            scaleY = size['height'] / h;
        const scale = this.getSpatialReference().getZoomDirection() < 0 ?
            Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
        const zoom = this.getZoomForScale(scale, null, isFraction);
        return zoom;
    }

    /**
     * Get map's current view (center/zoom/pitch/bearing)
     * @return {Object} { center : *, zoom : *, pitch : *, bearing : * }
     */
    getView() {
        return {
            'center': this.getCenter().toArray(),
            'zoom': this.getZoom(),
            'pitch': this.getPitch(),
            'bearing': this.getBearing()
        };
    }

    /**
     * Set map's center/zoom/pitch/bearing at one time
     * @param {Object} view - a object containing center/zoom/pitch/bearing
     * return {Map} this
     */
    setView(view) {
        if (!view) {
            return this;
        }
        if (view['center']) {
            this.setCenter(view['center']);
        }
        if (view['zoom'] !== null && !isNaN(+view['zoom'])) {
            this.setZoom(+view['zoom'], { 'animation': false });
        }
        if (view['pitch'] !== null && !isNaN(+view['pitch'])) {
            this.setPitch(+view['pitch']);
        }
        if (view['pitch'] !== null && !isNaN(+view['bearing'])) {
            this.setBearing(+view['bearing']);
        }
        return this;
    }

    /**
     * Get map's resolution
     * @param {Number} zoom - zoom or current zoom if not given
     * @return {Number} resolution
     */
    getResolution(zoom) {
        return this._getResolution(zoom);
    }

    /**
     * Get scale of resolutions from zoom to max zoom
     * @param {Number} zoom - zoom or current zoom if not given
     * @return {Number} scale
     */
    getScale(zoom) {
        const z = (isNil(zoom) ? this.getZoom() : zoom);
        const max = this._getResolution(this.getMaxNativeZoom()),
            res = this._getResolution(z);
        return res / max;
    }

    /**
     * Set the map to be fit for the given extent with the max zoom level possible.
     * @param  {Extent} extent - extent
     * @param  {Number} zoomOffset - zoom offset
     * @return {Map} - this
     */
    fitExtent(extent, zoomOffset, options = {}, step) {
        if (!extent) {
            return this;
        }
        extent = new Extent(extent, this.getProjection());
        const zoom = this.getFitZoom(extent) + (zoomOffset || 0);
        const center = extent.getCenter();
        if (typeof (options['animation']) === 'undefined' || options['animation'])
            return this._animateTo({
                center,
                zoom
            }, {
                'duration': options['duration'] || this.options['zoomAnimationDuration'],
                'easing': options['easing'] || 'out',
            }, step);
        else
            return this.setCenterAndZoom(center, zoom);
    }

    /**
     * shorter alias for coordinateToPoint
     */
    coordToPoint(coordinate, zoom, out) {
        return this.coordinateToPoint(coordinate, zoom, out);
    }

    /**
     * shorter alias for coordinateToPointAtRes
     */
    coordToPointAtRes(coordinate, res, out) {
        return this.coordinateToPointAtRes(coordinate, res, out);
    }

    /**
     * shorter alias for pointToCoordinate
     */
    pointToCoord(point, zoom, out) {
        return this.pointToCoordinate(point, zoom, out);
    }

    /**
     * shorter alias for pointAtResToCoordinate
     */
    pointAtResToCoord(point, zoom, out) {
        return this.pointAtResToCoordinate(point, zoom, out);
    }


    /**
     * shorter alias for coordinateToViewPoint
     */
    coordToViewPoint(coordinate, out, altitude) {
        return this.coordinateToViewPoint(coordinate, out, altitude);
    }

    /**
     * shorter alias for viewPointToCoordinate
     */
    viewPointToCoord(viewPoint, out) {
        return this.viewPointToCoordinate(viewPoint, out);
    }

    /**
     * shorter alias for coordinateToContainerPoint
     */
    coordToContainerPoint(coordinate, zoom, out) {
        return this.coordinateToContainerPoint(coordinate, zoom, out);
    }


    /**
     * shorter alias for containerPointToCoordinate
     */
    containerPointToCoord(containerPoint, out) {
        return this.containerPointToCoordinate(containerPoint, out);
    }

    /**
     * Converts a container point to the view point.
     * Usually used in plugin development.
     * @param {Point}
     * @param  {Point} [out=undefined]    - optional point to receive result
     * @returns {Point}
     */
    containerPointToViewPoint(containerPoint, out) {
        if (out) {
            out.set(containerPoint.x, containerPoint.y);
        } else {
            out = containerPoint.copy();
        }
        return out._sub(this.getViewPoint());
    }

    /**
     * Converts a view point to the container point.
     * Usually used in plugin development.
     * @param {Point}
     * @param  {Point} [out=undefined]    - optional point to receive result
     * @returns {Point}
     */
    viewPointToContainerPoint(viewPoint, out) {
        if (out) {
            out.set(viewPoint.x, viewPoint.y);
        } else {
            out = viewPoint.copy();
        }
        return out._add(this.getViewPoint());
    }

    /**
     * Computes the coordinate from the given meter distance.
     * @param  {Coordinate} coordinate - source coordinate
     * @param  {Number} dx           - meter distance on X axis
     * @param  {Number} dy           - meter distance on Y axis
     * @return {Coordinate} Result coordinate
     */
    locate(coordinate, dx, dy) {
        return this.getProjection()._locate(new Coordinate(coordinate), dx, dy);
    }

    /**
     * Test if given box is out of current screen
     * @param {Number[] | PointExtent} box - [minx, miny, maxx, maxy]
     * @param {Number} padding - test padding
     * @returns {Boolean}
     */
    isOffscreen(box, viewportPadding = 0) {
        const { width, height } = this;
        const screenRightBoundary = width + viewportPadding;
        const screenBottomBoundary = height + viewportPadding;
        let { xmin, ymin, xmax, ymax } = box;
        if (Array.isArray(box)) {
            [xmin, ymin, xmax, ymax] = box;
        }
        return xmax < viewportPadding || xmin >= screenRightBoundary || ymax < viewportPadding || ymin > screenBottomBoundary;
    }

    /**
     * Get device's devicePixelRatio, you can override it by setting devicePixelRatio in options.
     * @returns {Number}
     */
    getDevicePixelRatio() {
        return this.options['devicePixelRatio'] || 1;
    }

    _Load() {
        this._resetMapStatus();
        if (this.options['pitch']) {
            this.setPitch(this.options['pitch']);
            delete this.options['pitch'];
        }
        if (this.options['bearing']) {
            this.setBearing(this.options['bearing']);
            delete this.options['bearing'];
        }
        delete this._glRes;
        this._loadAllLayers();
        this._getRenderer().onLoad();
        this._loaded = true;
        this._callOnLoadHooks();
        this._initTime = now();
    }

    _initRenderer() {
        const renderer = this.options['renderer'];
        const clazz = Map.getRendererClass(renderer);
        this._renderer = new clazz(this);
        this._renderer.load();
    }

    _getRenderer() {
        return this._renderer;
    }

    _loadAllLayers() {
        function loadLayer(layer) {
            if (layer) {
                layer.load();
            }
        }
        if (this._baseLayer) {
            this._baseLayer.load();
        }
        this._eachLayer(loadLayer, this.getLayers());
    }

    /**
     * Gets layers that fits for the filter
     * @param  {fn} filter - filter function
     * @return {Layer[]}
     * @private
     */
    _getLayers(filter) {
        const layers = this._baseLayer ? [this._baseLayer].concat(this._layers) : this._layers;
        const result = [];
        for (let i = 0; i < layers.length; i++) {
            if (!filter || filter.call(this, layers[i])) {
                result.push(layers[i]);
            }
        }
        return result;
    }

    //Check and reset map's status when map's spatial reference is changed.
    _resetMapStatus() {
        let maxZoom = this.getMaxZoom(),
            minZoom = this.getMinZoom();
        const viewMaxZoom = this._spatialReference.getMaxZoom(),
            viewMinZoom = this._spatialReference.getMinZoom();
        if (isNil(maxZoom) || maxZoom === -1 || maxZoom > viewMaxZoom) {
            this.setMaxZoom(viewMaxZoom);
        }
        if (isNil(minZoom) || minZoom === -1 || minZoom < viewMinZoom) {
            this.setMinZoom(viewMinZoom);
        }
        maxZoom = this.getMaxZoom();
        minZoom = this.getMinZoom();
        if (maxZoom < minZoom) {
            this.setMaxZoom(minZoom);
        }
        if (isNil(this._zoomLevel) || this._zoomLevel > maxZoom) {
            this._zoomLevel = maxZoom;
        }
        if (this._zoomLevel < minZoom) {
            this._zoomLevel = minZoom;
        }
        delete this._prjCenter;
        const projection = this.getProjection();
        this._prjCenter = projection.project(this._center);
        this._calcMatrices();
        const renderer = this._getRenderer();
        if (renderer) {
            renderer.resetContainer();
        }
    }

    _getContainerDomSize() {
        if (!this._containerDOM) {
            return null;
        }
        const containerDOM = this._containerDOM;
        let width, height;
        if (!isNil(containerDOM.width) && !isNil(containerDOM.height)) {
            width = containerDOM.width;
            height = containerDOM.height;
            const dpr = this.getDevicePixelRatio();
            if (dpr !== 1 && containerDOM['layer']) {
                //is a canvas tile of CanvasTileLayer
                width /= dpr;
                height /= dpr;
            }
        } else if (!isNil(containerDOM.clientWidth) && !isNil(containerDOM.clientHeight)) {
            width = parseInt(containerDOM.clientWidth, 0);
            height = parseInt(containerDOM.clientHeight, 0);
        } else {
            throw new Error('can not get size of container');
        }
        return new Size(width, height);
    }

    _updateMapSize(mSize) {
        this.width = mSize['width'];
        this.height = mSize['height'];
        this._getRenderer().updateMapSize(mSize);
        this._calcMatrices();
        return this;
    }

    /**
     * Gets projected center of the map
     * @return {Coordinate}
     * @private
     */
    _getPrjCenter() {
        return this._prjCenter;
    }

    _setPrjCenter(pcenter) {
        this._prjCenter = pcenter;
        this._calcMatrices();
    }

    _setPrjCoordAtContainerPoint(coordinate, point) {
        if (point.x === this.width / 2 && point.y === this.height / 2) {
            return this;
        }
        const t = this._containerPointToPoint(point)._sub(this._prjToPoint(this._getPrjCenter()));
        const pcenter = this._pointToPrj(this._prjToPoint(coordinate).sub(t));
        this._setPrjCenter(pcenter);
        return this;
    }

    _verifyExtent(prjCenter) {
        if (!prjCenter) {
            return false;
        }
        const maxExt = this._prjMaxExtent;
        if (!maxExt) {
            return true;
        }
        return maxExt.contains(prjCenter);
    }

    /**
     * Move map's center by pixels.
     * @param  {Point} pixel - pixels to move, the relation between value and direction is as:
     * -1,1 | 1,1
     * ------------
     *-1,-1 | 1,-1
     * @private
     * @returns {Coordinate} the new projected center.
     */
    _offsetCenterByPixel(pixel) {
        const pos = new Point(this.width / 2 - pixel.x, this.height / 2 - pixel.y);
        const pCenter = this._containerPointToPrj(pos);
        this._setPrjCenter(pCenter);
        return pCenter;
    }

    /**
     * offset map panels.
     *
     * @param  {Point} offset - offset in pixel to move
     * @return {Map} this
     */
    /**
     * Gets map panel's current view point.
     * @return {Point}
     */
    offsetPlatform(offset) {
        if (!offset) {
            return this._mapViewPoint;
        } else {
            this._getRenderer().offsetPlatform(offset);
            this._mapViewCoord = this._getPrjCenter();
            this._mapViewPoint = this._mapViewPoint.add(offset);
            return this;
        }
    }

    /**
     * Get map's view point, adding in frame offset
     * @return {Point} map view point
     */
    getViewPoint() {
        const offset = this._getViewPointFrameOffset();
        let panelOffset = this.offsetPlatform();
        if (offset) {
            panelOffset = panelOffset.add(offset);
        }
        return panelOffset;
    }


    _resetMapViewPoint() {
        this._mapViewPoint = new Point(0, 0);
        // mapViewCoord is the proj coordinate of current view point
        this._mapViewCoord = this._getPrjCenter();
    }

    /**
     * Get map's current resolution
     * @return {Number} resolution
     * @private
     */
    _getResolution(zoom) {
        if ((zoom === undefined || zoom === this._zoomLevel) && this._mapRes !== undefined) {
            return this._mapRes;
        }
        if (isNil(zoom)) {
            zoom = this._zoomLevel;
        }
        return this._spatialReference.getResolution(zoom);
    }

    _getResolutions() {
        return this._spatialReference.getResolutions();
    }

    /**
     * Converts the projected coordinate to a 2D point in the specific zoom
     * @param  {Coordinate} pCoord - projected Coordinate
     * @param  {Number} zoom   - point's zoom level
     * @return {Point} 2D point
     * @private
     */
    _prjToPoint(pCoord, zoom, out) {
        zoom = (isNil(zoom) ? this.getZoom() : zoom);
        const res = this._getResolution(zoom);
        return this._prjToPointAtRes(pCoord, res, out);
    }

    _prjToPointAtRes(pCoord, res, out) {
        return this._spatialReference.getTransformation().transform(pCoord, res, out);
    }

    /**
     * Converts the projected coordinate to a 2D point in the specific resolution
     * @param  {Coordinate} pCoord - projected Coordinate
     * @param  {Number} res   - point's resolution
     * @return {Point} 2D point
     * @private
     */
    _prjsToPointsAtRes(pCoords, res, resultPoints = []) {
        const transformation = this._spatialReference.getTransformation();
        const pts = [];
        for (let i = 0, len = pCoords.length; i < len; i++) {
            const pt = transformation.transform(pCoords[i], res, resultPoints[i]);
            pts.push(pt);
        }
        return pts;
    }

    /**
     * Converts the 2D point to projected coordinate
     * @param  {Point} point - 2D point
     * @param  {Number} zoom   - point's zoom level
     * @return {Coordinate} projected coordinate
     * @private
     */
    _pointToPrj(point, zoom, out) {
        zoom = (isNil(zoom) ? this.getZoom() : zoom);
        const res = this._getResolution(zoom);
        return this._pointToPrjAtRes(point, res, out);
    }

    _pointToPrjAtRes(point, res, out) {
        return this._spatialReference.getTransformation().untransform(point, res, out);
    }

    /**
     * Convert point at zoom to point at current zoom
     * @param  {Point} point point
     * @param  {Number} zoom point's zoom
     * @return {Point} point at current zoom
     * @private
     */
    _pointToPoint(point, zoom, out) {
        if (!isNil(zoom)) {
            return this._pointAtResToPoint(point, this._getResolution(zoom), out);
        }
        if (out) {
            out.x = point.x;
            out.y = point.y;
        } else {
            out = point.copy();
        }
        return out;
    }

    _pointAtResToPoint(point, res, out) {
        if (out) {
            out.x = point.x;
            out.y = point.y;
        } else {
            out = point.copy();
        }
        return out._multi(res / this._getResolution());
    }

    /**
     * Convert point at current zoom to point at target res
     * @param  {Point} point point
     * @param  {Number} res target res
     * @return {Point} point at target res
     * @private
     */
    _pointToPointAtRes(point, res, out) {
        if (out) {
            out.x = point.x;
            out.y = point.y;
        } else {
            out = point.copy();
        }
        return out._multi(this._getResolution() / res);
    }

    /**
     * transform container point to geographical projected coordinate
     *
     * @param  {Point} containerPoint
     * @return {Coordinate}
     * @private
     */
    _containerPointToPrj(containerPoint, out) {
        return this._pointToPrj(this._containerPointToPoint(containerPoint, undefined, out), undefined, out);
    }


    /* eslint no-extend-native: 0 */
    _callOnLoadHooks() {
        const proto = Map.prototype;
        if (!proto._onLoadHooks) {
            return;
        }
        for (let i = 0, l = proto._onLoadHooks.length; i < l; i++) {
            proto._onLoadHooks[i].call(this);
        }
    }
}

Map.include(/** @lends Map.prototype */{

    /**
     * Converts a coordinate to the 2D point in current zoom or in the specific zoom. <br>
     * The 2D point's coordinate system's origin is the same with map's origin.
     * Usually used in plugin development.
     * @param  {Coordinate} coordinate - coordinate
     * @param  {Number} [zoom=undefined]  - zoom level
     * @param  {Point} [out=undefined]    - optional point to receive result
     * @return {Point}  2D point
     * @function
     * @example
     * var point = map.coordinateToPoint(new Coordinate(121.3, 29.1));
     */
    coordinateToPoint(coordinate, zoom, out) {
        const res = this._getResolution(zoom);
        return this.coordinateToPointAtRes(coordinate, res, out);
    },

    /**
     * Converts a coordinate to the 2D point at specified resolution. <br>
     * The 2D point's coordinate system's origin is the same with map's origin.
     * Usually used in plugin development.
     * @param  {Coordinate} coordinate - coordinate
     * @param  {Number} [res=undefined]  - target resolution
     * @param  {Point} [out=undefined]    - optional point to receive result
     * @return {Point}  2D point
     * @function
     * @example
     * var point = map.coordinateToPoint(new Coordinate(121.3, 29.1));
     */
    coordinateToPointAtRes: function () {
        const COORD = new Coordinate(0, 0);
        return function (coordinate, res, out) {
            const prjCoord = this.getProjection().project(coordinate, COORD);
            return this._prjToPointAtRes(prjCoord, res, out);
        };
    }(),

    /**
     * Converts a 2D point in current zoom or a specific zoom to a coordinate.
     * Usually used in plugin development.
     * @param  {Point} point - 2D point
     * @param  {Number} zoom  - point's zoom level
     * @param  {Coordinate} [out=undefined]    - optional coordinate to receive result
     * @return {Coordinate} coordinate
     * @function
     * @example
     * var coord = map.pointToCoordinate(new Point(4E6, 3E4));
     */
    pointToCoordinate: function () {
        const COORD = new Coordinate(0, 0);
        return function (point, zoom, out) {
            const prjCoord = this._pointToPrj(point, zoom, COORD);
            return this.getProjection().unproject(prjCoord, out);
        };
    }(),

    /**
     * Converts a 2D point at specific resolution to a coordinate.
     * Usually used in plugin development.
     * @param  {Point} point - 2D point
     * @param  {Number} res  - point's resolution
     * @param  {Coordinate} [out=undefined]    - optional coordinate to receive result
     * @return {Coordinate} coordinate
     * @function
     * @example
     * var coord = map.pointAtResToCoordinate(new Point(4E6, 3E4), map.getResolution());
     */
    pointAtResToCoordinate: function () {
        const COORD = new Coordinate(0, 0);
        return function (point, res, out) {
            const prjCoord = this._pointToPrjAtRes(point, res, COORD);
            return this.getProjection().unproject(prjCoord, out);
        };
    }(),


    /**
     * Converts a geographical coordinate to view point.<br>
     * A view point is a point relative to map's mapPlatform panel's position. <br>
     * Usually used in plugin development.
     * @param {Coordinate} coordinate
     * @param  {Point} [out=undefined]    - optional point to receive result
     * @return {Point}
     * @function
     */
    coordinateToViewPoint: function () {
        const COORD = new Coordinate(0, 0);
        return function (coordinate, out, altitude) {
            return this._prjToViewPoint(this.getProjection().project(coordinate, COORD), out, altitude);
        };
    }(),

    /**
     * Converts a view point to the geographical coordinate.
     * Usually used in plugin development.
     * @param {Point} viewPoint
     * @param  {Coordinate} [out=undefined]    - optional coordinate to receive result
     * @return {Coordinate}
     * @function
     */
    viewPointToCoordinate: function () {
        const COORD = new Coordinate(0, 0);
        return function (viewPoint, out) {
            return this.getProjection().unproject(this._viewPointToPrj(viewPoint, COORD), out);
        };
    }(),

    /**
     * Convert a geographical coordinate to the container point. <br>
     *  A container point is a point relative to map container's top-left corner. <br>
     * @param {Coordinate}                - coordinate
     * @param  {Number} [zoom=undefined]  - zoom level
     * @param  {Point} [out=undefined]    - optional point to receive result
     * @return {Point}
     * @function
     */
    coordinateToContainerPoint(coordinate, zoom, out) {
        const res = this._getResolution(zoom);
        return this.coordinateToContainerPointAtRes(coordinate, res, out);
    },

    coordinateToContainerPointAtRes: function () {
        const COORD = new Coordinate(0, 0);
        return function (coordinate, res, out) {
            const pCoordinate = this.getProjection().project(coordinate, COORD);
            return this._prjToContainerPointAtRes(pCoordinate, res, out);
        };
    }(),

    /**
     * Convert a geographical coordinate to the container point. <br>
     * Batch conversion for better performance <br>
     *  A container point is a point relative to map container's top-left corner. <br>
     * @param {Array[Coordinate]}                - coordinates
     * @param  {Number} [zoom=undefined]  - zoom level
     * @return {Array[Point]}
     * @function
     */
    coordinatesToContainerPoints(coordinates, zoom) {
        const res = this._getResolution(zoom);
        return this.coordinatesToContainerPointsAtRes(coordinates, res);
    },

    /**
     * Convert a geographical coordinate to the container point. <br>
     * Batch conversion for better performance <br>
     *  A container point is a point relative to map container's top-left corner. <br>
     * @param {Array[Coordinate]}                - coordinates
     * @param  {Number} [resolution=undefined]  - container points' resolution
     * @return {Array[Point]}
     * @function
     */
    coordinatesToContainerPointsAtRes: function () {
        return function (coordinates, resolution) {
            const pts = [];
            const transformation = this._spatialReference.getTransformation();
            const res = resolution / this._getResolution();
            const projection = this.getProjection();
            const prjOut = new Coordinate(0, 0);
            const isTransforming = this.isTransforming();
            const centerPoint = this._prjToPoint(this._getPrjCenter(), undefined, TEMP_COORD);
            for (let i = 0, len = coordinates.length; i < len; i++) {
                const pCoordinate = projection.project(coordinates[i], prjOut);
                let point = transformation.transform(pCoordinate, resolution);
                point = point._multi(res);
                this._toContainerPoint(point, isTransforming, res, 0, centerPoint);
                pts.push(point);
            }
            return pts;
        };
    }(),

    /**
     * Converts a container point to geographical coordinate.
     * @param {Point}
     * @param  {Coordinate} [out=undefined]    - optional coordinate to receive result
     * @return {Coordinate}
     * @function
     */
    containerPointToCoordinate: function () {
        const COORD = new Coordinate(0, 0);
        return function (containerPoint, out) {
            const pCoordinate = this._containerPointToPrj(containerPoint, COORD);
            return this.getProjection().unproject(pCoordinate, out);
        };
    }(),

    /**
     * Converts a container point extent to the geographic extent.
     * @param  {PointExtent} containerExtent - containeproints extent
     * @return {Extent}  geographic extent
     * @function
     */
    containerToExtent: function () {
        const POINT0 = new Point(0, 0);
        const POINT1 = new Point(0, 0);
        return function (containerExtent) {
            const extent2D = new PointExtent(
                this._containerPointToPoint(containerExtent.getMin(POINT0), undefined, POINT0),
                this._containerPointToPoint(containerExtent.getMax(POINT1), undefined, POINT1)
            );
            return this._pointToExtent(extent2D);
        };
    }(),

    /**
     * Converts geographical distances to the pixel length.<br>
     * The value varis with difference zoom level.
     *
     * @param  {Number} xDist - distance on X axis.
     * @param  {Number} yDist - distance on Y axis.
     * @return {Size} result.width: pixel length on X axis; result.height: pixel length on Y axis
     * @function
     */
    distanceToPixel: function () {
        const POINT0 = new Point(0, 0);
        const POINT1 = new Point(0, 0);
        return function (xDist, yDist, zoom) {
            const projection = this.getProjection();
            if (!projection) {
                return null;
            }
            const scale = this.getScale() / this.getScale(zoom);
            const center = this.getCenter(),
                target = projection.locate(center, xDist, yDist);
            const p0 = this.coordToContainerPoint(center, undefined, POINT0),
                p1 = this.coordToContainerPoint(target, undefined, POINT1);
            p1._sub(p0)._multi(scale)._abs();
            return new Size(p1.x, p1.y);
        };
    }(),

    /**
     * Converts geographical distances to the 2d point length.<br>
     * The value varis with difference zoom level.
     *
     * @param  {Number} xDist - distance on X axis.
     * @param  {Number} yDist - distance on Y axis.
     * @param  {Number} zoom - point's zoom
     * @return {Point}
     * @function
     */
    distanceToPoint(xDist, yDist, zoom, paramCenter) {
        const res = this._getResolution(zoom);
        return this.distanceToPointAtRes(xDist, yDist, res, paramCenter);
    },

    /**
     * Converts geographical distances to the 2d point length at specified resolution.
     *
     * @param  {Number} xDist - distance on X axis.
     * @param  {Number} yDist - distance on Y axis.
     * @param  {Number} res - target resolution
     * @return {Point}
     * @function
     */
    distanceToPointAtRes: function () {
        const POINT = new Point(0, 0);
        return function (xDist, yDist, res, paramCenter) {
            const projection = this.getProjection();
            if (!projection) {
                return null;
            }
            const center = paramCenter || this.getCenter(),
                target = projection.locate(center, xDist, yDist);
            const p0 = this.coordToPointAtRes(center, res, POINT),
                p1 = this.coordToPointAtRes(target, res);
            p1._sub(p0)._abs();
            return p1;
        };
    }(),


    /**
     * Converts pixel size to geographical distance.
     *
     * @param  {Number} width - pixel width
     * @param  {Number} height - pixel height
     * @return {Number}  distance - Geographical distance
     * @function
     */
    pixelToDistance: function () {
        const COORD0 = new Coordinate(0, 0);
        const COORD1 = new Coordinate(0, 0);
        return function (width, height) {
            const projection = this.getProjection();
            if (!projection) {
                return null;
            }
            const fullExt = this.getFullExtent();
            const d = fullExt['top'] > fullExt['bottom'] ? -1 : 1;
            const target = COORD0.set(this.width / 2 + width, this.height / 2 + d * height);
            const coord = this.containerPointToCoord(target, COORD1);
            return projection.measureLength(this.getCenter(), coord);
        };
    }(),

    /**
     * Converts 2d point distances to geographic length.<br>
     *
     * @param  {Number} dx - distance on X axis.
     * @param  {Number} dy - distance on Y axis.
     * @param  {Number} zoom - point's zoom
     * @return {Number} distance
     * @function
     */
    pointToDistance(dx, dy, zoom) {
        const res = this.getResolution(zoom);
        return this.pointAtResToDistance(dx, dy, res);
    },

    /**
     * Converts 2d point distances to geographic length.<br>
     *
     * @param  {Number} dx - distance on X axis.
     * @param  {Number} dy - distance on Y axis.
     * @param  {Number} res - point's resolution
     * @return {Number} distance
     * @function
     */
    pointAtResToDistance: function () {
        const POINT = new Point(0, 0);
        const COORD = new Coordinate(0, 0);
        return function (dx, dy, res) {
            const projection = this.getProjection();
            if (!projection) {
                return null;
            }
            const c = this._prjToPointAtRes(this._getPrjCenter(), res, POINT);
            c._add(dx, dy);
            const target = this.pointAtResToCoord(c, res, COORD);
            return projection.measureLength(this.getCenter(), target);
        };
    }(),


    /**
     * Computes the coordinate from the given pixel distance.
     * @param  {Coordinate} coordinate - source coordinate
     * @param  {Number} px           - pixel distance on X axis
     * @param  {Number} py           - pixel distance on Y axis
     * @return {Coordinate} Result coordinate
     * @function
     */
    locateByPoint: function () {
        const POINT = new Point(0, 0);
        return function (coordinate, px, py) {
            const point = this.coordToContainerPoint(coordinate, undefined, POINT);
            return this.containerPointToCoord(point._add(px, py));
        };
    }(),

    /**
     * Get map's extent in view points.
     * @param {Number} zoom - zoom
     * @return {PointExtent}
     * @private
     * @function
     */
    _get2DExtent(zoom, out) {
        let cached;
        if ((zoom === undefined || zoom === this._zoomLevel) && this._mapExtent2D) {
            cached = this._mapExtent2D;
        }
        if (cached) {
            if (out) {
                out.set(cached['xmin'], cached['ymin'], cached['xmax'], cached['ymax']);
                return out;
            }
            return cached.copy();
        }
        const res = this._getResolution(zoom);
        return this._get2DExtentAtRes(res, out);
    },

    _get2DExtentAtRes: function () {
        const POINT = new Point(0, 0);
        return function (res, out) {
            if (res === this._mapGlRes && this._mapGlExtent2D) {
                return this._mapGlExtent2D;
            }
            const cExtent = this.getContainerExtent();
            return cExtent.convertTo(c => this._containerPointToPointAtRes(c, res, POINT), out);
        };
    }(),

    /**
     * Converts a view point extent to the geographic extent.
     * @param  {PointExtent} extent2D - view points extent
     * @return {Extent}  geographic extent
     * @protected
     * @function
     */
    _pointToExtent: function () {
        const COORD0 = new Coordinate(0, 0);
        const COORD1 = new Coordinate(0, 0);
        return function (extent2D) {
            const min2d = extent2D.getMin(),
                max2d = extent2D.getMax();
            const fullExtent = this.getFullExtent();
            const [minx, maxx] = (!fullExtent || fullExtent.left <= fullExtent.right) ? [min2d.x, max2d.x] : [max2d.x, min2d.x];
            const [miny, maxy] = (!fullExtent || fullExtent.top > fullExtent.bottom) ? [max2d.y, min2d.y] : [min2d.y, max2d.y];
            const min = min2d.set(minx, maxy);
            const max = max2d.set(maxx, miny);
            return new Extent(
                this.pointToCoord(min, undefined, COORD0),
                this.pointToCoord(max, undefined, COORD1),
                this.getProjection()
            );
        };
    }(),


    /**
     * When moving map, map's center is updated in real time, but platform will be moved in the next frame to keep syncing with other layers
     * Get the offset in current frame and the next frame
     * @return {Point} view point offset
     * @private
     * @function
     */
    _getViewPointFrameOffset: function () {
        const POINT = new Point(0, 0);
        return function () {
            // when zooming, view point is not updated, and container is being transformed with matrix.
            // so ignore the frame offset
            if (this.isZooming()) {
                return null;
            }
            const pcenter = this._getPrjCenter();
            if (this._mapViewCoord && !this._mapViewCoord.equals(pcenter)) {
                return this._prjToContainerPoint(this._mapViewCoord)._sub(this._prjToContainerPoint(pcenter, undefined, POINT));
            }
            return null;
        };
    }(),

    /**
     * transform view point to geographical projected coordinate
     * @param  {Point} viewPoint
     * @param  {Coordinate} [out=undefined]  - optional coordinate to receive result
     * @return {Coordinate}
     * @private
     * @function
     */
    _viewPointToPrj: function () {
        const POINT = new Point(0, 0);
        return function (viewPoint, out) {
            return this._containerPointToPrj(this.viewPointToContainerPoint(viewPoint, POINT), out);
        };
    }(),

    /**
     * transform geographical projected coordinate to container point
     * @param  {Coordinate} pCoordinate
     * @param  {Number} zoom target zoom
     * @param  {Point} [out=undefined]    - optional point to receive result
     * @return {Point}
     * @private
     * @function
     */
    _prjToContainerPoint(pCoordinate, zoom, out, altitude) {
        const res = this._getResolution(zoom);
        return this._prjToContainerPointAtRes(pCoordinate, res, out, altitude);
    },

    _prjToContainerPointAtRes: function () {
        const POINT = new Point(0, 0);
        return function (pCoordinate, res, out, altitude) {
            return this._pointAtResToContainerPoint(this._prjToPointAtRes(pCoordinate, res, POINT), res, altitude || 0, out);
        };
    }(),

    /**
     * transform geographical projected coordinate to view point
     * @param  {Coordinate} pCoordinate
     * @return {Point}
     * @private
     * @function
     */
    _prjToViewPoint: function () {
        const POINT = new Point(0, 0);
        return function (pCoordinate, out, altitude) {
            const containerPoint = this._prjToContainerPoint(pCoordinate, undefined, POINT, altitude);
            return this.containerPointToViewPoint(containerPoint, out);
        };
    }(),

    _viewPointToPoint: function () {
        const POINT = new Point(0, 0);
        return function (viewPoint, zoom, out) {
            return this._containerPointToPoint(this.viewPointToContainerPoint(viewPoint, POINT), zoom, out);
        };
    }(),

    _pointToViewPoint: function () {
        const COORD = new Coordinate(0, 0);
        return function (point, zoom, out) {
            return this._prjToViewPoint(this._pointToPrj(point, zoom, COORD), out);
        };
    }(),

});

Map.mergeOptions(options);

export default Map;
