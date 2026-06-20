export class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this._tempSet = new Set();
  }

  clear() {
    this.grid.clear();
  }

  _getKey(x, y, z) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cy},${cz}`;
  }

  insert(id, x, y, z) {
    const key = this._getKey(x, y, z);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key).push(id);
  }

  getNearby(x, y, z) {
    this._tempSet.clear();
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${cx + dx},${cy + dy},${cz + dz}`;
          const cell = this.grid.get(key);
          if (cell) {
            for (let i = 0; i < cell.length; i++) {
              this._tempSet.add(cell[i]);
            }
          }
        }
      }
    }
    
    return this._tempSet;
  }

  getCellCount() {
    return this.grid.size;
  }

  getTotalObjects() {
    let count = 0;
    for (const cell of this.grid.values()) {
      count += cell.length;
    }
    return count;
  }
}

export class ConflictDetector {
  constructor(threshold = 20, cellSize = 30) {
    this.threshold = threshold;
    this.thresholdSq = threshold * threshold;
    this.grid = new SpatialGrid(cellSize);
    this.conflicts = [];
    this.conflictSet = new Set();
    this.uavInConflict = new Set();
    this.conflictDistances = new Map();
  }

  detect(uavs, count) {
    this.grid.clear();
    this.conflicts.length = 0;
    this.conflictSet.clear();
    this.uavInConflict.clear();
    this.conflictDistances.clear();
    
    const startTime = performance.now();
    
    for (let i = 0; i < count; i++) {
      const offset = i * 8;
      const x = uavs[offset];
      const y = uavs[offset + 1];
      const z = uavs[offset + 2];
      this.grid.insert(i, x, y, z);
    }
    
    for (let i = 0; i < count; i++) {
      const offset = i * 8;
      const x1 = uavs[offset];
      const y1 = uavs[offset + 1];
      const z1 = uavs[offset + 2];
      
      const nearby = this.grid.getNearby(x1, y1, z1);
      
      for (const j of nearby) {
        if (j <= i) continue;
        
        const jOffset = j * 8;
        const x2 = uavs[jOffset];
        const y2 = uavs[jOffset + 1];
        const z2 = uavs[jOffset + 2];
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        const distSq = dx * dx + dy * dy + dz * dz;
        
        if (distSq < this.thresholdSq) {
          const pairKey = this._getPairKey(i, j);
          if (!this.conflictSet.has(pairKey)) {
            this.conflictSet.add(pairKey);
            const distance = Math.sqrt(distSq);
            this.conflicts.push({
              id1: i,
              id2: j,
              distance: distance,
              x1, y1, z1,
              x2, y2, z2
            });
            this.conflictDistances.set(pairKey, distance);
            this.uavInConflict.add(i);
            this.uavInConflict.add(j);
          }
        }
      }
    }
    
    const endTime = performance.now();
    this.detectionTime = endTime - startTime;
    
    return {
      conflicts: this.conflicts,
      conflictCount: this.conflicts.length,
      uavInConflict: this.uavInConflict,
      detectionTime: this.detectionTime
    };
  }

  _getPairKey(a, b) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  getConflictCount() {
    return this.conflicts.length;
  }

  getUAVConflictCount() {
    return this.uavInConflict.size;
  }

  getDetectionTime() {
    return this.detectionTime;
  }

  isUAVInConflict(uavId) {
    return this.uavInConflict.has(uavId);
  }

  getConflictDistance(uavId1, uavId2) {
    return this.conflictDistances.get(this._getPairKey(uavId1, uavId2));
  }

  getConflicts() {
    return this.conflicts;
  }

  getConflictUAVs() {
    return this.uavInConflict;
  }
}

export function createConflictDetector(threshold = 20, cellSize = 30) {
  return new ConflictDetector(threshold, cellSize);
}
