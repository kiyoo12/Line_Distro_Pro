// ══════════════════════════════════════════
//  STATE MODUL — PUSAT DATA, CACHE & UNDO/REDO
// ══════════════════════════════════════════

// ── ELEMEN UTAMA DOM ──
var memberList = document.getElementById('memberList');
var memberStrip = document.getElementById('memberStrip');

// ── DATA UTAMA APPLIKASI ──
var memberDurations = {};
var memberColors = {};
var memberPhotos = {};
var memberIntervals = {};
var chartInstance = null;

// ── TIMELINE STATE ──
var pxPerSec = 40;
var playheadPx = 0;

// ── STATUS FITUR ──
var memberStartTime = {};
var timelineData = [];
var autoSaveInterval = null;
var historyStack = [];
var historyIndex = -1;
var _reorderPending = false;
var _avatarState = {};
var _pressReorderPending = false;
var _timelineInterval = null;
var _currentVolume = 0.8;

// ── TAB MODE ──
var _isAllMembersActive = false;

// ── AD-LIBS HOLD ──
var activeAdLibKeys = new Set();
var adLibIntervals = {};
var AD_KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];

// ── LYRICS VARIABLES ──
var _lyricsData = [];
var _lyricsActiveIndex = -1;
var _lyricsUpdateInterval = null;

// ── REC STATE ──
var _isRecording = false;
var _recStartTime = 0;
var _recTimerInterval = null;
var _recordingMembers = {};

// ══════════════════════════════════════════
//  FUNCTIONS: CACHE & UNDO MANAGEMENT
// ══════════════════════════════════════════

function savePhotoCache() {
    localStorage.setItem('linedistro_photos', JSON.stringify(memberPhotos));
}

function loadPhotoCache() {
    var raw = localStorage.getItem('linedistro_photos');
    if (!raw) return;
    try {
        var cached = JSON.parse(raw);
        for (var n in cached) {
            var url = cached[n];
            if (url && url.indexOf('blob:') !== 0) {
                memberPhotos[n] = url;
            }
        }
    } catch (e) {
        console.warn('Failed to load photo cache', e);
    }
}

function saveStateForUndo() {
    var state = {
        durations: JSON.parse(JSON.stringify(memberDurations)),
        colors: JSON.parse(JSON.stringify(memberColors)),
        photos: JSON.parse(JSON.stringify(memberPhotos))
    };
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(state);
    historyIndex = historyStack.length - 1;
    if (historyStack.length > 30) {
        historyStack.shift();
        historyIndex--;
    }
}

function restoreState(state) {
    memberDurations = state.durations;
    memberColors = state.colors;
    memberPhotos = state.photos;
    reloadMemberStrip();
    reloadMemberList();
    updateTotalDuration();
    updateLeaderboardLive();
    saveAutoState();
}

function undoAction() {
    if (historyIndex <= 0) { showToast('Nothing to undo'); return; }
    historyIndex--;
    restoreState(historyStack[historyIndex]);
    showToast('↩ Undo');
}

function redoAction() {
    if (historyIndex >= historyStack.length - 1) { showToast('Nothing to redo'); return; }
    historyIndex++;
    restoreState(historyStack[historyIndex]);
    showToast('↪ Redo');
}

function saveAutoState() {
    var data = {
        durations: memberDurations,
        colors: memberColors,
        photos: memberPhotos,
        songTitle: document.getElementById('songTitle').value,
        timestamp: Date.now()
    };
    localStorage.setItem('linedistro_autosave', JSON.stringify(data));
}

function loadAutoState() {
    var raw = localStorage.getItem('linedistro_autosave');
    if (!raw) return false;
    try {
        var data = JSON.parse(raw);
        if (Date.now() - data.timestamp > 86400000) {
            localStorage.removeItem('linedistro_autosave');
            return false;
        }
        memberDurations = data.durations || {};
        memberColors = data.colors || {};
        memberPhotos = data.photos || {};
        document.getElementById('songTitle').value = data.songTitle || '';
        return true;
    } catch (e) { return false; }
}

function startAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(saveAutoState, 10000);
}
