// ══════════════════════════════════════════
//  UI MODUL — TOAST, CONFIRM, LEADERBOARD & PRESENTATION
// ══════════════════════════════════════════

var _undoTimer = null;
var _undoCallback = null;
var _confirmCallback = null;
var _promptCallback = null;

// ── TOAST AND NOTIFICATIONS ──
function showUndoToast(msg, onUndo, duration) {
    if (duration === undefined) duration = 3000;
    var t = document.getElementById('toast');
    t.innerHTML = '<span>' + msg + '</span><button class="toast-undo-btn" onclick="triggerUndo()">Undo</button>';
    t.style.display = 'flex';
    t.style.alignItems = 'center';
    t.style.gap = '12px';
    requestAnimationFrame(function() { t.classList.add('show'); });
    clearTimeout(t._timer);
    if (_undoTimer) clearTimeout(_undoTimer);
    _undoCallback = onUndo;
    _undoTimer = setTimeout(function() {
        _undoCallback = null;
        t.classList.remove('show');
        setTimeout(function() { t.style.display = 'none'; t.innerHTML = ''; }, 300);
    }, duration);
}

function triggerUndo() {
    clearTimeout(_undoTimer);
    var cb = _undoCallback;
    _undoCallback = null;
    var t = document.getElementById('toast');
    t.classList.remove('show');
    setTimeout(function() { t.style.display = 'none'; t.innerHTML = ''; }, 300);
    if (cb) cb();
}

function showToast(msg, duration) {
    if (duration === undefined) duration = 2800;
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    requestAnimationFrame(function() { t.classList.add('show'); });
    clearTimeout(t._timer);
    t._timer = setTimeout(function() {
        t.classList.remove('show');
        setTimeout(function() { t.style.display = 'none'; }, 300);
    }, duration);
}

// ── CONFIRMATION MODAL ──
function showConfirm(_ref) {
    var icon = _ref.icon !== undefined ? _ref.icon : '⚠️';
    var title = _ref.title !== undefined ? _ref.title : 'Konfirmasi';
    var msg = _ref.msg !== undefined ? _ref.msg : '';
    var okLabel = _ref.okLabel !== undefined ? _ref.okLabel : 'Ya';
    var okClass = _ref.okClass !== undefined ? _ref.okClass : 'btn-danger';
    var onOk = _ref.onOk;
    document.getElementById('confirmIcon').textContent = icon;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    var okBtn = document.getElementById('confirmOkBtn');
    okBtn.textContent = okLabel;
    okBtn.className = okClass;
    _confirmCallback = onOk;
    var modal = document.getElementById('confirmModal');
    modal.style.display = 'flex';
    modal.style.zIndex = '9999';
}

function closeConfirm() {
    var modal = document.getElementById('confirmModal');
    modal.style.display = 'none';
    modal.style.zIndex = '';
    _confirmCallback = null;
}

function confirmOk() {
    document.getElementById('confirmModal').style.display = 'none';
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
}

// ── PROMPT MODAL ──
function showPrompt(_ref2) {
    var icon = _ref2.icon !== undefined ? _ref2.icon : '✏️';
    var title = _ref2.title !== undefined ? _ref2.title : '';
    var sub = _ref2.sub !== undefined ? _ref2.sub : '';
    var placeholder = _ref2.placeholder !== undefined ? _ref2.placeholder : '';
    var onOk = _ref2.onOk;
    document.getElementById('promptTitle').textContent = title;
    document.getElementById('promptSub').textContent = sub;
    var inp = document.getElementById('promptInput');
    inp.placeholder = placeholder;
    inp.value = '';
    _promptCallback = onOk;
    document.getElementById('promptModal').style.display = 'flex';
    setTimeout(function() { inp.focus(); }, 100);
}

function closePrompt() {
    document.getElementById('promptModal').style.display = 'none';
    _promptCallback = null;
}

function confirmPrompt() {
    var val = document.getElementById('promptInput').value.trim();
    if (!val) { showToast('⚠️ Name cannot be empty'); return; }
    closePrompt();
    if (_promptCallback) _promptCallback(val);
}

// ── LEADERBOARD AND CARDS RENDER ──
function renderMemberCard(n, c, p, d) {
    var card = document.createElement('div');
    card.className = 'member-card';
    card.style.borderLeftColor = c;
    card.style.setProperty('--pulse-color', c + '66');
    card.dataset.name = n;
    card.innerHTML = '\n        <div class="member-card-inner">\n            <span class="rank-num">1</span>\n            <img src="' + p + '" class="member-avatar"\n                 style="border-color:' + c + '; box-shadow:0 0 10px 2px ' + c + '44; transition: transform 0.5s cubic-bezier(0.34, 1.3, 0.4, 1), box-shadow 0.4s ease, border-color 0.3s ease;"\n                 onerror="this.src=\'https://ui-avatars.com' + encodeURIComponent(n) + '&background=random\'">\n            <div class="member-text">\n                <div class="member-name-row">\n                    <span class="member-name">' + n + '</span>\n                    <div class="member-time-wrap">\n                        <span class="rec-dot" style="margin-right:4px;"></span>\n                        <span class="member-time" id="time-' + CSS.escape(n) + '">' + d.toFixed(1) + 's</span>\n                    </div>\n                </div>\n                <div class="member-bar-wrap">\n                    <div class="member-bar" id="bar-' + CSS.escape(n) + '"\n                         style="background:linear-gradient(90deg,' + c + '88,' + c + '); transform:scaleX(0); transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), background 0.3s ease, box-shadow 0.3s ease;"></div>\n                </div>\n            </div>\n            <div class="member-actions">\n                <button class="btn-sm" onclick="resetMember(\'' + n + '\')" title="Reset">↺</button>\n                <button class="btn-sm del" onclick="confirmDeleteMember(\'' + n + '\')" title="Delete">✕</button>\n            </div>\n        </div>';
    return card;
}

function reloadMemberList() {
    memberList.innerHTML = '';
    var names = Object.keys(memberDurations);
    var hint = document.getElementById('emptyHint');
    if (hint) hint.style.display = names.length === 0 ? 'flex' : 'none';
    var sorted = names.slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });
    for (var i = 0; i < sorted.length; i++) {
        var n = sorted[i];
        memberList.appendChild(renderMemberCard(n, memberColors[n], memberPhotos[n], memberDurations[n]));
    }
    applyRankStyles();
    if (typeof refreshEditDropdown === 'function') refreshEditDropdown();
    updateLeaderboardLive();
}

function applyRankStyles() {
    var all = document.querySelectorAll('.member-card');
    for (var j = 0; j < all.length; j++) {
        var card = all[j];
        card.classList.remove('rank-1', 'rank-2', 'rank-3');
        if (j === 0) card.classList.add('rank-1');
        if (j === 1) card.classList.add('rank-2');
        if (j === 2) card.classList.add('rank-3');
        var rankEl = card.querySelector('.rank-num');
        if (rankEl) rankEl.textContent = (j + 1);
    }
}

function updateLeaderboardLive() {
    var all = document.querySelectorAll('.member-card');
    var currentMax = 0;
    for (var i = 0; i < all.length; i++) {
        var val = memberDurations[all[i].dataset.name] || 0;
        if (val > currentMax) currentMax = val;
    }
    if (currentMax < 0.001) currentMax = 0.001;

    var activeMembers = getActiveMembers();
    var isDuet = activeMembers.length >= 2;
    var duetColors = isDuet ? activeMembers.map(function(n) { return memberColors[n] || '#a78bfa'; }) : [];
    var avgColor = isDuet ? getAverageColor(duetColors) : null;
    var gradientBar = isDuet ? getGradientForActive(duetColors) : null;
    var multiShadow = isDuet ? getMultiShadow(duetColors, 0.6) : '';

    for (var j = 0; j < all.length; j++) {
        var card = all[j];
        var n = card.dataset.name;
        var el = card.querySelector('.member-time');
        if (el) el.textContent = (memberDurations[n] || 0).toFixed(1) + 's';
        var avatar = card.querySelector('.member-avatar');
        var isActive = !!memberIntervals[n];
        var c = memberColors[n] || '#a78bfa';
        var isInDuet = isDuet && isActive;

        if (isActive) {
            if (!card.classList.contains('is-active')) card.classList.add('is-active');
            if (avatar) {
                if (isInDuet) {
                    avatar.style.transition = 'transform 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out';
                    avatar.style.transform = 'scale(1.18)';
                    avatar.style.borderColor = avgColor;
                    avatar.style.boxShadow = '0 0 22px 6px ' + avgColor + '66, ' + multiShadow;
                } else {
                    avatar.style.transition = 'transform 0.15s ease-out, box-shadow 0.15s ease-out, border-color 0.15s ease-out';
                    avatar.style.transform = 'scale(1.18)';
                    avatar.style.borderColor = c;
                    avatar.style.boxShadow = '0 0 22px 6px ' + c + '66';
                }
                _avatarState[n] = 'active';
            }
        } else {
            if (card.classList.contains('is-active')) {
                card.classList.remove('is-active');
                void card.offsetWidth;
            }
            if (avatar) {
                if (_avatarState[n] !== 'inactive') {
                    avatar.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.3, 0.4, 1), box-shadow 0.4s ease, border-color 0.3s ease';
                    avatar.style.transform = 'scale(1)';
                    avatar.style.borderColor = c;
                    avatar.style.boxShadow = '0 0 10px 2px ' + c + '44';
                    _avatarState[n] = 'inactive';
                }
            }
        }

                var bar = card.querySelector('.member-bar');
        if (bar) {
            var pct = (memberDurations[n] || 0) / currentMax;
            if (pct > 1) pct = 1;
            bar.style.transform = 'scaleX(' + pct + ')';
            if (isInDuet) {
                bar.style.background = gradientBar;
                bar.style.boxShadow = '0 0 12px ' + avgColor;
            } else {
                bar.style.background = 'linear-gradient(90deg, ' + c + '88, ' + c + ')';
                bar.style.boxShadow = '';
            }
        }
    }
}

function reorderLeaderboard() {
    if (_reorderPending) return;
    _reorderPending = true;
    requestAnimationFrame(function() {
        _reorderPending = false;
        var cards = document.querySelectorAll('.member-card');
        if (cards.length === 0) return;

        var sortedNames = Object.keys(memberDurations).slice().sort(function(a, b) { return memberDurations[b] - memberDurations[a]; });
        var currentOrder = [];
        for (var i = 0; i < cards.length; i++) currentOrder.push(cards[i].dataset.name);
        
        var same = true;
        if (currentOrder.length === sortedNames.length) {
            for (var j = 0; j < sortedNames.length; j++) {
                if (currentOrder[j] !== sortedNames[j]) { same = false; break; }
            }
        } else { same = false; }
        if (same) return;

        var firstRects = {};
        for (var k = 0; k < cards.length; k++) firstRects[cards[k].dataset.name] = cards[k].getBoundingClientRect();

        var memberListEl = document.getElementById('memberList');
        for (var l = 0; l < sortedNames.length; l++) {
            var n = sortedNames[l];
            var card = null;
            for (var m = 0; m < cards.length; m++) {
                if (cards[m].dataset.name === n) { card = cards[m]; break; }
            }
            if (card) memberListEl.appendChild(card);
        }
        applyRankStyles();

        for (var o = 0; o < sortedNames.length; o++) {
            var name = sortedNames[o];
            var card2 = null;
            for (var p = 0; p < cards.length; p++) {
                if (cards[p].dataset.name === name) { card2 = cards[p]; break; }
            }
            if (!card2) continue;
            var first = firstRects[name];
            var last = card2.getBoundingClientRect();
            if (!first) continue;
            var dy = first.top - last.top;
            if (Math.abs(dy) < 1) continue;
            card2.style.transition = 'transform 0s';
            card2.style.transform = 'translateY(' + dy + 'px)';
            requestAnimationFrame(function(cardRef) {
                return function() {
                    requestAnimationFrame(function() {
                        cardRef.style.transition = 'transform 0.8s cubic-bezier(0.2, 1, 0.3, 1)';
                        cardRef.style.transform = '';
                    });
                };
            }(card2));
        }
    });
}
