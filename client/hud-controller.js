export class HUDController {
  constructor() {
    this.fpsElement = document.getElementById('stat-fps');
    this.uavCountElement = document.getElementById('stat-uav-count');
    this.latencyElement = document.getElementById('stat-latency');
    this.dataRateElement = document.getElementById('stat-datarate');
    this.drawCallsElement = document.getElementById('stat-drawcalls');
    
    this.loadingElement = document.getElementById('loading');
    this.loadingProgress = document.getElementById('loading-progress');
    this.loadingStage = document.getElementById('loading-stage');
    
    this.statusIndicator = document.getElementById('status-indicator');
    this.statusText = document.getElementById('status-text');
    
    this.lastDataTime = 0;
    this.bytesReceived = 0;
    this.lastRateUpdate = 0;
    this.currentMbps = 0;
  }

  updateLoadingStage(text, progress) {
    if (this.loadingStage) {
      this.loadingStage.textContent = text;
    }
    if (this.loadingProgress) {
      this.loadingProgress.style.width = progress + '%';
    }
  }

  hideLoading() {
    if (this.loadingElement) {
      this.loadingElement.classList.add('hidden');
    }
  }

  updateFPS(fps) {
    if (this.fpsElement) {
      this.fpsElement.textContent = fps;
      this.fpsElement.className = 'stat-value fps';
      if (fps < 30) {
        this.fpsElement.classList.add('danger');
      } else if (fps < 50) {
        this.fpsElement.classList.add('warn');
      }
    }
  }

  updateUAVCount(count) {
    if (this.uavCountElement) {
      this.uavCountElement.textContent = count.toLocaleString();
    }
  }

  updateLatency(latency) {
    if (this.latencyElement) {
      this.latencyElement.textContent = latency.toFixed(0);
      this.latencyElement.className = 'stat-value';
      if (latency > 100) {
        this.latencyElement.classList.add('danger');
      } else if (latency > 50) {
        this.latencyElement.classList.add('warn');
      }
    }
  }

  updateDataRate(byteLength) {
    const now = Date.now();
    this.bytesReceived += byteLength;
    
    if (now - this.lastRateUpdate >= 1000) {
      const elapsed = (now - this.lastRateUpdate) / 1000;
      this.currentMbps = (this.bytesReceived * 8 / 1024 / 1024 / elapsed).toFixed(2);
      
      if (this.dataRateElement) {
        this.dataRateElement.textContent = this.currentMbps;
      }
      
      this.bytesReceived = 0;
      this.lastRateUpdate = now;
    }
  }

  updateDrawCalls(count) {
    if (this.drawCallsElement) {
      this.drawCallsElement.textContent = count;
    }
  }

  updateConnectionStatus(connected) {
    if (this.statusIndicator) {
      if (connected) {
        this.statusIndicator.classList.add('connected');
      } else {
        this.statusIndicator.classList.remove('connected');
      }
    }
    
    if (this.statusText) {
      this.statusText.textContent = connected ? '数据流连接正常' : '连接断开，正在重连...';
    }
  }
}
