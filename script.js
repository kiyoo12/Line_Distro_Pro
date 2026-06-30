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
//  PHOTO HELPER — compress + resize lalu simpan base64
// ══════════════════════════════════════════
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            const MAX = 256;
            let w = img.width;
            let h = img.height;

            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }

            const canvas = document.createElement('canvas');
            canvas.width  = w;
            canvas.height = h;
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
        if (url && !url.startsWith('blob:')) {
            memberPhotos[n] = url;
        }
    });
}

// ══════════════════════════════════════════
//  SHOW FILE NAME di label
// ══════════════════════════════════════════
function showFileName(input, labelId, defaultText) {
    const label = document.getElementById(labelId);
    if (!label) return;
    const file = input.files[0];
    const text = file
        ? `📄 ${file.name.length > 24 ? file.name.substring(0, 22) + '…' : file.name}`
        : defaultText;
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
//  TOAST
// ══════════════════════════════════════════
let _undoTimer = null;
let _undoCallback = null;

function showUndoToast(msg, onUndo, duration = 3000) {
    const t = document.getElementById('toast');
    t.innerHTML = `<span>${msg}</span><button class="toast-undo-btn" onclick="triggerUndo()">Undo</button>`;
    t.style.display = 'flex';
    t.style.alignItems = 'center';
    t.style.gap = '12px';
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

// ══════════════════════════════════════════
//  CONFIRM MODAL
// ══════════════════════════════════════════
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

// ══════════════════════════════════════════
//  PROMPT MODAL
// ══════════════════════════════════════════
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
//  1. RENDER MEMBER STRIP (hold-to-record)
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
    const holdKey = index < 9 ? index + 1 : index === 9 ? '0' : '—';
    const adKey   = index < 10 ? 'QWERTYUIOP'[index] : '—';
    const tooltip = index < 10
        ? `Hold [${holdKey}] · Ad-Lib [${adKey}]`
        : `Hold to record`;
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
        dot.style.width = '70px';
        dot.style.height = '70px';
        dot.style.left = '50%';
        dot.style.top = '50%';
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
            // Trigger reflow untuk restart animasi balik
            void card.offsetWidth;
        }
        reorderLeaderboard();
        updatePresentationLive();
    }

    item.addEventListener('mousedown', startHold);
    item.addEventListener('mouseup', stopHold);
    item.addEventListener('mouseleave', stopHold);
    item.addEventListener('touchstart', e => { e.preventDefault(); startHold(); }, { passive: false });
    item.addEventListener('touchend',   e => { e.preventDefault(); stopHold(); },  { passive: false });
    item.addEventListener('touchcancel', stopHold);
}

function reloadMemberStrip() {
    memberStrip.innerHTML = '';
    Object.keys(memberDurations).forEach((n, i) => renderStripItem(n, memberColors[n], memberPhotos[n], i));
}

// ══════════════════════════════════════════
//  1b. MEMBER LEADERBOARD (read-only, auto-sort)
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
        card.classList.remove('rank-1', 'rank-2', 'rank-3');
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

let _lastMaxDur = 0.001;
let _maxDurTick = 0;

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
            // Trigger reflow untuk animasi balik
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

    const sortedNames = Object.keys(memberDurations).sort((a, b) => memberDurations[b] - memberDurations[a]);
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
                setTimeout(() => {
                    card.style.transition = '';
                    card.style.transform  = '';
                }, 600);
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
        try {
            photoUrl = await fileToBase64(f);
        } catch (err) {
            console.error('fileToBase64 error:', err);
            showToast('❌ Failed to load photo, please try again');
            return;
        }
    } else {
        photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random&color=fff`;
    }

    memberDurations[n] = 0;
    memberColors[n]    = color;
    memberPhotos[n]    = photoUrl;

    document.getElementById('memberName').value  = '';
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
    const prevDuration = memberDurations[n];
    memberDurations[n] = 0;
    reloadMemberStrip();
    reloadMemberList();
    showUndoToast(`↺ Reset ${n}`, () => {
        memberDurations[n] = prevDuration;
        reloadMemberStrip();
        reloadMemberList();
        showToast(`↩ Undo reset ${n}`);
    });
}

function confirmDeleteMember(n) {
    showConfirm({
        icon: '🗑',
        title: `Delete ${n}?`,
        msg: 'Recorded durations will be lost.',
        okLabel: 'Delete',
        okClass: 'btn-danger',
        onOk: () => deleteMember(n)
    });
}

function deleteMember(n) {
    if (memberIntervals[n]) clearInterval(memberIntervals[n]);
    memberDurations = Object.fromEntries(Object.entries(memberDurations).filter(([k]) => k !== n));
    memberColors    = Object.fromEntries(Object.entries(memberColors).filter(([k]) => k !== n));
    memberPhotos    = Object.fromEntries(Object.entries(memberPhotos).filter(([k]) => k !== n));
    memberIntervals = Object.fromEntries(Object.entries(memberIntervals).filter(([k]) => k !== n));
    reloadMemberStrip();
    reloadMemberList();
    showToast(`🗑 ${n} deleted`);
}

function confirmResetAll() {
    if (Object.keys(memberDurations).length === 0) { showToast('⚠️ No members yet'); return; }
    showConfirm({
        icon: '↺',
        title: 'Reset all durations?',
        msg: 'All recorded times will reset to 0.',
        okLabel: 'Reset',
        okClass: 'btn-primary',
        onOk: () => {
            Object.keys(memberDurations).forEach(n => {
                if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
                memberDurations[n] = 0;
            });
            reloadMemberStrip();
            reloadMemberList();
            showToast('↺ All durations reset');
        }
    });
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

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function populateEditForm() {
    const n = document.getElementById('editMemberSelect').value;
    if (!n) return;
    document.getElementById('editMemberName').value  = n;
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
            memberColors[newName]    = newColor;
            memberPhotos[newName]    = newPhoto;
            if (memberIntervals[oldName]) { memberIntervals[newName] = memberIntervals[oldName]; }
            memberDurations = Object.fromEntries(Object.entries(memberDurations).filter(([k]) => k !== oldName));
            memberColors    = Object.fromEntries(Object.entries(memberColors).filter(([k]) => k !== oldName));
            memberPhotos    = Object.fromEntries(Object.entries(memberPhotos).filter(([k]) => k !== oldName));
            memberIntervals = Object.fromEntries(Object.entries(memberIntervals).filter(([k]) => k !== oldName));
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
        console.error('applyEdit error:', err);
        showToast('❌ Failed to save, please try again');
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
    const members = Object.keys(memberDurations);
    if (members.length === 0) { showToast('⚠️ Add a member first'); return; }

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

function cancelSavePreset() {
    document.getElementById('presetSaveBar').style.display = 'none';
}

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
            memberColors[m.name]    = m.color || '#a78bfa';
            memberPhotos[m.name]    = m.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`;
        });
        savePhotoCache();
        reloadMemberStrip();
        reloadMemberList();
        showToast(`✅ Preset "${name}" loaded`);
    };

    if (Object.keys(memberDurations).length > 0) {
        showConfirm({
            icon: '📂',
            title: `Load "${name}"?`,
            msg: 'Current members will be replaced by this preset.',
            okLabel: 'Load',
            okClass: 'btn-primary',
            onOk: doLoad
        });
    } else {
        doLoad();
    }
}

function deleteSelectedPreset() {
    const name = document.getElementById('presetSelect').value;
    if (!name) { showToast('⚠️ Select a preset first'); return; }
    showConfirm({
        icon: '🗑',
        title: `Delete preset "${name}"?`,
        msg: 'This preset will be permanently deleted.',
        okLabel: 'Delete',
        okClass: 'btn-danger',
        onOk: () => {
            const presets = getPresets();
            delete presets[name];
            savePresets(presets);
            refreshPresetDropdown();
            showToast(`🗑 Preset "${name}" deleted`);
        }
    });
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
    } else {
        showToast('⚠️ Format tidak didukung');
    }
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
    const total = Object.values(memberDurations).reduce((a, b) => a + b, 0);
    if (total === 0) { showToast('All durations are 0 — record first!'); return; }
    Object.keys(memberIntervals).forEach(n => {
        if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
        const card = [...memberList.children].find(c => c.dataset.name === n);
        if (card) card.classList.remove('is-active');
        const si = memberStrip.querySelector(`.strip-item[data-name="${n}"]`);
        if (si) si.classList.remove('holding');
    });

    const sorted = [...names].sort((a, b) => memberDurations[b] - memberDurations[a]);
    const title  = document.getElementById('songTitle').value.trim() || 'Untitled';

    const lb = document.getElementById('leaderboard');
    lb.innerHTML = '';
    sorted.forEach((n, i) => {
        const pct  = ((memberDurations[n] / total) * 100).toFixed(1);
        const badge = `${i+1}`;
        const item  = document.createElement('div');
        item.className = 'rank-item';
        item.style.borderLeftColor = memberColors[n];
        item.innerHTML = `
            <div class="rank-name">
                <img src="${memberPhotos[n]}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n)}'">
                <span class="rank-badge">${badge}</span>
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
function getHistory()  { return JSON.parse(localStorage.getItem('linedistro_history') || '[]'); }
function saveHistory(d){ localStorage.setItem('linedistro_history', JSON.stringify(d)); }

function saveToHistory(title, sorted, durations, colors, photos, total) {
    const history = getHistory();
    history.unshift({
        id: Date.now(),
        title,
        date: new Date().toLocaleString('en-US'),
        totalDuration: total,
        members: sorted.map(n => ({
            name: n, duration: durations[n], color: colors[n], photo: photos[n],
            pct: ((durations[n] / total) * 100).toFixed(1)
        }))
    });
    saveHistory(history);
}

function getMemberStats(memberName) {
    const history = getHistory();
    return history
       
