(() => {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const frame = canvas.parentElement;
  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const startButton = document.getElementById('start-button');
  const restartButton = document.getElementById('restart-button');
  const soundToggle = document.getElementById('sound-toggle');
  const timeValue = document.getElementById('time-value');
  const mergeValue = document.getElementById('merge-value');
  const threatValue = document.getElementById('threat-value');
  const finalTime = document.getElementById('final-time');
  const finalMerge = document.getElementById('final-merge');
  const finalScore = document.getElementById('final-score');
  const itemList = document.getElementById('item-list');
  const spawnStatus = document.getElementById('spawn-status');
  const statusCopy = document.getElementById('status-copy');
  const statusBarFill = document.getElementById('status-bar-fill');
  const pickupToast = document.getElementById('pickup-toast');
  const centerPrompt = document.getElementById('center-prompt');

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0 };
  const palette = { bg: '#0e151d', grid: 'rgba(156, 178, 194, .065)', gridStrong: 'rgba(156, 178, 194, .12)', enemy: '#ff725e', enemy2: '#ff9c87', player: '#f1f5f7', mint: '#86dfcf', ink: '#0c1118' };
  const itemTypes = {
    dash: { label: '冲刺', hint: '速度提升', icon: '↗', kind: 'good', color: palette.mint },
    shield: { label: '护盾', hint: '6秒无敌', icon: '◌', kind: 'good', color: '#c4edf0' },
    freeze: { label: '冰冻', hint: '球潮减速', icon: '❄', kind: 'good', color: '#9dd9ef' },
    shock: { label: '震荡波', hint: '推开近敌', icon: '≈', kind: 'power', color: palette.mint },
    burst: { label: '脉冲清扫', hint: '清除小球', icon: '✹', kind: 'power', color: palette.enemy },
    missile: { label: '追踪弹', hint: '锁定一球', icon: '➤', kind: 'power', color: '#ffd48d' },
    slash: { label: '环刃', hint: '近身斩击', icon: '⌁', kind: 'power', color: palette.enemy },
    chain: { label: '连锁电弧', hint: '跳跃三次', icon: '⌁', kind: 'power', color: '#b7e9ff' },
    rocket: { label: '爆破弹', hint: '范围爆破', icon: '◆', kind: 'power', color: '#ffb56b' },
    laser: { label: '穿透射线', hint: '贯穿一线', icon: '╱', kind: 'power', color: '#d8f5ff' },
    poison: { label: '毒雾尾迹', hint: '触碰即死', icon: '∿', kind: 'power', color: '#a9e27c' },
    orbit: { label: '护卫环', hint: '永久旋转防御', icon: '◈', kind: 'good', color: '#d4f1df' },
    multiply: { label: '增殖', hint: '刷新变快', icon: '+', kind: 'bad', color: palette.enemy2 }
  };

  let W = 0; let H = 0; let state = 'idle'; let lastTime = 0; let elapsed = 0; let mergeCount = 0; let score = 0;
  let spawnTimer = 0; let itemTimer = 0; let enemyId = 0; let shake = 0; let toastTimer = 0; let promptTimer = 0;
  let enemies = []; let pickups = []; let particles = []; let ripples = []; let poisonClouds = []; let flashes = []; let beams = [];
  let orbitAngle = 0; let trailTimer = 0;
  const player = { x: 0, y: 0, r: 11, speed: 270, shield: 0, dash: 0, freeze: 0, poison: 0, orbit: 0, orbitGuards: 0, alive: true };

  function resize() {
    const rect = frame.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (state === 'idle') { player.x = W * .5; player.y = H * .52; }
  }

  function randomEdgePoint() {
    const side = Math.floor(Math.random() * 4);
    const pad = 20;
    if (side === 0) return { x: Math.random() * W, y: -pad };
    if (side === 1) return { x: W + pad, y: Math.random() * H };
    if (side === 2) return { x: Math.random() * W, y: H + pad };
    return { x: -pad, y: Math.random() * H };
  }

  function spawnEnemy(size = 1, forcedPoint) {
    const p = forcedPoint || randomEdgePoint();
    const r = 4.2 + Math.random() * 2.6;
    enemies.push({ id: enemyId++, x: p.x, y: p.y, r: r * size, mass: size, wobble: Math.random() * Math.PI * 2, hue: Math.random() });
  }

  function spawnPickup(type, x, y) {
    const pad = 40;
    const angle = Math.random() * Math.PI * 2; const speed = 9 + Math.random() * 10;
    pickups.push({ type, x: x ?? (pad + Math.random() * Math.max(1, W - pad * 2)), y: y ?? (pad + Math.random() * Math.max(1, H - pad * 2)), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 11, pulse: Math.random() * Math.PI * 2, life: 18 });
  }

  function resetGame() {
    elapsed = 0; mergeCount = 0; score = 0; spawnTimer = 0; itemTimer = 3.5; shake = 0; toastTimer = 0; promptTimer = 0;
    enemies = []; pickups = []; particles = []; ripples = []; poisonClouds = []; flashes = []; beams = [];
    orbitAngle = 0; trailTimer = 0;
    player.x = W * .5; player.y = H * .54; player.shield = 0; player.dash = 0; player.freeze = 0; player.poison = 0; player.orbit = 0; player.orbitGuards = 0; player.alive = true;
    for (let i = 0; i < 5; i++) spawnEnemy(1);
    updateHud(); updateInventory();
  }

  function startGame() {
    resetGame(); state = 'playing'; startScreen.classList.add('is-hidden'); gameOverScreen.classList.add('is-hidden'); statusCopy.textContent = '保持移动，让远处的小球先聚成一团。'; spawnStatus.textContent = '球潮活跃';
    lastTime = performance.now(); requestAnimationFrame(loop);
  }

  function endGame() {
    state = 'over'; player.alive = false; finalTime.textContent = formatTime(elapsed); finalMerge.textContent = String(mergeCount); finalScore.textContent = String(Math.floor(score)); gameOverScreen.classList.remove('is-hidden'); spawnStatus.textContent = '本局结束'; statusCopy.textContent = '回看路线，下一局可以更早利用护卫环。';
    burst(player.x, player.y, palette.player, 28); playTone(110, .24, 'sawtooth');
  }

  function formatTime(seconds) { const m = Math.floor(seconds / 60).toString().padStart(2, '0'); const s = Math.floor(seconds % 60).toString().padStart(2, '0'); return `${m}:${s}`; }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function update(dt) {
    elapsed += dt; score += dt * (10 + enemies.length * .45); spawnTimer -= dt; itemTimer -= dt; shake = Math.max(0, shake - dt * 5); toastTimer -= dt; promptTimer -= dt;
    if (spawnTimer <= 0) { const count = elapsed < 20 ? 1 : elapsed < 50 ? 2 : 3; for (let i = 0; i < count; i++) spawnEnemy(); spawnTimer = Math.max(.34, 1.65 - elapsed * .006) * (player.dash > 0 ? 1 : 1); }
    if (itemTimer <= 0) { const pool = ['dash', 'shield', 'freeze', 'shock', 'burst', 'missile', 'slash', 'chain', 'rocket', 'laser', 'poison', 'orbit', 'multiply']; spawnPickup(pool[Math.floor(Math.random() * pool.length)]); itemTimer = 6.2 + Math.random() * 4; }
    const move = { x: 0, y: 0 };
    if (keys.has('ArrowLeft') || keys.has('a')) move.x -= 1; if (keys.has('ArrowRight') || keys.has('d')) move.x += 1; if (keys.has('ArrowUp') || keys.has('w')) move.y -= 1; if (keys.has('ArrowDown') || keys.has('s')) move.y += 1;
    if (pointer.active) { const dx = pointer.x - player.x; const dy = pointer.y - player.y; const d = Math.hypot(dx, dy); if (d > 7) { move.x += dx / d; move.y += dy / d; } }
    const mag = Math.hypot(move.x, move.y) || 1; const boost = player.dash > 0 ? 1.72 : 1;
    player.x = clamp(player.x + (move.x / mag) * player.speed * boost * dt, player.r + 5, W - player.r - 5); player.y = clamp(player.y + (move.y / mag) * player.speed * boost * dt, player.r + 5, H - player.r - 5);
    player.dash = Math.max(0, player.dash - dt); player.freeze = Math.max(0, player.freeze - dt); player.shield = Math.max(0, player.shield - dt); player.poison = Math.max(0, player.poison - dt); orbitAngle += dt * (player.orbit > 0 ? 3.6 : 1.2);
    trailTimer -= dt;
    if (player.poison > 0 && trailTimer <= 0) { poisonClouds.push({ x: player.x, y: player.y, r: 17 + Math.random() * 4, life: 1.7, max: 1.7, wobble: Math.random() * Math.PI * 2 }); trailTimer = .1; }
    poisonClouds.forEach(cloud => { cloud.life -= dt; cloud.r += dt * .8; }); poisonClouds = poisonClouds.filter(cloud => cloud.life > 0);

    pickups.forEach(p => { p.pulse += dt * 3; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < p.r + 7 || p.x > W - p.r - 7) { p.x = clamp(p.x, p.r + 7, W - p.r - 7); p.vx *= -1; } if (p.y < p.r + 7 || p.y > H - p.r - 7) { p.y = clamp(p.y, p.r + 7, H - p.r - 7); p.vy *= -1; } }); pickups = pickups.filter(p => p.life > 0);
    for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i]; if (dist(player, p) < player.r + p.r + 7) { activatePickup(p.type); pickups.splice(i, 1); } }

    enemies.forEach(e => {
      const dx = player.x - e.x; const dy = player.y - e.y; const d = Math.hypot(dx, dy) || 1; const normalized = clamp(d / Math.max(W, H), 0, 1); const base = 38 + normalized * 72 + Math.min(elapsed * .24, 22); const sizeBoost = e.mass > 1.8 ? 1 + Math.min((e.mass - 1.8) * .1, .42) : 1; const slow = player.freeze > 0 ? .2 : 1; const jitter = Math.sin(elapsed * 3 + e.wobble) * 3;
      e.x += (dx / d * base * sizeBoost + jitter) * slow * dt; e.y += (dy / d * base * sizeBoost + Math.cos(elapsed * 2 + e.wobble) * 3) * slow * dt;
    });
    clearPoisonedEnemies(); protectWithOrbit();
    mergeEnemies();
    for (const e of enemies) { if (dist(player, e) < player.r + e.r - 1) { if (player.shield > 0) { e.x += (e.x - player.x || 1) * .5; e.y += (e.y - player.y || -1) * .5; burst(player.x, player.y, palette.mint, 5); } else { endGame(); break; } } }
    updateParticles(dt); updateHud(); updateInventory();
  }

  function mergeEnemies() {
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i]; const b = enemies[j]; if (dist(a, b) < (a.r + b.r) * .78) {
        const mass = a.mass + b.mass; const r = Math.sqrt(a.r * a.r + b.r * b.r); const merged = { id: a.id, x: (a.x * a.mass + b.x * b.mass) / mass, y: (a.y * a.mass + b.y * b.mass) / mass, r: Math.min(r, 32), mass: mass, wobble: a.wobble, hue: a.hue };
        enemies.splice(j, 1); enemies.splice(i, 1); enemies.push(merged); mergeCount++; score += 36 + mass * 8; burst(merged.x, merged.y, palette.enemy2, 9); ripples.push({ x: merged.x, y: merged.y, life: 1, max: 1, color: palette.enemy });
        i--; break;
      }
    }
  }

  function activatePickup(type) {
    if (type === 'dash') { player.dash = 5; showToast('冲刺 · 速度提升 5 秒'); playTone(460, .1, 'triangle'); }
    if (type === 'shield') { player.shield = 6; showToast('护盾 · 6 秒内无敌'); playTone(680, .13, 'sine'); }
    if (type === 'freeze') { player.freeze = 4.2; showToast('冰冻 · 球潮减速 4 秒'); playTone(300, .18, 'sine'); }
    if (type === 'shock') { const range = 190; let pushed = 0; enemies.forEach(e => { const dx = e.x - player.x; const dy = e.y - player.y; const d = Math.hypot(dx, dy) || 1; if (d < range) { const force = (1 - d / range) * 155; e.x = clamp(e.x + (dx / d) * force, -18, W + 18); e.y = clamp(e.y + (dy / d) * force, -18, H + 18); pushed++; } }); ripples.push({ x: player.x, y: player.y, life: .8, max: .8, color: palette.mint }); burst(player.x, player.y, palette.mint, 22); showToast(`震荡波 · 推开 ${pushed} 个近敌`); shake = .35; playTone(760, .2, 'triangle'); }
    if (type === 'burst') { let cleared = 0; for (let i = enemies.length - 1; i >= 0; i--) { if (enemies[i].mass <= 2) { destroyEnemy(i, 'pulse'); cleared++; } } ripples.push({ x: player.x, y: player.y, life: 1.1, max: 1.1, color: palette.enemy }); score += cleared * 22; showToast(`脉冲清扫 · 清除 ${cleared} 个小球`); shake = .55; playTone(130, .28, 'sawtooth'); }
    if (type === 'missile') { const target = enemies.slice().sort((a, b) => dist(player, a) - dist(player, b))[0]; if (target) { beams.push({ x1: player.x, y1: player.y, x2: target.x, y2: target.y, life: .28, max: .28, color: '#ffd48d' }); destroyEnemy(enemies.indexOf(target), 'missile'); showToast('追踪弹 · 锁定并击破最近目标'); } else showToast('追踪弹 · 当前没有目标'); playTone(520, .16, 'square'); }
    if (type === 'slash') { const range = 150; let cleared = 0; for (let i = enemies.length - 1; i >= 0; i--) { if (dist(player, enemies[i]) < range) { destroyEnemy(i, 'slash'); cleared++; } } ripples.push({ x: player.x, y: player.y, life: .7, max: .7, radius: range, width: 3, color: palette.enemy }); showToast(`环刃 · 近身击破 ${cleared} 个敌人`); shake = .3; playTone(360, .2, 'sawtooth'); }
    if (type === 'chain') { const targets = enemies.slice().sort((a, b) => dist(player, a) - dist(player, b)).slice(0, 3); let origin = { x: player.x, y: player.y }; targets.forEach(target => { beams.push({ x1: origin.x, y1: origin.y, x2: target.x, y2: target.y, life: .34, max: .34, color: '#b7e9ff' }); destroyEnemy(enemies.indexOf(target), 'chain'); origin = target; }); showToast(`连锁电弧 · 跳跃 ${targets.length} 次`); shake = .25; playTone(820, .22, 'triangle'); }
    if (type === 'rocket') { const target = enemies.slice().sort((a, b) => dist(player, a) - dist(player, b))[0]; if (target) { const blastRadius = 118; beams.push({ x1: player.x, y1: player.y, x2: target.x, y2: target.y, life: .22, max: .22, color: '#ffb56b' }); let cleared = 0; for (let i = enemies.length - 1; i >= 0; i--) { if (dist(target, enemies[i]) < blastRadius) { destroyEnemy(i, 'rocket'); cleared++; } } ripples.push({ x: target.x, y: target.y, life: .95, max: .95, radius: blastRadius, width: 4, color: '#ffb56b' }); flashes.push({ x: target.x, y: target.y, life: .2, max: .2, radius: 42 }); showToast(`爆破弹 · 范围击破 ${cleared} 个敌人`); shake = .7; } else showToast('爆破弹 · 当前没有目标'); playTone(180, .28, 'sawtooth'); }
    if (type === 'laser') { const target = enemies.slice().sort((a, b) => dist(player, a) - dist(player, b))[0]; if (target) { const dx = target.x - player.x; const dy = target.y - player.y; const length = Math.hypot(dx, dy) || 1; const ux = dx / length; const uy = dy / length; const end = { x: player.x + ux * Math.max(W, H) * 1.3, y: player.y + uy * Math.max(W, H) * 1.3 }; beams.push({ x1: player.x, y1: player.y, x2: end.x, y2: end.y, life: .32, max: .32, color: '#d8f5ff' }); const candidates = enemies.map((enemy, index) => ({ enemy, index, along: (enemy.x - player.x) * ux + (enemy.y - player.y) * uy, side: Math.abs((enemy.x - player.x) * uy - (enemy.y - player.y) * ux) })).filter(hit => hit.along > 0 && hit.along < Math.max(W, H) * 1.2 && hit.side < hit.enemy.r + 8).sort((a, b) => a.along - b.along).slice(0, 5); let cleared = 0; candidates.reverse().forEach(hit => { const index = enemies.indexOf(hit.enemy); if (index >= 0) { destroyEnemy(index, 'laser'); cleared++; } }); showToast(`穿透射线 · 贯穿 ${cleared} 个目标`); shake = .3; } else showToast('穿透射线 · 当前没有目标'); playTone(980, .2, 'sine'); }
    if (type === 'poison') { player.poison = 4; trailTimer = 0; showToast('毒雾尾迹 · 4 秒内触碰即死'); playTone(220, .17, 'square'); }
    if (type === 'orbit') { player.orbit = 1; player.orbitGuards = 3; showToast('护卫环 · 3 个永久旋转护卫'); playTone(590, .16, 'triangle'); }
    if (type === 'multiply') { spawnEnemy(1.2); spawnEnemy(1.2); spawnTimer = Math.min(spawnTimer, .2); showToast('增殖 · 小球刷新变快'); shake = .8; playTone(170, .2, 'square'); }
    updateInventory();
  }

  function showToast(message) { pickupToast.textContent = message; pickupToast.classList.add('is-visible'); toastTimer = 2.1; }
  function updateHud() { timeValue.textContent = formatTime(elapsed); mergeValue.textContent = String(mergeCount); const level = enemies.length > 26 || elapsed > 100 ? '极高' : enemies.length > 16 || elapsed > 55 ? '高' : enemies.length > 8 || elapsed > 25 ? '中' : '低'; threatValue.textContent = level; threatValue.style.color = level === '低' ? palette.mint : level === '中' ? '#ffd48d' : palette.enemy; statusBarFill.style.width = `${clamp((enemies.length / 34) * 100, 0, 100)}%`; if (toastTimer <= 0) pickupToast.classList.remove('is-visible'); if (promptTimer <= 0) centerPrompt.classList.remove('is-visible'); }
  function updateInventory() { const active = []; if (player.dash > 0) active.push(['dash', `${Math.ceil(player.dash)}s`]); if (player.shield > 0) active.push(['shield', `${Math.ceil(player.shield)}s`]); if (player.freeze > 0) active.push(['freeze', `${Math.ceil(player.freeze)}s`]); if (player.poison > 0) active.push(['poison', `${Math.ceil(player.poison)}s`]); if (player.orbit > 0) active.push(['orbit', `${player.orbitGuards}/3`]); if (!active.length) { itemList.innerHTML = '<div class="empty-item"><span class="empty-ring"></span><span>场上会出现道具</span></div>'; return; } itemList.innerHTML = active.map(([type, value]) => `<div class="item-card"><span class="item-orb ${itemTypes[type].kind}">${itemTypes[type].icon}</span><div><strong>${itemTypes[type].label}</strong><span>${value}</span></div></div>`).join(''); }

  function clearPoisonedEnemies() { for (let i = enemies.length - 1; i >= 0; i--) { const e = enemies[i]; const poisoned = poisonClouds.some(cloud => dist(cloud, e) < cloud.r + e.r * .72); if (poisoned) { score += 30 + e.mass * 10; destroyEnemy(i, 'poison'); } } }
  function orbitGuards() { const guards = []; const count = player.orbitGuards; const radius = player.r + 26; for (let i = 0; i < count; i++) { const angle = orbitAngle + i * (Math.PI * 2 / Math.max(count, 1)); guards.push({ x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius, r: 7 }); } return guards; }
  function protectWithOrbit() { if (player.orbit <= 0 || player.orbitGuards <= 0) return; const guards = orbitGuards(); let guardHits = 0; for (let i = enemies.length - 1; i >= 0; i--) { const enemy = enemies[i]; const guardIndex = guards.findIndex(item => dist(item, enemy) < item.r + enemy.r); if (guardIndex >= 0) { score += 44 + enemy.mass * 8; destroyEnemy(i, 'orbit'); guards.splice(guardIndex, 1); player.orbitGuards--; guardHits++; if (player.orbitGuards <= 0) { player.orbit = 0; break; } } } if (guardHits > 0) { showToast(`护卫环损失 ${guardHits} 个 · 剩余 ${player.orbitGuards}`); } }
  function destroyEnemy(index, cause) { const enemy = enemies[index]; if (!enemy) return; const isLarge = enemy.mass > 2; const color = cause === 'poison' ? '#a9e27c' : cause === 'orbit' ? '#d4f1df' : palette.enemy; enemies.splice(index, 1); burst(enemy.x, enemy.y, color, isLarge ? 46 : 10, isLarge ? 1.5 : 1); ripples.push({ x: enemy.x, y: enemy.y, life: isLarge ? 1.1 : .5, max: isLarge ? 1.1 : .5, radius: isLarge ? 270 : 160, width: isLarge ? 3 : 1.5, color }); if (!isLarge) return; flashes.push({ x: enemy.x, y: enemy.y, life: .24, max: .24, radius: enemy.r * 1.7 }); ripples.push({ x: enemy.x, y: enemy.y, life: .66, max: .66, radius: 150, width: 2, color: '#fff' }); const fragments = Math.min(7, Math.max(2, Math.floor(Math.sqrt(enemy.mass) + 1))); const fragmentMass = clamp(enemy.mass / fragments * .78, .75, 1.45); const safeDistance = Math.max(enemy.r * 1.2 + 14, player.r + 32); for (let i = 0; i < fragments; i++) { const angle = (Math.PI * 2 * i / fragments) + Math.random() * .45; const distance = safeDistance + Math.random() * 13; spawnEnemy(fragmentMass, { x: enemy.x + Math.cos(angle) * distance, y: enemy.y + Math.sin(angle) * distance }); } score += fragments * 18; shake = Math.max(shake, 1.15); }

  function burst(x, y, color, count, scale = 1) { for (let i = 0; i < count; i++) { const angle = Math.random() * Math.PI * 2; const speed = (25 + Math.random() * 120) * scale; particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .55, max: 1, size: (1 + Math.random() * 2) * scale, color }); } }
  function updateParticles(dt) { particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .95; p.vy *= .95; p.life -= dt; }); particles = particles.filter(p => p.life > 0); ripples.forEach(r => r.life -= dt); ripples = ripples.filter(r => r.life > 0); flashes.forEach(f => f.life -= dt); flashes = flashes.filter(f => f.life > 0); beams.forEach(b => b.life -= dt); beams = beams.filter(b => b.life > 0); }

  function draw() {
    ctx.save(); if (shake > 0) ctx.translate((Math.random() - .5) * shake * 8, (Math.random() - .5) * shake * 8);
    drawAtmosphere(); drawGrid();
    flashes.forEach(f => { const progress = 1 - f.life / f.max; const alpha = (1 - progress) * .65; ctx.beginPath(); ctx.arc(f.x, f.y, f.radius * (0.55 + progress * .45), 0, Math.PI * 2); ctx.fillStyle = hexAlpha('#fff8e8', alpha); ctx.fill(); }); ripples.forEach(r => { const progress = 1 - r.life / r.max; ctx.beginPath(); ctx.arc(r.x, r.y, progress * (r.radius || 160), 0, Math.PI * 2); ctx.strokeStyle = hexAlpha(r.color, (1 - progress) * (r.width > 2 ? .5 : .3)); ctx.lineWidth = r.width || 1.5; ctx.stroke(); }); beams.forEach(b => { const alpha = clamp(b.life / b.max, 0, 1); ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.strokeStyle = hexAlpha(b.color, alpha * .85); ctx.lineWidth = 2 + alpha * 2; ctx.shadowBlur = 14; ctx.shadowColor = b.color; ctx.stroke(); ctx.shadowBlur = 0; });
    poisonClouds.forEach(drawPoisonCloud); pickups.forEach(drawPickup); enemies.forEach(drawEnemy); drawPlayer(); particles.forEach(p => { ctx.globalAlpha = clamp(p.life / .65, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }); ctx.globalAlpha = 1; ctx.restore();
  }

  function drawAtmosphere() { const gradient = ctx.createRadialGradient(W * .52, H * .45, 10, W * .52, H * .45, Math.max(W, H) * .8); gradient.addColorStop(0, '#172638'); gradient.addColorStop(.48, '#0f1a27'); gradient.addColorStop(1, '#080d14'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H); const scanY = (elapsed * 34) % (H + 40) - 20; ctx.fillStyle = 'rgba(134, 223, 207, .045)'; ctx.fillRect(0, scanY, W, 2); ctx.fillStyle = 'rgba(255, 114, 94, .03)'; ctx.fillRect(0, scanY + 3, W, 1); }
  function drawGrid() { const gap = 42; ctx.lineWidth = 1; for (let x = 0; x <= W; x += gap) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.strokeStyle = x % (gap * 4) === 0 ? 'rgba(159, 212, 230, .14)' : palette.grid; ctx.stroke(); } for (let y = 0; y <= H; y += gap) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.strokeStyle = y % (gap * 4) === 0 ? 'rgba(159, 212, 230, .14)' : palette.grid; ctx.stroke(); } }
  function drawEnemy(e) { const isLarge = e.mass > 2; const glow = 4 + Math.sin(elapsed * 2 + e.wobble) * 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + glow, 0, Math.PI * 2); ctx.fillStyle = hexAlpha(isLarge ? '#ffb56b' : palette.enemy, isLarge ? .12 : .07); ctx.fill(); if (isLarge) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7 + Math.sin(elapsed * 2.4 + e.wobble) * 2, 0, Math.PI * 2); ctx.strokeStyle = hexAlpha('#ffb56b', .35); ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.stroke(); ctx.setLineDash([]); } ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fillStyle = isLarge ? '#ed694f' : palette.enemy; ctx.fill(); ctx.beginPath(); ctx.arc(e.x - e.r * .25, e.y - e.r * .3, Math.max(1.2, e.r * .16), 0, Math.PI * 2); ctx.fillStyle = hexAlpha('#fff', isLarge ? .62 : .42); ctx.fill(); if (isLarge) { ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(2, e.r * .22), 0, Math.PI * 2); ctx.fillStyle = '#ffcf89'; ctx.fill(); } }
  function drawPlayer() { if (player.orbit > 0) { const guards = orbitGuards(); ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 27, 0, Math.PI * 2); ctx.strokeStyle = hexAlpha('#d4f1df', .22); ctx.setLineDash([2, 6]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); guards.forEach(guard => { ctx.beginPath(); ctx.arc(guard.x, guard.y, guard.r + 4, 0, Math.PI * 2); ctx.fillStyle = hexAlpha('#d4f1df', .12); ctx.fill(); ctx.beginPath(); ctx.arc(guard.x, guard.y, guard.r, 0, Math.PI * 2); ctx.fillStyle = '#d4f1df'; ctx.fill(); ctx.beginPath(); ctx.arc(guard.x - 2, guard.y - 2, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); }); } ctx.beginPath(); ctx.arc(player.x, player.y, player.r + (player.shield ? 9 : 4), 0, Math.PI * 2); ctx.fillStyle = hexAlpha(player.shield ? palette.mint : palette.player, player.shield ? .12 : .08); ctx.fill(); if (player.shield) { ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 7, 0, Math.PI * 2); ctx.strokeStyle = palette.mint; ctx.lineWidth = 2; ctx.stroke(); } ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fillStyle = palette.player; ctx.fill(); ctx.beginPath(); ctx.arc(player.x - 3, player.y - 3, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#9eacb4'; ctx.fill(); }
  function drawPoisonCloud(cloud) { const alpha = clamp(cloud.life / cloud.max, 0, 1) * .2; ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2); ctx.fillStyle = hexAlpha('#a9e27c', alpha); ctx.fill(); ctx.strokeStyle = hexAlpha('#a9e27c', alpha + .14); ctx.lineWidth = 1; ctx.stroke(); ctx.beginPath(); ctx.arc(cloud.x + Math.sin(elapsed * 3 + cloud.wobble) * 3, cloud.y - 2, cloud.r * .45, 0, Math.PI * 2); ctx.fillStyle = hexAlpha('#d4f1df', alpha * .6); ctx.fill(); }
  function drawPickup(p) { const meta = itemTypes[p.type]; const pulse = Math.sin(p.pulse) * 2; ctx.beginPath(); ctx.moveTo(p.x - p.vx * .35, p.y - p.vy * .35); ctx.lineTo(p.x, p.y); ctx.strokeStyle = hexAlpha(meta.color, .2); ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7 + pulse, 0, Math.PI * 2); ctx.strokeStyle = hexAlpha(meta.color, .17); ctx.lineWidth = 1; ctx.stroke(); ctx.beginPath(); ctx.arc(p.x, p.y, p.r + pulse * .35, 0, Math.PI * 2); ctx.fillStyle = hexAlpha(meta.color, .16); ctx.fill(); ctx.strokeStyle = hexAlpha(meta.color, .9); ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = meta.color; ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(meta.icon, p.x, p.y + 1); }
  function hexAlpha(hex, alpha) { const raw = hex.replace('#', ''); const n = parseInt(raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw, 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`; }

  function loop(now) { if (state !== 'playing') { draw(); return; } const dt = Math.min((now - lastTime) / 1000, .034); lastTime = now; update(dt); draw(); requestAnimationFrame(loop); }

  function setPointer(event) { const rect = canvas.getBoundingClientRect(); pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; }
  canvas.addEventListener('pointerdown', event => { pointer.active = true; setPointer(event); canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', event => { if (pointer.active) setPointer(event); });
  canvas.addEventListener('pointerup', () => { pointer.active = false; });
  canvas.addEventListener('pointercancel', () => { pointer.active = false; });
  window.addEventListener('keydown', event => { const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' '].includes(key)) event.preventDefault(); keys.add(key); });
  window.addEventListener('keyup', event => { const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; keys.delete(key); });
  startButton.addEventListener('click', startGame); restartButton.addEventListener('click', startGame);
  soundToggle.addEventListener('click', () => { const on = soundToggle.getAttribute('aria-pressed') !== 'true'; soundToggle.setAttribute('aria-pressed', String(on)); soundToggle.querySelector('.sound-text').textContent = on ? '声音' : '静音'; });
  function playTone(freq, duration, type) { if (soundToggle.getAttribute('aria-pressed') !== 'true') return; try { const audio = new (window.AudioContext || window.webkitAudioContext)(); const osc = audio.createOscillator(); const gain = audio.createGain(); osc.type = type; osc.frequency.value = freq; gain.gain.setValueAtTime(.035, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration); osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration); } catch (_) { /* Audio is optional in the prototype. */ } }

  resize(); window.addEventListener('resize', resize); resetGame(); draw();
})();
