/* Version: #18 */
/**
 * NEON DEFENSE: GRAPHICS UPDATE - SCRIPT
 * Inkluderer bilde-innlasting, sprite-rotasjon og fiende-variasjoner.
 */

console.log("--- SYSTEM STARTUP: NEON DEFENSE V18 (GRAPHICS) ---");

// --- 1. CONFIGURATION ---
const CONFIG = {
    STARTING_MONEY: 150,
    STARTING_LIVES: 20,
    MINER_BASE_RATE: 2, 
    
    UNLOCK_COSTS: {
        'blaster': 0, 
        'trap': 2,
        'sniper': 4,
        'cryo': 6,
        'cannon': 8,
        'tesla': 12
    }
};

const TOWERS = {
    blaster: { name: "Blaster", cost: 50, range: 120, damage: 10, rate: 30, color: "#00f3ff", type: "single", img: "blaster" },
    trap:    { name: "Mine",    cost: 30, range: 40,  damage: 250, rate: 0,   color: "#ffee00", type: "trap",   img: "trap" },
    sniper:  { name: "Railgun", cost: 150, range: 400, damage: 120, rate: 80, color: "#ff0055", type: "single", img: "sniper" },
    cryo:    { name: "Cryo",    cost: 120, range: 100, damage: 4,   rate: 8,  color: "#0099ff", type: "slow",   img: "cryo" },
    cannon:  { name: "Pulse",   cost: 250, range: 140, damage: 45,  rate: 50, color: "#0aff00", type: "splash", img: "cannon" },
    tesla:   { name: "Tesla",   cost: 500, range: 180, damage: 25,  rate: 5,  color: "#ffffff", type: "chain",  img: "tesla" }
};

// --- 2. ASSETS LOADER ---
const ASSETS = {
    base: new Image(),
    core: new Image(),
    miner: new Image(),
    
    // Towers
    blaster: new Image(),
    sniper: new Image(),
    cryo: new Image(),
    cannon: new Image(),
    tesla: new Image(),
    trap: new Image(),
    
    // Enemies
    enemy_basic: new Image(),
    enemy_fast: new Image(),
    enemy_tank: new Image()
};

// Angi filstier
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
    gameState: 'CONFIG', 
    money: CONFIG.STARTING_MONEY,
    lives: CONFIG.STARTING_LIVES,
    wave: 0,
    score: 0,
    highScore: parseInt(localStorage.getItem('nd_highscore')) || 0,
    
    // Config
    activeTables: [2, 3, 4, 5, 10], 
    yieldMultiplier: 1.0,
    
    minerLvl: 1,
    
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    mapPath: [],
    
    unlockedTowers: ['blaster'],
    selectedBlueprint: null, 
    
    enemiesToSpawn: 0,
    spawnTimer: null,
    
    mathTask: {
        active: false,
        type: null, target: null, remaining: 0, total: 0, answer: 0
    }
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
        state.mapPath = [
            {x:-50, y:140}, {x:850, y:140}, 
            {x:850, y:280}, {x:150, y:280}, 
            {x:150, y:420}, {x:850, y:420}, 
            {x:850, y:560}, {x:50, y:560} // Core location
        ];
        
        game.updateUI();
        game.renderToolbar();
        game.renderTableSelector(); 
        
        requestAnimationFrame(game.loop);
        setInterval(game.minerTick, 1000); 
    },

    // --- CONFIG ---
    openConfig: () => {
        if (state.gameState === 'PLAYING') { alert("CANNOT RECONFIGURE DURING COMBAT!"); return; }
        document.getElementById('config-overlay').classList.remove('hidden');
        document.getElementById('wave-overlay').classList.add('hidden'); 
        game.renderTableSelector();
    },

    closeConfig: () => {
        if (state.activeTables.length === 0) { alert("SELECT AT LEAST ONE DATA STREAM!"); return; }
        document.getElementById('config-overlay').classList.add('hidden');
        if (state.gameState === 'CONFIG') state.gameState = 'LOBBY';
        if (state.gameState === 'LOBBY') document.getElementById('wave-overlay').classList.remove('hidden');
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

    // --- WAVE ---
    startNextWave: () => {
        state.wave++;
        state.gameState = 'PLAYING';
        document.querySelectorAll('.overlay-screen').forEach(el => el.classList.add('hidden'));
        
        let count = 12 + (state.wave * 4);
        let hp = 60 + (state.wave * 35);
        let speed = 0.8 + (state.wave * 0.15);
        
        state.enemiesToSpawn = count;
        playSound('wave_start');
        console.log(`Wave ${state.wave}: Count=${count}, HP=${hp}, Speed=${speed.toFixed(2)}`);

        if (state.spawnTimer) clearInterval(state.spawnTimer);
        state.spawnTimer = setInterval(() => {
            if (state.gameState !== 'PLAYING') return;
            
            if (state.enemiesToSpawn > 0) {
                // VELG FIENDE TYPE
                let type = 'basic';
                if (state.wave >= 4 && Math.random() > 0.7) type = 'fast';
                if (state.wave >= 7 && Math.random() > 0.8) type = 'tank';
                
                // Juster stats basert på type
                let eHp = hp;
                let eSpeed = speed;
                
                if (type === 'fast') { eHp *= 0.6; eSpeed *= 1.5; }
                if (type === 'tank') { eHp *= 2.5; eSpeed *= 0.6; }

                state.enemies.push({
                    x: state.mapPath[0].x, y: state.mapPath[0].y, pathIdx: 0,
                    hp: eHp, maxHp: eHp, speed: eSpeed, frozen: 0, type: type
                });
                state.enemiesToSpawn--;
            } else {
                clearInterval(state.spawnTimer);
            }
        }, 1200); 
        
        game.updateUI();
    },

    checkWaveEnd: () => {
        if (state.enemiesToSpawn <= 0 && state.enemies.length === 0 && state.gameState === 'PLAYING') {
            game.waveComplete();
        }
    },

    waveComplete: () => {
        state.gameState = 'LOBBY';
        const bonus = state.wave * 100;
        state.score += bonus;
        game.checkHighScore();
        document.getElementById('wave-bonus').innerText = bonus;
        document.getElementById('wave-overlay').classList.remove('hidden');
        game.closeMath();
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
            if (Math.hypot(x - t.x, y - t.y) < 30) {
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
            if (Math.hypot(x - t.x, y - t.y) < 50) return; // Plass sjekk
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
            let targetP = state.mapPath[e.pathIdx + 1];
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
        ctx.fillStyle = "#0a0a15"; ctx.fillRect(0, 0, 1100, 750);
        
        // Draw Core & Miner (Decoration)
        if(ASSETS.core.complete) ctx.drawImage(ASSETS.core, 20, 530, 60, 60);
        if(ASSETS.miner.complete) ctx.drawImage(ASSETS.miner, 950, 50, 60, 60);

        // Path
        ctx.strokeStyle = "#222"; ctx.lineWidth = 40; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(state.mapPath[0].x, state.mapPath[0].y);
        for(let p of state.mapPath) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        
        // Towers
        for (let t of state.towers) {
            ctx.save();
            ctx.translate(t.x, t.y);
            
            if (t.type === 'trap') {
                if(ASSETS.trap.complete) ctx.drawImage(ASSETS.trap, -20, -20, 40, 40);
                else {
                    // Fallback
                    ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.fill();
                }
            } else {
                // Base
                if(ASSETS.base.complete) ctx.drawImage(ASSETS.base, -25, -25, 50, 50);
                
                // Turret
                ctx.rotate(t.angle);
                if (t.type === 'sniper') ctx.rotate(Math.PI); // Fix left-pointing sprite
                
                let img = ASSETS[TOWERS[t.type].img];
                if(img && img.complete) ctx.drawImage(img, -25, -25, 50, 50);
                else {
                    // Fallback
                    ctx.fillStyle = TOWERS[t.type].color; ctx.fillRect(0, -5, 20, 10);
                }
            }
            
            // Level Badge
            ctx.restore();
            ctx.fillStyle = "#fff"; ctx.font = "bold 12px Arial"; ctx.fillText("v"+t.level, t.x-6, t.y+5);
        }
        
        // Enemies
        for (let e of state.enemies) {
            ctx.save();
            ctx.translate(e.x, e.y);
            
            // Roter fiende mot bevegelsesretning (valgfritt, men ser kulere ut)
            // Vi må finne vinkelen basert på path. Enkelt her:
            // (Foreløpig ingen rotasjon på fiender, de er top-down bugs)
            
            let img = ASSETS['enemy_' + e.type];
            if(img && img.complete) {
                // Tegn bilde
                let size = (e.type === 'tank') ? 50 : 30;
                ctx.drawImage(img, -size/2, -size/2, size, size);
            } else {
                ctx.fillStyle = e.type === 'fast' ? "orange" : (e.type === 'tank' ? "purple" : "red");
                ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
            }
            
            ctx.restore();
            
            // HP Bar
            ctx.fillStyle = "red"; ctx.fillRect(e.x - 15, e.y - 25, 30, 4);
            ctx.fillStyle = "#0aff00"; ctx.fillRect(e.x - 15, e.y - 25, 30 * (e.hp / e.maxHp), 4);
        }
        
        // Projectiles
        for (let p of state.projectiles) {
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
        }
        
        // Particles
        for (let p of state.particles) {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 20; ctx.fillRect(p.x, p.y, 3, 3); ctx.globalAlpha = 1.0;
        }
    },

    updateUI: () => {
        document.getElementById('ui-bits').innerText = Math.floor(state.money);
        document.getElementById('ui-lives').innerText = state.lives;
        document.getElementById('ui-wave').innerText = state.wave;
        document.getElementById('ui-score').innerText = state.score;
        document.getElementById('ui-high').innerText = state.highScore;
        document.getElementById('miner-lvl').innerText = state.minerLvl;
        
        let rate = (CONFIG.MINER_BASE_RATE * state.minerLvl * state.yieldMultiplier).toFixed(1);
        document.getElementById('miner-rate').innerText = rate;
    }
};

function createParticles(x, y, color, count) {
    for(let i=0; i<count; i++) state.particles.push({x, y, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5, life: 20, color});
}
function updateParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) state.particles.splice(i, 1);
    }
}

// --- EVENTS ---
document.getElementById('game-canvas').addEventListener('mousedown', game.handleCanvasClick);
document.getElementById('math-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') game.checkAnswer(); });

window.onload = game.init;
/* Version: #18 */
