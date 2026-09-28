// ══════════════════════════════════════════
//  UTILS MODUL — FUNGSI PEMBANTU & MATEMATIKA
// ══════════════════════════════════════════

// ── PHOTO CONVERTER ──
function fileToBase64(file) {
    return new Promise(function(resolve, reject) {
        var img = new Image();
        var objectUrl = URL.createObjectURL(file);
        img.onload = function() {
            var MAX = 256;
            var w = img.width;
            var h = img.height;
            if (w > h) {
                if (w > MAX) { h = Math.round(h * MAX / w);
                    w = MAX; }
            } else {
                if (h > MAX) { w = Math.round(w * MAX / h);
                    h = MAX; }
            }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(objectUrl);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = function() {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Gagal memuat gambar'));
        };
        img.src = objectUrl;
    });
}

// ── TIME FORMATTER ──
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

// ── DUET / GROUP SINGING HELPER ──
function getGradientForActive(colors) {
    if (!colors || colors.length === 0) return '';
    if (colors.length === 1) return colors[0];
    var stops = colors.map(function(c, i) {
        var pct = (i / (colors.length - 1)) * 100;
        return c + ' ' + pct + '%';
    });
    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
}

function getAverageColor(colors) {
    if (!colors || colors.length === 0) return '#a78bfa';
    if (colors.length === 1) return colors[0];
    var r = 0, g = 0, b = 0;
    for (var i = 0; i < colors.length; i++) {
        var hex = colors[i].replace('#', '');
        var bigint = parseInt(hex, 16);
        r += (bigint >> 16) & 255;
        g += (bigint >> 8) & 255;
        b += bigint & 255;
    }
    r = Math.round(r / colors.length);
    g = Math.round(g / colors.length);
    b = Math.round(b / colors.length);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getMultiShadow(colors, intensity) {
    if (intensity === undefined) intensity = 0.5;
    if (!colors || colors.length === 0) return '';
    return colors.map(function(c) {
        var alpha = Math.round(intensity * 80).toString(16).padStart(2, '0');
        return '0 0 12px 2px ' + c + alpha;
    }).join(', ');
}

// ── FAIRNESS CALCULATION (Gini Coefficient) ──
function calculateFairness(durations) {
    var values = [];
    for (var key in durations) {
        values.push(durations[key]);
    }
    if (values.length === 0) return { gini: 0, fairness: 100 };
    var sorted = values.slice().sort(function(a, b) { return a - b; });
    var n = sorted.length;
    var sum = 0;
    for (var i = 0; i < n; i++) sum += sorted[i];
    if (sum === 0) return { gini: 0, fairness: 100 };
    var sumIndex = 0;
    for (var j = 0; j < n; j++) {
        sumIndex += (j + 1) * sorted[j];
    }
    var gini = (2 * sumIndex) / (n * sum) - (n + 1) / n;
    if (gini < 0) gini = 0;
    if (gini > 1) gini = 1;
    var fairness = (1 - gini) * 100;
    return { gini: gini, fairness: fairness };
}
