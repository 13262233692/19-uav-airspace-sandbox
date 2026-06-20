export class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.eventHandlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.lastDataTime = 0;
  }

  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  _emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';
      
      this.ws.onopen = () => {
        console.log('WebSocket 连接已建立');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this._emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        this._handleMessage(event);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket 连接已关闭');
        this.isConnected = false;
        this._emit('disconnected');
        this._attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket 错误:', error);
      };
      
    } catch (error) {
      console.error('连接失败:', error);
      this._attemptReconnect();
    }
  }

  _handleMessage(event) {
    const data = event.data;
    
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'init') {
          this._emit('init', parsed);
        }
      } catch (e) {
        console.error('解析 JSON 消息失败:', e);
      }
    } else if (data instanceof ArrayBuffer) {
      this._handleBinaryData(data);
    }
  }

  _handleBinaryData(buffer) {
    const now = Date.now();
    const view = new DataView(buffer);
    const floatView = new Float32Array(buffer);
    
    const uavCount = view.getUint32(0, true);
    const timestamp = view.getUint32(4, true);
    const latency = now - timestamp;
    
    const states = new Float32Array(buffer, 8);
    
    this._emit('data', {
      uavCount,
      timestamp,
      latency,
      states,
      byteLength: buffer.byteLength,
      receivedAt: now
    });
    
    this.lastDataTime = now;
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('已达到最大重连次数，放弃重连');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})，${delay}ms 后...`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.isConnected && this.ws && this.ws.readyState === 1;
  }
}
