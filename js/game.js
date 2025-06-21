// --- Game Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const bossHealthDisplay = document.getElementById('bossHealthDisplay');
const controlsInfo = document.getElementById('controlsInfo');
const dPadContainer = document.getElementById('dPadContainer');
const backgroundMusic = document.getElementById('backgroundMusic');

let canvasWidth, canvasHeight;

// Audio context for sound effects
let audioCtx;

// Asset Management
const assets = {};
let assetsLoaded = 0;
const assetUrls = {
    playerShip: 'https://badlan.uken.ai/shmup/shmup-ship2.png',
    bossSkye: 'https://badlan.uken.ai/shmup/boss-skye-spritesheet.png' // Corrected URL
};
const totalAssets = Object.keys(assetUrls).length;
let showHitbox = false;

// Game state variables
let score = 0;
let lives = 3;
let gameInterval;
let keys = {};
let player;
let bullets = [];
let enemies = [];
let enemyBullets = [];
let boss = null;
let gameLevel = 0;
let enemySpawnTimer = 0;
let levelWaveCount = 0;
const MAX_WAVES_PER_LEVEL = 3;
const ENEMIES_PER_WAVE = 5;

let gameState = 'LOADING';

// --- Asset Styling ---
const BULLET_COLOR = '#ffff00';
const ENEMY_COLOR = '#ff00ff';
const ENEMY_BULLET_COLOR = '#ff6666';

// --- Sound Effects ---
function playPewSound() {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.1);
    oscillator.connect(gainNode).connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function playWooshSound() {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 10;
    filter.frequency.setValueAtTime(400, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4000, audioCtx.currentTime + 0.3);
    filter.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.5);
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    noiseSource.connect(filter).connect(gainNode).connect(audioCtx.destination);
    noiseSource.start();
}

function playClinkSound() {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    const baseFrequency = 1200;
    oscillator.frequency.value = baseFrequency + Math.random() * 400 - 200;
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    oscillator.connect(gainNode).connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}

function playPlayerExplosionSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const noise_duration = 0.3;
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * noise_duration, audioCtx.sampleRate);
    const noiseOutput = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseOutput.length; i++) {
        noiseOutput[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1500;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noise_duration);
    noise.connect(noiseFilter).connect(noiseGain).connect(audioCtx.destination);
    const ugh = audioCtx.createOscillator();
    ugh.type = 'sawtooth';
    const ughGain = audioCtx.createGain();
    ugh.frequency.setValueAtTime(150, now);
    ugh.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    ughGain.gain.setValueAtTime(0.4, now);
    ughGain.gain.linearRampToValueAtTime(0, now + 0.2);
    ugh.connect(ughGain).connect(audioCtx.destination);
    noise.start(now);
    ugh.start(now);
    noise.stop(now + noise_duration);
    ugh.stop(now + 0.2);
}

function playBossExplosionSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const duration = 3;
    const boom = audioCtx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(100, now);
    boom.frequency.exponentialRampToValueAtTime(30, now + 0.5);
    const boomGain = audioCtx.createGain();
    boomGain.gain.setValueAtTime(0.8, now);
    boomGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 8;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.2;
    lfo.connect(lfoGain).connect(boomGain.gain);
    boom.connect(boomGain).connect(audioCtx.destination);
    boom.start(now);
    lfo.start(now);
    boom.stop(now + duration);
    lfo.stop(now + duration);
}

// --- Asset Loader ---
function loadAssets(callback) {
    for (const key in assetUrls) {
        assets[key] = new Image();
        assets[key].src = assetUrls[key];
        assets[key].onload = () => {
            assetsLoaded++;
            if (assetsLoaded === totalAssets) {
                callback();
            }
        };
        assets[key].onerror = () => {
            console.error(`Failed to load asset: ${assetUrls[key]}`);
            assetsLoaded++;
            assets[key] = null;
            if (assetsLoaded === totalAssets) {
                callback();
            }
        };
    }
}

// --- Responsive Canvas ---
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const containerWidth = container.clientWidth - 20;
    const containerHeight = window.innerHeight * 0.75;
    const aspectRatio = 3 / 4;
    if (containerWidth / containerHeight > aspectRatio) {
        canvasHeight = Math.min(containerHeight, 600);
        canvasWidth = canvasHeight * aspectRatio;
    } else {
        canvasWidth = Math.min(containerWidth, 450);
        canvasHeight = canvasWidth / aspectRatio;
    }
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    if (player) {
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height - player.height - 20;
    }
}
window.addEventListener('resize', resizeCanvas);

// --- Player Object ---
function Player(x, y, width, height, speed) {
    this.x = x; this.y = y; this.width = width; this.height = height; this.speed = speed;
    this.shootCooldown = 0; this.maxShootCooldown = 10;
    this.isInvincible = false; this.invincibilityTimer = 0; this.maxInvincibilityDuration = 120;
    this.isRespawning = false; this.respawnPauseTimer = 0; this.respawnPauseDuration = 30;
    this.hitbox = { width: 10, height: 10, x_offset: (this.width - 10) / 2, y_offset: (this.height - 10) / 2 };

    this.draw = function() {
        if (this.isRespawning) return;
        const drawShip = () => {
            if (assets.playerShip) {
                ctx.drawImage(assets.playerShip, this.x, this.y, this.width, this.height);
            } else { 
                ctx.fillStyle = '#00ff00';
                ctx.beginPath();
                ctx.moveTo(this.x + this.width / 2, this.y);
                ctx.lineTo(this.x, this.y + this.height);
                ctx.lineTo(this.x + this.width, this.y + this.height);
                ctx.closePath();
                ctx.fill();
            }
        };
        if (this.isInvincible && (this.invincibilityTimer % 12 < 6)) {} else { drawShip(); }
        if (showHitbox) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x + this.hitbox.x_offset, this.y + this.hitbox.y_offset, this.hitbox.width, this.hitbox.height);
        }
    }

    this.update = function() {
        if (this.isRespawning) {
            this.respawnPauseTimer--;
            if (this.respawnPauseTimer <= 0) this.finishRespawn();
            return;
        }
        if (this.isInvincible) {
            this.invincibilityTimer--;
            if (this.invincibilityTimer <= 0) this.isInvincible = false;
        }
        if (keys['ArrowUp'] && this.y > 0) this.y -= this.speed;
        if (keys['ArrowDown'] && this.y < canvas.height - this.height) this.y += this.speed;
        if (keys['ArrowLeft'] && this.x > 0) this.x -= this.speed;
        if (keys['ArrowRight'] && this.x < canvas.width - this.width) this.x += this.speed;
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (keys['Space'] && this.shootCooldown === 0) {
            bullets.push(new Bullet(this.x + this.width / 2 - 2.5, this.y, 5, 10, 7, BULLET_COLOR));
            this.shootCooldown = this.maxShootCooldown;
            playPewSound();
        }
        this.draw();
    }
    
    this.startRespawnSequence = function() {
        this.isRespawning = true;
        this.respawnPauseTimer = this.respawnPauseDuration;
    }

    this.finishRespawn = function() {
        this.isRespawning = false;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 20;
        this.isInvincible = true;
        this.invincibilityTimer = this.maxInvincibilityDuration;
        this.shootCooldown = this.maxShootCooldown;
    }
}

// --- Bullet Object ---
function Bullet(x, y, width, height, speed, color, dy = -1, dx = 0) {
    this.x = x; this.y = y; this.width = width; this.height = height;
    this.speed = speed; this.color = color; this.dy = dy; this.dx = dx;
    this.draw = function() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
    this.update = function() {
        this.y += this.speed * this.dy;
        this.x += this.speed * this.dx;
        this.draw();
    }
}

// --- Enemy Object ---
function Enemy(x, y, width, height, speed, health = 1, type = 'basic') {
    this.x = x; this.y = y; this.width = width; this.height = height;
    this.speed = speed; this.health = health; this.type = type;
    this.shootCooldown = Math.random() * 100 + 50;
    this.draw = function() {
        ctx.fillStyle = ENEMY_COLOR;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
    this.update = function() {
        this.y += this.speed;
        this.shootCooldown--;
        if (this.shootCooldown <= 0 && this.y < canvas.height * 0.75) {
            enemyBullets.push(new Bullet(this.x + this.width / 2 - 2.5, this.y + this.height, 5, 10, 4, ENEMY_BULLET_COLOR, 1));
            this.shootCooldown = 100 + Math.random() * 50;
        }
        this.draw();
    }
}

// --- Boss Object ---
function Boss(x, y, width, height, speed, health) {
    this.x = x; this.y = y; this.initialY = y; this.width = width; this.height = height;
    this.speed = speed; this.initialHealth = health; this.health = health;
    this.phase = 1; this.attackCooldown = 0; this.maxAttackCooldown = 120;
    this.moveDirection = 1; this.movementPattern = 'patrol'; this.isEntering = true;

    // Animation properties
    this.image = assets.bossSkye;
    this.spriteWidth = 100;
    this.spriteHeight = 80;
    this.currentFrame = 0; // 0: Idle, 1: Shooting, 2: Damaged
    this.animationTimer = 0; // Countdown for temporary frames like 'damaged' or 'shooting'

    this.draw = function() {
        if (this.image) {
            ctx.drawImage(this.image, 
                this.currentFrame * this.spriteWidth, 0, // Source X, Y on spritesheet
                this.spriteWidth, this.spriteHeight,     // Source width, height
                this.x, this.y,                           // Destination X, Y on canvas
                this.width, this.height);                 // Destination width, height
        } else { // Fallback if image fails
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
        
        // Health Bar
        const healthBarWidth = canvas.width * 0.8;
        const healthBarHeight = 15;
        const healthBarX = canvas.width * 0.1;
        const healthBarY = 10;
        ctx.fillStyle = '#555';
        ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
        const currentHealthWidth = (this.health / this.initialHealth) * healthBarWidth;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);

        bossHealthDisplay.textContent = `Boss HP: ${Math.max(0, Math.round((this.health / this.initialHealth) * 100))}%`;
    }

    this.update = function() {
        if (this.isEntering) {
            this.y += 1;
            if (this.y >= this.initialY) this.isEntering = false;
            this.draw();
            return;
        }
        
        // Animation timer logic
        if(this.animationTimer > 0) {
            this.animationTimer--;
            if(this.animationTimer === 0) {
                this.currentFrame = 0; // Revert to idle
            }
        }

        if (this.movementPattern === 'patrol') {
            this.x += this.speed * this.moveDirection;
            if (this.x <= 0 || this.x + this.width >= canvas.width) this.moveDirection *= -1;
        }
        this.attackCooldown--;
        if (this.attackCooldown <= 0) {
            this.performAttack();
            this.attackCooldown = this.maxAttackCooldown;
            if (this.health < this.initialHealth * 0.66 && this.phase === 1) {
                this.phase = 2; this.maxAttackCooldown = 90; this.speed *= 1.2;
                showTemporaryMessage("Boss is ENRAGED!", 1000);
            } else if (this.health < this.initialHealth * 0.33 && this.phase === 2) {
                this.phase = 3; this.maxAttackCooldown = 60; this.speed *= 1.2;
                showTemporaryMessage("Boss is DESPERATE!", 1000);
            }
        }
        this.draw();
    }

    this.performAttack = function() {
        this.currentFrame = 1; // Set to shooting frame
        this.animationTimer = 30; // Show shooting face for 0.5 seconds
        playWooshSound();
        if (this.phase === 1) {
            for (let i = 0; i < 3; i++) {
                    enemyBullets.push(new Bullet(this.x + (this.width/4)*(i+1) - 5, this.y + this.height, 10, 15, 4, ENEMY_BULLET_COLOR, 1));
            }
        } else if (this.phase === 2) {
            for (let i = 0; i < 5; i++) {
                const angle = (i - 2) * 0.1;
                enemyBullets.push(new Bullet(this.x + this.width / 2 - 5, this.y + this.height, 8, 12, 5, ENEMY_BULLET_COLOR, 1, angle));
            }
        } else if (this.phase === 3) {
            for (let i = 0; i < 7; i++) {
                const angle = (i - 3) * 0.12; 
                enemyBullets.push(new Bullet(this.x + this.width / 2 - 5, this.y + this.height, 8, 12, 6, ENEMY_BULLET_COLOR, 1, angle));
            }
            if (player) {
                const dxToPlayer = (player.x + player.width / 2) - (this.x + this.width / 2);
                const dyToPlayer = (player.y + player.height / 2) - (this.y + this.height);
                const distance = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer);
                const aimedDx = (dxToPlayer / distance) * 0.5;
                const aimedDy = (dyToPlayer / distance) * 0.9;
                enemyBullets.push(new Bullet(this.x + this.width / 2 - 5, this.y + this.height, 10, 15, 7, '#ffa500', aimedDy, aimedDx));
            }
        }
    }
    
    this.takeDamage = function(amount) {
        this.health -= amount;
        this.currentFrame = 2; // Set to damaged frame
        this.animationTimer = 10; // Show damaged face for a short time
        if (this.health <= 0) {
            this.health = 0;
            playBossExplosionSound();
            score += 500;
            gameState = 'GAME_WON';
            setTimeout(() => {
                showTemporaryMessage("YOU DEFEATED SKYE!", 2000, startGame);
            }, 1500);
        }
    }
}

// --- Game Logic ---
function updateGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameState === 'PLAYING' || gameState === 'BOSS_FIGHT') {
        player.update();
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].update();
            if (bullets[i].y < 0) bullets.splice(i, 1);
        }
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            enemyBullets[i].update();
            if (checkCollision(player, enemyBullets[i])) {
                playerHit();
                enemyBullets.splice(i, 1);
                continue;
            }
            if (enemyBullets[i].y > canvas.height) enemyBullets.splice(i, 1);
        }
        if (gameState === 'PLAYING') {
            enemySpawnTimer--;
            if (enemySpawnTimer <= 0 && levelWaveCount < MAX_WAVES_PER_LEVEL) {
                spawnEnemyWave(ENEMIES_PER_WAVE);
                levelWaveCount++;
                enemySpawnTimer = 200;
            }
            for (let i = enemies.length - 1; i >= 0; i--) {
                enemies[i].update();
                for (let j = bullets.length - 1; j >= 0; j--) {
                    if (checkCollision(enemies[i], bullets[j])) {
                        playClinkSound();
                        enemies[i].health--;
                        bullets.splice(j, 1);
                        if (enemies[i].health <= 0) {
                            score += 10;
                            enemies.splice(i, 1);
                            break; 
                        }
                    }
                }
                if (enemies[i] && checkCollision(player, enemies[i])) {
                        playerHit();
                        enemies.splice(i,1);
                        continue;
                }
                if (enemies[i] && enemies[i].y > canvas.height) enemies.splice(i, 1);
            }
            if (levelWaveCount >= MAX_WAVES_PER_LEVEL && enemies.length === 0) {
                gameState = 'LEVEL_TRANSITION';
                showTemporaryMessage("BOSS INCOMING!", 2000, startBossFight);
            }
        } else if (gameState === 'BOSS_FIGHT' && boss) {
            boss.update();
            for (let i = bullets.length - 1; i >= 0; i--) {
                if (checkCollision(boss, bullets[i])) {
                    boss.takeDamage(1);
                    bullets.splice(i, 1);
                    score += 5;
                }
            }
            if (checkCollision(player, boss)) {
                playerHit();
            }
        }
    } else if (gameState === 'LOADING') {
        drawLoadingScreen();
    } else if (gameState === 'START_SCREEN') {
        drawStartScreen();
    } else if (gameState === 'GAME_OVER') {
        drawGameOverScreen();
    } else if (gameState === 'GAME_WON') {
        drawGameWonScreen();
    }
    scoreDisplay.textContent = `Score: ${score}`;
    livesDisplay.textContent = `Lives: ${lives}`;
    bossHealthDisplay.style.display = (gameState === 'BOSS_FIGHT' && boss) ? 'block' : 'none';
}

function playerHit() {
    if (player.isInvincible || player.isRespawning) return; 
    playPlayerExplosionSound();
    lives--;
    showTemporaryMessage("HIT!", 500);
    if (lives <= 0) {
        gameState = 'GAME_OVER';
        backgroundMusic.pause();
        if (boss) bossHealthDisplay.style.display = 'none';
    } else {
        player.startRespawnSequence();
    }
}

function checkCollision(objA, objB) {
    if (!objA || !objB) return false;
    const rectA = objA.hitbox ? 
        { x: objA.x + objA.hitbox.x_offset, y: objA.y + objA.hitbox.y_offset, width: objA.hitbox.width, height: objA.hitbox.height } : 
        { x: objA.x, y: objA.y, width: objA.width, height: objA.height };
    const rectB = objB.hitbox ?
        { x: objB.x + objB.hitbox.x_offset, y: objB.y + objB.hitbox.y_offset, width: objB.hitbox.width, height: objB.hitbox.height } : 
        { x: objB.x, y: objB.y, width: objB.width, height: objB.height };
    return rectA.x < rectB.x + rectB.width &&
            rectA.x + rectA.width > rectB.x &&
            rectA.y < rectB.y + rectB.height &&
            rectA.y + rectA.height > rectB.y;
}

function spawnEnemyWave(count) {
    for (let i = 0; i < count; i++) {
        const enemyX = Math.random() * (canvas.width - 30);
        const enemyY = -30 - (Math.random() * 50);
        enemies.push(new Enemy(enemyX, enemyY, 30, 30, 1 + Math.random()));
    }
}

function startBossFight() {
    clearMessage();
    gameState = 'BOSS_FIGHT';
    boss = new Boss(canvas.width / 2 - 50, -100, 100, 80, 1, 150);
    boss.initialY = 50;
    enemies = [];
    enemyBullets = [];
}

function showTemporaryMessage(text, duration, callback) {
    clearMessage();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-overlay';
    messageDiv.id = 'tempMessage';
    messageDiv.textContent = text;
    document.body.appendChild(messageDiv);
    if (duration) {
        setTimeout(() => {
            clearMessage();
            if (callback) callback();
        }, duration);
    }
}

function showPersistentMessage(text, buttonText, buttonCallback) {
    clearMessage();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message-overlay';
    messageDiv.id = 'persistentMessage';
    const textNode = document.createElement('p');
    textNode.textContent = text;
    messageDiv.appendChild(textNode);
    if (buttonText && buttonCallback) {
        const button = document.createElement('button');
        button.textContent = buttonText;
        button.onclick = () => {
            if (!audioCtx) {
                try {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) { console.error("Web Audio API is not supported"); }
            }
            clearMessage();
            buttonCallback();
        };
        messageDiv.appendChild(button);
    }
    document.body.appendChild(messageDiv);
}

function clearMessage() {
    const tempMsg = document.getElementById('tempMessage');
    if (tempMsg) tempMsg.remove();
    const persistentMsg = document.getElementById('persistentMessage');
    if (persistentMsg) persistentMsg.remove();
}

function showTestMenu() {
    clearMessage();
    const testMenu = document.createElement('div');
    testMenu.className = 'message-overlay';
    testMenu.id = 'persistentMessage';
    testMenu.innerHTML = `<p style="font-size: 1.2em; margin-bottom: 10px;">Test Menu</p><input type="text" id="cheatCodeInput" placeholder="Enter code" style="color: black; padding: 5px; border-radius: 4px; border: 1px solid #fff; text-align: center; font-size: 20px;"><div style="margin-top: 15px;"><button id="submitCheatBtn">Go</button><button id="cancelCheatBtn" style="background-color: #ff6666;">Cancel</button></div>`;
    document.body.appendChild(testMenu);
    document.getElementById('cheatCodeInput').focus();
    document.getElementById('submitCheatBtn').onclick = () => handleCheatCode(document.getElementById('cheatCodeInput').value);
    document.getElementById('cancelCheatBtn').onclick = clearMessage;
}

function handleCheatCode(code) {
    clearMessage();
    switch(code) {
        case '12':
            if (gameState === 'START_SCREEN' || gameState === 'GAME_OVER') startGame();
            levelWaveCount = MAX_WAVES_PER_LEVEL;
            enemies = [];
            enemyBullets = [];
            startBossFight();
            break;
        default:
            showTemporaryMessage("Invalid Code", 1000);
            break;
    }
}

function drawLoadingScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.fillStyle = '#00ff00';
    ctx.font = `bold ${canvas.width / 15}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`Loading... ${assetsLoaded}/${totalAssets}`, canvas.width / 2, canvas.height / 2);
}

function drawStartScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.fillStyle = '#00ff00';
    ctx.font = `bold ${canvas.width / 12}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText("Friend SHMUP!", canvas.width / 2, canvas.height / 3);
    if (!document.getElementById('persistentMessage')) {
            showPersistentMessage("Are you ready to face your friends?", "Start Game", startGame);
    }
}

function drawGameOverScreen() {
    if (!document.getElementById('persistentMessage')) {
        backgroundMusic.pause();
        showPersistentMessage(`GAME OVER\nScore: ${score}`, "Restart", startGame);
    }
}

function drawGameWonScreen() {
        if (!document.getElementById('persistentMessage')) {
        backgroundMusic.pause();
        showPersistentMessage(`YOU WON!\nFinal Score: ${score}\n(More friends to battle coming soon!)`, "Play Again?", startGame);
    }
}

function initGame() {
    resizeCanvas();
    player = new Player(canvas.width / 2 - 15, canvas.height - 50, 30, 30, 5);
    score = 0; lives = 3; bullets = []; enemies = []; enemyBullets = [];
    boss = null; gameLevel = 0; levelWaveCount = 0; enemySpawnTimer = 100;
    
    bossHealthDisplay.style.display = 'none';
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        dPadContainer.style.display = 'flex';
        controlsInfo.textContent = "Use D-Pad to Move & Shoot (conceptual)";
        setupDPadListeners();
    } else {
        controlsInfo.textContent = "Use Arrow Keys to Move, Space to Shoot. (T for Test, H for Hitbox)";
    }
    
    loadAssets(() => {
        gameState = 'START_SCREEN';
        if (gameInterval) clearInterval(gameInterval);
        gameInterval = setInterval(updateGame, 1000 / 60);
    });
}

function startGame() {
    clearMessage();
    score = 0; lives = 3; bullets = []; enemies = []; enemyBullets = [];
    boss = null; gameLevel = 1; levelWaveCount = 0; enemySpawnTimer = 100;
    gameState = 'PLAYING';
    player.x = canvas.width / 2 - player.width / 2; 
    player.y = canvas.height - player.height - 20;
    player.shootCooldown = 0; player.isInvincible = false; player.invincibilityTimer = 0;
    player.isRespawning = false; player.respawnPauseTimer = 0;
    bossHealthDisplay.style.display = 'none';

    backgroundMusic.currentTime = 0;
    backgroundMusic.play().catch(e => console.error("Music play failed:", e));
}

// --- Event Listeners ---
window.addEventListener('keydown', (e) => {
    if (document.querySelector('#cheatCodeInput')) return;
    if (e.code === 'KeyT' && !document.querySelector('.message-overlay')) {
        showTestMenu();
        return;
    }
    if (e.code === 'KeyH') {
        showHitbox = !showHitbox;
        return;
    }
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function setupDPadListeners() {
    const dpadButtons = {
        'dpadUp': 'ArrowUp', 'dpadDown': 'ArrowDown',
        'dpadLeft': 'ArrowLeft', 'dpadRight': 'ArrowRight',
        'dpadAction': 'Space'
    };
    for (const [buttonId, keyCode] of Object.entries(dpadButtons)) {
        const buttonElement = document.getElementById(buttonId);
        if (buttonElement) {
            const pressAction = (e) => { e.preventDefault(); keys[keyCode] = true; buttonElement.style.backgroundColor = '#00ffff'; };
            const releaseAction = (e) => { e.preventDefault(); keys[keyCode] = false; buttonElement.style.backgroundColor = '#4a4e69'; };
            buttonElement.addEventListener('touchstart', pressAction);
            buttonElement.addEventListener('touchend', releaseAction);
            buttonElement.addEventListener('mousedown', pressAction);
            buttonElement.addEventListener('mouseup', releaseAction);
            buttonElement.addEventListener('mouseleave', releaseAction);
        }        // --- Game Setup ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const scoreDisplay = document.getElementById('score');
        const livesDisplay = document.getElementById('lives');
        const bossHealthDisplay = document.getElementById('bossHealthDisplay');
        const controlsInfo = document.getElementById('controlsInfo');
        const dPadContainer = document.getElementById('dPadContainer');
        const backgroundMusic = document.getElementById('backgroundMusic');

        let canvasWidth, canvasHeight;

        // Audio context for sound effects
        let audioCtx;
        
        // Asset Management
        const assets = {};
        let assetsLoaded = 0;
        const assetUrls = {
            playerShip: 'https://badlan.uken.ai/shmup/shmup-ship2.png',
            bossSkye: 'https://badlan.uken.ai/shmup/boss-skye-spritesheet.png' // Corrected URL
        };
        const totalAssets = Object.keys(assetUrls).length;
        let showHitbox = false;

        // Game state variables
        let score = 0;
        let lives = 3;
        let gameInterval;
        let keys = {};
        let player;
        let bullets = [];
        let enemies = [];
        let enemyBullets = [];
        let boss = null;
        let gameLevel = 0;
        let enemySpawnTimer = 0;
        let levelWaveCount = 0;
        const MAX_WAVES_PER_LEVEL = 3;
        const ENEMIES_PER_WAVE = 5;

        let gameState = 'LOADING';

        // --- Asset Styling ---
        const BULLET_COLOR = '#ffff00';
        const ENEMY_COLOR = '#ff00ff';
        const ENEMY_BULLET_COLOR = '#ff6666';

        // --- Sound Effects ---
        function playPewSound() {
            if (!audioCtx) return;
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.1);
            oscillator.connect(gainNode).connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        }

        function playWooshSound() {
            if (!audioCtx) return;
            const bufferSize = audioCtx.sampleRate * 0.5;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            const noiseSource = audioCtx.createBufferSource();
            noiseSource.buffer = buffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.value = 10;
            filter.frequency.setValueAtTime(400, audioCtx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(4000, audioCtx.currentTime + 0.3);
            filter.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.5);
            const gainNode = audioCtx.createGain();
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            noiseSource.connect(filter).connect(gainNode).connect(audioCtx.destination);
            noiseSource.start();
        }

        function playClinkSound() {
            if (!audioCtx) return;
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            const baseFrequency = 1200;
            oscillator.frequency.value = baseFrequency + Math.random() * 400 - 200;
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            oscillator.connect(gainNode).connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        }

        function playPlayerExplosionSound() {
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            const noise_duration = 0.3;
            const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * noise_duration, audioCtx.sampleRate);
            const noiseOutput = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseOutput.length; i++) {
                noiseOutput[i] = Math.random() * 2 - 1;
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = noiseBuffer;
            const noiseFilter = audioCtx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.value = 1500;
            const noiseGain = audioCtx.createGain();
            noiseGain.gain.setValueAtTime(0.5, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noise_duration);
            noise.connect(noiseFilter).connect(noiseGain).connect(audioCtx.destination);
            const ugh = audioCtx.createOscillator();
            ugh.type = 'sawtooth';
            const ughGain = audioCtx.createGain();
            ugh.frequency.setValueAtTime(150, now);
            ugh.frequency.exponentialRampToValueAtTime(80, now + 0.15);
            ughGain.gain.setValueAtTime(0.4, now);
            ughGain.gain.linearRampToValueAtTime(0, now + 0.2);
            ugh.connect(ughGain).connect(audioCtx.destination);
            noise.start(now);
            ugh.start(now);
            noise.stop(now + noise_duration);
            ugh.stop(now + 0.2);
        }

        function playBossExplosionSound() {
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            const duration = 3;
            const boom = audioCtx.createOscillator();
            boom.type = 'sine';
            boom.frequency.setValueAtTime(100, now);
            boom.frequency.exponentialRampToValueAtTime(30, now + 0.5);
            const boomGain = audioCtx.createGain();
            boomGain.gain.setValueAtTime(0.8, now);
            boomGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
            const lfo = audioCtx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 8;
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 0.2;
            lfo.connect(lfoGain).connect(boomGain.gain);
            boom.connect(boomGain).connect(audioCtx.destination);
            boom.start(now);
            lfo.start(now);
            boom.stop(now + duration);
            lfo.stop(now + duration);
        }

        // --- Asset Loader ---
        function loadAssets(callback) {
            for (const key in assetUrls) {
                assets[key] = new Image();
                assets[key].src = assetUrls[key];
                assets[key].onload = () => {
                    assetsLoaded++;
                    if (assetsLoaded === totalAssets) {
                        callback();
                    }
                };
                assets[key].onerror = () => {
                    console.error(`Failed to load asset: ${assetUrls[key]}`);
                    assetsLoaded++;
                    assets[key] = null;
                    if (assetsLoaded === totalAssets) {
                        callback();
                    }
                };
            }
        }
        
        // --- Responsive Canvas ---
        function resizeCanvas() {
            const container = document.getElementById('gameContainer');
            const containerWidth = container.clientWidth - 20;
            const containerHeight = window.innerHeight * 0.75;
            const aspectRatio = 3 / 4;
            if (containerWidth / containerHeight > aspectRatio) {
                canvasHeight = Math.min(containerHeight, 600);
                canvasWidth = canvasHeight * aspectRatio;
            } else {
                canvasWidth = Math.min(containerWidth, 450);
                canvasHeight = canvasWidth / aspectRatio;
            }
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            if (player) {
                player.x = canvas.width / 2 - player.width / 2;
                player.y = canvas.height - player.height - 20;
            }
        }
        window.addEventListener('resize', resizeCanvas);

        // --- Player Object ---
        function Player(x, y, width, height, speed) {
            this.x = x; this.y = y; this.width = width; this.height = height; this.speed = speed;
            this.shootCooldown = 0; this.maxShootCooldown = 10;
            this.isInvincible = false; this.invincibilityTimer = 0; this.maxInvincibilityDuration = 120;
            this.isRespawning = false; this.respawnPauseTimer = 0; this.respawnPauseDuration = 30;
            this.hitbox = { width: 10, height: 10, x_offset: (this.width - 10) / 2, y_offset: (this.height - 10) / 2 };

            this.draw = function() {
                if (this.isRespawning) return;
                const drawShip = () => {
                    if (assets.playerShip) {
                        ctx.drawImage(assets.playerShip, this.x, this.y, this.width, this.height);
                    } else { 
                        ctx.fillStyle = '#00ff00';
                        ctx.beginPath();
                        ctx.moveTo(this.x + this.width / 2, this.y);
                        ctx.lineTo(this.x, this.y + this.height);
                        ctx.lineTo(this.x + this.width, this.y + this.height);
                        ctx.closePath();
                        ctx.fill();
                    }
                };
                if (this.isInvincible && (this.invincibilityTimer % 12 < 6)) {} else { drawShip(); }
                if (showHitbox) {
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(this.x + this.hitbox.x_offset, this.y + this.hitbox.y_offset, this.hitbox.width, this.hitbox.height);
                }
            }

            this.update = function() {
                if (this.isRespawning) {
                    this.respawnPauseTimer--;
                    if (this.respawnPauseTimer <= 0) this.finishRespawn();
                    return;
                }
                if (this.isInvincible) {
                    this.invincibilityTimer--;
                    if (this.invincibilityTimer <= 0) this.isInvincible = false;
                }
                if (keys['ArrowUp'] && this.y > 0) this.y -= this.speed;
                if (keys['ArrowDown'] && this.y < canvas.height - this.height) this.y += this.speed;
                if (keys['ArrowLeft'] && this.x > 0) this.x -= this.speed;
                if (keys['ArrowRight'] && this.x < canvas.width - this.width) this.x += this.speed;
                if (this.shootCooldown > 0) this.shootCooldown--;
                if (keys['Space'] && this.shootCooldown === 0) {
                    bullets.push(new Bullet(this.x + this.width / 2 - 2.5, this.y, 5, 10, 7, BULLET_COLOR));
                    this.shootCooldown = this.maxShootCooldown;
                    playPewSound();
                }
                this.draw();
            }
            
            this.startRespawnSequence = function() {
                this.isRespawning = true;
                this.respawnPauseTimer = this.respawnPauseDuration;
            }

            this.finishRespawn = function() {
                this.isRespawning = false;
                this.x = canvas.width / 2 - this.width / 2;
                this.y = canvas.height - this.height - 20;
                this.isInvincible = true;
                this.invincibilityTimer = this.maxInvincibilityDuration;
                this.shootCooldown = this.maxShootCooldown;
            }
        }

        // --- Bullet Object ---
        function Bullet(x, y, width, height, speed, color, dy = -1, dx = 0) {
            this.x = x; this.y = y; this.width = width; this.height = height;
            this.speed = speed; this.color = color; this.dy = dy; this.dx = dx;
            this.draw = function() {
                ctx.fillStyle = this.color;
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
            this.update = function() {
                this.y += this.speed * this.dy;
                this.x += this.speed * this.dx;
                this.draw();
            }
        }

        // --- Enemy Object ---
        function Enemy(x, y, width, height, speed, health = 1, type = 'basic') {
            this.x = x; this.y = y; this.width = width; this.height = height;
            this.speed = speed; this.health = health; this.type = type;
            this.shootCooldown = Math.random() * 100 + 50;
            this.draw = function() {
                ctx.fillStyle = ENEMY_COLOR;
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
            this.update = function() {
                this.y += this.speed;
                this.shootCooldown--;
                if (this.shootCooldown <= 0 && this.y < canvas.height * 0.75) {
                    enemyBullets.push(new Bullet(this.x + this.width / 2 - 2.5, this.y + this.height, 5, 10, 4, ENEMY_BULLET_COLOR, 1));
                    this.shootCooldown = 100 + Math.random() * 50;
                }
                this.draw();
            }
        }
        
        // --- Boss Object ---
        function Boss(x, y, width, height, speed, health) {
            this.x = x; this.y = y; this.initialY = y; this.width = width; this.height = height;
            this.speed = speed; this.initialHealth = health; this.health = health;
            this.phase = 1; this.attackCooldown = 0; this.maxAttackCooldown = 120;
            this.moveDirection = 1; this.movementPattern = 'patrol'; this.isEntering = true;

            // Animation properties
            this.image = assets.bossSkye;
            this.spriteWidth = 100;
            this.spriteHeight = 80;
            this.currentFrame = 0; // 0: Idle, 1: Shooting, 2: Damaged
            this.animationTimer = 0; // Countdown for temporary frames like 'damaged' or 'shooting'

            this.draw = function() {
                if (this.image) {
                    ctx.drawImage(this.image, 
                        this.currentFrame * this.spriteWidth, 0, // Source X, Y on spritesheet
                        this.spriteWidth, this.spriteHeight,     // Source width, height
                        this.x, this.y,                           // Destination X, Y on canvas
                        this.width, this.height);                 // Destination width, height
                } else { // Fallback if image fails
                    ctx.fillStyle = '#ff0000';
                    ctx.fillRect(this.x, this.y, this.width, this.height);
                }
                
                // Health Bar
                const healthBarWidth = canvas.width * 0.8;
                const healthBarHeight = 15;
                const healthBarX = canvas.width * 0.1;
                const healthBarY = 10;
                ctx.fillStyle = '#555';
                ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);
                const currentHealthWidth = (this.health / this.initialHealth) * healthBarWidth;
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(healthBarX, healthBarY, currentHealthWidth, healthBarHeight);

                bossHealthDisplay.textContent = `Boss HP: ${Math.max(0, Math.round((this.health / this.initialHealth) * 100))}%`;
            }

            this.update = function() {
                if (this.isEntering) {
                    this.y += 1;
                    if (this.y >= this.initialY) this.isEntering = false;
                    this.draw();
                    return;
                }
                
                // Animation timer logic
                if(this.animationTimer > 0) {
                    this.animationTimer--;
                    if(this.animationTimer === 0) {
                        this.currentFrame = 0; // Revert to idle
                    }
                }

                if (this.movementPattern === 'patrol') {
                    this.x += this.speed * this.moveDirection;
                    if (this.x <= 0 || this.x + this.width >= canvas.width) this.moveDirection *= -1;
                }
                this.attackCooldown--;
                if (this.attackCooldown <= 0) {
                    this.performAttack();
                    this.attackCooldown = this.maxAttackCooldown;
                    if (this.health < this.initialHealth * 0.66 && this.phase === 1) {
                        this.phase = 2; this.maxAttackCooldown = 90; this.speed *= 1.2;
                        showTemporaryMessage("Boss is ENRAGED!", 1000);
                    } else if (this.health < this.initialHealth * 0.33 && this.phase === 2) {
                        this.phase = 3; this.maxAttackCooldown = 60; this.speed *= 1.2;
                        showTemporaryMessage("Boss is DESPERATE!", 1000);
                    }
                }
                this.draw();
            }

            this.performAttack = function() {
                this.currentFrame = 1; // Set to shooting frame
                this.animationTimer = 30; // Show shooting face for 0.5 seconds
                playWooshSound();
                if (this.phase === 1) {
                    for (let i = 0; i < 3; i++) {
                         enemyBullets.push(new Bullet(this.x + (this.width/4)*(i+1) - 5, this.y + this.height, 10, 15, 4, ENEMY_BULLET_COLOR, 1));
                    }
                } else if (this.phase === 2) {
                    for (let i = 0; i < 5; i++) {
                        const angle = (i - 2) * 0.1;
                        enemyBullets.push(new Bullet(this.x + this.width / 2 - 5, this.y + this.height, 8, 12, 5, ENEMY_BULLET_COLOR, 1, angle));
                    }
                } else if (this.phase === 3) {
                    for (let i = 0; i < 7; i++) {
                        const angle = (i - 3) * 0.12; 
                        enemyBullets.push(new Bullet(this.x + this.width / 2 - 5, this.y + this.height, 8, 12, 6, ENEMY_BULLET_COLOR, 1, angle));
                    }
                    if (player) {
                        const dxToPlayer = (player.x + player.width / 2) - (this.x + this.width / 2);
                        const dyToPlayer = (player.y + player.height / 2) - (this.y + this.height);
                        const distance = Math.sqrt(dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer);
                        const aimedDx = (dxToPlayer / distance) * 0.5;
                        const aimedDy = (dyToPlayer / distance) * 0.9;
                        enemyBullets.push(new Bullet(this.x + this.width / 2 - 5, this.y + this.height, 10, 15, 7, '#ffa500', aimedDy, aimedDx));
                    }
                }
            }
            
            this.takeDamage = function(amount) {
                this.health -= amount;
                this.currentFrame = 2; // Set to damaged frame
                this.animationTimer = 10; // Show damaged face for a short time
                if (this.health <= 0) {
                    this.health = 0;
                    playBossExplosionSound();
                    score += 500;
                    gameState = 'GAME_WON';
                    setTimeout(() => {
                        showTemporaryMessage("YOU DEFEATED SKYE!", 2000, startGame);
                    }, 1500);
                }
            }
        }

        // --- Game Logic ---
        function updateGame() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (gameState === 'PLAYING' || gameState === 'BOSS_FIGHT') {
                player.update();
                for (let i = bullets.length - 1; i >= 0; i--) {
                    bullets[i].update();
                    if (bullets[i].y < 0) bullets.splice(i, 1);
                }
                for (let i = enemyBullets.length - 1; i >= 0; i--) {
                    enemyBullets[i].update();
                    if (checkCollision(player, enemyBullets[i])) {
                        playerHit();
                        enemyBullets.splice(i, 1);
                        continue;
                    }
                    if (enemyBullets[i].y > canvas.height) enemyBullets.splice(i, 1);
                }
                if (gameState === 'PLAYING') {
                    enemySpawnTimer--;
                    if (enemySpawnTimer <= 0 && levelWaveCount < MAX_WAVES_PER_LEVEL) {
                        spawnEnemyWave(ENEMIES_PER_WAVE);
                        levelWaveCount++;
                        enemySpawnTimer = 200;
                    }
                    for (let i = enemies.length - 1; i >= 0; i--) {
                        enemies[i].update();
                        for (let j = bullets.length - 1; j >= 0; j--) {
                            if (checkCollision(enemies[i], bullets[j])) {
                                playClinkSound();
                                enemies[i].health--;
                                bullets.splice(j, 1);
                                if (enemies[i].health <= 0) {
                                    score += 10;
                                    enemies.splice(i, 1);
                                    break; 
                                }
                            }
                        }
                        if (enemies[i] && checkCollision(player, enemies[i])) {
                             playerHit();
                             enemies.splice(i,1);
                             continue;
                        }
                        if (enemies[i] && enemies[i].y > canvas.height) enemies.splice(i, 1);
                    }
                    if (levelWaveCount >= MAX_WAVES_PER_LEVEL && enemies.length === 0) {
                        gameState = 'LEVEL_TRANSITION';
                        showTemporaryMessage("BOSS INCOMING!", 2000, startBossFight);
                    }
                } else if (gameState === 'BOSS_FIGHT' && boss) {
                    boss.update();
                    for (let i = bullets.length - 1; i >= 0; i--) {
                        if (checkCollision(boss, bullets[i])) {
                            boss.takeDamage(1);
                            bullets.splice(i, 1);
                            score += 5;
                        }
                    }
                    if (checkCollision(player, boss)) {
                        playerHit();
                    }
                }
            } else if (gameState === 'LOADING') {
                drawLoadingScreen();
            } else if (gameState === 'START_SCREEN') {
                drawStartScreen();
            } else if (gameState === 'GAME_OVER') {
                drawGameOverScreen();
            } else if (gameState === 'GAME_WON') {
                drawGameWonScreen();
            }
            scoreDisplay.textContent = `Score: ${score}`;
            livesDisplay.textContent = `Lives: ${lives}`;
            bossHealthDisplay.style.display = (gameState === 'BOSS_FIGHT' && boss) ? 'block' : 'none';
        }

        function playerHit() {
            if (player.isInvincible || player.isRespawning) return; 
            playPlayerExplosionSound();
            lives--;
            showTemporaryMessage("HIT!", 500);
            if (lives <= 0) {
                gameState = 'GAME_OVER';
                backgroundMusic.pause();
                if (boss) bossHealthDisplay.style.display = 'none';
            } else {
                player.startRespawnSequence();
            }
        }

        function checkCollision(objA, objB) {
            if (!objA || !objB) return false;
            const rectA = objA.hitbox ? 
                { x: objA.x + objA.hitbox.x_offset, y: objA.y + objA.hitbox.y_offset, width: objA.hitbox.width, height: objA.hitbox.height } : 
                { x: objA.x, y: objA.y, width: objA.width, height: objA.height };
            const rectB = objB.hitbox ?
                { x: objB.x + objB.hitbox.x_offset, y: objB.y + objB.hitbox.y_offset, width: objB.hitbox.width, height: objB.hitbox.height } : 
                { x: objB.x, y: objB.y, width: objB.width, height: objB.height };
            return rectA.x < rectB.x + rectB.width &&
                   rectA.x + rectA.width > rectB.x &&
                   rectA.y < rectB.y + rectB.height &&
                   rectA.y + rectA.height > rectB.y;
        }

        function spawnEnemyWave(count) {
            for (let i = 0; i < count; i++) {
                const enemyX = Math.random() * (canvas.width - 30);
                const enemyY = -30 - (Math.random() * 50);
                enemies.push(new Enemy(enemyX, enemyY, 30, 30, 1 + Math.random()));
            }
        }
        
        function startBossFight() {
            clearMessage();
            gameState = 'BOSS_FIGHT';
            boss = new Boss(canvas.width / 2 - 50, -100, 100, 80, 1, 150);
            boss.initialY = 50;
            enemies = [];
            enemyBullets = [];
        }

        function showTemporaryMessage(text, duration, callback) {
            clearMessage();
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-overlay';
            messageDiv.id = 'tempMessage';
            messageDiv.textContent = text;
            document.body.appendChild(messageDiv);
            if (duration) {
                setTimeout(() => {
                    clearMessage();
                    if (callback) callback();
                }, duration);
            }
        }
        
        function showPersistentMessage(text, buttonText, buttonCallback) {
            clearMessage();
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-overlay';
            messageDiv.id = 'persistentMessage';
            const textNode = document.createElement('p');
            textNode.textContent = text;
            messageDiv.appendChild(textNode);
            if (buttonText && buttonCallback) {
                const button = document.createElement('button');
                button.textContent = buttonText;
                button.onclick = () => {
                    if (!audioCtx) {
                        try {
                            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        } catch (e) { console.error("Web Audio API is not supported"); }
                    }
                    clearMessage();
                    buttonCallback();
                };
                messageDiv.appendChild(button);
            }
            document.body.appendChild(messageDiv);
        }

        function clearMessage() {
            const tempMsg = document.getElementById('tempMessage');
            if (tempMsg) tempMsg.remove();
            const persistentMsg = document.getElementById('persistentMessage');
            if (persistentMsg) persistentMsg.remove();
        }

        function showTestMenu() {
            clearMessage();
            const testMenu = document.createElement('div');
            testMenu.className = 'message-overlay';
            testMenu.id = 'persistentMessage';
            testMenu.innerHTML = `<p style="font-size: 1.2em; margin-bottom: 10px;">Test Menu</p><input type="text" id="cheatCodeInput" placeholder="Enter code" style="color: black; padding: 5px; border-radius: 4px; border: 1px solid #fff; text-align: center; font-size: 20px;"><div style="margin-top: 15px;"><button id="submitCheatBtn">Go</button><button id="cancelCheatBtn" style="background-color: #ff6666;">Cancel</button></div>`;
            document.body.appendChild(testMenu);
            document.getElementById('cheatCodeInput').focus();
            document.getElementById('submitCheatBtn').onclick = () => handleCheatCode(document.getElementById('cheatCodeInput').value);
            document.getElementById('cancelCheatBtn').onclick = clearMessage;
        }

        function handleCheatCode(code) {
            clearMessage();
            switch(code) {
                case '12':
                    if (gameState === 'START_SCREEN' || gameState === 'GAME_OVER') startGame();
                    levelWaveCount = MAX_WAVES_PER_LEVEL;
                    enemies = [];
                    enemyBullets = [];
                    startBossFight();
                    break;
                default:
                    showTemporaryMessage("Invalid Code", 1000);
                    break;
            }
        }

        function drawLoadingScreen() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0,0,canvas.width, canvas.height);
            ctx.fillStyle = '#00ff00';
            ctx.font = `bold ${canvas.width / 15}px 'Courier New', monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(`Loading... ${assetsLoaded}/${totalAssets}`, canvas.width / 2, canvas.height / 2);
        }

        function drawStartScreen() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0,0,canvas.width, canvas.height);
            ctx.fillStyle = '#00ff00';
            ctx.font = `bold ${canvas.width / 12}px 'Courier New', monospace`;
            ctx.textAlign = 'center';
            ctx.fillText("Friend SHMUP!", canvas.width / 2, canvas.height / 3);
            if (!document.getElementById('persistentMessage')) {
                 showPersistentMessage("Are you ready to face your friends?", "Start Game", startGame);
            }
        }

        function drawGameOverScreen() {
            if (!document.getElementById('persistentMessage')) {
                backgroundMusic.pause();
                showPersistentMessage(`GAME OVER\nScore: ${score}`, "Restart", startGame);
            }
        }
        
        function drawGameWonScreen() {
             if (!document.getElementById('persistentMessage')) {
                backgroundMusic.pause();
                showPersistentMessage(`YOU WON!\nFinal Score: ${score}\n(More friends to battle coming soon!)`, "Play Again?", startGame);
            }
        }

        function initGame() {
            resizeCanvas();
            player = new Player(canvas.width / 2 - 15, canvas.height - 50, 30, 30, 5);
            score = 0; lives = 3; bullets = []; enemies = []; enemyBullets = [];
            boss = null; gameLevel = 0; levelWaveCount = 0; enemySpawnTimer = 100;
            
            bossHealthDisplay.style.display = 'none';
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                dPadContainer.style.display = 'flex';
                controlsInfo.textContent = "Use D-Pad to Move & Shoot (conceptual)";
                setupDPadListeners();
            } else {
                controlsInfo.textContent = "Use Arrow Keys to Move, Space to Shoot. (T for Test, H for Hitbox)";
            }
            
            loadAssets(() => {
                gameState = 'START_SCREEN';
                if (gameInterval) clearInterval(gameInterval);
                gameInterval = setInterval(updateGame, 1000 / 60);
            });
        }
        
        function startGame() {
            clearMessage();
            score = 0; lives = 3; bullets = []; enemies = []; enemyBullets = [];
            boss = null; gameLevel = 1; levelWaveCount = 0; enemySpawnTimer = 100;
            gameState = 'PLAYING';
            player.x = canvas.width / 2 - player.width / 2; 
            player.y = canvas.height - player.height - 20;
            player.shootCooldown = 0; player.isInvincible = false; player.invincibilityTimer = 0;
            player.isRespawning = false; player.respawnPauseTimer = 0;
            bossHealthDisplay.style.display = 'none';

            backgroundMusic.currentTime = 0;
            backgroundMusic.play().catch(e => console.error("Music play failed:", e));
        }

        // --- Event Listeners ---
        window.addEventListener('keydown', (e) => {
            if (document.querySelector('#cheatCodeInput')) return;
            if (e.code === 'KeyT' && !document.querySelector('.message-overlay')) {
                showTestMenu();
                return;
            }
            if (e.code === 'KeyH') {
                showHitbox = !showHitbox;
                return;
            }
            keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });

        function setupDPadListeners() {
            const dpadButtons = {
                'dpadUp': 'ArrowUp', 'dpadDown': 'ArrowDown',
                'dpadLeft': 'ArrowLeft', 'dpadRight': 'ArrowRight',
                'dpadAction': 'Space'
            };
            for (const [buttonId, keyCode] of Object.entries(dpadButtons)) {
                const buttonElement = document.getElementById(buttonId);
                if (buttonElement) {
                    const pressAction = (e) => { e.preventDefault(); keys[keyCode] = true; buttonElement.style.backgroundColor = '#00ffff'; };
                    const releaseAction = (e) => { e.preventDefault(); keys[keyCode] = false; buttonElement.style.backgroundColor = '#4a4e69'; };
                    buttonElement.addEventListener('touchstart', pressAction);
                    buttonElement.addEventListener('touchend', releaseAction);
                    buttonElement.addEventListener('mousedown', pressAction);
                    buttonElement.addEventListener('mouseup', releaseAction);
                    buttonElement.addEventListener('mouseleave', releaseAction);
                }
            }
        }

        initGame();

    }
}

initGame();
