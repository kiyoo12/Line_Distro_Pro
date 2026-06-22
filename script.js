// ══════════════════════════════════════════
//  PHOTO HELPER — simpan sebagai base64
// ══════════════════════════════════════════
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = () => resolve(r.result); // sudah berupa data:image/...;base64,...
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

// Simpan/ambil semua foto ke localStorage (per member)
function savePhotoCache() {
    localStorage.setItem('linedistro_photos', JSON.stringify(memberPhotos));
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
    // Pakai span khusus supaya tidak double
    let span = label.querySelector('.file-label-text');
    if (!span) {
        // Hapus semua text node lama dulu
        Array.from(label.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) node.remove();
        });
        span = document.createElement('span');
        span.className = 'file-label-text';
        label.prepend(span);
    }
    span.textContent = text;
}

function loadPhotoCache() {
    const raw = localStorage.getItem('linedistro_photos');
    if (!raw) return;
    const cached = JSON.parse(raw);
    // Hanya ambil yang base64 (bukan blob:// yang sudah kadaluarsa)
    Object.entries(cached).forEach(([n, url]) => {
        if (url && !url.startsWith('blob:')) {
            memberPhotos[n] = url;
        }
    });
}

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
const memberList = document.getElementById('memberList');
let memberDurations = {}, memberColors = {}, memberPhotos = {};
let memberIntervals = {};
let chartInstance = null;

// ══════════════════════════════════════════
//  TOAST (pengganti alert)
// ══════════════════════════════════════════
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
//  CONFIRM MODAL (pengganti confirm/alert)
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
//  PROMPT MODAL (pengganti prompt)
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
    if (!val) { showToast('⚠️ Nama tidak boleh kosong'); return; }
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
    const keyBadge = index < 9 ? `<span class="strip-key">${index + 1}</span>` : '';
    item.innerHTML = `
        <div class="strip-avatar-wrap">
            <img src="${p}" class="strip-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random'">
            ${keyBadge}
        </div>
        <div class="strip-name">${n}</div>
        <div class="strip-time" id="strip-time-${CSS.escape(n)}">${(memberDurations[n]||0).toFixed(1)}s</div>`;
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
            if (Date.now() - lastReorder > 400) {
                lastReorder = Date.now();
                reorderLeaderboard();
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
        reorderLeaderboard();
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
            <div class="member-info">
                <span class="rank-num">#1</span>
                <img src="${p}" class="member-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random'">
                <div>
                    <div class="member-name">${n}</div>
                    <span><span class="rec-dot"></span><span class="member-time" id="time-${CSS.escape(n)}">${d.toFixed(1)}s</span></span>
                </div>
            </div>
            <div class="member-actions">
                <button class="btn-sm" onclick="resetMember('${n}')" title="Reset durasi">↺</button>
                <button class="btn-sm del" onclick="confirmDeleteMember('${n}')" title="Hapus member">✕</button>
            </div>
        </div>
        <div class="member-bar-wrap">
            <div class="member-bar" id="bar-${CSS.escape(n)}" style="background:${c}; width:0%;"></div>
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
        if (rankEl) rankEl.textContent = '#' + (i + 1);
        // Update progress bar
        const n = card.dataset.name;
        const bar = card.querySelector('.member-bar');
        if (bar) {
            const pct = ((memberDurations[n] || 0) / maxDur * 100).toFixed(1);
            bar.style.width = pct + '%';
        }
    });
}

// Update angka waktu di leaderboard tanpa re-render/re-sort (dipanggil tiap tick saat hold)
function updateLeaderboardLive() {
    const all = [...memberList.children];
    const maxDur = Math.max(...all.map(c => memberDurations[c.dataset.name] || 0), 0.001);
    all.forEach(card => {
        const n = card.dataset.name;
        const el = card.querySelector('.member-time');
        if (el) el.textContent = (memberDurations[n] || 0).toFixed(1) + 's';
        card.classList.toggle('is-active', !!memberIntervals[n]);
        const bar = card.querySelector('.member-bar');
        if (bar) {
            const pct = ((memberDurations[n] || 0) / maxDur * 100).toFixed(1);
            bar.style.width = pct + '%';
        }
    });
}

// FLIP animation: reorder leaderboard cards berdasarkan durasi terbaru
function reorderLeaderboard() {
    const cards = [...memberList.children];
    if (cards.length === 0) return;

    // FIRST: catat posisi lama
    const firstRects = new Map();
    cards.forEach(c => firstRects.set(c.dataset.name, c.getBoundingClientRect()));

    // Urutkan ulang DOM berdasarkan durasi (LAST)
    const sortedNames = Object.keys(memberDurations).sort((a, b) => memberDurations[b] - memberDurations[a]);
    sortedNames.forEach(n => {
        const card = cards.find(c => c.dataset.name === n);
        if (card) memberList.appendChild(card);
    });
    applyRankStyles();

    // INVERT + PLAY
    sortedNames.forEach(n => {
        const card = cards.find(c => c.dataset.name === n);
        if (!card) return;
        const first = firstRects.get(n);
        const last = card.getBoundingClientRect();
        if (!first) return;
        const dy = first.top - last.top;
        if (Math.abs(dy) < 1) return;
        card.style.transition = 'none';
        card.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
            card.style.transition = 'transform 0.45s cubic-bezier(.2,.8,.2,1)';
            card.style.transform = '';
        });
    });
}

// ══════════════════════════════════════════
//  2. TAMBAH & KELOLA MEMBER
// ══════════════════════════════════════════
async function addNewMember() {
    const n = document.getElementById('memberName').value.trim();
    if (!n) { showToast('⚠️ Nama member tidak boleh kosong'); return; }
    const dup = Object.keys(memberDurations).some(k => k.toLowerCase() === n.toLowerCase());
    if (dup) { showToast(`⚠️ Member "${n}" sudah ada`); return; }

    memberDurations[n] = 0;
    memberColors[n]    = document.getElementById('memberColor').value;
    const f = document.getElementById('memberPhoto').files[0];
    memberPhotos[n] = f
        ? await fileToBase64(f)
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random&color=fff`;

    document.getElementById('memberName').value  = '';
    document.getElementById('memberPhoto').value = '';
    savePhotoCache();
    reloadMemberStrip();
    reloadMemberList();
    showToast(`✅ ${n} ditambahkan`);
}

function resetMember(n) {
    if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
    memberDurations[n] = 0;
    reloadMemberStrip();
    reloadMemberList();
    showToast(`↺ Reset ${n}`);
}

function confirmDeleteMember(n) {
    showConfirm({
        icon: '🗑',
        title: `Hapus ${n}?`,
        msg: 'Durasi yang sudah direkam akan hilang.',
        okLabel: 'Hapus',
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
    showToast(`🗑 ${n} dihapus`);
}

function confirmResetAll() {
    if (Object.keys(memberDurations).length === 0) { showToast('⚠️ Belum ada member'); return; }
    showConfirm({
        icon: '↺',
        title: 'Reset semua durasi?',
        msg: 'Semua waktu rekaman akan kembali ke 0.',
        okLabel: 'Reset',
        okClass: 'btn-primary',
        onOk: () => {
            Object.keys(memberDurations).forEach(n => {
                if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
                memberDurations[n] = 0;
            });
            reloadMemberStrip();
            reloadMemberList();
            showToast('↺ Semua durasi direset');
        }
    });
}

// ══════════════════════════════════════════
//  3. EDIT MEMBER
// ══════════════════════════════════════════
function refreshEditDropdown() {
    const sel = document.getElementById('editMemberSelect');
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Pilih member —</option>';
    Object.keys(memberDurations).forEach(n => {
        const o = document.createElement('option');
        o.value = n; o.textContent = n;
        sel.appendChild(o);
    });
    if (cur && memberDurations[cur] !== undefined) sel.value = cur;
}

function openEditMenu() {
    if (Object.keys(memberDurations).length === 0) { showToast('⚠️ Belum ada member'); return; }
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

        if (!oldName) { showToast('⚠️ Pilih member dulu'); return; }
        if (!newName) { showToast('⚠️ Nama tidak boleh kosong'); return; }

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
        showToast(`✅ ${newName} diperbarui`);
    } catch(err) {
        console.error('applyEdit error:', err);
        showToast('❌ Gagal menyimpan, coba lagi');
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
    sel.innerHTML = '<option value="">— Pilih preset —</option>';
    Object.keys(presets).forEach(name => {
        const o = document.createElement('option');
        o.value = name; o.textContent = name;
        sel.appendChild(o);
    });
}

function saveNewPreset() {
    const members = Object.keys(memberDurations);
    if (members.length === 0) { showToast('⚠️ Tambahkan member dulu'); return; }
    showPrompt({
        icon: '💾',
        title: 'Simpan Preset',
        sub: 'Beri nama untuk preset ini.',
        placeholder: 'Nama preset...',
        onOk: (name) => {
            const presets = getPresets();
            presets[name] = members.map(n => ({ name: n, color: memberColors[n], photo: memberPhotos[n] }));
            savePresets(presets);
            refreshPresetDropdown();
            showToast(`💾 Preset "${name}" disimpan`);
        }
    });
}

function loadSelectedPreset() {
    const name = document.getElementById('presetSelect').value;
    if (!name) return;
    const preset = getPresets()[name];
    if (!preset) return;

    const doLoad = () => {
        memberDurations = {}; memberColors = {}; memberPhotos = {};
        preset.forEach(m => {
            memberDurations[m.name] = 0;
            memberColors[m.name]    = m.color || '#a78bfa';
            // Foto dari preset sudah base64, langsung pakai
            memberPhotos[m.name]    = m.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`;
        });
        savePhotoCache();
        reloadMemberStrip();
        reloadMemberList();
        showToast(`✅ Preset "${name}" dimuat`);
    };

    if (Object.keys(memberDurations).length > 0) {
        showConfirm({
            icon: '📂',
            title: `Muat "${name}"?`,
            msg: 'Member saat ini akan diganti dengan preset ini.',
            okLabel: 'Muat',
            okClass: 'btn-primary',
            onOk: doLoad
        });
    } else {
        doLoad();
    }
}

function deleteSelectedPreset() {
    const name = document.getElementById('presetSelect').value;
    if (!name) { showToast('⚠️ Pilih preset dulu'); return; }
    showConfirm({
        icon: '🗑',
        title: `Hapus preset "${name}"?`,
        msg: 'Preset ini akan dihapus permanen.',
        okLabel: 'Hapus',
        okClass: 'btn-danger',
        onOk: () => {
            const presets = getPresets();
            delete presets[name];
            savePresets(presets);
            refreshPresetDropdown();
            showToast(`🗑 Preset "${name}" dihapus`);
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
    if (window.ytPlayer) { window.ytPlayer.loadVideoById(v); }
    else { window.ytPlayer = new YT.Player('player', { height: '315', width: '100%', videoId: v }); }
}

// ══════════════════════════════════════════
//  6. FINISH & CHART
// ══════════════════════════════════════════
function finish() {
    const names = Object.keys(memberDurations);
    if (names.length === 0) { showToast('⚠️ Belum ada member'); return; }
    const total = Object.values(memberDurations).reduce((a, b) => a + b, 0);
    if (total === 0) { showToast('⚠️ Semua durasi masih 0, rekam dulu!'); return; }

    const sorted = [...names].sort((a, b) => memberDurations[b] - memberDurations[a]);
    const title  = document.getElementById('songTitle').value.trim() || 'Tanpa Judul';

    // Leaderboard
    const lb = document.getElementById('leaderboard');
    lb.innerHTML = '';
    sorted.forEach((n, i) => {
        const pct  = ((memberDurations[n] / total) * 100).toFixed(1);
        const badge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
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
    document.getElementById('resultDateLabel').textContent = new Date().toLocaleString('id-ID');

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
        date: new Date().toLocaleString('id-ID'),
        totalDuration: total,
        members: sorted.map(n => ({
            name: n, duration: durations[n], color: colors[n], photo: photos[n],
            pct: ((durations[n] / total) * 100).toFixed(1)
        }))
    });
    saveHistory(history);
}

function openHistory() {
    const history = getHistory();
    const container = document.getElementById('historyList');
    container.innerHTML = '';

    if (history.length === 0) {
        container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:30px 0;font-size:13px;">Belum ada riwayat.</p>';
    } else {
        history.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'history-card';
            const badge = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
            card.innerHTML = `
                <div class="history-card-header" onclick="toggleHistoryDetail(${entry.id})">
                    <div>
                        <div class="history-card-title">🎵 ${entry.title}</div>
                        <div class="history-card-meta">${entry.date} · Total ${entry.totalDuration.toFixed(1)}s</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div class="history-avatars">
                            ${entry.members.slice(0, 4).map(m =>
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
                            <div class="rank-item" style="border-left-color:${m.color};">
                                <div class="rank-name">
                                    <img src="${m.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;"
                                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}'">
                                    <span class="rank-badge">${badge(i)}</span>
                                    <span>${m.name}</span>
                                </div>
                                <div class="rank-meta">
                                    <span class="rank-time">${m.duration.toFixed(1)}s</span>
                                    <span class="rank-pct">${m.pct}%</span>
                                </div>
                            </div>`).join('')}
                    </div>
                    <button class="btn-danger-soft" style="width:100%;justify-content:center;margin-top:10px;"
                            onclick="confirmDeleteHistoryEntry(${entry.id})">🗑 Hapus Riwayat Ini</button>
                </div>`;
            container.appendChild(card);
        });
    }

    document.getElementById('historyModal').style.display = 'flex';
}

function toggleHistoryDetail(id) {
    const detail = document.getElementById(`detail-${id}`);
    const chev   = document.getElementById(`chev-${id}`);
    const isOpen = detail.classList.contains('open');
    detail.classList.toggle('open', !isOpen);
    chev.classList.toggle('open', !isOpen);
}

function confirmDeleteHistoryEntry(id) {
    showConfirm({
        icon: '🗑', title: 'Hapus riwayat ini?',
        msg: 'Data rekaman ini tidak bisa dikembalikan.',
        okLabel: 'Hapus', okClass: 'btn-danger',
        onOk: () => {
            saveHistory(getHistory().filter(e => e.id !== id));
            openHistory();
            showToast('🗑 Riwayat dihapus');
        }
    });
}

function confirmClearHistory() {
    showConfirm({
        icon: '🗑', title: 'Hapus semua riwayat?',
        msg: 'Seluruh riwayat rekaman akan dihapus permanen.',
        okLabel: 'Hapus Semua', okClass: 'btn-danger',
        onOk: () => { saveHistory([]); openHistory(); showToast('🗑 Semua riwayat dihapus'); }
    });
}

function closeHistoryModal() { document.getElementById('historyModal').style.display = 'none'; }

// ══════════════════════════════════════════
//  8. KEYBOARD SHORTCUTS (1-9 = tahan member sesuai urutan di strip)
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

    const idx = parseInt(e.key) - 1;
    if (isNaN(idx) || idx < 0 || idx > 8) return;
    if (activeKeyHolds.has(idx)) return; // cegah key-repeat trigger berulang

    const items = document.querySelectorAll('.strip-item');
    const item = items[idx];
    if (!item) return;

    activeKeyHolds.add(idx);
    item.dispatchEvent(new MouseEvent('mousedown'));
});

document.addEventListener('keyup', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const idx = parseInt(e.key) - 1;
    if (isNaN(idx) || idx < 0 || idx > 8) return;
    activeKeyHolds.delete(idx);

    const items = document.querySelectorAll('.strip-item');
    const item = items[idx];
    if (!item) return;
    item.dispatchEvent(new MouseEvent('mouseup'));
});

// Kalau window kehilangan fokus saat tombol ditahan, lepas semua biar timer tidak nyangkut
window.addEventListener('blur', () => {
    activeKeyHolds.forEach(idx => {
        const item = document.querySelectorAll('.strip-item')[idx];
        if (item) item.dispatchEvent(new MouseEvent('mouseup'));
    });
    activeKeyHolds.clear();
});

// Tutup modal klik backdrop
document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.style.display = 'none'; });
});

// ══════════════════════════════════════════
//  9. INIT
// ══════════════════════════════════════════
window.onload = () => {
    loadPhotoCache();
    refreshPresetDropdown();
    reloadMemberStrip();
    reloadMemberList();

    // Bind semua async button lewat addEventListener (fix async onclick)
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
};
