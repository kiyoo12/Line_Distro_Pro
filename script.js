// =============================================
//  STATE
// =============================================
const memberList = document.getElementById('memberList');
let memberDurations = {}, memberColors = {}, memberPhotos = {};
let memberInsertOrder = []; // urutan penambahan (untuk shortcut angka & label, TIDAK ikut sorting tampilan)
let chartInstance = null;

// Untuk fitur "tahan" (hold-to-record), state terpusat — BUGFIX #1
// (sebelumnya interval disimpan di closure per-card, jadi kalau card
// di-render ulang saat sedang ditahan, interval lama jadi "ghost" / leak)
let activeHolds = {};   // { [name]: { startTime, startDuration } }
let globalTimer = null;
let isMouseButtonDown = false;
document.addEventListener('mousedown', () => isMouseButtonDown = true);
document.addEventListener('mouseup', () => isMouseButtonDown = false);

// State untuk fitur crop foto (bulat, drag + zoom)
let cropState = null; // {img, viewport, baseScale, zoom, panX, panY, target, dragging, lastX, lastY}
let tempPhotos = { add: null, edit: null }; // hasil crop sementara sebelum disimpan

// Ukuran kartu untuk animasi posisi naik/turun (fitur #3)
const CARD_H = 78;
const CARD_GAP = 10;

// =============================================
//  HELPER: konversi file gambar -> base64 (BUGFIX #3)
//  Sebelumnya pakai URL.createObjectURL() yang di-simpan ke preset
//  (localStorage). Blob URL itu hilang/invalid setelah reload halaman,
//  jadi foto di preset jadi rusak. base64 dataURL persisten.
// =============================================
function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Gagal membaca file foto'));
        reader.readAsDataURL(file);
    });
}

// BUGFIX #5: validasi tipe & ukuran foto sebelum diproses
function validateImageFile(file) {
    if (!file) return true;
    if (!file.type.startsWith('image/')) {
        alert('File foto harus berupa gambar (jpg/png/dll)!');
        return false;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran foto maksimal 5MB!');
        return false;
    }
    return true;
}

// =============================================
//  1. RENDER MEMBER CARD
// =============================================
function renderMemberCard(n, c, p, d, index) {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.style.borderLeft = `5px solid ${c}`;
    card.style.setProperty('--pulse-color', c + '88');
    card.dataset.name = n;
    card.innerHTML = `
        <div class="member-info">
            <img src="${p}" class="member-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n)}'">
            <span class="member-name">${n}</span>
            <span class="member-time">${d.toFixed(1)}s</span>
        </div>
        <div class="member-progress"><div class="member-progress-fill" style="background:${c}"></div></div>
        <div class="member-actions">
            <button class="btn-hold" style="background:${c}">[${index + 1}] Tahan</button>
            <button class="btn-reset" onclick="resetMember('${n}')">🔄</button>
            <button class="btn-del" onclick="deleteMember('${n}')">✖</button>
        </div>`;
    memberList.appendChild(card);

    const holdBtn = card.querySelector('.btn-hold');

    // Mouse events (desktop)
    holdBtn.addEventListener('mousedown', () => startHold(n));
    holdBtn.addEventListener('mouseup', () => stopHold(n));
    holdBtn.addEventListener('mouseleave', () => stopHold(n));
    // Drag mouse (tanpa lepas klik) ke tombol member lain -> ikut mulai tahan,
    // supaya 2+ member yang menyanyi bareng bisa direkam berurutan cepat.
    holdBtn.addEventListener('mouseenter', () => { if (isMouseButtonDown) startHold(n); });

    // Touch events (HP/tablet)
    holdBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(n); }, { passive: false });
    holdBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopHold(n); }, { passive: false });
    holdBtn.addEventListener('touchcancel', () => stopHold(n));
}

// =============================================
//  1b. HOLD ENGINE TERPUSAT (BUGFIX #1 + fitur progress bar & sorting)
// =============================================
function startHold(n) {
    if (activeHolds[n]) return;
    activeHolds[n] = { startTime: Date.now(), startDuration: memberDurations[n] || 0 };

    const card = memberList.querySelector(`[data-name="${CSS.escape(n)}"]`);
    if (card) {
        card.classList.add('is-active');
        card.querySelector('.btn-hold')?.classList.add('holding');
        card.querySelector('.member-avatar')?.classList.add('avatar-pulse'); // fitur #2
    }
    ensureGlobalTimer();
    updateActiveRecordingBanner();
}

function stopHold(n) {
    if (!activeHolds[n]) return;
    delete activeHolds[n];

    const card = memberList.querySelector(`[data-name="${CSS.escape(n)}"]`);
    if (card) {
        card.classList.remove('is-active');
        card.querySelector('.btn-hold')?.classList.remove('holding');
        card.querySelector('.member-avatar')?.classList.remove('avatar-pulse');
    }
    stopGlobalTimerIfIdle();
    updateActiveRecordingBanner();
}

function stopAllHolds() {
    Object.keys(activeHolds).forEach(n => delete activeHolds[n]);
    stopGlobalTimerIfIdle();
}

function ensureGlobalTimer() {
    if (globalTimer) return;
    globalTimer = setInterval(() => {
        const now = Date.now();
        Object.keys(activeHolds).forEach(n => {
            const a = activeHolds[n];
            memberDurations[n] = a.startDuration + (now - a.startTime) / 1000;
        });
        refreshDisplay();
    }, 50);
}

function stopGlobalTimerIfIdle() {
    if (Object.keys(activeHolds).length === 0 && globalTimer) {
        clearInterval(globalTimer);
        globalTimer = null;
    }
}

// Update angka durasi, progress bar (fitur #1), dan posisi naik/turun (fitur #3)
function refreshDisplay() {
    const names = Object.keys(memberDurations);
    const maxDuration = Math.max(0.001, ...names.map(n => memberDurations[n] || 0));

    names.forEach(n => {
        const card = memberList.querySelector(`[data-name="${CSS.escape(n)}"]`);
        if (!card) return;
        const time = memberDurations[n] || 0;
        const timeEl = card.querySelector('.member-time');
        if (timeEl) timeEl.innerText = time.toFixed(1) + 's';
        const fill = card.querySelector('.member-progress-fill');
        if (fill) fill.style.width = ((time / maxDuration) * 100).toFixed(1) + '%';
    });

    updateCardPositions(names);
    updateActiveRecordingBanner();
}

// Banner "🔴 Direkam bersama" — menampilkan member mana saja yang sedang
// ditahan SAAT INI BERSAMAAN (untuk bait yang dinyanyikan unison)
function updateActiveRecordingBanner() {
    const banner = document.getElementById('activeRecordingBanner');
    if (!banner) return;
    const heldNames = Object.keys(activeHolds);

    if (heldNames.length === 0) {
        banner.style.display = 'none';
        banner.innerHTML = '';
        return;
    }

    banner.style.display = 'flex';
    const label = heldNames.length > 1
        ? `🔴 Direkam bersama (${heldNames.length}): `
        : `🔴 Sedang direkam: `;
    banner.innerHTML = `<span class="recording-label">${label}</span>` +
        heldNames.map(n => `<span class="recording-name" style="border-color:${memberColors[n]}">${n}</span>`).join('');
}

// Susun ulang posisi vertikal kartu berdasarkan durasi terbanyak -> terendah,
// dengan animasi geser halus (transisi CSS "top") — fitur #3
function updateCardPositions(names) {
    const sorted = (names || Object.keys(memberDurations)).slice()
        .sort((a, b) => (memberDurations[b] || 0) - (memberDurations[a] || 0));

    sorted.forEach((n, i) => {
        const card = memberList.querySelector(`[data-name="${CSS.escape(n)}"]`);
        if (card) card.style.top = (i * (CARD_H + CARD_GAP)) + 'px';
    });

    const totalHeight = sorted.length > 0 ? (sorted.length * (CARD_H + CARD_GAP) - CARD_GAP) : 0;
    memberList.style.height = totalHeight + 'px';
}

// =============================================
//  FITUR CROP FOTO (bulat, drag untuk geser + slider zoom)
// =============================================
function openCropModal(input, target) {
    const file = input.files[0];
    if (!file) return;
    if (!validateImageFile(file)) {
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('cropImage');
        img.onload = () => initCrop(img, target);
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    document.getElementById('cropModal').style.display = 'flex';
}

function initCrop(img, target) {
    const viewport = document.getElementById('cropViewport');
    const VS = viewport.clientWidth;
    const baseScale = Math.max(VS / img.naturalWidth, VS / img.naturalHeight);

    cropState = {
        img, viewport, VS, baseScale,
        zoom: 1, panX: 0, panY: 0,
        target, dragging: false, lastX: 0, lastY: 0
    };

    document.getElementById('cropZoom').value = 100;
    applyCropTransform(true);
}

function currentCropScale() {
    return cropState.baseScale * cropState.zoom;
}

function applyCropTransform(center) {
    const { img, VS } = cropState;
    const scale = currentCropScale();
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;

    if (center) {
        cropState.panX = (VS - dw) / 2;
        cropState.panY = (VS - dh) / 2;
    }

    // Pastikan gambar selalu menutupi seluruh viewport bulat (tidak ada celah kosong)
    cropState.panX = Math.min(0, Math.max(VS - dw, cropState.panX));
    cropState.panY = Math.min(0, Math.max(VS - dh, cropState.panY));

    img.style.width = dw + 'px';
    img.style.height = dh + 'px';
    img.style.transform = `translate(${cropState.panX}px, ${cropState.panY}px)`;
}

function confirmCrop() {
    if (!cropState) return;
    const { img, VS } = cropState;
    const scale = currentCropScale();
    const OUT = 400; // resolusi output foto

    const sx = -cropState.panX / scale;
    const sy = -cropState.panY / scale;
    const sSize = VS / scale;

    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);

    const dataURL = canvas.toDataURL('image/jpeg', 0.9);
    tempPhotos[cropState.target] = dataURL;

    const previewId = cropState.target === 'add' ? 'addPhotoPreview' : 'editPhotoPreview';
    const preview = document.getElementById(previewId);
    if (preview) {
        preview.src = dataURL;
        preview.style.display = 'inline-block';
    }

    closeCropModal();
}

function cancelCrop() {
    const target = cropState ? cropState.target : null;
    closeCropModal();
    if (target === 'add') document.getElementById('memberPhoto').value = '';
    if (target === 'edit') document.getElementById('editMemberPhoto').value = '';
}

function closeCropModal() {
    document.getElementById('cropModal').style.display = 'none';
    cropState = null;
}

// Drag (mouse & touch) + zoom slider untuk viewport crop
(function setupCropInteractions() {
    document.addEventListener('DOMContentLoaded', () => {
        const viewport = document.getElementById('cropViewport');
        const zoomSlider = document.getElementById('cropZoom');
        if (!viewport || !zoomSlider) return;

        const startDrag = (x, y) => {
            if (!cropState) return;
            cropState.dragging = true;
            cropState.lastX = x;
            cropState.lastY = y;
            viewport.classList.add('dragging');
        };
        const moveDrag = (x, y) => {
            if (!cropState || !cropState.dragging) return;
            cropState.panX += x - cropState.lastX;
            cropState.panY += y - cropState.lastY;
            cropState.lastX = x;
            cropState.lastY = y;
            applyCropTransform(false);
        };
        const endDrag = () => {
            if (!cropState) return;
            cropState.dragging = false;
            viewport.classList.remove('dragging');
        };

        viewport.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
        document.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
        document.addEventListener('mouseup', endDrag);

        viewport.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            startDrag(t.clientX, t.clientY);
        }, { passive: true });
        viewport.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            moveDrag(t.clientX, t.clientY);
            e.preventDefault();
        }, { passive: false });
        viewport.addEventListener('touchend', endDrag);

        zoomSlider.addEventListener('input', (e) => {
            if (!cropState) return;
            cropState.zoom = e.target.value / 100;
            applyCropTransform(false);
        });
    });
})();

// =============================================
//  2. TAMBAH & KELOLA MEMBER
// =============================================
async function addNewMember() {
    const n = document.getElementById('memberName').value.trim();
    if (!n) return alert("Nama member tidak boleh kosong!");
    if (memberDurations[n] !== undefined) return alert("Member dengan nama ini sudah ada!");

    memberDurations[n] = 0;
    memberColors[n] = document.getElementById('memberColor').value;
    memberPhotos[n] = tempPhotos.add
        ? tempPhotos.add // hasil crop
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random`;
    memberInsertOrder.push(n);

    document.getElementById('memberName').value = '';
    document.getElementById('memberPhoto').value = '';
    tempPhotos.add = null;
    const preview = document.getElementById('addPhotoPreview');
    if (preview) { preview.style.display = 'none'; preview.src = ''; }

    reloadMemberList();
}

function reloadMemberList() {
    stopAllHolds();
    memberList.innerHTML = '';
    // Render dalam urutan penambahan (supaya nomor shortcut [1][2][3] stabil),
    // posisi vertikal (naik/turun) tetap diatur terpisah lewat updateCardPositions().
    const names = memberInsertOrder.filter(n => memberDurations[n] !== undefined);
    document.getElementById('emptyHint').style.display = names.length === 0 ? 'block' : 'none';
    names.forEach((n, i) => renderMemberCard(n, memberColors[n], memberPhotos[n], memberDurations[n], i));
    refreshEditDropdown();
    renderInfoBar();
    refreshDisplay();
}

// Fitur #3: panel info menampilkan siapa saja member di sesi ini (statis, tidak ikut acak posisi)
function renderInfoBar() {
    const bar = document.getElementById('memberInfoBar');
    if (!bar) return;
    const names = memberInsertOrder.filter(n => memberDurations[n] !== undefined);

    if (names.length === 0) {
        bar.innerHTML = '';
        bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = `<strong class="info-bar-title">👥 Member di sesi ini (${names.length})</strong>`;
    names.forEach(n => {
        const chip = document.createElement('div');
        chip.className = 'info-chip';
        chip.style.borderLeft = `3px solid ${memberColors[n]}`;
        chip.innerHTML = `<img src="${memberPhotos[n]}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(n)}'"><span>${n}</span>`;
        bar.appendChild(chip);
    });
}

function resetMember(n) {
    if (activeHolds[n]) stopHold(n);
    memberDurations[n] = 0;
    reloadMemberList();
}

function deleteMember(n) {
    if (!confirm(`Hapus member "${n}"?`)) return;
    if (activeHolds[n]) stopHold(n);
    delete memberDurations[n];
    delete memberColors[n];
    delete memberPhotos[n];
    memberInsertOrder = memberInsertOrder.filter(x => x !== n);
    reloadMemberList();
}

function resetAll() {
    if (!confirm("Reset semua durasi ke 0?")) return;
    stopAllHolds();
    Object.keys(memberDurations).forEach(n => memberDurations[n] = 0);
    reloadMemberList();
}

// =============================================
//  3. EDIT MEMBER (Modal)
// =============================================
function refreshEditDropdown() {
    const sel = document.getElementById('editMemberSelect');
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Pilih Member --</option>';
    memberInsertOrder.filter(n => memberDurations[n] !== undefined).forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        sel.appendChild(opt);
    });
    if (current && memberDurations[current] !== undefined) sel.value = current;
}

function openEditMenu() {
    refreshEditDropdown();
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    tempPhotos.edit = null;
}

function populateEditForm() {
    const n = document.getElementById('editMemberSelect').value;

    // Reset hasil crop sebelumnya & input file tiap ganti member yang dipilih
    tempPhotos.edit = null;
    document.getElementById('editMemberPhoto').value = '';
    const preview = document.getElementById('editPhotoPreview');

    if (!n) {
        if (preview) { preview.style.display = 'none'; preview.src = ''; }
        return;
    }

    document.getElementById('editMemberName').value = n;
    document.getElementById('editMemberColor').value = memberColors[n] || '#ff6b6b';

    if (preview) {
        preview.src = memberPhotos[n];
        preview.style.display = 'inline-block';
    }
}

async function applyEdit() {
    const oldName = document.getElementById('editMemberSelect').value;
    const newName = document.getElementById('editMemberName').value.trim();
    const newColor = document.getElementById('editMemberColor').value;

    if (!oldName) return alert("Pilih member dulu!");
    if (!newName) return alert("Nama tidak boleh kosong!");
    if (newName !== oldName && memberDurations[newName] !== undefined) {
        return alert("Sudah ada member dengan nama baru itu!");
    }

    // BUGFIX #1: hentikan dulu timer aktif sebelum rename/reload,
    // supaya tidak ada interval "ghost" yang nempel ke nama lama.
    if (activeHolds[oldName]) stopHold(oldName);

    const newPhoto = tempPhotos.edit; // hasil crop (null kalau foto tidak diganti)

    // Rename kalau namanya berubah
    if (newName !== oldName) {
        memberDurations[newName] = memberDurations[oldName];
        memberColors[newName] = newColor;
        memberPhotos[newName] = newPhoto || memberPhotos[oldName];
        delete memberDurations[oldName];
        delete memberColors[oldName];
        delete memberPhotos[oldName];

        const idx = memberInsertOrder.indexOf(oldName);
        if (idx !== -1) memberInsertOrder[idx] = newName;
    } else {
        memberColors[oldName] = newColor;
        if (newPhoto) memberPhotos[oldName] = newPhoto;
    }

    tempPhotos.edit = null;
    closeEditModal();
    reloadMemberList();
}

// =============================================
//  4. PRESET (localStorage)
// =============================================
function getPresets() {
    return JSON.parse(localStorage.getItem('linedistro_presets') || '{}');
}

function savePresets(data) {
    localStorage.setItem('linedistro_presets', JSON.stringify(data));
}

function refreshPresetDropdown() {
    const sel = document.getElementById('presetSelect');
    const presets = getPresets();
    sel.innerHTML = '<option value="">-- Pilih Preset --</option>';
    Object.keys(presets).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    });
}

function saveNewPreset() {
    const members = memberInsertOrder.filter(n => memberDurations[n] !== undefined);
    if (members.length === 0) return alert("Tambahkan member dulu sebelum menyimpan preset!");
    const name = prompt("Nama preset:");
    if (!name || !name.trim()) return;

    const presets = getPresets();
    presets[name.trim()] = members.map(n => ({
        name: n,
        color: memberColors[n],
        photo: memberPhotos[n] // sekarang base64, jadi aman disimpan & dimuat ulang
    }));
    savePresets(presets);
    refreshPresetDropdown();
    alert(`Preset "${name.trim()}" berhasil disimpan!`);
}

function loadSelectedPreset() {
    const name = document.getElementById('presetSelect').value;
    if (!name) return;
    const presets = getPresets();
    const preset = presets[name];
    if (!preset) return;

    if (Object.keys(memberDurations).length > 0) {
        if (!confirm("Memuat preset akan menghapus member saat ini. Lanjutkan?")) {
            document.getElementById('presetSelect').value = '';
            return;
        }
    }

    stopAllHolds();
    memberDurations = {};
    memberColors = {};
    memberPhotos = {};
    memberInsertOrder = [];

    preset.forEach(m => {
        memberDurations[m.name] = 0;
        memberColors[m.name] = m.color || '#ff6b6b';
        memberPhotos[m.name] = m.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`;
        memberInsertOrder.push(m.name);
    });

    reloadMemberList();
}

function deleteSelectedPreset() {
    const name = document.getElementById('presetSelect').value;
    if (!name) return alert("Pilih preset yang ingin dihapus!");
    if (!confirm(`Hapus preset "${name}"?`)) return;
    const presets = getPresets();
    delete presets[name];
    savePresets(presets);
    refreshPresetDropdown();
}

// =============================================
//  5. LOAD MEDIA (FIX: MP4 & Audio)
// =============================================
function loadLocalMedia(input) {
    const file = input.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const videoEl = document.getElementById('localMedia');
    const audioEl = document.getElementById('audioPlayer');
    const playerEl = document.getElementById('player');
    const label = document.getElementById('mediaLabel');

    // Sembunyikan YouTube player
    playerEl.style.display = 'none';
    videoEl.style.display = 'none';
    audioEl.style.display = 'none';

    if (file.type.startsWith('video/')) {
        videoEl.src = url;
        videoEl.style.display = 'block';
        videoEl.load();
        label.textContent = `🎬 ${file.name}`;
    } else if (file.type.startsWith('audio/')) {
        audioEl.src = url;
        audioEl.style.display = 'block';
        audioEl.load();
        label.textContent = `🎵 ${file.name}`;
    } else {
        alert("Format file tidak didukung!");
    }
}

// =============================================
//  6. YOUTUBE PLAYER (BUGFIX #2)
//  Sebelumnya new YT.Player() langsung dipanggil tanpa menunggu
//  window.onYouTubeIframeAPIReady, jadi kalau diklik sebelum API
//  selesai load -> error "YT is not defined".
// =============================================
let ytApiReady = false;
let pendingVideoId = null;

window.onYouTubeIframeAPIReady = function () {
    ytApiReady = true;
    if (pendingVideoId) {
        createYTPlayer(pendingVideoId);
        pendingVideoId = null;
    }
};

function createYTPlayer(v) {
    if (window.ytPlayer) {
        window.ytPlayer.loadVideoById(v);
    } else {
        window.ytPlayer = new YT.Player('player', { height: '315', width: '100%', videoId: v });
    }
}

function loadVideo() {
    const url = document.getElementById('ytLink').value.trim();
    const v = (url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/))?.[1];
    if (!v) return alert("Link YouTube tidak valid!");

    // Sembunyikan local media
    document.getElementById('localMedia').style.display = 'none';
    document.getElementById('audioPlayer').style.display = 'none';
    document.getElementById('player').style.display = 'block';
    document.getElementById('mediaLabel').textContent = '';

    if (ytApiReady && window.YT && window.YT.Player) {
        createYTPlayer(v);
    } else {
        pendingVideoId = v;
        // Video akan otomatis dimuat begitu onYouTubeIframeAPIReady terpanggil
    }
}

// =============================================
//  7. SELESAI & HITUNG (Pie Chart + Leaderboard)
// =============================================
function finish() {
    const names = Object.keys(memberDurations);
    if (names.length === 0) return alert("Belum ada member!");

    const totalDuration = Object.values(memberDurations).reduce((a, b) => a + b, 0);
    if (totalDuration === 0) return alert("Semua durasi masih 0! Rekam dulu ya.");

    // Urutkan dari terbanyak
    const sorted = names.slice().sort((a, b) => memberDurations[b] - memberDurations[a]);

    // Leaderboard
    const lb = document.getElementById('leaderboard');
    lb.innerHTML = '';
    sorted.forEach((n, i) => {
        const pct = ((memberDurations[n] / totalDuration) * 100).toFixed(1);
        const item = document.createElement('div');
        item.className = 'rank-item';
        item.style.borderLeft = `5px solid ${memberColors[n]}`;
        item.innerHTML = `
            <div class="rank-name">
                <img src="${memberPhotos[n]}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">
                <span>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} ${n}</span>
            </div>
            <div>
                <span class="rank-time">${memberDurations[n].toFixed(1)}s</span>
                <span style="color:#888; margin-left:8px;">${pct}%</span>
            </div>`;
        lb.appendChild(item);
    });

    // Judul lagu
    const title = document.getElementById('songTitle').value.trim();
    document.getElementById('resultSongTitle').textContent = title ? `🎵 ${title}` : '';

    // Pie Chart
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(document.getElementById('resultChart'), {
        type: 'doughnut',
        data: {
            labels: sorted,
            datasets: [{
                data: sorted.map(n => memberDurations[n].toFixed(1)),
                backgroundColor: sorted.map(n => memberColors[n]),
                borderColor: '#121212',
                borderWidth: 2
            }]
        },
        options: {
            plugins: {
                legend: { labels: { color: '#e0e0e0' } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.parsed;
                            const pct = ((val / totalDuration) * 100).toFixed(1);
                            return ` ${val}s (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    document.getElementById('resultModal').style.display = 'flex';
}

function closeResultModal() {
    document.getElementById('resultModal').style.display = 'none';
}

// =============================================
//  8. SHORTCUT KEYBOARD (BUGFIX #4)
//  Sebelumnya keydown auto-repeat (saat tombol ditekan terus) memicu
//  startHold berkali-kali tanpa henti -> flicker class/efek tidak perlu.
// =============================================
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.repeat) return; // BUGFIX #4: abaikan auto-repeat browser

    if (e.code === 'Space') {
        e.preventDefault();
        const video = document.getElementById('localMedia');
        const audio = document.getElementById('audioPlayer');
        if (video.style.display !== 'none') {
            video.paused ? video.play() : video.pause();
        } else if (audio.style.display !== 'none') {
            audio.paused ? audio.play() : audio.pause();
        } else if (window.ytPlayer) {
            window.ytPlayer.getPlayerState() === 1
                ? window.ytPlayer.pauseVideo()
                : window.ytPlayer.playVideo();
        }
        return;
    }

    const idx = parseInt(e.key) - 1;
    const btns = document.querySelectorAll('.btn-hold');
    if (idx >= 0 && idx < btns.length) {
        btns[idx].dispatchEvent(new MouseEvent('mousedown'));
    }
});

document.addEventListener('keyup', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const idx = parseInt(e.key) - 1;
    const btns = document.querySelectorAll('.btn-hold');
    if (idx >= 0 && idx < btns.length) {
        btns[idx].dispatchEvent(new MouseEvent('mouseup'));
    }
});

// Tutup modal kalau klik di luar
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'cropModal') {
            cancelCrop();
        } else {
            e.target.style.display = 'none';
        }
    }
});

// =============================================
//  9. INIT
// =============================================
window.onload = () => {
    refreshPresetDropdown();
    reloadMemberList();
};
