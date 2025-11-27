/* Version: #32 */
/**
 * NEON DEFENSE: SAFEGUARD UPDATE
 * Inkluderer DOM-validering for å hindre krasj ved feil HTML-versjon.
 */

console.log("--- SYSTEM STARTUP: NEON DEFENSE V32 (SAFEGUARD) ---");

// --- 1. CONFIGURATION ---
const CONFIG = {
    STARTING_BITS: 100, 
    STARTING_LIVES: 20,
    MINER_BASE_RATE: 1, 
    WAVES_PER_LEVEL: 10,
    PATH_WIDTH: 80, 
    
    RESEARCH_COSTS: {
        'blaster': 0, 'trap': 150, 'sniper': 400,
        'cryo': 600, 'cannon': 1000, 'tesla': 2000
    },

    MATH_COSTS: {
        BUILD: 1,       
        MINE: 2,        
        UPGRADE_BASE: 1 
    }
};

// --- MAP DATA ---
const LEVEL_MAPS = [
    // Level 1: The Snake
    {
        path: [{x:-50, y:150}, {x:1000, y:150}, {x:1000, y:350}, {x:200, y:350}, {x:200, y:550}, {x:1000, y:550}, {x:1000, y:700}, {x:50, y:700}],
        core: {x: 50, y: 700}, miner: {x: 1150, y: 100},
        platforms: [
            {x:100, y:80}, {x:250, y:80}, {x:400, y:80}, {x:550, y:80}, {x:700, y:80}, {x:850, y:80},
            {x:900, y:250}, {x:750, y:250}, {x:600, y:250}, {x:450, y:250}, {x:300, y:250}, {x:150, y:250},
            {x:150, y:450}, {x:300, y:450}, {x:450, y:450}, {x:600, y:450}, {x:750, y:450}, {x:900, y:450},
            {x:850, y:630}, {x:700, y:630}, {x:550, y:630}, {x:400, y:630}, {x:250, y:630}
        ]
    },
    // Level 2: The Siege
    {
        path: [{x:50, y:-50}, {x:50, y:650}, {x:1230, y:650}, {x:1230, y:150}, {x:300, y:150}, {x:300, y:400}, {x:640, y:400}],
        core: {x: 640, y: 400}, miner: {x: 1100, y: 700},
        platforms: [
            {x:150, y:100}, {x:150, y:250}, {x:150, y:400}, {x:150, y:550},
            {x:300, y:550}, {x:450, y:550}, {x:600, y:550}, {x:750, y:550}, {x:900, y:550}, {x:1050, y:550},
            {x:1130, y:500}, {x:1130, y:350}, {x:1130, y:200},
            {x:1000, y:250}, {x:850, y:250}, {x:700, y:250}, {x:550, y:250}, {x:400, y:250},
            {x:400, y:350}, {x:500, y:350}, {x:500, y:450}
        ]
    },
    // Level 3: The Zig-Zag
    {
        path: [{x:-50, y:100}, {x:300, y:100}, {x:300, y:700}, {x:600, y:700}, {x:600, y:100}, {x:900, y:100}, {x:900, y:700}, {x:1200, y:700}, {x:1200, y:400}, {x:1350, y:400}],
        core: {x: 1300, y: 400}, miner: {x: 100, y: 700},
        platforms: [
            {x:150, y:180}, {x:150, y:30}, {x:220, y:200}, {x:220, y:350}, {x:220, y:500}, {x:220, y:650},
            {x:380, y:650}, {x:380, y:500}, {x:380, y:350}, {x:380, y:200},
            {x:520, y:200}, {x:520, y:350}, {x:520, y:500}, {x:520, y:650},
            {x:680, y:650}, {x:680, y:500}, {x:680, y:350}, {x:680, y:200},
            {x:820, y:200}, {x:820, y:350}, {x:820, y:500}, {x:820, y:650},
            {x:980, y:650}, {x:980, y:500}, {x:980, y:350}, {x:980, y:200}
        ]
    }
];

const TOWERS = {
    blaster: { name: "Blaster", range: 160, damage: 12, rate: 30, color: "#00f3ff", type: "single", img: "blaster" },
    trap:    { name: "Mine",    range: 70,  damage: 300, rate: 0,   color: "#ffee00", type: "trap",   img: "trap" },
    sniper:  { name: "Railgun", range: 500, damage: 150, rate: 80, color: "#ff0055", type: "single", img: "sniper" },
    cryo:    { name: "Cryo",    range: 150, damage: 5,   rate: 8,  color: "#0099ff", type: "slow",   img: "cryo" },
    cannon:  { name: "Pulse",   range: 180, damage: 50,  rate: 50, color: "#0aff00", type: "splash", img: "cannon" },
    tesla:   { name: "Tesla",   range: 220, damage: 30,  rate: 5,  color: "#ffffff", type: "chain",  img: "tesla" }
};

// --- 2. ASSETS LOADER ---
const ASSETS = {
    base: new Image(), core: new Image(), miner: new Image(),
    blaster: new Image(), sniper: new Image(), cryo: new Image(),
    cannon: new Image(), tesla: new Image(), trap: new Image(),
    enemy_basic: new Image(), enemy_fast: new Image(), enemy_tank: new Image()
};

ASSETS.base.src = 'assets/tower_base.png';
ASSETS.core.src = 'assets/core.png';
ASSETS.miner.src = 'assets/miner.png';
ASSETS.blaster.src = 'assets/tower_blaster.png';
ASSETS.sniper.src = 'assets/tower_sniper.png';
ASSETS.cryo.src = 'assets/tower_cryo.png';
ASSETS.cannon.src = 'assets/tower_cannon.png';
ASSETS.tesla.src = 'assets/tower_tesla.png';
ASSETS.trap.src = 'assets/tower_trap.png';
ASSETS.enemy_basic.src = 'assets/enemy_basic.png';
ASSETS.enemy_fast.src = 'assets/enemy_fast.png';
ASSETS.enemy_tank.src = 'assets/enemy_tank.png';

// --- 3. GLOBAL STATE ---
const state = {
    gameState: 'START', 
    previousState: 'LOBBY',
    money: CONFIG.STARTING_BITS,
    lives: CONFIG.STARTING_LIVES,
    level: 1, waveTotal: 0, waveInLevel: 0, 
    score: 0, highScore: parseInt(localStorage.getItem('nd_highscore')) || 0,
    activeTables: [2, 3, 4, 5, 10], yieldMultiplier: 1.0, minerLvl: 1,
    
    // Map Data
    currentMap: LEVEL_MAPS[0],
    platforms: [], 
    
    enemies: [], projectiles: [], particles: [],
    unlockedTowers: ['blaster'],
    selectedBlueprint: null, 
    spawnQueue: [], spawnTimer: null,
    selectedPlatformIdx: -1,
    mathTask: { active: false, type: null, target: null, remaining: 0, total: 0, answer: 0 }
};

// --- 4. ENGINE & INIT ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    
    if (type === 'shoot') { osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(50, now+0.1); gain.gain.setValueAtTime(0.03, now); gain.gain.linearRampToValueAtTime(0, now+0.1); osc.start(now); osc.stop(now+0.1); }
    else if (type === 'hit') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now+0.05); osc.start(now); osc.stop(now+0.05); }
    else if (type === 'correct') { osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(1200, now+0.2); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now+0.2); osc.start(now); osc.stop(now+0.2); }
    else if (type === 'terminal_open') { osc.type = 'square'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(400, now+0.3); gain.gain.setValueAtTime(0.05, now); osc.start(now); osc.stop(now+0.3); }
    else if (type === 'wave_start') { osc.type = 'triangle'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(800, now+1.0); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now+1.0); }
    else if (type === 'explode') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(50, now); osc.frequency.linearRampToValueAtTime(10, now+0.4); gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now+0.4); osc.start(now); osc.stop(now+0.4); }
    else if (type === 'click') { osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); gain.gain.setValueAtTime(0.05, now); osc.start(now); osc.stop(now+0.05); }
}

const game = {
    validateDOM: () => {
        const required = ['config-overlay', 'turret-menu', 'research-overlay', 'math-terminal', 'start-screen'];
        let missing = false;
        required.forEach(id => {
            if(!document.getElementById(id)) {
                console.error(`MISSING HTML ELEMENT: #${id}`);
                missing = true;
            }
        });
        if(missing) {
            alert("CRITICAL ERROR: HTML file is outdated. Please update index.html to Version #32.");
            return false;
        }
        return true;
    },

    init: () => {
        if(!game.validateDOM()) return;

        game.loadLevel(1);
        let ui = document.getElementById('ui-layer'); if(ui) ui.classList.add('hidden');
        let start = document.getElementById('start-screen'); if(start) start.classList.remove('hidden');
        requestAnimationFrame(game.loop);
        setInterval(game.minerTick, 1000); 
    },

    enterLobby: () => {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('ui-layer').classList.remove('hidden');
        game.openConfig();
    },

    loadLevel: (lvlNum) => {
        state.level = lvlNum;
        state.waveInLevel = 0;
        let mapIdx = (lvlNum - 1) % LEVEL_MAPS.length;
        state.currentMap = LEVEL_MAPS[mapIdx];
        state.platforms = state.currentMap.platforms.map(p => ({ x: p.x, y: p.y, tower: null }));
        state.enemies = []; state.projectiles = []; state.particles = [];
        console.log(`Loading Level ${lvlNum}, Map ${mapIdx}`);
    },

    // --- MENUS ---
    openConfig: () => {
        if (state.gameState === 'PLAYING') { alert("COMBAT ACTIVE"); return; }
        state.gameState = 'CONFIG';
        document.getElementById('config-overlay').classList.remove('hidden');
        document.getElementById('wave-overlay').classList.add('hidden'); 
        game.renderTableSelector();
    },

    closeConfig: () => {
        if (state.activeTables.length === 0) { alert("SELECT DATA STREAM!"); return; }
        document.getElementById('config-overlay').classList.add('hidden');
        state.gameState = 'LOBBY';
        document.getElementById('wave-overlay').classList.remove('hidden');
        game.updateUI();
    },

    openResearch: () => {
        if (state.gameState === 'PLAYING') { alert("COMBAT ACTIVE"); return; }
        state.previousState = state.gameState;
        state.gameState = 'MENU'; 
        document.getElementById('research-overlay').classList.remove('hidden');
        game.renderResearchGrid();
    },
    closeResearch: () => {
        document.getElementById('research-overlay').classList.add('hidden');
        state.gameState = state.previousState;
    },
    renderResearchGrid: () => {
        const grid = document.getElementById('research-grid');
        grid.innerHTML = "";
        for (let key of Object.keys(TOWERS)) {
            if (key === 'trap') continue; 
            const t = TOWERS[key];
            const unlocked = state.unlockedTowers.includes(key);
            const cost = CONFIG.RESEARCH_COSTS[key];
            const div = document.createElement('div');
            div.className = `menu-btn ${unlocked ? 'locked' : ''}`; 
            div.style.borderColor = unlocked ? "#0aff00" : "#00f3ff";
            div.innerHTML = `<div style="color:${t.color}; font-weight:bold;">${t.name}</div><div style="font-size:0.8rem;">${unlocked ? "UNLOCKED" : "LOCKED"}</div>${!unlocked ? `<div class="cost-bits">${cost} BITS</div>` : ""}`;
            if (!unlocked) {
                div.onclick = () => {
                    if (state.money >= cost) {
                        state.money -= cost; state.unlockedTowers.push(key); playSound('correct'); game.renderResearchGrid(); game.updateUI();
                    } else { alert("NEED MORE BITS!"); }
                };
            }
            grid.appendChild(div);
        }
    },

    openMinerUpgrade: () => {
        if (state.gameState !== 'PLAYING' && state.gameState !== 'LOBBY') return;
        state.previousState = state.gameState;
        const tasks = state.minerLvl * 2;
        game.startMathTask('MINER', null, tasks, `OVERCLOCKING MINER TO LVL ${state.minerLvl + 1}`);
    },

    openTurretMenu: (idx) => {
        state.selectedPlatformIdx = idx;
        state.previousState = state.gameState;
        state.gameState = 'MENU'; 
        
        const p = state.platforms[idx];
        const menu = document.getElementById('turret-menu');
        const stats = document.getElementById('turret-stats');
        const options = document.getElementById('turret-options');
        
        menu.classList.remove('hidden');
        options.innerHTML = "";
        
        if (p.tower) {
            const t = p.tower;
            const dmg = Math.floor(TOWERS[t.type].damage * Math.pow(1.4, t.level-1));
            stats.innerHTML = `<span style="color:${TOWERS[t.type].color}">${TOWERS[t.type].name}</span> LVL ${t.level}<br>DMG: ${dmg}`;
            
            const upCost = t.level * CONFIG.MATH_COSTS.UPGRADE_BASE;
            const btnUp = document.createElement('div');
            btnUp.className = "menu-btn";
            btnUp.innerHTML = `<div>UPGRADE</div><div class="cost-math">${upCost} MATH</div>`;
            btnUp.onclick = () => game.triggerMathAction('UPGRADE', idx, upCost);
            options.appendChild(btnUp);
            
            state.unlockedTowers.forEach(type => {
                if (type === t.type) return;
                const btn = document.createElement('div');
                btn.className = "menu-btn";
                btn.innerHTML = `<div>SWAP TO<br>${TOWERS[type].name}</div><div class="cost-math">1 MATH</div>`;
                btn.onclick = () => game.triggerMathAction('SWAP', {idx, type}, 1);
                options.appendChild(btn);
            });
        } else {
            stats.innerHTML = "EMPTY SLOT";
            state.unlockedTowers.forEach(type => {
                const btn = document.createElement('div');
                btn.className = "menu-btn";
                btn.innerHTML = `<div>BUILD<br>${TOWERS[type].name}</div><div class="cost-math">${CONFIG.MATH_COSTS.BUILD} MATH</div>`;
                btn.onclick = () => game.triggerMathAction('BUILD', {idx, type}, CONFIG.MATH_COSTS.BUILD);
                options.appendChild(btn);
            });
        }
    },
    
    closeTurretMenu: () => {
        document.getElementById('turret-menu').classList.add('hidden');
        state.gameState = state.previousState; 
    },

    triggerMathAction: (action, target, cost) => {
        document.getElementById('turret-menu').classList.add('hidden');
        state.gameState = 'PLAYING'; 
        let text = "";
        if (action === 'BUILD') text = `BUILDING ${TOWERS[target.type].name}`;
        if (action === 'UPGRADE') text = `UPGRADING SYSTEM`;
        if (action === 'SWAP') text = `RECONFIGURING TURRET`;
        if (action === 'MINE') text = `PLACING PROXIMITY MINE`;
        if (action === 'MINER') text = `OVERCLOCKING MINER`;
        game.startMathTask(action, target, cost, text);
    },

    // --- MATH & CONFIG UI ---
    renderTableSelector: () => {
        const container = document.getElementById('table-selector');
        if(!container) return;
        container.innerHTML = "";
        for (let i = 2; i <= 12; i++) {
            const btn = document.createElement('div');
            const isActive = state.activeTables.includes(i);
            btn.className = `table-btn ${isActive ? 'active' : ''}`;
            btn.innerText = i;
            btn.onclick = () => game.toggleTable(i);
            container.appendChild(btn);
        }
        game.calcMultiplier();
    },

    toggleTable: (num) => {
        playSound('click');
        const idx = state.activeTables.indexOf(num);
        if (idx > -1) state.activeTables.splice(idx, 1);
        else state.activeTables.push(num);
        game.renderTableSelector();
    },

    calcMultiplier: () => {
        const count = state.activeTables.length;
        let mult = 1.0;
        if (count > 1) mult += (count - 1) * 0.1;
        state.yieldMultiplier = parseFloat(mult.toFixed(1));
        const el = document.getElementById('ui-multiplier');
        if(el) {
            el.innerText = "x" + state.yieldMultiplier;
            if (state.yieldMultiplier >= 2.0) el.style.color = "#0aff00"; 
            else if (state.yieldMultiplier >= 1.5) el.style.color = "#ffee00"; 
            else el.style.color = "#fff"; 
        }
    },

    startMathTask: (type, target, count, contextText) => {
        state.mathTask = { active: true, type, target, remaining: count, total: count };
        const terminal = document.getElementById('math-terminal');
        terminal.classList.remove('hidden');
        document.getElementById('math-context').innerText = contextText;
        document.getElementById('math-progress').innerText = `TASK 1 / ${count}`;
        playSound('terminal_open');
        game.nextQuestion();
        setTimeout(() => document.getElementById('math-input').focus(), 100);
    },

    nextQuestion: () => {
        if (state.activeTables.length === 0) state.activeTables = [2]; 
        const a = state.activeTables[Math.floor(Math.random() * state.activeTables.length)];
        const b = Math.floor(Math.random() * 11) + 2; 
        state.mathTask.answer = a * b;
        document.getElementById('math-question').innerText = `${a} x ${b}`;
        document.getElementById('math-input').value = "";
    },

    checkAnswer: () => {
        const input = document.getElementById('math-input');
        const val = parseInt(input.value);
        if (isNaN(val)) return;

        if (val === state.mathTask.answer) {
            playSound('correct');
            state.mathTask.remaining--;
            if (state.mathTask.remaining <= 0) {
                game.completeMathTask();
            } else {
                let done = state.mathTask.total - state.mathTask.remaining + 1;
                document.getElementById('math-progress').innerText = `TASK ${done} / ${state.mathTask.total}`;
                game.nextQuestion();
            }
        } else {
            input.value = "";
            input.style.borderBottomColor = "red";
            setTimeout(() => input.style.borderBottomColor = "#0aff00", 500);
        }
    },

    completeMathTask: () => {
        const t = state.mathTask;
        if (t.type === 'MINER') {
            state.minerLvl++;
        }
        else if (t.type === 'MINE') {
            state.particles.push({x:t.target.x, y:t.target.y, type:'mine', life: 9999});
            state.platforms.push({x: t.target.x, y: t.target.y, tower: {
                type: 'trap', level: 1, angle: 0, cooldown: 0, range: TOWERS.trap.range, damage: TOWERS.trap.damage
            }});
        }
        else if (t.type === 'BUILD') {
            const p = state.platforms[t.target.idx];
            p.tower = {
                type: t.target.type, level: 1, angle: 0, cooldown: 0,
                range: TOWERS[t.target.type].range, damage: TOWERS[t.target.type].damage, maxCooldown: TOWERS[t.target.type].rate
            };
            createParticles(p.x, p.y, "#fff", 20);
        }
        else if (t.type === 'UPGRADE') {
            const p = state.platforms[t.target]; 
            if (p.tower) {
                p.tower.level++;
                p.tower.damage *= 1.4;
                p.tower.range += 15;
                createParticles(p.x, p.y, "#0aff00", 20);
            }
        }
        else if (t.type === 'SWAP') {
            const p = state.platforms[t.target.idx];
            if (p.tower) {
                let newLevel = Math.max(1, Math.floor(p.tower.level / 2));
                let type = t.target.type;
                p.tower = {
                    type: type, level: newLevel, angle: 0, cooldown: 0,
                    range: TOWERS[type].range, damage: TOWERS[type].damage * Math.pow(1.4, newLevel-1), maxCooldown: TOWERS[type].rate
                };
            }
        }
        game.closeMath();
        state.gameState = state.previousState;
        game.updateUI();
    },

    // --- GAME LOOP ---
    handleCanvasClick: (e) => {
        if (state.mathTask.active) return;
        if (state.gameState === 'MENU' || state.gameState === 'CONFIG') return;

        const rect = document.getElementById('game-canvas').getBoundingClientRect();
        const scaleX = document.getElementById('game-canvas').width / rect.width;
        const scaleY = document.getElementById('game-canvas').height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // 1. Sjekk PLATTFORM (Tårn) - Radius 50px
        for (let i = 0; i < state.platforms.length; i++) {
            const p = state.platforms[i];
            if (p.tower && p.tower.type === 'trap') continue;

            if (Math.hypot(x - p.x, y - p.y) < 50) {
                game.openTurretMenu(i);
                return;
            }
        }

        // 2. Sjekk LØYPE (Miner)
        if (state.gameState === 'PLAYING') {
            if (game.isPointOnPath(x, y)) {
                state.previousState = state.gameState;
                game.triggerMathAction('MINE', {x, y}, CONFIG.MATH_COSTS.MINE);
            }
        }
    },

    isPointOnPath: (x, y) => {
        if (!state.currentMap) return false;
        const path = state.currentMap.path;
        const width = CONFIG.PATH_WIDTH / 2; 

        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i+1];
            const dist = game.distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
            if (dist < width) return true;
        }
        return false;
    },

    distToSegment: (x, y, x1, y1, x2, y2) => {
        const A = x - x1; const B = y - y1;
        const C = x2 - x1; const D = y2 - y1;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq != 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }
        const dx = x - xx; const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    },

    loop: () => {
        game.update();
        game.draw();
        requestAnimationFrame(game.loop);
    },

    update: () => {
        if (state.gameState !== 'PLAYING') return;

        // Enemies
        for (let i = state.enemies.length - 1; i >= 0; i--) {
            let e = state.enemies[i];
            let path = state.currentMap.path;
            let targetP = path[e.pathIdx + 1];
            if (!targetP) {
                state.lives--;
                state.enemies.splice(i, 1);
                game.updateUI();
                if (state.lives <= 0) game.gameOver();
                continue;
            }
            
            let dx = targetP.x - e.x;
            let dy = targetP.y - e.y;
            let dist = Math.hypot(dx, dy);
            let spd = e.frozen > 0 ? e.speed * 0.5 : e.speed;
            if (e.frozen > 0) e.frozen--;
            
            if (dist < spd) { e.x = targetP.x; e.y = targetP.y; e.pathIdx++; }
            else {
                let angle = Math.atan2(dy, dx);
                e.x += Math.cos(angle) * spd;
                e.y += Math.sin(angle) * spd;
            }
        }
        
        game.checkWaveEnd();

        // Towers
        for (let i = state.platforms.length - 1; i >= 0; i--) {
            let p = state.platforms[i];
            if (!p.tower) continue;
            let t = p.tower;

            if (t.type === 'trap') {
                for (let e of state.enemies) {
                    if (Math.hypot(e.x - p.x, e.y - p.y) < t.range) {
                        game.damageEnemy(e, t.damage);
                        createParticles(p.x, p.y, "#ffaa00", 30);
                        playSound('explode');
                        if (i >= state.currentMap.platforms.length) {
                            state.platforms.splice(i, 1);
                        } else {
                            p.tower = null;
                        }
                        break;
                    }
                }
            } else {
                if (t.cooldown > 0) t.cooldown--;
                
                let target = null;
                let minDist = t.range;
                for (let e of state.enemies) {
                    let d = Math.hypot(e.x - p.x, e.y - p.y);
                    if (d < minDist) { minDist = d; target = e; }
                }
                
                if (target) {
                    t.angle = Math.atan2(target.y - p.y, target.x - p.x);
                    if (t.cooldown <= 0) {
                        t.cooldown = t.maxCooldown;
                        playSound('shoot');
                        state.projectiles.push({
                            x: p.x, y: p.y, target: target, type: t.type, color: TOWERS[t.type].color 
                        });
                    }
                }
            }
        }
        
        // Projectiles
        for (let i = state.projectiles.length - 1; i >= 0; i--) {
            let p = state.projectiles[i];
            if(p.target.hp <= 0) { state.projectiles.splice(i, 1); continue; }
            
            let dx = p.target.x - p.x;
            let dy = p.target.y - p.y;
            let dist = Math.hypot(dx, dy);
            
            if (dist < 15) {
                if (TOWERS[p.type].type === 'splash') {
                     state.enemies.forEach(e => {
                        if (Math.hypot(e.x - p.x, e.y - p.y) < 60) game.damageEnemy(e, TOWERS[p.type].damage);
                    });
                    createParticles(p.x, p.y, p.color, 10);
                } else if (TOWERS[p.type].type === 'slow') {
                    p.target.frozen = 60; 
                    game.damageEnemy(p.target, TOWERS[p.type].damage);
                } else {
                    game.damageEnemy(p.target, TOWERS[p.type].damage);
                }
                state.projectiles.splice(i, 1);
            } else {
                let angle = Math.atan2(dy, dx);
                p.x += Math.cos(angle) * 12;
                p.y += Math.sin(angle) * 12;
            }
        }
        updateParticles();
    },

    damageEnemy: (e, amount) => {
        e.hp -= amount;
        if (e.hp <= 0) {
            const idx = state.enemies.indexOf(e);
            if (idx > -1) {
                state.enemies.splice(idx, 1);
                state.money += 2; 
                state.score += 10;
                game.checkHighScore();
                game.updateUI();
                createParticles(e.x, e.y, "#ff0055", 8);
                playSound('hit');
            }
        }
    },

    draw: () => {
        const ctx = document.getElementById('game-canvas').getContext('2d');
        ctx.fillStyle = "#0a0a15"; ctx.fillRect(0, 0, 1280, 800);
        
        if(!state.currentMap) return;

        // Decor
        game.drawSprite(ctx, ASSETS.core, state.currentMap.core.x, state.currentMap.core.y, 100, 100);
        game.drawSprite(ctx, ASSETS.miner, state.currentMap.miner.x, state.currentMap.miner.y, 100, 100);

        // Path
        ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = CONFIG.PATH_WIDTH; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); 
        let path = state.currentMap.path;
        ctx.moveTo(path[0].x, path[0].y);
        for(let p of path) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        
        // Platforms & Towers
        for (let p of state.platforms) {
            if (p.tower && p.tower.type === 'trap') {
                if(!game.drawSprite(ctx, ASSETS.trap, p.x, p.y, 60, 60)) {
                    ctx.fillStyle = "#ffee00"; ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI*2); ctx.fill();
                }
            } else {
                game.drawSprite(ctx, ASSETS.base, p.x, p.y, 80, 80);
                if (p.tower) {
                    let t = p.tower;
                    let rot = t.angle;
                    if(t.type === 'sniper') rot += Math.PI; 
                    if(!game.drawSprite(ctx, ASSETS[TOWERS[t.type].img], p.x, p.y, 80, 80, rot)) {
                         ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t.angle);
                         ctx.fillStyle = TOWERS[t.type].color; ctx.fillRect(0, -5, 20, 10);
                         ctx.restore();
                    }
                    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(p.x - 12, p.y + 35, 24, 16); 
                    ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial"; ctx.fillText("v"+t.level, p.x-8, p.y+48);
                }
            }
        }
        
        // Enemies
        for (let e of state.enemies) {
            let size = (e.type === 'tank') ? 70 : 50;
            let path = state.currentMap.path;
            let target = path[e.pathIdx + 1];
            let angle = 0;
            if (target) angle = Math.atan2(target.y - e.y, target.x - e.x);

            if(!game.drawSprite(ctx, ASSETS['enemy_' + e.type], e.x, e.y, size, size, angle)) {
                 ctx.fillStyle = "red"; ctx.beginPath(); ctx.arc(e.x, e.y, 20, 0, Math.PI*2); ctx.fill();
            }
            ctx.fillStyle = "red"; ctx.fillRect(e.x - 20, e.y - 35, 40, 6);
            ctx.fillStyle = "#0aff00"; ctx.fillRect(e.x - 20, e.y - 35, 40 * (e.hp / e.maxHp), 6);
        }
        
        // Projectiles
        for (let p of state.projectiles) {
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill();
        }
        
        // Particles
        for (let p of state.particles) {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 20; ctx.fillRect(p.x, p.y, 4, 4); ctx.globalAlpha = 1.0;
        }
    },

    // --- DRAW HELPER (THIS WAS MISSING!) ---
    drawSprite: (ctx, img, x, y, w, h, rotation = 0) => {
        if (img && img.complete && img.naturalWidth > 0) {
            let scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
            let newW = img.naturalWidth * scale;
            let newH = img.naturalHeight * scale;
            ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
            ctx.drawImage(img, -newW/2, -newH/2, newW, newH);
            ctx.restore();
            return true;
        }
        return false;
    },

    // --- UI HELPER ---
    updateUI: () => {
        try {
            if(document.getElementById('ui-bits')) document.getElementById('ui-bits').innerText = Math.floor(state.money);
            if(document.getElementById('ui-lives')) document.getElementById('ui-lives').innerText = state.lives;
            if(document.getElementById('ui-level')) document.getElementById('ui-level').innerText = state.level;
            if(document.getElementById('ui-wave')) document.getElementById('ui-wave').innerText = state.waveInLevel;
            if(document.getElementById('ui-score')) document.getElementById('ui-score').innerText = state.score;
            if(document.getElementById('ui-high')) document.getElementById('ui-high').innerText = state.highScore;
            if(document.getElementById('miner-lvl')) document.getElementById('miner-lvl').innerText = state.minerLvl;
            if(document.getElementById('miner-rate')) {
                let rate = (CONFIG.MINER_BASE_RATE * state.minerLvl * state.yieldMultiplier).toFixed(1);
                document.getElementById('miner-rate').innerText = rate;
            }
        } catch (e) {}
    }
};

function createParticles(x, y, color, count) {
    for(let i=0; i<count; i++) state.particles.push({x, y, vx: (Math.random()-0.5)*7, vy: (Math.random()-0.5)*7, life: 20, color});
}
function updateParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) state.particles.splice(i, 1);
    }
}

document.getElementById('game-canvas').addEventListener('mousedown', game.handleCanvasClick);
document.getElementById('math-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') game.checkAnswer(); });

window.onload = game.init;
/* Version: #32 */
