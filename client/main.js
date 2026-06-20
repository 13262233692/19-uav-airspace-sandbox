import './style.css';
import { SceneManager } from './scene-manager.js';
import { UAVRenderer } from './uav-renderer.js';
import { WebSocketClient } from './websocket-client.js';
import { CityBuilder } from './city-builder.js';
import { HUDController } from './hud-controller.js';

class Application {
  constructor() {
    this.sceneManager = null;
    this.uavRenderer = null;
    this.websocketClient = null;
    this.cityBuilder = null;
    this.hud = null;
    this.uavCount = 0;
    this.isInitialized = false;
    
    this._init();
  }

  async _init() {
    try {
      this.hud = new HUDController();
      this.hud.updateLoadingStage('初始化渲染引擎...', 10);
      
      this.sceneManager = new SceneManager();
      this.sceneManager.init();
      
      this.hud.updateLoadingStage('构建城市环境...', 30);
      
      this.cityBuilder = new CityBuilder(this.sceneManager);
      await this.cityBuilder.build();
      
      this.hud.updateLoadingStage('连接数据流服务...', 60);
      
      this.websocketClient = new WebSocketClient('ws://localhost:8080');
      
      this.websocketClient.on('init', (data) => {
        this.uavCount = data.uavCount;
        this.hud.updateUAVCount(this.uavCount);
        
        this.hud.updateLoadingStage('初始化无人机集群渲染器...', 80);
        
        this.uavRenderer = new UAVRenderer(this.sceneManager, this.uavCount);
        this.uavRenderer.init();
        
        this.hud.updateLoadingStage('系统就绪，准备接收数据...', 95);
        
        setTimeout(() => {
          this.hud.hideLoading();
          this.isInitialized = true;
          this._startAnimationLoop();
        }, 500);
      });
      
      this.websocketClient.on('data', (data) => {
        if (this.isInitialized && this.uavRenderer) {
          this.uavRenderer.updateData(data);
          this.hud.updateLatency(data.latency);
          this.hud.updateDataRate(data.byteLength);
        }
      });
      
      this.websocketClient.on('connected', () => {
        this.hud.updateConnectionStatus(true);
      });
      
      this.websocketClient.on('disconnected', () => {
        this.hud.updateConnectionStatus(false);
      });
      
      this.websocketClient.connect();
      
    } catch (error) {
      console.error('初始化失败:', error);
      this.hud.updateLoadingStage('初始化失败: ' + error.message, 100);
    }
  }

  _startAnimationLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      
      const delta = this.sceneManager.update();
      
      if (this.uavRenderer) {
        this.uavRenderer.update(delta);
      }
      
      this.sceneManager.render();
      
      this.hud.updateFPS(this.sceneManager.getFPS());
      this.hud.updateDrawCalls(this.sceneManager.getDrawCalls());
    };
    
    animate();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new Application();
});
