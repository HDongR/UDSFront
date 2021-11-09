class Parser {
  constructor(data) {
      this.dv = new DataView(data);
      this.endian = true;
      this.offset = 0;
  }

  getUint4() {
      const val = this.dv.getUint32(this.offset, this.endian);
      this.offset += 4;
      return val;
  }

  getUint1() {
      const val = this.dv.getUint8(this.offset, this.endian);
      this.offset += 1;
      return val;
  }

  getUint2() {
      const val = this.dv.getUint16(this.offset, this.endian);
      this.offset += 2;
      return val;
  }

  getLenStr() {
      const len = this.getUint1();

      var str = "";
      var val = "";
      for (var i = 0; i < len; i++) {
          val = this.getUint1();
          str += String.fromCharCode(val);
      }
      return {
          len: len,
          str: str,
      };
  }

  getFloat8() {
      const val = this.dv.getFloat64(this.offset, this.endian);
      this.offset += 8;
      return val;
  }

  getFloat4() {
      const val = this.dv.getFloat32(this.offset, this.endian);
      this.offset += 4;
      return val;
  }

  getVersion() {
      const val = `${this.getUint1()}.${this.getUint1()}.${this.getUint1()}.${this.getUint1()}`;
      return val;
  }

  getBox() {
      var minX = this.getFloat8();
      var maxX = this.getFloat8();
      var minY = this.getFloat8();
      var maxY = this.getFloat8();
      var minZ = this.getFloat8();
      var maxZ = this.getFloat8();
      return {
          minX: minX,
          maxX: maxX,
          minY: minY,
          maxY: maxY,
          minZ: minZ,
          maxZ: maxZ
      }
  }

  getVector2df() {
      var x = this.getFloat4();
      var y = this.getFloat4();
      return {
          x: x,
          y: y
      }
  }

  getVector3df() {
      var x = this.getFloat4();
      var y = this.getFloat4();
      var z = this.getFloat4();
      return {
          x: x,
          y: y,
          z: z
      }
  }

  getVector3dd() {
      var x = this.getFloat8();
      var y = this.getFloat8();
      var z = this.getFloat8();
      return {
          x: x,
          y: y,
          z: z
      }
  }

  //http://irrlicht.sourceforge.net/docu/structirr_1_1video_1_1_s3_d_vertex.html
  getCountVert() {
      const count = this.getUint4();
      var vert = [];
      for (var i = 0; i < count; i++) {
          const pos = this.getVector3df();
          const normal = this.getVector3df();
          const uv = this.getVector2df();

          vert.push({
              pos: pos,
              normal: normal,
              uv: uv
          })
      }
      return {
          count: count,
          vert: vert
      };
  }

  getCountIndex() {
      const count = this.getUint4();
      var index = [];
      for (var i = 0; i < count; i++) {
          const val = this.getUint2();
          index.push(val)
      }
      return {
          count: count,
          index: index
      };
  }


  getBox3dd() {
      const min = this.getVector3dd();
      const max = this.getVector3dd();
      return {
          min: min,
          max: max
      }
  }
}