import * as THREE from '/js/three/build/three.module.js';
import {cvt3, calcMatrix} from '/js/util/geoutil.js';
import SpatialReference from '/js/map/spatial-reference/SpatialReference.js';
import Projection from '/js/geo/projection/Projection.EPSG3857.js';
import Maptalks from '/js/maptalks/map/Map.js';
import '/js/maptalks/map/handler/Map.ScrollWheelZoom.js';
import '/js/maptalks/map/handler/Map.Touch.js';
 
import '/js/maptalks/map/Map.Pan.js'; 
import '/js/maptalks/map/Map.Zoom.js';
import '/js/maptalks/map/Map.Camera.js';

import '/js/maptalks/renderer/map/MapCanvasRenderer.js';


let globalScene;
let globalCamera;
export let map = {};

export function addScene(obj) {
  globalScene.add(obj);
}

function config(mapConfig){
  let projection = new Projection();
  let spatialReference = new SpatialReference({projection});
  map.spatialReference = spatialReference;
  console.log(spatialReference);
  map.zoom = mapConfig.zoom;
  map.maxZoom = mapConfig.maxZoom;
  map.minZoom = mapConfig.minZoom;
}

export function init(data) {   /* eslint-disable-line no-unused-vars */

  const {canvas, inputElement, mapConfig} = data;
  config(mapConfig);
  let maptalks = new Maptalks(canvas, inputElement, mapConfig);
  
  console.log(data);
  const renderer = new THREE.WebGLRenderer({ canvas });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcccccc);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.00002);
  globalScene = scene;

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
  let centerPos = cvt3([mapConfig.center[0], mapConfig.center[1]], 0);
  centerPos = [centerPos.x, centerPos.y, centerPos.z];
  mesh.position.set(centerPos[0], 0, centerPos[1]);
  mesh.rotation.x = - Math.PI / 2;
  scene.add(mesh);



  const axesHelper = new THREE.AxesHelper(50000);
  axesHelper.position.set(centerPos[0], 0, centerPos[1]);
  scene.add(axesHelper);


  const grid = new THREE.GridHelper(200, 40, 0x000000, 0x000000);
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  scene.add(grid);

  grid.position.set(centerPos[0], 0, centerPos[1]);



  const fov = 75;
  const aspect = 2; // the canvas default
  const near = 0.1;
  const far = 500000;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  globalCamera = camera;
  camera.position.set(centerPos[0], 20, centerPos[1] + 100);

  const helper = new THREE.CameraHelper(camera);
  scene.add(helper);

  camera.lookAt(centerPos[0], 0, centerPos[1]);





  // const controls = new OrbitControls(camera, inputElement); 
  // controls.addEventListener('change', (e) => {
  //   //console.log('change', e.target);
  // });
  // controls.addEventListener('start', (e) => {
  //   //console.log('start', e.target);
  // });
  let matrix4 = new THREE.Matrix4();
  function syncCamera(){
    if(camera){
      const map = maptalks.getMap();
      camera.matrix.elements = map.cameraWorldMatrix;
      camera.projectionMatrix.elements = map.projMatrix;
      //https://github.com/mrdoob/three.js/commit/d52afdd2ceafd690ac9e20917d0c968ff2fa7661
      //if (this.matrix4.invert) {
          camera.projectionMatrixInverse.elements = matrix4.copy(camera.projectionMatrix).invert().elements;
      //} else {
      //   camera.projectionMatrixInverse.elements = this.matrix4.getInverse(camera.projectionMatrix).elements;
      //}
    }
  }

  function getResolution(zoom){
    let _resolutions = map.spatialReference._resolutions;
    let z = zoom | 0;

    if (z < 0) {
      z = 0;
    } else if (z > _resolutions.length - 1) {
      z = _resolutions.length - 1;
    }

    let res = _resolutions[z];

    if (z !== zoom && zoom > 0 && z < _resolutions.length - 1) {
      let next = _resolutions[z + 1];
      return res + (next - res) * (zoom - z);
    }

    return res;
  }

  function getZoomForScale(scale, zoom){
    let res = getResolution(zoom);
    let targetRes = res / scale;
    let scaleZoom = getZoomFromRes(targetRes);
    return scaleZoom;
  }

  function getZoomFromRes(res){
    let resolutions = map.spatialReference._resolutions;
    let minRes = getResolution(map.minZoom);
    let maxRes = getResolution(map.maxZoom);

    if (minRes <= maxRes) {
      if (res <= minRes) {
        return map.minZoom;
      } else if (res >= maxRes) {
        return map.maxZoom;
      }
    } else if (res >= minRes) {
      return map.minZoom;
    } else if (res <= maxRes) {
      return map.maxZoom;
    }

    var l = resolutions.length;

    for (var i = 0; i < l - 1; i++) {
      if (!resolutions[i]) {
        continue;
      }

      var gap = resolutions[i + 1] - resolutions[i];
      var test = res - resolutions[i];

      if (Math.sign(gap) === Math.sign(test) && Math.abs(gap) >= Math.abs(test)) {
        return i + test / gap;
      }
    }

    return l - 1;
  }

  // controls.addEventListener('end', (e) => {
  //   let scale = e.scale;
  //   if (scale > 0 && scale !== 0) {
  //     scale = 1 / scale;
  //   }
  //   let zoom = camera.zoom;
  //   let targetZoom = getZoomForScale(scale, zoom);
  //   // if(e.scale > 1){
  //   //   --camera.zoom;
  //   // }else{
  //   //   ++camera.zoom;
  //   // }
  //   camera.zoom = targetZoom;
  //   console.log(e.scale, targetZoom, camera.position);
  //   camera.position.y = 2.598379508192147;
  //   //console.log('end', e.scale, camera.zoom);
  // });

  // controls.zoomSpeed = 5.0;
  // controls.target.set(centerPos[0], 0, centerPos[1]);

  // controls.update();
  // controls.mouseButtons = {
  //   LEFT: THREE.MOUSE.PAN,
  //   MIDDLE: THREE.MOUSE.DOLLY,
  //   RIGHT: THREE.MOUSE.ROTATE
  // }
  // controls.enableDamping = false; // an animation loop is required when either damping or auto-rotation are enabled
  // //controls.dampingFactor = 0.05;
  // controls.enablePan = true;
  // controls.screenSpacePanning = false;
  // controls.panSpeed = 1;
  // controls.minDistance = 1.5;
  // controls.maxDistance = 500;
  // controls.maxPolarAngle = Math.PI / 2;
  // controls.minZoom = map.minZoom; 
  // controls.maxZoom = map.maxZoom;

  //helper.position.set(centerPos[0], centerPos[1], 0);
  {
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(-1, 2, 4);
    scene.add(light);
  }

  const boxWidth = 1;
  const boxHeight = 1;
  const boxDepth = 1;
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

  function makeInstance(geometry, color, x) {
    const material = new THREE.MeshPhongMaterial({
      color,
    });

    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    cube.position.x = x;
    cube.position.x = centerPos[0] + x;
    cube.position.z = centerPos[1] + x;
    cube.position.y = x;

    return cube;
  }

  const cubes = [
    makeInstance(geometry, 0xff0000, -2),
    makeInstance(geometry, 0x00ff00, 0),
    makeInstance(geometry, 0x0000ff, 2),
  ];

  class PickHelper {
    constructor() {
      this.raycaster = new THREE.Raycaster();
      this.pickedObject = null;
      this.pickedObjectSavedColor = 0;
    }
    pick(normalizedPosition, scene, camera, time) {
      // restore the color if there is a picked object
      if (this.pickedObject && this.pickedObject.material.emissive) {
        this.pickedObject.material.emissive.setHex(this.pickedObjectSavedColor);
        this.pickedObject = undefined;
      }

      // cast a ray through the frustum
      this.raycaster.setFromCamera(normalizedPosition, camera);
      // get the list of objects the ray intersected
      const intersectedObjects = this.raycaster.intersectObjects(scene.children);
      if (intersectedObjects.length) {
        // pick the first object. It's the closest one
        this.pickedObject = intersectedObjects[0].object;
        // save its color
        if(this.pickedObject.material.emissive){
          this.pickedObjectSavedColor = this.pickedObject.material.emissive.getHex() ;
          // set its emissive color to flashing red/yellow
          this.pickedObject.material.emissive.setHex((time * 8) % 2 > 1 ? 0xFFFF00 : 0xFF0000);
        }
      }
    }
  }

  const pickPosition = { x: -2, y: -2 };
  const pickHelper = new PickHelper();
  clearPickPosition();

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = inputElement.clientWidth;
    const height = inputElement.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  function render(time) {
    time *= 0.001;

    if (resizeRendererToDisplaySize(renderer)) {
      camera.aspect = inputElement.clientWidth / inputElement.clientHeight;
      camera.updateProjectionMatrix();
    }
    //console.log(camera.zoom);

    cubes.forEach((cube, ndx) => {
      const speed = 1 + ndx * .1;
      const rot = time * speed;
      cube.rotation.x = rot;
      cube.rotation.y = rot;
    });

    //pickHelper.pick(pickPosition, scene, camera, time);

    renderer.render(scene, camera);
    //console.log(controls);
    //camera.rotation.x =  Math.PI / 2;
    // camera.projectionMatrix.elements = [
    //   1.5,0,0,0,
    //   0,3,0,0,
    //   0,0,-1,-1,
    //   0, 0, -350,1];
    //camera.projectionMatrixInverse.copy(renderer.matrix4).invert();
    //console.log(camera.aspect, camera.far, camera.fov, camera.matrix, camera.matrixWorld, camera.matrixWorldInverse, camera.near, camera.position, camera.projectionMatrix, camera.projectionMatrixInverse, camera.quaternion, camera.rotation);

    // console.log('camera matrix m', camera.matrix);
    // console.log('camera projection m', camera.projectionMatrix);
    // console.log('camera projectionInverse m', camera.projectionMatrixInverse);
    // console.log('camera matrixWorld m', camera.matrixWorld);
    // console.log('camera matrixWorldInverse m', camera.matrixWorldInverse);
    //console.log(controls);

    syncCamera();
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  function getCanvasRelativePosition(event) {
    const rect = inputElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const _vector = new THREE.Vector3();

  const _changeEvent = { type: 'change' };
  const _lockEvent = { type: 'lock' };
  const _unlockEvent = { type: 'unlock' };

  const _PI_2 = Math.PI / 2;
  let minPolarAngle = 0; // radians
  let maxPolarAngle = Math.PI; // radians

  function setPickPosition(event) {
    const pos = getCanvasRelativePosition(event);
    pickPosition.x = (pos.x / inputElement.clientWidth) * 2 - 1;
    pickPosition.y = (pos.y / inputElement.clientHeight) * -2 + 1;  // note we flip Y


    // const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    // const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    // _euler.setFromQuaternion( globalCamera.quaternion );

    // _euler.y -= movementX * 0.002;
    // _euler.x -= movementY * 0.002;

    // _euler.x = Math.max( _PI_2 - maxPolarAngle, Math.min( _PI_2 - minPolarAngle, _euler.x ) );
    // globalCamera.quaternion.setFromEuler( _euler );
  }

  function clearPickPosition() {
    // unlike the mouse which always has a position
    // if the user stops touching the screen we want
    // to stop picking. For now we just pick a value
    // unlikely to pick something
    pickPosition.x = -100000;
    pickPosition.y = -100000;
  }

  inputElement.addEventListener('mousemove', setPickPosition);
  inputElement.addEventListener('mouseout', clearPickPosition);
  inputElement.addEventListener('mouseleave', clearPickPosition);

  inputElement.addEventListener('touchstart', (event) => {
    // prevent the window from scrolling
    event.preventDefault();
    setPickPosition(event.touches[0]);
  }, { passive: false });

  inputElement.addEventListener('touchmove', (event) => {
    setPickPosition(event.touches[0]);
  });

  inputElement.addEventListener('touchend', clearPickPosition);
}

