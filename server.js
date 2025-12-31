const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

// --- SIMULATION STATE ---
const INITIAL_NODES = [
  { id: 'firewall', type: 'firewall', label: 'Perimeter FW', ip: '192.168.1.1', status: 'secure', x: 50, y: 10 },
  { id: 'web-server', type: 'server', label: 'IIS Web Srv', ip: '192.168.1.10', status: 'secure', x: 30, y: 40 },
  { id: 'db-server', type: 'database', label: 'SQL DB', ip: '192.168.1.20', status: 'secure', x: 70, y: 40 },
  { id: 'workstation-1', type: 'workstation', label: 'HR PC', ip: '192.168.1.101', status: 'secure', x: 20, y: 80 },
  { id: 'workstation-2', type: 'workstation', label: 'Dev PC', ip: '192.168.1.102', status: 'secure', x: 50, y: 80 },
  { id: 'dc-01', type: 'server', label: 'Domain Controller', ip: '192.168.1.5', status: 'secure', x: 80, y: 80 },
];

let gameState = {
  nodes: JSON.parse(JSON.stringify(INITIAL_NODES)),
  logs: [],
  activeScenario: null,
  defensiveScore: 100,
  operators: [] // List of connected handles
};

// Add initial log
gameState.logs.push({
  timestamp: new Date().toISOString(),
  type: 'INFO',
  source: 'SYSTEM',
  dest: 'SERVER',
  eventId: '0000',
  message: 'Server Uplink Established. Waiting for agents.',
  id: 'init_0'
});

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  let userHandle = null;

  // 1. Send current state immediately on connection
  socket.emit('init_state', gameState);

  // 2. Handle User Join
  socket.on('join', (handle) => {
    userHandle = handle;
    if (!gameState.operators.includes(handle)) {
      gameState.operators.push(handle);
    }
    // Broadcast updated team list
    io.emit('update_team', gameState.operators);
    
    // Log join
    const joinLog = generateLog('INFO', 'SYSTEM', 'AUTH', '1000', `Agent ${handle} connected to the range.`);
    gameState.logs.push(joinLog);
    io.emit('new_log', joinLog);
  });

  // 3. Handle Actions (Scan, Patch, Isolate)
  socket.on('perform_action', (data) => {
    const { actionType, nodeId, handle } = data;
    const node = gameState.nodes.find(n => n.id === nodeId);
    
    if (node) {
      let logMsg = '';
      
      if (actionType === 'isolate') {
        node.status = 'isolated';
        logMsg = `Host ${node.ip} isolated by ${handle}.`;
      } else if (actionType === 'scan') {
        node.status = 'scanning';
        logMsg = `Deep scan initiated on ${node.ip} by ${handle}.`;
        // Revert scan status after 3s
        setTimeout(() => {
           const target = gameState.nodes.find(n => n.id === nodeId);
           if(target && target.status === 'scanning') {
             target.status = 'secure'; // Simplified revert
             io.emit('update_nodes', gameState.nodes);
           }
        }, 3000);
      } else if (actionType === 'patch') {
        node.status = 'secure';
        logMsg = `Patch applied to ${node.ip} by ${handle}.`;
        gameState.defensiveScore = Math.min(100, gameState.defensiveScore + 5);
      }

      const actionLog = generateLog('INFO', handle, node.ip, 'ACTION', logMsg);
      gameState.logs.push(actionLog);
      
      // Broadcast updates
      io.emit('update_nodes', gameState.nodes);
      io.emit('new_log', actionLog);
      io.emit('update_score', gameState.defensiveScore);
    }
  });

  // 4. Handle Scenarios
  socket.on('trigger_scenario', (scenarioId) => {
    if (gameState.activeScenario) return;
    gameState.activeScenario = scenarioId;
    io.emit('scenario_active', scenarioId);
    
    const alertLog = generateLog('ALERT', 'SIEM', 'SOC', '9999', `THREAT DETECTED: Scenario ${scenarioId} initiated.`);
    gameState.logs.push(alertLog);
    io.emit('new_log', alertLog);

    // Simple Server-side Scenario Runner
    setTimeout(() => {
        // Randomly compromise a node
        const targetIndex = Math.floor(Math.random() * gameState.nodes.length);
        gameState.nodes[targetIndex].status = 'compromised';
        gameState.defensiveScore = Math.max(0, gameState.defensiveScore - 15);
        
        const attackLog = generateLog('CRITICAL', 'UNKNOWN', gameState.nodes[targetIndex].ip, 'HACK', 'Malicious activity detected!');
        gameState.logs.push(attackLog);

        io.emit('update_nodes', gameState.nodes);
        io.emit('new_log', attackLog);
        io.emit('update_score', gameState.defensiveScore);
        
        // End scenario
        setTimeout(() => {
            gameState.activeScenario = null;
            io.emit('scenario_active', null);
        }, 5000);

    }, 2000);
  });

  // 5. Handle Reset
  socket.on('reset_sim', () => {
      gameState.nodes = JSON.parse(JSON.stringify(INITIAL_NODES));
      gameState.logs = [];
      gameState.defensiveScore = 100;
      gameState.activeScenario = null;
      io.emit('reset_client', gameState);
  });

  // 6. Handle Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (userHandle) {
      gameState.operators = gameState.operators.filter(op => op !== userHandle);
      io.emit('update_team', gameState.operators);
    }
  });
});

function generateLog(type, source, dest, eventId, message) {
  return {
    timestamp: new Date().toISOString(),
    type, source, dest, eventId, message,
    id: Math.random().toString(36).substr(2, 9)
  };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(port, () => {
  console.log(`CyberRange Server running on port ${port}`);
});
