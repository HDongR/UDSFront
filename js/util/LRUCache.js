export default class LRUCache {
    constructor(max, onRemove) {
      this.max = max;
      this.onRemove = onRemove;
      this.reset();
    } 
    
    reset() {
      for (var key in this.data) {
        this.onRemove(this.data[key]);
      }

      this.data = {};
      this.order = [];
      return this;
    };

    clear() {
      this.reset();
      delete this.onRemove;
    };

    add(key, data) {
      if (this.has(key)) {
        this.order.splice(this.order.indexOf(key), 1);
        this.data[key] = data;
        this.order.push(key);
      } else {
        this.data[key] = data;
        this.order.push(key);

        if (this.order.length > this.max) {
          var removedData = this.getAndRemove(this.order[0]);
          if (removedData) this.onRemove(removedData);
        }
      }

      return this;
    };

    has(key) {
      return key in this.data;
    };

    keys() {
      return this.order;
    };

    getAndRemove(key) {
      if (!this.has(key)) {
        return null;
      }

      var data = this.data[key];
      delete this.data[key];
      this.order.splice(this.order.indexOf(key), 1);
      return data;
    };

    get(key) {
      if (!this.has(key)) {
        return null;
      }

      var data = this.data[key];
      return data;
    };

    remove(key) {
      if (!this.has(key)) {
        return this;
      }

      var data = this.data[key];
      delete this.data[key];
      this.onRemove(data);
      this.order.splice(this.order.indexOf(key), 1);
      return this;
    };

    setMaxSize(max) {
      this.max = max;

      while (this.order.length > this.max) {
        var removedData = this.getAndRemove(this.order[0]);
        if (removedData) this.onRemove(removedData);
      }

      return this;
    };
}