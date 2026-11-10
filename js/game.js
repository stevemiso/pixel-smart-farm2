/* ============================================================
   픽셀 스마트팜 — 게임 엔진
   캔버스 렌더링 + 게임 로직 + UI 연결
   ============================================================ */
'use strict';

/* ---------------- 상수 & 유틸 ---------------- */
const WORLD_W = 960;
const WORLD_H = 640;

const GRID = { cols: 6, rows: 4, plot: 72, gap: 12 };
GRID.width  = GRID.cols * GRID.plot + (GRID.cols - 1) * GRID.gap;
GRID.height = GRID.rows * GRID.plot + (GRID.rows - 1) * GRID.gap;
GRID.x0 = Math.round((WORLD_W - GRID.width) / 2);
GRID.y0 = 140;

const FENCE = { left: 44, right: 916, top: 92, bottom: 604 };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

// 정해진 장식 배치를 위한 시드 난수
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 49297) % 233280;
    return s / 233280;
  };
}

/* ---------------- 게임 상태 ---------------- */
const state = {
  started: false,
  money: 100,
  bag: { seeds: {}, crops: {}, facilities: {} }, // id -> 개수
  plots: [],
  selected: { type: null, id: null },            // 핫바 선택
  muted: false,
  modalOpen: null,
  shopTab: 'seeds',
};

for (let i = 0; i < GRID.cols * GRID.rows; i++) {
  state.plots.push({ crop: null, progress: 0, facility: null, wateredUntil: 0 });
}

// 게임 내 경과 시간(초) — 물주기 지속시간 계산에 사용
let gameTime = 0;

const player = {
  x: WORLD_W / 2, y: 540,
  speed: 170,
  dir: 'down',
  walkPhase: 0,
  moving: false,
};

/* ---------------- 소리 (WebAudio, 절차 생성) ---------------- */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function tone(freq, dur, type = 'square', vol = 0.12, when = 0) {
  if (!audioCtx || state.muted) return;
  const t = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
const SFX = {
  plant:    () => tone(160, 0.12, 'square', 0.1),
  harvest:  () => { tone(520, 0.08, 'square', 0.1); tone(780, 0.12, 'square', 0.1, 0.07); },
  coin:     () => { tone(880, 0.07, 'square', 0.1); tone(1320, 0.16, 'square', 0.1, 0.06); },
  buy:      () => { tone(660, 0.07, 'triangle', 0.14); tone(990, 0.12, 'triangle', 0.14, 0.05); },
  error:    () => tone(120, 0.18, 'sawtooth', 0.08),
  install:  () => tone(300, 0.15, 'triangle', 0.14),
  water:    () => { tone(700, 0.05, 'sine', 0.09); tone(520, 0.06, 'sine', 0.09, 0.04); tone(380, 0.09, 'sine', 0.09, 0.08); },
};

// 간단한 배경 음악 (5음계 16스텝 루프)
const MELODY = [523.25, 0, 659.25, 0, 783.99, 0, 659.25, 0, 587.33, 0, 523.25, 0, 392.00, 0, 440.00, 0];
const BASS   = [131, 0, 0, 0, 165, 0, 0, 0, 147, 0, 0, 0, 98, 0, 0, 0];
let musicStep = 0;
let musicTimer = null;
function startMusic() {
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (state.muted || !audioCtx) return;
    const m = MELODY[musicStep % 16];
    const b = BASS[musicStep % 16];
    if (m) tone(m, 0.28, 'triangle', 0.035);
    if (b) tone(b, 0.5, 'sine', 0.05);
    musicStep++;
  }, 320);
}

/* ---------------- 토스트 메시지 ---------------- */
function toast(msg, kind = '') {
  const wrap = $('toasts');
  // 최대 3개(좁은 화면은 2개)까지만 표시 (오래된 것부터 제거)
  const maxToasts = window.innerWidth <= 700 ? 2 : 3;
  while (wrap.children.length >= maxToasts) wrap.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2300);
}

/* ---------------- 아이템 데이터 접근 ---------------- */
const cropById = (id) => CROPS.find((c) => c.id === id);
const facById = (id) => FACILITIES[id];

// 핫바에 표시될 아이템 목록 (보유 중인 씨앗 + 설비)
function hotbarItems() {
  const items = [];
  for (const c of CROPS) {
    const n = state.bag.seeds[c.id] || 0;
    if (n > 0) items.push({ type: 'seed', id: c.id, count: n });
  }
  for (const key of Object.keys(FACILITIES)) {
    const n = state.bag.facilities[key] || 0;
    if (n > 0) items.push({ type: 'facility', id: key, count: n });
  }
  return items;
}
function itemIcon(item) {
  if (item.type === 'seed') return { icon: cropIcon(cropById(item.id)), label: cropById(item.id).name + ' 씨앗' };
  return { icon: facById(item.id).icon, label: facById(item.id).name };
}

/* ---------------- 밭 관련 헬퍼 ---------------- */
function plotRect(i) {
  const col = i % GRID.cols;
  const row = Math.floor(i / GRID.cols);
  const x = GRID.x0 + col * (GRID.plot + GRID.gap);
  const y = GRID.y0 + row * (GRID.plot + GRID.gap);
  return { x, y, w: GRID.plot, h: GRID.plot, cx: x + GRID.plot / 2, cy: y + GRID.plot / 2 };
}
function plotAtPoint(wx, wy) {
  for (let i = 0; i < state.plots.length; i++) {
    const r = plotRect(i);
    if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return i;
  }
  return -1;
}
// 물주기 효과가 살아있는지 확인 (게임 시간 기준)
function isWatered(plot) {
  return gameTime < plot.wateredUntil;
}

function plotSpeedInfo(plot) {
  if (!plot.crop) return null;
  const crop = cropById(plot.crop);
  const mult = envMultiplier(crop, plot.facility) * (isWatered(plot) ? WATER.boost : 1);
  const waterLeft = isWatered(plot) ? Math.ceil(plot.wateredUntil - gameTime) : 0;
  return { crop, mult, pct: Math.round(mult * 100), waterLeft };
}

/* ---------------- 상호작용 ---------------- */
const INTERACT_RANGE = 130;

function tryActOnPlot(i) {
  const plot = state.plots[i];
  const r = plotRect(i);
  if (dist(player.x, player.y, r.cx, r.cy) > INTERACT_RANGE) {
    toast('밭이 너무 멀어요! 가까이 가보자.', 'bad');
    SFX.error();
    return;
  }

  // 1) 다 자란 작물 → 수확이 최우선
  if (plot.crop && plot.progress >= 1) {
    const crop = cropById(plot.crop);
    state.bag.crops[crop.id] = (state.bag.crops[crop.id] || 0) + 1;
    plot.crop = null;
    plot.progress = 0;
    plot.wateredUntil = 0; // 수확하면 물 효과도 함께 초기화
    emitParticles(r.cx, r.cy, crop.colors.accent, 14);
    SFX.harvest();
    toast(`${crop.name} 수확 완료! 가방 확인`, 'good');
    renderHotbar();
    return;
  }

  const sel = state.selected;

  // 2) 물뿌리개를 선택했으면 물주기 (작물이 심겨 있을 때만, 소모되지 않는 도구)
  if (sel.type === 'facility' && sel.id === 'wateringCan' && (state.bag.facilities.wateringCan || 0) > 0) {
    if (!plot.crop) {
      toast('물은 작물에 주는 거예요! 먼저 씨앗을 심어보자.', 'bad');
      SFX.error();
      return;
    }
    const wasWatered = isWatered(plot);
    plot.wateredUntil = gameTime + WATER.duration;
    SFX.water();
    emitParticles(r.cx, r.cy - 10, '#5ab8f0', 12);
    emitParticles(r.cx, r.cy - 10, '#9adfff', 8);
    if (wasWatered) toast(`물을 다시 줬어요! 속도 1.5배 (남은 ${WATER.duration}초)`, 'good');
    else toast('물주기 완료! 30초간 속도 1.5배', 'good');
    return;
  }

  // 3) 선택한 설비가 있으면 설치 (작물이 있어도 가능, 기존 설비는 교체)
  if (sel.type === 'facility' && (state.bag.facilities[sel.id] || 0) > 0) {
    const old = plot.facility;
    plot.facility = sel.id;
    state.bag.facilities[sel.id]--;
    SFX.install();
    emitParticles(r.cx, r.cy, '#ffffff', 8);
    if (old) toast(`${facById(sel.id).name} 설치! (${facById(old).name} 교체)`, 'good');
    else toast(`${facById(sel.id).name} 설치 완료!`, 'good');
    if (state.bag.facilities[sel.id] <= 0) clearSelectionIf(sel);
    renderHotbar();
    return;
  }

  // 4) 선택한 씨앗이 있고 빈 밭이면 심기
  if (sel.type === 'seed' && (state.bag.seeds[sel.id] || 0) > 0) {
    if (plot.crop) {
      toast('이미 작물이 심겨 있어요!', 'bad');
      SFX.error();
      return;
    }
    plot.crop = sel.id;
    plot.progress = 0;
    state.bag.seeds[sel.id]--;
    SFX.plant();
    emitParticles(r.cx, r.cy + 20, '#8a5a2b', 10);
    toast(`${cropById(sel.id).name} 심었어요!`, 'good');
    if (state.bag.seeds[sel.id] <= 0) clearSelectionIf(sel);
    renderHotbar();
    return;
  }

  // 5) 그 외 → 상태 안내
  if (plot.crop) {
    const info = plotSpeedInfo(plot);
    toast(`${info.crop.name} 재배 중… 속도 ${info.pct}%`, '');
  } else if (plot.facility) {
    toast(`빈 밭 (설비: ${facById(plot.facility).name})`, '');
  } else {
    toast('빈 밭이에요. 씨앗을 선택해 심어보자!', '');
  }
}

function clearSelectionIf(sel) {
  if (state.selected === sel) state.selected = { type: null, id: null };
  renderHotbar();
}

/* ---------------- 상점 ---------------- */
function buySeed(id) {
  const crop = cropById(id);
  if (state.money < crop.seedPrice) {
    toast('돈이 부족해요!', 'bad');
    SFX.error();
    return;
  }
  state.money -= crop.seedPrice;
  state.bag.seeds[id] = (state.bag.seeds[id] || 0) + 1;
  SFX.buy();
  toast(`${crop.name} 씨앗 구매!`, 'good');
  updateHUD();
  renderShop();
  renderHotbar();
}
function buyFacility(id) {
  const fac = facById(id);
  if (state.money < fac.price) {
    toast('돈이 부족해요!', 'bad');
    SFX.error();
    return;
  }
  state.money -= fac.price;
  state.bag.facilities[id] = (state.bag.facilities[id] || 0) + 1;
  SFX.buy();
  toast(`${fac.name} 구매! 밭을 클릭해 설치하자`, 'good');
  updateHUD();
  renderShop();
  renderHotbar();
}
function sellCrops(id) {
  const n = state.bag.crops[id] || 0;
  if (n <= 0) return;
  const crop = cropById(id);
  const total = crop.sellPrice * n;
  state.money += total;
  delete state.bag.crops[id];
  SFX.coin();
  toast(`${crop.name} ×${n} 판매 → +${fmt(total)} G`, 'good');
  updateHUD();
  renderBag();
}
function sellAllCrops() {
  const ids = Object.keys(state.bag.crops);
  if (ids.length === 0) {
    toast('팔 작물이 없어요. 수확 먼저!', 'bad');
    return;
  }
  let total = 0;
  for (const id of ids) total += cropById(id).sellPrice * state.bag.crops[id];
  state.money += total;
  state.bag.crops = {};
  SFX.coin();
  toast(`전체 판매 완료! +${fmt(total)} G`, 'good');
  updateHUD();
  renderBag();
}

/* ---------------- UI 렌더링 ---------------- */
function updateHUD() {
  $('money').textContent = fmt(state.money);
}

function renderHotbar() {
  const bar = $('hotbar');
  bar.innerHTML = '';
  const items = hotbarItems();
  if (items.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'slot empty-hint';
    hint.textContent = '상점에서 씨앗 사기';
    bar.appendChild(hint);
    return;
  }
  items.slice(0, 9).forEach((item, idx) => {
    const { icon, label } = itemIcon(item);
    const slot = document.createElement('div');
    slot.className = 'slot' + (state.selected.type === item.type && state.selected.id === item.id ? ' selected' : '');
    slot.title = label;
    slot.innerHTML = `<span class="icon">${icon}</span><span class="count">${item.count}</span><span class="num">${idx + 1}</span>`;
    slot.addEventListener('click', () => {
      state.selected = { type: item.type, id: item.id };
      renderHotbar();
    });
    bar.appendChild(slot);
  });
}

function renderShop() {
  const body = $('shop-body');
  if (state.shopTab === 'seeds') {
    const sorted = [...CROPS].sort((a, b) => RARITIES[a.rarity].order - RARITIES[b.rarity].order);
    body.innerHTML = '';
    for (const crop of sorted) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-icon">${cropIcon(crop)}</div>
        <div class="card-info">
          <div class="card-name">${crop.name}
            <span class="rarity-badge r-${crop.rarity}">${RARITIES[crop.rarity].name}</span>
          </div>
          <div class="env-tags">
            <span class="env-tag">${LIGHT_LABEL[crop.light]}</span>
            <span class="env-tag">${TEMP_LABEL[crop.temp]}</span>
            <span class="env-tag">⏱ ${crop.growTime}초</span>
            <span class="env-tag">판매 ${fmt(crop.sellPrice)} G</span>
          </div>
        </div>
        <button class="buy-btn" ${state.money < crop.seedPrice ? 'disabled' : ''}>${fmt(crop.seedPrice)} G</button>`;
      card.querySelector('.buy-btn').addEventListener('click', () => buySeed(crop.id));
      body.appendChild(card);
    }
  } else {
    body.innerHTML = '';
    for (const key of Object.keys(FACILITIES)) {
      const fac = FACILITIES[key];
      const owned = (state.bag.facilities[key] || 0) > 0;
      // 도구(물뿌리개)는 한 번만 사면 되므로 이미 갖고 있으면 구매 불가
      const alreadyOwned = fac.isTool && owned;
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-icon">${fac.icon}</div>
        <div class="card-info">
          <div class="card-name">${fac.name}</div>
          <div class="card-sub">${fac.effectText}</div>
        </div>
        <button class="buy-btn" ${state.money < fac.price || alreadyOwned ? 'disabled' : ''}>${alreadyOwned ? '구매 완료' : fmt(fac.price) + ' G'}</button>`;
      card.querySelector('.buy-btn').addEventListener('click', () => buyFacility(fac.id));
      body.appendChild(card);
    }
  }
}

function renderBag() {
  const body = $('bag-body');
  body.innerHTML = '';

  // 작물 (판매 가능)
  const cropIds = Object.keys(state.bag.crops).filter((id) => state.bag.crops[id] > 0);
  if (cropIds.length > 0) {
    const h = document.createElement('h3');
    h.className = 'bag-section';
    h.textContent = '🌾 수확한 작물';
    body.appendChild(h);
    for (const id of cropIds) {
      const crop = cropById(id);
      const n = state.bag.crops[id];
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-icon">${cropIcon(crop)}</div>
        <div class="card-info">
          <div class="card-name">${crop.name} ×${n}
            <span class="rarity-badge r-${crop.rarity}">${RARITIES[crop.rarity].name}</span>
          </div>
          <div class="card-sub">개당 ${fmt(crop.sellPrice)} G</div>
        </div>
        <button class="buy-btn sell-btn">판매 ${fmt(crop.sellPrice * n)} G</button>`;
      card.querySelector('.sell-btn').addEventListener('click', () => sellCrops(id));
      body.appendChild(card);
    }
    const sellAll = document.createElement('button');
    sellAll.className = 'big-btn';
    sellAll.style.width = '100%';
    sellAll.style.fontSize = 'clamp(14px, 2vw, 18px)';
    sellAll.textContent = '💰 전체 판매';
    sellAll.addEventListener('click', sellAllCrops);
    body.appendChild(sellAll);
  } else {
    const p = document.createElement('p');
    p.className = 'bag-empty';
    p.textContent = '수확한 작물이 없어요. 작물을 키워보자!';
    body.appendChild(p);
  }

  // 씨앗 & 설비 목록
  const seedIds = Object.keys(state.bag.seeds).filter((id) => state.bag.seeds[id] > 0);
  const facIds = Object.keys(state.bag.facilities).filter((id) => state.bag.facilities[id] > 0);
  if (seedIds.length + facIds.length > 0) {
    const h = document.createElement('h3');
    h.className = 'bag-section';
    h.textContent = '🎒 보유 아이템';
    body.appendChild(h);
    for (const id of seedIds) {
      const crop = cropById(id);
      const item = document.createElement('div');
      item.className = 'card';
      item.innerHTML = `<div class="card-icon">${cropIcon(crop)}</div>
        <div class="card-info"><div class="card-name">${crop.name} 씨앗 ×${state.bag.seeds[id]}</div>
        <div class="card-sub">빈 밭을 클릭해 심기 · ${LIGHT_LABEL[crop.light]} · ${TEMP_LABEL[crop.temp]}</div></div>`;
      body.appendChild(item);
    }
    for (const id of facIds) {
      const fac = facById(id);
      const item = document.createElement('div');
      item.className = 'card';
      const useText = fac.isTool
        ? '작물이 심긴 밭을 클릭해 물주기 (없어지지 않는 도구)'
        : '밭을 클릭해 설치 (기존 설비는 교체됨)';
      item.innerHTML = `<div class="card-icon">${fac.icon}</div>
        <div class="card-info"><div class="card-name">${fac.name} ×${state.bag.facilities[id]}</div>
        <div class="card-sub">${useText}</div></div>`;
      body.appendChild(item);
    }
  }
}

function cropIcon(crop) {
  return { lettuce: '🥬', carrot: '🥕', spinach: '🥬', potato: '🥔', tomato: '🍅',
           strawberry: '🍓', chili: '🌶', blueberry: '🫐', watermelon: '🍉', dragonfruit: '🐉' }[crop.id] || '🌱';
}

function renderGuide() {
  const body = $('guide-body');
  body.innerHTML = `
    <div class="guide-intro">
      <h3>🔬 환경이 성장 속도를 바꾼다!</h3>
      작물마다 필요한 <b>빛(양지·음지)</b>과 <b>온도(따뜻함·서늘함)</b>이 다르다.<br>
      밭 칸에 맞는 설비를 설치하면 성장 속도 <b style="color:#2e7d1f">100%</b>,
      환경이 안 맞으면 <b style="color:#c0392b">45%</b>(온실 안의 서늘한 작물은 60%)로 느려진다.
      환경이 안 맞아도 작물은 자라지만, 훨씬 오래 걸린다!
    </div>`;

  const sorted = [...CROPS].sort((a, b) => RARITIES[a.rarity].order - RARITIES[b.rarity].order);
  for (const crop of sorted) {
    const el = document.createElement('div');
    el.className = 'guide-crop';
    el.innerHTML = `
      <div class="g-head">
        <span>${cropIcon(crop)}</span>
        <span>${crop.name}</span>
        <span class="rarity-badge r-${crop.rarity}">${RARITIES[crop.rarity].name}</span>
        <span class="env-tag">씨앗 ${fmt(crop.seedPrice)} G</span>
        <span class="env-tag">판매 ${fmt(crop.sellPrice)} G</span>
        <span class="env-tag">⏱ ${crop.growTime}초</span>
        <span class="env-tag">${LIGHT_LABEL[crop.light]}</span>
        <span class="env-tag">${TEMP_LABEL[crop.temp]}</span>
      </div>
      <div class="g-science"><b>과학 원리 🔬</b> ${crop.science}</div>`;
    body.appendChild(el);
  }

  const facH = document.createElement('h3');
  facH.className = 'bag-section';
  facH.textContent = '🏗 설비 도감';
  body.appendChild(facH);
  for (const key of Object.keys(FACILITIES)) {
    const fac = FACILITIES[key];
    const el = document.createElement('div');
    el.className = 'guide-fac';
    el.innerHTML = `<h4>${fac.icon} ${fac.name} — ${fmt(fac.price)} G</h4>
      <p>${fac.effectText}</p>
      <p style="margin-top:4px"><b>과학 원리 🔬</b> ${fac.science}</p>`;
    body.appendChild(el);
  }
}

/* ---------------- 모달 제어 ---------------- */
function openModal(name) {
  closeModal();
  state.modalOpen = name;
  $('modal-' + name).classList.remove('hidden');
  if (name === 'shop') renderShop();
  if (name === 'bag') renderBag();
  if (name === 'guide') renderGuide();
}
function closeModal() {
  state.modalOpen = null;
  for (const m of ['shop', 'bag', 'guide']) $('modal-' + m).classList.add('hidden');
}

/* ---------------- 입력 ---------------- */
const keys = {};
const mouse = { x: 0, y: 0, wx: 0, wy: 0, overPlot: -1 };

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (!state.started) return;
  if (e.code === 'KeyE') state.modalOpen === 'shop' ? closeModal() : openModal('shop');
  if (e.code === 'KeyI') state.modalOpen === 'bag' ? closeModal() : openModal('bag');
  if (e.code === 'KeyG') state.modalOpen === 'guide' ? closeModal() : openModal('guide');
  if (e.code === 'Escape') closeModal();
  if (e.code === 'Space' && !state.modalOpen) {
    e.preventDefault();
    const i = nearestPlotInRange();
    if (i >= 0) tryActOnPlot(i);
    else toast('근처에 밭이 없어요.', 'bad');
  }
  if (/^Digit[1-9]$/.test(e.code)) {
    const idx = parseInt(e.code.slice(5)) - 1;
    const items = hotbarItems();
    if (items[idx]) {
      state.selected = { type: items[idx].type, id: items[idx].id };
      renderHotbar();
    }
  }
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

function canvasToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (WORLD_W / rect.width),
    y: (e.clientY - rect.top) * (WORLD_H / rect.height),
  };
}

canvas.addEventListener('mousemove', (e) => {
  const p = canvasToWorld(e);
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.wx = p.x; mouse.wy = p.y;
  mouse.overPlot = plotAtPoint(p.x, p.y);
  updatePlotTip();
});
canvas.addEventListener('mouseleave', () => { mouse.overPlot = -1; updatePlotTip(); });
canvas.addEventListener('click', (e) => {
  if (!state.started || state.modalOpen) return;
  const p = canvasToWorld(e);
  const i = plotAtPoint(p.x, p.y);
  if (i >= 0) tryActOnPlot(i);
});

function nearestPlotInRange() {
  let best = -1;
  let bestD = INTERACT_RANGE;
  for (let i = 0; i < state.plots.length; i++) {
    const r = plotRect(i);
    const d = dist(player.x, player.y, r.cx, r.cy);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/* ---------------- 밭 정보 팁 ---------------- */
function updatePlotTip() {
  const tip = $('plot-tip');
  if (mouse.overPlot < 0 || !state.started) { tip.classList.add('hidden'); return; }
  const plot = state.plots[mouse.overPlot];
  const r = plotRect(mouse.overPlot);
  let html = '';
  if (plot.crop) {
    const info = plotSpeedInfo(plot);
    const pct = Math.min(100, Math.floor(plot.progress * 100));
    const speedCls = info.mult >= 1 ? 'speed-100' : 'speed-slow';
    const envOk = info.mult >= 1;
    const waterHtml = info.waterLeft > 0
      ? `<div>💧 물주기 효과 중 (남은 ${info.waterLeft}초)</div>`
      : '';
    html = `<div class="tip-title">${cropById(plot.crop).name} ${plot.progress >= 1 ? '✅ 수확 가능!' : ''}</div>
      <div>성장 ${pct}%</div>
      <div>속도 <span class="${speedCls}">${info.pct}%</span> ${envOk ? '😊 환경 최적' : '😟 환경 안 맞음'}</div>
      ${waterHtml}`;
  } else {
    const facName = plot.facility ? facById(plot.facility).name : '없음';
    html = `<div class="tip-title">빈 밭</div><div>설비: ${facName}</div>`;
  }
  tip.innerHTML = html;
  tip.classList.remove('hidden');

  const wrap = $('game-wrap').getBoundingClientRect();
  tip.style.left = clamp(mouse.x - wrap.left - 120, 8, wrap.width - 250) + 'px';
  tip.style.top = clamp(mouse.y - wrap.top - 110, 8, wrap.height - 120) + 'px';
}

/* ---------------- 파티클 ---------------- */
const particles = [];
function emitParticles(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 120,
      vy: -Math.random() * 140 - 40,
      life: 0.6 + Math.random() * 0.3,
      maxLife: 0.9,
      color, size: 3 + Math.random() * 3,
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/* ---------------- 그리기: 배경 ---------------- */
const rand = seededRandom(42);
// 미리 만들어 둔 장식 위치 (그림자 없는 결정적 배치)
const grassTufts = [];
const flowers = [];
const trees = [];
{
  const r1 = seededRandom(7);
  for (let i = 0; i < 70; i++) {
    const x = 20 + r1() * (WORLD_W - 40);
    const y = 20 + r1() * (WORLD_H - 40);
    // 밭 영역 안쪽은 제외
    if (x > GRID.x0 - 20 && x < GRID.x0 + GRID.width + 20 && y > GRID.y0 - 20 && y < GRID.y0 + GRID.height + 20) continue;
    grassTufts.push({ x, y });
  }
  const r2 = seededRandom(13);
  for (let i = 0; i < 18; i++) {
    const x = 30 + r2() * (WORLD_W - 60);
    const y = 20 + r2() * (WORLD_H - 40);
    if (x > GRID.x0 - 24 && x < GRID.x0 + GRID.width + 24 && y > GRID.y0 - 24 && y < GRID.y0 + GRID.height + 24) continue;
    const colors = ['#f5e14a', '#f58fd0', '#f5f5f5', '#b89df0'];
    flowers.push({ x, y, c: colors[Math.floor(r2() * colors.length)] });
  }
  const r3 = seededRandom(99);
  for (let i = 0; i < 5; i++) trees.push({ x: 70 + i * 205 + r3() * 30, y: 40 + r3() * 18 });
}

function drawBackground() {
  // 잔디
  ctx.fillStyle = '#79b657';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  const r = seededRandom(5);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(r() * (WORLD_W / 8)) * 8;
    const y = Math.floor(r() * (WORLD_H / 8)) * 8;
    ctx.fillStyle = r() > 0.5 ? '#6ea94f' : '#83c05f';
    ctx.fillRect(x, y, 8, 8);
  }
  // 잔디 다발
  for (const t of grassTufts) {
    ctx.fillStyle = '#4f8f38';
    ctx.fillRect(t.x, t.y, 3, 6);
    ctx.fillRect(t.x + 4, t.y + 2, 3, 5);
  }
  // 꽃
  for (const f of flowers) {
    ctx.fillStyle = '#4f8f38';
    ctx.fillRect(f.x + 2, f.y + 3, 2, 5);
    ctx.fillStyle = f.c;
    ctx.fillRect(f.x, f.y, 6, 4);
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(f.x + 2, f.y + 1, 2, 2);
  }
}

function drawFence() {
  const post = (x, y) => {
    ctx.fillStyle = '#9a6b3f';
    ctx.fillRect(x, y, 8, 22);
    ctx.fillStyle = '#7d5430';
    ctx.fillRect(x, y + 16, 8, 6);
  };
  const rail = (x1, y1, x2, y2) => {
    ctx.fillStyle = '#b98756';
    const horiz = Math.abs(x2 - x1) > Math.abs(y2 - y1);
    if (horiz) {
      ctx.fillRect(x1, y1 - 10, x2 - x1, 5);
      ctx.fillRect(x1, y1 - 2, x2 - x1, 5);
    } else {
      ctx.fillRect(x1 - 10, y1, 5, y2 - y1);
      ctx.fillRect(x1 - 2, y1, 5, y2 - y1);
    }
  };
  rail(FENCE.left, FENCE.top, FENCE.right, FENCE.top);
  rail(FENCE.left, FENCE.bottom, FENCE.right, FENCE.bottom);
  rail(FENCE.left, FENCE.top, FENCE.left, FENCE.bottom);
  rail(FENCE.right, FENCE.top, FENCE.right, FENCE.bottom);
  for (let x = FENCE.left; x <= FENCE.right; x += 60) {
    post(x, FENCE.top - 12);
    post(x, FENCE.bottom - 10);
  }
  for (let y = FENCE.top; y <= FENCE.bottom; y += 60) {
    post(FENCE.left - 12, y);
    post(FENCE.right - 12, y);
  }
}

function drawTrees() {
  for (const t of trees) {
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(t.x - 4, t.y + 10, 8, 14);
    ctx.fillStyle = '#3f7d32';
    ctx.fillRect(t.x - 20, t.y - 12, 40, 26);
    ctx.fillStyle = '#4f9440';
    ctx.fillRect(t.x - 14, t.y - 16, 28, 20);
    ctx.fillStyle = '#5aa84c';
    ctx.fillRect(t.x - 8, t.y - 20, 16, 12);
  }
}

function drawSign() {
  const x = 70, y = 560;
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(x, y, 8, 26);
  ctx.fillStyle = '#b98756';
  ctx.fillRect(x - 44, y - 26, 96, 30);
  ctx.fillStyle = '#7d5430';
  ctx.fillRect(x - 40, y - 22, 88, 22);
  ctx.font = '13px Galmuri11, sans-serif';
  ctx.fillStyle = '#ffe9b8';
  ctx.textAlign = 'center';
  ctx.fillText('🌱 스마트팜', x + 4, y - 7);
  ctx.textAlign = 'left';
}

/* ---------------- 그리기: 밭 ---------------- */
function drawSoil(r, wet = false) {
  ctx.fillStyle = '#6d4520';
  ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
  ctx.fillStyle = wet ? '#6b431c' : '#8a5a2b'; // 젖은 흙은 더 어두운 갈색
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const rSoil = seededRandom(r.x * 31 + r.y);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = wet ? (rSoil() > 0.5 ? '#5a3818' : '#734e24') : (rSoil() > 0.5 ? '#7a4c22' : '#96632f');
    ctx.fillRect(r.x + 4 + Math.floor(rSoil() * (r.w - 12)), r.y + 4 + Math.floor(rSoil() * (r.h - 12)), 6, 4);
  }
  if (wet) {
    // 물이 고인 듯한 은은한 파란빛
    ctx.fillStyle = 'rgba(90, 160, 220, 0.10)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

function drawFacilityBase(i, facId) {
  // 설비 받침 (작물 아래 그려지는 부분)
  const r = plotRect(i);
  if (facId === 'sunLight') {
    // 램프 기둥
    ctx.fillStyle = '#5d6d7e';
    ctx.fillRect(r.x + r.w - 14, r.y + 6, 5, 40);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(r.x + r.w - 20, r.y + 2, 17, 10);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(r.x + r.w - 16, r.y + 4, 9, 6);
  } else if (facId === 'shadeSheet') {
    // 차광 기둥 4개
    ctx.fillStyle = '#6b4a2a';
    for (const [dx, dy] of [[2, 2], [r.w - 8, 2], [2, r.h - 8], [r.w - 8, r.h - 8]]) {
      ctx.fillRect(r.x + dx, r.y + dy, 6, 6);
    }
  } else if (facId === 'greenhouse') {
    // 온실 흙 바닥 테두리
    ctx.fillStyle = '#b98756';
    ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, 4);
  }
}

function drawFacilityCover(i, facId) {
  // 설비 덮개 (작물 위에 그려지는 부분)
  const r = plotRect(i);
  if (facId === 'sunLight') {
    ctx.fillStyle = 'rgba(255, 224, 100, 0.16)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // 빛 반짝이
    ctx.fillStyle = 'rgba(255, 240, 150, 0.7)';
    const t = (performance.now() / 400) % (Math.PI * 2);
    const sx = r.x + 14 + Math.sin(t) * 10;
    ctx.fillRect(sx, r.y + 10, 4, 4);
  } else if (facId === 'shadeSheet') {
    ctx.fillStyle = 'rgba(58, 44, 96, 0.38)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#8b7fd4';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    ctx.fillStyle = '#8b7fd4';
    ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, 4);
  } else if (facId === 'greenhouse') {
    ctx.fillStyle = 'rgba(170, 225, 240, 0.30)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#e8f8ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    // 유리 창살
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let gx = 1; gx < 3; gx++) {
      ctx.beginPath();
      ctx.moveTo(r.x + (r.w / 3) * gx, r.y);
      ctx.lineTo(r.x + (r.w / 3) * gx, r.y + r.h);
      ctx.stroke();
    }
    // 온도 표시
    ctx.font = '12px Galmuri11, sans-serif';
    ctx.fillStyle = '#e05555';
    ctx.fillText('🔥', r.x + 5, r.y + 14);
  }
}

/* ---------------- 그리기: 작물 ---------------- */
const P = 4; // 픽셀 단위

function drawCrop(i, plot) {
  const crop = cropById(plot.crop);
  const r = plotRect(i);
  const cx = r.cx;
  const baseY = r.y + r.h - 8;
  const g = Math.min(1, plot.progress);
  const ready = plot.progress >= 1;

  // 새싹 단계
  if (g < 0.22) {
    ctx.fillStyle = '#6ecf6e';
    ctx.fillRect(cx - 2, baseY - 8, 4, 8);
    ctx.fillRect(cx - 6, baseY - 6, 4, 4);
    ctx.fillRect(cx + 2, baseY - 10, 4, 4);
    return;
  }

  const c = crop.colors;
  const s = 0.45 + g * 0.55; // 크기 배율

  if (crop.shape === 'leafy') {
    const leafW = Math.round(10 * s), leafH = Math.round(8 * s);
    const positions = [[-16, 0], [0, -4], [16, 0], [-8, -10], [8, -10], [0, -18]];
    positions.forEach(([dx, dy], idx) => {
      if (g < 0.5 && idx >= 4) return;
      ctx.fillStyle = idx % 2 ? c.leaf2 : c.leaf;
      ctx.fillRect(cx + dx - leafW / 2, baseY - 12 + dy - leafH / 2, leafW, leafH);
    });
    if (ready) { ctx.fillStyle = c.accent; ctx.fillRect(cx - 2, baseY - 28, 4, 4); }
  } else if (crop.shape === 'root') {
    // 잎
    const leafH = Math.round(14 * s);
    for (const dx of [-10, -3, 4, 11]) {
      ctx.fillStyle = c.leaf;
      ctx.fillRect(cx + dx, baseY - leafH, 4, leafH);
      ctx.fillStyle = c.leaf2;
      ctx.fillRect(cx + dx + (dx < 0 ? -2 : 4), baseY - leafH + 3, 3, 5);
    }
    // 뿌리 끝이 올라옴
    if (g > 0.65) {
      const rh = Math.round((g - 0.65) * 40);
      ctx.fillStyle = c.accent;
      ctx.fillRect(cx - 6, baseY - rh, 12, rh + 2);
      ctx.fillStyle = c.leaf2;
      ctx.fillRect(cx - 2, baseY - rh + 3, 4, 3);
    }
  } else if (crop.shape === 'bush') {
    const bw = Math.round(26 * s), bh = Math.round(22 * s);
    ctx.fillStyle = '#5d3a17';
    ctx.fillRect(cx - 2, baseY - 8, 4, 8);
    ctx.fillStyle = c.leaf;
    ctx.fillRect(cx - bw / 2, baseY - 8 - bh, bw, bh);
    ctx.fillStyle = c.leaf2;
    ctx.fillRect(cx - bw / 2 + 3, baseY - 8 - bh + 3, 6, 6);
    ctx.fillRect(cx + bw / 2 - 10, baseY - 8 - bh + 6, 7, 6);
    // 열매
    if (g > 0.72) {
      const n = ready ? 4 : 2;
      const spots = [[-8, -6], [4, -10], [-1, -2], [8, -4]];
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = c.accent;
        ctx.fillRect(cx + spots[k][0] - 3, baseY - bh + spots[k][1], 6, 6);
      }
    }
  } else if (crop.shape === 'vine') {
    const spread = Math.round(20 + 26 * s);
    ctx.fillStyle = c.leaf2;
    ctx.fillRect(cx - 2, baseY - 6, 4, 6);
    // 덩굴 줄기
    ctx.fillStyle = '#3d7a34';
    ctx.fillRect(cx - spread, baseY - 4, spread * 2, 3);
    for (const dx of [-spread + 4, -spread / 2, 0, spread / 2 - 4, spread - 8]) {
      ctx.fillStyle = c.leaf;
      ctx.fillRect(cx + dx, baseY - 14, 8, 8);
    }
    // 큰 열매
    if (g > 0.75) {
      const fs = Math.round(6 + (g - 0.75) * 28);
      ctx.fillStyle = c.accent;
      ctx.fillRect(cx + spread / 2 - fs / 2, baseY - 6 - fs, fs, fs);
      ctx.fillStyle = '#2c7138';
      ctx.fillRect(cx + spread / 2 - fs / 2 + 2, baseY - 6 - fs, fs - 4, 4);
      ctx.fillStyle = '#e8f8ff';
      ctx.fillRect(cx + spread / 2 - fs / 2 + 3, baseY - 2 - fs, 3, 3);
    }
  } else if (crop.shape === 'cactus') {
    const h = Math.round(10 + 26 * s);
    ctx.fillStyle = c.leaf;
    ctx.fillRect(cx - 5, baseY - h, 10, h);
    ctx.fillStyle = c.leaf2;
    ctx.fillRect(cx + 5, baseY - h + 8, 8, 5);
    ctx.fillRect(cx + 13, baseY - h + 2, 5, 12);
    ctx.fillRect(cx - 13, baseY - h + 12, 8, 5);
    ctx.fillRect(cx - 18, baseY - h + 6, 5, 12);
    ctx.fillStyle = '#e8f8ff';
    ctx.fillRect(cx - 3, baseY - h + 3, 2, 2);
    ctx.fillRect(cx + 1, baseY - h + 8, 2, 2);
    if (ready) {
      ctx.fillStyle = c.accent;
      ctx.fillRect(cx - 4, baseY - h - 8, 8, 8);
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(cx - 1, baseY - h - 5, 3, 3);
    }
  }
}

function drawPlotOverlays(i, plot) {
  const r = plotRect(i);
  // 진행도 바
  if (plot.crop && plot.progress < 1) {
    const info = plotSpeedInfo(plot);
    const bw = r.w - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(r.x + 5, r.y + r.h - 8, bw, 6);
    ctx.fillStyle = info.mult >= 1 ? '#58d94a' : '#f5a83c';
    ctx.fillRect(r.x + 5, r.y + r.h - 8, Math.round(bw * plot.progress), 6);
  }
  // 물주기 효과 표시 (💧 + 남은 시간 막대)
  if (plot.crop && isWatered(plot)) {
    const left = clamp((plot.wateredUntil - gameTime) / WATER.duration, 0, 1);
    ctx.font = '13px Galmuri11, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('💧', r.x + r.w - 20, r.y + 16);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(r.x + r.w - 32, r.y + 22, 24, 4);
    ctx.fillStyle = '#5ab8f0';
    ctx.fillRect(r.x + r.w - 32, r.y + 22, Math.round(24 * left), 4);
  }

  // 수확 가능 표시
  if (plot.crop && plot.progress >= 1) {
    const bob = Math.sin(performance.now() / 200) * 3;
    ctx.font = 'bold 20px Galmuri11, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#2e7d1f';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.strokeText('✨', r.cx, r.y + 14 + bob);
    ctx.fillText('✨', r.cx, r.y + 14 + bob);
    ctx.textAlign = 'left';
  }
}

/* ---------------- 그리기: 캐릭터 ---------------- */
function drawPlayer() {
  const px = Math.round(player.x);
  const py = Math.round(player.y);
  const step = Math.floor(player.walkPhase) % 2;
  const bob = player.moving ? (step ? -2 : 0) : 0;

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(px - 12, py + 2, 24, 6);

  const legY = py - 8;
  // 다리
  ctx.fillStyle = '#4a3218';
  if (player.moving && step) {
    ctx.fillRect(px - 9, legY, 7, 9);
    ctx.fillRect(px + 3, legY - 2, 7, 9);
  } else if (player.moving) {
    ctx.fillRect(px - 9, legY - 2, 7, 9);
    ctx.fillRect(px + 3, legY, 7, 9);
  } else {
    ctx.fillRect(px - 9, legY, 7, 9);
    ctx.fillRect(px + 3, legY, 7, 9);
  }
  // 몸통 (멜빵바지)
  const bodyY = py - 24 + bob;
  ctx.fillStyle = '#3d78c9';
  ctx.fillRect(px - 11, bodyY, 22, 17);
  ctx.fillStyle = '#3366ad';
  ctx.fillRect(px - 11, bodyY + 13, 22, 4);
  // 멜빵
  ctx.fillStyle = '#3366ad';
  ctx.fillRect(px - 8, bodyY, 4, 5);
  ctx.fillRect(px + 4, bodyY, 4, 5);
  // 팔
  ctx.fillStyle = '#f5c99b';
  if (player.dir === 'left' || player.dir === 'right') {
    const armX = player.dir === 'left' ? px - 15 : px + 11;
    ctx.fillRect(armX, bodyY + 3 + (player.moving && step ? 2 : 0), 4, 11);
  } else {
    ctx.fillRect(px - 15, bodyY + 3, 4, 11);
    ctx.fillRect(px + 11, bodyY + 3, 4, 11);
  }
  // 머리
  const headY = py - 38 + bob;
  ctx.fillStyle = '#f5c99b';
  ctx.fillRect(px - 9, headY, 18, 14);
  // 머리카락 (뒷모습일 때 더 많이)
  ctx.fillStyle = '#6b4a2a';
  if (player.dir === 'up') ctx.fillRect(px - 9, headY, 18, 10);
  else ctx.fillRect(px - 9, headY, 18, 4);
  // 얼굴
  if (player.dir !== 'up') {
    ctx.fillStyle = '#2a2a2a';
    if (player.dir === 'down') {
      ctx.fillRect(px - 5, headY + 6, 3, 3);
      ctx.fillRect(px + 2, headY + 6, 3, 3);
      ctx.fillStyle = '#d98a6a';
      ctx.fillRect(px - 2, headY + 11, 4, 2);
    } else if (player.dir === 'left') {
      ctx.fillRect(px - 6, headY + 6, 3, 3);
    } else {
      ctx.fillRect(px + 3, headY + 6, 3, 3);
    }
  }
  // 짚모자
  ctx.fillStyle = '#f5d03c';
  ctx.fillRect(px - 13, headY - 2, 26, 4);
  ctx.fillRect(px - 8, headY - 8, 16, 7);
  ctx.fillStyle = '#d9b52e';
  ctx.fillRect(px - 8, headY - 4, 16, 3);
}

/* ---------------- 업데이트 & 렌더 ---------------- */
function update(dt) {
  if (state.started && !state.modalOpen) {
    let dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.KeyA) dx -= 1;
    if (keys.ArrowRight || keys.KeyD) dx += 1;
    if (keys.ArrowUp || keys.KeyW) dy -= 1;
    if (keys.ArrowDown || keys.KeyS) dy += 1;
    player.moving = dx !== 0 || dy !== 0;
    if (player.moving) {
      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
      player.x = clamp(player.x + dx * player.speed * dt, FENCE.left + 16, FENCE.right - 16);
      player.y = clamp(player.y + dy * player.speed * dt, FENCE.top + 30, FENCE.bottom + 6);
      if (Math.abs(dx) > Math.abs(dy)) player.dir = dx < 0 ? 'left' : 'right';
      else if (dy !== 0) player.dir = dy < 0 ? 'up' : 'down';
      player.walkPhase += dt * 10;
    }
  }

  gameTime += dt;

  // 작물 성장 (환경 배율 × 물주기 배율)
  for (const plot of state.plots) {
    if (plot.crop && plot.progress < 1) {
      const crop = cropById(plot.crop);
      const mult = envMultiplier(crop, plot.facility) * (isWatered(plot) ? WATER.boost : 1);
      plot.progress += (dt / crop.growTime) * mult;
      if (plot.progress >= 1) {
        plot.progress = 1;
        const r = plotRect(state.plots.indexOf(plot));
        emitParticles(r.cx, r.cy - 10, '#fff3b0', 6);
      }
    }
  }

  updateParticles(dt);
}

function render() {
  drawBackground();
  drawTrees();
  drawFence();
  drawSign();

  // 밭 (바닥 → 작물 → 설비 덮개 → 오버레이)
  for (let i = 0; i < state.plots.length; i++) {
    const plot = state.plots[i];
    const r = plotRect(i);
    drawSoil(r, isWatered(plot));
    if (plot.facility) drawFacilityBase(i, plot.facility);
    if (plot.crop) drawCrop(i, plot);
    if (plot.facility) drawFacilityCover(i, plot.facility);
    drawPlotOverlays(i, plot);
  }

  drawPlayer();
  drawParticles();
}

/* ---------------- 게임 루프 ---------------- */
const TICK = 1000 / 60;
let lastTime = 0;
let accumulator = 0;
let rafId = null;

let fpsFrames = 0, fpsLast = performance.now();
function updateFPS() {
  fpsFrames++;
  const now = performance.now();
  if (now - fpsLast >= 1000) {
    $('fps').textContent = 'FPS ' + Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsFrames = 0;
    fpsLast = now;
  }
}

function gameLoop(timestamp) {
  rafId = requestAnimationFrame(gameLoop);
  if (!lastTime) lastTime = timestamp;
  let delta = timestamp - lastTime;
  lastTime = timestamp;
  delta = Math.min(delta, 100);
  accumulator += delta;
  while (accumulator >= TICK) {
    update(TICK / 1000);
    accumulator -= TICK;
  }
  render();
  updateFPS();
}

/* ---------------- 테스트 훅 ---------------- */
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / TICK));
  for (let i = 0; i < steps; i++) update(TICK / 1000);
  render();
};

window.render_game_to_text = () => JSON.stringify({
  note: '원점(0,0)은 좌측 상단, x는 오른쪽으로 증가, y는 아래로 증가. 플레이어는 x,y 중심점(발 근처).',
  money: state.money,
  started: state.started,
  selected: state.selected,
  player: { x: Math.round(player.x), y: Math.round(player.y), dir: player.dir },
  bag: {
    seeds: { ...state.bag.seeds },
    crops: { ...state.bag.crops },
    facilities: { ...state.bag.facilities },
  },
  plots: state.plots.map((p, i) => {
    const r = plotRect(i);
    const info = p.crop ? plotSpeedInfo(p) : null;
    return {
      i, x: r.x, y: r.y,
      crop: p.crop || null,
      progress: p.crop ? Math.round(p.progress * 100) : 0,
      ready: !!(p.crop && p.progress >= 1),
      speedPct: info ? info.pct : null,
      watered: isWatered(p),
      waterLeftSec: isWatered(p) ? Math.ceil(p.wateredUntil - gameTime) : 0,
      facility: p.facility || null,
    };
  }),
});

/* ---------------- UI 이벤트 연결 ---------------- */
$('btn-shop').addEventListener('click', () => openModal('shop'));
$('btn-bag').addEventListener('click', () => openModal('bag'));
$('btn-guide').addEventListener('click', () => openModal('guide'));

for (const btn of document.querySelectorAll('.close-btn')) {
  btn.addEventListener('click', () => closeModal());
}
for (const m of ['modal-shop', 'modal-bag', 'modal-guide']) {
  $(m).addEventListener('click', (e) => { if (e.target === $(m)) closeModal(); });
}
for (const tab of document.querySelectorAll('#shop-tabs .tab')) {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#shop-tabs .tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.shopTab = tab.dataset.tab;
    renderShop();
  });
}

$('btn-mute').addEventListener('click', () => {
  state.muted = !state.muted;
  $('btn-mute').textContent = state.muted ? '🔇' : '🔊';
});

$('btn-start').addEventListener('click', () => {
  ensureAudio();
  startMusic();
  state.started = true;
  $('start-screen').classList.add('hidden');
  toast('상추 씨앗 3개를 선물로 드렸어요!', 'good');
  state.bag.seeds.lettuce = (state.bag.seeds.lettuce || 0) + 3;
  renderHotbar();
  updateHUD();
});

/* ---------------- 시작 ---------------- */
// 개발/디버깅용: 콘솔에서 window.farmState.money = 10000 처럼 접근 가능
window.farmState = state;
window.farmPlayer = player;

renderHotbar();
updateHUD();
rafId = requestAnimationFrame(gameLoop);
