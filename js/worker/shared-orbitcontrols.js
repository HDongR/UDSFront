import * as THREE from '/js/three/build/three.module.js';
import {OrbitControls} from '/js/three/examples/jsm/controls/OrbitControls.js';
import {cvt3} from '/js/util/geoutil.js';

let globalScene;
let globalCamera;

export function addScene(obj){
  globalScene.add(obj);  
}

export function init(data) {   /* eslint-disable-line no-unused-vars */
  const {canvas, inputElement, mapConfig} = data;
  const renderer = new THREE.WebGLRenderer({canvas});

  const scene = new THREE.Scene();

  const mesh = new THREE.Mesh( new THREE.PlaneGeometry( 2000, 2000 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
  mesh.rotation.x = - Math.PI / 2;

  let centerPos = cvt3([mapConfig.center[0], mapConfig.center[1]], 0);
  centerPos = [centerPos.x, centerPos.y, centerPos.z];
  mesh.position.set(centerPos[0], centerPos[1], 0);

  const axesHelper = new THREE.AxesHelper( 5 );
  scene.add( axesHelper );
  scene.add( mesh );

  const grid = new THREE.GridHelper( 200, 40, 0x000000, 0x000000 );
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  scene.add( grid );
   
  grid.position.set(centerPos[0], centerPos[1], 0);



  const fov = 75;
  const aspect = 2; // the canvas default
  const near = 0.1;
  const far = 5000;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  const helper = new THREE.CameraHelper( camera );
  camera.position.z = 40;
  camera.position.set(centerPos[0], centerPos[1], 40);

  globalCamera = camera;

  scene.background = new THREE.Color( 0xcccccc );
  scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );

  const controls = new OrbitControls(camera, inputElement);

  controls.target.set(centerPos[0], centerPos[1], 20);

  controls.update();
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
  }

  controls.enableDamping = false; // an animation loop is required when either damping or auto-rotation are enabled
  controls.dampingFactor = 0.05;

  controls.screenSpacePanning = false;

  // controls.minDistance = 100;
  // controls.maxDistance = 500;

  controls.maxPolarAngle = Math.PI / 3;
  
  globalScene = scene;
  scene.add( helper );
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
    cube.position.y = centerPos[1];

    return cube;
  }

  const cubes = [
    makeInstance(geometry, 0x44aa88, 0),
    makeInstance(geometry, 0x8844aa, -2),
    makeInstance(geometry, 0xaa8844, 2),
  ];

  class PickHelper {
    constructor() {
      this.raycaster = new THREE.Raycaster();
      this.pickedObject = null;
      this.pickedObjectSavedColor = 0;
    }
    pick(normalizedPosition, scene, camera, time) {
      // restore the color if there is a picked object
      if (this.pickedObject) {
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
        this.pickedObjectSavedColor = this.pickedObject.material.emissive.getHex();
        // set its emissive color to flashing red/yellow
        this.pickedObject.material.emissive.setHex((time * 8) % 2 > 1 ? 0xFFFF00 : 0xFF0000);
      }
    }
  }

  const pickPosition = {x: -2, y: -2};
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

    cubes.forEach((cube, ndx) => {
      const speed = 1 + ndx * .1;
      const rot = time * speed;
      cube.rotation.x = rot;
      cube.rotation.y = rot;
    });

    //pickHelper.pick(pickPosition, scene, camera, time);

    renderer.render(scene, camera);

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

  const _euler = new THREE.Euler( 0, 0, 0, 'YXZ' );
  const _vector = new THREE.Vector3();

  const _changeEvent = { type: 'change' };
  const _lockEvent = { type: 'lock' };
  const _unlockEvent = { type: 'unlock' };

  const _PI_2 = Math.PI / 2;
  let minPolarAngle = 0; // radians
  let maxPolarAngle = Math.PI; // radians

  function setPickPosition(event) {
    const pos = getCanvasRelativePosition(event);
    pickPosition.x = (pos.x / inputElement.clientWidth ) *  2 - 1;
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
  }, {passive: false});

  inputElement.addEventListener('touchmove', (event) => {
    setPickPosition(event.touches[0]);
  });

  inputElement.addEventListener('touchend', clearPickPosition);
}

