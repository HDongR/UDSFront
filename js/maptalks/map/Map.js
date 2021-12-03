import {
    now,
    extend,
    isNil,
    isString,
    isFunction,
    sign,
    UID,
} from '/js/maptalks/core/util/index.js';
import Class from '/js/maptalks/core/Class.js';
import Eventable from '/js/maptalks/core/Eventable.js';
import Handlerable from '/js/maptalks/handler/Handlerable.js';
import Renderable from '/js/maptalks/renderer/Renderable.js';
import Point from '/js/maptalks/geo/Point.js';
import Size from '/js/maptalks/geo/Size.js';
import PointExtent from '/js/maptalks/geo/PointExtent.js';
import Extent from '/js/maptalks/geo/Extent.js';
import Coordinate from '/js/maptalks/geo/Coordinate.js';
import SpatialReference from '/js/maptalks/map/spatial-reference/SpatialReference.js';
import Projection from '/js/maptalks/geo/projection/Projection.EPSG3857.js';
import Handler from '/js/maptalks/handler/Handler.js';

const TEMP_COORD = new Coordinate(0, 0);
const options = {
    'maxVisualPitch': 70,
    'maxPitch': 80,
    'centerCross': false,

    'zoomInCenter': false,
    'zoomOrigin': null,
    'zoomAnimation': (function () {
        return !false;
    })(),
    'zoomAnimationDuration': 330,

    'panAnimation': (function () {
        return !false;
    })(),
    //default pan animation duration
    'panAnimationDuration': 600,

    'zoomable': true,
    'enableInfoWindow': true,

    'hitDetect': (function () {
        return !false;
    })(),

    'hitDetectLimit': 5,

    'fpsOnInteracting': 25,

    'layerCanvasLimitOnInteracting': -1,

    'maxZoom': null,
    'minZoom': null,
    'maxExtent': null,
    'fixCenterOnResize': true,

    'checkSize': true,
    'checkSizeInterval': 1000,

    'renderer': 'canvas',

    'cascadePitches': [10, 60],
    'renderable': true
};

export default class Map extends Handlerable(Eventable(Renderable(Class))) {
    constructor(canvas, inputElement, options) {
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

        this.VERSION = 1.0;
        Object.defineProperty(this, 'id', {
            value: UID(),
            writable: false
        });

        this._loaded = false;


        this._zoomLevel = zoom;
        this._center = center;


        this.canvas = canvas;
        this.inputElement = inputElement;
        this.document = inputElement;
        this._containerDOM = inputElement;

        //this.options = options;
        this.projection = new Projection();
        this.spatialReference = new SpatialReference({ 'projection': this.projection });
        this._spatialReference = this.spatialReference;
        //this.zoom = options.zoom;
        this.maxZoom = options.maxZoom;
        this.minZoom = options.minZoom;


        this._resetMapStatus();


        this.setMaxExtent(opts['maxExtent']);
        this._mapViewPoint = new Point(0, 0);
        this._initRenderer();
        this._updateMapSize(this._getContainerDomSize());

        this._Load();

        return this;
    }
    getMap(){
        return this;
    }
    _Load() {
        this._resetMapStatus();
        // if (this.options['pitch']) {
        //     this.setPitch(this.options['pitch']);
        //     delete this.options['pitch'];
        // }
        // if (this.options['bearing']) {
        //     this.setBearing(this.options['bearing']);
        //     delete this.options['bearing'];
        // }
        // delete this._glRes;
        // this._loadAllLayers();
        // this._getRenderer().onLoad();
        this._loaded = true;
        this._callOnLoadHooks();
        this._initTime = now();
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

    _initRenderer() {
        const renderer = this.options['renderer'];
        const clazz = Map.getRendererClass(renderer);
        this._renderer = new clazz(this);
        this._renderer.load();
    }

    _getRenderer() {
        return this._renderer;
    }

    getRenderer() {
        return this._getRenderer();
    }
    getProjection() {
        if (!this._spatialReference) {
            return null;
        }
        return this._spatialReference.getProjection();
    }

    static addOnLoadHook(fn) { // (Function) || (String, args...)
        const args = Array.prototype.slice.call(arguments, 1);
        const onload = typeof fn === 'function' ? fn : function () {
            this[fn].apply(this, args);
        };
        this.prototype._onLoadHooks = this.prototype._onLoadHooks || [];
        this.prototype._onLoadHooks.push(onload);
        return this;
    }

    _callOnLoadHooks() {
        const proto = Map.prototype;
        if (!proto._onLoadHooks) {
            return;
        }
        for (let i = 0, l = proto._onLoadHooks.length; i < l; i++) {
            proto._onLoadHooks[i].call(this);
        }
    }

    getContainer() {
        return this._containerDOM;
    }

    getZoom = function getZoom() {
        return this._zoomLevel;
    }

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

    getMaxZoom() {
        if (!isNil(this.options['maxZoom'])) {
            return this.options['maxZoom'];
        }
        return this.getMaxNativeZoom();
    }

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

    getMinZoom() {
        if (!isNil(this.options['minZoom'])) {
            return this.options['minZoom'];
        }
        return this._spatialReference.getMinZoom();
    }

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

    zoomIn() {
        return this.setZoom(this.getZoom() + 1);
    }

    zoomOut() {
        return this.setZoom(this.getZoom() - 1);
    }

    isZooming() {
        return !!this._zooming;
    }

    isMoving() {
        return !!this._moving;
    }

    isInteracting() {
        return this.isZooming() || this.isMoving() || this.isRotating();
    }

    _containerPointToPrj(containerPoint, out) {
        return this._pointToPrj(this._containerPointToPoint(containerPoint, undefined, out), undefined, out);
    }

    _pointToPrj(point, zoom, out) {
        zoom = (isNil(zoom) ? this.getZoom() : zoom);
        const res = this._getResolution(zoom);
        return this._pointToPrjAtRes(point, res, out);
    }

    _pointToPrjAtRes(point, res, out) {
        return this._spatialReference.getTransformation().untransform(point, res, out);
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

    _pointAtResToPoint(point, res, out) {
        if (out) {
            out.x = point.x;
            out.y = point.y;
        } else {
            out = point.copy();
        }
        return out._multi(res / this._getResolution());
    }

    _getResolution(zoom) {
        if ((zoom === undefined || zoom === this._zoomLevel) && this._mapRes !== undefined) {
            return this._mapRes;
        }
        if (isNil(zoom)) {
            zoom = this._zoomLevel;
        }
        return this._spatialReference.getResolution(zoom);
    }

    getResolution(zoom) {
        return this._getResolution(zoom);
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

    _getPrjCenter() {
        return this._prjCenter;
    }

    _setPrjCenter(pcenter) {
        this._prjCenter = pcenter;
        if (this.isInteracting() && !this.isMoving()) {
            // when map is not moving, map's center is updated but map platform won't
            // mapViewCoord needs to be synced
            this._mapViewCoord = pcenter;
        }
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

    getCenter() {
        if (!this._loaded || !this._prjCenter) {
            return this._center;
        }
        const projection = this.getProjection();
        return projection.unproject(this._prjCenter);
    }

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
        //this._getRenderer().updateMapSize(mSize);
        this._calcMatrices();
        return this;
    }

    getDevicePixelRatio() {
        return this.options['devicePixelRatio'] || Browser.devicePixelRatio || 1;
    }

    getGLScale(zoom) {
        if (isNil(zoom)) {
            zoom = this.getZoom();
        }
        return this._getResolution(zoom) / this.getGLRes();
    }

    getMaxNativeZoom() {
        const ref = this.getSpatialReference();
        if (!ref) {
            return null;
        }
        return ref.getMaxZoom();
    }

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

    getSpatialReference() {
        return this._spatialReference;
    }
    _fireEvent(eventName, param) {
        if (this._eventSilence) {
            return;
        }
        //fire internal events at first
        this.fire('_' + eventName, param);
        this.fire(eventName, param);
    }
    _resetMapViewPoint() {
        this._mapViewPoint = new Point(0, 0);
        // mapViewCoord is the proj coordinate of current view point
        this._mapViewCoord = this._getPrjCenter();
    }
    isRemoved() {
        return !this._containerDOM;
    }
    checkSize() {
        const justStart = ((now() - this._initTime) < 1500) && this.width === 0 || this.height === 0;

        const watched = this._getContainerDomSize(),
            oldHeight = this.height,
            oldWidth = this.width;
        if (watched['width'] === oldWidth && watched['height'] === oldHeight) {
            return this;
        }
        // refresh map's dom position
        computeDomPosition(this._containerDOM);
        const center = this.getCenter();

        if (!this.options['fixCenterOnResize']) {
            // fix northwest's geo coordinate
            const vh = this._getVisualHeight(this.getPitch());
            const nwCP = new Point(0, this.height - vh);
            const nwCoord = this._containerPointToPrj(nwCP);
            this._updateMapSize(watched);
            const vhAfter = this._getVisualHeight(this.getPitch());
            const nwCPAfter = new Point(0, this.height - vhAfter);
            this._setPrjCoordAtContainerPoint(nwCoord, nwCPAfter);
            // when size changed, center is updated but panel's offset remains.
            this._mapViewCoord = this._getPrjCenter();
        } else {
            this._updateMapSize(watched);
        }

        const hided = (watched['width'] === 0 || watched['height'] === 0 || oldWidth === 0 || oldHeight === 0);

        if (justStart || hided) {
            this._eventSilence = true;
            this.setCenter(center);
            delete this._eventSilence;
        }
        /**
         * resize event when map container's size changes
         * @event Map#resize
         * @type {Object}
         * @property {String} type - resize
         * @property {Map} target - map fires the event
         */
        this._fireEvent('resize');

        return this;
    }
}










Map.include({
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