import * as THREE from 'three';
import { UAVVertexShader, UAVFragmentShader } from './uav-shaders.js';

const MISSION_COLORS = [
  new THREE.Color(0x4ade80),
  new THREE.Color(0x60a5fa),
  new THREE.Color(0xfbbf24),
  new THREE.Color(0xf87171),
  new THREE.Color(0xa78bfa),
  new THREE.Color(0xf472b6)
];

const POOL_GROW_FACTOR = 1.2;
const MIN_POOL_SIZE = 1000;

export class UAVRenderer {
  constructor(sceneManager, initialCount) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.getScene();
    this.renderer = sceneManager.getRenderer();
    
    this.count = initialCount;
    this.poolSize = Math.max(initialCount, MIN_POOL_SIZE);
    this.activeCount = initialCount;
    
    this.uavMesh = null;
    this.material = null;
    
    this.missionTypeAttribute = null;
    this.speedAttribute = null;
    this.uavIdAttribute = null;
    
    this.positions = null;
    this.headings = null;
    this.speeds = null;
    this.missionTypes = null;
    this.velocities = null;
    
    this.freeSlots = [];
    this.activeSlots = new Set();
    
    this.time = 0;
    this.rotorSpeed = 25.0;
    
    this._dummy = new THREE.Object3D();
    this._quaternion = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._matrix = new THREE.Matrix4();
    
    this.dataReady = false;
    this.pendingData = null;
    
    this._glContextLost = false;
    this._restorationAttempts = 0;
    this._maxRestorationAttempts = 5;
    
    this._setupContextLossHandlers();
  }

  _setupContextLossHandlers() {
    const canvas = this.renderer.domElement;
    
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this._onContextLost(event);
    }, false);
    
    canvas.addEventListener('webglcontextrestored', (event) => {
      this._onContextRestored(event);
    }, false);
  }

  _onContextLost(event) {
    console.warn('WebGL 上下文丢失，准备恢复...', event);
    this._glContextLost = true;
    
    if (this._contextLostTimeout) {
      clearTimeout(this._contextLostTimeout);
    }
    
    this._contextLostTimeout = setTimeout(() => {
      if (this._restorationAttempts < this._maxRestorationAttempts) {
        console.log(`尝试恢复 WebGL 上下文 (第 ${this._restorationAttempts + 1} 次)...`);
        this._restorationAttempts++;
        this._tryRestoreContext();
      } else {
        console.error('WebGL 上下文恢复失败，已达到最大重试次数');
      }
    }, 1000);
  }

  _onContextRestored(event) {
    console.log('WebGL 上下文已恢复，重建资源...', event);
    this._glContextLost = false;
    this._restorationAttempts = 0;
    
    this._rebuildRenderResources();
  }

  _tryRestoreContext() {
    try {
      const gl = this.renderer.getContext();
      if (gl && gl.getExtension('WEBGL_lose_context')) {
        gl.getExtension('WEBGL_lose_context').restoreContext();
      }
    } catch (e) {
      console.warn('尝试恢复上下文失败:', e.message);
    }
  }

  _rebuildRenderResources() {
    try {
      if (this.uavMesh) {
        this.scene.remove(this.uavMesh);
        this.uavMesh.geometry.dispose();
        this.uavMesh.material.dispose();
        this.uavMesh = null;
      }
      
      if (this.bodyGeometry) {
        this.bodyGeometry.dispose();
        this.bodyGeometry = null;
      }
      
      if (this.material) {
        this.material.dispose();
        this.material = null;
      }
      
      this._createUAVGeometry();
      this._createMaterial();
      this._createInstancedMesh();
      this._setupInstanceAttributes();
      this._restoreInstanceData();
      
      this.scene.add(this.uavMesh);
      
      console.log('渲染资源重建完成');
    } catch (e) {
      console.error('重建渲染资源失败:', e);
    }
  }

  _restoreInstanceData() {
    if (!this.positions) return;
    
    for (let i = 0; i < this.activeCount; i++) {
      this._updateInstanceMatrix(i);
    }
    
    this.uavMesh.instanceMatrix.needsUpdate = true;
    this._updateInstanceAttributes();
  }

  init() {
    this._createUAVGeometry();
    this._createMaterial();
    this._createInstancedMesh();
    this._initializeBuffers();
    this._setupInstanceAttributes();
    this._initializeFreeSlots();
    
    this.scene.add(this.uavMesh);
    
    console.log(`无人机渲染器已初始化，实例数量: ${this.count}`);
    console.log(`对象池大小: ${this.poolSize}`);
    console.log(`绘制调用: 1 (InstancedMesh)`);
    
    return this;
  }

  _createUAVGeometry() {
    const mergedGeometry = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const indices = [];
    let indexOffset = 0;
    
    const bodyGeometry = new THREE.CylinderGeometry(0.8, 1.2, 2.5, 8);
    this._mergeGeometry(bodyGeometry, positions, normals, indices, indexOffset);
    indexOffset += bodyGeometry.attributes.position.count;
    bodyGeometry.dispose();
    
    const topGeometry = new THREE.ConeGeometry(1.0, 1.5, 8);
    topGeometry.translate(0, 2, 0);
    this._mergeGeometry(topGeometry, positions, normals, indices, indexOffset);
    indexOffset += topGeometry.attributes.position.count;
    topGeometry.dispose();
    
    const armGeometry1 = new THREE.CylinderGeometry(0.15, 0.15, 5, 6);
    armGeometry1.rotation.z = Math.PI / 2;
    armGeometry1.translate(0, 0.5, 0);
    this._mergeGeometry(armGeometry1, positions, normals, indices, indexOffset);
    indexOffset += armGeometry1.attributes.position.count;
    armGeometry1.dispose();
    
    const armGeometry2 = new THREE.CylinderGeometry(0.15, 0.15, 5, 6);
    armGeometry2.rotation.x = Math.PI / 2;
    armGeometry2.translate(0, 0.5, 0);
    this._mergeGeometry(armGeometry2, positions, normals, indices, indexOffset);
    indexOffset += armGeometry2.attributes.position.count;
    armGeometry2.dispose();
    
    const rotorHubGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
    const rotorPositions = [
      { x: 2.5, z: 0 },
      { x: -2.5, z: 0 },
      { x: 0, z: 2.5 },
      { x: 0, z: -2.5 }
    ];
    
    rotorPositions.forEach(pos => {
      const hub = rotorHubGeometry.clone();
      hub.translate(pos.x, 2.1, pos.z);
      this._mergeGeometry(hub, positions, normals, indices, indexOffset);
      indexOffset += hub.attributes.position.count;
      hub.dispose();
    });
    
    const rotorBladeGeometry = new THREE.BoxGeometry(3.5, 0.05, 0.3);
    
    rotorPositions.forEach(pos => {
      const blade = rotorBladeGeometry.clone();
      blade.translate(pos.x, 2.2, pos.z);
      this._mergeGeometry(blade, positions, normals, indices, indexOffset);
      indexOffset += blade.attributes.position.count;
      blade.dispose();
    });
    
    const landingGearGeometry = new THREE.CylinderGeometry(0.1, 0.15, 1.5, 6);
    const landingPositions = [
      { x: 0.8, z: 0.8 },
      { x: -0.8, z: 0.8 },
      { x: 0.8, z: -0.8 },
      { x: -0.8, z: -0.8 }
    ];
    
    landingPositions.forEach(pos => {
      const gear = landingGearGeometry.clone();
      gear.translate(pos.x, -1.5, pos.z);
      this._mergeGeometry(gear, positions, normals, indices, indexOffset);
      indexOffset += gear.attributes.position.count;
      gear.dispose();
    });
    
    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    mergedGeometry.setIndex(indices);
    
    this.bodyGeometry = mergedGeometry;
  }

  _mergeGeometry(geometry, positions, normals, indices, indexOffset) {
    const pos = geometry.attributes.position;
    const nor = geometry.attributes.normal;
    const idx = geometry.index;
    
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
    }
    
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + indexOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        indices.push(i + indexOffset, i + 1 + indexOffset, i + 2 + indexOffset);
      }
    }
  }

  _createMaterial() {
    const missionColorsArray = [];
    MISSION_COLORS.forEach(color => {
      missionColorsArray.push(color.r, color.g, color.b);
    });
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: UAVVertexShader,
      fragmentShader: UAVFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uRotorSpeed: { value: this.rotorSpeed },
        uMissionColors: { value: missionColorsArray }
      },
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
      depthTest: true
    });
  }

  _createInstancedMesh() {
    this.uavMesh = new THREE.InstancedMesh(
      this.bodyGeometry,
      this.material,
      this.poolSize
    );
    
    this.uavMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.uavMesh.frustumCulled = false;
    this.uavMesh.castShadow = true;
    this.uavMesh.receiveShadow = false;
    this.uavMesh.count = this.activeCount;
  }

  _setupInstanceAttributes() {
    const geometry = this.uavMesh.geometry;
    
    this.missionTypeAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(this.poolSize),
      1
    );
    this.missionTypeAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aMissionType', this.missionTypeAttribute);
    
    this.speedAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(this.poolSize),
      1
    );
    this.speedAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aSpeed', this.speedAttribute);
    
    this.uavIdAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(this.poolSize),
      1
    );
    this.uavIdAttribute.setUsage(THREE.StaticDrawUsage);
    geometry.setAttribute('aUAVId', this.uavIdAttribute);
    
    for (let i = 0; i < this.poolSize; i++) {
      this.uavIdAttribute.setX(i, i);
    }
    this.uavIdAttribute.needsUpdate = true;
  }

  _initializeBuffers() {
    this.positions = new Float32Array(this.poolSize * 3);
    this.headings = new Float32Array(this.poolSize);
    this.speeds = new Float32Array(this.poolSize);
    this.missionTypes = new Float32Array(this.poolSize);
    this.velocities = new Float32Array(this.poolSize * 2);
    
    for (let i = 0; i < this.activeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 1800;
      
      this.positions[i * 3]     = Math.cos(angle) * distance;
      this.positions[i * 3 + 1] = 50 + Math.random() * 150;
      this.positions[i * 3 + 2] = Math.sin(angle) * distance;
      
      this.headings[i] = Math.random() * Math.PI * 2;
      this.speeds[i] = 15 + Math.random() * 20;
      this.missionTypes[i] = Math.floor(Math.random() * 6);
      this.velocities[i * 2] = 0;
      this.velocities[i * 2 + 1] = 0;
      
      this._updateInstanceMatrix(i);
    }
    
    this.uavMesh.instanceMatrix.needsUpdate = true;
  }

  _initializeFreeSlots() {
    this.freeSlots = [];
    this.activeSlots = new Set();
    
    for (let i = 0; i < this.activeCount; i++) {
      this.activeSlots.add(i);
    }
    
    for (let i = this.activeCount; i < this.poolSize; i++) {
      this.freeSlots.push(i);
    }
  }

  _growPool(newSize) {
    if (newSize <= this.poolSize) return;
    
    const oldPoolSize = this.poolSize;
    this.poolSize = Math.ceil(newSize * POOL_GROW_FACTOR);
    
    console.log(`扩展实例池: ${oldPoolSize} -> ${this.poolSize}`);
    
    const newPositions = new Float32Array(this.poolSize * 3);
    newPositions.set(this.positions);
    
    const newHeadings = new Float32Array(this.poolSize);
    newHeadings.set(this.headings);
    
    const newSpeeds = new Float32Array(this.poolSize);
    newSpeeds.set(this.speeds);
    
    const newMissionTypes = new Float32Array(this.poolSize);
    newMissionTypes.set(this.missionTypes);
    
    const newVelocities = new Float32Array(this.poolSize * 2);
    newVelocities.set(this.velocities);
    
    this.positions = newPositions;
    this.headings = newHeadings;
    this.speeds = newSpeeds;
    this.missionTypes = newMissionTypes;
    this.velocities = newVelocities;
    
    if (this.uavMesh) {
      this.scene.remove(this.uavMesh);
      this.uavMesh.geometry.dispose();
      this.uavMesh.material.dispose();
    }
    
    this._createInstancedMesh();
    this._setupInstanceAttributes();
    
    for (let i = 0; i < this.activeCount; i++) {
      this._updateInstanceMatrix(i);
    }
    this.uavMesh.instanceMatrix.needsUpdate = true;
    this._updateInstanceAttributes();
    
    for (let i = oldPoolSize; i < this.poolSize; i++) {
      this.freeSlots.push(i);
    }
    
    this.scene.add(this.uavMesh);
  }

  _shrinkPoolIfNeeded() {
    const targetSize = Math.max(
      Math.ceil(this.activeCount * POOL_GROW_FACTOR),
      MIN_POOL_SIZE
    );
    
    if (this.poolSize > targetSize * 2 && this.poolSize > MIN_POOL_SIZE * 2) {
      console.log(`收缩实例池: ${this.poolSize} -> ${targetSize}`);
      this._resizePool(targetSize);
    }
  }

  _resizePool(newSize) {
    newSize = Math.max(newSize, MIN_POOL_SIZE);
    
    const oldPoolSize = this.poolSize;
    this.poolSize = newSize;
    
    const newPositions = new Float32Array(this.poolSize * 3);
    newPositions.set(this.positions.subarray(0, this.poolSize * 3));
    
    const newHeadings = new Float32Array(this.poolSize);
    newHeadings.set(this.headings.subarray(0, this.poolSize));
    
    const newSpeeds = new Float32Array(this.poolSize);
    newSpeeds.set(this.speeds.subarray(0, this.poolSize));
    
    const newMissionTypes = new Float32Array(this.poolSize);
    newMissionTypes.set(this.missionTypes.subarray(0, this.poolSize));
    
    const newVelocities = new Float32Array(this.poolSize * 2);
    newVelocities.set(this.velocities.subarray(0, this.poolSize * 2));
    
    this.positions = newPositions;
    this.headings = newHeadings;
    this.speeds = newSpeeds;
    this.missionTypes = newMissionTypes;
    this.velocities = newVelocities;
    
    if (this.uavMesh) {
      this.scene.remove(this.uavMesh);
      this.uavMesh.geometry.dispose();
      this.uavMesh.material.dispose();
    }
    
    this._createInstancedMesh();
    this._setupInstanceAttributes();
    
    for (let i = 0; i < this.activeCount; i++) {
      this._updateInstanceMatrix(i);
    }
    this.uavMesh.instanceMatrix.needsUpdate = true;
    this._updateInstanceAttributes();
    
    this.freeSlots = [];
    for (let i = this.activeCount; i < this.poolSize; i++) {
      this.freeSlots.push(i);
    }
    
    const newActiveSlots = new Set();
    for (const slot of this.activeSlots) {
      if (slot < this.poolSize) {
        newActiveSlots.add(slot);
      }
    }
    this.activeSlots = newActiveSlots;
    
    this.scene.add(this.uavMesh);
  }

  addUAV(data = {}) {
    if (this.freeSlots.length === 0) {
      this._growPool(this.poolSize + MIN_POOL_SIZE);
    }
    
    const slotIndex = this.freeSlots.pop();
    this.activeSlots.add(slotIndex);
    this.activeCount = this.activeSlots.size;
    
    const angle = data.heading !== undefined ? data.heading : Math.random() * Math.PI * 2;
    const x = data.x !== undefined ? data.x : Math.cos(angle) * (Math.random() * 500 + 1000);
    const y = data.y !== undefined ? data.y : 100 + Math.random() * 100;
    const z = data.z !== undefined ? data.z : Math.sin(angle) * (Math.random() * 500 + 1000);
    
    this.positions[slotIndex * 3]     = x;
    this.positions[slotIndex * 3 + 1] = y;
    this.positions[slotIndex * 3 + 2] = z;
    
    this.headings[slotIndex] = angle;
    this.speeds[slotIndex] = data.speed || 15 + Math.random() * 20;
    this.missionTypes[slotIndex] = data.missionType !== undefined ? data.missionType : Math.floor(Math.random() * 6);
    this.velocities[slotIndex * 2] = 0;
    this.velocities[slotIndex * 2 + 1] = 0;
    
    this._updateInstanceMatrix(slotIndex);
    
    this.uavMesh.count = this.activeCount;
    this.uavMesh.instanceMatrix.needsUpdate = true;
    this._updateInstanceAttributes();
    
    return slotIndex;
  }

  removeUAV(slotIndex) {
    if (!this.activeSlots.has(slotIndex)) return false;
    
    this.activeSlots.delete(slotIndex);
    this.freeSlots.push(slotIndex);
    
    const lastActiveIndex = this.activeCount - 1;
    if (slotIndex < lastActiveIndex && lastActiveIndex >= 0) {
      this.positions[slotIndex * 3]     = this.positions[lastActiveIndex * 3];
      this.positions[slotIndex * 3 + 1] = this.positions[lastActiveIndex * 3 + 1];
      this.positions[slotIndex * 3 + 2] = this.positions[lastActiveIndex * 3 + 2];
      
      this.headings[slotIndex]    = this.headings[lastActiveIndex];
      this.speeds[slotIndex]      = this.speeds[lastActiveIndex];
      this.missionTypes[slotIndex] = this.missionTypes[lastActiveIndex];
      this.velocities[slotIndex * 2]     = this.velocities[lastActiveIndex * 2];
      this.velocities[slotIndex * 2 + 1] = this.velocities[lastActiveIndex * 2 + 1];
      
      this._updateInstanceMatrix(slotIndex);
    }
    
    this.activeCount = this.activeSlots.size;
    this.uavMesh.count = this.activeCount;
    this.uavMesh.instanceMatrix.needsUpdate = true;
    this._updateInstanceAttributes();
    
    if (this.freeSlots.length > this.poolSize * 0.5 && this.poolSize > MIN_POOL_SIZE * 2) {
      setTimeout(() => this._shrinkPoolIfNeeded(), 1000);
    }
    
    return true;
  }

  _updateInstanceMatrix(index) {
    const x = this.positions[index * 3];
    const y = this.positions[index * 3 + 1];
    const z = this.positions[index * 3 + 2];
    
    this._euler.set(0, this.headings[index], 0, 'YXZ');
    this._quaternion.setFromEuler(this._euler);
    
    const bank = this.velocities[index * 2] * 0.005;
    const pitch = this.velocities[index * 2 + 1] * 0.005;
    
    this._dummy.position.set(x, y, z);
    this._dummy.quaternion.copy(this._quaternion);
    this._dummy.rotation.z = -bank;
    this._dummy.rotation.x = pitch;
    this._dummy.updateMatrix();
    
    this.uavMesh.setMatrixAt(index, this._dummy.matrix);
  }

  _updateInstanceAttributes() {
    for (const slotIndex of this.activeSlots) {
      this.missionTypeAttribute.setX(slotIndex, this.missionTypes[slotIndex]);
      this.speedAttribute.setX(slotIndex, this.speeds[slotIndex]);
    }
    
    this.missionTypeAttribute.needsUpdate = true;
    this.speedAttribute.needsUpdate = true;
  }

  updateData(data) {
    if (!data.states || data.states.length < 8) {
      console.warn('数据不完整');
      return;
    }
    
    this.pendingData = data;
    this.dataReady = true;
  }

  _processPendingData() {
    if (!this.dataReady || !this.pendingData) return;
    
    const states = this.pendingData.states;
    const uavCount = this.pendingData.uavCount;
    
    if (uavCount !== this.count) {
      this._adjustInstanceCount(uavCount);
      this.count = uavCount;
    }
    
    const updateCount = Math.min(uavCount, this.activeCount);
    
    for (let i = 0; i < updateCount; i++) {
      const offset = i * 8;
      
      const newX = states[offset];
      const newY = states[offset + 1];
      const newZ = states[offset + 2];
      const newHeading = states[offset + 3];
      const newSpeed = states[offset + 4];
      const newMissionType = states[offset + 5];
      const newVx = states[offset + 6];
      const newVz = states[offset + 7];
      
      if (isNaN(newX) || isNaN(newY) || isNaN(newZ) ||
          !isFinite(newX) || !isFinite(newY) || !isFinite(newZ)) {
        continue;
      }
      
      this.positions[i * 3]     = newX;
      this.positions[i * 3 + 1] = newY;
      this.positions[i * 3 + 2] = newZ;
      this.headings[i]          = this._normalizeAngle(newHeading);
      this.speeds[i]            = newSpeed;
      this.missionTypes[i]      = newMissionType;
      this.velocities[i * 2]    = newVx;
      this.velocities[i * 2 + 1]= newVz;
      
      this._updateInstanceMatrix(i);
    }
    
    this.uavMesh.instanceMatrix.needsUpdate = true;
    this._updateInstanceAttributes();
    
    this.dataReady = false;
    this.pendingData = null;
  }

  _normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  _adjustInstanceCount(targetCount) {
    if (targetCount === this.activeCount) return;
    
    if (targetCount > this.activeCount) {
      while (this.activeCount < targetCount) {
        this.addUAV();
      }
    } else {
      const slotsToRemove = [];
      for (const slot of this.activeSlots) {
        if (slot >= targetCount) {
          slotsToRemove.push(slot);
        }
        if (this.activeCount - slotsToRemove.length <= targetCount) break;
      }
      
      slotsToRemove.forEach(slot => this.removeUAV(slot));
    }
  }

  update(delta) {
    if (this._glContextLost) return;
    
    this.time += delta;
    this.material.uniforms.uTime.value = this.time;
    
    this._processPendingData();
    
    if (this.uavMesh) {
      this.uavMesh.computeBoundingSphere();
    }
  }

  getMesh() {
    return this.uavMesh;
  }

  getCount() {
    return this.activeCount;
  }

  getPoolSize() {
    return this.poolSize;
  }

  isContextLost() {
    return this._glContextLost;
  }

  dispose() {
    if (this._contextLostTimeout) {
      clearTimeout(this._contextLostTimeout);
    }
    
    if (this.uavMesh) {
      this.uavMesh.geometry.dispose();
      this.uavMesh.material.dispose();
      this.scene.remove(this.uavMesh);
      this.uavMesh = null;
    }
    if (this.bodyGeometry) {
      this.bodyGeometry.dispose();
      this.bodyGeometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    
    this.positions = null;
    this.headings = null;
    this.speeds = null;
    this.missionTypes = null;
    this.velocities = null;
    
    this.freeSlots = [];
    this.activeSlots.clear();
  }
}
