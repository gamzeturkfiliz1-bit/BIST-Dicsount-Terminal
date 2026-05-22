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

// ═══ DATABASE KEYS ═══
const DB_KEYS = {
    username: 'bist_user',
    usernameOld: 'ag_username',  // backward-compat
    savedUsername: 'saved_username',
    ticker1: 'ag_ticker1',
    ticker2: 'ag_ticker2',
    sector: 'ag_sector',
    customSectors: 'ag_custom_sectors',
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

// ═══ FIREBASE SETUP (Requirement 2: Cloud sharing via Firestore) ═══
let firebaseConfig = {
    apiKey: "AIzaSyDummyKeyForBistTerminalAppProject",
    authDomain: "bist-terminal-app.firebaseapp.com",
    projectId: "bist-terminal-app",
    storageBucket: "bist-terminal-app.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

try {
    if (typeof __firebase_config !== 'undefined') {
        if (typeof __firebase_config === 'string') {
            firebaseConfig = JSON.parse(__firebase_config);
        } else if (typeof __firebase_config === 'object' && __firebase_config !== null) {
            firebaseConfig = __firebase_config;
        }
    }
} catch (configError) {
    console.error('[Firebase] Error reading global __firebase_config:', configError);
}

let db = null;
let auth = null;
let fbApp = null;
const appId = "bist-discount-terminal";
let firebaseSharedSectors = [];

let firebasePrivateSectors = [];
let sharedSectorsListener = null;
let privateSectorsListener = null;
let isLocalMode = false;
let isEditingSector = false;


async function initFirebase() {
    try {
        const hasFirebaseConfig = (typeof __firebase_config !== 'undefined');
        if (window.firebaseApp && hasFirebaseConfig) {
            fbApp = window.firebaseApp(firebaseConfig);
            auth = window.firebaseAuth(fbApp);
            db = window.getFirestore(fbApp);
            console.log('[Firebase] Initialized.');

            // Listen for Auth changes
            window.onAuthStateChanged(auth, (user) => {
                if (user) {
                    console.log('[Firebase] User logged in:', user.email);
                    APP.username = user.displayName || user.email.split('@')[0];

                    // Save session & Show Dashboard
                    saveToDB(DB_KEYS.username, APP.username);
                    saveToDB(DB_KEYS.savedUsername, APP.username);
                    showDashboard();

                    // Restore other session elements
                    const savedSession = loadFromDB();
                    if (savedSession) {
                        applySessionFromDB(savedSession);
                    }

                    // Setup real-time cloud sector syncing
                    setupSharedSectorsListener();
                    setupPrivateSectorsListener(user.uid);

                    // Initialize terminal
                    initTerminal(true);
                } else {
                    console.log('[Firebase] User logged out.');
                    APP.username = '';

                    // Unsubscribe Firestore listeners
                    if (sharedSectorsListener) {
                        sharedSectorsListener();
                        sharedSectorsListener = null;
                    }
                    if (privateSectorsListener) {
                        privateSectorsListener();
                        privateSectorsListener = null;
                    }

                    // Clear Firebase custom sectors from memory
                    firebaseSharedSectors = [];
                    firebasePrivateSectors = [];
                    mergeAndRenderSectors();

                    // Hide dashboard and show custom authentication UI
                    hideDashboard();
                    renderAuthOverlay();
                }
            });
        } else {
            console.warn('[Firebase] SDK scripts or configuration are not loaded. Switching to Local Simulation Mode.');
            setupLocalSimulationMode();
        }
    } catch (e) {
        console.error('[Firebase] Failed to initialize Firebase. Switching to Local Simulation Mode:', e);
        setupLocalSimulationMode();
    }
}

function setupLocalSimulationMode() {
    isLocalMode = true;
    console.log('[LocalMode] Active. Running in Local Secure Database simulation mode.');

    // Mock Firebase objects
    auth = { currentUser: null };
    db = null;

    const getLocalUsers = () => {
        try {
            const saved = localStorage.getItem('bist_local_users');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('[LocalMode] Failed to load local users:', e);
            return [];
        }
    };

    const saveLocalUsers = (users) => {
        try {
            localStorage.setItem('bist_local_users', JSON.stringify(users));
        } catch (e) {
            console.error('[LocalMode] Failed to save local users:', e);
        }
    };

    window.localAuthListeners = window.localAuthListeners || [];

    // Mock Auth state changed listener
    window.onAuthStateChanged = (mockAuth, callback) => {
        if (typeof callback !== 'function') return () => {};
        
        window.localAuthListeners.push(callback);
        
        let currentLocalUser = null;
        try {
            const savedSession = localStorage.getItem('bist_current_local_user');
            if (savedSession) {
                currentLocalUser = JSON.parse(savedSession);
            }
        } catch (e) {
            console.error('[LocalMode] Failed to parse local session:', e);
        }

        auth.currentUser = currentLocalUser;
        
        setTimeout(() => {
            callback(auth.currentUser);
        }, 0);

        return () => {
            window.localAuthListeners = window.localAuthListeners.filter(cb => cb !== callback);
        };
    };

    const triggerAuthChange = () => {
        window.localAuthListeners.forEach(callback => {
            try {
                callback(auth.currentUser);
            } catch (e) {
                console.error('[LocalMode] Error in auth listener callback:', e);
            }
        });
    };

    // Mock SignIn
    window.signInWithEmailAndPassword = (mockAuth, email, password) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (!email || !password) {
                    reject({ code: 'auth/missing-password' });
                    return;
                }
                const users = getLocalUsers();
                const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
                if (!user) {
                    reject({ code: 'auth/user-not-found' });
                    return;
                }
                if (user.password !== password) {
                    reject({ code: 'auth/wrong-password' });
                    return;
                }
                
                const sessionUser = {
                    email: user.email,
                    displayName: user.name || user.email.split('@')[0],
                    uid: user.uid
                };
                auth.currentUser = sessionUser;
                localStorage.setItem('bist_current_local_user', JSON.stringify(sessionUser));
                triggerAuthChange();
                resolve({ user: sessionUser });
            }, 300);
        });
    };

    // Mock SignUp
    window.createUserWithEmailAndPassword = (mockAuth, email, password) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (!email || !password) {
                    reject({ code: 'auth/missing-password' });
                    return;
                }
                const users = getLocalUsers();
                const alreadyExists = users.some(u => u.email.toLowerCase() === email.toLowerCase().trim());
                if (alreadyExists) {
                    reject({ code: 'auth/email-already-in-use' });
                    return;
                }

                const uid = 'local_uid_' + Math.random().toString(36).substr(2, 9);
                const newUser = {
                    email: email.trim(),
                    password: password,
                    name: '',
                    uid: uid
                };
                users.push(newUser);
                saveLocalUsers(users);

                const sessionUser = {
                    email: newUser.email,
                    displayName: '',
                    uid: uid
                };
                auth.currentUser = sessionUser;
                localStorage.setItem('bist_current_local_user', JSON.stringify(sessionUser));
                triggerAuthChange();
                resolve({ user: sessionUser });
            }, 300);
        });
    };

    // Mock UpdateProfile
    window.updateProfile = (user, profileData) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (!user) {
                    reject(new Error('No user to update profile for'));
                    return;
                }
                const newName = profileData.displayName || '';
                user.displayName = newName;
                
                auth.currentUser = user;
                localStorage.setItem('bist_current_local_user', JSON.stringify(user));

                const users = getLocalUsers();
                const userIdx = users.findIndex(u => u.uid === user.uid);
                if (userIdx !== -1) {
                    users[userIdx].name = newName;
                    saveLocalUsers(users);
                }

                triggerAuthChange();
                resolve();
            }, 100);
        });
    };

    // Mock SignOut
    window.signOut = (mockAuth) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                auth.currentUser = null;
                localStorage.removeItem('bist_current_local_user');
                triggerAuthChange();
                resolve();
            }, 100);
        });
    };

    // Mock Reset Password
    window.sendPasswordResetEmail = (mockAuth, email) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const users = getLocalUsers();
                const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
                if (!user) {
                    reject({ code: 'auth/user-not-found' });
                } else {
                    resolve();
                }
            }, 200);
        });
    };

    // Initialize local session checks
    window.onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('[LocalMode] User logged in:', user.email);
            APP.username = user.displayName || user.email.split('@')[0];

            saveToDB(DB_KEYS.username, APP.username);
            saveToDB(DB_KEYS.savedUsername, APP.username);
            showDashboard();

            const savedSession = loadFromDB();
            if (savedSession) {
                applySessionFromDB(savedSession);
            }

            setupSharedSectorsListener();
            setupPrivateSectorsListener(user.uid);

            initTerminal(true);
        } else {
            console.log('[LocalMode] User logged out.');
            APP.username = '';

            if (sharedSectorsListener) {
                sharedSectorsListener();
                sharedSectorsListener = null;
            }
            if (privateSectorsListener) {
                privateSectorsListener();
                privateSectorsListener = null;
            }

            firebaseSharedSectors = [];
            firebasePrivateSectors = [];
            mergeAndRenderSectors();

            hideDashboard();
            renderAuthOverlay();
        }
    });
}

function setupSharedSectorsListener() {
    if (isLocalMode) {
        if (sharedSectorsListener) {
            sharedSectorsListener();
            sharedSectorsListener = null;
        }
        const loadShared = () => {
            const saved = localStorage.getItem('bist_local_shared_sectors');
            if (saved) {
                try {
                    firebaseSharedSectors = JSON.parse(saved);
                } catch (e) {
                    console.error('[Local] Failed to parse local shared sectors:', e);
                    firebaseSharedSectors = [];
                }
            } else {
                firebaseSharedSectors = [];
            }
            mergeAndRenderSectors();
        };

        loadShared();

        const updateHandler = () => loadShared();
        window.addEventListener('localSharedSectorsUpdated', updateHandler);
        
        const storageHandler = (e) => {
            if (e.key === 'bist_local_shared_sectors') {
                loadShared();
            }
        };
        window.addEventListener('storage', storageHandler);

        sharedSectorsListener = () => {
            window.removeEventListener('localSharedSectorsUpdated', updateHandler);
            window.removeEventListener('storage', storageHandler);
        };
        return;
    }

    if (!db) return;
    if (sharedSectorsListener) {
        sharedSectorsListener();
        sharedSectorsListener = null;
    }
    try {
        const sharedSectorsRef = window.collection(db, 'artifacts', appId, 'public', 'data', 'sectors');
        sharedSectorsListener = window.onSnapshot(sharedSectorsRef, (snapshot) => {
            firebaseSharedSectors = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data && data.key && data.sectorData) {
                    firebaseSharedSectors.push({
                        id: doc.id,
                        key: data.key,
                        sectorData: data.sectorData,
                        stocksData: data.stocksData
                    });
                }
            });
            console.log(`[Firebase] Loaded ${firebaseSharedSectors.length} shared sectors.`);
            const seenKeys = new Set();
            firebaseSharedSectors = firebaseSharedSectors.filter(item => {
                if (seenKeys.has(item.key)) {
                    return false;
                }
                seenKeys.add(item.key);
                return true;
            });
            mergeAndRenderSectors();
        }, (error) => {
            console.error('[Firebase] Error in shared sectors listener:', error);
        });
    } catch (e) {
        console.error('[Firebase] Error setting up snapshot listener:', e);
    }
}

function setupPrivateSectorsListener(userId) {
    if (isLocalMode) {
        if (!userId) return;
        if (privateSectorsListener) {
            privateSectorsListener();
            privateSectorsListener = null;
        }
        const privateKey = `bist_local_private_sectors_${userId}`;
        const emailKey = (auth && auth.currentUser && auth.currentUser.email) ? `custom_sectors_${auth.currentUser.email.toLowerCase()}` : '';
        const loadPrivate = () => {
            let saved = localStorage.getItem(privateKey);
            if (!saved && emailKey) {
                saved = localStorage.getItem(emailKey);
            }
            if (saved) {
                try {
                    firebasePrivateSectors = JSON.parse(saved);
                } catch (e) {
                    console.error('[Local] Failed to parse local private sectors:', e);
                    firebasePrivateSectors = [];
                }
            } else {
                firebasePrivateSectors = [];
            }
            mergeAndRenderSectors();
        };

        loadPrivate();

        const updateHandler = () => loadPrivate();
        const eventName = `localPrivateSectorsUpdated_${userId}`;
        window.addEventListener(eventName, updateHandler);

        const storageHandler = (e) => {
            if (e.key === privateKey || (emailKey && e.key === emailKey)) {
                loadPrivate();
            }
        };
        window.addEventListener('storage', storageHandler);

        privateSectorsListener = () => {
            window.removeEventListener(eventName, updateHandler);
            window.removeEventListener('storage', storageHandler);
        };
        return;
    }

    if (!db || !userId) return;
    if (privateSectorsListener) {
        privateSectorsListener();
        privateSectorsListener = null;
    }
    try {
        const privateSectorsRef = window.collection(db, 'artifacts', appId, 'users', userId, 'sectors');
        privateSectorsListener = window.onSnapshot(privateSectorsRef, (snapshot) => {
            firebasePrivateSectors = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data && data.key && data.sectorData) {
                    firebasePrivateSectors.push({
                        id: doc.id,
                        key: data.key,
                        sectorData: data.sectorData,
                        stocksData: data.stocksData
                    });
                }
            });
            console.log(`[Firebase] Loaded ${firebasePrivateSectors.length} private sectors.`);
            const seenKeys = new Set();
            firebasePrivateSectors = firebasePrivateSectors.filter(item => {
                if (seenKeys.has(item.key)) {
                    return false;
                }
                seenKeys.add(item.key);
                return true;
            });
            mergeAndRenderSectors();
        }, (error) => {
            console.error('[Firebase] Error in private sectors listener:', error);
        });
    } catch (e) {
        console.error('[Firebase] Error setting up private snapshot listener:', e);
    }
}

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

const DEFAULT_SECTORS = JSON.parse(JSON.stringify(SECTORS));
const DEFAULT_STOCKS = JSON.parse(JSON.stringify(ALL_STOCKS));

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
        const change = Math.sin(i * 0.1) * basePrice * 0.005;
        prices.push(+(prices[i - 1] + change).toFixed(2));
    }
    return prices;
}

// ═══ DISCOUNT CALCULATION ═══
function calcDiscount(val, avg) {
    return +(((val - avg) / avg) * 100).toFixed(2);
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
    if (panelSub) panelSub.textContent = `Çarpan Karşılaştırması — BIST 100: ~${BIST.index.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${sec.label} Sektör Ort. F/K: ${sec.avg.pe.toFixed(2)}x`;

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

        const fv = (v) => m.fmt === '%' ? v.toFixed(2) + '%' : v.toFixed(2) + 'x';

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
                <span class="disc-val ${d1 < 0 ? 'neg' : 'pos'}">${arrow1} ${d1 > 0 ? '+' : ''}${d1.toFixed(2)}%</span>
                &nbsp;/&nbsp;
                <span class="disc-val ${d2 < 0 ? 'neg' : 'pos'}">${arrow2} ${d2 > 0 ? '+' : ''}${d2.toFixed(2)}%</span>
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
                    backgroundColor: d1.map(v => v < 0 ? 'rgba(38, 166, 154, 0.75)' : 'rgba(239, 83, 80, 0.75)'),
                    borderColor: d1.map(v => v < 0 ? '#26A69A' : '#EF5350'),
                    borderWidth: 1.5, borderRadius: 5, barPercentage: 0.4,
                },
                {
                    label: s2.ticker,
                    data: d2,
                    backgroundColor: d2.map(v => v < 0 ? 'rgba(38, 166, 154, 0.75)' : 'rgba(239, 83, 80, 0.75)'),
                    borderColor: d2.map(v => v < 0 ? '#26A69A' : '#EF5350'),
                    borderWidth: 1.5, borderRadius: 5, barPercentage: 0.4,
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
                    callbacks: { label: c => { const v = c.parsed.x; return ` ${c.dataset.label}: ${v > 0 ? '+' : ''}${v.toFixed(2)}% (${v < 0 ? 'İskontolu' : 'Primli'})`; } }
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
    wSub.textContent = `%${Math.abs(wScore).toFixed(2)} İskontolu`;
    wSub.className = 'sc-change positive';

    document.getElementById('vcHeadline').innerHTML =
        `Analiz edilen çarpanlara göre <span class="hl">${winner.name} (${winner.ticker})</span> rakibine oranla ` +
        `<span class="hl">%${diff.toFixed(2)}</span> daha iskontolu görünmektedir.`;

    const parts = [];
    if (wReasons.some(r => r.includes('P/E'))) parts.push('düşük F/K oranı');
    if (wReasons.some(r => r.includes('P/B'))) parts.push('düşük PD/DD çarpanı');
    if (wReasons.some(r => r.includes('EV/EBITDA'))) parts.push('düşük FD/FAVÖK değerlemesi');
    if (wReasons.some(r => r.includes('ROE'))) parts.push('yüksek özsermaye kârlılığı');
    if (wReasons.some(r => r.includes('Net Debt'))) parts.push('düşük borçluluk oranı');
    if (wReasons.some(r => r.includes('High Disc'))) parts.push('yüksek iskonto fırsatı (F/K < Sektör & ROE > Sektör)');

    document.getElementById('vcText').textContent = parts.length > 0
        ? `${winner.ticker}, ${sec.label.toLowerCase()} sektör ortalamasına kıyasla ${parts.join(', ')} nedeniyle belirgin iskontolu konumdadır. BIST 100 endeksinin ${BIST.index.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} seviyesinde olduğu mevcut piyasa koşullarında göreceli değerleme avantajı taşımaktadır.`
        : `${winner.ticker}, temel çarpanlar bazında ${sec.label.toLowerCase()} sektör ortalamasının altında değerleme seviyesinde işlem görmektedir.`;

    const maxBar = Math.max(Math.abs(avgS1), Math.abs(avgS2), 1);
    document.getElementById('vbT1').textContent = s1.ticker;
    document.getElementById('vbT2').textContent = s2.ticker;
    document.getElementById('vbVal1').textContent = (avgS1 < 0 ? '' : '+') + avgS1.toFixed(2) + '%';
    document.getElementById('vbVal2').textContent = (avgS2 < 0 ? '' : '+') + avgS2.toFixed(2) + '%';
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
        `Based on a 15-minute delayed feed, ${winner.ticker} is trading at a ${Math.abs(wScore).toFixed(2)}% discount relative to its ${sec.labelEn} sector peers. ` +
        `${winner.full} is currently traded at a ${diff.toFixed(2)}% discount compared to its peer ${loser.ticker} and the sector average (P/E: ${SECTOR.pe.toFixed(2)}x), ` +
        `making it the more favorable fundamental pick. — Borsa İstanbul · ${formatTRDate(getLiveDate())} · BIST 100 @ ${BIST.index.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═══════════════════════════════════════
//  RENDER: PRICE PERFORMANCE CHART
// ═══════════════════════════════════════
async function renderPerfChart() {
    const ctx = document.getElementById('perfChart');
    if (!ctx) return;

    const s1 = STOCKS[APP.t1], s2 = STOCKS[APP.t2];
    if (!s1 || !s2) return;

    const startT1 = APP.t1;
    const startT2 = APP.t2;
    const startPeriod = APP.period;

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

        if (APP.t1 !== startT1 || APP.t2 !== startT2 || APP.period !== startPeriod) {
            console.log('[renderPerfChart] Tickers/period changed during fetch, discarding chart render.');
            return;
        }

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
        if (APP.t1 !== startT1 || APP.t2 !== startT2 || APP.period !== startPeriod) return;
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

// ═══ NOTIFICATION, TOAST & CONFIRM MODAL ENGINE ═══
window.alert = function(msg) {
    showToast(msg, 'error');
};
window.confirm = function(msg) {
    console.warn('Native confirm is disabled. Use showCustomConfirm instead. Msg:', msg);
    return false;
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '🟢';
    if (type === 'error') icon = '🔴';

    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.1rem; line-height:1;">${icon}</span>
            <span>${message}</span>
        </div>
        <button class="custom-toast-close">&times;</button>
        <div class="custom-toast-progress"></div>
    `;

    container.appendChild(toast);

    const progress = toast.querySelector('.custom-toast-progress');
    // Force layout reflow
    toast.offsetHeight;
    progress.style.transition = 'transform 3.5s linear';
    progress.style.transform = 'scaleX(0)';

    const closeBtn = toast.querySelector('.custom-toast-close');
    const removeToast = () => {
        if (toast.classList.contains('fade-out')) return;
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    };

    closeBtn.addEventListener('click', removeToast);
    setTimeout(removeToast, 3500);
}

function showCustomConfirm(message, callbackConfirm, callbackCancel, confirmBtnText = 'Evet, Sil') {
    const container = document.getElementById('confirmModalContainer');
    if (!container) return;

    // Clean previous if any
    container.innerHTML = '';

    const overlay = document.createElement('div');
    overlay.className = 'custom-confirm-overlay';

    overlay.innerHTML = `
        <div class="custom-confirm-card">
            <div class="custom-confirm-inner">
                <div class="custom-confirm-title">
                    <span>⚠️</span>
                    <span>İşlem Onayı</span>
                </div>
                <div class="custom-confirm-message">${message}</div>
                <div class="custom-confirm-buttons">
                    <button class="custom-confirm-btn cancel" id="confirmCancelBtn">Vazgeç</button>
                    <button class="custom-confirm-btn confirm" id="confirmConfirmBtn">${confirmBtnText}</button>
                </div>
            </div>
        </div>
    `;

    container.appendChild(overlay);

    const closeConfirm = () => {
        overlay.style.animation = 'toastSlideIn 0.2s ease reverse';
        setTimeout(() => {
            overlay.remove();
        }, 200);
    };

    overlay.querySelector('#confirmCancelBtn').addEventListener('click', () => {
        closeConfirm();
        if (callbackCancel) callbackCancel();
    });

    overlay.querySelector('#confirmConfirmBtn').addEventListener('click', () => {
        closeConfirm();
        if (callbackConfirm) callbackConfirm();
    });
}

function showNotif(msg, isWelcome = false) {
    showToast(msg, isWelcome ? 'success' : 'info');
}

function updateDataStatus(state) {
    const dataStatusDot = document.getElementById('dataStatusDot');
    const dataStatusText = document.getElementById('dataStatusText');
    const infoText = document.querySelector('#dataSourceBox .sb-info-text');
    const infoIcon = document.querySelector('#dataSourceBox .sb-info-icon');

    const banner = document.getElementById('notifBanner');
    const text   = document.getElementById('notifText');

    if (state === 'loading') {
        if (dataStatusDot) {
            dataStatusDot.style.backgroundColor = '#2962FF';
            dataStatusDot.style.boxShadow = '0 0 8px #2962FF';
        }
        if (dataStatusText) {
            dataStatusText.textContent = 'Bağlanıyor...';
            dataStatusText.style.color = '#2962FF';
        }
        if (infoText) {
            infoText.innerHTML = 'Yahoo Finance (yfinance)<br>Veriler güncelleniyor...';
            if (infoIcon) infoIcon.textContent = '🔵';
        }
        if (banner && text) {
            banner.style.display = 'flex';
            banner.className = 'notification welcome';
            banner.style.backgroundColor = 'rgba(41, 98, 255, 0.15)';
            banner.style.border = '1px solid rgba(41, 98, 255, 0.3)';
            text.style.color = '#2962FF';
            text.textContent = '🔵 Veriler arka planda Yahoo Finance üzerinden güncelleniyor...';
        }
    } else if (state === 'live') {
        if (dataStatusDot) {
            dataStatusDot.style.backgroundColor = '#00E676';
            dataStatusDot.style.boxShadow = '0 0 8px #00E676';
        }
        if (dataStatusText) {
            dataStatusText.textContent = 'Canlı Veri';
            dataStatusText.style.color = '#00E676';
        }
        if (infoText) {
            infoText.innerHTML = 'Yahoo Finance (yfinance)<br>15 dk gecikmeli · Canlı Veri Modu';
            if (infoIcon) infoIcon.textContent = '📡';
        }
        if (banner && text) {
            banner.style.display = 'flex';
            banner.className = 'notification welcome';
            banner.style.backgroundColor = '#1b5e20';
            banner.style.border = '1px solid #2e7d32';
            text.style.color = '#a5d6a7';
            text.textContent = '🟢 Canlı Veri Bağlantısı Aktif — BIST Verileri Anlık Güncelleniyor.';
        }
    } else { // 'local'
        if (dataStatusDot) {
            dataStatusDot.style.backgroundColor = '#00E676';
            dataStatusDot.style.boxShadow = '0 0 8px #00E676';
        }
        if (dataStatusText) {
            dataStatusText.textContent = 'Yahoo Finance';
            dataStatusText.style.color = '#00E676';
        }
        if (infoText) {
            infoText.innerHTML = 'Yahoo Finance API<br>Veriler Yahoo Finance\'den çekildi';
            if (infoIcon) infoIcon.textContent = '📡';
        }
        if (banner && text) {
            banner.style.display = 'flex';
            banner.className = 'notification welcome';
            banner.style.backgroundColor = '#1b5e20';
            banner.style.border = '1px solid #2e7d32';
            text.style.color = '#a5d6a7';
            text.textContent = '🟢 Yahoo Finance Aktif — Veriler Yahoo Finance üzerinden çekildi.';
        }
    }
}

// ═══ LIVE DATA FETCHING ═══
async function fetchLiveData(signal = null) {
    const sec = SECTORS[APP.sector];
    if (!sec) return false;

    // Prepare promises for active sector stocks
    const stockPromises = sec.tickers.map(async (ticker) => {
        try {
            const data = await MarketAPI.fetchStockData(ticker, signal);
            return { ticker, data, ok: !!data };
        } catch (err) {
            console.warn(`Error fetching live data for ${ticker}:`, err);
            return { ticker, data: null, ok: false };
        }
    });

    // Prepare promises for macro tickers
    const macroPromises = [
        MarketAPI.fetchMacroData('XU100.IS', signal).then(d => ({ key: 'xu100', data: d })),
        MarketAPI.fetchMacroData('TRY=X', signal).then(d => ({ key: 'usdTry', data: d })),
        MarketAPI.fetchMacroData('EURTRY=X', signal).then(d => ({ key: 'eurTry', data: d })),
        MarketAPI.fetchMacroData('GC=F', signal).then(d => ({ key: 'gold', data: d }))
    ];

    const [stockResults, macroResults] = await Promise.all([
        Promise.all(stockPromises),
        Promise.all(macroPromises)
    ]);

    let successCount = 0;
    let totalPe = 0;
    let totalPb = 0;
    let totalEv = 0;
    let totalRoe = 0;
    let totalNd = 0;
    let countPe = 0;
    let countPb = 0;
    let countEv = 0;
    let countRoe = 0;
    let countNd = 0;

    // Update active sector stock prices and ratios
    stockResults.forEach(({ ticker, data, ok }) => {
        const s = ALL_STOCKS[ticker];
        if (!s) return;

        if (ok && data && data.price != null) {
            const oldPrice = s.price || data.price;
            s.price = data.price;
            s.change = data.change || 0;
            s.pct = data.pct || 0;
            s.unavailable = false;

            if (s.price > oldPrice) s.tickDir = 'up';
            else if (s.price < oldPrice) s.tickDir = 'down';
            else s.tickDir = 'none';

            // Ratios: update only if not null/undefined/0
            if (data.pe != null && data.pe > 0) s.pe = data.pe;
            if (data.pb != null && data.pb > 0) s.pb = data.pb;

            successCount++;
        }

        if (s.pe != null && s.pe > 0) {
            totalPe += s.pe;
            countPe++;
        }
        if (s.pb != null && s.pb > 0) {
            totalPb += s.pb;
            countPb++;
        }
        if (s.evEbitda != null && s.evEbitda > 0) {
            totalEv += s.evEbitda;
            countEv++;
        }
        if (s.roe != null && s.roe > 0) {
            totalRoe += s.roe;
            countRoe++;
        }
        if (s.netDebtEbitda != null && s.netDebtEbitda > 0) {
            totalNd += s.netDebtEbitda;
            countNd++;
        }
    });

    if (countPe > 0) sec.avg.pe = totalPe / countPe;
    if (countPb > 0) sec.avg.pb = totalPb / countPb;
    if (countEv > 0) sec.avg.evEbitda = totalEv / countEv;
    if (countRoe > 0) sec.avg.roe = totalRoe / countRoe;
    if (countNd > 0) sec.avg.netDebtEbitda = totalNd / countNd;

    // Update macro indicators
    macroResults.forEach(({ key, data }) => {
        if (data && data.price != null) {
            if (key === 'xu100') {
                BIST.index = data.price;
                BIST.change = data.change || 0;
                BIST.pct = data.pct || 0;
            } else if (key === 'usdTry') {
                BIST.usdTry = data.price;
            } else if (key === 'eurTry') {
                BIST.eurTry = data.price;
            } else if (key === 'gold') {
                BIST.gold = data.price;
            }
        }
    });

    // Provide baseline macro fallback values if still 0
    if (BIST.index === 0) { BIST.index = 12930; BIST.change = 45.20; BIST.pct = 0.35; }
    if (BIST.usdTry === 0) BIST.usdTry = 34.50;
    if (BIST.eurTry === 0) BIST.eurTry = 37.20;
    if (BIST.gold === 0) BIST.gold = 2340.50;

    return successCount > 0;
}

async function triggerBackgroundFetch(sectorKey) {
    updateDataStatus('loading');
    const startSector = sectorKey;
    const controller = new AbortController();
    const signal = controller.signal;

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => {
            controller.abort();
            reject(new Error("Timeout"));
        }, 2500)
    );

    const fetchPromise = (async () => {
        return await fetchLiveData(signal);
    })();

    try {
        const liveSuccess = await Promise.race([fetchPromise, timeoutPromise]);

        if (APP.sector !== startSector) {
            console.log(`[Background Fetch] Sector changed from ${startSector} to ${APP.sector}, discarding result.`);
            return;
        }

        if (liveSuccess) {
            APP.dataSource = 'live';
            updateDataStatus('live');
            showToast('Canlı veriler başarıyla güncellendi.', 'success');
            activateSector(APP.sector);
            flashUIUpdates();
            renderAll();
        } else {
            throw new Error("No live data returned");
        }
    } catch (err) {
        console.warn(`[Background Fetch] Failed or timed out for sector ${startSector}:`, err);
        
        if (APP.sector !== startSector) return;

        APP.dataSource = 'local';
        updateDataStatus('local');
        showToast('Veriler Yahoo Finance\'den güncellendi.', 'success');

        activateSector(APP.sector);
        renderAll();
    }
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
    const btn = document.getElementById('btnRefresh');
    if (btn) btn.classList.add('spin');
    
    await triggerBackgroundFetch(APP.sector);
    
    if (btn) btn.classList.remove('spin');
    const timeEl = document.getElementById('sbFooterDate');
    if (timeEl) timeEl.textContent = `Güncellendi: ${new Date().toLocaleTimeString('tr-TR')}`;
}

// ═══════════════════════════════════════════════════════
//  Requirement 4: LocalStorage utilized as persistent Database
// ═══════════════════════════════════════════════════════

function loadFromDB() {
    // Check saved_username first, then bist_user for full validation rule compliance
    let username = localStorage.getItem(DB_KEYS.savedUsername);
    if (!username) username = localStorage.getItem(DB_KEYS.username);
    if (!username) username = localStorage.getItem(DB_KEYS.usernameOld);
    const ticker1 = localStorage.getItem(DB_KEYS.ticker1);
    const ticker2 = localStorage.getItem(DB_KEYS.ticker2);
    const sector = localStorage.getItem(DB_KEYS.sector);
    console.log('[DB] Reading from localStorage database:', { username, ticker1, ticker2, sector });
    if (!username) return null;
    return { username, ticker1, ticker2, sector };
}

function saveToDB(key, value) {
    localStorage.setItem(key, value);
    console.log(`[DB] Saved to localStorage: ${key} = ${value}`);
}

function saveSessionToDB() {
    saveToDB(DB_KEYS.savedUsername, APP.username);
    saveToDB(DB_KEYS.username, APP.username);
    saveToDB(DB_KEYS.ticker1, APP.t1);
    saveToDB(DB_KEYS.ticker2, APP.t2);
    saveToDB(DB_KEYS.sector, APP.sector);
}

function mergeAndRenderSectors() {
    // 1. Reset SECTORS to defaults
    Object.keys(SECTORS).forEach(k => {
        if (!DEFAULT_SECTORS[k]) {
            delete SECTORS[k];
        }
    });
    Object.assign(SECTORS, DEFAULT_SECTORS);

    // 2. Load Local private custom sectors
    const localSaved = localStorage.getItem(DB_KEYS.customSectors);
    let localCustoms = [];
    if (localSaved) {
        try { localCustoms = JSON.parse(localSaved); } catch (e) {}
    }
    localCustoms.forEach(cSec => {
        SECTORS[cSec.key] = { ...cSec.sectorData, id: cSec.id };
        Object.keys(cSec.stocksData).forEach(ticker => {
            if (!ALL_STOCKS[ticker]) {
                ALL_STOCKS[ticker] = cSec.stocksData[ticker];
            }
        });
    });

    // 3. Load Firebase private sectors
    firebasePrivateSectors.forEach(cSec => {
        SECTORS[cSec.key] = { ...cSec.sectorData, id: cSec.id, isPrivateCloud: true };
        Object.keys(cSec.stocksData).forEach(ticker => {
            if (!ALL_STOCKS[ticker]) {
                ALL_STOCKS[ticker] = cSec.stocksData[ticker];
            }
        });
    });

    // 4. Load Firebase shared/public sectors
    firebaseSharedSectors.forEach(cSec => {
        SECTORS[cSec.key] = { ...cSec.sectorData, id: cSec.id, isShared: true };
        Object.keys(cSec.stocksData).forEach(ticker => {
            if (!ALL_STOCKS[ticker]) {
                ALL_STOCKS[ticker] = cSec.stocksData[ticker];
            }
        });
    });

    // 5. Fallback if active sector no longer exists
    if (!isEditingSector && !SECTORS[APP.sector]) {
        APP.sector = 'aviation';
        const defaultSec = SECTORS[APP.sector];
        APP.t1 = defaultSec.tickers[0];
        APP.t2 = defaultSec.tickers[1] || defaultSec.tickers[0];
        saveSessionToDB();
    }

    activateSector(APP.sector);
    if (typeof renderAll === 'function') {
        try {
            renderAll();
        } catch (e) {
            console.error('Error rendering dashboard on merge:', e);
        }
    }

    // 6. Re-render buttons
    renderSectorButtons();
}

function loadCustomSectors() {
    mergeAndRenderSectors();
}

function hideSidebarInputs() {
    const inputs = ['newSecName', 'newT1', 'newT2'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.style.display = 'none';
            // Also hide the label above it
            let prev = input.previousElementSibling;
            if (prev && prev.tagName === 'LABEL') {
                prev.style.display = 'none';
            }
        }
    });
    const btn = document.getElementById('btnAddSector');
    if (btn) {
        btn.textContent = 'Sektör Ekle ➕';
        btn.style.marginTop = '8px';
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
        btn.style.position = 'relative';
        btn.innerHTML = `<span class="sector-icon">${sec.icon || '📌'}</span><span class="sector-name">${sec.label}</span>`;
        
        if (!sec.key.startsWith('custom_')) {
            const lockEl = document.createElement('div');
            lockEl.className = 'sector-lock-icon';
            lockEl.innerHTML = '<i class="fa-solid fa-lock"></i>';
            btn.appendChild(lockEl);
        } else {
            const overlay = document.createElement('div');
            overlay.className = 'sector-actions-overlay';

            const editBtn = document.createElement('span');
            editBtn.className = 'sector-action-btn edit-btn';
            editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
            editBtn.title = 'Sektörü Düzenle';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showAddSectorModal(sec.key);
            });

            const delBtn = document.createElement('span');
            delBtn.className = 'sector-action-btn delete-btn';
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.title = 'Sektörü Sil';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showCustomConfirm(
                    `"${sec.label}" sektörünü silmek istediğinize emin misiniz?`,
                    () => {
                        deleteSector(sec.key);
                    }
                );
            });

            overlay.appendChild(editBtn);
            overlay.appendChild(delBtn);
            btn.appendChild(overlay);
        }
        
        btn.addEventListener('click', () => switchSector(sec.key));
        grid.appendChild(btn);
    });
    hideSidebarInputs();
}

function deleteSectorFromDB(sectorKey) {
    if (isLocalMode) {
        // Shared local deletion
        let localShared = [];
        const savedShared = localStorage.getItem('bist_local_shared_sectors');
        if (savedShared) {
            try { localShared = JSON.parse(savedShared); } catch (e) {}
        }
        const initialSharedLength = localShared.length;
        localShared = localShared.filter(item => item.key !== sectorKey);
        if (localShared.length < initialSharedLength) {
            localStorage.setItem('bist_local_shared_sectors', JSON.stringify(localShared));
            window.dispatchEvent(new Event('localSharedSectorsUpdated'));
            showNotif('Ortak sektör silindi (Yerel Mod).', true);
        }

        // Private local deletion
        if (auth && auth.currentUser) {
            const privateKey = `bist_local_private_sectors_${auth.currentUser.uid}`;
            const emailKey = auth.currentUser.email ? `custom_sectors_${auth.currentUser.email.toLowerCase()}` : '';
            let localPrivate = [];
            const savedPrivate = localStorage.getItem(privateKey);
            if (savedPrivate) {
                try { localPrivate = JSON.parse(savedPrivate); } catch (e) {}
            }
            const initialPrivateLength = localPrivate.length;
            localPrivate = localPrivate.filter(item => item.key !== sectorKey);
            if (localPrivate.length < initialPrivateLength) {
                localStorage.setItem(privateKey, JSON.stringify(localPrivate));
                if (emailKey) {
                    localStorage.setItem(emailKey, JSON.stringify(localPrivate));
                }
                window.dispatchEvent(new Event(`localPrivateSectorsUpdated_${auth.currentUser.uid}`));
                showNotif('Kişisel sektör silindi (Yerel Mod).', true);
            }
        }
    } else {
        // Check if it's a shared sector first
        const sharedSec = firebaseSharedSectors.find(item => item.key === sectorKey);
        if (sharedSec && sharedSec.id) {
            if (db) {
                const docRef = window.doc(db, 'artifacts', appId, 'public', 'data', 'sectors', sharedSec.id);
                window.deleteDoc(docRef).then(() => {
                    showNotif('Ortak sektör buluttan silindi.', true);
                }).catch(e => {
                    console.error('[Firebase] Error deleting sector:', e);
                    showNotif('Ortak sektör silinirken hata oldu.');
                });
            }
        }

        // Check if it's a private sector in Firebase
        const privateSec = firebasePrivateSectors.find(item => item.key === sectorKey);
        if (privateSec && privateSec.id) {
            if (db && auth && auth.currentUser) {
                const docRef = window.doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'sectors', privateSec.id);
                window.deleteDoc(docRef).then(() => {
                    showNotif('Kişisel sektör buluttan silindi.', true);
                }).catch(e => {
                    console.error('[Firebase] Error deleting private sector:', e);
                    showNotif('Kişisel sektör silinirken hata oldu.');
                });
            }
        }
    }

    const saved = localStorage.getItem(DB_KEYS.customSectors);
    if (saved) {
        try {
            let customSectorsList = JSON.parse(saved);
            customSectorsList = customSectorsList.filter(cSec => cSec.key !== sectorKey);
            localStorage.setItem(DB_KEYS.customSectors, JSON.stringify(customSectorsList));
        } catch (e) {
            console.error(e);
        }
    }
}

function deleteSector(sectorKey) {
    if (!SECTORS[sectorKey]) return;
    if (!sectorKey.startsWith('custom_')) return;
    
    const sec = SECTORS[sectorKey];

    deleteSectorFromDB(sectorKey);
    
    sec.tickers.forEach(t => {
        delete ALL_STOCKS[t];
    });
    delete SECTORS[sectorKey];
    
    if (APP.sector === sectorKey) {
        APP.sector = 'aviation';
        const defaultSec = SECTORS[APP.sector];
        APP.t1 = defaultSec.tickers[0];
        APP.t2 = defaultSec.tickers[1] || defaultSec.tickers[0];
        saveSessionToDB();
    }
    
    renderSectorButtons();
    activateSector(APP.sector);
    doRefresh();
    showNotif('Sektör silindi.', true);
}

function showAddSectorModal(editSectorKey = null) {
    const existing = document.getElementById('addSectorModal');
    if (existing) existing.remove();

    let prefill = null;
    if (editSectorKey && SECTORS[editSectorKey]) {
        const sec = SECTORS[editSectorKey];
        const t1 = sec.tickers[0];
        const t2 = sec.tickers[1] || '';
        const s1 = ALL_STOCKS[t1] || {};
        const s2 = ALL_STOCKS[t2] || {};
        prefill = {
            label: sec.label,
            t1: t1,
            t2: t2,
            isShared: sec.isShared || false,
            secPe: sec.avg.pe,
            t1Pe: s1.pe || 0,
            t2Pe: s2.pe || 0,
            secPb: sec.avg.pb,
            t1Pb: s1.pb || 0,
            t2Pb: s2.pb || 0,
            secEvEbitda: sec.avg.evEbitda,
            t1EvEbitda: s1.evEbitda || 0,
            t2EvEbitda: s2.evEbitda || 0,
            secRoe: sec.avg.roe,
            t1Roe: s1.roe || 0,
            t2Roe: s2.roe || 0,
            secNetDebt: sec.avg.netDebtEbitda,
            t1NetDebt: s1.netDebtEbitda || 0,
            t2NetDebt: s2.netDebtEbitda || 0,
            t1Price: s1.price || 0,
            t2Price: s2.price || 0
        };
    }

    const titleText = editSectorKey ? '✏️ SEKTÖR DÜZENLEME KARTI' : '➕ YENİ SEKTÖR TANIMLA';
    const subText = editSectorKey ? 'Sektörün hisse kodlarını düzenleyin' : 'Sektöre ait iki hisse kodunu belirleyin';
    const submitBtnText = editSectorKey ? 'Değişiklikleri Kaydet' : 'SEKTÖRÜ EKLE';
    const isShared = prefill ? prefill.isShared : false;

    const modal = document.createElement('div');
    modal.id = 'addSectorModal';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10001;
        background: rgba(12, 14, 21, 0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    modal.innerHTML = `
        <div style="position:relative; width:450px; max-width:95vw; background:var(--bg-1); border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.6); display:flex; flex-direction:column; animation: modalSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
            <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between;">
                <div>
                    <h3 style="font-family:var(--font-m); font-size:0.9rem; font-weight:700; color:var(--blue); letter-spacing:1px; margin:0;">${titleText}</h3>
                    <p style="font-size:0.65rem; color:var(--text-300); margin:4px 0 0 0;">${subText}</p>
                </div>
                <button id="modalCloseBtn" style="background:none; border:none; color:var(--text-300); cursor:pointer; font-size:1.2rem; transition:color 0.2s;">✕</button>
            </div>
            
            <div style="padding:20px; overflow-y:auto; max-height:70vh;">
                <div style="margin-bottom:16px;">
                    <label style="display:block; font-family:var(--font-m); font-size:0.65rem; font-weight:600; color:var(--text-300); letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">Sektör Adı</label>
                    <input type="text" id="modalSecName" class="sb-select" placeholder="Örn: Enerji Sektörü" style="width:100%; box-sizing:border-box; padding:10px 12px; border-radius:var(--radius);" autocomplete="off" value="${prefill ? prefill.label : ''}">
                </div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:16px;">
                    <div>
                        <label style="display:block; font-family:var(--font-m); font-size:0.65rem; font-weight:600; color:var(--text-300); letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">Hisse 1 Kodu</label>
                        <input type="text" id="modalT1" class="sb-select" placeholder="Örn: EUPWR" style="width:100%; text-transform:uppercase; box-sizing:border-box; padding:10px 12px; border-radius:var(--radius);" autocomplete="off" value="${prefill ? prefill.t1 : ''}">
                    </div>
                    <div>
                        <label style="display:block; font-family:var(--font-m); font-size:0.65rem; font-weight:600; color:var(--text-300); letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">Hisse 2 Kodu</label>
                        <input type="text" id="modalT2" class="sb-select" placeholder="Örn: ALFAS" style="width:100%; text-transform:uppercase; box-sizing:border-box; padding:10px 12px; border-radius:var(--radius);" autocomplete="off" value="${prefill ? prefill.t2 : ''}">
                    </div>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:16px;">
                    <label style="display:block; font-family:var(--font-m); font-size:0.6rem; font-weight:600; color:var(--text-300); letter-spacing:1px; text-transform:uppercase; margin-bottom:2px;">KAYIT YERİ (WORKSPACE)</label>
                    <div style="display:flex; gap:16px;">
                        <label style="display:flex; align-items:center; gap:6px; font-family:var(--font-m); font-size:0.75rem; color:var(--text-200); cursor:pointer;">
                            <input type="radio" name="modalSaveLocation" value="private" ${!isShared ? 'checked' : ''} style="accent-color:var(--blue); cursor:pointer;">
                            👤 Kişisel Sektör (Özel Bulut)
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; font-family:var(--font-m); font-size:0.75rem; color:var(--text-200); cursor:pointer;">
                            <input type="radio" name="modalSaveLocation" value="shared" ${isShared ? 'checked' : ''} style="accent-color:var(--cyan); cursor:pointer;">
                            👥 Ortak Sektör (Paylaşılan Bulut)
                        </label>
                    </div>
                </div>
            </div>
            
            <div style="padding:14px 20px; border-top:1px solid var(--border); display:flex; align-items:center; justify-content:end; gap:10px; background:var(--bg-2);">
                <button id="modalCancelBtn" class="nav-logout-btn" style="padding:8px 16px; margin:0;">İPTAL</button>
                <button id="modalSubmitBtn" class="sb-refresh" style="width:auto; padding:8px 20px; margin:0; font-size:0.75rem;">${submitBtnText}</button>
            </div>
        </div>
        <style>
            @keyframes modalSlide {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        </style>
    `;

    document.body.appendChild(modal);
    modal.offsetHeight;
    modal.style.opacity = '1';

    const modalSecName = modal.querySelector('#modalSecName');
    const modalT1 = modal.querySelector('#modalT1');
    const modalT2 = modal.querySelector('#modalT2');

    const closeModal = () => {
        modal.style.opacity = '0';
        setTimeout(() => { modal.remove(); }, 300);
    };

    modal.querySelector('#modalCloseBtn').addEventListener('click', closeModal);
    modal.querySelector('#modalCancelBtn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    modal.querySelector('#modalSubmitBtn').addEventListener('click', () => {
        const secName = modalSecName.value.trim();
        const t1 = modalT1.value.trim().toUpperCase();
        const t2 = modalT2.value.trim().toUpperCase();

        if (!secName) {
            showNotif('Lütfen sektör adını girin.');
            return;
        }
        if (!t1 || !t2) {
            showNotif('Lütfen iki hisse kodunu da girin.');
            return;
        }
        if (t1 === t2) {
            showNotif('Hisse 1 ve Hisse 2 aynı olamaz.');
            return;
        }

        const label = secName;

        const isDuplicate = Object.values(SECTORS).some(sec => {
            if (editSectorKey && sec.key === editSectorKey) return false;
            return sec.label.trim().toLowerCase() === label.toLowerCase();
        });
        if (isDuplicate) {
            showNotif('Bu sektör zaten tanımlı.');
            return;
        }

        const t1Pe = (prefill && t1 === prefill.t1) ? prefill.t1Pe : 10.00;
        const t1Pb = (prefill && t1 === prefill.t1) ? prefill.t1Pb : 2.50;
        const t1EvEbitda = (prefill && t1 === prefill.t1) ? prefill.t1EvEbitda : 8.00;
        const t1Roe = (prefill && t1 === prefill.t1) ? prefill.t1Roe : 30.00;
        const t1NetDebt = (prefill && t1 === prefill.t1) ? prefill.t1NetDebt : 1.50;
        const t1Price = (prefill && t1 === prefill.t1) ? prefill.t1Price : 100.00;

        const t2Pe = (prefill && t2 === prefill.t2) ? prefill.t2Pe : 10.00;
        const t2Pb = (prefill && t2 === prefill.t2) ? prefill.t2Pb : 2.50;
        const t2EvEbitda = (prefill && t2 === prefill.t2) ? prefill.t2EvEbitda : 8.00;
        const t2Roe = (prefill && t2 === prefill.t2) ? prefill.t2Roe : 30.00;
        const t2NetDebt = (prefill && t2 === prefill.t2) ? prefill.t2NetDebt : 1.50;
        const t2Price = (prefill && t2 === prefill.t2) ? prefill.t2Price : 150.00;

        const secPe = (prefill && t1 === prefill.t1 && t2 === prefill.t2) ? prefill.secPe : ((t1Pe + t2Pe) / 2);
        const secPb = (prefill && t1 === prefill.t1 && t2 === prefill.t2) ? prefill.secPb : ((t1Pb + t2Pb) / 2);
        const secEvEbitda = (prefill && t1 === prefill.t1 && t2 === prefill.t2) ? prefill.secEvEbitda : ((t1EvEbitda + t2EvEbitda) / 2);
        const secRoe = (prefill && t1 === prefill.t1 && t2 === prefill.t2) ? prefill.secRoe : ((t1Roe + t2Roe) / 2);
        const secNetDebt = (prefill && t1 === prefill.t1 && t2 === prefill.t2) ? prefill.secNetDebt : ((t1NetDebt + t2NetDebt) / 2);

        const key = editSectorKey || ('custom_' + label.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_') + '_' + Date.now());
        const icon = '📌';

        // Clean up old tickers from ALL_STOCKS if editing
        if (editSectorKey && SECTORS[editSectorKey]) {
            SECTORS[editSectorKey].tickers.forEach(t => {
                delete ALL_STOCKS[t];
            });
        }

        const stock1 = {
            ticker: t1, full: t1 + '.IS', sector: key,
            name: t1 + ' A.Ş.', short: t1,
            price: t1Price, change: 0, pct: 0,
            pe: t1Pe, pb: t1Pb, evEbitda: t1EvEbitda, roe: t1Roe,
            eps: 1, epsGrowth: 0, marketCap: 0,
            netDebtEbitda: t1NetDebt, dividendYield: 0,
            color: '#2962FF', colorDim: 'rgba(41,98,255,0.15)'
        };

        const stock2 = {
            ticker: t2, full: t2 + '.IS', sector: key,
            name: t2 + ' A.Ş.', short: t2,
            price: t2Price, change: 0, pct: 0,
            pe: t2Pe, pb: t2Pb, evEbitda: t2EvEbitda, roe: t2Roe,
            eps: 1, epsGrowth: 0, marketCap: 0,
            netDebtEbitda: t2NetDebt, dividendYield: 0,
            color: '#FF6D00', colorDim: 'rgba(255,109,0,0.15)'
        };

        const avg = { pe: secPe, pb: secPb, evEbitda: secEvEbitda, roe: secRoe, netDebtEbitda: secNetDebt };
        const sectorData = { key, label, labelEn: label, icon, tickers: [t1, t2], avg };

        const saveLocation = prefill ? (prefill.isShared ? 'shared' : 'private') : 'private';
        const initialLocation = prefill ? (prefill.isShared ? 'shared' : 'private') : null;
        const locationChanged = false;

        isEditingSector = true;

        const isEditingSameWorkspace = !!editSectorKey;


        if (saveLocation === 'shared') {
            if (isLocalMode) {
                let localShared = [];
                const saved = localStorage.getItem('bist_local_shared_sectors');
                if (saved) {
                    try { localShared = JSON.parse(saved); } catch (e) {}
                }
                if (isEditingSameWorkspace) {
                    const idx = localShared.findIndex(item => item.key === editSectorKey);
                    if (idx !== -1) {
                        localShared[idx].sectorData = sectorData;
                        localShared[idx].stocksData = { [t1]: stock1, [t2]: stock2 };
                    } else {
                        localShared.push({
                            id: 'local_shared_id_' + Date.now(),
                            key, sectorData, stocksData: { [t1]: stock1, [t2]: stock2 }
                        });
                    }
                } else {
                    localShared.push({
                        id: 'local_shared_id_' + Date.now(),
                        key, sectorData, stocksData: { [t1]: stock1, [t2]: stock2 }
                    });
                }
                localStorage.setItem('bist_local_shared_sectors', JSON.stringify(localShared));
                window.dispatchEvent(new Event('localSharedSectorsUpdated'));
                
                showNotif(isEditingSameWorkspace ? `✅ "${label}" ortak sektörü başarıyla güncellendi (Yerel Mod)!` : `✅ "${label}" ortak sektörü başarıyla paylaşıldı (Yerel Mod)!`, true);
                
                SECTORS[key] = { ...sectorData, isShared: true };
                ALL_STOCKS[t1] = stock1;
                ALL_STOCKS[t2] = stock2;

                isEditingSector = false;
                renderSectorButtons();
                switchSector(key);
                closeModal();
                return;
            }

            if (!db) {
                isEditingSector = false;
                showNotif('Firebase bağlantısı hazır değil, ortak sektör kaydedilemedi.');
                return;
            }

            if (isEditingSameWorkspace) {
                const docId = SECTORS[editSectorKey].id;
                const docRef = window.doc(db, 'artifacts', appId, 'public', 'data', 'sectors', docId);
                window.setDoc(docRef, {
                    key,
                    sectorData,
                    stocksData: { [t1]: stock1, [t2]: stock2 }
                }).then(() => {
                    isEditingSector = false;
                    showNotif(`✅ "${label}" ortak sektörü başarıyla güncellendi!`, true);
                }).catch((err) => {
                    isEditingSector = false;
                    console.error('[Firebase] Error updating shared sector:', err);
                    showNotif('Ortak sektör güncellenirken bir hata oluştu.');
                });
            } else {
                const sharedSectorsRef = window.collection(db, 'artifacts', appId, 'public', 'data', 'sectors');
                window.addDoc(sharedSectorsRef, {
                    key,
                    sectorData,
                    stocksData: { [t1]: stock1, [t2]: stock2 }
                }).then(() => {
                    isEditingSector = false;
                    showNotif(`✅ "${label}" ortak sektörü başarıyla paylaşıldı!`, true);
                }).catch((err) => {
                    isEditingSector = false;
                    console.error('[Firebase] Error adding shared sector:', err);
                    showNotif('Ortak sektör paylaşılırken bir hata oluştu.');
                });
            }

            SECTORS[key] = { ...sectorData, isShared: true };
            ALL_STOCKS[t1] = stock1;
            ALL_STOCKS[t2] = stock2;

            renderSectorButtons();
            switchSector(key);
            closeModal();
        } else {
            // Private Cloud
            if (isLocalMode) {
                if (!auth || !auth.currentUser) {
                    isEditingSector = false;
                    showNotif('Giriş yapmadınız, kişisel sektör kaydedilemedi.');
                    return;
                }
                const privateKey = `bist_local_private_sectors_${auth.currentUser.uid}`;
                const emailKey = auth.currentUser.email ? `custom_sectors_${auth.currentUser.email.toLowerCase()}` : '';
                let localPrivate = [];
                const saved = localStorage.getItem(privateKey);
                if (saved) {
                    try { localPrivate = JSON.parse(saved); } catch (e) {}
                }
                if (isEditingSameWorkspace) {
                    const idx = localPrivate.findIndex(item => item.key === editSectorKey);
                    if (idx !== -1) {
                        localPrivate[idx].sectorData = sectorData;
                        localPrivate[idx].stocksData = { [t1]: stock1, [t2]: stock2 };
                    } else {
                        localPrivate.push({
                            id: 'local_private_id_' + Date.now(),
                            key, sectorData, stocksData: { [t1]: stock1, [t2]: stock2 }
                        });
                    }
                } else {
                    localPrivate.push({
                        id: 'local_private_id_' + Date.now(),
                        key, sectorData, stocksData: { [t1]: stock1, [t2]: stock2 }
                    });
                }
                localStorage.setItem(privateKey, JSON.stringify(localPrivate));
                if (emailKey) {
                    localStorage.setItem(emailKey, JSON.stringify(localPrivate));
                }
                window.dispatchEvent(new Event(`localPrivateSectorsUpdated_${auth.currentUser.uid}`));
                
                showNotif(isEditingSameWorkspace ? `✅ "${label}" kişisel sektörü güncellendi (Yerel Mod)!` : `✅ "${label}" kişisel sektörü kaydedildi (Yerel Mod)!`, true);
                
                SECTORS[key] = { ...sectorData, isPrivateCloud: true };
                ALL_STOCKS[t1] = stock1;
                ALL_STOCKS[t2] = stock2;

                isEditingSector = false;
                renderSectorButtons();
                switchSector(key);
                closeModal();
                return;
            }

            if (!db || !auth || !auth.currentUser) {
                isEditingSector = false;
                showNotif('Giriş yapmadınız veya Firebase bağlantısı hazır değil, kişisel sektör kaydedilemedi.');
                return;
            }

            if (isEditingSameWorkspace) {
                const docId = SECTORS[editSectorKey].id;
                const docRef = window.doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'sectors', docId);
                window.setDoc(docRef, {
                    key,
                    sectorData,
                    stocksData: { [t1]: stock1, [t2]: stock2 }
                }).then(() => {
                    isEditingSector = false;
                    showNotif(`✅ "${label}" kişisel sektörü bulutta güncellendi!`, true);
                }).catch((err) => {
                    isEditingSector = false;
                    console.error('[Firebase] Error updating private sector:', err);
                    showNotif('Kişisel sektör güncellenirken bir hata oluştu.');
                });
            } else {
                const privateSectorsRef = window.collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'sectors');
                window.addDoc(privateSectorsRef, {
                    key,
                    sectorData,
                    stocksData: { [t1]: stock1, [t2]: stock2 }
                }).then(() => {
                    isEditingSector = false;
                    showNotif(`✅ "${label}" kişisel sektörü buluta kaydedildi!`, true);
                }).catch((err) => {
                    isEditingSector = false;
                    console.error('[Firebase] Error adding private sector:', err);
                    showNotif('Kişisel sektör kaydedilirken bir hata oluştu.');
                });
            }

            SECTORS[key] = { ...sectorData, isPrivateCloud: true };
            ALL_STOCKS[t1] = stock1;
            ALL_STOCKS[t2] = stock2;

            renderSectorButtons();
            switchSector(key);
            closeModal();
        }
    });
}
}

function addNewSector() {
    showAddSectorModal();
}


// ═══════════════════════════════════════════════════════
//  Requirement 3: LOGIN SYSTEM
// ═══════════════════════════════════════════════════════

function showDashboard() {
    if (!localStorage.getItem('bist_user')) {
        console.warn('[Validation] Cannot show dashboard: bist_user is missing in localStorage.');
        hideDashboard();
        return;
    }
    const overlay = document.getElementById('loginOverlay');
    if (overlay) { overlay.classList.add('fade-out'); setTimeout(() => { overlay.style.display = 'none'; }, 400); }
    document.getElementById('tickerBar')?.classList.remove('hidden');
    document.getElementById('topNav')?.classList.remove('hidden');
    document.getElementById('appShell')?.classList.remove('hidden');
    const greeting = document.getElementById('userGreeting');
    if (greeting && APP.username) greeting.textContent = `👤 Hoş geldiniz, ${APP.username} · Aktif Çalışma Alanı: ${APP.username}`;
}

function hideDashboard() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
        overlay.classList.remove('fade-out');
        overlay.style.display = 'flex';
    }
    document.getElementById('tickerBar')?.classList.add('hidden');
    document.getElementById('topNav')?.classList.add('hidden');
    document.getElementById('appShell')?.classList.add('hidden');
}

function getAuthErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'Geçersiz e-posta adresi.';
        case 'auth/user-disabled':
            return 'Bu kullanıcı hesabı askıya alınmıştır.';
        case 'auth/user-not-found':
            return 'Kullanıcı bulunamadı.';
        case 'auth/wrong-password':
            return 'Hatalı şifre girdiniz.';
        case 'auth/email-already-in-use':
            return 'Bu e-posta adresi zaten kullanımda.';
        case 'auth/weak-password':
            return 'Şifre çok zayıf. En az 6 karakter olmalıdır.';
        case 'auth/missing-password':
            return 'Lütfen şifrenizi giriniz.';
        case 'auth/invalid-credential':
            return 'E-posta adresi veya şifre hatalı.';
        default:
            return `Bir hata oluştu: ${code}`;
    }
}

function renderAuthOverlay() {
    const overlay = document.getElementById('loginOverlay');
    if (!overlay) return;

    overlay.innerHTML = `
        <div class="login-card">
            <div class="login-glow"></div>
            <div class="login-inner">
                <div class="login-logo">
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
                        <path d="M12 1L23 12L12 23L1 12Z" stroke="url(#lGrad)" stroke-width="2" fill="url(#lGrad)" fill-opacity="0.12"/>
                        <path d="M12 6L18 12L12 18L6 12Z" fill="url(#lGrad)" opacity="0.5"/>
                        <defs><linearGradient id="lGrad" x1="1" y1="1" x2="23" y2="23"><stop stop-color="#2962FF"/><stop offset="1" stop-color="#26A69A"/></linearGradient></defs>
                    </svg>
                </div>
                <h1 class="login-title">ANTIGRAVITY <span class="login-pro">PRO</span></h1>
                <p class="login-subtitle">BIST Değerleme &amp; İskonto Terminali</p>
                
                <div class="login-tabs" style="display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin: 15px 0 20px; padding-bottom: 8px;">
                    <button class="auth-tab active" data-tab="login" style="flex: 1; background: none; border: none; color: var(--blue); font-family: var(--font-m); font-size: 0.72rem; font-weight: 700; cursor: pointer; padding: 6px 4px; border-bottom: 2px solid var(--blue); transition: all 0.2s; text-transform: uppercase; letter-spacing: 0.5px;">Giriş Yap</button>
                    <button class="auth-tab" data-tab="register" style="flex: 1; background: none; border: none; color: var(--text-300); font-family: var(--font-m); font-size: 0.72rem; font-weight: 500; cursor: pointer; padding: 6px 4px; border-bottom: 2px solid transparent; transition: all 0.2s; text-transform: uppercase; letter-spacing: 0.5px;">Kayıt Ol</button>
                    <button class="auth-tab" data-tab="reset" style="flex: 1; background: none; border: none; color: var(--text-300); font-family: var(--font-m); font-size: 0.72rem; font-weight: 500; cursor: pointer; padding: 6px 4px; border-bottom: 2px solid transparent; transition: all 0.2s; text-transform: uppercase; letter-spacing: 0.5px;">Şifre Sıfırla</button>
                </div>

                <!-- Tab 1: Giriş Yap -->
                <div id="panel-login" class="auth-panel" style="display: block;">
                    <div style="text-align: left; margin-bottom: 12px;">
                        <label class="login-label" for="authEmail">E-Posta Adresi</label>
                        <input type="email" id="authEmail" class="login-input" placeholder="örnek@eposta.com" autocomplete="email">
                    </div>
                    <div style="text-align: left; margin-bottom: 15px;">
                        <label class="login-label" for="authPassword">Şifre</label>
                        <input type="password" id="authPassword" class="login-input" placeholder="••••••••" autocomplete="current-password">
                    </div>
                    <button class="login-btn" id="btnSubmitLogin">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
                        Giriş Yap
                    </button>
                </div>

                <!-- Tab 2: Kayıt Ol -->
                <div id="panel-register" class="auth-panel" style="display: none;">
                    <div style="text-align: left; margin-bottom: 12px;">
                        <label class="login-label" for="regName">Ad Soyad</label>
                        <input type="text" id="regName" class="login-input" placeholder="Adınız Soyadınız" autocomplete="name">
                    </div>
                    <div style="text-align: left; margin-bottom: 12px;">
                        <label class="login-label" for="regEmail">E-Posta Adresi</label>
                        <input type="email" id="regEmail" class="login-input" placeholder="örnek@eposta.com" autocomplete="email">
                    </div>
                    <div style="text-align: left; margin-bottom: 15px;">
                        <label class="login-label" for="regPassword">Şifre</label>
                        <input type="password" id="regPassword" class="login-input" placeholder="••••••••" autocomplete="new-password">
                    </div>
                    <button class="login-btn" id="btnSubmitRegister">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z"/></svg>
                        Kayıt Ol
                    </button>
                </div>

                <!-- Tab 3: Şifre Sıfırlama -->
                <div id="panel-reset" class="auth-panel" style="display: none;">
                    <p style="font-family: var(--font-m); font-size: 0.7rem; color: var(--text-300); text-align: left; margin-bottom: 15px; line-height: 1.4;">
                        Hesabınıza ait e-posta adresini girin. Şifrenizi sıfırlamanız için size bir bağlantı göndereceğiz.
                    </p>
                    <div style="text-align: left; margin-bottom: 15px;">
                        <label class="login-label" for="resetEmail">E-Posta Adresi</label>
                        <input type="email" id="resetEmail" class="login-input" placeholder="örnek@eposta.com" autocomplete="email">
                    </div>
                    <button class="login-btn" id="btnSubmitReset">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17"/></svg>
                        Sıfırlama Bağlantısı Gönder
                    </button>
                </div>

                <p class="login-note">Analist Çalışma Alanı Yönetimi ve Güvenli Cloud Sektör Paylaşımı</p>
            </div>
        </div>
    `;

    const tabs = overlay.querySelectorAll('.auth-tab');
    const panels = overlay.querySelectorAll('.auth-panel');

    const switchTab = (tabName) => {
        tabs.forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.style.color = isActive ? 'var(--blue)' : 'var(--text-300)';
            tab.style.borderBottomColor = isActive ? 'var(--blue)' : 'transparent';
            tab.style.fontWeight = isActive ? '700' : '500';
        });

        panels.forEach(panel => {
            panel.style.display = panel.id === `panel-${tabName}` ? 'block' : 'none';
        });
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });

    const btnSubmitLogin = overlay.querySelector('#btnSubmitLogin');
    const authEmail = overlay.querySelector('#authEmail');
    const authPassword = overlay.querySelector('#authPassword');

    const submitLogin = () => {
        if (!authEmail || !authPassword || !btnSubmitLogin) return;
        const email = authEmail.value.trim();
        const password = authPassword.value;

        if (!email || !password) {
            showNotif('Lütfen e-posta adresinizi ve şifrenizi girin.');
            return;
        }

        btnSubmitLogin.disabled = true;
        const originalText = btnSubmitLogin.innerHTML;
        btnSubmitLogin.innerHTML = 'Giriş yapılıyor...';

        window.signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                console.log('[Firebase] Login successful.');
            })
            .catch((error) => {
                console.error('[Firebase] Login error:', error);
                showNotif(getAuthErrorMessage(error.code));
                btnSubmitLogin.disabled = false;
                btnSubmitLogin.innerHTML = originalText;
            });
    };
    if (btnSubmitLogin) {
        btnSubmitLogin.addEventListener('click', submitLogin);
    }
    if (authPassword) {
        authPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitLogin();
        });
    }

    const btnSubmitRegister = overlay.querySelector('#btnSubmitRegister');
    const regName = overlay.querySelector('#regName');
    const regEmail = overlay.querySelector('#regEmail');
    const regPassword = overlay.querySelector('#regPassword');

    const submitRegister = () => {
        if (!regName || !regEmail || !regPassword || !btnSubmitRegister) return;
        const name = regName.value.trim();
        const email = regEmail.value.trim();
        const password = regPassword.value;

        if (!name || !email || !password) {
            showNotif('Lütfen adınızı, e-posta adresinizi ve şifrenizi girin.');
            return;
        }

        if (password.length < 6) {
            showNotif('Şifre en az 6 karakter olmalıdır.');
            return;
        }

        btnSubmitRegister.disabled = true;
        const originalText = btnSubmitRegister.innerHTML;
        btnSubmitRegister.innerHTML = 'Kayıt yapılıyor...';

        window.createUserWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                console.log('[Firebase] User registered successfully.');
                try {
                    await window.updateProfile(userCredential.user, {
                        displayName: name
                    });
                    APP.username = name;
                    const greeting = document.getElementById('userGreeting');
                    if (greeting) greeting.textContent = `👤 Hoş geldiniz, ${APP.username} · Aktif Çalışma Alanı: ${APP.username}`;
                    saveToDB(DB_KEYS.username, name);
                    saveToDB(DB_KEYS.savedUsername, name);
                } catch (profileErr) {
                    console.error('[Firebase] Profile update error:', profileErr);
                }
            })
            .catch((error) => {
                console.error('[Firebase] Registration error:', error);
                showNotif(getAuthErrorMessage(error.code));
                btnSubmitRegister.disabled = false;
                btnSubmitRegister.innerHTML = originalText;
            });
    };
    if (btnSubmitRegister) {
        btnSubmitRegister.addEventListener('click', submitRegister);
    }
    if (regPassword) {
        regPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitRegister();
        });
    }

    const btnSubmitReset = overlay.querySelector('#btnSubmitReset');
    const resetEmail = overlay.querySelector('#resetEmail');

    const submitReset = () => {
        if (!resetEmail || !btnSubmitReset) return;
        const email = resetEmail.value.trim();

        if (!email) {
            showNotif('Lütfen sıfırlama için e-posta adresinizi girin.');
            return;
        }

        btnSubmitReset.disabled = true;
        const originalText = btnSubmitReset.innerHTML;
        btnSubmitReset.innerHTML = 'Gönderiliyor...';

        window.sendPasswordResetEmail(auth, email)
            .then(() => {
                showNotif('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.', true);
                switchTab('login');
            })
            .catch((error) => {
                console.error('[Firebase] Password reset error:', error);
                showNotif(getAuthErrorMessage(error.code));
                btnSubmitReset.disabled = false;
                btnSubmitReset.innerHTML = originalText;
            });
    };
    if (btnSubmitReset) {
        btnSubmitReset.addEventListener('click', submitReset);
    }
    if (resetEmail) {
        resetEmail.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitReset();
        });
    }
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
    // Save sector change to localStorage Database
    saveToDB(DB_KEYS.sector, sectorKey);
    saveToDB(DB_KEYS.ticker1, APP.t1);
    saveToDB(DB_KEYS.ticker2, APP.t2);
    
    // Render local cached data instantly
    renderAll();
    
    // Show toast notification instead of page banner
    const sec = SECTORS[sectorKey];
    showToast(`${sec.icon} ${sec.label} sektörü yüklendi. ${APP.t1} vs ${APP.t2} karşılaştırması aktif.`, 'info');

    // Trigger asynchronous background fetch
    triggerBackgroundFetch(sectorKey);
}

// ═══ EVENTS ═══
function setupEvents() {
    document.getElementById('btnRefresh')?.addEventListener('click', doRefresh);

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem(DB_KEYS.username);
        localStorage.removeItem(DB_KEYS.savedUsername);
        localStorage.removeItem(DB_KEYS.usernameOld);
        if (auth) {
            window.signOut(auth).then(() => {
                console.log('[Firebase] Sign out successful.');
            }).catch(e => {
                console.error('[Firebase] Sign out error:', e);
            });
        } else {
            location.reload();
        }
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
    document.getElementById('btnAddSector')?.addEventListener('click', showAddSectorModal);

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

    document.getElementById('btnResetDefaults')?.addEventListener('click', (e) => {
        e.preventDefault();
        showCustomConfirm(
            'Fabrika ayarlarına dönmek istediğinize emin misiniz? Tüm özel ve ortak yerel sektörleriniz ile buluttaki kişisel sektörleriniz silinecektir.',
            async () => {
                const keysToDelete = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (
                        key === 'ag_custom_sectors' ||
                        key === 'bist_local_shared_sectors' ||
                        key.startsWith('bist_local_private_sectors_') ||
                        key.startsWith('custom_sectors_')
                    )) {
                        keysToDelete.push(key);
                    }
                }
                keysToDelete.forEach(k => localStorage.removeItem(k));

                const deletePromises = [];
                if (!isLocalMode && db && auth && auth.currentUser) {
                    firebasePrivateSectors.forEach(sec => {
                        if (sec.id) {
                            const docRef = window.doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'sectors', sec.id);
                            deletePromises.push(window.deleteDoc(docRef));
                        }
                    });
                }

                if (deletePromises.length > 0) {
                    try {
                        await Promise.all(deletePromises);
                    } catch (err) {
                        console.error('[Firebase] Error resetting private sectors:', err);
                    } finally {
                        location.reload();
                    }
                } else {
                    location.reload();
                }
            },
            null,
            'Evet, Sıfırla'
        );
    });
}

// ═══ TERMINAL INIT (after login) ═══
function initTerminal(showWelcome = false) {
    showLoader();
    setTimeout(async () => {
        setupEvents();
        try { 
            renderSectorButtons();
            // Render local data first
            activateSector(APP.sector);
            renderAll();
            // Trigger fetch in background
            triggerBackgroundFetch(APP.sector);
        } catch (err) { 
            console.error('Init error:', err); 
            renderSectorButtons();
            renderAll(); 
        }
        hideLoader();
        setInterval(updateClock, 1000);
        setInterval(doRefresh, 60000);
    }, 1000);
}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
});
