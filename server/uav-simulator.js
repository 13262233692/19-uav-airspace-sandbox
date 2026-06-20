import { Quaternion } from './quaternion.js';

const MISSION_TYPES = [
  { id: 0, name: 'delivery', color: 0x4ade80, speed: 15, altitude: 80 },
  { id: 1, name: 'patrol', color: 0x60a5fa, speed: 25, altitude: 120 },
  { id: 2, name: 'inspection', color: 0xfbbf24, speed: 8, altitude: 60 },
  { id: 3, name: 'emergency', color: 0xf87171, speed: 40, altitude: 150 },
  { id: 4, name: 'mapping', color: 0xa78bfa, speed: 12, altitude: 200 },
  { id: 5, name: 'passenger', color: 0xf472b6, speed: 30, altitude: 100 }
];

const CITY_CENTER = { x: 0, z: 0 };
const CITY_RADIUS = 2000;
const MIN_ALTITUDE = 30;
const MAX_ALTITUDE = 250;
const TURN_RATE = Math.PI * 1.5;

export class UAVSimulator {
  constructor(count) {
    this.count = count;
    this.uavs = new Array(count);
    this.stateBuffer = new SharedArrayBuffer(count * 8 * 4);
    this.stateView = new Float32Array(this.stateBuffer);
    
    this._tempQuatA = new Quaternion();
    this._tempQuatB = new Quaternion();
    
    this._initializeUAVs();
  }

  _initializeUAVs() {
    for (let i = 0; i < this.count; i++) {
      const missionType = MISSION_TYPES[Math.floor(Math.random() * MISSION_TYPES.length)];
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * CITY_RADIUS * 0.9;
      
      const uav = {
        id: i,
        x: Math.cos(angle) * distance,
        y: MIN_ALTITUDE + Math.random() * (MAX_ALTITUDE - MIN_ALTITUDE),
        z: Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        vz: 0,
        heading: Math.random() * Math.PI * 2,
        targetHeading: 0,
        speed: missionType.speed,
        missionType: missionType.id,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        waypointIndex: 0,
        waypoints: [],
        state: 'cruise',
        rotorSpeed: 0,
        quaternion: new Quaternion(),
        targetQuaternion: new Quaternion(),
        bank: 0,
        targetBank: 0,
        pitch: 0,
        targetPitch: 0
      };
      
      uav.quaternion.setFromEulerY(uav.heading);
      uav.targetQuaternion.copy(uav.quaternion);
      
      this._generateWaypoints(uav);
      this._setTarget(uav);
      this.uavs[i] = uav;
      this._updateStateBuffer(i);
    }
  }

  _generateWaypoints(uav) {
    const waypointCount = 3 + Math.floor(Math.random() * 4);
    uav.waypoints = [];
    
    for (let i = 0; i < waypointCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * (CITY_RADIUS - 200);
      const mission = MISSION_TYPES[uav.missionType];
      
      uav.waypoints.push({
        x: Math.cos(angle) * distance,
        y: mission.altitude + (Math.random() - 0.5) * 40,
        z: Math.sin(angle) * distance,
        holdTime: Math.random() * 2
      });
    }
  }

  _setTarget(uav) {
    const wp = uav.waypoints[uav.waypointIndex];
    uav.targetX = wp.x;
    uav.targetY = wp.y;
    uav.targetZ = wp.z;
    
    const dx = uav.targetX - uav.x;
    const dz = uav.targetZ - uav.z;
    uav.targetHeading = Math.atan2(dx, dz);
    
    uav.targetQuaternion.setFromEulerY(uav.targetHeading);
    
    const dot = uav.quaternion.dot(uav.targetQuaternion);
    if (dot < 0) {
      uav.targetQuaternion.x = -uav.targetQuaternion.x;
      uav.targetQuaternion.y = -uav.targetQuaternion.y;
      uav.targetQuaternion.z = -uav.targetQuaternion.z;
      uav.targetQuaternion.w = -uav.targetQuaternion.w;
    }
  }

  _updateStateBuffer(index) {
    const uav = this.uavs[index];
    const offset = index * 8;
    
    this.stateView[offset]     = uav.x;
    this.stateView[offset + 1] = uav.y;
    this.stateView[offset + 2] = uav.z;
    this.stateView[offset + 3] = uav.heading;
    this.stateView[offset + 4] = uav.speed;
    this.stateView[offset + 5] = uav.missionType;
    this.stateView[offset + 6] = uav.vx;
    this.stateView[offset + 7] = uav.vz;
  }

  _normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  _getAngleDifference(from, to) {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  _updateUAV(uav, dt) {
    const dx = uav.targetX - uav.x;
    const dy = uav.targetY - uav.y;
    const dz = uav.targetZ - uav.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance < 10) {
      uav.waypointIndex = (uav.waypointIndex + 1) % uav.waypoints.length;
      this._setTarget(uav);
      return;
    }
    
    const mission = MISSION_TYPES[uav.missionType];
    const baseSpeed = mission.speed;
    const speedFactor = 0.8 + Math.sin(Date.now() * 0.001 + uav.id) * 0.2;
    const currentSpeed = baseSpeed * speedFactor;
    
    const moveX = (dx / distance) * currentSpeed * dt;
    const moveY = (dy / distance) * currentSpeed * dt * 0.5;
    const moveZ = (dz / distance) * currentSpeed * dt;
    
    const noise = Math.sin(Date.now() * 0.003 + uav.id * 0.1) * 0.5;
    
    uav.vx = moveX / dt + noise;
    uav.vy = moveY / dt;
    uav.vz = moveZ / dt + noise * 0.5;
    
    uav.x += moveX;
    uav.y += moveY;
    uav.z += moveZ;
    
    const targetHeading = Math.atan2(dx, dz);
    const angleDiff = this._getAngleDifference(uav.heading, targetHeading);
    
    const maxTurn = TURN_RATE * dt;
    if (Math.abs(angleDiff) > maxTurn) {
      uav.heading += Math.sign(angleDiff) * maxTurn;
    } else {
      uav.heading = targetHeading;
    }
    uav.heading = this._normalizeAngle(uav.heading);
    
    this._tempQuatA.copy(uav.quaternion);
    this._tempQuatB.setFromEulerY(uav.heading);
    
    const dot = this._tempQuatA.dot(this._tempQuatB);
    if (dot < 0) {
      this._tempQuatB.x = -this._tempQuatB.x;
      this._tempQuatB.y = -this._tempQuatB.y;
      this._tempQuatB.z = -this._tempQuatB.z;
      this._tempQuatB.w = -this._tempQuatB.w;
    }
    
    const turnAmount = Math.min(1, (TURN_RATE * dt) / Math.max(Math.abs(angleDiff), 0.001));
    uav.quaternion.copy(this._tempQuatA);
    uav.quaternion.slerp(this._tempQuatB, turnAmount);
    uav.quaternion.normalize();
    
    uav.targetBank = -angleDiff * 0.3;
    uav.bank += (uav.targetBank - uav.bank) * Math.min(1, dt * 5);
    
    uav.targetPitch = -moveY * 0.02;
    uav.pitch += (uav.targetPitch - uav.pitch) * Math.min(1, dt * 3);
    
    uav.y = Math.max(MIN_ALTITUDE, Math.min(MAX_ALTITUDE, uav.y));
    
    uav.rotorSpeed = 2000 + currentSpeed * 50;
    uav.speed = currentSpeed;
  }

  tick(dt) {
    for (let i = 0; i < this.count; i++) {
      this._updateUAV(this.uavs[i], dt);
      this._updateStateBuffer(i);
    }
  }

  start(tickRate) {
    const interval = 1000 / tickRate;
    let lastTime = performance.now();
    
    setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      this.tick(Math.min(dt, 0.1));
    }, interval);
    
    console.log(`模拟引擎已启动，频率 ${tickRate} Hz`);
  }

  getStateBuffer() {
    return this.stateView;
  }

  getUAV(index) {
    return this.uavs[index];
  }

  getAllUAVs() {
    return this.uavs;
  }
}

export { MISSION_TYPES };
