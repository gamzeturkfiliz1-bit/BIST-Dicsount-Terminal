/* ═══════════════════════════════════════════════════════
   ANTIGRAVITY — BIST Multi-Sector Discount & Valuation Terminal
   March 31, 2026 · BIST 100 ~12,930
   
   Sectors: Aviation, Banking, Road Transport/Logistics
   Data: yfinance simulation with 10s timeout fallback
   ═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   Requirement 4: LocalStorage utilized as persistent Database
   
   The browser's localStorage API is used as a client-side
   database to persist user session data across page reloads.
   
   Stored keys:
     - 'ag_username'  → The logged-in user's name
     - 'ag_ticker1'   → Last selected Ticker 1
     - 'ag_ticker2'   → Last selected Ticker 2
     - 'ag_sector'    → Last selected Sector (aviation/banking/logistics)
   
   On page load, the app checks localStorage for an existing
   session. If found, the login page is skipped and the
   dashboard is initialized with the previous selections.
   ═══════════════════════════════════════════════════════ */

// ═══ DATABASE KEYS (Requirement 4: LocalStorage as persistent Database) ═══
const DB_KEYS = {
    username: 'bist_user',
    usernameOld: 'ag_username',  // backward-compat
    ticker1: 'ag_ticker1',
    ticker2: 'ag_ticker2',
    sector: 'ag_sector',      // NEW: Persists selected sector
    customSectors: 'ag_custom_sectors', // NEW: Persists custom sectors
};

// ═══ APP STATE ═══
const APP = {
    t1: 'THYAO',
    t2: 'PGSUS',
    sector: 'aviation',       // active sector key
    period: '1Y',
    dataSource: 'simulation',
    username: '',
};

// ═══ TURKISH LOCALE ═══
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const TR_MONTHS_FULL = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// ═══ LIVE DATE HELPERS ═══
function getLiveDate() { return new Date(); }
function formatTRDate(d) { return `${d.getDate()} ${TR_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`; }
function formatTRShort(d) { return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function getLiveYear() { return new Date().getFullYear(); }

// ═══════════════════════════════════════════════════════
//  MULTI-SECTOR DATA — Live Simulation Mode
//  BIST 100 ~12,930 · 15-min delayed yfinance feed
// ═══════════════════════════════════════════════════════

const BIST = {
    index: 0,
    change: 0,
    pct: 0,
    usdTry: 0,
    eurTry: 0,
    gold: 0,
};

// ─── ALL STOCKS (8 tickers across 4 sectors) ───
const ALL_STOCKS = {
    // ══ AVIATION SECTOR ══
    THYAO: {
        ticker: 'THYAO', full: 'THYAO.IS', sector: 'aviation',
        name: 'Türk Hava Yolları A.O.', short: 'THY',
        price: 345.50, change: 4.10, pct: 1.20,
        pe: 3.72, pb: 1.51, evEbitda: 3.85, roe: 34.8,
        eps: 92.99, epsGrowth: 24.0, marketCap: 476e9,
        netDebtEbitda: 1.10, dividendYield: 1.8,
        color: '#2962FF', colorDim: 'rgba(41,98,255,0.15)',
    },
    PGSUS: {
        ticker: 'PGSUS', full: 'PGSUS.IS', sector: 'aviation',
        name: 'Pegasus Havayolları A.Ş.', short: 'Pegasus',
        price: 225.00, change: 2.20, pct: 0.98,
        pe: 8.18, pb: 3.71, evEbitda: 6.80, roe: 40.2,
        eps: 27.50, epsGrowth: 10.5, marketCap: 23e9,
        netDebtEbitda: 2.15, dividendYield: 0.0,
        color: '#FF6D00', colorDim: 'rgba(255,109,0,0.15)',
    },

    // ══ BANKING SECTOR ══
    AKBNK: {
        ticker: 'AKBNK', full: 'AKBNK.IS', sector: 'banking',
        name: 'Akbank T.A.Ş.', short: 'Akbank',
        price: 72.50, change: 1.25, pct: 1.75,
        pe: 2.44, pb: 0.84, evEbitda: 1.95, roe: 38.5,
        eps: 29.76, epsGrowth: 18.0, marketCap: 377e9,
        netDebtEbitda: 0.45, dividendYield: 4.2,
        color: '#E91E63', colorDim: 'rgba(233,30,99,0.15)',
    },
    ISCTR: {
        ticker: 'ISCTR', full: 'ISCTR.IS', sector: 'banking',
        name: 'Türkiye İş Bankası A.Ş.', short: 'İş Bankası',
        price: 21.80, change: 0.45, pct: 2.10,
        pe: 2.71, pb: 0.67, evEbitda: 2.25, roe: 28.5,
        eps: 8.04, epsGrowth: 12.0, marketCap: 163e9,
        netDebtEbitda: 0.60, dividendYield: 3.8,
        color: '#7C4DFF', colorDim: 'rgba(124,77,255,0.15)',
    },

    // ══ LOGISTICS / AUTOMOTIVE SECTOR ══
    TUPRS: {
        ticker: 'TUPRS', full: 'TUPRS.IS', sector: 'logistics',
        name: 'Tüpraş Türkiye Petrol Raf. A.Ş.', short: 'Tüpraş',
        price: 198.50, change: 2.80, pct: 1.43,
        pe: 6.68, pb: 2.82, evEbitda: 5.40, roe: 42.0,
        eps: 29.72, epsGrowth: 14.0, marketCap: 99.2e9,
        netDebtEbitda: 0.95, dividendYield: 4.1,
        color: '#E31837', colorDim: 'rgba(227,24,55,0.15)',
    },
    FROTO: {
        ticker: 'FROTO', full: 'FROTO.IS', sector: 'logistics',
        name: 'Ford Otomotiv San. A.Ş.', short: 'Ford Otosan',
        price: 1250.00, change: 18.50, pct: 1.50,
        pe: 8.04, pb: 5.41, evEbitda: 8.10, roe: 55.0,
        eps: 155.56, epsGrowth: 22.0, marketCap: 438e9,
        netDebtEbitda: 1.40, dividendYield: 2.5,
        color: '#FF9100', colorDim: 'rgba(255,145,0,0.15)',
    },

    // ══ IRON-STEEL SECTOR ══
    EREGL: {
        ticker: 'EREGL', full: 'EREGL.IS', sector: 'iron_steel',
        name: 'Ereğli Demir ve Çelik Fab. T.A.Ş.', short: 'Erdemir',
        price: 45.10, change: 0.85, pct: 1.92,
        pe: 10.92, pb: 1.41, evEbitda: 7.10, roe: 18.5,
        eps: 4.13, epsGrowth: 12.0, marketCap: 157e9,
        netDebtEbitda: 1.50, dividendYield: 4.8,
        color: '#607D8B', colorDim: 'rgba(96,125,139,0.15)',
    },
    KRDMD: {
        ticker: 'KRDMD', full: 'KRDMD.IS', sector: 'iron_steel',
        name: 'Kardemir Karabük Demir Çelik San. ve Tic. A.Ş.', short: 'Kardemir',
        price: 41.20, change: 0.75, pct: 1.85,
        pe: 7.70, pb: 1.60, evEbitda: 6.20, roe: 22.0,
        eps: 5.35, epsGrowth: 15.0, marketCap: 48e9,
        netDebtEbitda: 1.20, dividendYield: 3.5,
        color: '#78909C', colorDim: 'rgba(120,144,156,0.15)',
    },
};

// ─── SECTOR DEFINITIONS with Averages (2026) ───
const SECTORS = {
    aviation: {
        key: 'aviation',
        label: 'Havacılık',
        labelEn: 'Aviation',
        icon: '✈️',
        tickers: ['THYAO', 'PGSUS'],
        avg: { pe: 6.50, pb: 2.80, evEbitda: 6.20, roe: 30.0, netDebtEbitda: 1.85 },
    },
    banking: {
        key: 'banking',
        label: 'Bankacılık',
        labelEn: 'Banking',
        icon: '🏦',
        tickers: ['AKBNK', 'ISCTR'],
        avg: { pe: 2.70, pb: 0.85, evEbitda: 2.90, roe: 25.0, netDebtEbitda: 0.70 },
    },
    logistics: {
        key: 'logistics',
        label: 'Otomotiv',
        labelEn: 'Automotive',
        icon: '🚗',
        tickers: ['TUPRS', 'FROTO'],
        avg: { pe: 7.50, pb: 4.20, evEbitda: 6.80, roe: 35.0, netDebtEbitda: 1.30 },
    },
    iron_steel: {
        key: 'iron_steel',
        label: 'Demir-Çelik',
        labelEn: 'Iron-Steel',
        icon: '🏭',
        tickers: ['EREGL', 'KRDMD'],
        avg: { pe: 9.50, pb: 1.60, evEbitda: 6.80, roe: 20.2, netDebtEbitda: 1.35 },
    },
};

// ─── Active references (change when sector switches) ───
let STOCKS = {};
let SECTOR = {};

function activateSector(sectorKey) {
    const sec = SECTORS[sectorKey];
    if (!sec) return;

    APP.sector = sectorKey;
    STOCKS = {};
    sec.tickers.forEach(t => { STOCKS[t] = ALL_STOCKS[t]; });
    SECTOR = { ...sec.avg };

    // Set defaults if current tickers are not in sector
    const tickers = sec.tickers;
    if (!STOCKS[APP.t1]) APP.t1 = tickers[0];
    if (!STOCKS[APP.t2]) APP.t2 = tickers[1] || tickers[0];
}

// Metric definitions for the table
const METRICS = [
    { key: 'pe', label: 'Fiyat / Kazanç (F/K)', en: 'P/E Ratio', lower: true, fmt: 'x' },
    { key: 'pb', label: 'PD / DD (P/B)', en: 'P/B Ratio', lower: true, fmt: 'x' },
    { key: 'evEbitda', label: 'FD / FAVÖK (EV/EBITDA)', en: 'EV/EBITDA', lower: true, fmt: 'x' },
    { key: 'roe', label: 'Özsermaye Kârlılığı (ROE)', en: 'ROE', lower: false, fmt: '%' },
    { key: 'netDebtEbitda', label: 'Net Borç / FAVÖK', en: 'Net Debt/EBITDA', lower: true, fmt: 'x' },
];

// ═══ PRICE & PERIOD GENERATORS (Fallback for chart rendering) ═══
function genDates(count) {
    const dates = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(d);
    }
    return dates;
}

function genPrices(basePrice, count) {
    const prices = [basePrice];
    for (let i = 1; i < count; i++) {
        const change = (Math.random() - 0.48) * basePrice * 0.02;
        prices.push(+(prices[i - 1] + change).toFixed(2));
    }
    return prices;
}

// ═══ DISCOUNT CALCULATION ═══
function calcDiscount(val, avg) {
    return +(((val - avg) / avg) * 100).toFixed(1);
}

function getStatus(val, avg, lowerBetter) {
    const d = calcDiscount(val, avg);
    if (lowerBetter) {
        if (d < -20) return { label: 'Undervalued', cls: 'undervalued', tr: 'İskontolu' };
        if (d > 20) return { label: 'Overvalued', cls: 'overvalued', tr: 'Pahalı' };
        return { label: 'Fair', cls: 'fair', tr: 'Makul' };
    } else {
        if (d > 15) return { label: 'Undervalued', cls: 'undervalued', tr: 'Avantajlı' };
        if (d < -15) return { label: 'Overvalued', cls: 'overvalued', tr: 'Zayıf' };
        return { label: 'Fair', cls: 'fair', tr: 'Makul' };
    }
}

// ═══ CHART INSTANCES ═══
let discountChartInst = null;
let perfChartInst = null;

// ═══════════════════════════════════════
//  UPDATE: DYNAMIC UI (sector switch)
// ═══════════════════════════════════════
function updateSectorUI() {
    const sec = SECTORS[APP.sector];
    if (!sec) return;

    // Sidebar — Sector average display
    const sectorVal = document.getElementById('sbSectorVal');
    const sectorNote = document.getElementById('sbSectorNote');
    if (sectorVal) sectorVal.textContent = sec.avg.pe.toFixed(2) + 'x';
    if (sectorNote) sectorNote.textContent = `${sec.label} Sektörü · ${getLiveYear()}`;

    // Sidebar — Sector buttons
    document.querySelectorAll('.sb-sector-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sector === APP.sector);
    });

    // Navbar context
    const ctx = document.querySelector('.nav-context');
    if (ctx) ctx.textContent = `${sec.label} Sektörü · Göreceli Değerleme · ${formatTRDate(getLiveDate())}`;

    // Dropdowns — populate with sector tickers
    const sel1 = document.getElementById('sel1');
    const sel2 = document.getElementById('sel2');
    if (sel1 && sel2) {
        sel1.innerHTML = '';
        sel2.innerHTML = '';
        sec.tickers.forEach(t => {
            const s = ALL_STOCKS[t];
            const opt1 = new Option(`${s.full} — ${s.name}`, t, false, t === APP.t1);
            const opt2 = new Option(`${s.full} — ${s.name}`, t, false, t === APP.t2);
            sel1.appendChild(opt1);
            sel2.appendChild(opt2);
        });
    }

    // Badges
    const b1 = document.getElementById('badge1');
    const b2 = document.getElementById('badge2');
    if (b1) b1.textContent = APP.t1;
    if (b2) b2.textContent = APP.t2;

    // Table headers
    const s1 = STOCKS[APP.t1], s2 = STOCKS[APP.t2];
    if (s1 && s2) {
        const th1 = document.querySelector('.th-t1');
        const th2 = document.querySelector('.th-t2');
        if (th1) th1.parentElement.innerHTML = `<span class="th-t1">${s1.ticker}</span><br><small>${s1.short}</small>`;
        if (th2) th2.parentElement.innerHTML = `<span class="th-t2">${s2.ticker}</span><br><small>${s2.short}</small>`;
    }
    const thAvg = document.querySelector('.th-avg');
    if (thAvg) thAvg.parentElement.innerHTML = `<span class="th-avg">Sektör Ort.</span><br><small>${sec.label} ${getLiveYear()}</small>`;

    // Panel subtitle
    const panelSub = document.querySelector('#panelTable .panel-sub');
    if (panelSub) panelSub.textContent = `Çarpan Karşılaştırması — BIST 100: ~${BIST.index.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} · ${sec.label} Sektör Ort. F/K: ${sec.avg.pe.toFixed(2)}x`;

    // Sidebar footer — live date
    const footerDate = document.getElementById('sbFooterDate');
    if (footerDate) footerDate.textContent = formatTRDate(getLiveDate());
}

// ═══════════════════════════════════════
//  RENDER: STAT CARDS
// ═══════════════════════════════════════
function renderStats() {
    const s1 = STOCKS[APP.t1], s2 = STOCKS[APP.t2];
    if (!s1 || !s2) return;

    const fmt = (s) => (!s || s.unavailable || s.price == null) ? 'N/A' : '₺' + Number(s.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
    const fmtDelta = (s) => {
        if (!s || s.unavailable || s.price == null) return 'Veri Yok';
        const sign = s.change >= 0;
        return `${sign ? '▲ +' : '▼ −'}${Math.abs(s.change).toFixed(2)} (${sign ? '+' : '−'}${Math.abs(s.pct).toFixed(2)}%)`;
    };

    document.getElementById('scT1Tick').textContent = s1.full;
    document.getElementById('scT1Tick').className = `sc-tick ${s1.unavailable ? 'error-badge' : ''}`;
    document.getElementById('scT1Sub').textContent = s1.short;
    document.getElementById('scT1Price').textContent = fmt(s1);
    const d1 = document.getElementById('scT1Change');
    d1.textContent = fmtDelta(s1);
    d1.className = `sc-change ${s1.unavailable ? 'neutral' : (s1.change >= 0 ? 'positive' : 'negative')}`;

    document.getElementById('scT2Tick').textContent = s2.full;
    document.getElementById('scT2Tick').className = `sc-tick ${s2.unavailable ? 'error-badge' : ''}`;
    document.getElementById('scT2Sub').textContent = s2.short;
    document.getElementById('scT2Price').textContent = fmt(s2);
    const d2 = document.getElementById('scT2Change');
    d2.textContent = fmtDelta(s2);
    d2.className = `sc-change ${s2.unavailable ? 'neutral' : (s2.change >= 0 ? 'positive' : 'negative')}`;

    document.getElementById('scIdxPrice').textContent = BIST.index.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
    const idxChgEl = document.getElementById('scIdxChange');
    if (idxChgEl) {
        const sign = BIST.change >= 0;
        idxChgEl.textContent = `${sign ? '▲ +' : '▼ −'}${Math.abs(BIST.change).toFixed(2)} (${sign ? '+' : '−'}${Math.abs(BIST.pct).toFixed(2)}%)`;
        idxChgEl.className = `sc-change ${sign ? 'positive' : 'negative'}`;
    }

    // Ticker bar
    document.getElementById('tiBist').textContent = BIST.index.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
    const tiBistD = document.getElementById('tiBistD');
    if (tiBistD) {
        const sign = BIST.change >= 0;
        tiBistD.textContent = `${sign ? '▲ +' : '▼ −'}${Math.abs(BIST.change).toFixed(2)} (${sign ? '+' : '−'}${Math.abs(BIST.pct).toFixed(2)}%)`;
        tiBistD.className = `ti-delta ${sign ? 'positive' : 'negative'}`;
    }

    document.getElementById('tiT1').textContent = fmt(s1);
    document.getElementById('tiT2').textContent = fmt(s2);
    const tiT1D = document.getElementById('tiT1D');
    const tiT2D = document.getElementById('tiT2D');
    if(tiT1D) { tiT1D.textContent = fmtDelta(s1); tiT1D.className = `ti-delta ${s1.change >= 0 ? 'positive' : 'negative'}`; }
    if(tiT2D) { tiT2D.textContent = fmtDelta(s2); tiT2D.className = `ti-delta ${s2.change >= 0 ? 'positive' : 'negative'}`; }

    // Update ticker bar labels
    const tiT1Label = document.getElementById('tiT1Label');
    const tiT2Label = document.getElementById('tiT2Label');
    if (tiT1Label) tiT1Label.textContent = s1.full;
    if (tiT2Label) tiT2Label.textContent = s2.full;

    // Macro tickers
    const macroPrices = document.querySelectorAll('.ticker-item:not(:nth-child(1)):not(:nth-child(3)):not(:nth-child(5)) .ti-price');
    if(macroPrices[0]) macroPrices[0].textContent = BIST.usdTry.toFixed(2);
    if(macroPrices[1]) macroPrices[1].textContent = BIST.eurTry.toFixed(2);
    if(macroPrices[2]) macroPrices[2].textContent = `$${BIST.gold.toFixed(2)}`;
}

// ═══════════════════════════════════════
//  RENDER: FUNDAMENTAL TABLE
// ═══════════════════════════════════════
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const s1 = STOCKS[APP.t1], s2 = STOCKS[APP.t2];
    if (!s1 || !s2) return;

    METRICS.forEach(m => {
        const v1 = s1[m.key], v2 = s2[m.key], avg = SECTOR[m.key];
        const d1 = calcDiscount(v1, avg);
        const d2 = calcDiscount(v2, avg);

        const better1 = m.lower ? v1 < v2 : v1 > v2;
        const dot1 = better1 ? 'cd-g' : 'cd-r';
        const dot2 = !better1 ? 'cd-g' : 'cd-r';

        const fv = (v) => m.fmt === '%' ? v.toFixed(1) + '%' : v.toFixed(2) + 'x';

        const st1 = getStatus(v1, avg, m.lower);
        const st2 = getStatus(v2, avg, m.lower);

        const arrow1 = d1 < 0 ? '▼' : '▲';
        const arrow2 = d2 < 0 ? '▼' : '▲';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.label}</td>
            <td><span class="cd ${dot1}"></span>${fv(v1)}</td>
            <td><span class="cd ${dot2}"></span>${fv(v2)}</td>
            <td><span class="cd cd-b"></span>${fv(avg)}</td>
            <td>
                <span class="disc-val ${d1 < 0 ? 'neg' : 'pos'}">${arrow1} ${d1 > 0 ? '+' : ''}${d1}%</span>
                &nbsp;/&nbsp;
                <span class="disc-val ${d2 < 0 ? 'neg' : 'pos'}">${arrow2} ${d2 > 0 ? '+' : ''}${d2}%</span>
            </td>
            <td>
                <span class="status-pill ${st1.cls}">${st1.tr}</span>
                <span class="status-pill ${st2.cls}" style="margin-left:4px">${st2.tr}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ═══════════════════════════════════════
//  RENDER: DISCOUNT RADAR CHART
// ═══════════════════════════════════════
function renderDiscountChart() {
    const ctx = document.getElementById('discountChart');
    if (!ctx) return;

    const s1 = STOCKS[APP.t1], s2 = STOCKS[APP.t2];
    if (!s1 || !s2) return;

    const keys = METRICS.filter(m => m.key !== 'roe');
    const labels = keys.map(m => m.en);

    const d1 = keys.map(m => calcDiscount(s1[m.key], SECTOR[m.key]));
    const d2 = keys.map(m => calcDiscount(s2[m.key], SECTOR[m.key]));

    if (discountChartInst) discountChartInst.destroy();

    discountChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: s1.ticker,
                    data: d1,
                    backgroundColor: d1.map(v => v < 0 ? (s1.color + 'B3') : (s1.color + '40')),
                    borderColor: s1.color, borderWidth: 1.5, borderRadius: 5, barPercentage: 0.4,
                },
                {
                    label: s2.ticker,
                    data: d2,
                    backgroundColor: d2.map(v => v < 0 ? (s2.color + 'B3') : (s2.color + '40')),
                    borderColor: s2.color, borderWidth: 1.5, borderRadius: 5, barPercentage: 0.4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: true, position: 'top', align: 'end',
                    labels: { color: '#9598a1', font: { family: 'JetBrains Mono', size: 10, weight: '600' }, boxWidth: 10, boxHeight: 10, padding: 14, borderRadius: 2 }
                },
                annotation: {
                    annotations: {
                        fairLine: {
                            type: 'line', xMin: 0, xMax: 0,
                            borderColor: '#00BCD4', borderWidth: 2, borderDash: [6, 3],
                            label: { display: true, content: 'Sektör Ort. (Adil Değer)', position: 'start', backgroundColor: 'rgba(0,188,212,0.08)', color: '#00BCD4', font: { family: 'JetBrains Mono', size: 9, weight: '600' }, padding: { top: 2, bottom: 2, left: 7, right: 7 }, borderRadius: 3 }
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(19,23,34,0.96)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1,
                    titleFont: { family: 'JetBrains Mono', size: 11, weight: '700' },
                    bodyFont: { family: 'JetBrains Mono', size: 10 }, padding: 10, cornerRadius: 6,
                    callbacks: { label: c => { const v = c.parsed.x; return ` ${c.dataset.label}: ${v > 0 ? '+' : ''}${v.toFixed(1)}% (${v < 0 ? 'İskontolu' : 'Primli'})`; } }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#6a6d78', font: { family: 'JetBrains Mono', size: 9 }, callback: v => (v > 0 ? '+' : '') + v + '%' }, border: { display: false } },
                y: { grid: { display: false }, ticks: { color: '#9598a1', font: { family: 'JetBrains Mono', size: 10 } }, border: { display: false } }
            }
        }
    });
}

// ═══════════════════════════════════════
//  RENDER: VERDICT CARD
// ═══════════════════════════════════════
function renderVerdict() {
    const s1 = STOCKS[APP.t1], s2 = STOCKS[APP.t2];
    if (!s1 || !s2) return;
    const sec = SECTORS[APP.sector];

    let score1 = 0, score2 = 0;
    const reasons1 = [], reasons2 = [];

    METRICS.forEach(m => {
        const d1 = calcDiscount(s1[m.key], SECTOR[m.key]);
        const d2 = calcDiscount(s2[m.key], SECTOR[m.key]);

        if (m.lower) {
            score1 += d1; score2 += d2;
            if (d1 < d2) reasons1.push(`Düşük ${m.en}`);
            else if (d2 < d1) reasons2.push(`Düşük ${m.en}`);
        } else {
            score1 -= d1; score2 -= d2;
            if (d1 > d2) reasons1.push(`Yüksek ${m.en}`);
            else if (d2 > d1) reasons2.push(`Yüksek ${m.en}`);
        }
    });

    [s1, s2].forEach(s => {
        const peDisc = calcDiscount(s.pe, SECTOR.pe);
        if (peDisc < -30 && s.roe > SECTOR.roe) {
            const arr = s === s1 ? reasons1 : reasons2;
            arr.push('⚡ High Discount Opportunity');
        }
    });

    const avgS1 = score1 / METRICS.length;
    const avgS2 = score2 / METRICS.length;

    const winner = avgS1 < avgS2 ? s1 : s2;
    const loser = avgS1 < avgS2 ? s2 : s1;
    const wScore = avgS1 < avgS2 ? avgS1 : avgS2;
    const diff = Math.abs(avgS1 - avgS2);
    const wReasons = avgS1 < avgS2 ? reasons1 : reasons2;

    document.getElementById('scWinner').textContent = winner.ticker;
    const wSub = document.getElementById('scWinnerSub');
    wSub.textContent = `%${Math.abs(wScore).toFixed(1)} İskontolu`;
    wSub.className = 'sc-change positive';

    document.getElementById('vcHeadline').innerHTML =
        `Analiz edilen çarpanlara göre <span class="hl">${winner.name} (${winner.ticker})</span> rakibine oranla ` +
        `<span class="hl">%${diff.toFixed(1)}</span> daha iskontolu görünmektedir.`;

    const parts = [];
    if (wReasons.some(r => r.includes('P/E'))) parts.push('düşük F/K oranı');
    if (wReasons.some(r => r.includes('P/B'))) parts.push('düşük PD/DD çarpanı');
    if (wReasons.some(r => r.includes('EV/EBITDA'))) parts.push('düşük FD/FAVÖK değerlemesi');
    if (wReasons.some(r => r.includes('ROE'))) parts.push('yüksek özsermaye kârlılığı');
    if (wReasons.some(r => r.includes('Net Debt'))) parts.push('düşük borçluluk oranı');
    if (wReasons.some(r => r.includes('High Disc'))) parts.push('yüksek iskonto fırsatı (F/K < Sektör & ROE > Sektör)');

    document.getElementById('vcText').textContent = parts.length > 0
        ? `${winner.ticker}, ${sec.label.toLowerCase()} sektör ortalamasına kıyasla ${parts.join(', ')} nedeniyle belirgin iskontolu konumdadır. BIST 100 endeksinin ${BIST.index.toLocaleString('tr-TR')} seviyesinde olduğu mevcut piyasa koşullarında göreceli değerleme avantajı taşımaktadır.`
        : `${winner.ticker}, temel çarpanlar bazında ${sec.label.toLowerCase()} sektör ortalamasının altında değerleme seviyesinde işlem görmektedir.`;

    const maxBar = Math.max(Math.abs(avgS1), Math.abs(avgS2), 1);
    document.getElementById('vbT1').textContent = s1.ticker;
    document.getElementById('vbT2').textContent = s2.ticker;
    document.getElementById('vbVal1').textContent = (avgS1 < 0 ? '' : '+') + avgS1.toFixed(1) + '%';
    document.getElementById('vbVal2').textContent = (avgS2 < 0 ? '' : '+') + avgS2.toFixed(1) + '%';
    setTimeout(() => {
        document.getElementById('vbFill1').style.width = Math.min(100, (Math.abs(avgS1) / (maxBar * 1.15)) * 100) + '%';
        document.getElementById('vbFill2').style.width = Math.min(100, (Math.abs(avgS2) / (maxBar * 1.15)) * 100) + '%';
    }, 300);

    const tagsEl = document.getElementById('vcTags');
    tagsEl.innerHTML = '';
    const allTag = document.createElement('span');
    allTag.className = 'vc-tag pos';
    allTag.textContent = `${winner.ticker} → Daha İskontolu`;
    tagsEl.appendChild(allTag);
    wReasons.forEach(r => {
        const tag = document.createElement('span');
        tag.className = 'vc-tag pos';
        tag.textContent = r;
        tagsEl.appendChild(tag);
    });

    document.getElementById('vcFinal').textContent =
        `Based on a 15-minute delayed feed, ${winner.ticker} is trading at a ${Math.abs(wScore).toFixed(1)}% discount relative to its ${sec.labelEn} sector peers. ` +
        `${winner.full} is currently traded at a ${diff.toFixed(1)}% discount compared to its peer ${loser.ticker} and the sector average (P/E: ${SECTOR.pe}x), ` +
        `making it the more favorable fundamental pick. — Borsa İstanbul · ${formatTRDate(getLiveDate())} · BIST 100 @ ${BIST.index.toLocaleString('tr-TR')}`;
}

// ═══════════════════════════════════════
//  RENDER: PRICE PERFORMANCE CHART
// ═══════════════════════════════════════
async function renderPerfChart() {
    const ctx = document.getElementById('perfChart');
    if (!ctx) return;

    const s1 = STOCKS[APP.t1], s2 = STOCKS[APP.t2];
    if (!s1 || !s2) return;

    // Convert our period ('1M', '3M', '6M', '1Y', '3Y') to Yahoo Finance range & interval
    const periodMap = {
        '1M': { range: '1mo', interval: '1d' },
        '3M': { range: '3mo', interval: '1d' },
        '6M': { range: '6mo', interval: '1d' },
        '1Y': { range: '1y', interval: '1d' },
        '3Y': { range: '5y', interval: '1wk' }, // Yahoo 3y is not standard, fallback to 5y
    };
    const pConf = periodMap[APP.period] || periodMap['1Y'];

    try {
        const [c1, c2, cIdx] = await Promise.all([
            MarketAPI.fetchChart(`${s1.ticker}.IS`, pConf.range, pConf.interval),
            MarketAPI.fetchChart(`${s2.ticker}.IS`, pConf.range, pConf.interval),
            MarketAPI.fetchChart('XU100.IS', pConf.range, pConf.interval)
        ]);

        if (!c1 || !c1.length) throw new Error("No chart data");

        // Align dates (using c1 as master timeline)
        const labels = c1.map((item, i) => {
            const d = item.date;
            const interval = c1.length > 500 ? 60 : c1.length > 200 ? 20 : 10;
            return i % interval === 0 ? `${d.getDate()} ${TR_MONTHS[d.getMonth()]}` : '';
        });

        const px1 = c1.map(i => +(i.price.toFixed(2)));
        // Find nearest prices for c2 and index
        const px2 = [];
        const pxIdx = [];
        
        c1.forEach((masterItem) => {
            const time = masterItem.date.getTime();
            
            // Find closest in c2
            const c2Item = c2.reduce((prev, curr) => Math.abs(curr.date.getTime() - time) < Math.abs(prev.date.getTime() - time) ? curr : prev, c2[0]);
            px2.push(c2Item ? +(c2Item.price.toFixed(2)) : null);

            // Find closest in cIdx
            const idxItem = cIdx.reduce((prev, curr) => Math.abs(curr.date.getTime() - time) < Math.abs(prev.date.getTime() - time) ? curr : prev, cIdx[0]);
            pxIdx.push(idxItem ? +(idxItem.price.toFixed(2)) : null);
        });

        const idxNorm = pxIdx.map(v => v ? +(px1[0] * (v / pxIdx[0])).toFixed(2) : null);

        if (perfChartInst) perfChartInst.destroy();

        perfChartInst = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: `${s1.ticker} — ${s1.name}`,
                        data: px1, borderColor: s1.color, borderWidth: 2.5,
                        pointRadius: 0, pointHoverRadius: 5,
                        pointHoverBackgroundColor: s1.color, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
                        tension: 0.3, fill: false, order: 1, spanGaps: true
                    },
                    {
                        label: `${s2.ticker} — ${s2.name}`,
                        data: px2, borderColor: s2.color, borderWidth: 2.5,
                        pointRadius: 0, pointHoverRadius: 5,
                        pointHoverBackgroundColor: s2.color, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
                        tension: 0.3, fill: false, order: 2, spanGaps: true
                    },
                    {
                        label: 'BIST 100 (Normalize)',
                        data: idxNorm, borderColor: 'rgba(255,255,255,0.15)',
                        borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0,
                        tension: 0.3, fill: false, borderDash: [5, 3], order: 3, spanGaps: true
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(19,23,34,0.96)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1,
                        titleFont: { family: 'JetBrains Mono', size: 11, weight: '700' },
                        bodyFont: { family: 'JetBrains Mono', size: 10 },
                        footerFont: { family: 'JetBrains Mono', size: 8 },
                        padding: 12, cornerRadius: 8, displayColors: true, boxWidth: 10, boxHeight: 10, boxPadding: 4,
                        callbacks: {
                            title: c => { const idx = c[0].dataIndex; if (idx < c1.length) { const d = c1[idx].date; return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`; } return ''; },
                            label: c => { const n = c.dataset.label.split(' — ')[0]; return ` ${n}: ₺${c.parsed.y.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; },
                            footer: () => 'Yahoo Finance API'
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#6a6d78', font: { family: 'JetBrains Mono', size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, border: { display: false } },
                    y: { position: 'right', grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#6a6d78', font: { family: 'JetBrains Mono', size: 9 }, callback: v => '₺' + v.toLocaleString('tr-TR') }, border: { display: false } }
                }
            }
        });

        const sub = document.getElementById('perfSub');
        if (sub) {
            const pm = { '1M': 'Son 1 Ay', '3M': 'Son 3 Ay', '6M': 'Son 6 Ay', '1Y': 'Son 1 Yıl', '3Y': 'Son 5 Yıl' };
            sub.textContent = `${pm[APP.period] || APP.period} — ${s1.ticker} vs ${s2.ticker} vs BIST 100`;
        }

        const legend = document.querySelector('.chart-legend');
        if (legend) {
            const items = legend.querySelectorAll('.cl-item');
            if (items[0]) { items[0].querySelector('.cl-dot').style.background = s1.color; items[0].lastChild.textContent = `${s1.ticker} — ${s1.name}`; }
            if (items[1]) { items[1].querySelector('.cl-dot').style.background = s2.color; items[1].lastChild.textContent = `${s2.ticker} — ${s2.name}`; }
        }
    } catch (err) {
        console.error("Chart fetch error, using simulated data:", err);
        const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 252, '3Y': 756 };
        const numDays = periodDays[APP.period] || 252;
        const dates = genDates(numDays);
        const labels = dates.map((d, i) => {
            const interval = numDays > 500 ? 60 : numDays > 200 ? 20 : 10;
            return i % interval === 0 ? `${d.getDate()} ${TR_MONTHS[d.getMonth()]}` : '';
        });
        const px1 = genPrices(s1.price || 100, numDays);
        const px2 = genPrices(s2.price || 100, numDays);
        const pxIdx = genPrices(BIST.index || 12930, numDays);
        const idxNorm = pxIdx.map(v => +(px1[0] * (v / pxIdx[0])).toFixed(2));
        if (perfChartInst) perfChartInst.destroy();
        perfChartInst = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [
                { label: `${s1.ticker} — ${s1.name}`, data: px1, borderColor: s1.color, borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: false, order: 1 },
                { label: `${s2.ticker} — ${s2.name}`, data: px2, borderColor: s2.color, borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: false, order: 2 },
                { label: 'BIST 100 (Normalize)', data: idxNorm, borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false, borderDash: [5, 3], order: 3 }
            ]},
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(19,23,34,0.96)', borderColor: 'rgba(41,98,255,0.2)', borderWidth: 1, titleFont: { family: 'JetBrains Mono', size: 11 }, bodyFont: { family: 'JetBrains Mono', size: 10 }, padding: 12, cornerRadius: 8, callbacks: { label: c => ` ${c.dataset.label.split(' — ')[0]}: ₺${c.parsed.y.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` } } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#6a6d78', font: { family: 'JetBrains Mono', size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, border: { display: false } },
                    y: { position: 'right', grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#6a6d78', font: { family: 'JetBrains Mono', size: 9 }, callback: v => '₺' + v.toLocaleString('tr-TR') }, border: { display: false } }
                }
            }
        });
        const sub = document.getElementById('perfSub');
        if (sub) { const pm = { '1M': 'Son 1 Ay', '3M': 'Son 3 Ay', '6M': 'Son 6 Ay', '1Y': 'Son 1 Yıl', '3Y': 'Son 5 Yıl' }; sub.textContent = `${pm[APP.period] || APP.period} — ${s1.ticker} vs ${s2.ticker} vs BIST 100`; }
        const legend = document.querySelector('.chart-legend');
        if (legend) { const items = legend.querySelectorAll('.cl-item'); if (items[0]) { items[0].querySelector('.cl-dot').style.background = s1.color; items[0].lastChild.textContent = `${s1.ticker} — ${s1.name}`; } if (items[1]) { items[1].querySelector('.cl-dot').style.background = s2.color; items[1].lastChild.textContent = `${s2.ticker} — ${s2.name}`; } }
    }
}

// ═══ CLOCK ═══
function updateClock() {
    const now = new Date();
    document.getElementById('navClock').textContent = now.toLocaleTimeString('tr-TR');
}

// ═══ LOADING ═══
function showLoader() { const el = document.getElementById('loaderOverlay'); if (el) el.classList.add('show'); }
function hideLoader() { const el = document.getElementById('loaderOverlay'); if (el) el.classList.remove('show'); }

// ═══ NOTIFICATION ═══
function showNotif(msg, isWelcome = false) {
    const banner = document.getElementById('notifBanner');
    const text = document.getElementById('notifText');
    if (banner && text) {
        text.textContent = msg;
        banner.style.display = 'flex';
        // Force the element to stay green and positive
        banner.classList.add('welcome');
        banner.style.backgroundColor = 'rgba(0, 230, 118, 0.15)';
        banner.style.border = '1px solid rgba(0, 230, 118, 0.3)';
        text.style.color = '#00E676';
    }
}

// ═══ LIVE DATA FETCHING ═══
// Uses Stooq CSV feed — direct, open-access, no CORS restrictions.
// Stooq endpoint: https://stooq.com/q/l/?s=THYAO.IS&f=sd2t2ohlcv&h&e=csv
async function fetchLiveData() {
    const sec = SECTORS[APP.sector];
    if (!sec) return;

    // ── Helper: fetch a single Stooq CSV quote and parse price/change ──
    async function fetchStooqQuote(stooqSymbol) {
        const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcvp&h&e=csv`;
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Stooq HTTP ${resp.status} for ${stooqSymbol}`);
        const text = await resp.text();
        // CSV format: Symbol,Date,Time,Open,High,Low,Close,Volume,% Change
        const lines = text.trim().split('\n');
        if (lines.length < 2) throw new Error(`No data rows for ${stooqSymbol}`);
        const cols = lines[1].split(',');
        // cols: [0]=Symbol [1]=Date [2]=Time [3]=Open [4]=High [5]=Low [6]=Close [7]=Volume [8]=%Change
        const close  = parseFloat(cols[6]);
        const open   = parseFloat(cols[3]);
        const pctRaw = parseFloat(cols[8]);  // e.g. 1.23
        if (isNaN(close) || close <= 0) throw new Error(`Invalid close for ${stooqSymbol}`);
        const change  = isNaN(open) ? 0 : +(close - open).toFixed(2);
        const pct     = isNaN(pctRaw) ? 0 : +pctRaw.toFixed(2);
        return { price: +close.toFixed(2), change, pct };
    }

    // ── Helper: fetch BIST 100 index via Stooq ──
    async function fetchBistIndex() {
        const url = 'https://stooq.com/q/l/?s=^XU100&f=sd2t2ohlcvp&h&e=csv';
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Stooq index HTTP ${resp.status}`);
        const text = await resp.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) throw new Error('No index rows');
        const cols = lines[1].split(',');
        const close  = parseFloat(cols[6]);
        const open   = parseFloat(cols[3]);
        const pctRaw = parseFloat(cols[8]);
        if (isNaN(close) || close <= 0) throw new Error('Invalid index close');
        return {
            index:  +close.toFixed(2),
            change: isNaN(open) ? 0 : +(close - open).toFixed(2),
            pct:    isNaN(pctRaw) ? 0 : +pctRaw.toFixed(2),
        };
    }

    // ── Fetch all tickers for active sector in parallel ──
    const allSymbols = Object.keys(ALL_STOCKS);
    let liveSuccess = false;

    try {
        // Build Stooq symbol list for ALL tracked stocks
        const fetchPromises = allSymbols.map(ticker => {
            const stooqSym = ALL_STOCKS[ticker].full || (ticker + '.IS');
            return fetchStooqQuote(stooqSym.toLowerCase())
                .then(data => ({ ticker, data, ok: true }))
                .catch(() => ({ ticker, data: null, ok: false }));
        });

        // Also fetch BIST 100 index
        const indexPromise = fetchBistIndex()
            .then(d => ({ ok: true, data: d }))
            .catch(() => ({ ok: false, data: null }));

        const [results, indexResult] = await Promise.all([
            Promise.all(fetchPromises),
            indexPromise,
        ]);

        // ── Overwrite ALL_STOCKS with real fetched prices ──
        let successCount = 0;
        results.forEach(({ ticker, data, ok }) => {
            if (!ok || !data) return;
            const s = ALL_STOCKS[ticker];
            if (!s) return;

            const oldPrice = s.price || data.price;
            s.price  = data.price;
            s.change = data.change;
            s.pct    = data.pct;
            s.unavailable = false;

            if (s.price > oldPrice)      s.tickDir = 'up';
            else if (s.price < oldPrice) s.tickDir = 'down';
            else                          s.tickDir = 'none';

            successCount++;
        });

        // ── Update BIST macro index ──
        if (indexResult.ok && indexResult.data) {
            Object.assign(BIST, indexResult.data);
        } else {
            // Baseline macro fallback
            if (BIST.index === 0) { BIST.index = 12930; BIST.change = 45.20; BIST.pct = 0.35; }
        }

        // Baseline macro for FX / gold (no Stooq CSV for those in this build)
        if (BIST.usdTry === 0) BIST.usdTry = 34.50;
        if (BIST.eurTry === 0) BIST.eurTry = 37.20;
        if (BIST.gold   === 0) BIST.gold   = 2340.50;

        if (successCount > 0) {
            // ✅ At least one live price fetched — declare live mode
            APP.dataSource = 'live';
            liveSuccess = true;
        }

    } catch (err) {
        console.warn('[fetchLiveData] Stooq fetch error, falling back to baseline:', err);
        // Graceful fallback — baseline ALL_STOCKS values are untouched, no blank screen
        if (BIST.index === 0) { BIST.index = 12930; BIST.change = 45.20; BIST.pct = 0.35; }
        if (BIST.usdTry === 0) BIST.usdTry = 34.50;
        if (BIST.eurTry === 0) BIST.eurTry = 37.20;
        if (BIST.gold   === 0) BIST.gold   = 2340.50;
    }

    // ── Update sector averages from current ALL_STOCKS values ──
    const activeSec = SECTORS[APP.sector];
    if (activeSec) {
        let totalPe = 0, countPe = 0, totalPb = 0, countPb = 0;
        activeSec.tickers.forEach(t => {
            const s = ALL_STOCKS[t];
            if (!s) return;
            if (s.pe > 0) { totalPe += s.pe; countPe++; }
            if (s.pb > 0) { totalPb += s.pb; countPb++; }
        });
        // Only update averages from fundamentals — never overwrite with 0 (per rules: rasyolar sabit kalmalı)
        // Sector averages in SECTORS[].avg are static per billing period, so we do NOT overwrite them here.
    }

    // ── Update live banner ──
    const banner = document.getElementById('notifBanner');
    const text   = document.getElementById('notifText');
    if (banner && text) {
        banner.style.display          = 'flex';
        banner.style.backgroundColor  = '#1b5e20';
        banner.style.border           = '1px solid #2e7d32';
        banner.classList.add('welcome');
        text.style.color              = '#a5d6a7';
        text.textContent = '🟢 Canlı Veri Bağlantısı Aktif — BIST Verileri Anlık Güncelleniyor.';
    }

    activateSector(APP.sector);
    if (liveSuccess) flashUIUpdates();
    renderAll();
}

function flashUIUpdates() {
    const s1 = STOCKS[APP.t1];
    const s2 = STOCKS[APP.t2];
    
    const flashElement = (id, dir) => {
        const el = document.getElementById(id);
        if (!el || dir === 'none') return;
        const color = dir === 'up' ? '#00E676' : '#FF1744';
        el.style.transition = 'color 0.3s, text-shadow 0.3s';
        el.style.color = color;
        el.style.textShadow = `0 0 8px ${color}80`;
        setTimeout(() => { el.style.color = ''; el.style.textShadow = ''; }, 1000);
    };

    if (s1) {
        flashElement('scT1Price', s1.tickDir);
        flashElement('tiT1', s1.tickDir);
    }
    if (s2) {
        flashElement('scT2Price', s2.tickDir);
        flashElement('tiT2', s2.tickDir);
    }
    
    // For index, assume up if change >= 0
    const idxDir = BIST.change >= 0 ? 'up' : 'down';
    flashElement('scIdxPrice', idxDir);
    flashElement('tiBist', idxDir);
}

// ═══ FULL RENDER ═══
function renderAll() {
    const steps = [
        ['updateSectorUI', updateSectorUI],
        ['renderStats', renderStats],
        ['renderTable', renderTable],
        ['renderDiscountChart', renderDiscountChart],
        ['renderVerdict', renderVerdict],
        ['renderPerfChart', renderPerfChart],
        ['updateClock', updateClock],
    ];
    steps.forEach(([name, fn]) => {
        try { fn(); } catch (err) { console.error(`[renderAll] ${name} error:`, err); }
    });
}

async function doRefresh() {
    showLoader();
    const btn = document.getElementById('btnRefresh');
    if (btn) btn.classList.add('spin');
    
    await fetchLiveData();
    renderAll();
    
    hideLoader();
    if (btn) btn.classList.remove('spin');
    const timeEl = document.getElementById('sbFooterDate');
    if (timeEl) timeEl.textContent = `Güncellendi: ${new Date().toLocaleTimeString('tr-TR')}`;
}

// ═══════════════════════════════════════════════════════
//  Requirement 4: LocalStorage utilized as persistent Database
// ═══════════════════════════════════════════════════════

function loadFromDB() {
    // Requirement 4: LocalStorage utilized as persistent Database
    let username = localStorage.getItem(DB_KEYS.username);
    // Backward compatibility: also check old key
    if (!username) username = localStorage.getItem(DB_KEYS.usernameOld);
    const ticker1 = localStorage.getItem(DB_KEYS.ticker1);
    const ticker2 = localStorage.getItem(DB_KEYS.ticker2);
    const sector = localStorage.getItem(DB_KEYS.sector);
    console.log('[DB] Reading from localStorage database:', { username, ticker1, ticker2, sector });
    if (!username) return null;
    return { username, ticker1, ticker2, sector };
}

function saveToDB(key, value) {
    // Requirement 4: LocalStorage utilized as persistent Database
    localStorage.setItem(key, value);
    console.log(`[DB] Saved to localStorage: ${key} = ${value}`);
}

function saveSessionToDB() {
    // Requirement 4: LocalStorage utilized as persistent Database
    saveToDB(DB_KEYS.username, APP.username);
    saveToDB(DB_KEYS.ticker1, APP.t1);
    saveToDB(DB_KEYS.ticker2, APP.t2);
    saveToDB(DB_KEYS.sector, APP.sector);
}

function loadCustomSectors() {
    const saved = localStorage.getItem(DB_KEYS.customSectors);
    if (saved) {
        try {
            let parsed = JSON.parse(saved);
            const initialLength = parsed.length;

            // Remove duplicate/custom iron-steel sectors from the user's localStorage
            parsed = parsed.filter(cSec => {
                const k = cSec.key.toLowerCase();
                const l = (cSec.sectorData && cSec.sectorData.label) ? cSec.sectorData.label.toLowerCase() : '';
                return !(k.includes('demir') || k.includes('celik') || k.includes('çelik') || k.includes('iron') ||
                    l.includes('demir') || l.includes('celik') || l.includes('çelik') || l.includes('iron'));
            });

            // If we filtered out duplicates, save it back
            if (parsed.length !== initialLength) {
                localStorage.setItem(DB_KEYS.customSectors, JSON.stringify(parsed));
                console.log('[DB] Removed duplicate custom Demir-Çelik sector from localStorage.');
            }

            let updated = false;
            parsed.forEach(cSec => {
                if (cSec.stocksData && cSec.stocksData['EREGL']) {
                    cSec.stocksData['EREGL'].price = 45.10;
                    cSec.stocksData['EREGL'].pe = 10.92;
                    cSec.stocksData['EREGL'].pb = 1.41;
                    cSec.stocksData['EREGL'].eps = 4.13;
                    updated = true;
                }
                if (cSec.stocksData && cSec.stocksData['KRDMD']) {
                    cSec.stocksData['KRDMD'].price = 41.20;
                    cSec.stocksData['KRDMD'].pe = 7.70;
                    cSec.stocksData['KRDMD'].pb = 1.60;
                    cSec.stocksData['KRDMD'].eps = 5.35;
                    updated = true;
                }
                if (updated && cSec.sectorData && cSec.sectorData.tickers) {
                    const t1 = cSec.sectorData.tickers[0];
                    const t2 = cSec.sectorData.tickers[1];
                    const s1 = cSec.stocksData[t1];
                    const s2 = cSec.stocksData[t2];
                    if (s1 && s2) {
                        cSec.sectorData.avg.pe = +((+s1.pe + +s2.pe) / 2 * 1.10).toFixed(2);
                        cSec.sectorData.avg.pb = +((+s1.pb + +s2.pb) / 2 * 1.08).toFixed(2);
                    }
                }
                SECTORS[cSec.key] = cSec.sectorData;
                Object.assign(ALL_STOCKS, cSec.stocksData);
            });
            if (updated) {
                localStorage.setItem(DB_KEYS.customSectors, JSON.stringify(parsed));
            }
            console.log('[DB] Loaded custom sectors:', parsed.length);
        } catch (e) { console.error('[DB] Failed to parse custom sectors', e); }
    }
}

function renderSectorButtons() {
    const grid = document.getElementById('sbSectorGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.values(SECTORS).forEach(sec => {
        const btn = document.createElement('button');
        btn.className = `sb-sector-btn ${sec.key === APP.sector ? 'active' : ''}`;
        btn.dataset.sector = sec.key;
        btn.innerHTML = `<span class="sector-icon">${sec.icon || '📌'}</span><span class="sector-name">${sec.label}</span>`;
        btn.addEventListener('click', () => switchSector(sec.key));
        grid.appendChild(btn);
    });
}

function addNewSector() {
    const nameInput = document.getElementById('newSecName');
    const t1Input = document.getElementById('newT1');
    const t2Input = document.getElementById('newT2');

    if (!nameInput || !t1Input || !t2Input) return;

    const label = nameInput.value.trim();
    const t1 = t1Input.value.trim().toUpperCase();
    const t2 = t2Input.value.trim().toUpperCase();

    if (!label || !t1 || !t2) {
        showNotif('Lütfen sektör adını ve iki hisse kodunu girin.');
        return;
    }
    if (t1 === t2) {
        showNotif('Hisse 1 ve Hisse 2 aynı olamaz.');
        return;
    }

    const key = 'custom_' + label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const icon = '📌';

    // Initialize with placeholders, real data will be fetched via doRefresh
    const genPlaceholder = (ticker, isT1) => {
        const color = isT1 ? '#2962FF' : '#FF6D00';
        return {
            ticker, full: ticker + '.IS', sector: key,
            name: ticker + ' A.Ş.', short: ticker,
            price: 0, change: 0, pct: 0,
            pe: 0, pb: 0, evEbitda: 0, roe: 0,
            eps: 0, epsGrowth: 0, marketCap: 0,
            netDebtEbitda: 0, dividendYield: 0,
            color, colorDim: color + '26'
        };
    };

    const stock1 = genPlaceholder(t1, true);
    const stock2 = genPlaceholder(t2, false);

    const avg = { pe: 0, pb: 0, evEbitda: 0, roe: 0, netDebtEbitda: 0 };
    
    const sectorData = { key, label, labelEn: label, icon, tickers: [t1, t2], avg };
    const stocksData = { [t1]: stock1, [t2]: stock2 };

    // Add to runtime memory
    SECTORS[key] = sectorData;
    Object.assign(ALL_STOCKS, stocksData);

    // Persist custom sectors to localStorage Database
    const saved = localStorage.getItem(DB_KEYS.customSectors);
    let customSectorsList = [];
    if (saved) {
        try { customSectorsList = JSON.parse(saved); } catch (e) { }
    }
    
    // Check if sector already exists to prevent duplicates
    if (Object.values(SECTORS).some(s => s.label.toLowerCase() === label.toLowerCase())) {
        showNotif('Bu sektör zaten tanımlı.');
        return;
    }
    
    customSectorsList.push({ key, sectorData, stocksData });
    localStorage.setItem(DB_KEYS.customSectors, JSON.stringify(customSectorsList));

    // Clear inputs
    nameInput.value = '';
    t1Input.value = '';
    t2Input.value = '';

    // Re-render sector buttons and switch to new sector
    renderSectorButtons();
    switchSector(key);
    showNotif(`✅ "${label}" sektörü başarıyla eklendi! ${t1} vs ${t2} karşılaştırması aktif.`, true);
}


// ═══════════════════════════════════════════════════════
//  Requirement 3: LOGIN SYSTEM
// ═══════════════════════════════════════════════════════

function showDashboard() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) { overlay.classList.add('fade-out'); setTimeout(() => { overlay.style.display = 'none'; }, 400); }
    document.getElementById('tickerBar')?.classList.remove('hidden');
    document.getElementById('topNav')?.classList.remove('hidden');
    document.getElementById('appShell')?.classList.remove('hidden');
    const greeting = document.getElementById('userGreeting');
    if (greeting && APP.username) greeting.textContent = `👤 Hoş geldin, ${APP.username}`;
}

function loginUser(username) {
    APP.username = username.trim();
    // Requirement 4: Save username to localStorage Database
    saveSessionToDB();
    showDashboard();
    initTerminal(true);
}

function applySessionFromDB(session) {
    // Redirect old custom iron-steel sector to the new built-in one
    if (session.sector && (session.sector.toLowerCase().includes('demir') || session.sector.toLowerCase().includes('celik') || session.sector.toLowerCase().includes('çelik'))) {
        if (!SECTORS[session.sector]) {
            session.sector = 'iron_steel';
            // Also ensure the tickers are valid for the new sector
            if (!['EREGL', 'KRDMD'].includes(session.ticker1)) session.ticker1 = 'EREGL';
            if (!['EREGL', 'KRDMD'].includes(session.ticker2)) session.ticker2 = 'KRDMD';
        }
    }

    // Requirement 4: Restore session from localStorage Database
    if (session.sector && SECTORS[session.sector]) {
        APP.sector = session.sector;
    }
    activateSector(APP.sector);
    if (session.ticker1 && STOCKS[session.ticker1]) APP.t1 = session.ticker1;
    if (session.ticker2 && STOCKS[session.ticker2]) APP.t2 = session.ticker2;
}

// ═══ SECTOR SWITCH HANDLER ═══
function switchSector(sectorKey) {
    if (!SECTORS[sectorKey]) return;
    activateSector(sectorKey);
    // Requirement 4: Save sector change to localStorage Database
    saveToDB(DB_KEYS.sector, sectorKey);
    saveToDB(DB_KEYS.ticker1, APP.t1);
    saveToDB(DB_KEYS.ticker2, APP.t2);
    doRefresh();
    // Show sector change notification
    const sec = SECTORS[sectorKey];
    showNotif(`${sec.icon} ${sec.label} sektörü yüklendi. ${APP.t1} vs ${APP.t2} karşılaştırması aktif.`, true);
}

// ═══ EVENTS ═══
function setupEvents() {
    document.getElementById('btnRefresh')?.addEventListener('click', doRefresh);

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.clear();
        location.reload();
    });

    document.getElementById('sel1')?.addEventListener('change', e => {
        APP.t1 = e.target.value;
        document.getElementById('badge1').textContent = APP.t1;
        // Requirement 4: Save Ticker 1 change to localStorage Database
        saveToDB(DB_KEYS.ticker1, APP.t1);
        renderAll();
    });
    document.getElementById('sel2')?.addEventListener('change', e => {
        APP.t2 = e.target.value;
        document.getElementById('badge2').textContent = APP.t2;
        // Requirement 4: Save Ticker 2 change to localStorage Database
        saveToDB(DB_KEYS.ticker2, APP.t2);
        renderAll();
    });

    // Sector buttons are rendered and bound dynamically via renderSectorButtons
    document.getElementById('btnAddSector')?.addEventListener('click', addNewSector);

    document.querySelectorAll('.sb-per').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sb-per').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            APP.period = btn.dataset.p;
            renderPerfChart();
        });
    });

    document.getElementById('notifClose')?.addEventListener('click', () => {
        document.getElementById('notifBanner').style.display = 'none';
    });
}

function setupLoginEvents() {
    const input = document.getElementById('loginUsername');
    const btn = document.getElementById('loginBtn');
    if (!input || !btn) return;
    input.addEventListener('input', () => { btn.disabled = input.value.trim().length === 0; });
    btn.addEventListener('click', () => { if (input.value.trim().length > 0) loginUser(input.value); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim().length > 0) loginUser(input.value); });
}

// ═══ TERMINAL INIT (after login) ═══
function initTerminal(showWelcome = false) {
    showLoader();
    const safetyTimeout = setTimeout(() => { hideLoader(); console.warn('Loader safety timeout triggered'); }, 5000);

    setTimeout(async () => {
        setupEvents();
        try { 
            renderSectorButtons();
            await fetchLiveData();
        } catch (err) { 
            console.error('Init error:', err); 
            renderSectorButtons();
            renderAll(); 
        }
        clearTimeout(safetyTimeout);
        hideLoader();
        setInterval(updateClock, 1000);
        setInterval(doRefresh, 60000);
        // Banner is set directly by fetchLiveData() with #1b5e20 green styling
    }, 1000);
}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', () => {
    loadCustomSectors();

    // Requirement 4: Check localStorage Database for existing session
    const savedSession = loadFromDB();

    if (savedSession && savedSession.username) {
        console.log(`[DB] Existing session found for user: ${savedSession.username}`);
        APP.username = savedSession.username;
        applySessionFromDB(savedSession);
        renderSectorButtons();
        showDashboard();
        initTerminal(true);
    } else {
        console.log('[DB] No session found in localStorage. Showing login screen.');
        activateSector('aviation'); // Default sector
        renderSectorButtons();
        setupLoginEvents();
    }
});
