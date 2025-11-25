/* Version: #09 */
/**
 * NEON DEFENSE: INTEGRATED - SCRIPT
 * Inneholder: Game Loop, Math Terminal, Miner Logic, Turret System.
 */

console.log("--- SYSTEM STARTUP: NEON DEFENSE INTEGRATED ---");

// --- 1. CONFIGURATION ---
const CONFIG = {
    STARTING_MONEY: 150,
    STARTING_LIVES: 20,
    MINER_BASE_RATE: 2, // Bits per sekund på level 1
    
    // Hvor mange oppgaver kreves for å låse opp tårn?
    UNLOCK_COSTS: {
        'blaster': 0, // Alltid åpen
        'trap': 3,
        'sniper': 5,
        'cryo': 8,
        'cannon': 10,
        'tesla': 15
    }
};

const TOWERS = {
    blaster: { name: "Blaster", cost: 50, range: 120, damage: 10, rate: 30, color: "#00f3ff", type: "single" },
    trap:    { name: "Mine",    cost: 30, range: 30,  damage: 150, rate: 100,color: "#ffee00", type: "trap" },
    sniper:  { name: "Railgun", cost: 150, range: 350, damage: 100, rate: 90, color: "#ff0055", type: "single" },
    cryo:    { name: "Cryo",    cost: 120, range: 100, damage: 5,   rate: 10, color: "#0099ff", type: "slow" },
    cannon:  { name: "Pulse",   cost: 250, range: 130, damage: 40,  rate: 60, color: "#0aff00", type: "splash" },
    tesla:   { name: "Tesla",   cost: 500, range: 180, damage: 20,  rate: 5,  color: "#ffffff", type: "chain" }
};

// --- 2. GLOBAL STATE ---
const state = {
    money: CONFIG.STARTING_MONEY,
    lives: CONFIG.STARTING_LIVES,
    wave: 0,
    
    // Miner
    minerLvl: 1,
    minerTimer: 0,
    
    // Game Objects
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    mapPath: [],
    
    // Research / Unlocks
    unlockedTowers: ['blaster'],
    
    // Interaction
    selectedBlueprint: null, // Hvilket tårn vi holder i musa for å bygge
    isPaused: false,
    
    // Math Task State
    mathTask: {
        active: false,
        type: null,     // 'UNLOCK', 'UPGRADE_TOWER', 'UPGRADE_MINER'
        target: null,   // Referanse til tårnet eller typen
        remaining: 0,   // Antall oppgaver igjen
        total: 0
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
        gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now+0.1);
        osc.start(now); osc.stop(now+0.1);
    } else if (type === 'correct') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(1200, now+0.2);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now+0.2);
        osc.start(now); osc.stop(now+0.2);
    } else if (type === 'terminal_open') {
        osc.type = 'square'; osc.frequency.setValueAtTime(100, now); osc.frequency.linearRampToValueAtTime(400, now+0.3);
        gain.gain.setValueAtTime(0.05, now); osc.start(now); osc.stop(now+0.3);
    }
}

// --- 4. CORE ENGINE ---
const game = {
    init: () => {
        // Setup Map Path
        state.mapPath = [
            {x:0, y:100}, {x:800, y:100}, {x:800, y:250}, 
            {x:200, y:250}, {x:200, y:400}, {x:800, y:400}, 
            {x:800, y:550}, {x:100, y:550}
        ];
        
        game.updateUI();
        game.renderToolbar();
        
        // Start Loops
        requestAnimationFrame(game.loop);
        setInterval(game.minerTick, 1000); // Passiv inntekt hvert sekund
    },

    // --- MINER LOGIC ---
    minerTick: () => {
        if (state.isPaused) return;
        // Formel: Base * Level
        const income = CONFIG.MINER_BASE_RATE * state.minerLvl;
        state.money += income;
        game.updateUI();
        
        // Visuell effekt på UI
        const el = document.getElementById('ui-bits');
        el.style.textShadow = "0 0 10px #fff";
        setTimeout(() => el.style.textShadow = "none", 200);
    },

    openMinerUpgrade: () => {
        if (state.isPaused) return;
        // Oppgaver kreves: Level * 2
        const tasks = state.minerLvl * 2;
        game.startMathTask('UPGRADE_MINER', null, tasks, `OPPGRADER MINER TIL LVL ${state.minerLvl + 1}`);
    },

    // --- WAVE LOGIC ---
    nextWave: () => {
        if (state.isPaused || !state.nextWaveReady) return;
        
        state.wave++;
        state.nextWaveReady = false;
        document.getElementById('wave-timer').innerText = "INCOMING";
        
        let count = 6 + (state.wave * 3);
        let hp = 60 + (state.wave * 50);
        let speed = 2 + (state.wave * 0.2);
        
        let spawned = 0;
        let interval = setInterval(() => {
            if(state.isPaused) return; // Pause spawning if math is open
            state.enemies.push({
                x: state.mapPath[0].x, y: state.mapPath[0].y, pathIdx: 0,
                hp: hp, maxHp: hp, speed: speed, frozen: 0
            });
            spawned++;
            if (spawned >= count) {
                clearInterval(interval);
                state.nextWaveReady = true;
                document.getElementById('wave-timer').innerText = "READY";
            }
        }, 1000);
    },

    // --- MATH TERMINAL LOGIC ---
    startMathTask: (type, target, count, contextText) => {
        state.isPaused = true;
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
        const a = Math.floor(Math.random() * 11) + 2; // 2-12
        const b = Math.floor(Math.random() * 9) + 2;  // 2-10
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
            input.classList.add('shake'); // CSS animasjon bør legges til
            setTimeout(() => input.classList.remove('shake'), 500);
        }
    },

    completeMathTask: () => {
        const t = state.mathTask;
        
        if (t.type === 'UPGRADE_MINER') {
            state.minerLvl++;
            alert("MINER UPGRADED!");
        } 
        else if (t.type === 'UNLOCK') {
            state.unlockedTowers.push(t.target);
            alert(`${TOWERS[t.target].name} UNLOCKED!`);
            game.renderToolbar();
        }
        else if (t.type === 'UPGRADE_TOWER') {
            t.target.level++;
            t.target.damage *= 1.5; // 50% mer skade per level
            t.target.range += 10;
        }

        game.closeMath();
        game.updateUI();
    },

    closeMath: () => {
        state.isPaused = false;
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
                    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    state.selectedBlueprint = key;
                };
            } else {
                const req = CONFIG.UNLOCK_COSTS[key];
                btn.innerHTML = `<div class="lock-icon">🔒</div><div>UNLOCK</div>`;
                btn.onclick = () => {
                    game.startMathTask('UNLOCK', key, req, `UNLOCKING BLUEPRINT: ${t.name}`);
                };
            }
            bar.appendChild(btn);
        }
    },

    handleCanvasClick: (e) => {
        if (state.isPaused) return;
        
        const rect = document.getElementById('game-canvas').getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 1. Sjekk om vi klikker på et eksisterende tårn (Upgrade)
        for (let t of state.towers) {
            if (Math.hypot(x - t.x, y - t.y) < 20) {
                // Oppgave: Level * 1
                game.startMathTask('UPGRADE_TOWER', t, t.level, `UPGRADING ${TOWERS[t.type].name} TO LVL ${t.level + 1}`);
                return;
            }
        }

        // 2. Bygg nytt tårn
        if (state.selectedBlueprint) {
            game.buildTower(x, y, state.selectedBlueprint);
        }
    },

    buildTower: (x, y, type) => {
        const data = TOWERS[type];
        // Kollisjonssjekk
        for (let t of state.towers) {
            if (Math.hypot(x - t.x, y - t.y) < 40) return;
        }
        
        if (state.money >= data.cost) {
            state.money -= data.cost;
            state.towers.push({
                x, y, type, 
                level: 1,
                cooldown: 0,
                angle: 0, // For rotasjon
                range: data.range, 
                damage: data.damage, 
                maxCooldown: data.rate
            });
            game.updateUI();
        } else {
            alert("INSUFFICIENT FUNDS");
        }
    },

    // --- GAME LOOP ---
    loop: () => {
        if (!state.isPaused) {
            game.update();
        }
        game.draw();
        requestAnimationFrame(game.loop);
    },

    update: () => {
        // Enemies
        for (let i = state.enemies.length - 1; i >= 0; i--) {
            let e = state.enemies[i];
            let targetP = state.mapPath[e.pathIdx + 1];
            if (!targetP) {
                state.lives--;
                state.enemies.splice(i, 1);
                game.updateUI();
                if (state.lives <= 0) {
                    alert("GAME OVER");
                    location.reload();
                }
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

        // Towers
        for (let t of state.towers) {
            if (t.cooldown > 0) t.cooldown--;
            
            // Find target
            let target = null;
            let minDist = t.range;
            for (let e of state.enemies) {
                let d = Math.hypot(e.x - t.x, e.y - t.y);
                if (d < minDist) { minDist = d; target = e; }
            }
            
            if (target) {
                // Roter tårn mot fiende
                t.angle = Math.atan2(target.y - t.y, target.x - t.x);
                
                if (t.cooldown <= 0) {
                    t.cooldown = t.maxCooldown;
                    playSound('shoot');
                    state.projectiles.push({
                        x: t.x, y: t.y, 
                        target: target, 
                        type: t.type, 
                        color: TOWERS[t.type].color 
                    });
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
            
            if (dist < 10) {
                p.target.hp -= TOWERS[p.type].damage; // Bruk base damage (burde skaleres med tårn level)
                if (p.target.hp <= 0) {
                    const idx = state.enemies.indexOf(p.target);
                    if (idx > -1) {
                        state.enemies.splice(idx, 1);
                        state.money += 5;
                        game.updateUI();
                    }
                }
                state.projectiles.splice(i, 1);
            } else {
                let angle = Math.atan2(dy, dx);
                p.x += Math.cos(angle) * 15;
                p.y += Math.sin(angle) * 15;
            }
        }
    },

    draw: () => {
        const ctx = document.getElementById('game-canvas').getContext('2d');
        ctx.fillStyle = "#0a0a15"; ctx.fillRect(0, 0, 1000, 600);
        
        // Draw Path
        ctx.strokeStyle = "#222"; ctx.lineWidth = 40; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(state.mapPath[0].x, state.mapPath[0].y);
        for(let p of state.mapPath) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        
        // Draw Towers
        for (let t of state.towers) {
            ctx.save();
            ctx.translate(t.x, t.y);
            
            // Base
            ctx.fillStyle = "#333";
            ctx.fillRect(-15, -15, 30, 30);
            
            // Level Indicator
            ctx.fillStyle = "#fff";
            ctx.font = "10px Arial";
            ctx.fillText(t.level, -4, 4);
            
            // Rotated Turret
            ctx.rotate(t.angle);
            ctx.fillStyle = TOWERS[t.type].color;
            ctx.fillRect(0, -5, 20, 10); // Barrel
            
            ctx.restore();
            
            // Draw Range if mouse over (enkelt implementert)
            // ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(t.x, t.y, t.range, 0, Math.PI*2); ctx.stroke();
        }
        
        // Draw Enemies
        for (let e of state.enemies) {
            ctx.fillStyle = "#ff0055";
            ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, Math.PI*2); ctx.fill();
            // HP Bar
            ctx.fillStyle = "red"; ctx.fillRect(e.x - 10, e.y - 20, 20, 4);
            ctx.fillStyle = "#0aff00"; ctx.fillRect(e.x - 10, e.y - 20, 20 * (e.hp / e.maxHp), 4);
        }
        
        // Draw Projectiles
        for (let p of state.projectiles) {
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
        }
    },

    updateUI: () => {
        document.getElementById('ui-bits').innerText = Math.floor(state.money);
        document.getElementById('ui-lives').innerText = state.lives;
        document.getElementById('ui-wave').innerText = state.wave;
        document.getElementById('miner-lvl').innerText = state.minerLvl;
        document.getElementById('miner-rate').innerText = CONFIG.MINER_BASE_RATE * state.minerLvl;
    }
};

// --- EVENTS ---
document.getElementById('game-canvas').addEventListener('mousedown', game.handleCanvasClick);
document.getElementById('math-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') game.checkAnswer(); });

window.onload = game.init;
/* Version: #09 */
