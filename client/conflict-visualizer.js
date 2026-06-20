import * as THREE from 'three';
import { WarningLineVertexShader, WarningLineFragmentShader, ShieldVertexShader, ShieldFragmentShader } from './uav-shaders.js';

export class ConflictVisualizer {
  constructor(sceneManager, uavRenderer) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.getScene();
    this.uavRenderer = uavRenderer;
    
    this.maxConflicts = 200;
    this.warningLines = null;
    this.shields = null;
    
    this.lineStartAttribute = null;
    this.lineEndAttribute = null;
    this.lineProgressAttribute = null;
    this.lineDistanceAttribute = null;
    
    this.shieldCenterAttribute = null;
    this.shieldRadiusAttribute = null;
    
    this.conflicts = [];
    this.uavInConflict = new Set();
    this.conflictMap = new Map();
    
    this.time = 0;
    
    this._init();
  }

  _init() {
    this._createWarningLines();
    this._createShields();
  }

  _createWarningLines() {
    const geometry = new THREE.BufferGeometry();
    
    const positions = [];
    const indices = [];
    
    const segments = 20;
    
    for (let i = 0; i < this.maxConflicts; i++) {
      for (let s = 0; s < segments; s++) {
        const t = s / segments;
        const tNext = (s + 1) / segments;
        
        positions.push(t, -1, 0);
        positions.push(t, 1, 0);
        positions.push(tNext, 1, 0);
        positions.push(tNext, -1, 0);
        
        const base = i * segments * 4 + s * 4;
        indices.push(base, base + 1, base + 2);
        indices.push(base, base + 2, base + 3);
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    
    this.lineStartAttribute = new THREE.InstancedBufferAttribute(new Float32Array(this.maxConflicts * 3), 3);
    this.lineStartAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aStart', this.lineStartAttribute);
    
    this.lineEndAttribute = new THREE.InstancedBufferAttribute(new Float32Array(this.maxConflicts * 3), 3);
    this.lineEndAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aEnd', this.lineEndAttribute);
    
    this.lineProgressAttribute = new THREE.InstancedBufferAttribute(new Float32Array(this.maxConflicts), 1);
    this.lineProgressAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aProgress', this.lineProgressAttribute);
    
    this.lineDistanceAttribute = new THREE.InstancedBufferAttribute(new Float32Array(this.maxConflicts), 1);
    this.lineDistanceAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aDistance', this.lineDistanceAttribute);
    
    const material = new THREE.ShaderMaterial({
      vertexShader: WarningLineVertexShader,
      fragmentShader: WarningLineFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(1.0, 0.2, 0.2) }
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    this.warningLines = new THREE.InstancedMesh(geometry, material, this.maxConflicts);
    this.warningLines.count = 0;
    this.warningLines.frustumCulled = false;
    
    this.scene.add(this.warningLines);
  }

  _createShields() {
    const geometry = new THREE.IcosahedronGeometry(1, 3);
    
    this.shieldCenterAttribute = new THREE.InstancedBufferAttribute(new Float32Array(this.maxConflicts * 2 * 3), 3);
    this.shieldCenterAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aCenter', this.shieldCenterAttribute);
    
    this.shieldRadiusAttribute = new THREE.InstancedBufferAttribute(new Float32Array(this.maxConflicts * 2), 1);
    this.shieldRadiusAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aRadius', this.shieldRadiusAttribute);
    
    const material = new THREE.ShaderMaterial({
      vertexShader: ShieldVertexShader,
      fragmentShader: ShieldFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(1.0, 0.3, 0.3) }
      },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    this.shields = new THREE.InstancedMesh(geometry, material, this.maxConflicts * 2);
    this.shields.count = 0;
    this.shields.frustumCulled = false;
    
    this.scene.add(this.shields);
  }

  updateConflicts(conflictData, uavPositions) {
    if (!conflictData || !conflictData.conflicts) return;
    
    this.conflicts = conflictData.conflicts;
    this.uavInConflict = conflictData.uavInConflict || new Set();
    this.conflictMap.clear();
    
    for (const conflict of this.conflicts) {
      this.conflictMap.set(this._getPairKey(conflict.id1, conflict.id2), conflict);
    }
    
    this._updateWarningLines(conflictData.conflicts, uavPositions);
    this._updateShields(conflictData.conflicts, uavPositions);
    this._updateUAVConflictFlags();
  }

  _getPairKey(a, b) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  _updateWarningLines(conflicts, uavPositions) {
    const visibleConflicts = Math.min(conflicts.length, this.maxConflicts);
    
    for (let i = 0; i < visibleConflicts; i++) {
      const conflict = conflicts[i];
      const id1 = conflict.id1;
      const id2 = conflict.id2;
      
      let x1, y1, z1, x2, y2, z2;
      
      if (uavPositions && uavPositions[id1 * 3] !== undefined) {
        x1 = uavPositions[id1 * 3];
        y1 = uavPositions[id1 * 3 + 1];
        z1 = uavPositions[id1 * 3 + 2];
        x2 = uavPositions[id2 * 3];
        y2 = uavPositions[id2 * 3 + 1];
        z2 = uavPositions[id2 * 3 + 2];
      } else {
        x1 = conflict.x1 || 0;
        y1 = 100;
        z1 = conflict.z1 || 0;
        x2 = x1 + 10;
        y2 = 100;
        z2 = z1 + 10;
      }
      
      const midY = (y1 + y2) / 2;
      
      this.lineStartAttribute.setXYZ(i, x1, midY, z1);
      this.lineEndAttribute.setXYZ(i, x2, midY, z2);
      this.lineProgressAttribute.setX(i, this.time * 0.5);
      this.lineDistanceAttribute.setX(i, conflict.distance || 10);
    }
    
    for (let i = visibleConflicts; i < this.maxConflicts; i++) {
      this.lineStartAttribute.setXYZ(i, 0, -10000, 0);
      this.lineEndAttribute.setXYZ(i, 0, -10000, 0);
    }
    
    this.lineStartAttribute.needsUpdate = true;
    this.lineEndAttribute.needsUpdate = true;
    this.lineProgressAttribute.needsUpdate = true;
    this.lineDistanceAttribute.needsUpdate = true;
    
    this.warningLines.count = visibleConflicts;
  }

  _updateShields(conflicts, uavPositions) {
    const visibleConflicts = Math.min(conflicts.length, this.maxConflicts);
    
    for (let i = 0; i < visibleConflicts; i++) {
      const conflict = conflicts[i];
      const id1 = conflict.id1;
      const id2 = conflict.id2;
      
      let x1, y1, z1, x2, y2, z2;
      
      if (uavPositions && uavPositions[id1 * 3] !== undefined) {
        x1 = uavPositions[id1 * 3];
        y1 = uavPositions[id1 * 3 + 1];
        z1 = uavPositions[id1 * 3 + 2];
        x2 = uavPositions[id2 * 3];
        y2 = uavPositions[id2 * 3 + 1];
        z2 = uavPositions[id2 * 3 + 2];
      } else {
        x1 = conflict.x1 || 0;
        y1 = 100;
        z1 = conflict.z1 || 0;
        x2 = x1 + 10;
        y2 = 100;
        z2 = z1 + 10;
      }
      
      const shieldRadius = 15;
      
      this.shieldCenterAttribute.setXYZ(i * 2, x1, y1, z1);
      this.shieldRadiusAttribute.setX(i * 2, shieldRadius);
      
      this.shieldCenterAttribute.setXYZ(i * 2 + 1, x2, y2, z2);
      this.shieldRadiusAttribute.setX(i * 2 + 1, shieldRadius);
    }
    
    for (let i = visibleConflicts * 2; i < this.maxConflicts * 2; i++) {
      this.shieldCenterAttribute.setXYZ(i, 0, -10000, 0);
      this.shieldRadiusAttribute.setX(i, 0);
    }
    
    this.shieldCenterAttribute.needsUpdate = true;
    this.shieldRadiusAttribute.needsUpdate = true;
    
    this.shields.count = visibleConflicts * 2;
  }

  _updateUAVConflictFlags() {
    if (!this.uavRenderer || !this.uavRenderer.getConflictFlagAttribute()) return;
    
    const attribute = this.uavRenderer.getConflictFlagAttribute();
    const count = this.uavRenderer.getCount();
    
    for (let i = 0; i < count; i++) {
      const flag = this.uavInConflict.has(i) ? 1.0 : 0.0;
      attribute.setX(i, flag);
    }
    
    attribute.needsUpdate = true;
  }

  isUAVInConflict(uavId) {
    return this.uavInConflict.has(uavId);
  }

  getConflictCount() {
    return this.conflicts.length;
  }

  getUAVConflictCount() {
    return this.uavInConflict.size;
  }

  update(delta) {
    this.time += delta;
    
    if (this.warningLines) {
      this.warningLines.material.uniforms.uTime.value = this.time;
      
      for (let i = 0; i < this.warningLines.count; i++) {
        this.lineProgressAttribute.setX(i, this.time * 0.5);
      }
      this.lineProgressAttribute.needsUpdate = true;
    }
    
    if (this.shields) {
      this.shields.material.uniforms.uTime.value = this.time;
    }
  }

  dispose() {
    if (this.warningLines) {
      this.scene.remove(this.warningLines);
      this.warningLines.geometry.dispose();
      this.warningLines.material.dispose();
      this.warningLines = null;
    }
    
    if (this.shields) {
      this.scene.remove(this.shields);
      this.shields.geometry.dispose();
      this.shields.material.dispose();
      this.shields = null;
    }
    
    this.conflicts = [];
    this.uavInConflict.clear();
    this.conflictMap.clear();
  }
}
