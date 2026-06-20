export class DataBroadcaster {
  constructor() {
    this.clients = new Set();
    this.frameCount = 0;
    this.lastStatsTime = Date.now();
    this.bytesSent = 0;
  }

  addClient(ws) {
    this.clients.add(ws);
  }

  removeClient(ws) {
    this.clients.delete(ws);
  }

  _encodeBinary(stateView) {
    const uavCount = stateView.length / 8;
    const buffer = new ArrayBuffer(8 + uavCount * 32);
    const view = new DataView(buffer);
    const floatView = new Float32Array(buffer);
    
    view.setUint32(0, uavCount, true);
    view.setUint32(4, Date.now(), true);
    
    const floatOffset = 2;
    for (let i = 0; i < stateView.length; i++) {
      floatView[floatOffset + i] = stateView[i];
    }
    
    return buffer;
  }

  broadcast(dataProvider) {
    if (this.clients.size === 0) return;
    
    const stateView = dataProvider();
    const binaryData = this._encodeBinary(stateView);
    
    this.broadcastBinary(binaryData);
    
    this.frameCount++;
    this.bytesSent += binaryData.byteLength * this.clients.size;
    
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
}
