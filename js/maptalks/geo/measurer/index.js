/** @namespace measurer */

import { hasOwn } from '../../core/util/index.js';
import Identity from './Identity.js';
import { WGS84Sphere, BaiduSphere } from './Sphere.js';

export { Identity };
export * from './Sphere.js';


export default class Measurer {
    registerMeasurer(Identity) {

    }

    registerMeasurer(WGS84Sphere){

    }
}