// ══════════════════════════════════════════
//  TOTAL DURASI LIVE
// ══════════════════════════════════════════
function updateTotalDuration() {
    const el = document.getElementById('totalDurationDisplay');
    if (!el) return;
    const total = Object.values(memberDurations).reduce((a, b) => a + b, 0);
    el.textContent = `Total: ${total.toFixed(1)}s`;
}

// ══════════════════════════════════════════
//  PHOTO HELPER
// ══════════════════════════════════════════
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            const MAX = 256;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(objectUrl);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Gagal memuat gambar')); };
        img.src = objectUrl;
    });
}

function savePhotoCache() {
    localStorage.setItem('linedistro_photos', JSON.stringify(memberPhotos));
}
function loadPhotoCache() {
    const raw = localStorage.getItem('linedistro_photos');
    if (!raw) return;
    const cached = JSON.parse(raw);
    Object.entries(cached).forEach(([n, url]) => {
        if (url && !url.startsWith('blob:')) memberPhotos[n] = url;
    });
}

function showFileName(input, labelId, defaultText) {
    const label = document.getElementById(labelId);
    if (!label) return;
    const file = input.files[0];
    const text = file ? `📄 ${file.name.length > 24 ? file.name.substring(0,22)+'…' : file.name}` : defaultText;
    let span = label.querySelector('.file-label-text');
    if (!span) {
        span = document.createElement('span');
        span.className = 'file-label-text';
        const textNodes = Array.from(label.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
        textNodes.forEach(n => n.remove());
        label.insertBefore(span, label.firstChild);
    }
    span.textContent = text;
}

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
const memberList = document.getElementById('memberList');
let memberDurations = {}, memberColors = {}, memberPhotos = {};
let memberIntervals = {};
let chartInstance = null;

// ══════════════════════════════════════════
//  TOAST & CONFIRM & PROMPT
// ══════════════════════════════════════════
let _undoTimer = null, _undoCallback = null;
function showUndoToast(msg, onUndo, duration = 3000) {
    const t = document.getElementById('toast');
    t.innerHTML = `<span>${msg}</span><button class="toast-undo-btn" onclick="triggerUndo()">Undo</button>`;
    t.style.display = 'flex'; t.style.alignItems = 'center'; t.style.gap = '12px';
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._timer);
    if (_undoTimer) clearTimeout(_undoTimer);
    _undoCallback = onUndo;
    _undoTimer = setTimeout(() => {
        _undoCallback = null;
        t.classList.remove('show');
        setTimeout(() => { t.style.display = 'none'; t.innerHTML = ''; }, 300);
    }, duration);
}
function triggerUndo() {
    clearTimeout(_undoTimer);
    const cb = _undoCallback;
    _undoCallback = null;
    const t = document.getElementById('toast');
    t.classList.remove('show');
    setTimeout(() => { t.style.display = 'none'; t.innerHTML = ''; }, 300);
    if (cb) cb();
}
function showToast(msg, duration = 2800) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.style.display = 'none', 300);
    }, duration);
}

let _confirmCallback = null;
function showConfirm({ icon = '⚠️', title = 'Konfirmasi', msg = '', okLabel = 'Ya', okClass = 'btn-danger', onOk }) {
    document.getElementById('confirmIcon').textContent = icon;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    const okBtn = document.getElementById('confirmOkBtn');
    okBtn.textContent = okLabel;
    okBtn.className = okClass;
    _confirmCallback = onOk;
    document.getElementById('confirmModal').style.display = 'flex';
}
function closeConfirm() {
    document.getElementById('confirmModal').style.display = 'none';
    _confirmCallback = null;
}
function confirmOk() {
    document.getElementById('confirmModal').style.display = 'none';
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
}
document.getElementById('confirmOkBtn').addEventListener('click', confirmOk);

let _promptCallback = null;
function showPrompt({ icon = '✏️', title = '', sub = '', placeholder = '', onOk }) {
    document.getElementById('promptTitle').textContent = title;
    document.getElementById('promptSub').textContent = sub;
    const inp = document.getElementById('promptInput');
    inp.placeholder = placeholder;
    inp.value = '';
    _promptCallback = onOk;
    document.getElementById('promptModal').style.display = 'flex';
    setTimeout(() => inp.focus(), 100);
}
function closePrompt() {
    document.getElementById('promptModal').style.display = 'none';
    _promptCallback = null;
}
function confirmPrompt() {
    const val = document.getElementById('promptInput').value.trim();
    if (!val) { showToast('⚠️ Name cannot be empty'); return; }
    closePrompt();
    if (_promptCallback) _promptCallback(val);
}
document.getElementById('promptInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmPrompt();
    if (e.key === 'Escape') closePrompt();
});

// ══════════════════════════════════════════
//  1. RENDER MEMBER STRIP
// ══════════════════════════════════════════
const memberStrip = document.getElementById('memberStrip');

function renderStripItem(n, c, p, index) {
    const item = document.createElement('div');
    item.className = 'strip-item';
    item.dataset.name = n;
    item.style.setProperty('--strip-color', c);
    const keyLabel = index < 9 ? index + 1 : index === 9 ? '0' : '';
    const adLabel  = index < 10 ? 'QWERTYUIOP'[index] : '';
    const keyBadge = keyLabel !== '' ? `<span class="strip-key">${keyLabel}</span>` : '';
    const adBadge  = adLabel  !== '' ? `<span class="strip-ad-key">${adLabel}</span>` : '';
    const tooltip = index < 10 ? `Hold [${keyLabel||'0'}] · Ad-Lib [${adLabel}]` : 'Hold to record';
    item.title = tooltip;
    item.innerHTML = `
        <div class="strip-avatar-wrap" id="sav-${CSS.escape(n)}">
            <img src="${p}" class="strip-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random'">
            ${keyBadge}
            ${adBadge}
        </div>
        <div class="strip-name">${n}</div>
        <div class="strip-time" id="strip-time-${CSS.escape(n)}">${(memberDurations[n]||0).toFixed(1)}s</div>
        <div class="strip-tooltip">${tooltip}</div>`;
    memberStrip.appendChild(item);

    const wrap = item.querySelector('.strip-avatar-wrap');
    const timeLabel = item.querySelector('.strip-time');
    let rippleInterval = null;

    function spawnRipple() {
        const dot = document.createElement('span');
        dot.className = 'ripple-dot';
        dot.style.width = '70px'; dot.style.height = '70px';
        dot.style.left = '50%'; dot.style.top = '50%';
        wrap.appendChild(dot);
        setTimeout(() => dot.remove(), 1100);
    }

    function startHold() {
        if (memberIntervals[n]) return;
        item.classList.add('holding');
        spawnRipple();
        rippleInterval = setInterval(spawnRipple, 550);
        const startTime = Date.now();
        const startDuration = memberDurations[n] || 0;
        let lastReorder = Date.now();
        memberIntervals[n] = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            memberDurations[n] = startDuration + elapsed;
            timeLabel.textContent = memberDurations[n].toFixed(1) + 's';
            updateLeaderboardLive();
            updateTotalDuration();
            updatePresentationLive();
            if (Date.now() - lastReorder > 600) {
                lastReorder = Date.now();
                requestAnimationFrame(() => reorderLeaderboard());
            }
        }, 50);
    }

    function stopHold() {
        if (!memberIntervals[n]) return;
        clearInterval(memberIntervals[n]);
        memberIntervals[n] = null;
        clearInterval(rippleInterval);
        rippleInterval = null;
        item.classList.remove('holding');
        const card = [...memberList.children].find(c => c.dataset.name === n);
        if (card) {
            card.classList.remove('is-active');
            void card.offsetWidth; // force reflow untuk animasi balik
        }
        reorderLeaderboard();
        updatePresentationLive();
    }

    item.addEventListener('mousedown', startHold);
    item.addEventListener('mouseup', stopHold);
    item.addEventListener('mouseleave', stopHold);
    item.addEventListener('touchstart', e => { e.preventDefault(); startHold(); }, { passive: false });
    item.addEventListener('touchend', e => { e.preventDefault(); stopHold(); }, { passive: false });
    item.addEventListener('touchcancel', stopHold);
}

function reloadMemberStrip() {
    memberStrip.innerHTML = '';
    Object.keys(memberDurations).forEach((n, i) => renderStripItem(n, memberColors[n], memberPhotos[n], i));
}

// ══════════════════════════════════════════
//  1b. LEADERBOARD
// ══════════════════════════════════════════
function renderMemberCard(n, c, p, d) {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.style.borderLeftColor = c;
    card.style.setProperty('--pulse-color', c + '66');
    card.dataset.name = n;
    card.innerHTML = `
        <div class="member-card-inner">
            <span class="rank-num">1</span>
            <img src="${p}" class="member-avatar"
                 style="border-color:${c}; box-shadow:0 0 10px 2px ${c}44;"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random'">
            <div class="member-text">
                <div class="member-name-row">
                    <span class="member-name">${n}</span>
                    <div class="member-time-wrap">
                        <span class="rec-dot"></span>
                        <span class="member-time" id="time-${CSS.escape(n)}">${d.toFixed(1)}s</span>
                    </div>
                </div>
                <div class="member-bar-wrap">
                    <div class="member-bar" id="bar-${CSS.escape(n)}"
                         style="background:linear-gradient(90deg,${c}88,${c}); width:0%;"></div>
                </div>
            </div>
            <div class="member-actions">
                <button class="btn-sm" onclick="resetMember('${n}')" title="Reset">↺</button>
                <button class="btn-sm del" onclick="confirmDeleteMember('${n}')" title="Delete">✕</button>
            </div>
        </div>`;
    return card;
}

function reloadMemberList() {
    memberList.innerHTML = '';
    const names = Object.keys(memberDurations);
    const hint = document.getElementById('emptyHint');
    hint.style.display = names.length === 0 ? 'flex' : 'none';
    const sorted = [...names].sort((a, b) => memberDurations[b] - memberDurations[a]);
    sorted.forEach(n => memberList.appendChild(renderMemberCard(n, memberColors[n], memberPhotos[n], memberDurations[n])));
    applyRankStyles();
    refreshEditDropdown();
}

function applyRankStyles() {
    const all = [...memberList.children];
    const maxDur = Math.max(...all.map(c => memberDurations[c.dataset.name] || 0), 0.001);
    all.forEach((card, i) => {
        card.classList.remove('rank-1','rank-2','rank-3');
        if (i === 0) card.classList.add('rank-1');
        if (i === 1) card.classList.add('rank-2');
        if (i === 2) card.classList.add('rank-3');
        const rankEl = card.querySelector('.rank-num');
        if (rankEl) rankEl.textContent = (i + 1);
        const n = card.dataset.name;
        const bar = card.querySelector('.member-bar');
        if (bar) {
            const pct = ((memberDurations[n] || 0) / maxDur * 100).toFixed(1);
            bar.style.width = pct + '%';
        }
    });
}

let _lastMaxDur = 0.001, _maxDurTick = 0;
function updateLeaderboardLive() {
    const all = [...memberList.children];
    if (Date.now() - _maxDurTick > 500) {
        _lastMaxDur = Math.max(...all.map(c => memberDurations[c.dataset.name] || 0), 0.001);
        _maxDurTick = Date.now();
    }
    all.forEach(card => {
        const n = card.dataset.name;
        const el = card.querySelector('.member-time');
        if (el) el.textContent = (memberDurations[n] || 0).toFixed(1) + 's';
        const isActive = !!memberIntervals[n];
        if (card.classList.contains('is-active') !== isActive) {
            card.classList.toggle('is-active', isActive);
            if (!isActive) void card.offsetWidth;
        }
        const bar = card.querySelector('.member-bar');
        if (bar) bar.style.width = ((memberDurations[n] || 0) / _lastMaxDur * 100).toFixed(1) + '%';
    });
}

function reorderLeaderboard() {
    const cards = [...memberList.children];
    if (cards.length === 0) return;
    const firstRects = new Map();
    cards.forEach(c => firstRects.set(c.dataset.name, c.getBoundingClientRect()));
    const sortedNames = Object.keys(memberDurations).sort((a,b) => memberDurations[b] - memberDurations[a]);
    sortedNames.forEach(n => {
        const card = cards.find(c => c.dataset.name === n);
        if (card) memberList.appendChild(card);
    });
    applyRankStyles();
    sortedNames.forEach(n => {
        const card = cards.find(c => c.dataset.name === n);
        if (!card) return;
        const first = firstRects.get(n);
        const last = card.getBoundingClientRect();
        if (!first) return;
        const dy = first.top - last.top;
        if (Math.abs(dy) < 1) return;
        card.style.transition = 'transform 0s';
        card.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                card.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
                card.style.transform = '';
                setTimeout(() => { card.style.transition = ''; card.style.transform = ''; }, 600);
            });
        });
    });
}

// ══════════════════════════════════════════
//  2. TAMBAH & KELOLA MEMBER
// ══════════════════════════════════════════
async function addNewMember() {
    const n = document.getElementById('memberName').value.trim();
    if (!n) { showToast('⚠️ Member name cannot be empty'); return; }
    const dup = Object.keys(memberDurations).some(k => k.toLowerCase() === n.toLowerCase());
    if (dup) { showToast(`⚠️ Member "${n}" already exists`); return; }
    const color = document.getElementById('memberColor').value;
    const f = document.getElementById('memberPhoto').files[0];
    let photoUrl;
    if (f) {
        try { photoUrl = await fileToBase64(f); } catch(err) { showToast('❌ Failed to load photo'); return; }
    } else {
        photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random&color=fff`;
    }
    memberDurations[n] = 0;
    memberColors[n] = color;
    memberPhotos[n] = photoUrl;
    document.getElementById('memberName').value = '';
    document.getElementById('memberPhoto').value = '';
    const photoLabel = document.getElementById('memberPhotoLabel');
    if (photoLabel) {
        let span = photoLabel.querySelector('.file-label-text');
        if (span) span.textContent = '🖼 Foto';
    }
    savePhotoCache();
    reloadMemberStrip();
    reloadMemberList();
    showToast(`✅ ${n} added`);
}

function resetMember(n) {
    if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
    const prev = memberDurations[n];
    memberDurations[n] = 0;
    reloadMemberStrip();
    reloadMemberList();
    showUndoToast(`↺ Reset ${n}`, () => {
        memberDurations[n] = prev;
        reloadMemberStrip();
        reloadMemberList();
        showToast(`↩ Undo reset ${n}`);
    });
}

function confirmDeleteMember(n) {
    showConfirm({ icon:'🗑', title:`Delete ${n}?`, msg:'Recorded durations will be lost.', okLabel:'Delete', okClass:'btn-danger', onOk:()=>deleteMember(n) });
}
function deleteMember(n) {
    if (memberIntervals[n]) clearInterval(memberIntervals[n]);
    delete memberDurations[n];
    delete memberColors[n];
    delete memberPhotos[n];
    delete memberIntervals[n];
    reloadMemberStrip();
    reloadMemberList();
    showToast(`🗑 ${n} deleted`);
}

function confirmResetAll() {
    if (Object.keys(memberDurations).length === 0) { showToast('⚠️ No members yet'); return; }
    showConfirm({ icon:'↺', title:'Reset all durations?', msg:'All recorded times will reset to 0.', okLabel:'Reset', okClass:'btn-primary', onOk:()=>{
        Object.keys(memberDurations).forEach(n => {
            if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
            memberDurations[n] = 0;
        });
        reloadMemberStrip();
        reloadMemberList();
        showToast('↺ All durations reset');
    }});
}

// ══════════════════════════════════════════
//  3. EDIT MEMBER
// ══════════════════════════════════════════
function refreshEditDropdown() {
    const sel = document.getElementById('editMemberSelect');
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Select member —</option>';
    Object.keys(memberDurations).forEach(n => {
        const o = document.createElement('option');
        o.value = n; o.textContent = n;
        sel.appendChild(o);
    });
    if (cur && memberDurations[cur] !== undefined) sel.value = cur;
}
function openEditMenu() {
    if (Object.keys(memberDurations).length === 0) { showToast('⚠️ No members yet'); return; }
    refreshEditDropdown();
    document.getElementById('editModal').style.display = 'flex';
}
function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }
function populateEditForm() {
    const n = document.getElementById('editMemberSelect').value;
    if (!n) return;
    document.getElementById('editMemberName').value = n;
    document.getElementById('editMemberColor').value = memberColors[n] || '#a78bfa';
}
async function applyEdit() {
    try {
        const oldName = document.getElementById('editMemberSelect').value;
        const newName = document.getElementById('editMemberName').value.trim();
        const newColor = document.getElementById('editMemberColor').value;
        const newPhotoFile = document.getElementById('editMemberPhoto').files[0];
        if (!oldName) { showToast('⚠️ Select a member first'); return; }
        if (!newName) { showToast('⚠️ Name cannot be empty'); return; }
        const newPhoto = newPhotoFile ? await fileToBase64(newPhotoFile) : (memberPhotos[oldName] || `https://ui-avatars.com/api/?name=${encodeURIComponent(oldName)}&background=random`);
        if (newName !== oldName) {
            memberDurations[newName] = memberDurations[oldName];
            memberColors[newName] = newColor;
            memberPhotos[newName] = newPhoto;
            if (memberIntervals[oldName]) memberIntervals[newName] = memberIntervals[oldName];
            delete memberDurations[oldName];
            delete memberColors[oldName];
            delete memberPhotos[oldName];
            delete memberIntervals[oldName];
        } else {
            memberColors[oldName] = newColor;
            memberPhotos[oldName] = newPhoto;
        }
        savePhotoCache();
        closeEditModal();
        reloadMemberStrip();
        reloadMemberList();
        showToast(`✅ ${newName} updated`);
    } catch(err) {
        console.error(err);
        showToast('❌ Failed to save');
    }
}

// ══════════════════════════════════════════
//  4. PRESET
// ══════════════════════════════════════════
function getPresets() { return JSON.parse(localStorage.getItem('linedistro_presets') || '{}'); }
function savePresets(d) { localStorage.setItem('linedistro_presets', JSON.stringify(d)); }
function refreshPresetDropdown() {
    const sel = document.getElementById('presetSelect');
    const presets = getPresets();
    sel.innerHTML = '<option value="">— Select preset —</option>';
    Object.keys(presets).forEach(name => {
        const o = document.createElement('option');
        o.value = name; o.textContent = name;
        sel.appendChild(o);
    });
}
function saveNewPreset() {
    if (Object.keys(memberDurations).length === 0) { showToast('⚠️ Add a member first'); return; }
    const defaultName = document.getElementById('songTitle').value.trim();
    const bar = document.getElementById('presetSaveBar');
    const inp = document.getElementById('presetSaveInput');
    if (!bar || !inp) return;
    inp.value = defaultName;
    bar.style.display = 'flex';
    setTimeout(() => inp.focus(), 50);
}
function doSavePreset() {
    const inp = document.getElementById('presetSaveInput');
    const name = inp ? inp.value.trim() : '';
    if (!name) { showToast('⚠️ Preset name cannot be empty'); return; }
    const members = Object.keys(memberDurations);
    const presets = getPresets();
    presets[name] = members.map(n => ({ name: n, color: memberColors[n], photo: memberPhotos[n] }));
    savePresets(presets);
    refreshPresetDropdown();
    const sel = document.getElementById('presetSelect');
    if (sel) { sel.value = name; updatePresetDropdownColor(); }
    document.getElementById('presetSaveBar').style.display = 'none';
    showToast(`💾 Preset "${name}" saved`);
}
function cancelSavePreset() { document.getElementById('presetSaveBar').style.display = 'none'; }
function updatePresetDropdownColor() {
    const sel = document.getElementById('presetSelect');
    const name = sel.value;
    if (!name) { sel.style.borderColor = ''; return; }
    const preset = getPresets()[name];
    if (!preset || preset.length === 0) return;
    const firstColor = preset[0].color || '#a78bfa';
    sel.style.borderColor = firstColor;
    sel.style.boxShadow = `0 0 0 2px ${firstColor}22`;
}
function loadSelectedPreset() {
    const name = document.getElementById('presetSelect').value;
    if (!name) return;
    updatePresetDropdownColor();
    const preset = getPresets()[name];
    if (!preset) return;
    const doLoad = () => {
        memberDurations = {}; memberColors = {}; memberPhotos = {};
        preset.forEach(m => {
            memberDurations[m.name] = 0;
            memberColors[m.name] = m.color || '#a78bfa';
            memberPhotos[m.name] = m.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`;
        });
        savePhotoCache();
        reloadMemberStrip();
        reloadMemberList();
        showToast(`✅ Preset "${name}" loaded`);
    };
    if (Object.keys(memberDurations).length > 0) {
        showConfirm({ icon:'📂', title:`Load "${name}"?`, msg:'Current members will be replaced.', okLabel:'Load', okClass:'btn-primary', onOk:doLoad });
    } else { doLoad(); }
}
function deleteSelectedPreset() {
    const name = document.getElementById('presetSelect').value;
    if (!name) { showToast('⚠️ Select a preset first'); return; }
    showConfirm({ icon:'🗑', title:`Delete preset "${name}"?`, msg:'This preset will be permanently deleted.', okLabel:'Delete', okClass:'btn-danger', onOk:()=>{
        const presets = getPresets();
        delete presets[name];
        savePresets(presets);
        refreshPresetDropdown();
        showToast(`🗑 Preset "${name}" deleted`);
    }});
}

// ══════════════════════════════════════════
//  5. MEDIA
// ══════════════════════════════════════════
function loadLocalMedia(input) {
    const file = input.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const vid = document.getElementById('localMedia');
    const aud = document.getElementById('audioPlayer');
    const yt  = document.getElementById('player');
    const lbl = document.getElementById('mediaLabel');
    yt.style.display = 'none'; vid.style.display = 'none'; aud.style.display = 'none';
    if (file.type.startsWith('video/')) {
        vid.src = url; vid.style.display = 'block'; vid.load();
        lbl.textContent = `🎬 ${file.name}`;
    } else if (file.type.startsWith('audio/')) {
        aud.src = url; aud.style.display = 'block'; aud.load();
        lbl.textContent = `🎵 ${file.name}`;
    } else { showToast('⚠️ Format tidak didukung'); }
}
function loadVideo() {
    const url = document.getElementById('ytLink').value.trim();
    const v = (url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/))?.[1];
    if (!v) { showToast('⚠️ Link YouTube tidak valid'); return; }
    document.getElementById('localMedia').style.display = 'none';
    document.getElementById('audioPlayer').style.display = 'none';
    document.getElementById('mediaLabel').textContent = '';
    const yt = document.getElementById('player');
    yt.style.display = 'block';
    window._currentYtVideoId = v;
    if (window.ytPlayer) { window.ytPlayer.loadVideoById(v); }
    else { window.ytPlayer = new YT.Player('player', { height: '315', width: '100%', videoId: v }); }
}

// ══════════════════════════════════════════
//  6. FINISH & CHART
// ══════════════════════════════════════════
function finish() {
    const names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('No members added yet'); return; }
    const total = Object.values(memberDurations).reduce((a,b) => a+b, 0);
    if (total === 0) { showToast('All durations are 0 — record first!'); return; }
    Object.keys(memberIntervals).forEach(n => {
        if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
        const card = [...memberList.children].find(c => c.dataset.name === n);
        if (card) card.classList.remove('is-active');
        const si = memberStrip.querySelector(`.strip-item[data-name="${n}"]`);
        if (si) si.classList.remove('holding');
    });
    const sorted = [...names].sort((a,b) => memberDurations[b] - memberDurations[a]);
    const title = document.getElementById('songTitle').value.trim() || 'Untitled';
    const lb = document.getElementById('leaderboard');
    lb.innerHTML = '';
    sorted.forEach((n, i) => {
        const pct = ((memberDurations[n] / total) * 100).toFixed(1);
        const item = document.createElement('div');
        item.className = 'rank-item';
        item.style.borderLeftColor = memberColors[n];
        item.innerHTML = `
            <div class="rank-name">
                <img src="${memberPhotos[n]}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n)}'">
                <span class="rank-badge">${i+1}</span>
                <span>${n}</span>
            </div>
            <div class="rank-meta">
                <span class="rank-time">${memberDurations[n].toFixed(1)}s</span>
                <span class="rank-pct">${pct}%</span>
            </div>`;
        lb.appendChild(item);
    });
    document.getElementById('resultSongTitle').textContent = `🎵 ${title}`;
    document.getElementById('resultDateLabel').textContent = new Date().toLocaleString('en-US');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(document.getElementById('resultChart'), {
        type: 'doughnut',
        data: {
            labels: sorted,
            datasets: [{
                data: sorted.map(n => memberDurations[n].toFixed(2)),
                backgroundColor: sorted.map(n => memberColors[n]),
                borderColor: '#13131f',
                borderWidth: 3
            }]
        },
        options: {
            plugins: {
                legend: { labels: { color: '#9490b0', font: { family: 'Inter', size: 12 }, boxWidth: 14 } },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return ` ${ctx.parsed}s  (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
    saveToHistory(title, sorted, memberDurations, memberColors, memberPhotos, total);
    document.getElementById('resultModal').style.display = 'flex';
}
function closeResultModal() { document.getElementById('resultModal').style.display = 'none'; }

// ══════════════════════════════════════════
//  7. HISTORY
// ══════════════════════════════════════════
function getHistory() { return JSON.parse(localStorage.getItem('linedistro_history') || '[]'); }
function saveHistory(d) { localStorage.setItem('linedistro_history', JSON.stringify(d)); }

function saveToHistory(title, sorted, durations, colors, photos, total) {
    const history = getHistory();
    history.unshift({
        id: Date.now(),
        title,
        date: new Date().toLocaleString('en-US'),
        totalDuration: total,
        members: sorted.map(n => ({
            name: n,
            duration: durations[n],
            color: colors[n],
            photo: photos[n],
            pct: ((durations[n] / total) * 100).toFixed(1)
        }))
    });
    saveHistory(history);
}

function getMemberStats(memberName) {
    const history = getHistory();
    return history
        .filter(e => e.members.some(m => m.name === memberName))
        .map(e => {
            const m = e.members.find(x => x.name === memberName);
            return { title: e.title, date: e.date, duration: m.duration, pct: parseFloat(m.pct) };
        })
        .reverse();
}

function openMemberStats(memberName) {
    const stats = getMemberStats(memberName);
    if (stats.length < 2) { showToast('⚠️ Need at least 2 history entries'); return; }
    const modal = document.getElementById('memberStatsModal');
    document.getElementById('statsModalTitle').textContent = `📈 ${memberName}`;
    const canvas = document.getElementById('memberStatsChart');
    if (window._statsChart) window._statsChart.destroy();
    window._statsChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: stats.map(s => s.title.length > 12 ? s.title.substring(0,11)+'…' : s.title),
            datasets: [{
                label: 'Duration (s)',
                data: stats.map(s => s.duration.toFixed(1)),
                borderColor: memberColors[memberName] || '#a78bfa',
                backgroundColor: (memberColors[memberName] || '#a78bfa') + '22',
                fill: true, tension: 0.4, pointRadius: 5,
                pointBackgroundColor: memberColors[memberName] || '#a78bfa',
            }, {
                label: 'Share (%)',
                data: stats.map(s => s.pct),
                borderColor: '#67e8f9',
                backgroundColor: '#67e8f922',
                fill: false, tension: 0.4, pointRadius: 5,
                pointBackgroundColor: '#67e8f9',
                yAxisID: 'y2',
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#9490b0', font: { size: 11 } } } },
            scales: {
                x: { ticks: { color: '#9490b0', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#9490b0' }, grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Seconds', color: '#9490b0' } },
                y2: { position: 'right', ticks: { color: '#67e8f9' }, grid: { display: false }, title: { display: true, text: '%', color: '#67e8f9' } }
            }
        }
    });
    modal.style.display = 'flex';
}
function closeMemberStatsModal() { document.getElementById('memberStatsModal').style.display = 'none'; }

function openHistory() {
    const history = getHistory();
    const container = document.getElementById('historyList');
    container.innerHTML = '';
    if (history.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:30px 0;font-size:13px;">No history yet.</p>';
    } else {
        history.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-card-header" onclick="toggleHistoryDetail(${entry.id})">
                    <div>
                        <div class="history-card-title">🎵 ${entry.title}</div>
                        <div class="history-card-meta">${entry.date} · Total ${entry.totalDuration.toFixed(1)}s</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div class="history-avatars">
                            ${entry.members.slice(0,4).map(m =>
                                `<img src="${m.photo}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}'"/>`
                            ).join('')}
                            ${entry.members.length > 4 ? `<span class="history-more">+${entry.members.length - 4}</span>` : ''}
                        </div>
                        <span class="history-chevron" id="chev-${entry.id}">▾</span>
                    </div>
                </div>
                <div class="history-detail" id="detail-${entry.id}">
                    <div style="padding-top:10px; display:flex; flex-direction:column; gap:6px;">
                        ${entry.members.map((m, i) => `
                            <div class="rank-item" style="border-left-color:${m.color}; cursor:pointer;" onclick="openMemberStats('${m.name.replace(/'/g,"\\'")}')">
                                <div class="rank-name">
                                    <img src="${m.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;"
                                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}'">
                                    <span class="rank-badge">${i+1}</span>
                                    <span>${m.name}</span>
                                </div>
                                <div class="rank-meta">
                                    <span class="rank-time">${m.duration.toFixed(1)}s</span>
                                    <span class="rank-pct">${m.pct}%</span>
                                    <span style="color:var(--text3);font-size:11px;margin-left:4px;">📈</span>
                                </div>
                            </div>`).join('')}
                    </div>
                    <button class="btn-danger-soft" style="width:100%;justify-content:center;margin-top:10px;"
                            onclick="confirmDeleteHistoryEntry(${entry.id})">🗑 Delete Entry</button>
                </div>`;
            container.appendChild(card);
        });
    }
    document.getElementById('historyModal').style.display = 'flex';
}
function toggleHistoryDetail(id) {
    const detail = document.getElementById(`detail-${id}`);
    const chev = document.getElementById(`chev-${id}`);
    const isOpen = detail.classList.contains('open');
    detail.classList.toggle('open', !isOpen);
    chev.classList.toggle('open', !isOpen);
}
function confirmDeleteHistoryEntry(id) {
    showConfirm({ icon:'🗑', title:'Delete riwayat ini?', msg:'This recording data cannot be recovered.', okLabel:'Delete', okClass:'btn-danger', onOk:()=>{
        saveHistory(getHistory().filter(e => e.id !== id));
        openHistory();
        showToast('🗑 History entry deleted');
    }});
}
function confirmClearHistory() {
    showConfirm({ icon:'🗑', title:'Delete semua riwayat?', msg:'All recording history will be permanently deleted.', okLabel:'Delete Semua', okClass:'btn-danger', onOk:()=>{ saveHistory([]); openHistory(); showToast('🗑 All history cleared'); } });
}
function closeHistoryModal() { document.getElementById('historyModal').style.display = 'none'; }

// ══════════════════════════════════════════
//  8. KEYBOARD SHORTCUTS
// ══════════════════════════════════════════
const activeKeyHolds = new Set();
document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
        e.preventDefault();
        const vid = document.getElementById('localMedia');
        const aud = document.getElementById('audioPlayer');
        if (vid.style.display !== 'none') { vid.paused ? vid.play() : vid.pause(); }
        else if (aud.style.display !== 'none') { aud.paused ? aud.play() : aud.pause(); }
        else if (window.ytPlayer) { window.ytPlayer.getPlayerState() === 1 ? window.ytPlayer.pauseVideo() : window.ytPlayer.playVideo(); }
        return;
    }
    let idx = parseInt(e.key) - 1;
    if (e.key === '0') idx = 9;
    if (isNaN(idx) || idx < 0 || idx > 9) {
        handleAdLibKeyDown(e);
        return;
    }
    if (activeKeyHolds.has(idx)) return;
    const items = document.querySelectorAll('.strip-item');
    const item = items[idx];
    if (!item) return;
    activeKeyHolds.add(idx);
    item.dispatchEvent(new MouseEvent('mousedown'));
});
document.addEventListener('keyup', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    let idx = parseInt(e.key) - 1;
    if (e.key === '0') idx = 9;
    if (isNaN(idx) || idx < 0 || idx > 9) {
        handleAdLibKeyUp(e);
        return;
    }
    activeKeyHolds.delete(idx);
    const items = document.querySelectorAll('.strip-item');
    const item = items[idx];
    if (!item) return;
    item.dispatchEvent(new MouseEvent('mouseup'));
});
window.addEventListener('blur', () => {
    activeKeyHolds.forEach(idx => {
        const item = document.querySelectorAll('.strip-item')[idx];
        if (item) item.dispatchEvent(new MouseEvent('mouseup'));
    });
    activeKeyHolds.clear();
    activeAdLibKeys.forEach(idx => clearAdLib(idx));
    activeAdLibKeys.clear();
});

// ══════════════════════════════════════════
//  AD-LIBS (Q-P)
// ══════════════════════════════════════════
const AD_KEYS = 'QWERTYUIOP'.split('');
const activeAdLibKeys = new Set();
let adLibIntervals = {};

function addAdLibTime(memberName, amount = 0.5) {
    if (!memberDurations[memberName]) return;
    memberDurations[memberName] = (memberDurations[memberName] || 0) + amount;
    const timeLabel = document.getElementById(`strip-time-${CSS.escape(memberName)}`);
    if (timeLabel) timeLabel.textContent = memberDurations[memberName].toFixed(1) + 's';
    updateLeaderboardLive();
    updateTotalDuration();
    updatePresentationLive();
    reorderLeaderboard();
    if (document.getElementById('presentationOverlay').style.display !== 'none') {
        renderPresentationBars();
    }
}

function handleAdLibKeyDown(e) {
    const key = e.key.toUpperCase();
    const idx = AD_KEYS.indexOf(key);
    if (idx < 0) return;
    if (activeAdLibKeys.has(idx)) return;
    const items = document.querySelectorAll('.strip-item');
    const item = items[idx];
    if (!item) return;
    const n = item.dataset.name;
    if (!n) return;
    activeAdLibKeys.add(idx);
    startAdLib(idx, item);
    addAdLibTime(n, 0.5);
    if (adLibIntervals[idx]) clearInterval(adLibIntervals[idx]);
    adLibIntervals[idx] = setInterval(() => {
        addAdLibTime(n, 0.5);
    }, 200);
}
function handleAdLibKeyUp(e) {
    const key = e.key.toUpperCase();
    const idx = AD_KEYS.indexOf(key);
    if (idx < 0) return;
    activeAdLibKeys.delete(idx);
    clearAdLib(idx);
    if (adLibIntervals[idx]) {
        clearInterval(adLibIntervals[idx]);
        delete adLibIntervals[idx];
    }
}
function startAdLib(idx, item) {
    item.classList.add('adlib-active');
    const wrap = item.querySelector('.strip-avatar-wrap');
    if (wrap) wrap.classList.add('adlib-glow');
    const n = item.dataset.name;
    const card = [...memberList.children].find(c => c.dataset.name === n);
    if (card) card.classList.add('adlib-card');
}
function clearAdLib(idx) {
    const items = document.querySelectorAll('.strip-item');
    const item = items[idx];
    if (!item) return;
    item.classList.remove('adlib-active');
    const wrap = item.querySelector('.strip-avatar-wrap');
    if (wrap) wrap.classList.remove('adlib-glow');
    const n = item.dataset.name;
    const card = [...memberList.children].find(c => c.dataset.name === n);
    if (card) card.classList.remove('adlib-card');
}

// Tutup modal klik backdrop
document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.style.display = 'none'; });
});

// ══════════════════════════════════════════
//  9. PRESENTATION MODE
// ══════════════════════════════════════════
function openPresentation() {
    const names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('⚠️ No members to present'); return; }
    const pressVid = document.getElementById('pressVideo');
    const pressAud = document.getElementById('pressAudio');
    const pressYt  = document.getElementById('pressYtWrap');
    pressVid.style.display = 'none'; pressAud.style.display = 'none'; pressYt.style.display = 'none';
    pressVid.src = ''; pressAud.src = '';
    const localVid = document.getElementById('localMedia');
    const localAud = document.getElementById('audioPlayer');
    if (localVid.style.display !== 'none' && localVid.src) {
        pressVid.src = localVid.src;
        pressVid.currentTime = localVid.currentTime;
        pressVid.style.display = 'block';
    } else if (localAud.style.display !== 'none' && localAud.src) {
        pressAud.src = localAud.src;
        pressAud.currentTime = localAud.currentTime;
        pressAud.style.display = 'block';
    } else if (window.ytPlayer) {
        pressYt.style.display = 'block';
        pressYt.innerHTML = '';
        const videoId = window._currentYtVideoId || '';
        if (videoId) {
            pressYt.innerHTML = `<iframe
                width="100%" height="280"
                src="https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                style="border-radius:12px;">
            </iframe>`;
        }
    }
    document.getElementById('presentationOverlay').style.display = 'flex';
    renderPresentationBars();
}
function closePresentation() {
    document.getElementById('presentationOverlay').style.display = 'none';
    if (_pressReorderTimer) { clearTimeout(_pressReorderTimer); _pressReorderTimer = null; }
}
function syncPresentationMedia() {
    const localVid = document.getElementById('localMedia');
    const pressVid = document.getElementById('pressVideo');
    const localAud = document.getElementById('audioPlayer');
    const pressAud = document.getElementById('pressAudio');
    if (localVid.style.display !== 'none' && pressVid.style.display !== 'none') {
        pressVid.currentTime = localVid.currentTime;
        if (!localVid.paused) pressVid.play(); else pressVid.pause();
    } else if (localAud.style.display !== 'none' && pressAud.style.display !== 'none') {
        pressAud.currentTime = localAud.currentTime;
        if (!localAud.paused) pressAud.play(); else pressAud.pause();
    }
    showToast('⏱ Synced');
}

let _pressReorderTimer = null, _pressIsReordering = false;
function pressId(prefix, name) { return prefix + name.replace(/[^a-zA-Z0-9]/g, '_'); }

function renderPresentationBars() {
    const container = document.getElementById('pressBars');
    container.innerHTML = '';
    const names = Object.keys(memberDurations);
    const maxDur = Math.max(...Object.values(memberDurations), 0.001);
    const sorted = [...names].sort((a,b) => memberDurations[b] - memberDurations[a]);
    const title = document.getElementById('songTitle').value.trim() || 'Line Distribution';
    document.getElementById('pressSongTitle').textContent = title;
    sorted.forEach((n, i) => {
        const barPct = ((memberDurations[n] / maxDur) * 100).toFixed(1);
        const c = memberColors[n] || '#a78bfa';
        const row = document.createElement('div');
        row.className = 'press-row';
        row.dataset.name = n;
        row.style.animationDelay = (i * 0.06) + 's';
        row.style.setProperty('--press-color', c);
        const isRecording = !!memberIntervals[n];
        const avatarScale = isRecording ? 'scale(1.15)' : 'scale(1)';
        const avatarShadow = isRecording ? `0 0 28px 8px ${c}99` : `0 0 14px 2px ${c}44`;
        row.innerHTML = `
            <img src="${memberPhotos[n]}" class="press-avatar"
                 id="${pressId('pavatar-',n)}"
                 style="border-color:${c}; transform:${avatarScale}; box-shadow:${avatarShadow};"
                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random'">
            <div class="press-member-info">
                <span class="press-name">${n}</span>
                <div class="press-bar-wrap">
                    <div class="press-bar"
                         id="${pressId('pbar-',n)}"
                         style="width:${barPct}%; background:linear-gradient(90deg,${c}99,${c});"></div>
                </div>
            </div>
            <span class="press-time" id="${pressId('ptime-',n)}">${memberDurations[n].toFixed(1)}s</span>`;
        container.appendChild(row);
    });
}

function updatePresentationLive() {
    const overlay = document.getElementById('presentationOverlay');
    if (!overlay || overlay.style.display === 'none') return;
    const container = document.getElementById('pressBars');
    if (!container || container.children.length === 0) return;
    const rows = [...container.children];
    const maxDur = Math.max(...Object.values(memberDurations), 0.001);
    rows.forEach(row => {
        const n = row.dataset.name;
        const bar = row.querySelector('.press-bar');
        const time = row.querySelector('.press-time');
        const avatar = row.querySelector('.press-avatar');
        const c = memberColors[n] || '#a78bfa';
        if (bar) bar.style.width = ((memberDurations[n] || 0) / maxDur * 100).toFixed(1) + '%';
        if (time) time.textContent = (memberDurations[n] || 0).toFixed(1) + 's';
        if (avatar) {
            const rec = !!memberIntervals[n];
            avatar.style.transform = rec ? 'scale(1.15)' : 'scale(1)';
            avatar.style.boxShadow = rec ? `0 0 28px 8px ${c}99` : `0 0 14px 2px ${c}44`;
        }
    });
    if (_pressReorderTimer || _pressIsReordering) return;
    _pressReorderTimer = setTimeout(() => {
        _pressReorderTimer = null;
        if (_pressIsReordering) return;
        const curRows = [...container.children];
        const sortedNames = Object.keys(memberDurations).sort((a,b) => memberDurations[b] - memberDurations[a]);
        const same = sortedNames.every((n, i) => curRows[i] && curRows[i].dataset.name === n);
        if (same) return;
        _pressIsReordering = true;
        const firstRects = new Map();
        curRows.forEach(r => firstRects.set(r.dataset.name, r.getBoundingClientRect()));
        sortedNames.forEach(n => {
            const row = curRows.find(r => r.dataset.name === n);
            if (row) container.appendChild(row);
        });
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                sortedNames.forEach(n => {
                    const row = curRows.find(r => r.dataset.name === n);
                    const first = firstRects.get(n);
                    if (!row || !first) return;
                    const last = row.getBoundingClientRect();
                    const dy = first.top - last.top;
                    if (Math.abs(dy) < 1) return;
                    row.style.transition = 'transform 0s';
                    row.style.transform = `translateY(${dy}px)`;
                    requestAnimationFrame(() => {
                        row.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        row.style.transform = '';
                        setTimeout(() => { row.style.transition = ''; row.style.transform = ''; }, 600);
                    });
                });
                setTimeout(() => { _pressIsReordering = false; }, 600);
            });
        });
    }, 600);
}

// ══════════════════════════════════════════
//  10. INIT
// ══════════════════════════════════════════
window.onload = () => {
    loadPhotoCache();
    refreshPresetDropdown();
    reloadMemberStrip();
    reloadMemberList();

    const saveEditBtn = document.querySelector('#editModal .btn-primary');
    if (saveEditBtn) {
        saveEditBtn.removeAttribute('onclick');
        saveEditBtn.addEventListener('click', (e) => { e.preventDefault(); applyEdit(); });
    }
    const addBtn = document.getElementById('addMemberBtn');
    if (addBtn) {
        addBtn.removeAttribute('onclick');
        addBtn.addEventListener('click', (e) => { e.preventDefault(); addNewMember(); });
    }
    const promptSaveBtn = document.getElementById('promptSaveBtn');
    if (promptSaveBtn) {
        promptSaveBtn.removeAttribute('onclick');
        promptSaveBtn.addEventListener('click', (e) => { e.preventDefault(); confirmPrompt(); });
    }
    updateTotalDuration();
    const presetSaveInput = document.getElementById('presetSaveInput');
    if (presetSaveInput) {
        presetSaveInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') doSavePreset();
            if (e.key === 'Escape') cancelSavePreset();
        });
    }
};
