import { WebSocketServer } from 'ws';
import { UAVSimulator } from './uav-simulator.js';
import { DataBroadcaster } from './data-broadcaster.js';
import { ConflictDetector } from './spatial-grid.js';

const PORT = process.env.PORT || 8080;
const UAV_COUNT = 5000;
const TICK_RATE = 60;
const BROADCAST_RATE = 30;
const CONFLICT_DETECTION_RATE = 15;
const CONFLICT_THRESHOLD = 20;

console.log('='.repeat(60));
console.log('无人机集群管制沙盘 - 后端服务');
console.log('='.repeat(60));
console.log(`无人机数量: ${UAV_COUNT}`);
console.log(`模拟频率: ${TICK_RATE} Hz`);
console.log(`广播频率: ${BROADCAST_RATE} Hz`);
console.log(`冲突检测频率: ${CONFLICT_DETECTION_RATE} Hz`);
console.log(`冲突阈值: ${CONFLICT_THRESHOLD} 米`);
console.log(`WebSocket 端口: ${PORT}`);
console.log('='.repeat(60));

const simulator = new UAVSimulator(UAV_COUNT);
const broadcaster = new DataBroadcaster();
const conflictDetector = new ConflictDetector(CONFLICT_THRESHOLD, 30);

let lastConflictResult = null;

simulator.start(TICK_RATE);
broadcaster.start(BROADCAST_RATE, () => simulator.getStateBuffer());

const conflictInterval = 1000 / CONFLICT_DETECTION_RATE;
setInterval(() => {
  const stateBuffer = simulator.getStateBuffer();
  const result = conflictDetector.detect(stateBuffer, UAV_COUNT);
  lastConflictResult = result;
  
  if (result.conflictCount > 0) {
    console.log(`[${new Date().toISOString()}] 检测到 ${result.conflictCount} 组冲突, ` +
                `涉及 ${result.uavInConflict.size} 架无人机, ` +
                `耗时 ${result.detectionTime.toFixed(2)}ms`);
  }
  
  if (lastConflictResult && lastConflictResult.conflictCount > 0) {
    broadcastConflicts(lastConflictResult);
  }
}, conflictInterval);

function broadcastConflicts(result) {
  const conflicts = result.conflicts;
  
  if (conflicts.length === 0) return;
  
  const maxConflicts = Math.min(conflicts.length, 500);
  const bufferSize = 8 + maxConflicts * 20;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  const floatView = new Float32Array(buffer);
  
  view.setUint32(0, maxConflicts, true);
  view.setUint32(4, Date.now(), true);
  
  const floatOffset = 2;
  
  for (let i = 0; i < maxConflicts; i++) {
    const conflict = conflicts[i];
    const baseIndex = floatOffset + i * 5;
    
    floatView[baseIndex]     = conflict.id1;
    floatView[baseIndex + 1] = conflict.id2;
    floatView[baseIndex + 2] = conflict.distance;
    floatView[baseIndex + 3] = conflict.x1;
    floatView[baseIndex + 4] = conflict.z1;
  }
  
  const header = {
    type: 'conflicts',
    conflictCount: maxConflicts,
    totalConflicts: conflicts.length,
    uavInConflict: result.uavInConflict.size,
    detectionTime: result.detectionTime,
    timestamp: Date.now()
  };
  
  const headerStr = JSON.stringify(header);
  const headerLenBuffer = new ArrayBuffer(4);
  const headerLenView = new DataView(headerLenBuffer);
  headerLenView.setUint32(0, headerStr.length, true);
  
  broadcaster.clients.forEach((ws) => {
    if (ws.readyState === 1) {
      try {
        ws.send(headerLenBuffer, { binary: true });
        ws.send(headerStr, { binary: false });
        ws.send(buffer.slice(0, bufferSize), { binary: true });
      } catch (e) {
        console.error('发送冲突数据失败:', e.message);
      }
    }
  });
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  const clientId = req.socket.remoteAddress + ':' + req.socket.remotePort;
  console.log(`[${new Date().toISOString()}] 客户端连接: ${clientId}`);
  console.log(`当前连接数: ${wss.clients.size}`);

  broadcaster.addClient(ws);

  ws.send(JSON.stringify({
    type: 'init',
    uavCount: UAV_COUNT,
    tickRate: TICK_RATE,
    broadcastRate: BROADCAST_RATE,
    conflictThreshold: CONFLICT_THRESHOLD,
    conflictDetectionRate: CONFLICT_DETECTION_RATE,
    timestamp: Date.now()
  }));

  ws.on('close', () => {
    broadcaster.removeClient(ws);
    console.log(`[${new Date().toISOString()}] 客户端断开: ${clientId}`);
    console.log(`当前连接数: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error(`客户端错误 ${clientId}:`, err.message);
    broadcaster.removeClient(ws);
  });
});

console.log(`[${new Date().toISOString()}] WebSocket 服务已启动，监听端口 ${PORT}`);
console.log('等待客户端连接...');
