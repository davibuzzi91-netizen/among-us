// ============================================================================
// AMONG US OFFLINE - Enhanced Game Engine with Roles, Sabotage & Voting
// ============================================================================

// ============================================================================
// Constants & Configuration
// ============================================================================

const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;
const PLAYER_RADIUS = 16;
const PLAYER_SPEED = 200; // pixels per second
const FRICTION = 0.95;

// Game phases
const GAME_PHASE = {
    LOBBY: 'lobby',
    LOADING: 'loading',
    PLAYING: 'playing',
    EMERGENCY: 'emergency',
    VOTING: 'voting',
    RESULTS: 'results',
    GAME_OVER: 'gameOver'
};

// Cores dos players (15 cores agora)
const PLAYER_COLORS = [
    '#FF0000', // Red
    '#0000FF', // Blue
    '#00FF00', // Green
    '#FFFF00', // Yellow
    '#FF6600', // Orange
    '#FF1493', // Pink (Hot Pink)
    '#00FFFF', // Cyan
    '#800080', // Purple
    '#FFA500', // Orange 2
    '#A52A2A', // Brown
    '#008000', // Dark Green
    '#4B0082', // Indigo
    '#FF69B4', // Hot Pink 2
    '#20B2AA', // Light Sea Green
    '#DC143C'  // Crimson
];

// Role types
const ROLE = {
    CREWMATE: 'crewmate',
    IMPOSTOR: 'impostor'
};

// Sabotage types and mechanics
const SABOTAGE_TYPES = {
    DOORS: {
        name: 'Doors',
        duration: 10,
        locations: ['cafeteria', 'weapons', 'o2', 'electrical'],
        fixTime: 5
    },
    O2: {
        name: 'O2',
        duration: 30, // Crew loses in 30 seconds
        locations: ['o2'],
        fixTime: 10,
        requiresMultiplePlayers: true
    },
    REACTOR: {
        name: 'Reactor',
        duration: 45,
        locations: ['reactor'],
        fixTime: 15,
        requiresMultiplePlayers: true
    },
    COMMUNICATIONS: {
        name: 'Communications',
        duration: 15,
        locations: ['communications'],
        fixTime: 8,
        disablesAbilities: true
    },
    LIGHTS: {
        name: 'Lights',
        duration: 15,
        locations: ['electrical'],
        fixTime: 5,
        reducesVision: true
    },
    ELECTRICAL: {
        name: 'Electrical',
        duration: 10,
        locations: ['electrical'],
        fixTime: 8
    }
};

// ============================================================================
// Game State
// ============================================================================

class GameState {
    constructor() {
        this.players = [];
        this.tasks = [];
        this.tasksCompleted = 0;
        this.taskProgress = 0;
        this.paused = false;
        this.debugMode = false;
        this.map = new GameMap();
        this.mouseTarget = null;
        this.gamePhase = GAME_PHASE.LOBBY;
        this.impostorCount = 1;
        this.crewmateCount = 0;

        // Voting/meeting system
        this.currentMeeting = null;
        this.discussionTime = 30;
        this.votingTime = 60;
        this.votes = {};
        this.meetingRound = 0;

        // Sabotage system
        this.activeSabotages = [];
        this.sabotageTimers = {};

        // Bodies
        this.deadBodies = [];

        // Game end conditions
        this.gameEnded = false;
        this.gameWinner = null; // 'impostors' or 'crewmates'

        // Voting UI state (human player)
        this.voteSelection = null; // player id or 'skip', pending confirmation
        this.voteButtons = [];     // populated each render: {x,y,w,h,type,targetId}
    }

    getTotalTasks() {
        return 18;
    }

    updateProgress() {
        this.taskProgress = (this.tasksCompleted / this.getTotalTasks()) * 100;
        this.updateUI();
    }

    updateUI() {
        const progressPercent = Math.round(this.taskProgress);
        if (document.getElementById('progressText')) {
            document.getElementById('progressText').textContent = progressPercent + '%';
        }
        document.documentElement.style.setProperty('--progress-width', progressPercent + '%');
    }
}

// ============================================================================
// Game Map - The Skeld
// ============================================================================

class GameMap {
    constructor() {
        this.rooms = {
            cafeteria: { x: 100, y: 300, width: 200, height: 150, name: 'Cafeteria' },
            weapons: { x: 450, y: 200, width: 150, height: 120, name: 'Weapons' },
            o2: { x: 700, y: 200, width: 140, height: 120, name: 'O2' },
            navigation: { x: 700, y: 400, width: 140, height: 120, name: 'Navigation' },
            shields: { x: 450, y: 500, width: 150, height: 120, name: 'Shields' },
            engines: { x: 100, y: 500, width: 200, height: 150, name: 'Engines' },
            admin: { x: 350, y: 100, width: 130, height: 100, name: 'Admin' },
            communications: { x: 150, y: 100, width: 120, height: 100, name: 'Communications' },
            storage: { x: 100, y: 100, width: 50, height: 50, name: 'Storage' },
            electrical: { x: 700, y: 600, width: 140, height: 120, name: 'Electrical' },
            medbay: { x: 800, y: 50, width: 150, height: 110, name: 'Medbay' },
            security: { x: 50, y: 650, width: 130, height: 100, name: 'Security' },
            reactor: { x: 50, y: 400, width: 150, height: 80, name: 'Reactor' },
            upperEngine: { x: 100, y: 650, width: 100, height: 100, name: 'Upper Engine' }
        };

        this.vents = [
            { id: 0, room: 'cafeteria', x: 150, y: 350, network: 0 },
            { id: 1, room: 'weapons', x: 500, y: 250, network: 1 },
            { id: 2, room: 'o2', x: 750, y: 250, network: 1 },
            { id: 3, room: 'navigation', x: 750, y: 450, network: 2 },
            { id: 4, room: 'shields', x: 500, y: 550, network: 2 },
            { id: 5, room: 'engines', x: 150, y: 550, network: 0 },
            { id: 6, room: 'medbay', x: 850, y: 100, network: 3 },
            { id: 7, room: 'admin', x: 380, y: 120, network: 4 },
            { id: 8, room: 'electrical', x: 750, y: 650, network: 5 },
            { id: 9, room: 'security', x: 100, y: 700, network: 5 }
        ];

        this.cameras = [
            { x: 300, y: 400, room: 'cafeteria' },
            { x: 600, y: 300, room: 'weapons' },
            { x: 800, y: 300, room: 'o2' },
            { x: 600, y: 500, room: 'admin' }
        ];

        this.emergencyButton = { x: 150, y: 350, active: true };
    }

    isWallCollision(x, y, radius) {
        if (x - radius < 0 || x + radius > GAME_WIDTH || y - radius < 0 || y + radius > GAME_HEIGHT) {
            return true;
        }

        for (const room of Object.values(this.rooms)) {
            const closestX = Math.max(room.x, Math.min(x, room.x + room.width));
            const closestY = Math.max(room.y, Math.min(y, room.y + room.height));
            const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);

            if (distance < radius) {
                return false;
            }
        }

        return true;
    }

    getRandomRoomPosition(roomKey) {
        const room = this.rooms[roomKey];
        if (!room) return { x: 300, y: 300 };

        return {
            x: room.x + Math.random() * (room.width - 40) + 20,
            y: room.y + Math.random() * (room.height - 40) + 20
        };
    }

    getNearestRoom(x, y) {
        let nearest = null;
        let minDistance = Infinity;

        for (const [key, room] of Object.entries(this.rooms)) {
            const roomCenterX = room.x + room.width / 2;
            const roomCenterY = room.y + room.height / 2;
            const distance = Math.hypot(x - roomCenterX, y - roomCenterY);

            if (distance < minDistance) {
                minDistance = distance;
                nearest = { key, room };
            }
        }

        return nearest;
    }

    getVentsByNetwork(networkId) {
        return this.vents.filter(v => v.network === networkId);
    }

    getNearestVent(x, y, playerNetworkId) {
        return this.vents.reduce((nearest, vent) => {
            const dist = Math.hypot(x - vent.x, y - vent.y);
            if (dist < (nearest?.dist || Infinity)) {
                return { vent, dist };
            }
            return nearest;
        }, null);
    }
}

// ============================================================================
// Task System
// ============================================================================

class Task {
    constructor(id, name, type, room, subtasks = 1) {
        this.id = id;
        this.name = name;
        this.type = type; // 'common', 'short', 'long'
        this.room = room;
        this.subtasks = subtasks;
        this.completedSubtasks = 0;
        this.completed = false;
        this.assignedTo = null;
        this.inProgress = false;
    }

    completeSubtask() {
        this.completedSubtasks++;
        if (this.completedSubtasks >= this.subtasks) {
            this.completed = true;
            this.inProgress = false;
            return true;
        }
        return false;
    }

    getProgress() {
        return (this.completedSubtasks / this.subtasks) * 100;
    }
}

// ============================================================================
// Player Class
// ============================================================================

class Player {
    constructor(id, x, y, name, isBot = false, colorIndex = 0) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.name = name;
        this.isBot = isBot;
        this.color = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
        this.colorIndex = colorIndex;

        // Role system
        this.role = ROLE.CREWMATE;
        this.isAlive = true;
        this.causeOfDeath = null;
        this.timeOfDeath = null;

        // Movement
        this.vx = 0;
        this.vy = 0;
        this.targetX = x;
        this.targetY = y;

        // Tasks
        this.assignedTasks = [];
        this.currentTask = null;
        this.taskTimer = 0;

        // Impostor abilities
        this.killCooldown = 10; // seconds between kills
        this.killCooldownRemaining = 0;
        this.ventCooldown = 10; // vent cooldown in seconds
        this.ventCooldownRemaining = 0;
        this.isVenting = false;
        this.ventingTime = 0; // max 60 seconds in vent
        this.currentVent = null;

        // Bot specific
        this.pathToRoom = [];
        this.currentTargetRoom = null;
        this.botMemory = {
            seenKills: [],       // {killerId, victimId, room, time}
            witnessedVenting: [], // {playerId, room, time}
            lastSeenRoom: {},    // playerId => {room, time}
            suspicion: {}        // playerId => suspicion score
        };
        this.hasVoted = false;
    }

    canKill() {
        return this.role === ROLE.IMPOSTOR &&
               this.killCooldownRemaining <= 0 &&
               this.isAlive &&
               !this.isVenting;
    }

    canVent() {
        return this.role === ROLE.IMPOSTOR &&
               this.ventCooldownRemaining <= 0 &&
               this.isAlive;
    }

    startVenting(vent) {
        if (this.canVent()) {
            this.isVenting = true;
            this.currentVent = vent;
            this.ventingTime = 60; // 1 minute max
            this.ventCooldownRemaining = this.ventCooldown;
        }
    }

    exitVent() {
        this.isVenting = false;
        this.currentVent = null;
        // Stay in same position or teleport to connected vent
    }

    die(cause = 'killed') {
        this.isAlive = false;
        this.causeOfDeath = cause;
        this.timeOfDeath = Date.now();
    }

    update(deltaTime, map, game) {
        if (!this.isAlive) return;

        // Update cooldowns
        if (this.killCooldownRemaining > 0) {
            this.killCooldownRemaining -= deltaTime;
        }
        if (this.ventCooldownRemaining > 0) {
            this.ventCooldownRemaining -= deltaTime;
        }

        if (this.isVenting) {
            this.ventingTime -= deltaTime;
            if (this.ventingTime <= 0) {
                this.exitVent();
            }
        }

        if (this.isBot) {
            this.updateBot(deltaTime, map, game);
            this.observeOthers(game);
        } else {
            this.updateMovement(deltaTime, map);
        }
    }

    // Bots remember which room they last saw each other player in,
    // and whether anyone was alone with a player who later died.
    observeOthers(game) {
        const myRoom = game.state.map.getNearestRoom(this.x, this.y);
        if (!myRoom) return;

        for (const other of game.state.players) {
            if (other === this || !other.isAlive) continue;
            const dist = Math.hypot(this.x - other.x, this.y - other.y);
            if (dist < 180) {
                this.botMemory.lastSeenRoom[other.id] = {
                    room: myRoom.key,
                    time: Date.now()
                };

                // Catch impostors venting in view
                if (other.isVenting && other.role === ROLE.IMPOSTOR) {
                    this.botMemory.witnessedVenting.push({
                        playerId: other.id,
                        room: myRoom.key,
                        time: Date.now()
                    });
                    this.raiseSuspicion(other.id, 50);
                }
            }
        }
    }

    raiseSuspicion(playerId, amount) {
        this.botMemory.suspicion[playerId] = (this.botMemory.suspicion[playerId] || 0) + amount;
    }

    // Called when a body is discovered - bots who were near the victim
    // recently, or near the killer, update their suspicion.
    reactToBodyFound(body, game) {
        const victimLastSeen = Object.entries(this.botMemory.lastSeenRoom)
            .find(([id]) => parseInt(id) === body.playerId);

        // Anyone who was alone (no witnesses) in the same room as the victim
        // right before death becomes suspicious to this bot.
        for (const other of game.state.players) {
            if (other === this || other.id === body.playerId) continue;
            const seen = this.botMemory.lastSeenRoom[other.id];
            if (seen && seen.room === body.room && Date.now() - seen.time < 8000) {
                this.raiseSuspicion(other.id, 25);
            }
        }

        // Witnessed venting nearby raises suspicion further
        for (const witness of this.botMemory.witnessedVenting) {
            if (witness.room === body.room) {
                this.raiseSuspicion(witness.playerId, 30);
            }
        }
    }

    // Intelligent vote decision: picks whoever has the highest suspicion
    // score above a threshold; otherwise skips rather than voting randomly.
    decideVote(game) {
        const alive = game.state.players.filter(p => p.isAlive && p !== this);
        if (alive.length === 0) return 'skip';

        let best = null;
        let bestScore = 0;
        for (const player of alive) {
            const score = this.botMemory.suspicion[player.id] || 0;
            if (score > bestScore) {
                bestScore = score;
                best = player;
            }
        }

        // Impostor bots deflect: vote for a crewmate to blend in, or skip
        if (this.role === ROLE.IMPOSTOR) {
            const crewmates = alive.filter(p => p.role === ROLE.CREWMATE);
            if (crewmates.length > 0 && Math.random() < 0.6) {
                return crewmates[Math.floor(Math.random() * crewmates.length)].id;
            }
            return 'skip';
        }

        // Crewmates need real evidence (suspicion threshold) to accuse
        if (best && bestScore >= 25) {
            return best.id;
        }
        return 'skip';
    }

    updateMovement(deltaTime, map) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 5) {
            const ratio = Math.min(1, (PLAYER_SPEED * deltaTime) / distance);
            this.x += dx * ratio;
            this.y += dy * ratio;
        } else {
            this.x = this.targetX;
            this.y = this.targetY;
            this.vx = 0;
            this.vy = 0;
        }
    }

    updateBot(deltaTime, map, game) {
        // Bot AI - navigate rooms, complete tasks, or hunt as impostor
        if (this.role === ROLE.IMPOSTOR) {
            this.updateImpostorBot(deltaTime, map, game);
        } else {
            this.updateCrewmateBot(deltaTime, map, game);
        }
    }

    updateCrewmateBot(deltaTime, map, game) {
        if (this.currentTask && this.currentTask.completed) {
            this.currentTask = null;
        }

        if (!this.currentTask) {
            this.currentTask = this.assignedTasks.find(t => !t.completed);
            if (this.currentTask && !this.currentTargetRoom) {
                this.currentTargetRoom = this.currentTask.room;
                this.findPathToRoom(map);
            }
        }

        if (this.pathToRoom && this.pathToRoom.length > 0) {
            const target = this.pathToRoom[0];
            const room = map.rooms[target];
            const targetX = room.x + room.width / 2;
            const targetY = room.y + room.height / 2;

            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const distance = Math.hypot(dx, dy);

            if (distance > 30) {
                const ratio = Math.min(1, (PLAYER_SPEED * deltaTime) / distance);
                this.x += dx * ratio;
                this.y += dy * ratio;
            } else {
                this.pathToRoom.shift();
            }
        }

        if (this.currentTask) {
            const room = map.rooms[this.currentTask.room];
            const distToRoom = Math.hypot(this.x - (room.x + room.width / 2), this.y - (room.y + room.height / 2));

            if (distToRoom < 100) {
                if (!this.taskTimer) {
                    this.taskTimer = this.currentTask.type === 'common' ? 5 :
                                    this.currentTask.type === 'short' ? 10 :
                                    this.currentTask.type === 'long' ? 15 : 10;
                }

                this.taskTimer -= deltaTime;
                if (this.taskTimer <= 0) {
                    this.currentTask.completeSubtask();
                    this.taskTimer = 0;
                }
            }
        }

        // Report bodies when nearby
        if (game.state.deadBodies.length > 0) {
            const nearbyBody = game.state.deadBodies.find(body => {
                const dist = Math.hypot(this.x - body.x, this.y - body.y);
                return dist < 100 && !body.reported;
            });

            if (nearbyBody) {
                nearbyBody.reported = true;
                game.startEmergencyMeeting(this.id, nearbyBody.playerId);
            }
        }
    }

    updateImpostorBot(deltaTime, map, game) {
        // Hunt crewmates intelligently
        const aliveCrewmates = game.state.players.filter(p =>
            p.isAlive && p.role === ROLE.CREWMATE && p !== this
        );

        if (aliveCrewmates.length > 0 && this.canKill()) {
            // Find nearest crewmate
            const target = aliveCrewmates.reduce((nearest, player) => {
                const dist = Math.hypot(this.x - player.x, this.y - player.y);
                if (dist < (nearest?.dist || Infinity)) {
                    return { player, dist };
                }
                return nearest;
            }, null);

            if (target && target.dist < 100) {
                // Kill nearby crewmate
                this.killPlayer(target.player, game);
            } else if (target) {
                // Move towards nearest crewmate
                const dx = target.player.x - this.x;
                const dy = target.player.y - this.y;
                const dist = Math.hypot(dx, dy);
                const ratio = Math.min(1, (PLAYER_SPEED * deltaTime) / dist);
                this.x += dx * ratio;
                this.y += dy * ratio;
            }
        }

        // Occasionally sabotage to create chaos/opportunity (only if none active)
        if (Math.random() < 0.0015 && game.state.activeSabotages.length === 0) {
            const types = Object.keys(SABOTAGE_TYPES);
            const choice = types[Math.floor(Math.random() * types.length)];
            game.triggerSabotage(choice);
        }

        // Random venting
        if (Math.random() < 0.02 && this.canVent()) {
            const vents = map.vents;
            const nearestVent = vents.reduce((nearest, vent) => {
                const dist = Math.hypot(this.x - vent.x, this.y - vent.y);
                if (dist < (nearest?.dist || Infinity)) {
                    return { vent, dist };
                }
                return nearest;
            }, null);

            if (nearestVent && nearestVent.dist < 50) {
                this.startVenting(nearestVent.vent);
            }
        }
    }

    killPlayer(target, game) {
        if (!target.isAlive || this.killCooldownRemaining > 0) return;

        target.die('killed');
        this.killCooldownRemaining = this.killCooldown;

        const nearestRoom = game.state.map.getNearestRoom(target.x, target.y);

        // Add body
        const body = {
            x: target.x,
            y: target.y,
            playerId: target.id,
            playerColor: target.color,
            playerName: target.name,
            room: nearestRoom ? nearestRoom.key : null,
            killerId: this.id,
            reported: false
        };
        game.state.deadBodies.push(body);

        // Any bot that happened to witness the kill directly becomes very suspicious
        for (const witness of game.state.players) {
            if (witness === this || witness === target || !witness.isAlive || !witness.isBot) continue;
            const dist = Math.hypot(witness.x - this.x, witness.y - this.y);
            if (dist < 150) {
                witness.raiseSuspicion(this.id, 80);
            }
        }
    }

    findPathToRoom(map) {
        const nearestRoom = map.getNearestRoom(this.x, this.y);
        const targetRoom = this.currentTargetRoom;

        const path = [];
        if (nearestRoom.key !== targetRoom) {
            path.push(nearestRoom.key);
            path.push(targetRoom);
        } else {
            path.push(targetRoom);
        }

        this.pathToRoom = path;
    }
}

// ============================================================================
// Meeting & Voting System
// ============================================================================

class Meeting {
    constructor(initiatorId = null, reportedBodyId = null) {
        this.initiatorId = initiatorId;
        this.reportedBodyId = reportedBodyId; // null for emergency button
        this.phase = 'discussion'; // 'discussion', 'voting', 'results'
        this.timeRemaining = 30; // discussion time
        this.votes = {}; // playerId => targetId
        this.results = null;
    }

    addVote(voterId, targetId) {
        this.votes[voterId] = targetId;
    }

    getVoteCount(targetId) {
        return Object.values(this.votes).filter(v => v === targetId).length;
    }

    getResults() {
        const voteCounts = {};
        let skips = 0;
        for (const targetId of Object.values(this.votes)) {
            if (targetId === 'skip') {
                skips++;
                continue;
            }
            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        }

        const counts = Object.values(voteCounts);
        const maxVotes = counts.length ? Math.max(...counts) : 0;
        const mostVoted = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);

        if (maxVotes === 0 || skips >= maxVotes) {
            return { ejected: null, reason: skips > 0 ? 'skipped' : 'no_votes', voteCounts };
        } else if (mostVoted.length > 1) {
            return { ejected: null, reason: 'tie', voteCounts };
        } else {
            return { ejected: parseInt(mostVoted[0]), reason: 'voted', voteCounts };
        }
    }
}

// ============================================================================
// Main Game Class
// ============================================================================

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = new GameState();
        this.lastTime = Date.now();
        this.frameCount = 0;
        this.fps = 0;

        // Input
        this.keys = {};
        this.mouseX = GAME_WIDTH / 2;
        this.mouseY = GAME_HEIGHT / 2;

        this.setupEventListeners();
        this.showLobby();
    }

    showLobby() {
        this.state.gamePhase = GAME_PHASE.LOBBY;
        this.state.lobbySelectedColor = 0;
        this.state.lobbyShowCustomize = false;
        this.state.lobbyButtons = [];
        this._lobbyStars = Array.from({ length: 120 }, () => ({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT,
            size: Math.random() * 1.8 + 0.3,
            speed: Math.random() * 15 + 5
        }));
        this.lastTime = Date.now();
        this.lobbyLoop();
    }

    lobbyLoop = () => {
        const now = Date.now();
        const deltaTime = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;

        this.renderLobby(deltaTime);

        if (this.state.gamePhase === GAME_PHASE.LOBBY) {
            requestAnimationFrame(this.lobbyLoop);
        }
    };

    renderLobby(deltaTime) {
        // Background space
        this.ctx.fillStyle = '#05050f';
        this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Drifting stars
        for (const star of this._lobbyStars) {
            star.x -= star.speed * deltaTime;
            if (star.x < 0) star.x = GAME_WIDTH;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fillRect(star.x, star.y, star.size, star.size);
        }

        // The Skeld flying through space (simplified silhouette)
        this.drawSkeldShip();

        if (this.state.lobbyShowCustomize) {
            this.drawCustomizeScreen();
        } else {
            this.drawLobbyMain();
        }
    }

    drawSkeldShip() {
        const cx = GAME_WIDTH / 2;
        const cy = 220;
        const t = Date.now() / 1000;
        const bob = Math.sin(t * 0.6) * 6;

        this.ctx.save();
        this.ctx.translate(cx, cy + bob);

        // Hull
        this.ctx.fillStyle = '#c9c9d4';
        this.ctx.beginPath();
        this.ctx.moveTo(-180, -40);
        this.ctx.lineTo(120, -40);
        this.ctx.quadraticCurveTo(200, -40, 200, 0);
        this.ctx.quadraticCurveTo(200, 40, 120, 40);
        this.ctx.lineTo(-180, 40);
        this.ctx.quadraticCurveTo(-220, 0, -180, -40);
        this.ctx.closePath();
        this.ctx.fill();

        // Red stripe
        this.ctx.fillStyle = '#c0392b';
        this.ctx.fillRect(-180, -8, 360, 16);

        // Cockpit window
        this.ctx.fillStyle = '#4ad1e0';
        this.ctx.beginPath();
        this.ctx.ellipse(150, 0, 25, 20, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Engine glow
        this.ctx.fillStyle = 'rgba(100,180,255,0.6)';
        this.ctx.beginPath();
        this.ctx.ellipse(-200, 0, 20 + Math.sin(t * 5) * 4, 12, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    drawLobbyMain() {
        this.state.lobbyButtons = [];

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 42px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('AMONG US OFFLINE', GAME_WIDTH / 2, 420);

        // Player preview
        const previewColor = PLAYER_COLORS[this.state.lobbySelectedColor];
        this.ctx.fillStyle = previewColor;
        this.ctx.beginPath();
        this.ctx.arc(GAME_WIDTH / 2, 500, 30, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.fillStyle = '#AAFFFF';
        this.ctx.beginPath();
        this.ctx.arc(GAME_WIDTH / 2 + 9, 490, 11, 0, Math.PI * 2);
        this.ctx.fill();

        // Hat icon above the preview (opens customize screen)
        const hatX = GAME_WIDTH / 2 + 40;
        const hatY = 465;
        this.ctx.fillStyle = '#8B4513';
        this.ctx.beginPath();
        this.ctx.ellipse(hatX, hatY + 6, 16, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillRect(hatX - 10, hatY - 10, 20, 14);
        this.state.lobbyButtons.push({ x: hatX - 20, y: hatY - 20, w: 40, h: 40, type: 'hat' });

        // "Personalizar" button
        const custBtnW = 200, custBtnH = 48;
        const custBtnX = GAME_WIDTH / 2 - custBtnW / 2;
        const custBtnY = 560;
        this.ctx.fillStyle = '#2E8B57';
        this.ctx.fillRect(custBtnX, custBtnY, custBtnW, custBtnH);
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(custBtnX, custBtnY, custBtnW, custBtnH);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.fillText('PERSONALIZAR', GAME_WIDTH / 2, custBtnY + 30);
        this.state.lobbyButtons.push({ x: custBtnX, y: custBtnY, w: custBtnW, h: custBtnH, type: 'customize' });

        // "Jogar" button
        const playBtnW = 200, playBtnH = 56;
        const playBtnX = GAME_WIDTH / 2 - playBtnW / 2;
        const playBtnY = 630;
        this.ctx.fillStyle = '#C0392B';
        this.ctx.fillRect(playBtnX, playBtnY, playBtnW, playBtnH);
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(playBtnX, playBtnY, playBtnW, playBtnH);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 22px Arial';
        this.ctx.fillText('JOGAR', GAME_WIDTH / 2, playBtnY + 36);
        this.state.lobbyButtons.push({ x: playBtnX, y: playBtnY, w: playBtnW, h: playBtnH, type: 'play' });
    }

    drawCustomizeScreen() {
        this.state.lobbyButtons = [];

        this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 26px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ESCOLHA SUA COR', GAME_WIDTH / 2, 320);

        // Preview with current selection
        const previewColor = PLAYER_COLORS[this.state.lobbySelectedColor];
        this.ctx.fillStyle = previewColor;
        this.ctx.beginPath();
        this.ctx.arc(GAME_WIDTH / 2, 360, 22, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // 15 color swatches in a grid
        const cols = 5;
        const swatchSize = 46;
        const gap = 12;
        const gridWidth = cols * swatchSize + (cols - 1) * gap;
        const startX = (GAME_WIDTH - gridWidth) / 2;
        const startY = 410;

        PLAYER_COLORS.forEach((color, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (swatchSize + gap);
            const y = startY + row * (swatchSize + gap);
            const selected = this.state.lobbySelectedColor === i;

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x + swatchSize / 2, y + swatchSize / 2, swatchSize / 2 - 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = selected ? '#FFD700' : '#FFFFFF';
            this.ctx.lineWidth = selected ? 4 : 2;
            this.ctx.stroke();

            this.state.lobbyButtons.push({ x, y, w: swatchSize, h: swatchSize, type: 'color', colorIndex: i });
        });

        // Close / confirm button
        const closeBtnW = 160, closeBtnH = 44;
        const closeBtnX = GAME_WIDTH / 2 - closeBtnW / 2;
        const closeBtnY = startY + 3 * (swatchSize + gap) + 16;
        this.ctx.fillStyle = '#2E8B57';
        this.ctx.fillRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH);
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText('CONFIRMAR', GAME_WIDTH / 2, closeBtnY + 28);
        this.state.lobbyButtons.push({ x: closeBtnX, y: closeBtnY, w: closeBtnW, h: closeBtnH, type: 'confirmCustomize' });
    }

    handleLobbyClick(x, y) {
        for (const btn of this.state.lobbyButtons) {
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                if (btn.type === 'hat' || btn.type === 'customize') {
                    this.state.lobbyShowCustomize = true;
                } else if (btn.type === 'confirmCustomize') {
                    this.state.lobbyShowCustomize = false;
                } else if (btn.type === 'color') {
                    this.state.lobbySelectedColor = btn.colorIndex;
                } else if (btn.type === 'play') {
                    this.startGame();
                }
                return;
            }
        }
    }

    startGame() {
        this.initGame();
        // Note: setupEventListeners() already ran once in the constructor;
        // calling it again would register duplicate DOM listeners (each
        // click/keypress firing the handler twice, e.g. double-toggling
        // vote selection back to null).
        this.start();

        if (document.getElementById('playerName')) {
            document.getElementById('playerName').textContent = this.state.players[0].name;
        }
        if (document.getElementById('playerStatus')) {
            const role = this.state.players[0].role === ROLE.IMPOSTOR ? 'Impostor' : 'Crewmate';
            document.getElementById('playerStatus').textContent = role;
        }
    }

    initGame() {
        this.state.players = [];
        this.state.tasks = [];
        this.state.tasksCompleted = 0;
        this.state.activeSabotages = [];
        this.state.deadBodies = [];
        this.state.gameEnded = false;
        this.state.currentMeeting = null;

        // Create human player (with color chosen in the lobby)
        const humanColorIndex = this.state.lobbySelectedColor ?? 0;
        const player = new Player(0, 300, 300, 'You', false, humanColorIndex);
        this.state.players.push(player);

        // Create bots, each getting a color that isn't already taken
        const usedColors = new Set([humanColorIndex]);
        const botCount = 4;
        for (let i = 1; i <= botCount; i++) {
            let colorIndex = i;
            while (usedColors.has(colorIndex % PLAYER_COLORS.length)) {
                colorIndex++;
            }
            colorIndex = colorIndex % PLAYER_COLORS.length;
            usedColors.add(colorIndex);

            const pos = this.state.map.getRandomRoomPosition(Object.keys(this.state.map.rooms)[i]);
            const bot = new Player(i, pos.x, pos.y, `Bot${i}`, true, colorIndex);
            this.state.players.push(bot);
        }

        // Assign roles
        this.assignRoles();

        // Create tasks
        this.initTasks();
        this.assignTasks();

        // Set game phase
        this.state.gamePhase = GAME_PHASE.PLAYING;
        this.state.updateProgress();
    }

    assignRoles() {
        const playerCount = this.state.players.length;
        const impostorCount = Math.ceil(playerCount / 3); // 1 impostor per 3 players

        // Shuffle and assign
        const shuffled = [...this.state.players].sort(() => Math.random() - 0.5);

        for (let i = 0; i < impostorCount; i++) {
            shuffled[i].role = ROLE.IMPOSTOR;
        }

        this.state.impostorCount = impostorCount;
        this.state.crewmateCount = playerCount - impostorCount;
    }

    initTasks() {
        let taskId = 0;

        this.state.tasks.push(new Task(taskId++, 'Fix Wiring', 'common', 'admin', 3));
        this.state.tasks.push(new Task(taskId++, 'Swipe Card', 'common', 'admin', 1));
        this.state.tasks.push(new Task(taskId++, 'Align Engine Output', 'short', 'engines', 1));
        this.state.tasks.push(new Task(taskId++, 'Calibrate Distributor', 'short', 'electrical', 1));
        this.state.tasks.push(new Task(taskId++, 'Chart Course', 'short', 'navigation', 1));
        this.state.tasks.push(new Task(taskId++, 'Clean O2 Filter', 'short', 'o2', 1));
        this.state.tasks.push(new Task(taskId++, 'Divert Power', 'short', 'electrical', 1));
        this.state.tasks.push(new Task(taskId++, 'Prime Shields', 'short', 'shields', 1));
        this.state.tasks.push(new Task(taskId++, 'Stabilize Steering', 'short', 'weapons', 1));
        this.state.tasks.push(new Task(taskId++, 'Clear Asteroids', 'short', 'weapons', 1));
        this.state.tasks.push(new Task(taskId++, 'Empty Garbage', 'long', 'cafeteria', 2));
        this.state.tasks.push(new Task(taskId++, 'Empty Chute', 'long', 'security', 1));
        this.state.tasks.push(new Task(taskId++, 'Fuel Engines', 'long', 'engines', 2));
        this.state.tasks.push(new Task(taskId++, 'Inspect Sample', 'long', 'medbay', 1));
        this.state.tasks.push(new Task(taskId++, 'Start Reactor', 'long', 'reactor', 1));
        this.state.tasks.push(new Task(taskId++, 'Submit Scan', 'long', 'medbay', 1));
        this.state.tasks.push(new Task(taskId++, 'Download Data', 'long', 'admin', 2));
        this.state.tasks.push(new Task(taskId++, 'Upload Data', 'short', 'admin', 1));
    }

    assignTasks() {
        const crewmates = this.state.players.filter(p => p.role === ROLE.CREWMATE);
        let taskIndex = 0;

        for (const task of this.state.tasks) {
            const crewmate = crewmates[taskIndex % crewmates.length];
            task.assignedTo = crewmate.id;
            crewmate.assignedTasks.push(task);
            taskIndex++;
        }
    }

    startEmergencyMeeting(initiatorId = null, reportedBodyId = null) {
        if (this.state.currentMeeting) return; // Already in a meeting

        this.state.gamePhase = GAME_PHASE.EMERGENCY;
        this.state.currentMeeting = new Meeting(initiatorId, reportedBodyId);
        this.state.currentMeeting.timeRemaining = 30; // Discussion time

        // Let bots analyze the body/scene for evidence before discussion starts
        if (reportedBodyId !== null) {
            const body = this.state.deadBodies.find(b => b.playerId === reportedBodyId);
            if (body) {
                for (const bot of this.state.players.filter(p => p.isBot && p.isAlive)) {
                    bot.reactToBodyFound(body, this);
                }
            }
        }

        // Reset per-meeting vote flags
        for (const p of this.state.players) p.hasVoted = false;
        this.state.voteSelection = null;

        // Players stop moving/venting during the meeting
        for (const p of this.state.players) {
            if (p.isVenting) p.exitVent();
        }
    }

    startVoting() {
        if (!this.state.currentMeeting) return;

        this.state.gamePhase = GAME_PHASE.VOTING;
        this.state.currentMeeting.phase = 'voting';
        this.state.currentMeeting.timeRemaining = 60; // Voting time

        // Bots cast their (intelligent, evidence-based) votes with a little
        // stagger so it doesn't feel instant/robotic.
        const bots = this.state.players.filter(p => p.isBot && p.isAlive);
        for (const bot of bots) {
            const delay = 1000 + Math.random() * 15000;
            setTimeout(() => {
                if (!this.state.currentMeeting || this.state.currentMeeting.phase !== 'voting') return;
                if (bot.hasVoted || !bot.isAlive) return;
                const choice = bot.decideVote(this);
                this.state.currentMeeting.addVote(bot.id, choice);
                bot.hasVoted = true;
            }, delay);
        }
    }

    endVoting() {
        if (!this.state.currentMeeting) return;

        const results = this.state.currentMeeting.getResults();

        if (results.ejected !== null) {
            const ejected = this.state.players.find(p => p.id === results.ejected);
            if (ejected) {
                ejected.die('ejected');
            }
        }

        this.state.gamePhase = GAME_PHASE.RESULTS;
        this.state.currentMeeting.results = results;
        this.state.currentMeeting.phase = 'results';
        this.state.currentMeeting.resultsStartTime = Date.now();

        // Clear the reported body once the meeting resolves it
        if (this.state.currentMeeting.reportedBodyId !== null) {
            this.state.deadBodies = this.state.deadBodies.filter(
                b => b.playerId !== this.state.currentMeeting.reportedBodyId
            );
        }

        // Reset meeting after results display
        setTimeout(() => {
            this.state.currentMeeting = null;
            this.state.voteSelection = null;
            this.state.gamePhase = GAME_PHASE.PLAYING;
            this.checkGameEnd();
        }, 4500);
    }

    // --- Sabotage system -----------------------------------------------
    // Impostors can trigger a sabotage; some are lethal if not fixed in
    // time (O2, Reactor), others just hinder crewmates (Lights, Comms,
    // Doors, Electrical). Fixing most needs a crewmate "using" the panel
    // at its location; O2/Reactor need two crewmates at separate panels.
    triggerSabotage(type) {
        if (this.state.activeSabotages.some(s => s.type === type)) return false;

        const def = SABOTAGE_TYPES[type];
        if (!def) return false;

        const sabotage = {
            type,
            def,
            timeRemaining: def.duration,
            fixedPanels: new Set(), // for multi-panel sabotages (O2/Reactor)
            requiredPanels: def.requiresMultiplePlayers ? 2 : 1
        };
        this.state.activeSabotages.push(sabotage);

        if (def.name === 'Doors') {
            for (const roomKey of def.locations) {
                if (this.state.map.rooms[roomKey]) {
                    this.state.map.rooms[roomKey].doorsLocked = true;
                }
            }
        }

        return true;
    }

    fixSabotagePanel(type) {
        const sabotage = this.state.activeSabotages.find(s => s.type === type);
        if (!sabotage) return;

        sabotage.fixedPanels.add(this.state.players[0].id);
        if (sabotage.fixedPanels.size >= sabotage.requiredPanels) {
            this.resolveSabotage(sabotage);
        }
    }

    resolveSabotage(sabotage) {
        if (sabotage.def.name === 'Doors') {
            for (const roomKey of sabotage.def.locations) {
                if (this.state.map.rooms[roomKey]) {
                    this.state.map.rooms[roomKey].doorsLocked = false;
                }
            }
        }
        this.state.activeSabotages = this.state.activeSabotages.filter(s => s !== sabotage);
    }

    updateSabotages(deltaTime) {
        for (const sabotage of [...this.state.activeSabotages]) {
            sabotage.timeRemaining -= deltaTime;

            // Crewmate bots path toward the sabotage location and auto-fix
            // when they arrive (abstraction for the panel minigame).
            const location = sabotage.def.locations[0];
            const room = this.state.map.rooms[location];
            if (room) {
                const crewmateBots = this.state.players.filter(p =>
                    p.isBot && p.isAlive && p.role === ROLE.CREWMATE &&
                    !sabotage.fixedPanels.has(p.id)
                );
                for (const bot of crewmateBots.slice(0, sabotage.requiredPanels)) {
                    const dist = Math.hypot(bot.x - (room.x + room.width / 2), bot.y - (room.y + room.height / 2));
                    if (dist < 100) {
                        sabotage.fixedPanels.add(bot.id);
                    } else {
                        // steer bot toward the sabotage - overrides normal task pathing briefly
                        bot.currentTargetRoom = location;
                        bot.pathToRoom = [location];
                    }
                }
            }

            if (sabotage.fixedPanels.size >= sabotage.requiredPanels) {
                this.resolveSabotage(sabotage);
                continue;
            }

            // Lethal sabotages end the game for crewmates if the timer runs out
            if ((sabotage.type === 'O2' || sabotage.type === 'REACTOR') && sabotage.timeRemaining <= 0) {
                this.resolveSabotage(sabotage);
                this.endGame('impostors');
            } else if (sabotage.timeRemaining <= 0) {
                // Non-lethal sabotages simply expire
                this.resolveSabotage(sabotage);
            }
        }
    }

    checkGameEnd() {
        const aliveImpostors = this.state.players.filter(p => p.isAlive && p.role === ROLE.IMPOSTOR);
        const aliveCrewmates = this.state.players.filter(p => p.isAlive && p.role === ROLE.CREWMATE);
        const tasksCompleted = this.state.tasks.every(t => t.completed);

        if (aliveImpostors.length === 0) {
            this.endGame('crewmates');
        } else if (aliveImpostors.length >= aliveCrewmates.length) {
            this.endGame('impostors');
        } else if (tasksCompleted) {
            this.endGame('crewmates');
        }
    }

    endGame(winner) {
        this.state.gameEnded = true;
        this.state.gameWinner = winner;
        this.state.gamePhase = GAME_PHASE.GAME_OVER;
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;

            if (e.key === 'Escape') {
                if (this.state.gamePhase === GAME_PHASE.GAME_OVER) {
                    this.showLobby();
                } else if (this.state.gamePhase === GAME_PHASE.PLAYING) {
                    this.togglePause();
                }
            }

            if (e.key.toLowerCase() === 't') {
                this.tryCompleteTask();
            }

            if (e.key.toLowerCase() === 'd') {
                this.state.debugMode = !this.state.debugMode;
            }

            if (e.key.toLowerCase() === 'r' && this.state.players[0].role === ROLE.IMPOSTOR) {
                this.tryKill();
            }

            if (e.key.toLowerCase() === 'v' && this.state.players[0].role === ROLE.IMPOSTOR) {
                this.tryVent();
            }

            if (e.key.toLowerCase() === 'e') {
                this.tryEmergencyButton();
            }

            if (e.key.toLowerCase() === 'b' && this.state.players[0].role === ROLE.IMPOSTOR) {
                this.state.showSabotageMenu = !this.state.showSabotageMenu;
            }

            if (this.state.showSabotageMenu && /^[1-6]$/.test(e.key)) {
                const types = Object.keys(SABOTAGE_TYPES);
                const idx = parseInt(e.key) - 1;
                if (types[idx] && this.state.activeSabotages.length === 0) {
                    this.triggerSabotage(types[idx]);
                    this.state.showSabotageMenu = false;
                }
            }

            if (e.key.toLowerCase() === 'f') {
                // Fix the sabotage panel nearest to the player
                const player = this.state.players[0];
                for (const sabotage of this.state.activeSabotages) {
                    const room = this.state.map.rooms[sabotage.def.locations[0]];
                    if (!room) continue;
                    const dist = Math.hypot(player.x - (room.x + room.width / 2), player.y - (room.y + room.height / 2));
                    if (dist < 100) {
                        this.fixSabotagePanel(sabotage.type);
                        break;
                    }
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = GAME_WIDTH / rect.width;
            const scaleY = GAME_HEIGHT / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;

            if (this.state.gamePhase === GAME_PHASE.LOBBY) {
                this.handleLobbyClick(x, y);
                return;
            }

            if (this.state.gamePhase === GAME_PHASE.VOTING) {
                this.handleVoteClick(x, y);
                return;
            }

            if (this.state.gamePhase === GAME_PHASE.PLAYING) {
                if (this.handleInteractClick(x, y)) return;
            }

            const player = this.state.players[0];
            player.targetX = x;
            player.targetY = y;
        });

        // Pause and restart buttons
        if (document.getElementById('resumeBtn')) {
            document.getElementById('resumeBtn').addEventListener('click', () => {
                this.togglePause();
            });
        }

        if (document.getElementById('restartBtn')) {
            document.getElementById('restartBtn').addEventListener('click', () => {
                location.reload();
            });
        }

        if (document.getElementById('debugToggle')) {
            document.getElementById('debugToggle').addEventListener('change', (e) => {
                this.state.debugMode = e.target.checked;
            });
        }
    }

    handleInput() {
        const player = this.state.players[0];
        const moveSpeed = PLAYER_SPEED;

        let moveX = 0;
        let moveY = 0;

        if (this.keys['w']) moveY -= moveSpeed;
        if (this.keys['s']) moveY += moveSpeed;
        if (this.keys['a']) moveX -= moveSpeed;
        if (this.keys['d']) moveX += moveSpeed;

        if (moveX !== 0 || moveY !== 0) {
            const length = Math.hypot(moveX, moveY);
            player.targetX = player.x + (moveX / length) * moveSpeed * 0.1;
            player.targetY = player.y + (moveY / length) * moveSpeed * 0.1;
        }
    }

    tryKill() {
        const player = this.state.players[0];
        if (!player.canKill()) return;

        // Find nearby crewmates
        const nearbyPlayers = this.state.players.filter(p => {
            const dist = Math.hypot(player.x - p.x, player.y - p.y);
            return dist < 100 && p !== player && p.isAlive && p.role === ROLE.CREWMATE;
        });

        if (nearbyPlayers.length > 0) {
            player.killPlayer(nearbyPlayers[0], this);
        }
    }

    tryVent() {
        const player = this.state.players[0];
        if (!player.canVent()) return;

        if (player.isVenting) {
            player.exitVent();
        } else {
            const nearestVent = this.state.map.vents.reduce((nearest, vent) => {
                const dist = Math.hypot(player.x - vent.x, player.y - vent.y);
                if (dist < (nearest?.dist || Infinity) && dist < 50) {
                    return { vent, dist };
                }
                return nearest;
            }, null);

            if (nearestVent) {
                player.startVenting(nearestVent.vent);
            }
        }
    }

    tryEmergencyButton() {
        const player = this.state.players[0];
        const buttonDist = Math.hypot(
            player.x - this.state.map.emergencyButton.x,
            player.y - this.state.map.emergencyButton.y
        );

        if (buttonDist < 100 && this.state.map.emergencyButton.active) {
            this.startEmergencyMeeting(player.id);
        }
    }

    tryCompleteTask() {
        const player = this.state.players[0];
        if (player.role === ROLE.IMPOSTOR) return; // Impostors can't complete real tasks

        const nearbyTask = this.state.tasks.find(task => {
            const room = this.state.map.rooms[task.room];
            const distance = Math.hypot(
                player.x - (room.x + room.width / 2),
                player.y - (room.y + room.height / 2)
            );
            return distance < 150 && !task.completed;
        });

        if (nearbyTask) {
            if (nearbyTask.completeSubtask()) {
                this.state.tasksCompleted++;
                this.state.updateProgress();
                this.checkGameEnd();
            }
        }
    }

    update(deltaTime) {
        if (this.state.paused || this.state.gamePhase === GAME_PHASE.LOBBY) return;

        // Update all players
        for (const player of this.state.players) {
            player.update(deltaTime, this.state.map, this);
        }

        // Update active sabotages
        if (this.state.activeSabotages.length > 0) {
            this.updateSabotages(deltaTime);
        }

        // Update meeting timer
        if (this.state.currentMeeting) {
            this.state.currentMeeting.timeRemaining -= deltaTime;

            if (this.state.currentMeeting.phase === 'discussion' && this.state.currentMeeting.timeRemaining <= 0) {
                this.startVoting();
            } else if (this.state.currentMeeting.phase === 'voting' && this.state.currentMeeting.timeRemaining <= 0) {
                this.endVoting();
            }
        }

        // Check for completed tasks
        let completedCount = 0;
        for (const task of this.state.tasks) {
            if (task.completed) completedCount++;
        }
        this.state.tasksCompleted = completedCount;
        this.state.updateProgress();

        // Handle input
        this.handleInput();

        // Update debug info
        if (this.state.debugMode) {
            this.updateDebugInfo();
        }
    }

    render() {
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        if (this.state.gamePhase === GAME_PHASE.PLAYING) {
            this.drawMap();
            for (const player of this.state.players) {
                if (player.isAlive) {
                    this.drawPlayer(player);
                }
            }

            // Draw dead bodies
            for (const body of this.state.deadBodies) {
                this.drawDeadBody(body);
            }

            this.drawTaskUI();
            this.drawInteractButton();
            this.drawSabotageAlert();
            if (this.state.showSabotageMenu) this.drawSabotageMenu();
        } else if (this.state.gamePhase === GAME_PHASE.EMERGENCY || this.state.gamePhase === GAME_PHASE.VOTING) {
            this.drawMeetingUI();
        } else if (this.state.gamePhase === GAME_PHASE.RESULTS) {
            this.drawResultsUI();
        } else if (this.state.gamePhase === GAME_PHASE.GAME_OVER) {
            this.drawGameOverUI();
        }

        if (this.state.debugMode) {
            this.drawDebugInfo();
        }
    }

    drawMap() {
        this.ctx.strokeStyle = '#666666';
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = '#1a1a2e';

        for (const room of Object.values(this.state.map.rooms)) {
            this.ctx.fillRect(room.x, room.y, room.width, room.height);
            this.ctx.strokeRect(room.x, room.y, room.width, room.height);

            this.ctx.fillStyle = '#666666';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(room.name, room.x + 5, room.y + 20);
            this.ctx.fillStyle = '#1a1a2e';
        }

        // Vents
        this.ctx.fillStyle = '#444444';
        this.ctx.strokeStyle = '#666666';
        for (const vent of this.state.map.vents) {
            this.ctx.beginPath();
            this.ctx.arc(vent.x, vent.y, 8, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }

        // Cameras
        this.ctx.fillStyle = '#FF8800';
        for (const cam of this.state.map.cameras) {
            this.ctx.fillRect(cam.x - 5, cam.y - 5, 10, 10);
        }

        // Emergency button
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(
            this.state.map.emergencyButton.x - 10,
            this.state.map.emergencyButton.y - 10,
            20, 20
        );
    }

    drawPlayer(player) {
        // Draw player body
        this.ctx.fillStyle = player.color;
        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
        this.ctx.fill();

        // Impostor indicator
        if (player.role === ROLE.IMPOSTOR && this.state.players[0].role === ROLE.IMPOSTOR) {
            this.ctx.strokeStyle = '#FF0000';
            this.ctx.lineWidth = 3;
        } else {
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
        }
        this.ctx.stroke();

        // Visor
        this.ctx.fillStyle = '#AAFFFF';
        this.ctx.beginPath();
        this.ctx.arc(player.x + 5, player.y - 5, 6, 0, Math.PI * 2);
        this.ctx.fill();

        // Name
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 11px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(player.name, player.x, player.y - PLAYER_RADIUS - 10);

        // Role indicator
        if (this.state.players[0].role === ROLE.IMPOSTOR) {
            const roleText = player.role === ROLE.IMPOSTOR ? '👑' : '✓';
            this.ctx.fillText(roleText, player.x, player.y + PLAYER_RADIUS + 15);
        }

        // Venting indicator
        if (player.isVenting) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = '10px Arial';
            this.ctx.fillText('VENTING', player.x, player.y + PLAYER_RADIUS + 25);
        }
    }

    drawDeadBody(body) {
        this.ctx.fillStyle = body.playerColor;
        this.ctx.globalAlpha = 0.6;
        this.ctx.beginPath();
        this.ctx.arc(body.x, body.y, PLAYER_RADIUS - 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
    }

    drawTaskUI() {
        const player = this.state.players[0];

        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';

        for (const task of this.state.tasks) {
            if (task.completed) continue;

            const room = this.state.map.rooms[task.room];
            const distance = Math.hypot(
                player.x - (room.x + room.width / 2),
                player.y - (room.y + room.height / 2)
            );

            if (distance < 200 && player.role === ROLE.CREWMATE) {
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillText(
                    `[T] ${task.name}`,
                    room.x + 5,
                    room.y + room.height - 5
                );
            }
        }
    }

    // Role-specific interact button, bottom-right corner:
    //  - Crewmate: downward triangle, "USAR" label - brightens near a task
    //  - Impostor: skull-with-blood icon - brightens near a killable target
    drawInteractButton() {
        const player = this.state.players[0];
        if (!player.isAlive) return;

        const cx = GAME_WIDTH - 70;
        const cy = GAME_HEIGHT - 70;
        const radius = 42;

        let active = false;

        if (player.role === ROLE.CREWMATE) {
            active = this.state.tasks.some(task => {
                if (task.completed) return false;
                const room = this.state.map.rooms[task.room];
                const d = Math.hypot(player.x - (room.x + room.width / 2), player.y - (room.y + room.height / 2));
                return d < 150;
            });
        } else {
            active = player.canKill() && this.state.players.some(p => {
                if (p === player || !p.isAlive || p.role !== ROLE.CREWMATE) return false;
                return Math.hypot(player.x - p.x, player.y - p.y) < 100;
            });
        }

        // Button base
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = active
            ? (player.role === ROLE.IMPOSTOR ? '#8B0000' : '#2E8B57')
            : 'rgba(60,60,60,0.7)';
        this.ctx.shadowColor = active ? (player.role === ROLE.IMPOSTOR ? '#FF0000' : '#FFD700') : 'transparent';
        this.ctx.shadowBlur = active ? 20 : 0;
        this.ctx.fill();
        this.ctx.strokeStyle = active ? '#FFFFFF' : '#888888';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        this.ctx.restore();

        if (player.role === ROLE.CREWMATE) {
            // Downward-pointing triangle
            this.ctx.fillStyle = active ? '#FFFFFF' : '#AAAAAA';
            this.ctx.beginPath();
            this.ctx.moveTo(cx - 14, cy - 10);
            this.ctx.lineTo(cx + 14, cy - 10);
            this.ctx.lineTo(cx, cy + 14);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.fillStyle = active ? '#FFFFFF' : '#AAAAAA';
            this.ctx.font = 'bold 11px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('USAR', cx, cy + radius + 16);
        } else {
            // Skull-with-blood icon (simplified)
            this.ctx.fillStyle = active ? '#FFFFFF' : '#CCCCCC';
            this.ctx.beginPath();
            this.ctx.arc(cx, cy - 4, 14, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillRect(cx - 10, cy + 2, 20, 8);
            // Eye sockets
            this.ctx.fillStyle = active ? '#8B0000' : '#555555';
            this.ctx.beginPath();
            this.ctx.arc(cx - 5, cy - 4, 3.5, 0, Math.PI * 2);
            this.ctx.arc(cx + 5, cy - 4, 3.5, 0, Math.PI * 2);
            this.ctx.fill();
            // Blood drip when active (kill available)
            if (active) {
                this.ctx.fillStyle = '#FF0000';
                this.ctx.beginPath();
                this.ctx.moveTo(cx + 8, cy + 8);
                this.ctx.quadraticCurveTo(cx + 12, cy + 18, cx + 8, cy + 22);
                this.ctx.quadraticCurveTo(cx + 4, cy + 18, cx + 8, cy + 8);
                this.ctx.fill();
            }

            this.ctx.fillStyle = active ? '#FF4444' : '#AAAAAA';
            this.ctx.font = 'bold 11px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('MATAR', cx, cy + radius + 16);

            // Cooldown ring
            if (player.killCooldownRemaining > 0) {
                const pct = 1 - (player.killCooldownRemaining / player.killCooldown);
                this.ctx.strokeStyle = '#FFD700';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, radius + 6, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
                this.ctx.stroke();
            }
        }

        this._interactButton = { x: cx, y: cy, radius, active };
    }

    handleInteractClick(x, y) {
        const btn = this._interactButton;
        if (!btn || !btn.active) return false;
        const dist = Math.hypot(x - btn.x, y - btn.y);
        if (dist > btn.radius) return false;

        const player = this.state.players[0];
        if (player.role === ROLE.CREWMATE) {
            this.tryCompleteTask();
        } else {
            this.tryKill();
        }
        return true;
    }

    // Red banner at the top of the screen showing active sabotage(s) and
    // their countdown, plus which rooms need a crewmate at the panel.
    drawSabotageAlert() {
        if (this.state.activeSabotages.length === 0) return;

        let y = 10;
        for (const sabotage of this.state.activeSabotages) {
            const lethal = sabotage.type === 'O2' || sabotage.type === 'REACTOR';
            this.ctx.fillStyle = lethal ? 'rgba(180,0,0,0.85)' : 'rgba(180,120,0,0.85)';
            this.ctx.fillRect(GAME_WIDTH / 2 - 180, y, 360, 36);

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            const panelsNeeded = sabotage.requiredPanels - sabotage.fixedPanels.size;
            this.ctx.fillText(
                `${sabotage.def.name.toUpperCase()} SABOTAGED - ${Math.ceil(sabotage.timeRemaining)}s (${panelsNeeded} panel${panelsNeeded !== 1 ? 's' : ''} left)`,
                GAME_WIDTH / 2, y + 24
            );
            y += 42;
        }
    }

    // Impostor-only sabotage menu (press B to open, 1-6 to pick)
    drawSabotageMenu() {
        this.ctx.fillStyle = 'rgba(0,0,0,0.85)';
        this.ctx.fillRect(GAME_WIDTH / 2 - 200, GAME_HEIGHT / 2 - 160, 400, 320);
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(GAME_WIDTH / 2 - 200, GAME_HEIGHT / 2 - 160, 400, 320);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SABOTAGE (press 1-6)', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120);

        const types = Object.keys(SABOTAGE_TYPES);
        types.forEach((type, i) => {
            const def = SABOTAGE_TYPES[type];
            this.ctx.font = '16px Arial';
            this.ctx.fillStyle = '#FFD700';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`${i + 1}. ${def.name}`, GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2 - 80 + i * 36);
        });

        this.ctx.fillStyle = '#AAAAAA';
        this.ctx.font = '13px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Press B to close', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140);
    }

    drawMeetingUI() {
        const meeting = this.state.currentMeeting;
        if (!meeting) return;

        // Dark overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Meeting title
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';

        if (meeting.phase === 'discussion') {
            this.ctx.fillText('EMERGENCY MEETING', GAME_WIDTH / 2, 50);
            this.ctx.font = '18px Arial';
            this.ctx.fillText(`Discussion: ${Math.ceil(meeting.timeRemaining)}s`, GAME_WIDTH / 2, 100);
        } else if (meeting.phase === 'voting') {
            this.ctx.fillText('VOTING TIME', GAME_WIDTH / 2, 50);
            this.ctx.font = '18px Arial';
            this.ctx.fillText(`Voting: ${Math.ceil(meeting.timeRemaining)}s`, GAME_WIDTH / 2, 100);

            this.drawVotingGrid();
        }
    }

    // Grid of alive players as colored tiles (click to select), a skip
    // button, and (once a selection is made) a green check to confirm
    // and a red X to cancel the selection.
    drawVotingGrid() {
        this.voteButtons = [];
        const human = this.state.players[0];
        const alivePlayers = this.state.players.filter(p => p.isAlive);

        const cols = 4;
        const tileSize = 90;
        const gap = 16;
        const gridWidth = cols * tileSize + (cols - 1) * gap;
        const startX = (GAME_WIDTH - gridWidth) / 2;
        const startY = 140;

        alivePlayers.forEach((player, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (tileSize + gap);
            const y = startY + row * (tileSize + gap);

            const isSelected = this.state.voteSelection === player.id;
            const alreadyVoted = human.hasVoted;

            // Tile background
            this.ctx.fillStyle = isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.08)';
            this.ctx.fillRect(x, y, tileSize, tileSize);
            this.ctx.strokeStyle = isSelected ? '#FFD700' : '#666666';
            this.ctx.lineWidth = isSelected ? 4 : 2;
            this.ctx.strokeRect(x, y, tileSize, tileSize);

            // Player color circle
            this.ctx.fillStyle = player.color;
            this.ctx.beginPath();
            this.ctx.arc(x + tileSize / 2, y + tileSize / 2 - 10, 24, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Vote tally pips (visible to everyone, like the real game)
            const voteCount = this.state.currentMeeting.getVoteCount(player.id);
            if (voteCount > 0) {
                this.ctx.fillStyle = '#FF4444';
                this.ctx.beginPath();
                this.ctx.arc(x + tileSize - 12, y + 12, 10, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(voteCount, x + tileSize - 12, y + 16);
            }

            // Name
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(player.name, x + tileSize / 2, y + tileSize - 8);

            if (!alreadyVoted) {
                this.voteButtons.push({ x, y, w: tileSize, h: tileSize, type: 'player', targetId: player.id });
            }
        });

        // Skip vote button
        const skipRow = Math.ceil(alivePlayers.length / cols);
        const skipY = startY + skipRow * (tileSize + gap) + 10;
        const skipW = 160, skipH = 44;
        const skipX = (GAME_WIDTH - skipW) / 2;
        const skipSelected = this.state.voteSelection === 'skip';

        this.ctx.fillStyle = skipSelected ? '#FFD700' : 'rgba(255,255,255,0.1)';
        this.ctx.fillRect(skipX, skipY, skipW, skipH);
        this.ctx.strokeStyle = '#AAAAAA';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(skipX, skipY, skipW, skipH);
        this.ctx.fillStyle = skipSelected ? '#000000' : '#FFFFFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText('SKIP VOTE', skipX + skipW / 2, skipY + skipH / 2 + 5);

        if (!this.state.players[0].hasVoted) {
            this.voteButtons.push({ x: skipX, y: skipY, w: skipW, h: skipH, type: 'skip' });
        }

        // Confirm (green check) / Cancel (red X) once something is selected
        if (this.state.voteSelection !== null && !this.state.players[0].hasVoted) {
            const confirmY = skipY + skipH + 30;
            const btnSize = 60;
            const confirmX = GAME_WIDTH / 2 - btnSize - 20;
            const cancelX = GAME_WIDTH / 2 + 20;

            // Green check (confirm)
            this.ctx.fillStyle = '#2ECC71';
            this.ctx.beginPath();
            this.ctx.arc(confirmX + btnSize / 2, confirmY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(confirmX + btnSize * 0.28, confirmY + btnSize * 0.52);
            this.ctx.lineTo(confirmX + btnSize * 0.45, confirmY + btnSize * 0.7);
            this.ctx.lineTo(confirmX + btnSize * 0.75, confirmY + btnSize * 0.3);
            this.ctx.stroke();

            // Red X (cancel)
            this.ctx.fillStyle = '#E74C3C';
            this.ctx.beginPath();
            this.ctx.arc(cancelX + btnSize / 2, confirmY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(cancelX + btnSize * 0.3, confirmY + btnSize * 0.3);
            this.ctx.lineTo(cancelX + btnSize * 0.7, confirmY + btnSize * 0.7);
            this.ctx.moveTo(cancelX + btnSize * 0.7, confirmY + btnSize * 0.3);
            this.ctx.lineTo(cancelX + btnSize * 0.3, confirmY + btnSize * 0.7);
            this.ctx.stroke();

            this.voteButtons.push({ x: confirmX, y: confirmY, w: btnSize, h: btnSize, type: 'confirm' });
            this.voteButtons.push({ x: cancelX, y: confirmY, w: btnSize, h: btnSize, type: 'cancel' });
        }

        if (this.state.players[0].hasVoted) {
            this.ctx.fillStyle = '#AAAAAA';
            this.ctx.font = '16px Arial';
            this.ctx.fillText('Your vote is locked in. Waiting for others...', GAME_WIDTH / 2, skipY + skipH + 50);
        }
    }

    handleVoteClick(x, y) {
        const human = this.state.players[0];
        if (human.hasVoted) return;

        for (const btn of this.voteButtons) {
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                if (btn.type === 'player') {
                    this.state.voteSelection = this.state.voteSelection === btn.targetId ? null : btn.targetId;
                } else if (btn.type === 'skip') {
                    this.state.voteSelection = this.state.voteSelection === 'skip' ? null : 'skip';
                } else if (btn.type === 'confirm' && this.state.voteSelection !== null) {
                    this.state.currentMeeting.addVote(human.id, this.state.voteSelection);
                    human.hasVoted = true;
                } else if (btn.type === 'cancel') {
                    this.state.voteSelection = null;
                }
                return;
            }
        }
    }

    drawResultsUI() {
        const meeting = this.state.currentMeeting;
        if (!meeting || !meeting.results) return;

        // Black screen
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Stable starfield (seeded once per meeting so stars don't jitter every frame)
        if (!this._resultStars || this._resultStarsMeeting !== meeting) {
            this._resultStars = Array.from({ length: 80 }, () => ({
                x: Math.random() * GAME_WIDTH,
                y: Math.random() * GAME_HEIGHT,
                size: Math.random() * 2 + 0.5
            }));
            this._resultStarsMeeting = meeting;
        }
        this.ctx.fillStyle = '#FFFFFF';
        for (const star of this._resultStars) {
            this.ctx.fillRect(star.x, star.y, star.size, star.size);
        }

        const elapsed = (Date.now() - (meeting.resultsStartTime || Date.now())) / 1000;

        if (meeting.results.ejected !== null) {
            const ejected = this.state.players.find(p => p.id === meeting.results.ejected);
            if (ejected) {
                // Fall animation: starts near top of ship silhouette, falls and
                // tumbles down past the bottom of the screen over ~2.5s, then
                // name/role text holds on screen.
                const fallDuration = 2.5;
                const t = Math.min(elapsed / fallDuration, 1);
                const startY = 150;
                const endY = GAME_HEIGHT + 80;
                const easedT = t * t; // accelerate like gravity
                const posY = startY + (endY - startY) * easedT;
                const rotation = t * Math.PI * 3; // tumbling spin
                const posX = GAME_WIDTH / 2 + Math.sin(t * Math.PI * 2) * 20;

                // Ship silhouette the player falls from
                this.ctx.fillStyle = '#2a2a3e';
                this.ctx.fillRect(GAME_WIDTH / 2 - 150, 60, 300, 60);

                this.ctx.save();
                this.ctx.translate(posX, Math.min(posY, GAME_HEIGHT + 80));
                this.ctx.rotate(rotation);
                this.ctx.fillStyle = ejected.color;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 36, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
                this.ctx.fillStyle = '#AAFFFF';
                this.ctx.beginPath();
                this.ctx.arc(10, -8, 12, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();

                // Text holds once the fall finishes
                if (t >= 1) {
                    this.ctx.fillStyle = '#FFFFFF';
                    this.ctx.font = 'bold 30px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(`${ejected.name} was ejected`, GAME_WIDTH / 2, GAME_HEIGHT / 2);

                    const roleText = ejected.role === ROLE.IMPOSTOR ? 'was an Impostor' : 'was not an Impostor';
                    this.ctx.fillStyle = ejected.role === ROLE.IMPOSTOR ? '#FF4444' : '#44AAFF';
                    this.ctx.font = '22px Arial';
                    this.ctx.fillText(roleText, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 45);
                }
            }
        } else {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 28px Arial';
            this.ctx.textAlign = 'center';
            const reasonText = meeting.results.reason === 'tie' ? 'Vote was a tie - no one was ejected'
                : meeting.results.reason === 'skipped' ? 'Majority skipped - no one was ejected'
                : 'No one was ejected';
            this.ctx.fillText(reasonText, GAME_WIDTH / 2, GAME_HEIGHT / 2);
        }
    }

    drawGameOverUI() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';

        if (this.state.gameWinner === 'impostors') {
            this.ctx.fillStyle = '#FF0000';
            this.ctx.fillText('IMPOSTORS WIN', GAME_WIDTH / 2, GAME_HEIGHT / 2);
        } else if (this.state.gameWinner === 'crewmates') {
            this.ctx.fillStyle = '#00FF00';
            this.ctx.fillText('CREWMATES WIN', GAME_WIDTH / 2, GAME_HEIGHT / 2);
        }

        this.ctx.font = '18px Arial';
        this.ctx.fillStyle = '#AAAAAA';
        this.ctx.fillText('Press ESC to return to lobby', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80);
    }

    drawDebugInfo() {
        this.ctx.fillStyle = '#00FF00';
        this.ctx.font = 'bold 12px Courier New';
        this.ctx.textAlign = 'left';

        const player = this.state.players[0];
        const texts = [
            `Role: ${player.role}`,
            `Player: ${player.x.toFixed(0)}, ${player.y.toFixed(0)}`,
            `Mouse: ${this.mouseX.toFixed(0)}, ${this.mouseY.toFixed(0)}`,
            `Players: ${this.state.players.length}`,
            `Alive: ${this.state.players.filter(p => p.isAlive).length}`,
            `Tasks: ${this.state.tasksCompleted}/${this.state.getTotalTasks()}`,
            `FPS: ${this.fps}`,
            `Phase: ${this.state.gamePhase}`
        ];

        for (let i = 0; i < texts.length; i++) {
            this.ctx.fillText(texts[i], 10, 20 + i * 15);
        }
    }

    updateDebugInfo() {
        if (document.getElementById('fps')) {
            document.getElementById('fps').textContent = this.fps;
        }
    }

    togglePause() {
        this.state.paused = !this.state.paused;
        const pauseMenu = document.getElementById('pauseMenu');
        const statusEl = document.getElementById('playerStatus');

        if (pauseMenu) {
            if (this.state.paused) {
                pauseMenu.classList.remove('hidden');
                if (statusEl) statusEl.textContent = 'Paused';
            } else {
                pauseMenu.classList.add('hidden');
                if (statusEl) statusEl.textContent = 'Moving';
            }
        }
    }

    gameLoop = () => {
        const now = Date.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;

        const cappedDeltaTime = Math.min(deltaTime, 0.016);

        this.update(cappedDeltaTime);
        this.render();

        this.frameCount++;
        if (this.frameCount % 30 === 0) {
            this.fps = Math.round(1 / cappedDeltaTime);
        }

        requestAnimationFrame(this.gameLoop);
    };

    start() {
        this.gameLoop();
    }
}

// ============================================================================
// Initialize Game on Page Load
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');

    if (!canvas) {
        console.error('Canvas não encontrado!');
        return;
    }

    // IMPORTANT: Canvas width/height devem ser 1024x768 (valores reais, não CSS)
    // Isso garante que o contexto 2D use as dimensões corretas
    // Scaling é feito apenas em CSS, não em canvas.width/height
    // canvas.width = 1024; // Já está no HTML
    // canvas.height = 768; // Já está no HTML

    try {
        const game = new Game(canvas);
        window.__game = game; // debug/dev handle
        console.log('Jogo iniciado com sucesso!');
    } catch (error) {
        console.error('Erro ao iniciar o jogo:', error);
        canvas.getContext('2d').fillStyle = '#FF0000';
        canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
        canvas.getContext('2d').fillStyle = '#FFFFFF';
        canvas.getContext('2d').font = '20px Arial';
        canvas.getContext('2d').fillText('ERRO: ' + error.message, 50, 100);
        return;
    }

    const progressBar = document.getElementById('progressBar');
    const sheet = document.createElement('style');
    sheet.textContent = `
        #progressBar::after {
            width: var(--progress-width, 0%) !important;
        }
    `;
    document.head.appendChild(sheet);

    // Não tente acessar players[0] ainda - o jogo ainda está no LOBBY
    // Players só são criados depois que o usuário clica "JOGAR"
});
