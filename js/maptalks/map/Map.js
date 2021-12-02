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
        this._containerDOM = inputElement;

        //this.options = options;
        this.projection = new Projection();
        this.spatialReference = new SpatialReference({'projection':this.projection});
        this._spatialReference = this.spatialReference;
        //this.zoom = options.zoom;
        this.maxZoom = options.maxZoom;
        this.minZoom = options.minZoom;

        this._Load();

        return this;
    }

    _Load() {
        // this._resetMapStatus();
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

    _callOnLoadHooks() {
        const proto = Map.prototype;
        if (!proto._onLoadHooks) {
            return;
        }
        for (let i = 0, l = proto._onLoadHooks.length; i < l; i++) {
            proto._onLoadHooks[i].call(this);
        }
    }

    getContainer(){
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
}
Map.mergeOptions(options);