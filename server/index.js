import { WebSocketServer } from 'ws';
import { UAVSimulator } from './uav-simulator.js';
import { DataBroadcaster } from './data-broadcaster.js';

const PORT = process.env.PORT || 8080;
const UAV_COUNT = 5000;
const TICK_RATE = 60;
const BROADCAST_RATE = 30;

console.log('='.repeat(60));
console.log('无人机集群管制沙盘 - 后端服务');
console.log('='.repeat(60));
console.log(`无人机数量: ${UAV_COUNT}`);
console.log(`模拟频率: ${TICK_RATE} Hz`);
console.log(`广播频率: ${BROADCAST_RATE} Hz`);
console.log(`WebSocket 端口: ${PORT}`);
console.log('='.repeat(60));

const simulator = new UAVSimulator(UAV_COUNT);
const broadcaster = new DataBroadcaster();

simulator.start(TICK_RATE);
broadcaster.start(BROADCAST_RATE, () => simulator.getStateBuffer());

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
