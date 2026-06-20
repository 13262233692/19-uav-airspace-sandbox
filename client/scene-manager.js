import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = new THREE.Clock();
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsUpdate = 0;
    this.drawCalls = 0;
  }

  init() {
    const container = document.getElementById('canvas-container');
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f);
    this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.0002);
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      10000
    );
    this.camera.position.set(800, 600, 800);
    
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    
    container.appendChild(this.renderer.domElement);
    
    this._setupControls();
    this._setupLighting();
    this._setupEventListeners();
    
    return this;
  }

  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 3000;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 50, 0);
  }

  _setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1a1a2e, 0.6);
    this.scene.add(hemiLight);
    
    const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(500, 800, 500);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 3000;
    directionalLight.shadow.camera.left = -1500;
    directionalLight.shadow.camera.right = 1500;
    directionalLight.shadow.camera.top = 1500;
    directionalLight.shadow.camera.bottom = -1500;
    this.scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0x6080ff, 0.3);
    fillLight.position.set(-500, 300, -500);
    this.scene.add(fillLight);
  }

  _setupEventListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  update() {
    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    
    this.controls.update();
    
    this.frameCount++;
    if (elapsed - this.lastFpsUpdate >= 0.5) {
      this.fps = Math.round(this.frameCount / (elapsed - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = elapsed;
    }
    
    this.drawCalls = this.renderer.info.render.calls;
    
    return delta;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  getScene() {
    return this.scene;
  }

  getCamera() {
    return this.camera;
  }

  getRenderer() {
    return this.renderer;
  }

  getFPS() {
    return this.fps;
  }

  getDrawCalls() {
    return this.drawCalls;
  }
}
