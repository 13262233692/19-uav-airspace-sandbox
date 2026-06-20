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

export class UAVRenderer {
  constructor(sceneManager, count) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.getScene();
    this.count = count;
    
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
    
    this.time = 0;
    this.rotorSpeed = 25.0;
    
    this._dummy = new THREE.Object3D();
    this._quaternion = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    
    this.dataReady = false;
    this.pendingData = null;
  }

  init() {
    this._createUAVGeometry();
    this._createMaterial();
    this._createInstancedMesh();
    this._initializeBuffers();
    this._setupInstanceAttributes();
    
    this.scene.add(this.uavMesh);
    
    console.log(`无人机渲染器已初始化，实例数量: ${this.count}`);
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
      this.count
    );
    
    this.uavMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.uavMesh.frustumCulled = false;
    this.uavMesh.castShadow = true;
    this.uavMesh.receiveShadow = false;
  }

  _setupInstanceAttributes() {
    const geometry = this.uavMesh.geometry;
    
    this.missionTypeAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(this.count),
      1
    );
    this.missionTypeAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aMissionType', this.missionTypeAttribute);
    
    this.speedAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(this.count),
      1
    );
    this.speedAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aSpeed', this.speedAttribute);
    
    this.uavIdAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(this.count),
      1
    );
    this.uavIdAttribute.setUsage(THREE.StaticDrawUsage);
    geometry.setAttribute('aUAVId', this.uavIdAttribute);
    
    for (let i = 0; i < this.count; i++) {
      this.uavIdAttribute.setX(i, i);
    }
    this.uavIdAttribute.needsUpdate = true;
  }

  _initializeBuffers() {
    this.positions = new Float32Array(this.count * 3);
    this.headings = new Float32Array(this.count);
    this.speeds = new Float32Array(this.count);
    this.missionTypes = new Float32Array(this.count);
    this.velocities = new Float32Array(this.count * 2);
    
    for (let i = 0; i < this.count; i++) {
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
    for (let i = 0; i < this.count; i++) {
      this.missionTypeAttribute.setX(i, this.missionTypes[i]);
      this.speedAttribute.setX(i, this.speeds[i]);
    }
    
    this.missionTypeAttribute.needsUpdate = true;
    this.speedAttribute.needsUpdate = true;
  }

  updateData(data) {
    if (!data.states || data.states.length < this.count * 8) {
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
    
    for (let i = 0; i < uavCount; i++) {
      const offset = i * 8;
      
      const newX = states[offset];
      const newY = states[offset + 1];
      const newZ = states[offset + 2];
      const newHeading = states[offset + 3];
      const newSpeed = states[offset + 4];
      const newMissionType = states[offset + 5];
      const newVx = states[offset + 6];
      const newVz = states[offset + 7];
      
      this.positions[i * 3]     = newX;
      this.positions[i * 3 + 1] = newY;
      this.positions[i * 3 + 2] = newZ;
      this.headings[i]          = newHeading;
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

  update(delta) {
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
    return this.count;
  }

  dispose() {
    if (this.uavMesh) {
      this.uavMesh.geometry.dispose();
      this.uavMesh.material.dispose();
      this.scene.remove(this.uavMesh);
    }
    if (this.bodyGeometry) {
      this.bodyGeometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
  }
}
