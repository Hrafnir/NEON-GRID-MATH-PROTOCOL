* Version: #06 */
/**
 * NEON DEFENSE: MATH CORE - SCRIPT
 * Versjon 6: Fast budsjett og Chaos-bonus.
 */

console.log("--- SYSTEM STARTUP: NEON DEFENSE V6 (STRATEGIC) ---");

// --- 1. KONFIGURASJON ---
const CONFIG = {
    levels: {
        1: [2, 5, 10],
        2: [3, 4, 6],
        3: [7, 8, 9],
        4: [2, 3, 4, 5, 6, 7, 8, 9, 11, 12] // Chaos
    },
    unlockThresholds: {
        'blaster': 0,
        'trap': 150,
        'sniper': 500,
        'cryo': 1000,
        'cannon': 2000,
        'tesla': 4000
    },
    // Økonomi-innstillinger
    STARTING_MONEY: 250,      // Fast sum man starter med
    CHAOS_BONUS: 250,         // Bonus hvis man spilte Level 4 sist
    KILL_REWARD: 8            // Penger per fiende drept
};

const TOWERS = {
    blaster: { name: "Blaster", cost: 50, range: 100, damage: 8,  rate: 30, color: "#00f3ff", type: "single" },
    trap:    { name: "Mine",    cost: 30, range: 30,  damage: 200, rate: 100,color: "#ffee00", type: "trap" },
    sniper:  { name: "Railgun", cost: 150, range: 300, damage: 150, rate: 90, color: "#ff0055", type: "single" },
    cryo:    { name: "Cryo",    cost: 120, range: 90,  damage: 5,   rate: 10, color: "#0099ff", type: "slow" },
    cannon:  { name: "Pulse",   cost: 250, range: 120, damage: 60,  rate: 60, color: "#0aff00", type: "splash" },
    tesla:   { name: "Tesla",   cost: 500, range: 160, damage: 25,  rate: 5,  color: "#ffffff", type: "chain" }
};

// --- 2. GLOBAL STATE ---
const state = {
    // Lagret progresjon (XP)
    totalScore: parseInt(localStorage.getItem('nd_score')) || 0,
    unlocked: JSON.parse(localStorage.getItem('nd_unlocked')) || ['blaster'],
    
    // Midlertidig spill-tilstand
    lastMathLevel: 0, // Husker hvilket nivå som ble spilt sist
    
    // Matte-variabler
    mathTimer: 0,
    mathScore: 0,
    currentAnswer: 0,
    mathLevel: 1,
    mathCombo: 1,
    mathLoop: null,
    
    // TD-variabler
    tdLoop: null,
    lives: 20,
    wave: 1,
    money: 0, // Nåværende penger i runden
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    mapPath: [], 
    selectedTower: null,
    nextWaveReady: true
};

console.log("State loaded:", state);

// --- 3. AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    
    if (type === 'shoot') {
        osc.type = 'square'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.1); gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'hit') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.05); osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'correct') {
        let freq = 440 + (state.mathCombo * 50); if (freq > 1200) freq = 1200; osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(100, now + 0.3); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.3); osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'buy') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1); gain.gain.setValueAtTime(0.1, now); osc.start(now); osc.stop(now + 0.1);
    }
}

// --- 4. GAME MANAGER ---
const game = {
    init: () => {
        game.updateUI();
        game.checkUnlocks();
        state.mapPath = [{x:0, y:80}, {x:700, y:80}, {x:700, y:200}, {x:100, y:200}, {x:100, y:320}, {x:700, y:320}, {x:700, y:400}, {x:50, y:400}];
    },

    save: () => {
        localStorage.setItem('nd_score', state.totalScore);
        localStorage.setItem('nd_unlocked', JSON.stringify(state.unlocked));
    },

    checkUnlocks: () => {
        const list = document.getElementById('unlock-status');
        list.innerHTML = "<h4>RESEARCH STATUS (Total Score):</h4>";
        for (let [key, val] of Object.entries(CONFIG.unlockThresholds)) {
            const isUnlocked = state.totalScore >= val;
            if (isUnlocked && !state.unlocked.includes(key)) {
                state.unlocked.push(key);
                alert(`NY BLUEPRINT LÅST OPP: ${TOWERS[key].name}!`);
            }
            const cssClass = isUnlocked ? "status-unlocked" : "status-locked";
            const icon = isUnlocked ? "[OPEN]" : "[LOCKED]";
            const name = TOWERS[key].name.toUpperCase();
            list.innerHTML += `<div class="status-item ${cssClass}">${icon} ${name} (Req: ${val} pts)</div>`;
        }
        game.save();
    },

    // Oppdaterer header basert på modus
    updateUI: () => {
        const display = document.getElementById('global-bits');
        // Hvis vi er i TD-modus, vis penger. Ellers vis Total Score (XP).
        if (document.getElementById('screen-td').classList.contains('active')) {
            display.innerText = state.money;
            display.style.color = "#ffee00"; // Gul for penger
            display.parentElement.lastChild.textContent = " FUNDS";
        } else {
            display.innerText = state.totalScore;
            display.style.color = "#00f3ff"; // Blå for XP
            display.parentElement.lastChild.textContent = " RESEARCH PTS";
        }
    },

    // --- MATH MODE ---
    startMath: (lvl) => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('screen-math').classList.add('active');
        
        state.mathScore = 0;
        state.mathTimer = 60; 
        state.mathLevel = lvl;
        state.mathCombo = 1; 
        state.lastMathLevel = lvl; // Lagre nivået for bonus-sjekk senere

        document.getElementById('math-score').innerText = "0";
        document.getElementById('math-timer').innerText = "60";
        document.getElementById('math-combo').innerText = "1";
        document.getElementById('math-feedback').innerText = "";
        
        game.nextMathQuestion();
        
        if (game.mathLoop) clearInterval(game.mathLoop);
        game.mathLoop = setInterval(() => {
            state.mathTimer--;
            document.getElementById('math-timer').innerText = state.mathTimer;
            if(state.mathTimer <= 0) game.endMath();
        }, 1000);
        
        setTimeout(() => document.getElementById('math-input').focus(), 100);
    },

    nextMathQuestion: () => {
        const tables = CONFIG.levels[state.mathLevel];
        const a = tables[Math.floor(Math.random() * tables.length)];
        const b = Math.floor(Math.random() * 11) + 2; 
        state.currentAnswer = a * b;
        document.getElementById('math-question').innerText = `${a} x ${b}`;
        document.getElementById('math-input').value = "";
    },

    checkMathAnswer: () => {
        const input = document.getElementById('math-input');
        const val = parseInt(input.value);
        const feedback = document.getElementById('math-feedback');
        
        if (isNaN(val)) return;

        if (val === state.currentAnswer) {
            playSound('correct');
            const points = 10 * state.mathCombo;
            state.mathScore += points;
            state.totalScore += points; // XP øker
            state.mathCombo++;
            
            document.getElementById('math-score').innerText = state.mathScore;
            document.getElementById('math-combo').innerText = state.mathCombo;
            
            feedback.innerText = `KORREKT! +${points} XP`;
            feedback.style.color = "#0aff00";
            game.nextMathQuestion();
        } else {
            playSound('wrong');
            state.mathCombo = 1;
            document.getElementById('math-combo').innerText = state.mathCombo;
            feedback.innerText = "FEIL! Combo mistet.";
            feedback.style.color = "#ff0055";
            input.value = "";
            input.focus();
        }
    },

    endMath: () => {
        clearInterval(game.mathLoop);
        // Merk: Vi legger IKKE til penger her, kun XP (som allerede er lagt til fortløpende)
        game.save();
        game.checkUnlocks();
        alert(`TIDEN ER UTE!\nDu tjente ${state.mathScore} RESEARCH POINTS.\nTotalt: ${state.totalScore}`);
        game.returnToMenu();
    },
    
    abortMath: () => {
        clearInterval(game.mathLoop);
        game.returnToMenu();
    },

    // --- TOWER DEFENSE ---
    startTD: () => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('screen-td').classList.add('active');
        
        // --- ØKONOMI LOGIKK ---
        state.money = CONFIG.STARTING_MONEY;
        let bonusMsg = "";
        
        // Sjekk om Chaos-bonus gjelder
        if (state.lastMathLevel === 4) {
            state.money += CONFIG.CHAOS_BONUS;
            bonusMsg = `\n(INKLUDERT CHAOS BONUS: +${CONFIG.CHAOS_BONUS})`;
        }
        
        alert(`MISSION START\nSTARTBUDSJETT: ${state.money} BITS${bonusMsg}`);
        
        state.lives = 20;
        state.wave = 0;
        state.towers = [];
        state.enemies = [];
        state.projectiles = [];
        state.particles = [];
        state.nextWaveReady = true;
        state.selectedTower = null;
        
        document.getElementById('td-hp').innerText = "100";
        document.getElementById('td-wave').innerText = "0";
        
        game.updateUI(); // Oppdater header til å vise Funds
        game.renderTowerSelector();
        
        if (game.tdLoop) cancelAnimationFrame(game.tdLoop);
        game.tdLoop = requestAnimationFrame(game.loopTD);
        
        const canvas = document.getElementById('td-canvas');
        canvas.onclick = (e) => {
            if (!state.selectedTower) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            game.placeTower(x, y);
        };
    },

    renderTowerSelector: () => {
        const selector = document.getElementById('tower-selector');
        selector.innerHTML = "";
        for (let key of Object.keys(TOWERS)) {
            const t = TOWERS[key];
            const isUnlocked = state.unlocked.includes(key);
            const btn = document.createElement('div');
            btn.className = `tower-btn ${isUnlocked ? 'unlocked' : 'locked'}`;
            btn.innerHTML = `<span>${t.name}</span><span>${t.cost}</span>`;
            if (isUnlocked) {
                btn.onclick = () => {
                    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    state.selectedTower = key;
                };
            }
            selector.appendChild(btn);
        }
    },

    placeTower: (x, y) => {
        const type = state.selectedTower;
        const data = TOWERS[type];
        
        // Kollisjonssjekk (40px)
        for (let t of state.towers) {
            if (Math.hypot(x - t.x, y - t.y) < 40) {
                alert("For trangt! Velg en annen posisjon.");
                return;
            }
        }
        
        if (state.money >= data.cost) {
            state.money -= data.cost;
            game.updateUI(); 
            state.towers.push({
                x: x, y: y, type: type, cooldown: 0,
                range: data.range, damage: data.damage, maxCooldown: data.rate, hp: 1 
            });
            playSound('buy');
            createParticles(x, y, data.color, 10);
        } else {
            alert("Ikke nok Bits!");
        }
    },

    nextWave: () => {
        if (!state.nextWaveReady) return;
        state.wave++;
        state.nextWaveReady = false;
        document.getElementById('td-wave').innerText = state.wave;
        document.getElementById('wave-info').style.opacity = 0;
        
        // Hardcore scaling
        let count = 8 + (state.wave * 4); 
        let hp = 100 + (state.wave * 80); 
        let speed = 2.0 + (state.wave * 0.25);
        
        console.log(`Wave ${state.wave}: Count=${count}, HP=${hp}, Speed=${speed}`);
        
        let spawned = 0;
        let spawnInterval = setInterval(() => {
            state.enemies.push({
                x: state.mapPath[0].x, y: state.mapPath[0].y, pathIdx: 0,
                hp: hp, maxHp: hp, speed: speed, frozen: 0
            });
            spawned++;
            if (spawned >= count) {
                clearInterval(spawnInterval);
                state.nextWaveReady = true;
                document.getElementById('wave-info').style.opacity = 1;
                document.getElementById('wave-info').innerText = "Neste bølge (Klikk 'N')";
            }
        }, 700);
    },

    loopTD: () => {
        const ctx = document.getElementById('td-canvas').getContext('2d');
        ctx.fillStyle = "#0a0a15"; ctx.fillRect(0, 0, 800, 450);
        
        // Path
        ctx.beginPath(); ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = 40; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.moveTo(state.mapPath[0].x, state.mapPath[0].y);
        for(let p of state.mapPath) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        
        // Towers
        for (let i = state.towers.length - 1; i >= 0; i--) {
            let t = state.towers[i];
            ctx.fillStyle = TOWERS[t.type].color;
            ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, Math.PI*2); ctx.fill();
            
            if (t.cooldown > 0) t.cooldown--;
            
            if (t.type === 'trap') {
                for (let e of state.enemies) {
                     if (Math.hypot(e.x - t.x, e.y - t.y) < t.range) {
                         game.damageEnemy(e, t.damage);
                         createParticles(t.x, t.y, "#ffaa00", 20);
                         playSound('hit');
                         state.towers.splice(i, 1); break; 
                     }
                }
            } else if (t.cooldown <= 0) {
                let target = null, minDist = t.range;
                for (let e of state.enemies) {
                    let d = Math.hypot(e.x - t.x, e.y - t.y);
                    if (d < minDist) { minDist = d; target = e; }
                }
                if (target) {
                    t.cooldown = t.maxCooldown; playSound('shoot');
                    if (t.type === 'tesla') {
                        game.damageEnemy(target, t.damage);
                        createLightning(ctx, t.x, t.y, target.x, target.y);
                    } else {
                        state.projectiles.push({x: t.x, y: t.y, target: target, type: t.type, color: TOWERS[t.type].color, speed: 12});
                    }
                }
            }
        }
        
        // Projectiles
        for (let i = state.projectiles.length - 1; i >= 0; i--) {
            let p = state.projectiles[i];
            let dist = Math.hypot(p.target.x - p.x, p.target.y - p.y);
            if (dist < p.speed || p.target.hp <= 0) {
                if (p.type === 'splash') {
                    state.enemies.forEach(e => { if (Math.hypot(e.x - p.x, e.y - p.y) < 80) game.damageEnemy(e, 30); });
                    createParticles(p.x, p.y, p.color, 15);
                } else if (p.type === 'slow') {
                    p.target.frozen = 90; game.damageEnemy(p.target, 5);
                } else {
                    game.damageEnemy(p.target, 25);
                }
                state.projectiles.splice(i, 1);
            } else {
                let angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
                p.x += Math.cos(angle) * p.speed; p.y += Math.sin(angle) * p.speed;
                ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
            }
        }

        // Enemies
        for (let i = state.enemies.length - 1; i >= 0; i--) {
            let e = state.enemies[i];
            let targetP = state.mapPath[e.pathIdx + 1];
            if (!targetP) {
                state.lives--;
                document.getElementById('td-hp').innerText = Math.max(0, state.lives * 5); 
                state.enemies.splice(i, 1); playSound('wrong');
                if (state.lives <= 0) game.gameOverTD();
                continue;
            }
            let dist = Math.hypot(targetP.x - e.x, targetP.y - e.y);
            let spd = e.frozen > 0 ? e.speed * 0.4 : e.speed;
            if (e.frozen > 0) e.frozen--;
            
            if (dist < spd) { e.x = targetP.x; e.y = targetP.y; e.pathIdx++; }
            else {
                let angle = Math.atan2(targetP.y - e.y, targetP.x - e.x);
                e.x += Math.cos(angle) * spd; e.y += Math.sin(angle) * spd;
            }
            
            ctx.fillStyle = e.frozen > 0 ? "#0099ff" : "#ff0055";
            ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "red"; ctx.fillRect(e.x - 10, e.y - 18, 20, 4);
            ctx.fillStyle = "#0aff00"; ctx.fillRect(e.x - 10, e.y - 18, 20 * (e.hp / e.maxHp), 4);
        }
        
        updateParticles(ctx);
        if (state.lives > 0) requestAnimationFrame(game.loopTD);
    },
    
    damageEnemy: (e, amount) => {
        e.hp -= amount;
        if (e.hp <= 0) {
            const idx = state.enemies.indexOf(e);
            if (idx > -1) {
                state.enemies.splice(idx, 1);
                state.money += CONFIG.KILL_REWARD; // Penger per kill
                game.updateUI();
                createParticles(e.x, e.y, "#ff0055", 8);
                playSound('hit');
            }
        }
    },

    gameOverTD: () => {
        alert("SYSTEM FAILURE! Kjernen er ødelagt.");
        game.returnToMenu();
    },
    
    returnToMenu: () => {
        cancelAnimationFrame(game.tdLoop);
        game.save();
        game.updateUI(); // Reset til å vise Research score
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('screen-menu').classList.add('active');
    }
};

function createParticles(x, y, color, count=5) {
    for(let i=0; i<count; i++) state.particles.push({x, y, vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5, life: 30, color});
}
function updateParticles(ctx) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 30; ctx.fillRect(p.x, p.y, 3, 3); ctx.globalAlpha = 1.0;
        if (p.life <= 0) state.particles.splice(i, 1);
    }
}
function createLightning(ctx, x1, y1, x2, y2) {
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo((x1+x2)/2+(Math.random()-0.5)*20, (y1+y2)/2+(Math.random()-0.5)*20); ctx.lineTo(x2, y2); ctx.stroke();
}

document.getElementById('math-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') game.checkMathAnswer(); });
document.addEventListener('keydown', (e) => { if (e.key === 'n' && document.getElementById('screen-td').classList.contains('active')) game.nextWave(); });
window.onload = game.init;
/* Version: #06 */
