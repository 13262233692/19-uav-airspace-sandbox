import * as THREE from 'three';

export class CityBuilder {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.getScene();
    this.cityGroup = new THREE.Group();
    this.buildingCount = 0;
  }

  async build() {
    this._createGround();
    this._createRoadGrid();
    this._createBuildings();
    this._createRiver();
    this._createAirspaceVisualization();
    
    this.scene.add(this.cityGroup);
    
    return this;
  }

  _createGround() {
    const groundGeometry = new THREE.PlaneGeometry(5000, 5000);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.cityGroup.add(ground);
  }

  _createRoadGrid() {
    const gridSize = 5000;
    const gridDivisions = 50;
    
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x2a3a5a, 0x1a2a4a);
    gridHelper.position.y = 0.01;
    this.cityGroup.add(gridHelper);
    
    const mainRoadMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a,
      roughness: 0.8
    });
    
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      
      const roadX = new THREE.Mesh(
        new THREE.BoxGeometry(5000, 0.1, 30),
        mainRoadMaterial
      );
      roadX.position.set(0, 0.05, i * 500);
      roadX.receiveShadow = true;
      this.cityGroup.add(roadX);
      
      const roadZ = new THREE.Mesh(
        new THREE.BoxGeometry(30, 0.1, 5000),
        mainRoadMaterial
      );
      roadZ.position.set(i * 500, 0.05, 0);
      roadZ.receiveShadow = true;
      this.cityGroup.add(roadZ);
    }
  }

  _createBuildings() {
    const cityCenter = { x: 0, z: 0 };
    const cityRadius = 2000;
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e8f0,
      roughness: 0.6,
      metalness: 0.2
    });
    
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4a6a,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0x1a2a4a,
      emissiveIntensity: 0.3
    });
    
    const districts = [
      { center: { x: 0, z: 0 }, density: 1.0, heightScale: 1.5, name: 'CBD' },
      { center: { x: -600, z: -400 }, density: 0.8, heightScale: 1.0, name: '商业' },
      { center: { x: 600, z: -300 }, density: 0.7, heightScale: 0.9, name: '住宅' },
      { center: { x: -300, z: 600 }, density: 0.6, heightScale: 0.8, name: '科技' },
      { center: { x: 500, z: 500 }, density: 0.5, heightScale: 0.7, name: '工业' }
    ];
    
    const mergedGeometries = [];
    let geometryIndex = 0;
    
    districts.forEach((district, districtIndex) => {
      const buildingCount = Math.floor(80 * district.density);
      
      for (let i = 0; i < buildingCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 400;
        const x = district.center.x + Math.cos(angle) * distance;
        const z = district.center.z + Math.sin(angle) * distance;
        
        const distFromCenter = Math.sqrt(x * x + z * z);
        if (distFromCenter > cityRadius) continue;
        
        const baseHeight = 30 + Math.random() * 150;
        const height = baseHeight * district.heightScale * (1 - distFromCenter / cityRadius * 0.5);
        
        const width = 15 + Math.random() * 35;
        const depth = 15 + Math.random() * 35;
        
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        buildingGeometry.translate(x, height / 2, z);
        
        mergedGeometries.push(buildingGeometry);
        this.buildingCount++;
        
        if (Math.random() < 0.15 && height > 80) {
          const roofHeight = 10 + Math.random() * 20;
          const roofGeometry = new THREE.CylinderGeometry(
            width * 0.2,
            width * 0.35,
            roofHeight,
            8
          );
          roofGeometry.translate(x, height + roofHeight / 2, z);
          mergedGeometries.push(roofGeometry);
          this.buildingCount++;
        }
        
        if (Math.random() < 0.2 && height > 60) {
          const antennaHeight = 20 + Math.random() * 30;
          const antennaGeometry = new THREE.CylinderGeometry(0.5, 0.5, antennaHeight, 6);
          antennaGeometry.translate(x, height + antennaHeight / 2, z);
          mergedGeometries.push(antennaGeometry);
          this.buildingCount++;
        }
      }
    });
    
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 800 + Math.random() * 800;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      const height = 10 + Math.random() * 30;
      const width = 40 + Math.random() * 80;
      const depth = 40 + Math.random() * 80;
      
      const warehouseGeometry = new THREE.BoxGeometry(width, height, depth);
      warehouseGeometry.translate(x, height / 2, z);
      mergedGeometries.push(warehouseGeometry);
      this.buildingCount++;
    }
    
    const mergedGeometry = this._mergeGeometries(mergedGeometries);
    const buildings = new THREE.Mesh(mergedGeometry, buildingMaterial);
    buildings.castShadow = true;
    buildings.receiveShadow = true;
    this.cityGroup.add(buildings);
    
    this._createWindowTextures();
  }

  _mergeGeometries(geometries) {
    const merged = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let indexOffset = 0;
    
    geometries.forEach((geo) => {
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;
      const uv = geo.attributes.uv;
      const idx = geo.index;
      
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        if (uv) {
          uvs.push(uv.getX(i), uv.getY(i));
        } else {
          uvs.push(0, 0);
        }
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
      
      indexOffset += pos.count;
      geo.dispose();
    });
    
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    merged.setIndex(indices);
    
    return merged;
  }

  _createWindowTextures() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 256, 512);
    
    for (let floor = 0; floor < 20; floor++) {
      for (let col = 0; col < 8; col++) {
        const x = 10 + col * 30;
        const y = 10 + floor * 25;
        const lit = Math.random() > 0.3;
        
        ctx.fillStyle = lit ? '#ffd700' : '#2a3a5a';
        ctx.fillRect(x, y, 20, 15);
        
        if (lit) {
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 10;
          ctx.fillRect(x, y, 20, 15);
          ctx.shadowBlur = 0;
        }
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    
    this.windowTexture = texture;
  }

  _createRiver() {
    const riverPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2500, 0.02, -800),
      new THREE.Vector3(-1500, 0.02, -600),
      new THREE.Vector3(-500, 0.02, -700),
      new THREE.Vector3(500, 0.02, -500),
      new THREE.Vector3(1500, 0.02, -300),
      new THREE.Vector3(2500, 0.02, -400)
    ]);
    
    const riverGeometry = new THREE.TubeGeometry(riverPath, 100, 80, 16, false);
    const riverMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a4a8a,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.8
    });
    
    const river = new THREE.Mesh(riverGeometry, riverMaterial);
    river.receiveShadow = true;
    this.cityGroup.add(river);
    
    for (let i = 0; i < 3; i++) {
      const t = 0.25 + i * 0.25;
      const pos = riverPath.getPoint(t);
      
      const bridgeGeometry = new THREE.BoxGeometry(200, 8, 150);
      const bridgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a4a5a,
        roughness: 0.7
      });
      const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);
      bridge.position.set(pos.x, 12, pos.z);
      bridge.castShadow = true;
      bridge.receiveShadow = true;
      this.cityGroup.add(bridge);
      
      for (let j = -2; j <= 2; j++) {
        if (j === 0) continue;
        const pillarGeometry = new THREE.CylinderGeometry(4, 5, 12, 8);
        const pillar = new THREE.Mesh(pillarGeometry, bridgeMaterial);
        pillar.position.set(pos.x + j * 35, 6, pos.z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        this.cityGroup.add(pillar);
      }
    }
  }

  _createAirspaceVisualization() {
    const airspaceGroup = new THREE.Group();
    
    const altitudeLevels = [50, 100, 150, 200, 250];
    const colors = [0x4ade80, 0x60a5fa, 0xfbbf24, 0xf87171, 0xa78bfa];
    
    altitudeLevels.forEach((altitude, index) => {
      const ringGeometry = new THREE.RingGeometry(
        1800 - index * 100,
        1850 - index * 100,
        64
      );
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: colors[index],
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = altitude;
      airspaceGroup.add(ring);
      
      const lineGeometry = new THREE.BufferGeometry();
      const linePoints = [];
      const radius = 1825 - index * 100;
      
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2;
        linePoints.push(
          Math.cos(angle) * radius,
          altitude,
          Math.sin(angle) * radius
        );
      }
      
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
      const lineMaterial = new THREE.LineBasicMaterial({
        color: colors[index],
        transparent: true,
        opacity: 0.3
      });
      const line = new THREE.LineLoop(lineGeometry, lineMaterial);
      airspaceGroup.add(line);
    });
    
    this.cityGroup.add(airspaceGroup);
  }

  getBuildingCount() {
    return this.buildingCount;
  }
}
