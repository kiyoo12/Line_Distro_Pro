// =============================================
//  STATE
// =============================================
const memberList = document.getElementById('memberList');
let memberDurations = {}, memberColors = {}, memberPhotos = {};
let memberIntervals = {}; // Simpan referensi interval per member
let chartInstance = null;

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
        <div class="member-actions">
            <button class="btn-hold" style="background:${c}">[${index + 1}] Tahan</button>
            <button class="btn-reset" onclick="resetMember('${n}')">🔄</button>
            <button class="btn-del" onclick="deleteMember('${n}')">✖</button>
        </div>`;
    memberList.appendChild(card);

    const holdBtn = card.querySelector('.btn-hold');
    const timeSpan = card.querySelector('.member-time');

    function startHold() {
        if (memberIntervals[n]) return;
        card.classList.add('is-active');
        holdBtn.classList.add('holding');
        const startTime = Date.now();
        const startDuration = memberDurations[n] || 0;
        memberIntervals[n] = setInterval(() => {
            memberDurations[n] = startDuration + ((Date.now() - startTime) / 1000);
            timeSpan.innerText = memberDurations[n].toFixed(1) + 's';
        }, 50);
    }

    function stopHold() {
        if (!memberIntervals[n]) return;
        clearInterval(memberIntervals[n]);
        memberIntervals[n] = null;
        card.classList.remove('is-active');
        holdBtn.classList.remove('holding');
    }

    // Mouse events (desktop)
    holdBtn.addEventListener('mousedown', startHold);
    holdBtn.addEventListener('mouseup', stopHold);
    holdBtn.addEventListener('mouseleave', stopHold);

    // Touch events (HP/tablet)
    holdBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); }, { passive: false });
    holdBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopHold(); }, { passive: false });
    holdBtn.addEventListener('touchcancel', stopHold);
}

// =============================================
//  2. TAMBAH & KELOLA MEMBER
// =============================================
function addNewMember() {
    const n = document.getElementById('memberName').value.trim();
    if (!n) return alert("Nama member tidak boleh kosong!");
    if (memberDurations[n] !== undefined) return alert("Member dengan nama ini sudah ada!");

    memberDurations[n] = 0;
    memberColors[n] = document.getElementById('memberColor').value;
    const f = document.getElementById('memberPhoto').files[0];
    memberPhotos[n] = f ? URL.createObjectURL(f) : `https://ui-avatars.com/api/?name=${encodeURIComponent(n)}&background=random`;

    document.getElementById('memberName').value = '';
    document.getElementById('memberPhoto').value = '';
    reloadMemberList();
}

function reloadMemberList() {
    memberList.innerHTML = '';
    const names = Object.keys(memberDurations);
    document.getElementById('emptyHint').style.display = names.length === 0 ? 'block' : 'none';
    names.forEach((n, i) => renderMemberCard(n, memberColors[n], memberPhotos[n], memberDurations[n], i));
    refreshEditDropdown();
}

function resetMember(n) {
    if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
    memberDurations[n] = 0;
    reloadMemberList();
}

function deleteMember(n) {
    if (!confirm(`Hapus member "${n}"?`)) return;
    if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
    delete memberDurations[n];
    delete memberColors[n];
    delete memberPhotos[n];
    delete memberIntervals[n];
    reloadMemberList();
}

function resetAll() {
    if (!confirm("Reset semua durasi ke 0?")) return;
    Object.keys(memberDurations).forEach(n => {
        if (memberIntervals[n]) { clearInterval(memberIntervals[n]); memberIntervals[n] = null; }
        memberDurations[n] = 0;
    });
    reloadMemberList();
}

// =============================================
//  3. EDIT MEMBER (Modal)
// =============================================
function refreshEditDropdown() {
    const sel = document.getElementById('editMemberSelect');
    const current = sel.value;
    sel.innerHTML = '<option value="">-- Pilih Member --</option>';
    Object.keys(memberDurations).forEach(n => {
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
}

function populateEditForm() {
    const n = document.getElementById('editMemberSelect').value;
    if (!n) return;
    document.getElementById('editMemberName').value = n;
    document.getElementById('editMemberColor').value = memberColors[n] || '#ff6b6b';
}

function applyEdit() {
    const oldName = document.getElementById('editMemberSelect').value;
    const newName = document.getElementById('editMemberName').value.trim();
    const newColor = document.getElementById('editMemberColor').value;
    const newPhotoFile = document.getElementById('editMemberPhoto').files[0];

    if (!oldName) return alert("Pilih member dulu!");
    if (!newName) return alert("Nama tidak boleh kosong!");

    // Rename kalau namanya berubah
    if (newName !== oldName) {
        memberDurations[newName] = memberDurations[oldName];
        memberColors[newName] = newColor;
        memberPhotos[newName] = newPhotoFile ? URL.createObjectURL(newPhotoFile) : memberPhotos[oldName];
        delete memberDurations[oldName];
        delete memberColors[oldName];
        delete memberPhotos[oldName];
    } else {
        memberColors[oldName] = newColor;
        if (newPhotoFile) memberPhotos[oldName] = URL.createObjectURL(newPhotoFile);
    }

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
    const members = Object.keys(memberDurations);
    if (members.length === 0) return alert("Tambahkan member dulu sebelum menyimpan preset!");
    const name = prompt("Nama preset:");
    if (!name || !name.trim()) return;

    const presets = getPresets();
    presets[name.trim()] = members.map(n => ({
        name: n,
        color: memberColors[n],
        photo: memberPhotos[n]
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

    memberDurations = {};
    memberColors = {};
    memberPhotos = {};

    preset.forEach(m => {
        memberDurations[m.name] = 0;
        memberColors[m.name] = m.color || '#ff6b6b';
        memberPhotos[m.name] = m.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`;
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
//  6. YOUTUBE PLAYER
// =============================================
function loadVideo() {
    const url = document.getElementById('ytLink').value.trim();
    const v = (url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/))?.[1];
    if (!v) return alert("Link YouTube tidak valid!");

    // Sembunyikan local media
    document.getElementById('localMedia').style.display = 'none';
    document.getElementById('audioPlayer').style.display = 'none';
    document.getElementById('player').style.display = 'block';
    document.getElementById('mediaLabel').textContent = '';

    if (window.ytPlayer) {
        window.ytPlayer.loadVideoById(v);
    } else {
        window.ytPlayer = new YT.Player('player', { height: '315', width: '100%', videoId: v });
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
//  8. SHORTCUT KEYBOARD
// =============================================
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

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
        e.target.style.display = 'none';
    }
});

// =============================================
//  9. INIT
// =============================================
window.onload = () => {
    refreshPresetDropdown();
    reloadMemberList();
};
