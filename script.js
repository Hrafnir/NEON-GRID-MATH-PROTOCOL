/* Version: #13 */
/**
 * NEON DEFENSE: REALTIME - SCRIPT
 * Endringer: Tregere fiender, lengre bølger, fungerende miner.
 */

console.log("--- SYSTEM STARTUP: NEON DEFENSE V13 ---");

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
    blaster: { name: "Blaster", cost: 50, range: 120, damage: 10, rate: 30, color: "#00f3ff", type: "single" },
    trap:    { name: "Mine",    cost: 30, range: 40,  damage: 250, rate: 0,   color: "#ffee00", type: "trap" }, // Økt range/dmg
    sniper:  { name: "Railgun", cost: 150, range: 400, damage: 120, rate: 80, color: "#ff0055", type: "single" },
    cryo:    { name: "Cryo",    cost: 120, range: 100, damage: 4,   rate: 8,  color: "#0099ff", type: "slow" },
    cannon:  { name: "Pulse",   cost: 250, range: 140, damage: 45,  rate: 50, color: "#0aff00", type: "splash" },
    tesla:   { name: "Tesla",   cost: 500, range: 180, damage: 25,  rate: 5,  color: "#ffffff", type: "chain" }
};

// --- 2. GLOBAL STATE ---
const state = {
    gameState: 'LOBBY', 
    money: CONFIG.STARTING_MONEY,
    lives: CONFIG.STARTING_LIVES,
    wave: 0,
    score: 0,
    highScore: parseInt(localStorage.getItem('nd_highscore')) || 0,
    
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
        type: null,     
        target: null,   
        remaining: 0,   
        total: 0,
        answer: 0
    }
};

// --- 3. AUDIO ENGINE ---
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
    }
}

// --- 4. CORE ENGINE ---
const game = {
    init: () => {
        state.mapPath = [
            {x:0, y:100}, {x:850, y:100}, {x:850, y:250}, 
            {x:150, y:250}, {x:150, y:400}, {x:850, y:400}, 
            {x:850, y:550}, {x:100, y:550}
        ];
        
        game.updateUI();
        game.renderToolbar();
        
        document.getElementById('wave-bonus').innerText = "0";
        document.getElementById('wave-overlay').classList.remove('hidden');
        
        requestAnimationFrame(game.loop);
        setInterval(game.minerTick, 1000); 
    },

    minerTick: () => {
        if (state.gameState !== 'PLAYING') return; 
        const income = CONFIG.MINER_BASE_RATE * state.minerLvl;
        state.money += income;
        game.updateUI();
    },

    openMinerUpgrade: () => {
        if (state.gameState !== 'PLAYING') return; 
        const tasks = state.minerLvl * 2;
        game.startMathTask('UPGRADE_MINER', null, tasks, `OPPGRADER MINER TIL LVL ${state.minerLvl + 1}`);
    },

    startNextWave: () => {
        state.wave++;
        state.gameState = 'PLAYING';
        document.querySelectorAll('.overlay-screen').forEach(el => el.classList.add('hidden'));
        
        // --- BALANSERING AV BØLGER ---
        // Antall: Starter på 12, øker med 4 per bølge (Lengre bølger)
        let count = 12 + (state.wave * 4);
        
        // Helse: Øker gradvis
        let hp = 60 + (state.wave * 35);
        
        // Fart: Starter på 1.0 (sakte!), øker sakte
        let speed = 0.8 + (state.wave * 0.15);
        
        state.enemiesToSpawn = count;
        playSound('wave_start');
        console.log(`Wave ${state.wave}: Count=${count}, HP=${hp}, Speed=${speed.toFixed(2)}`);

        if (state.spawnTimer) clearInterval(state.spawnTimer);
        state.spawnTimer = setInterval(() => {
            if (state.gameState !== 'PLAYING') return;
            
            if (state.enemiesToSpawn > 0) {
                state.enemies.push({
                    x: state.mapPath[0].x, y: state.mapPath[0].y, pathIdx: 0,
                    hp: hp, maxHp: hp, speed: speed, frozen: 0
                });
                state.enemiesToSpawn--;
            } else {
                clearInterval(state.spawnTimer);
            }
        }, 1200); // 1.2 sek mellom fiender (litt mer mellomrom)
        
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

    // --- MATH TERMINAL ---
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
        const difficulty = Math.min(12, 2 + Math.floor(state.wave / 3)); 
        const a = Math.floor(Math.random() * 11) + 2; 
        const b = Math.floor(Math.random() * (9 + difficulty)) + 2;  
        
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

    // --- TOWER SYSTEM ---
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
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (let t of state.towers) {
            if (Math.hypot(x - t.x, y - t.y) < 20) {
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
            if (Math.hypot(x - t.x, y - t.y) < 40) return;
        }
        
        if (state.money >= data.cost) {
            state.money -= data.cost;
            state.towers.push({
                x, y, type, 
                level: 1,
                cooldown: 0,
                angle: 0, 
                range: data.range, 
                damage: data.damage, 
                maxCooldown: data.rate
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

        // Towers (Reverse loop for safe removal of mines)
        for (let i = state.towers.length - 1; i >= 0; i--) {
            let t = state.towers[i];
            
            // --- TRAP LOGIC (MINER) ---
            if (t.type === 'trap') {
                let hit = false;
                for (let e of state.enemies) {
                    if (Math.hypot(e.x - t.x, e.y - t.y) < t.range) {
                        game.damageEnemy(e, t.damage);
                        createParticles(t.x, t.y, "#ffaa00", 30);
                        playSound('explode');
                        state.towers.splice(i, 1); // Fjern minen
                        hit = true;
                        break;
                    }
                }
                if (hit) continue; // Hopp til neste tårn hvis denne smalt
            } 
            // --- VANLIGE TÅRN ---
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
                state.money += 7;
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
        ctx.fillStyle = "#0a0a15"; ctx.fillRect(0, 0, 1000, 600);
        
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
                // Tegn Mine
                ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle = t.color; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.stroke();
            } else {
                // Tegn Vanlig Tårn
                ctx.fillStyle = "#333"; ctx.fillRect(-15, -15, 30, 30);
                ctx.fillStyle = "#fff"; ctx.font = "10px Arial"; ctx.fillText("v"+t.level, -6, 4);
                ctx.rotate(t.angle);
                ctx.fillStyle = TOWERS[t.type].color; ctx.fillRect(0, -5, 20, 10);
            }
            ctx.restore();
        }
        
        // Enemies
        for (let e of state.enemies) {
            ctx.fillStyle = e.frozen > 0 ? "#0099ff" : "#ff0055";
            ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "red"; ctx.fillRect(e.x - 10, e.y - 20, 20, 4);
            ctx.fillStyle = "#0aff00"; ctx.fillRect(e.x - 10, e.y - 20, 20 * (e.hp / e.maxHp), 4);
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
        document.getElementById('miner-rate').innerText = CONFIG.MINER_BASE_RATE * state.minerLvl;
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
/* Version: #13 */
