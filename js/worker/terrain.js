import * as THREE from '/js/three/build/three.module.js';
import Parser from "/js/util/bufferParser_es6.js";
import {addScene} from '/js/worker/shared-orbitcontrols.js';
import {cvt3} from '/js/util/geoutil.js';


var loader = new THREE.ImageBitmapLoader();

export function _createTerrain() {
    loadTerrain();
}

var loadTerrain = async function () {
    //let preloadData = { tile_zoom: 15, startpoint: "129.149205,35.151244", endpoint: "129.157228,35.159228" }; //동백섬
    let preloadData = { tile_zoom: 10, startpoint: "128.755734,34.978977", endpoint: "129.314373,35.396265" }; //부산시
    let startLon = preloadData.startpoint.split(',')[0];
    let startLat = preloadData.startpoint.split(',')[1];
    let endLon = preloadData.endpoint.split(',')[0];
    let endLat = preloadData.endpoint.split(',')[1];

    let zResol = 152.8740565703525;
    //let zResol = 76.43702828517624;
    var coordMin = { x: Number(startLon), y: Number(startLat) };
    var coordMax = { x: Number(endLon), y: Number(endLat) };
    //var coordMin = new maptalks.Coordinate(129.148876, 35.151681);
    //var coordMax = new maptalks.Coordinate(129.155753, 35.156076);
    //var proj = proj4(proj4.defs('EPSG:4326'), proj4.defs('EPSG:3857'));
    let level = Number(preloadData.tile_zoom);
    let unit = 360 / (Math.pow(2, level) * 10);
    let minIdx = Math.floor((coordMin.x + 180) / unit);
    let minIdy = Math.floor((coordMin.y + 90) / unit);
    let maxIdx = Math.floor((coordMax.x + 180) / unit);
    let maxIdy = Math.floor((coordMax.y + 90) / unit);
    //console.log(minIdx, minIdy, maxIdx, maxIdy);
    //console.log(tileGrid.zoom, coordMin, coordMax);

    var idxIdyList = Array.from(Array((maxIdx - minIdx + 1) * (maxIdy - minIdy + 1)), () => new Array(2));
    var index = 0;
    for (var i=minIdx ; i<=maxIdx ; i++) {
        for (var j=minIdy ; j<=maxIdy; j++) {
          idxIdyList[index][0] = i+"";
          idxIdyList[index][1] = j+"";
          index++;
        }
      }     
    
      let turmX = maxIdx - minIdx + 1;
      let turmY = maxIdy - minIdy + 1;
    
      for (var i=0 ; i<idxIdyList.length ; i++) {
        const IDX = idxIdyList[i][0];
        const IDY = idxIdyList[i][1];
        const layer = "dem";
        let address = "https://xdworld.vworld.kr/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + layer + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
        
        fetch(address).then(r=>{
          const size = r.headers.get("content-length");
          if(Number(size) >= 16900){
            r.arrayBuffer().then(function(buffer) {
              //var byteArray = new Uint8Array(buffer);
              let p = new Parser(buffer);
    
              let x = unit * (IDX - (Math.pow(2, level-1)*10));
              let y = unit * (IDY - (Math.pow(2, level-2)*10));
              let pdata = [];
              let sData = null;
              let eData = null;
              let center = [];
              for(var yy=64; yy>=0; yy--){ 
                for(var xx=0; xx<65; xx++){
                  let xDegree = x+(unit/64)*xx;
                  let yDegree = y+(unit/64)*yy;
                  let height = p.getFloat4();
                  pdata.push([xDegree, yDegree, height]);
                  
                  if(yy == 0 && xx == 64){
                    eData = [xDegree, yDegree];
                  }else if(yy == 64 && xx == 0){
                    sData = [xDegree, yDegree];
                  }else if(yy == 32 && xx == 32){
                    center = [xDegree, yDegree];
                  }
                }
              }
              var geometry = new THREE.PlaneGeometry(1, 1, 64, 64);
              
              let centerConv = cvt3(center, 0);
              for (var i = 0, l = geometry.attributes.position.count; i < l; i++) {
                  const z = pdata[i][2]/zResol;//.threeLayer.distanceToVector3(pdata[i][2], pdata[i][2]).x;
                  const v = cvt3([pdata[i][0],pdata[i][1]], z);
                  geometry.attributes.position.setXYZ(i, v.x - centerConv.x, v.z, v.y - centerConv.y);
              }
            
              var material = new THREE.MeshBasicMaterial({/*color: 'hsl(0,100%,50%)',*/});
              material.opacity = 1;
              material.wireframe = false;
              var address = "https://xdworld.vworld.kr/XDServer/requestLayerNode?APIKey=3529523D-2DBA-36B8-98F5-357E880AC0EE&Layer=" + "tile" + "&Level=" + level + "&IDX=" + IDX + "&IDY=" + IDY;
              
              loader.setOptions( { imageOrientation: 'flipY' } );
              loader.load( address, function ( imageBitmap ) {
                var tx = new THREE.CanvasTexture( imageBitmap );
                material.map = tx;
                material.side = THREE.DoubleSide;
                material.visible = true;
                material.needsUpdate = true;
              });
              
            
              
              var plane = new THREE.Mesh(geometry, material);
              plane.position.set(centerConv.x, 0, centerConv.y);
              material.visible = false;
              
              addScene(plane);
               
 
            });//arraybuffer
          }//16900
        }); //fetch
      }//for
}