export class DataBroadcaster {
  constructor() {
    this.clients = new Set();
    this.frameCount = 0;
    this.lastStatsTime = Date.now();
    this.bytesSent = 0;
    
    this._outputBuffer = null;
    this._outputView = null;
    this._outputFloatView = null;
    this._lastBufferSize = 0;
    
    this._invalidFrameCount = 0;
  }

  addClient(ws) {
    this.clients.add(ws);
  }

  removeClient(ws) {
    this.clients.delete(ws);
  }

  _ensureBufferSize(uavCount) {
    const requiredSize = 8 + uavCount * 32;
    
    if (this._outputBuffer && this._outputBuffer.byteLength >= requiredSize) {
      return;
    }
    
    const newSize = Math.max(requiredSize, Math.floor(requiredSize * 1.5));
    console.log(`数据广播缓冲区: ${this._lastBufferSize} -> ${newSize} bytes`);
    
    this._outputBuffer = new ArrayBuffer(newSize);
    this._outputView = new DataView(this._outputBuffer);
    this._outputFloatView = new Float32Array(this._outputBuffer);
    this._lastBufferSize = newSize;
  }

  _validateState(stateView) {
    const uavCount = stateView.length / 8;
    let invalidCount = 0;
    
    for (let i = 0; i < uavCount; i++) {
      const offset = i * 8;
      const x = stateView[offset];
      const y = stateView[offset + 1];
      const z = stateView[offset + 2];
      
      if (!isFinite(x) || !isFinite(y) || !isFinite(z) ||
          isNaN(x) || isNaN(y) || isNaN(z)) {
        invalidCount++;
      }
    }
    
    if (invalidCount > 0) {
      this._invalidFrameCount++;
      console.warn(`发现 ${invalidCount} 架无效坐标的无人机，累计无效帧: ${this._invalidFrameCount}`);
      return false;
    }
    
    return true;
  }

  _encodeBinary(stateView) {
    const uavCount = stateView.length / 8;
    
    this._ensureBufferSize(uavCount);
    
    const view = this._outputView;
    const floatView = this._outputFloatView;
    
    view.setUint32(0, uavCount, true);
    view.setUint32(4, Date.now(), true);
    
    const floatOffset = 2;
    
    for (let i = 0; i < stateView.length; i++) {
      floatView[floatOffset + i] = stateView[i];
    }
    
    return {
      buffer: this._outputBuffer,
      byteLength: 8 + uavCount * 32
    };
  }

  broadcast(dataProvider) {
    if (this.clients.size === 0) return;
    
    const stateView = dataProvider();
    
    if (!this._validateState(stateView)) {
      console.warn('跳过无效数据帧');
      return;
    }
    
    const { buffer, byteLength } = this._encodeBinary(stateView);
    
    this.broadcastBinary(buffer.slice(0, byteLength));
    
    this.frameCount++;
    this.bytesSent += byteLength * this.clients.size;
    
    const now = Date.now();
    if (now - this.lastStatsTime >= 5000) {
      const elapsed = (now - this.lastStatsTime) / 1000;
      const fps = this.frameCount / elapsed;
      const mbps = (this.bytesSent * 8 / 1024 / 1024 / elapsed).toFixed(2);
      
      console.log(`[${new Date().toISOString()}] 广播状态: ${fps.toFixed(1)} FPS, ${mbps} Mbps, ${this.clients.size} 客户端`);
      
      this.frameCount = 0;
      this.bytesSent = 0;
      this.lastStatsTime = now;
    }
  }

  broadcastBinary(data) {
    this.clients.forEach((ws) => {
      if (ws.readyState === 1) {
        try {
          ws.send(data, { binary: true });
        } catch (e) {
          console.error('发送失败:', e.message);
        }
      }
    });
  }

  start(rate, dataProvider) {
    const interval = 1000 / rate;
    
    setInterval(() => {
      this.broadcast(dataProvider);
    }, interval);
    
    console.log(`数据广播已启动，频率 ${rate} Hz`);
  }

  getClientCount() {
    return this.clients.size;
  }

  getInvalidFrameCount() {
    return this._invalidFrameCount;
  }
}
