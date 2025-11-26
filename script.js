/* Version: #25 */
/**
 * NEON DEFENSE: FINAL SCRIPT
 * Inkluderer Start Screen logikk og full spill-loop.
 */

console.log("--- SYSTEM STARTUP: NEON DEFENSE FINAL ---");

// --- 1. CONFIGURATION ---
const CONFIG = {
    STARTING_MONEY: 200, 
    STARTING_LIVES: 20,
    MINER_BASE_RATE: 2,
    WAVES_PER_LEVEL: 10,
    
    UNLOCK_COSTS: {
        'blaster': 0, 'trap': 2, 'sniper': 4,
        'cryo': 6, 'cannon': 8, 'tesla': 12
    }
};

// KART-KOORDINATER (1280x800)
const LEVEL_MAPS = [
    // Level 1: The Snake
    {
        path: [
            {x:-50, y:150}, {x:1000, y:150}, 
            {x:1000, y:350}, {x:200, y:350}, 
            {x:200, y:550}, {x:1000, y:550}, 
            {x:1000, y:700}, {x:50, y:700}
        ],
        core: {x: 50, y: 700},
        miner: {x: 1150, y: 100} 
    },
    // Level 2: The Siege (U-Turn)
    {
        path: [
            {x:50, y:-50}, {x:50, y:650}, 
            {x:1230, y:650}, {x:1230, y:150}, 
            {x:300, y:150}, {x:300, y:400}, {x:640, y:400} 
        ],
        core: {x: 640, y: 400},
        miner: {x: 1100, y: 700}
    },
    // Level 3: The Zig-Zag
    {
        path: [
            {x:-50, y:100}, {x:300, y:100}, {x:300, y:700}, 
            {x:600, y:700}, {x:600, y:100}, {x:900, y:100}, 
            {x:900, y:700}, {x:1200, y:700}, {x:1200, y:400}, {x:1350, y:400}
        ],
        core: {x: 1300, y: 400}, 
        miner: {x: 100, y: 700}
    }
];

const TOWERS = {
    blaster: { name: "Blaster", cost: 50, range: 160, damage: 12, rate: 30, color: "#00f3ff", type: "single", img: "blaster" },
    trap:    { name: "Mine",    cost: 30, range: 70,  damage: 300, rate: 0,   color: "#ffee00", type: "trap",   img: "trap" },
    sniper:  { name: "Railgun", cost: 150, range: 500, damage: 150, rate: 80, color: "#ff0055", type: "single", img: "sniper" },
    cryo:    { name: "Cryo",    cost: 120, range: 150, damage: 5,   rate: 8,  color: "#0099ff", type: "slow",   img: "cryo" },
    cannon:  { name: "Pulse",   cost: 250, range: 180, damage: 50,  rate: 50, color: "#0aff00", type: "splash", img: "cannon" },
    tesla:   { name: "Tesla",   cost: 500, range: 220, damage: 30,  rate: 5,  color: "#ffffff", type: "chain",  img: "tesla" }
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
    gameState: 'START', // Ny start-tilstand
    money: CONFIG.STARTING_MONEY,
    lives: CONFIG.STARTING_LIVES,
    
    level: 1,
    waveTotal: 0, 
    waveInLevel: 0, 
    
    score: 0,
    highScore: parseInt(localStorage.getItem('nd_highscore')) || 0,
    
    activeTables: [2, 3, 4, 5, 10], 
    yieldMultiplier: 1.0,
    minerLvl: 1,
    
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    
    currentMap: LEVEL_MAPS[0],
    
    unlockedTowers: ['blaster'],
    selectedBlueprint: null, 
    
    spawnQueue: [], 
    spawnTimer: null,
    
    mathTask: { active: false, type: null, target: null, remaining: 0, total: 0, answer: 0 }
};

// --- 4. AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    
    if (type === 'shoot') {
        osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(50, now+0.1);
        gain.gain.setValueAtTime(0.03, now); gain.gain.linearRampToValueAtTime(0, now+0.1);
        osc.start(now); osc.stop(now+0.1);
    } else if (type === 'hit') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now+0.05); osc.start(now); osc.stop(now+0.05);
    } else if (type === 'correct') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(1200, now+0.2);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now+0.2);
        osc.start(now); osc.stop(now+0.2);
    } else if (type === 'terminal_open') {
        osc.type = 'square'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(400, now+0.3);
        gain.gain.setValueAtTime(0.05, now); osc.start(now); osc.stop(now+0.3);
    } else if (type === 'wave_start') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(200, now); osc.frequency.linearRampToValueAtTime(800, now+1.0);
        gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now+1.0);
    } else if (type === 'explode') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(50, now); osc.frequency.linearRampToValueAtTime(10, now+0.4);
        gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now+0.4);
        osc.start(now); osc.stop(now+0.4);
    } else if (type === 'click') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); 
        gain.gain.setValueAtTime(0.05, now); osc.start(now); osc.stop(now+0.05);
    }
}

// --- 5. CORE ENGINE ---
const game = {
    init: () => {
        // Start i START-mode, ikke last level enda
        game.renderToolbar();
        game.renderTableSelector(); 
        
        requestAnimationFrame(game.loop);
        setInterval(game.minerTick, 1000); 
    },

    enterLobby: () => {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('ui-layer').classList.remove('hidden'); // Vis HUD
        game.loadLevel(1);
        game.openConfig(); // Gå til config
    },

    loadLevel: (lvlNum) => {
        state.level = lvlNum;
        state.waveInLevel = 0;
        let mapIdx = (lvlNum - 1) % LEVEL_MAPS.length;
        state.currentMap = LEVEL_MAPS[mapIdx];
        
        state.towers = [];
        state.enemies = [];
        state.projectiles = [];
        state.particles = [];
        
        console.log(`Loading Level ${lvlNum}, Map ${mapIdx}`);
    },

    // --- CONFIG ---
    openConfig: () => {
        if (state.gameState === 'PLAYING') { alert("CANNOT RECONFIGURE DURING COMBAT!"); return; }
        state.gameState = 'CONFIG';
        document.getElementById('config-overlay').classList.remove('hidden');
        document.getElementById('wave-overlay').classList.add('hidden'); 
        game.renderTableSelector();
    },

    closeConfig: () => {
        if (state.activeTables.length === 0) { alert("SELECT AT LEAST ONE DATA STREAM!"); return; }
        document.getElementById('config-overlay').classList.add('hidden');
        state.gameState = 'LOBBY';
        document.getElementById('wave-overlay').classList.remove('hidden');
        game.updateUI();
    },

    renderTableSelector: () => {
        const container = document.getElementById('table-selector');
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
        el.innerText = "x" + state.yieldMultiplier;
        if (state.yieldMultiplier >= 2.0) el.style.color = "#0aff00"; 
        else if (state.yieldMultiplier >= 1.5) el.style.color = "#ffee00"; 
        else el.style.color = "#fff"; 
    },

    // --- MINER ---
    minerTick: () => {
        if (state.gameState !== 'PLAYING') return; 
        let income = CONFIG.MINER_BASE_RATE * state.minerLvl;
        income *= state.yieldMultiplier;
        state.money += income;
        game.updateUI();
    },

    openMinerUpgrade: () => {
        if (state.gameState !== 'PLAYING') return; 
        const tasks = state.minerLvl * 2;
        game.startMathTask('UPGRADE_MINER', null, tasks, `OPPGRADER MINER TIL LVL ${state.minerLvl + 1}`);
    },

    // --- WAVE LOGIC ---
    shuffle: (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    generateWavePool: (waveTotal) => {
        let pool = [];
        let total = 12 + (waveTotal * 2); 
        
        let numFast = 0;
        let numTank = 0;

        if (waveTotal >= 3) numFast = Math.floor(total * 0.25); 
        if (waveTotal >= 6) numTank = Math.floor(total * 0.20); 

        let numBasic = total - numFast - numTank;
        for(let i=0; i<numBasic; i++) pool.push('basic');
        for(let i=0; i<numFast; i++) pool.push('fast');
        for(let i=0; i<numTank; i++) pool.push('tank');

        return game.shuffle(pool);
    },

    startNextWave: () => {
        if (state.waveInLevel >= CONFIG.WAVES_PER_LEVEL) {
            game.levelComplete();
            return;
        }

        state.waveInLevel++;
        state.waveTotal++;
        state.gameState = 'PLAYING';
        document.querySelectorAll('.overlay-screen').forEach(el => el.classList.add('hidden'));
        
        state.spawnQueue = game.generateWavePool(state.waveTotal);
        
        let hpBase = 60 + (state.waveTotal * 40);
        let speedBase = 0.8 + (state.waveTotal * 0.1);
        
        state.enemiesToSpawn = state.spawnQueue.length;
        playSound('wave_start');
        console.log(`Level ${state.level}, Wave ${state.waveInLevel} (Total ${state.waveTotal})`);

        if (state.spawnTimer) clearInterval(state.spawnTimer);
        state.spawnTimer = setInterval(() => {
            if (state.gameState !== 'PLAYING') return;
            
            if (state.spawnQueue.length > 0) {
                const type = state.spawnQueue.pop(); 
                let eHp = hpBase;
                let eSpeed = speedBase;
                
                if (type === 'fast') { eHp *= 0.6; eSpeed *= 1.5; }
                if (type === 'tank') { eHp *= 2.5; eSpeed *= 0.6; }

                state.enemies.push({
                    x: state.currentMap.path[0].x, 
                    y: state.currentMap.path[0].y, 
                    pathIdx: 0,
                    hp: eHp, maxHp: eHp, speed: eSpeed, frozen: 0, type: type
                });
            } else {
                clearInterval(state.spawnTimer);
            }
        }, 1200); 
        
        game.updateUI();
    },

    checkWaveEnd: () => {
        if (state.spawnQueue.length === 0 && state.enemies.length === 0 && state.gameState === 'PLAYING') {
            game.waveComplete();
        }
    },

    waveComplete: () => {
        state.gameState = 'LOBBY';
        const bonus = state.waveTotal * 100;
        state.score += bonus;
        game.checkHighScore();
        
        if (state.waveInLevel >= CONFIG.WAVES_PER_LEVEL) {
            document.getElementById('next-level-num').innerText = state.level + 1;
            document.getElementById('level-overlay').classList.remove('hidden');
        } else {
            document.getElementById('wave-title').innerText = "WAVE COMPLETE";
            document.getElementById('wave-bonus').innerText = bonus;
            document.getElementById('wave-overlay').classList.remove('hidden');
        }
        
        game.closeMath();
        game.updateUI();
    },
    
    levelComplete: () => {
        // Handled by overlay button
    },
    
    startNextLevel: () => {
        game.loadLevel(state.level + 1);
        document.getElementById('level-overlay').classList.add('hidden');
        document.getElementById('wave-overlay').classList.remove('hidden');
        document.getElementById('wave-title').innerText = "NEW SECTOR REACHED";
        document.getElementById('wave-bonus').innerText = "READY";
        game.updateUI();
    },

    checkHighScore: () => {
        if (state.score > state.highScore) {
            state.highScore = state.score;
            localStorage.setItem('nd_highscore', state.highScore);
        }
    },

    gameOver: () => {
        state.gameState = 'GAMEOVER';
        document.getElementById('final-score').innerText = state.score;
        document.getElementById('gameover-overlay').classList.remove('hidden');
        game.closeMath();
    },

    // --- MATH ---
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
        if (t.type === 'UPGRADE_MINER') {
            state.minerLvl++;
        } 
        else if (t.type === 'UNLOCK') {
            state.unlockedTowers.push(t.target);
            game.renderToolbar();
        }
        else if (t.type === 'UPGRADE_TOWER') {
            t.target.level++;
            t.target.damage *= 1.4; 
            t.target.range += 15;
            createParticles(t.target.x, t.target.y, "#ffffff", 20);
        }
        game.closeMath();
        game.updateUI();
    },

    closeMath: () => {
        state.mathTask.active = false;
        document.getElementById('math-terminal').classList.add('hidden');
    },

    // --- TOWER ---
    renderToolbar: () => {
        const bar = document.getElementById('toolbar');
        bar.innerHTML = "";
        for (let key of Object.keys(TOWERS)) {
            const t = TOWERS[key];
            const isUnlocked = state.unlockedTowers.includes(key);
            const btn = document.createElement('div');
            btn.className = `tower-btn ${isUnlocked ? '' : 'locked'}`;
            if (isUnlocked) {
                btn.innerHTML = `<div>${t.name}</div><div class="tower-cost">${t.cost}</div>`;
                btn.onclick = () => {
                    if (state.gameState !== 'PLAYING') return;
                    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    state.selectedBlueprint = key;
                };
            } else {
                const req = CONFIG.UNLOCK_COSTS[key];
                btn.innerHTML = `<div class="lock-icon">🔒</div><div>UNLOCK</div>`;
                btn.onclick = () => {
                    if (state.gameState !== 'PLAYING') return;
                    game.startMathTask('UNLOCK', key, req, `UNLOCKING BLUEPRINT: ${t.name}`);
                };
            }
            bar.appendChild(btn);
        }
    },

    handleCanvasClick: (e) => {
        if (state.gameState !== 'PLAYING') return;
        if (state.mathTask.active) return;
        
        const rect = document.getElementById('game-canvas').getBoundingClientRect();
        const scaleX = document.getElementById('game-canvas').width / rect.width;
        const scaleY = document.getElementById('game-canvas').height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        for (let t of state.towers) {
            if (Math.hypot(x - t.x, y - t.y) < 40) {
                const tasks = t.level * 2;
                game.startMathTask('UPGRADE_TOWER', t, tasks, `UPGRADING ${TOWERS[t.type].name} TO LVL ${t.level + 1}`);
                return;
            }
        }

        if (state.selectedBlueprint) {
            game.buildTower(x, y, state.selectedBlueprint);
        }
    },

    buildTower: (x, y, type) => {
        const data = TOWERS[type];
        for (let t of state.towers) {
            if (Math.hypot(x - t.x, y - t.y) < 85) return; 
        }
        
        if (state.money >= data.cost) {
            state.money -= data.cost;
            state.towers.push({
                x, y, type, 
                level: 1, cooldown: 0, angle: 0, 
                range: data.range, damage: data.damage, maxCooldown: data.rate
            });
            createParticles(x, y, data.color, 10);
            game.updateUI();
        } else {
            document.getElementById('ui-bits').style.color = "red";
            setTimeout(() => document.getElementById('ui-bits').style.color = "#ffee00", 500);
        }
    },

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

    // --- GAME LOOP ---
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
        for (let i = state.towers.length - 1; i >= 0; i--) {
            let t = state.towers[i];
            
            if (t.type === 'trap') {
                let hit = false;
                for (let e of state.enemies) {
                    if (Math.hypot(e.x - t.x, e.y - t.y) < t.range) {
                        game.damageEnemy(e, t.damage);
                        createParticles(t.x, t.y, "#ffaa00", 30);
                        playSound('explode');
                        state.towers.splice(i, 1); 
                        hit = true; break;
                    }
                }
                if (hit) continue; 
            } 
            else {
                if (t.cooldown > 0) t.cooldown--;
                
                let target = null;
                let minDist = t.range;
                for (let e of state.enemies) {
                    let d = Math.hypot(e.x - t.x, e.y - t.y);
                    if (d < minDist) { minDist = d; target = e; }
                }
                
                if (target) {
                    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
                    if (t.cooldown <= 0) {
                        t.cooldown = t.maxCooldown;
                        playSound('shoot');
                        state.projectiles.push({
                            x: t.x, y: t.y, target: target, type: t.type, color: TOWERS[t.type].color 
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
                let reward = 7 * state.yieldMultiplier;
                state.money += reward;
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
        
        // Decor
        let corePos = state.currentMap.core;
        let minerPos = state.currentMap.miner;
        game.drawSprite(ctx, ASSETS.core, corePos.x, corePos.y, 100, 100);
        game.drawSprite(ctx, ASSETS.miner, minerPos.x, minerPos.y, 100, 100);

        // Path
        ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = 80; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); 
        let path = state.currentMap.path;
        ctx.moveTo(path[0].x, path[0].y);
        for(let p of path) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        
        // Towers
        for (let t of state.towers) {
            if (t.type === 'trap') {
                if(!game.drawSprite(ctx, ASSETS.trap, t.x, t.y, 60, 60)) {
                    ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(t.x, t.y, 25, 0, Math.PI*2); ctx.fill();
                }
            } else {
                game.drawSprite(ctx, ASSETS.base, t.x, t.y, 80, 80);
                let rot = t.angle;
                if(t.type === 'sniper') rot += Math.PI; 
                if(!game.drawSprite(ctx, ASSETS[TOWERS[t.type].img], t.x, t.y, 80, 80, rot)) {
                     ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle);
                     ctx.fillStyle = TOWERS[t.type].color; ctx.fillRect(0, -5, 20, 10);
                     ctx.restore();
                }
            }
            // Version Text
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(t.x - 12, t.y + 35, 24, 16); 
            ctx.fillStyle = "#fff"; ctx.font = "bold 14px Arial"; ctx.fillText("v"+t.level, t.x-8, t.y+48); 
        }
        
        // Enemies
        for (let e of state.enemies) {
            let size = (e.type === 'tank') ? 70 : 50;
            
            // CALCULATE ROTATION
            let path = state.currentMap.path;
            let target = path[e.pathIdx + 1];
            let angle = 0;
            if (target) {
                let dx = target.x - e.x;
                let dy = target.y - e.y;
                angle = Math.atan2(dy, dx);
            }

            if(!game.drawSprite(ctx, ASSETS['enemy_' + e.type], e.x, e.y, size, size, angle)) {
                 ctx.fillStyle = e.type === 'fast' ? "orange" : (e.type === 'tank' ? "purple" : "red");
                 ctx.beginPath(); ctx.arc(e.x, e.y, 18, 0, Math.PI*2); ctx.fill();
            }
            
            // HP Bar
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

    // --- UI HELPER (SAFE) ---
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
        } catch (e) {
            console.warn("UI Update failed (HTML mismatch?)", e);
        }
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
/* Version: #25 */
