// ══════════════════════════════════════════
//  MAIN MODUL — INITIALIZATION & KEYBOARD SHORTCUTS
// ══════════════════════════════════════════

window.onload = function() {
    // 1. Muat Cache & State Awal
    loadPhotoCache();
    if (!loadAutoState()) {
        // Jika tidak ada autosave, inisialisasi default kosong
        memberDurations = {};
        memberColors = {};
        memberPhotos = {};
    }
    
    // 2. Inisialisasi Tampilan Visual & Dropdown
    reloadMemberStrip();
    reloadMemberList();
    refreshPresetDropdown();
    updateTotalDuration();
    
    // 3. Daftarkan Event Listener Global
    startAutoSave();
    
    // Event listener untuk modal konfirmasi & prompt
    var confirmOkBtn = document.getElementById('confirmOkBtn');
    if (confirmOkBtn) confirmOkBtn.addEventListener('click', confirmOk);
    
    var promptOkBtn = document.getElementById('promptOkBtn');
    if (promptOkBtn) promptOkBtn.addEventListener('click', confirmPrompt);
};

// ── KEYBOARD SHORTCUTS SYSTEM ──
document.addEventListener('keydown', function(e) {
    // Abaikan jika user sedang mengetik di kolom input atau textarea
    var activeTag = document.activeElement.tagName.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') return;

    var key = e.key.toUpperCase();

    // Pintasan Angka 1-9 dan 0 untuk Member Porsi Utama
    if ((key >= '1' && key <= '9') || key === '0') {
        var num = key === '0' ? 10 : parseInt(key);
        var names = Object.keys(memberDurations);
        var targetName = names[num - 1];
        if (targetName && _isRecording) {
            startHold(targetName);
        }
    }

    // Pintasan Huruf Q-P untuk Fitur Ad-Libs Instant
    if (AD_KEYS.indexOf(key) !== -1) {
        e.preventDefault();
        if (_isRecording && !activeAdLibKeys.has(key)) {
            activeAdLibKeys.add(key);
            handleAdLibKeyDown(key);
        }
    }

    // Spacebar untuk Play / Pause Lagu
    if (e.key === ' ') {
        e.preventDefault();
        togglePlayerPlayback();
    }
});

document.addEventListener('keyup', function(e) {
    var activeTag = document.activeElement.tagName.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') return;

    var key = e.key.toUpperCase();

    // Lepas Porsi Utama (Angka)
    if ((key >= '1' && key <= '9') || key === '0') {
        var num = key === '0' ? 10 : parseInt(key);
        var names = Object.keys(memberDurations);
        var targetName = names[num - 1];
        if (targetName) {
            endHold(targetName);
        }
    }

    // Lepas Fitur Ad-Libs (Huruf Q-P)
    if (AD_KEYS.indexOf(key) !== -1) {
        if (activeAdLibKeys.has(key)) {
            activeAdLibKeys.delete(key);
            if (adLibIntervals[key]) {
                clearInterval(adLibIntervals[key]);
                adLibIntervals[key] = null;
            }
            // Kembalikan efek visual strip item ke warna normal
            var names = Object.keys(memberDurations);
            var idx = AD_KEYS.indexOf(key);
            var targetName = names[idx];
            if (targetName) {
                var items = document.querySelectorAll('.strip-item');
                for (var i = 0; i < items.length; i++) {
                    if (items[i].dataset.name === targetName) {
                        items[i].classList.remove('adlib-active');
                    }
                }
            }
        }
    }
});

// ── CORE HOLD LOGIC FOR RECORDING ──
function startHold(name) {
    if (memberIntervals[name]) return; // Sudah ditekan sebelumnya
    
    memberStartTime[name] = getCurrentPlayerTime();
    
    // Setup interval pencatatan realtime per 100ms
    memberIntervals[name] = setInterval(function() {
        if (!_isRecording) return;
        var now = getCurrentPlayerTime();
        var diff = now - memberStartTime[name];
        if (diff > 0) {
            memberDurations[name] = (memberDurations[name] || 0) + diff;
            memberStartTime[name] = now;
            
            // Push data timeline untuk render chart & history
            timelineData.push({
                member: name,
                start: now - diff,
                end: now,
                duration: diff
            });
            
            // Update visual realtime ke layar
            updateLeaderboardLive();
            if (typeof renderPresentationBars === 'function') {
                renderPresentationBars();
            }
        }
    }, 100);
}

function endHold(name) {
    if (memberIntervals[name]) {
        clearInterval(memberIntervals[name]);
        memberIntervals[name] = null;
        
        reorderLeaderboard();
        saveStateForUndo();
    }
}

function handleAdLibKeyDown(key) {
    var names = Object.keys(memberDurations);
    var idx = AD_KEYS.indexOf(key);
    var targetName = names[idx];
    if (!targetName) return;

    // Nyalakan visual efek hijau adlib pada kartu member
    var items = document.querySelectorAll('.strip-item');
    for (var i = 0; i < items.length; i++) {
        if (items[i].dataset.name === targetName) {
            items[i].classList.add('adlib-active');
        }
    }

    // Tambah durasi instan secara berkala selama tombol ditahan
    adLibIntervals[key] = setInterval(function() {
        if (!_isRecording) return;
        memberDurations[targetName] = (memberDurations[targetName] || 0) + 0.05;
        
        var now = getCurrentPlayerTime();
        timelineData.push({
            member: targetName,
            start: now - 0.05,
            end: now,
            duration: 0.05,
            isAdLib: true
        });
        
        updateLeaderboardLive();
        if (typeof renderPresentationBars === 'function') {
            renderPresentationBars();
        }
    }, 50);
}
