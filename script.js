function showModal({ title = 'Notice', message = '', type = 'alert', variant = 'info', defaultValue = '', code = null, options = [], okText = 'OK', cancelText = 'Cancel', confirmText = 'Yes', denyText = 'No', maxLength = null } = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-modal');
        const box = document.getElementById('custom-modal-box');
        const iconEl = document.getElementById('custom-modal-icon');
        const titleEl = document.getElementById('custom-modal-title');
        const msgEl = document.getElementById('custom-modal-message');
        const inputEl = document.getElementById('custom-modal-input');
        const codeWrap = document.getElementById('custom-modal-code-wrap');
        const codeEl = document.getElementById('custom-modal-code');
        const copyBtn = document.getElementById('custom-modal-copy-btn');
        const buttonsEl = document.getElementById('custom-modal-buttons');

        box.className = 'menu-box modal-box' + (variant === 'warning' ? ' modal-warning' : variant === 'success' ? ' modal-success' : '');
        iconEl.textContent = variant === 'warning' ? '⚠️' : variant === 'success' ? '✅' : 'ℹ️';
        titleEl.textContent = title;
        msgEl.textContent = message;
        buttonsEl.innerHTML = '';
        buttonsEl.classList.toggle('modal-buttons-stacked', type === 'choice');
        inputEl.style.display = 'none';
        inputEl.value = '';
        codeWrap.style.display = 'none';

        function close(result) {
            overlay.style.display = 'none';
            document.removeEventListener('keydown', keyHandler, true);
            resolve(result);
        }

        function keyHandler(e) {
            if (e.key === 'Escape') {
                e.stopPropagation();
                close(type === 'prompt' ? null : false);
            } else if (e.key === 'Enter' && type !== 'prompt') {
                e.stopPropagation();
                close(true);
            }
        }

        function addButton(text, onClick, danger) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            if (danger) btn.style.backgroundColor = '#c0392b';
            btn.onclick = onClick;
            buttonsEl.appendChild(btn);
            return btn;
        }

        if (type === 'confirm') {
            addButton(confirmText, () => close(true));
            addButton(denyText, () => close(false), true);
        } else if (type === 'prompt') {
            inputEl.style.display = 'block';
            inputEl.value = defaultValue || '';
            if (maxLength) {
                inputEl.setAttribute('maxlength', maxLength);
            } else {
                inputEl.removeAttribute('maxlength');
            }
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(inputEl.value.trim()); }
            };
            addButton(okText, () => close(inputEl.value.trim()));
            addButton(cancelText, () => close(null));
        } else if (type === 'roomcode') {
            codeWrap.style.display = 'flex';
            codeEl.textContent = code;
            copyBtn.textContent = 'Copy Code';
            copyBtn.onclick = () => {
                const done = () => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 1500);
                };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(code).then(done).catch(done);
                } else {
                    done();
                }
            };
            addButton("Let's Play", () => close(true));
        } else if (type === 'choice') {
            options.forEach((label, idx) => addButton(label, () => close(idx)));
        } else {
            addButton(okText, () => close(true));
        }

        overlay.style.display = 'flex';
        document.addEventListener('keydown', keyHandler, true);
        if (type === 'prompt') setTimeout(() => inputEl.focus(), 50);
    });
}

// Fire-and-forget notice popup (drop-in replacement for alert())
function notify(message, title = 'Notice', variant = 'info') {
    showModal({ title, message, type: 'alert', variant });
}

function announceToAll(message, title = 'Notice', variant = 'info') {
    notify(message, title, variant);
    if (isMultiplayerMode) {
        pendingBroadcastEvents.push({ message, title, variant });
    }
}

// --- "YOUR TURN" ANNOUNCEMENT POPUP ---
let turnPopupTimeout = null;
function showTurnPopup(text) {
    const el = document.getElementById('turn-popup');
    const textEl = document.getElementById('turn-popup-text');
    if (!el || !textEl) return;

    textEl.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // force reflow so the fade replays if triggered again quickly
    el.classList.add('show');

    if (turnPopupTimeout) clearTimeout(turnPopupTimeout);
    turnPopupTimeout = setTimeout(() => {
        el.classList.remove('show');
    }, 1800);
}

// Tracks which turn we last announced (playerIndex:turnNumber) so this only
// fires once per actual turn change, not on every updateUI() re-render.
let lastAnnouncedTurnKey = null;
function announceTurnChange() {
    const player = players[activePlayerIndex];
    if (!player) return;

    const key = `${activePlayerIndex}:${gameState.turnNumber}`;
    if (key === lastAnnouncedTurnKey) return;
    lastAnnouncedTurnKey = key;

    if (isMultiplayerMode) {
        // Only pop up for the browser tab that actually controls this player -
        // everyone else can already see whose turn it is in the status bar.
        if (player.id === myPlayerId) {
            showTurnPopup("Your Turn!");
        }
    } else {
        showTurnPopup(`${player.playerName}'s Turn`);
    }
}

let numPlayers = 4;
let activePlayerIndex = 0;
let lorienHolderId = null;
let players = [];
let localPlayerName = "Player 1";

// --- MULTIPLAYER NETWORK STATE ---
let peer = null;
let conn = null;                // guest's single connection up to the host
let hostConns = [];             // host's list of { connection, playerId } for each guest
let nextAssignablePlayerId = 2; // host hands these out to guests as they connect, 2..numPlayers
let isHost = false;
let isMultiplayerMode = false;
let hostingForMultiplayer = false;
let myPlayerId = 1;             // which player THIS browser tab is allowed to act as
let roomCode = null;            // the 6-digit code guests use to join our room (host only)
let pendingBroadcastEvents = []; // game-event popups (leaf/destination/ring/winner) waiting to go out with the next state sync

let myRejoinToken = null;       // secret the host gave us when we first joined; proves a later reconnect is "us" again
let hostPeerIdForRejoin = null; // host's room code, kept so we can reconnect without the user re-entering it
let reconnectTimer = null;      // pending retry timer (guest side), so we don't stack up multiple retry loops
let reconnectNoticeShown = false; // so we only pop up "reconnecting..." once per outage, not on every retry
let joinConnectTimeout = null;  // guest side: fires if a join attempt never opens a data channel

// WebRTC ICE server config for PeerJS. Without this, PeerJS falls back to a
// single public STUN server, which is often enough when both players are on
// the same simple network but frequently fails to punch through the NAT on
// mobile carrier networks / locked-down Wi-Fi - a STUN-only connection can
// still "open" at the signalling level while the actual peer-to-peer data
// channel never completes, which is why a join can look like it partially
// worked (menu closes) but no game data ever arrives. Adding TURN relay
// servers as a fallback fixes that. (Using Open Relay Project's free public
// TURN servers - fine for a hobby game, but they're a shared, unmetered
// public resource with no uptime guarantee.)
const PEER_ICE_CONFIG = {
    config: {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
            { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
            { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
        ]
    }
};

const CARD_DATABASE = {
    1: {
        1: { points: 0, gem: 'gold', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 2, gold: 1 } },
        2: { points: 0, gem: 'gold', leaves: false, cost: { emerald: 0, diamond: 1, sapphire: 1, ruby: 1, gold: 1 } },
        3: { points: 0, gem: 'gold', leaves: false, cost: { emerald: 1, diamond: 1, sapphire: 1, ruby: 2, gold: 0 } },
        4: { points: 0, gem: 'gold', leaves: true, cost: { emerald: 1, diamond: 0, sapphire: 2, ruby: 2, gold: 0 } },
        5: { points: 0, gem: 'gold', leaves: true, cost: { emerald: 0, diamond: 1, sapphire: 0, ruby: 3, gold: 1 } },
        6: { points: 0, gem: 'gold', leaves: false, cost: { emerald: 2, diamond: 0, sapphire: 0, ruby: 2, gold: 0 } },
        7: { points: 0, gem: 'emerald', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 3, ruby: 0, gold: 0 } },
        8: { points: 0, gem: 'gold', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 3, gold: 0 } },
        9: { points: 1, gem: 'gold', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 4, gold: 0 } },
        10: { points: 0, gem: 'emerald', leaves: false, cost: { emerald: 1, diamond: 1, sapphire: 1, ruby: 0, gold: 1 } },
        11: { points: 0, gem: 'emerald', leaves: false, cost: { emerald: 1, diamond: 1, sapphire: 2, ruby: 1, gold: 0 } },
        12: { points: 0, gem: 'emerald', leaves: true, cost: { emerald: 0, diamond: 1, sapphire: 3, ruby: 1, gold: 0 } },
        13: { points: 0, gem: 'emerald', leaves: true, cost: { emerald: 0, diamond: 2, sapphire: 2, ruby: 0, gold: 1 } },
        14: { points: 0, gem: 'emerald', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 2, ruby: 0, gold: 1 } },
        15: { points: 0, gem: 'emerald', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 2, ruby: 0, gold: 1 } },
        16: { points: 0, gem: 'diamond', leaves: true, cost: { emerald: 2, diamond: 1, sapphire: 0, ruby: 0, gold: 2 } },
        17: { points: 0, gem: 'sapphire', leaves: false, cost: { emerald: 1, diamond: 1, sapphire: 1, ruby: 1, gold: 0 } },
        18: { points: 1, gem: 'emerald', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 4, ruby: 0, gold: 0 } },
        19: { points: 0, gem: 'sapphire', leaves: false, cost: { emerald: 1, diamond: 1, sapphire: 1, ruby: 0, gold: 2 } },
        20: { points: 0, gem: 'ruby', leaves: false, cost: { emerald: 1, diamond: 1, sapphire: 0, ruby: 1, gold: 1 } },
        21: { points: 0, gem: 'sapphire', leaves: true, cost: { emerald: 1, diamond: 2, sapphire: 0, ruby: 2, gold: 0 } },
        22: { points: 0, gem: 'sapphire', leaves: false, cost: { emerald: 0, diamond: 2, sapphire: 1, ruby: 0, gold: 0 } },
        23: { points: 0, gem: 'sapphire', leaves: false, cost: { emerald: 0, diamond: 2, sapphire: 0, ruby: 0, gold: 2 } },
        24: { points: 1, gem: 'sapphire', leaves: false, cost: { emerald: 0, diamond: 4, sapphire: 0, ruby: 0, gold: 0 } },
        25: { points: 0, gem: 'sapphire', leaves: false, cost: { emerald: 0, diamond: 3, sapphire: 0, ruby: 0, gold: 0 } },
        26: { points: 0, gem: 'ruby', leaves: true, cost: { emerald: 3, diamond: 1, sapphire: 1, ruby: 0, gold: 0 } },
        27: { points: 0, gem: 'ruby', leaves: false, cost: { emerald: 2, diamond: 1, sapphire: 0, ruby: 1, gold: 1 } },
        28: { points: 0, gem: 'sapphire', leaves: true, cost: { emerald: 0, diamond: 3, sapphire: 0, ruby: 1, gold: 1 } },
        29: { points: 0, gem: 'ruby', leaves: true, cost: { emerald: 2, diamond: 0, sapphire: 0, ruby: 1, gold: 2 } },
        30: { points: 0, gem: 'ruby', leaves: false, cost: { emerald: 2, diamond: 0, sapphire: 0, ruby: 1, gold: 0 } },
        31: { points: 0, gem: 'ruby', leaves: false, cost: { emerald: 2, diamond: 0, sapphire: 2, ruby: 0, gold: 0 } },
        32: { points: 0, gem: 'ruby', leaves: false, cost: { emerald: 3, diamond: 0, sapphire: 0, ruby: 0, gold: 0 } },
        33: { points: 1, gem: 'ruby', leaves: false, cost: { emerald: 4, diamond: 0, sapphire: 0, ruby: 0, gold: 0 } },
        34: { points: 0, gem: 'diamond', leaves: false, cost: { emerald: 1, diamond: 1, sapphire: 1, ruby: 2, gold: 0 } },
        35: { points: 0, gem: 'diamond', leaves: false, cost: { emerald: 1, diamond: 1, sapphire: 1, ruby: 0, gold: 1 } },
        36: { points: 0, gem: 'diamond', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 3 } },
        37: { points: 0, gem: 'diamond', leaves: true, cost: { emerald: 1, diamond: 0, sapphire: 1, ruby: 0, gold: 3 } },
        38: { points: 0, gem: 'diamond', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 2, ruby: 0, gold: 2 } },
        39: { points: 0, gem: 'diamond', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 1, gold: 2 } },
        40: { points: 0, gem: 'diamond', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 4 } }
    },
    2: {
        1: { points: 2, gem: 'emerald', leaves: false, cost: { emerald: 2, diamond: 1, sapphire: 0, ruby: 4, gold: 0 } },
        2: { points: 2, gem: 'ruby', leaves: false, cost: { emerald: 0, diamond: 4, sapphire: 1, ruby: 0, gold: 2 } },
        3: { points: 1, gem: 'ruby', leaves: true, cost: { emerald: 0, diamond: 3, sapphire: 0, ruby: 2, gold: 2 } },
        4: { points: 1, gem: 'ruby', leaves: true, cost: { emerald: 2, diamond: 3, sapphire: 0, ruby: 3, gold: 0 } },
        5: { points: 1, gem: 'sapphire', leaves: true, cost: { emerald: 2, diamond: 0, sapphire: 2, ruby: 0, gold: 3 } },
        6: { points: 3, gem: 'diamond', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 6, ruby: 0, gold: 0 } },
        7: { points: 2, gem: 'diamond', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 5, ruby: 0, gold: 0 } },
        8: { points: 1, gem: 'sapphire', leaves: true, cost: { emerald: 0, diamond: 2, sapphire: 3, ruby: 0, gold: 3 } },
        9: { points: 2, gem: 'sapphire', leaves: false, cost: { emerald: 1, diamond: 2, sapphire: 0, ruby: 0, gold: 4 } },
        10: { points: 2, gem: 'diamond', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 5, ruby: 3, gold: 0 } },
        11: { points: 2, gem: 'sapphire', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 3, gold: 5 } },
        12: { points: 3, gem: 'sapphire', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 6 } },
        13: { points: 2, gem: 'sapphire', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 5 } },
        14: { points: 3, gem: 'ruby', leaves: false, cost: { emerald: 0, diamond: 6, sapphire: 0, ruby: 0, gold: 0 } },
        15: { points: 1, gem: 'emerald', leaves: true, cost: { emerald: 0, diamond: 0, sapphire: 2, ruby: 3, gold: 3 } },
        16: { points: 1, gem: 'emerald', leaves: true, cost: { emerald: 2, diamond: 0, sapphire: 2, ruby: 3, gold: 0 } },
        17: { points: 2, gem: 'emerald', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 3, ruby: 5, gold: 0 } },
        18: { points: 2, gem: 'emerald', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 5, gold: 0 } },
        19: { points: 3, gem: 'emerald', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 6, gold: 0 } },
        20: { points: 2, gem: 'gold', leaves: false, cost: { emerald: 4, diamond: 2, sapphire: 0, ruby: 1, gold: 0 } },
        21: { points: 1, gem: 'gold', leaves: true, cost: { emerald: 3, diamond: 2, sapphire: 2, ruby: 0, gold: 0 } },
        22: { points: 1, gem: 'gold', leaves: true, cost: { emerald: 3, diamond: 2, sapphire: 0, ruby: 0, gold: 3 } },
        23: { points: 2, gem: 'gold', leaves: false, cost: { emerald: 5, diamond: 0, sapphire: 0, ruby: 0, gold: 3 } },
        24: { points: 2, gem: 'gold', leaves: false, cost: { emerald: 5, diamond: 0, sapphire: 0, ruby: 0, gold: 0 } },
        25: { points: 3, gem: 'gold', leaves: false, cost: { emerald: 6, diamond: 0, sapphire: 0, ruby: 0, gold: 0 } },
        26: { points: 1, gem: 'diamond', leaves: true, cost: { emerald: 2, diamond: 2, sapphire: 3, ruby: 0, gold: 0 } },
        27: { points: 1, gem: 'diamond', leaves: true, cost: { emerald: 0, diamond: 0, sapphire: 3, ruby: 3, gold: 2 } },
        28: { points: 2, gem: 'ruby', leaves: false, cost: { emerald: 3, diamond: 5, sapphire: 0, ruby: 0, gold: 0 } },
        29: { points: 2, gem: 'ruby', leaves: false, cost: { emerald: 0, diamond: 5, sapphire: 0, ruby: 0, gold: 0 } },
        30: { points: 2, gem: 'diamond', leaves: false, cost: { emerald: 1, diamond: 2, sapphire: 4, ruby: 0, gold: 0 } }
    },
    3: {
        1: { points: 5, gem: 'sapphire', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 7, gold: 3 } },
        2: { points: 4, gem: 'sapphire', leaves: true, cost: { emerald: 6, diamond: 3, sapphire: 3, ruby: 0, gold: 0 } },
        3: { points: 4, gem: 'ruby', leaves: false, cost: { emerald: 3, diamond: 0, sapphire: 6, ruby: 3, gold: 0 } },
        4: { points: 5, gem: 'ruby', leaves: false, cost: { emerald: 0, diamond: 3, sapphire: 7, ruby: 0, gold: 0 } },
        5: { points: 4, gem: 'ruby', leaves: true, cost: { emerald: 0, diamond: 0, sapphire: 7, ruby: 0, gold: 0 } },
        6: { points: 3, gem: 'diamond', leaves: 2, cost: { emerald: 0, diamond: 3, sapphire: 3, ruby: 5, gold: 3 } },
        7: { points: 4, gem: 'diamond', leaves: true, cost: { emerald: 3, diamond: 0, sapphire: 0, ruby: 6, gold: 3 } },
        8: { points: 5, gem: 'diamond', leaves: false, cost: { emerald: 3, diamond: 0, sapphire: 0, ruby: 7, gold: 0 } },
        9: { points: 4, gem: 'diamond', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 7, gold: 0 } },
        10: { points: 3, gem: 'gold', leaves: 2, cost: { emerald: 3, diamond: 5, sapphire: 0, ruby: 3, gold: 3 } },
        11: { points: 4, gem: 'gold', leaves: true, cost: { emerald: 0, diamond: 6, sapphire: 0, ruby: 3, gold: 3 } },
        12: { points: 5, gem: 'gold', leaves: false, cost: { emerald: 0, diamond: 7, sapphire: 3, ruby: 0, gold: 0 } },
        13: { points: 4, gem: 'gold', leaves: false, cost: { emerald: 0, diamond: 7, sapphire: 0, ruby: 0, gold: 0 } },
        14: { points: 3, gem: 'emerald', leaves: 2, cost: { emerald: 3, diamond: 3, sapphire: 3, ruby: 0, gold: 5 } },
        15: { points: 4, gem: 'emerald', leaves: true, cost: { emerald: 3, diamond: 0, sapphire: 3, ruby: 0, gold: 6 } },
        16: { points: 5, gem: 'emerald', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 3, gold: 7 } },
        17: { points: 5, gem: 'emerald', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 7 } },
        18: { points: 3, gem: 'sapphire', leaves: 2, cost: { emerald: 5, diamond: 3, sapphire: 3, ruby: 3, gold: 0 } },
        19: { points: 5, gem: 'sapphire', leaves: false, cost: { emerald: 7, diamond: 0, sapphire: 0, ruby: 0, gold: 0 } },
        20: { points: 3, gem: 'ruby', leaves: 2, cost: { emerald: 0, diamond: 3, sapphire: 5, ruby: 3, gold: 3 } }
    }
};

function getCardByTierAndNumber(tier, randNum) {
    if (!CARD_DATABASE[tier] || !CARD_DATABASE[tier][randNum]) {
        console.error(`No card data for tier ${tier}, number ${randNum}.`);
        return null;
    }
    const data = CARD_DATABASE[tier][randNum];
    let leafCount = typeof data.leaves === 'number' ? data.leaves : (data.leaves ? 1 : 0);
    return {
        id: tier * 1000 + randNum,
        points: data.points,
        gem: data.gem,
        leaves: leafCount,
        cost: data.cost,
        image: `Level ${tier} Cards/${randNum}.jpg`
    };
}

function createDeck(tier) {
    let deck = [];
    let maxCards = tier === 1 ? 40 : (tier === 2 ? 30 : 20);
    for (let i = 1; i <= maxCards; i++) {
        deck.push(getCardByTierAndNumber(tier, i));
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

const gameState = {
    turnNumber: 1,
    actionTakenThisTurn: false,
    turnGemsPicked: [],
    ringActive: false,
    ringActivatorId: null,
    gameEnded: false, 
    bank: { emerald: 4, diamond: 4, sapphire: 4, ruby: 4, gold: 4 },
    decks: { 1: createDeck(1), 2: createDeck(2), 3: createDeck(3) },
    marketTier1: [],
    marketTier2: [],
    marketTier3: [],
    destinationsPool: [
        { id: 901, points: 3, requirements: { emerald: 0, diamond: 3, sapphire: 0, ruby: 3, gold: 3 }, image: 'Destinations/1.jpg' },
        { id: 902, points: 3, requirements: { emerald: 0, diamond: 3, sapphire: 3, ruby: 3, gold: 0 }, image: 'Destinations/2.jpg' },
        { id: 903, points: 3, requirements: { emerald: 3, diamond: 0, sapphire: 0, ruby: 3, gold: 3 }, image: 'Destinations/3.jpg' },
        { id: 904, points: 3, requirements: { emerald: 3, diamond: 0, sapphire: 3, ruby: 0, gold: 3 }, image: 'Destinations/4.jpg' },
        { id: 905, points: 3, requirements: { emerald: 0, diamond: 4, sapphire: 0, ruby: 4, gold: 0 }, image: 'Destinations/5.jpg' },
        { id: 906, points: 3, requirements: { emerald: 0, diamond: 4, sapphire: 0, ruby: 0, gold: 4 }, image: 'Destinations/6.jpg' },
        { id: 907, points: 3, requirements: { emerald: 0, diamond: 0, sapphire: 4, ruby: 4, gold: 0 }, image: 'Destinations/7.jpg' },
        { id: 908, points: 3, requirements: { emerald: 0, diamond: 0, sapphire: 4, ruby: 0, gold: 4 }, image: 'Destinations/8.jpg' },
        { id: 909, points: 3, requirements: { emerald: 4, diamond: 0, sapphire: 4, ruby: 0, gold: 0 }, image: 'Destinations/9.jpg' },
        { id: 910, points: 3, requirements: { emerald: 0, diamond: 4, sapphire: 4, ruby: 0, gold: 0 }, image: 'Destinations/10.jpg' },
        { id: 911, points: 3, requirements: { emerald: 4, diamond: 0, sapphire: 0, ruby: 0, gold: 4 }, image: 'Destinations/11.jpg' },
        { id: 912, points: 3, requirements: { emerald: 4, diamond: 0, sapphire: 0, ruby: 4, gold: 0 }, image: 'Destinations/12.jpg' }
    ],
    activeDestinations: []
};

gameState.marketTier1 = [gameState.decks[1].pop(), gameState.decks[1].pop(), gameState.decks[1].pop(), gameState.decks[1].pop()];
gameState.marketTier2 = [gameState.decks[2].pop(), gameState.decks[2].pop(), gameState.decks[2].pop(), gameState.decks[2].pop()];
gameState.marketTier3 = [gameState.decks[3].pop(), gameState.decks[3].pop(), gameState.decks[3].pop(), gameState.decks[3].pop()];

let preloadScheduled = false; // so we only ever kick off the background art preload once per game
let preloadPauseUntil = 0;    // timestamp (ms) until which the background preloader should idle

// Called right before any player action that's about to reveal a new card,
// noble, etc. on screen. The background preloader can otherwise still be
// working through the deck backlog from earlier in the game and, without
// this, keeps competing for bandwidth/connections against the one image
// that actually needs to appear right now - which is what was showing up
// as a card taking many seconds to pop in mid/late game. Pausing it for a
// couple of seconds around every action gives real, on-screen fetches a
// clear run every time, and the backlog just resumes once things go quiet.
function deprioritizeBackgroundPreload() {
    preloadPauseUntil = Date.now() + 2000;
}

function preloadGameImages() {

    const tierQueues = [1, 2, 3].map(tier => [...gameState.decks[tier]].reverse());
    const urls = [];
    let anyLeft = true;
    while (anyLeft) {
        anyLeft = false;
        for (const queue of tierQueues) {
            if (queue.length) {
                urls.push(queue.shift().image);
                anyLeft = true;
            }
        }
    }

    gameState.destinationsPool.forEach(d => urls.push(d.image));

    // Kept low - this is a background fetch for cards you haven't drawn yet.
    // Too high a number here competes with the board's own images for the
    // browser's limited concurrent-connection pool and can noticeably slow
    // down what you're actually looking at right now.
    const CONCURRENCY = 2;
    let nextIndex = 0;

    function loadNext() {
        if (nextIndex >= urls.length) return;

        // Back off while something on the actual board just needed to load -
        // check again shortly rather than immediately grabbing the next slot.
        const waitMs = preloadPauseUntil - Date.now();
        if (waitMs > 0) {
            setTimeout(loadNext, waitMs);
            return;
        }

        const url = urls[nextIndex++];
        const img = new Image();
        if ('fetchPriority' in img) img.fetchPriority = 'low';
        img.onload = loadNext;
        img.onerror = loadNext;
        img.src = url;
    }

    for (let i = 0; i < CONCURRENCY; i++) loadNext();
}

// Give the board's own visible images (market, nobles, tokens, draw piles) a
// clear head start before this background preload starts competing for
// bandwidth/connections. Call this once the current game's board is on
// screen, not blindly on page load - starting it that early was racing the
// very images you need to see right away, which is why they could take a
// long time to appear even on a fast desktop connection.
function scheduleImagePreload() {
    if (preloadScheduled) return;
    preloadScheduled = true;
    const start = () => setTimeout(preloadGameImages, 1500);
    if ('requestIdleCallback' in window) {
        requestIdleCallback(start, { timeout: 4000 });
    } else {
        start();
    }
}

function drawCardFromDeck(tierNumber) {
    const deck = gameState.decks[tierNumber];
    if (!deck || deck.length === 0) return null;
    return deck.pop();
}

// Starting token supply per color, scaled by player count (2p: 4, 3p: 5, 4p: 7).
function getStartingChipCount(playerCount) {
    if (playerCount <= 2) return 4;
    if (playerCount === 3) return 5;
    return 7;
}

// Number of Destination cards in play - 2 players only draw 2, everyone else draws 3.
function getDestinationCount(playerCount) {
    return playerCount <= 2 ? 2 : 3;
}

function initGame(selectedPlayerCount, customNames = [], startingPlayerIndex = 0) {
    numPlayers = selectedPlayerCount;
    activePlayerIndex = startingPlayerIndex;
    lastAnnouncedTurnKey = null; // fresh game - allow the opening turn to be announced again
    lorienHolderId = null;
    players = [];
    gameState.ringActive = false;
    gameState.ringActivatorId = null;
    gameState.gameEnded = false;
    gameState.turnNumber = 1;
    gameState.actionTakenThisTurn = false;
    gameState.turnGemsPicked = [];

    gameState.decks = { 1: createDeck(1), 2: createDeck(2), 3: createDeck(3) };
    gameState.marketTier1 = [gameState.decks[1].pop(), gameState.decks[1].pop(), gameState.decks[1].pop(), gameState.decks[1].pop()];
    gameState.marketTier2 = [gameState.decks[2].pop(), gameState.decks[2].pop(), gameState.decks[2].pop(), gameState.decks[2].pop()];
    gameState.marketTier3 = [gameState.decks[3].pop(), gameState.decks[3].pop(), gameState.decks[3].pop(), gameState.decks[3].pop()];

    const chipCount = getStartingChipCount(numPlayers);
    gameState.bank = { emerald: chipCount, diamond: chipCount, sapphire: chipCount, ruby: chipCount, gold: chipCount };

    for (let i = 1; i <= numPlayers; i++) {
        let defaultName = `Player ${i}`;
        let pName = customNames[i - 1] || (i === 1 ? localPlayerName : defaultName);
        players.push({
            id: i,
            playerName: pName,
            victoryPoints: 0,
            leaves: 0,
            hasReceivedOnyxToken: false,
            gems: { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 0, onyx: 0, joker: 0 },
            bonuses: { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 0 },
            purchasedCards: [],
            reservedCards: []
        });
    }

    gameState.activeDestinations = [...gameState.destinationsPool].sort(() => Math.random() - 0.5).slice(0, getDestinationCount(numPlayers));
    announceTurnChange();
    updateUI();
    renderAllMarkets();
    renderNobles();
    scheduleImagePreload();
}

function getCurrentPlayer() {
    return players[activePlayerIndex];
}

function renderAllMarkets() {
    renderMarket('tier-1-market', gameState.marketTier1, 1);
    renderMarket('tier-2-market', gameState.marketTier2, 2);
    renderMarket('tier-3-market', gameState.marketTier3, 3);
    renderReservedCards();
    syncReservedCardSize();
}

function syncReservedCardSize() {
    const sampleCard = document.querySelector('#market-panel .card:not([style*="hidden"])');
    const reservedContainer = document.getElementById('reserved-cards-container');
    if (!sampleCard || !reservedContainer) return;
    const width = sampleCard.getBoundingClientRect().width;
    if (width > 0) {
        reservedContainer.style.setProperty('--market-card-w', width + 'px');
    }
}

if (typeof ResizeObserver !== 'undefined') {
    const marketPanelResizeObserver = new ResizeObserver(() => syncReservedCardSize());
    document.addEventListener('DOMContentLoaded', () => {
        const marketPanel = document.getElementById('market-panel');
        if (marketPanel) marketPanelResizeObserver.observe(marketPanel);
    });
} else {
    window.addEventListener('resize', syncReservedCardSize);
}

function renderMarket(elementId, marketArray, tierNumber) {
    const marketContainer = document.getElementById(elementId);
    const existingDivs = Array.from(marketContainer.children);

    marketArray.forEach((card, index) => {
        let cardDiv = existingDivs[index];
        if (!cardDiv) {
            cardDiv = document.createElement('div');
            cardDiv.className = 'card';
            marketContainer.appendChild(cardDiv);
        }

        const cardKey = card ? String(card.id) : '';
        if (cardDiv.dataset.cardId !== cardKey) {
            cardDiv.dataset.cardId = cardKey;
            if (card) {
                deprioritizeBackgroundPreload();
                cardDiv.style.visibility = 'visible';
                cardDiv.innerHTML = `<img src="${card.image}" alt="Card" class="card-img" fetchpriority="high" decoding="async" onload="this.classList.add('loaded')">`;
            } else {
                cardDiv.innerHTML = '';
                cardDiv.style.visibility = 'hidden';
            }
        }

        cardDiv.onclick = card ? () => buyCard(tierNumber, index) : null;
    });

    for (let i = marketArray.length; i < existingDivs.length; i++) {
        existingDivs[i].remove();
    }
}

function renderNobles() {
    const container = document.getElementById('nobles-container');
    container.innerHTML = '';
    gameState.activeDestinations.forEach(noble => {
        const nobleDiv = document.createElement('div');
        nobleDiv.className = 'noble-card';
        if (noble) {
            nobleDiv.innerHTML = `<img src="${noble.image}" alt="Destination Card" class="destination-img" fetchpriority="high" decoding="async" onload="this.classList.add('loaded')">`;
        } else {
            nobleDiv.style.visibility = 'hidden';
        }
        container.appendChild(nobleDiv);
    });
}

function renderReservedCards() {
    const container = document.getElementById('reserved-cards-container');
    container.innerHTML = '';
    const player = getMyPlayer();

    if (player.reservedCards.length === 0) {
        container.innerHTML = '<span style="font-size: 10px; color: #bdc3c7;">None</span>';
        return;
    }

    player.reservedCards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        deprioritizeBackgroundPreload();
        cardDiv.innerHTML = `<img src="${card.image}" alt="Card" class="card-img" fetchpriority="high" decoding="async" onload="this.classList.add('loaded')">`;
        cardDiv.onclick = () => buyReservedCard(index);
        container.appendChild(cardDiv);
    });
}

function renderAllPlayersStatus() {
    const container = document.getElementById('all-players-status-container');
    if (!container) return;
    container.innerHTML = '';

    players.forEach((p, idx) => {
        const isCurrent = idx === activePlayerIndex;
        const playerDiv = document.createElement('div');
        playerDiv.style.padding = '4px 6px';
        playerDiv.style.marginBottom = '3px';
        playerDiv.style.borderRadius = '3px';
        playerDiv.style.background = isCurrent ? 'rgba(26, 188, 156, 0.2)' : 'rgba(0,0,0,0.15)';
        playerDiv.style.border = isCurrent ? '1px solid #c5a059' : '1px solid transparent';

        let totalTokens = Object.values(p.gems).reduce((a, b) => a + b, 0);

        const makeTokenSpan = (file, count, gemKey) => `
            <span class="clickable-token" data-gem="${gemKey}" style="display:inline-flex; align-items:center; margin-right:0.35em; ${isCurrent && isMyTurn() ? 'cursor:pointer; text-decoration:underline;' : ''}" title="${isCurrent && isMyTurn() ? 'Click to return 1 ' + gemKey : ''}">
                <img src="tokens/${file}.png" style="vertical-align:middle; margin-right:0.15em; pointer-events:none;" /><span class="stat-num">${count}</span>
            </span>`;
        
        let tokensHtml = `
            ${makeTokenSpan('emerald', p.gems.emerald, 'emerald')}
            ${makeTokenSpan('diamond', p.gems.diamond, 'diamond')}
            ${makeTokenSpan('sapphire', p.gems.sapphire, 'sapphire')}
            ${makeTokenSpan('ruby', p.gems.ruby, 'ruby')}
            ${makeTokenSpan('gold', p.gems.gold, 'gold')}
            ${makeTokenSpan('onyx', p.gems.onyx, 'onyx')}
            ${makeTokenSpan('joker', p.gems.joker, 'joker')}
        `;

        const tokenIconStatic = (file, count) => `<span style="display:inline-flex; align-items:center; margin-right:0.35em;"><img src="tokens/${file}.png" style="vertical-align:middle; margin-right:0.15em;" /><span class="stat-num">${count}</span></span>`;
        let bonusesHtml = `
            ${tokenIconStatic('emerald', p.bonuses.emerald)}
            ${tokenIconStatic('diamond', p.bonuses.diamond)}
            ${tokenIconStatic('sapphire', p.bonuses.sapphire)}
            ${tokenIconStatic('ruby', p.bonuses.ruby)}
            ${tokenIconStatic('gold', p.bonuses.gold)}
        `;

        let leafHtml = `<span class="stat-num">${p.leaves}</span>`;

       playerDiv.innerHTML = `
            <div style="font-weight: 600; color: ${isCurrent ? '#c5a059' : '#ecf0f1'}; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(p.playerName)}">
                ${escapeHtml(p.playerName)} ${isCurrent ? '⭐' : ''} — VP: <span class="stat-num">${p.victoryPoints}</span> | Tokens: <span class="stat-num">${totalTokens}</span>/<span class="stat-num">10</span>
            </div>
            <div style="color: #bdc3c7; margin-top: 1px; display:flex; flex-wrap:nowrap; align-items:center; gap:0.15em;">
                <span style="flex-shrink:0;">Tokens:</span> ${tokensHtml}
            </div>
            <div style="color: #bdc3c7; margin-top: 2px; display:flex; flex-wrap:nowrap; align-items:center; gap:0.15em;">
                <span style="flex-shrink:0;">Discounts:</span> ${bonusesHtml}
            </div>
            <div style="color: #bdc3c7; margin-top: 2px; display:flex; flex-wrap:nowrap; align-items:center; gap:0.15em;">
                <span style="flex-shrink:0;">Lorien Leaf:</span> ${leafHtml} ${p.id === lorienHolderId ? '<span style="color: #f1c40f; font-weight:bold;">(👑 Leaf Holder)</span>' : ''}
            </div>
        `;

        // Direct click-to-return individual token logic without alert prompts
        if (isCurrent && isMyTurn()) {
            playerDiv.querySelectorAll('.clickable-token').forEach(tokenSpan => {
                let color = tokenSpan.getAttribute('data-gem');
                tokenSpan.onclick = (e) => {
                    e.stopPropagation();
                    let currentTotal = getTotalPlayerTokens(p);
                    if (currentTotal <= 10) {
                        return; // Ignore if user is under 10 limit
                    }
                    if (p.gems[color] > 0) {
                        p.gems[color]--;
                        if (gameState.bank[color] !== undefined) {
                            gameState.bank[color]++;
                        }
                        syncAndRefresh();
                    }
                };
            });
        }

        container.appendChild(playerDiv);
    });
}

function renderPurchasedCardStacks() {
    const player = getMyPlayer();
    const container = document.getElementById('purchased-stacks-container');
    document.getElementById('purchased-header').innerHTML = `Purchased Cards Inventory (${wrapNumbers(escapeHtml(player.playerName))})`;
    container.innerHTML = '';

    if (player.purchasedCards.length === 0) {
        container.innerHTML = '<span style="font-size: 11px; color: #bdc3c7;">None</span>';
        return;
    }

    const groups = { emerald: [], diamond: [], sapphire: [], ruby: [], gold: [] };
    player.purchasedCards.forEach(card => {
        if (groups[card.gem]) groups[card.gem].push(card);
    });

    for (let gemType in groups) {
        const cardsInGroup = groups[gemType];
        if (cardsInGroup.length === 0) continue;

        const stackCol = document.createElement('div');
        stackCol.className = 'card-stack-column';
        stackCol.style.setProperty('--stack-count', cardsInGroup.length);

        cardsInGroup.forEach((card, idx) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'staggered-card';
            cardDiv.style.left = `${idx * 28}px`;
            cardDiv.style.zIndex = idx + 1;
            cardDiv.innerHTML = `<img src="${card.image}" alt="Card" style="width:100%; height:100%; object-fit:contain;">`;
            stackCol.appendChild(cardDiv);
        });
        container.appendChild(stackCol);
    }
}

function getTotalPlayerTokens(player) {
    return Object.values(player.gems).reduce((a, b) => a + b, 0);
}

function isMyTurn() {
    if (!isMultiplayerMode) return true;
    return getCurrentPlayer().id === myPlayerId;
}

function notifyNotYourTurn() {
    notify("It's not your turn yet — please wait for your turn.", "Not Your Turn", "warning");
}

function drawCard(tierNumber) {
    if (gameState.gameEnded) {
        notify("The game has already ended.", "Game Over", "info");
        return;
    }
    if (!isMyTurn()) {
        notifyNotYourTurn();
        return;
    }
    if (gameState.actionTakenThisTurn) {
        notify("You already performed an action this turn!", "Hold On", "warning");
        return;
    }
    const player = getCurrentPlayer();
    if (player.reservedCards.length >= 3) {
        notify("Maximum 3 reserved cards allowed!", "Reserve Limit Reached", "warning");
        return;
    }
    let drawnCard = drawCardFromDeck(tierNumber);
    if (!drawnCard) {
        notify("This draw pile is empty!", "Empty Pile", "warning");
        return;
    }
    player.reservedCards.push(drawnCard);
    player.gems.joker++;

    gameState.actionTakenThisTurn = true;
    syncAndRefresh();
}

function takeGemToken(gemType) {
    if (gameState.gameEnded) {
        notify("The game has already ended.", "Game Over", "info");
        return;
    }
    if (!isMyTurn()) {
        notifyNotYourTurn();
        return;
    }
    const player = getCurrentPlayer();
    if (gameState.actionTakenThisTurn && gameState.turnGemsPicked.length === 0) {
        notify("You already performed a different action this turn!", "Hold On", "warning");
        return;
    }
    if (gameState.bank[gemType] <= 0) {
        notify("That gem stack is empty!", "Empty Stack", "warning");
        return;
    }

    const currentPicks = gameState.turnGemsPicked;
    if (currentPicks.length === 2 && currentPicks[0] === currentPicks[1]) {
        notify("You already took 2 tokens of the same color!", "Token Limit", "warning");
        return;
    }
    if (currentPicks.length >= 3) {
        notify("You can only take up to 3 tokens per turn!", "Token Limit", "warning");
        return;
    }
    if (currentPicks.length === 1) {
        if (currentPicks[0] === gemType && gameState.bank[gemType] < 1) {
            notify("Not enough tokens left to take a pair!", "Not Enough Tokens", "warning");
            return;
        }
        if (currentPicks[0] !== gemType && currentPicks.includes(gemType)) {
            notify("Cannot pick the same color twice when taking different chips!", "Invalid Pick", "warning");
            return;
        }
    }
    if (currentPicks.length === 2 && currentPicks.includes(gemType)) {
        notify("Cannot pick a duplicate color when taking 3 different chips!", "Invalid Pick", "warning");
        return;
    }

    gameState.bank[gemType]--;
    player.gems[gemType]++;
    gameState.turnGemsPicked.push(gemType);
    gameState.actionTakenThisTurn = true;
    
    syncAndRefresh();
}

function buyCard(tierNumber, index) {
    if (gameState.gameEnded) {
        notify("The game has already ended.", "Game Over", "info");
        return;
    }
    if (!isMyTurn()) {
        notifyNotYourTurn();
        return;
    }
    if (gameState.actionTakenThisTurn) {
        notify("You already performed an action this turn!", "Hold On", "warning");
        return;
    }
    let marketArray = tierNumber === 1 ? gameState.marketTier1 : (tierNumber === 2 ? gameState.marketTier2 : gameState.marketTier3);
    const card = marketArray[index];
    if (!card) return;

    processCardPurchase(card, tierNumber, () => {
        const nextCard = drawCardFromDeck(tierNumber);
        marketArray.splice(index, 1, nextCard || null);
    });
}

function buyReservedCard(reservedIndex) {
    if (gameState.gameEnded) {
        notify("The game has already ended.", "Game Over", "info");
        return;
    }
    if (!isMyTurn()) {
        notifyNotYourTurn();
        return;
    }
    if (gameState.actionTakenThisTurn) {
        notify("You already performed an action this turn!", "Hold On", "warning");
        return;
    }
    const player = getCurrentPlayer();
    const card = player.reservedCards[reservedIndex];
    let tierNumber = card.id >= 3000 ? 3 : (card.id >= 2000 ? 2 : 1);

    processCardPurchase(card, tierNumber, () => {
        player.reservedCards.splice(reservedIndex, 1);
    });
}

function processCardPurchase(card, tierNumber, removeCardCallback) {
    const player = getCurrentPlayer();
    let deficitTotal = 0;
    let tempPlayerGems = { ...player.gems };

    for (let gem in card.cost) {
        let required = card.cost[gem];
        let discount = player.bonuses[gem];
        let netCost = Math.max(0, required - discount);
        if (tempPlayerGems[gem] >= netCost) {
            tempPlayerGems[gem] -= netCost;
        } else {
            deficitTotal += (netCost - tempPlayerGems[gem]);
            tempPlayerGems[gem] = 0;
        }
    }

    if (tempPlayerGems.joker < deficitTotal) {
        notify("Not enough gems/jokers to buy this card!", "Can't Afford That", "warning");
        return;
    }

    for (let gem in card.cost) {
        let required = card.cost[gem];
        let discount = player.bonuses[gem];
        let netCost = Math.max(0, required - discount);
        let paidFromGem = Math.min(player.gems[gem], netCost);
        player.gems[gem] -= paidFromGem;
        gameState.bank[gem] += paidFromGem;
        let remainingDeficit = netCost - paidFromGem;
        if (remainingDeficit > 0) player.gems.joker -= remainingDeficit;
    }

    player.victoryPoints += card.points;
    player.bonuses[card.gem]++;
    player.purchasedCards.push(card);

    if (tierNumber === 3 && !player.hasReceivedOnyxToken) {
        player.hasReceivedOnyxToken = true;
        player.gems.onyx++;
        notify(`${player.playerName} purchased their first Tier 3 card and received 1 Onyx Token!`, "Bonus Reward", "success");
    }

    if (card.leaves > 0) {
        player.leaves += card.leaves;
        checkLorienLeaf(player);
    }
    
    removeCardCallback();
    checkNobles(player);
    gameState.actionTakenThisTurn = true;
    syncAndRefresh();
}

function meetsRingRequirements(player) {
    const hasEnoughPoints = player.victoryPoints >= 16;
    const hasOnyx = player.gems.onyx >= 1;
    const hasOtherColors = ['emerald', 'diamond', 'sapphire', 'ruby', 'gold']
        .every(g => (player.gems[g] + player.bonuses[g]) >= 1);
    return hasEnoughPoints && hasOnyx && hasOtherColors;
}

function tryClaimRing() {
    if (gameState.gameEnded) {
        notify("The game has already ended.", "Game Over", "info");
        return;
    }
    if (!isMyTurn()) {
        notifyNotYourTurn();
        return;
    }

    const player = getCurrentPlayer();

    if (gameState.ringActive) {
        const activator = players.find(p => p.id === gameState.ringActivatorId);
        notify(`The Ring was already claimed by ${activator ? activator.playerName : 'another player'} — the final round is underway.`, "Final Round In Progress", "info");
        return;
    }

    if (!meetsRingRequirements(player)) {
        notify(`Requirements:\n- Minimum 16 Victory Points (You have ${player.victoryPoints})\n- At least 1 Onyx token\n- At least 1 of each other color (Emerald, Diamond, Sapphire, Ruby, Gold) — from tokens or discounts`, "Cannot Claim The Ring Yet", "warning");
        return;
    }

    gameState.ringActive = true;
    gameState.ringActivatorId = player.id;
    updateRingArtState();

    announceToAll(`${player.playerName} has claimed The Ring! A final round begins — play continues until it comes back around to ${player.playerName}'s turn. Whoever has the most Victory Points when the final round ends wins (ties broken by whoever holds the most Lorien Leaves)!`, "🔥 The Ring Has Been Claimed!", "success");

    gameState.actionTakenThisTurn = true;
    syncAndRefresh();
}

function checkRingActivatorStillEligible() {
    if (!gameState.ringActive || gameState.gameEnded) return;
    const activator = players.find(p => p.id === gameState.ringActivatorId);
    if (!activator || !meetsRingRequirements(activator)) {
        notify(`${activator ? activator.playerName : 'The Ring holder'} no longer meets The Ring's requirements. The final round has been cancelled — the game continues until someone claims The Ring again.`, "Final Round Cancelled", "warning");
        gameState.ringActive = false;
        gameState.ringActivatorId = null;
        updateRingArtState();
    }
}

// Formats a list of names as "A", "A and B", or "A, B and C".
function formatNameList(names) {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function declareGameWinner() {
    const maxPoints = Math.max(...players.map(p => p.victoryPoints));
    let winners = players.filter(p => p.victoryPoints === maxPoints);
    let tieNote = '';

    if (winners.length > 1) {
        const maxLeaves = Math.max(...winners.map(p => p.leaves));
        const leafWinners = winners.filter(p => p.leaves === maxLeaves);

        if (leafWinners.length === 1) {
            winners = leafWinners;
            tieNote = ' after a tiebreaker on Lorien Leaf count';
        } else {
            winners = leafWinners;
            tieNote = ' — also tied on Lorien Leaf count, so the win is shared';
        }
    }

    gameState.ringActive = false;
    gameState.gameEnded = true;
    updateRingArtState();

    const names = formatNameList(winners.map(p => p.playerName));
    const verb = winners.length > 1 ? 'win' : 'wins';
    const pointsLabel = winners.length > 1 ? `${maxPoints} Victory Points each` : `${maxPoints} Victory Points`;

    announceToAll(`The final round is complete! ${names} ${verb} the game with ${pointsLabel}${tieNote}!`, "🏆 Game Over!", "success");
}

function updateRingArtState() {
    const ringContainer = document.getElementById('ring-card-container');
    if (!ringContainer) return;
    if (gameState.ringActive || gameState.gameEnded) {
        ringContainer.classList.add('ring-final-round');
    } else {
        ringContainer.classList.remove('ring-final-round');
    }
}

function checkLorienLeaf(activePlayer) {
    if (activePlayer.leaves < 3) {
        if (lorienHolderId !== null && players.find(p => p.id === lorienHolderId).leaves < 3) {
            let currentHolder = players.find(p => p.id === lorienHolderId);
            if (currentHolder) currentHolder.victoryPoints -= 3;
            lorienHolderId = null;
        }
        return;
    }

    let eligiblePlayers = players.filter(p => p.leaves >= 3);
    if (eligiblePlayers.length === 0) return;

    let maxLeaves = Math.max(...eligiblePlayers.map(p => p.leaves));
    let topPlayers = eligiblePlayers.filter(p => p.leaves === maxLeaves);

    if (topPlayers.length > 1) {
        if (lorienHolderId !== null) {
            let currentHolder = players.find(p => p.id === lorienHolderId);
            if (currentHolder) currentHolder.victoryPoints -= 3;
            lorienHolderId = null;
        }
        return;
    }

    let newLeader = topPlayers[0];

    if (lorienHolderId === null) {
        lorienHolderId = newLeader.id;
        newLeader.victoryPoints += 3;
        announceToAll(`${newLeader.playerName} reached the most leaves (or broke the tie), claimed the Lorien Leaf, and gained 3 Victory Points!`, "Lorien Leaf Claimed", "success");
    } else if (lorienHolderId !== newLeader.id) {
        let currentHolder = players.find(p => p.id === lorienHolderId);
        if (currentHolder) currentHolder.victoryPoints -= 3;
        
        lorienHolderId = newLeader.id;
        newLeader.victoryPoints += 3;
        announceToAll(`${newLeader.playerName} took control of the Lorien Leaf and its 3 Victory Points!`, "Lorien Leaf Claimed", "success");
    }
}

function updateLorienArtVisibility() {
    const panel = document.getElementById('lorien-panel');
    if (!panel) return;
    panel.style.display = lorienHolderId === null ? 'flex' : 'none';
}

function checkNobles(player) {
    for (let i = gameState.activeDestinations.length - 1; i >= 0; i--) {
        const noble = gameState.activeDestinations[i];
        if (!noble) continue;
        let qualifies = Object.keys(noble.requirements).every(gem => player.bonuses[gem] >= noble.requirements[gem]);
        if (qualifies) {
            player.victoryPoints += noble.points;
            gameState.activeDestinations[i] = null;
            announceToAll(`${player.playerName} automatically met requirements for a Destination card, gained 3 Victory Points, and claimed it!`, "Destination Reached", "success");
            renderNobles();
            break;
        }
    }
}

async function endTurn() {
    if (gameState.gameEnded) {
        notify("The game has already ended.", "Game Over", "info");
        return;
    }
    if (!isMyTurn()) {
        notifyNotYourTurn();
        return;
    }

    const player = getCurrentPlayer();
    if (!gameState.actionTakenThisTurn) {
        const confirmed = await showModal({ title: "No Action Taken", message: "No action taken this turn. Pass anyway?", type: "confirm", variant: "warning" });
        if (!confirmed) return;
    }

    if (getTotalPlayerTokens(player) > 10) {
        notify("You have more than 10 total tokens! Return some by clicking your excess tokens before ending your turn.", "Too Many Tokens", "warning");
        return;
    }

    activePlayerIndex = (activePlayerIndex + 1) % numPlayers;
    if (activePlayerIndex === 0) gameState.turnNumber++;
    announceTurnChange();

    gameState.actionTakenThisTurn = false;
    gameState.turnGemsPicked = [];
    
    players.forEach(p => checkNobles(p));
    checkRingActivatorStillEligible();

    if (gameState.ringActive && getCurrentPlayer().id === gameState.ringActivatorId) {
        declareGameWinner();
    }

    syncAndRefresh();
}

function updateUI() {
    const player = getCurrentPlayer();
    for (let gem in gameState.bank) {
        document.getElementById(`bank-${gem}`).innerText = gameState.bank[gem];
        const bankItemElem = document.querySelector(`.bank-token-item img[alt="${gem.charAt(0).toUpperCase() + gem.slice(1)}"]`);
        if (bankItemElem) bankItemElem.style.display = gameState.bank[gem] > 0 ? 'block' : 'none';
    }

    [1, 2, 3].forEach(tier => {
        const pileElem = document.getElementById(`draw-pile-${tier}`);
        if (gameState.decks[tier].length === 0) {
            pileElem.style.visibility = 'hidden';
        } else {
            pileElem.style.visibility = 'visible';
        }
    });

    document.getElementById('turn-indicator').innerHTML = wrapNumbers(`Turn: ${gameState.turnNumber}`);
    document.getElementById('player-turn-indicator').innerHTML = `${wrapNumbers(escapeHtml(player.playerName))}'s Turn`;
    document.getElementById('turn-gems-tracker').innerText = gameState.turnGemsPicked.join(', ') || 'None';

    updateMyIdentityIndicator();
    updateLorienArtVisibility();
    updateRingArtState();
    updateEndTurnButtonSize();
    renderPurchasedCardStacks();
    renderAllPlayersStatus();
}

function updateEndTurnButtonSize() {
    const btn = document.getElementById('end-turn-btn');
    if (!btn) return;
    btn.classList.toggle('end-turn-btn-xl', numPlayers <= 3);
}

function updateMyIdentityIndicator() {
    const indicator = document.getElementById('my-identity-indicator');
    if (!indicator) return;

    if (!isMultiplayerMode) {
        indicator.style.display = 'none';
        return;
    }

    const me = getMyPlayer();
    indicator.style.display = 'block';
    indicator.innerHTML = isMyTurn()
        ? `You are ${wrapNumbers(escapeHtml(me.playerName))} — it's your turn!`
        : `You are ${wrapNumbers(escapeHtml(me.playerName))} — waiting for your turn...`;
}

// --- MULTIPLAYER P2P SYNC HANDLERS ---
function openPlayerSelection(isMulti) {
    hostingForMultiplayer = !!isMulti;
    document.getElementById('select-title').innerText = hostingForMultiplayer ? "Host: Choose Player Count" : "Select Player Count";
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('player-select-menu').style.display = 'flex';
}

function closePlayerSelection() {
    document.getElementById('player-select-menu').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
}

async function handlePlayerCountChosen(count) {
    let enteredName = await showModal({ title: "Player Name", message: "Enter your player name:", type: "prompt", defaultValue: "Player 1", maxLength: 20 });
    if (enteredName && enteredName.trim() !== "") {
        localPlayerName = enteredName.trim().slice(0, 20);
    }

    document.getElementById('player-select-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    clearChat();

    if (hostingForMultiplayer) {
        startHostingGame(count);
    } else {
        let allNames = [localPlayerName];
        for(let i=2; i<=count; i++) {
            let pName = await showModal({ title: "Player Name", message: `Enter name for Player ${i}:`, type: "prompt", defaultValue: `Player ${i}`, maxLength: 20 });
            allNames.push(pName ? pName.trim().slice(0, 20) : `Player ${i}`);
        }
        let startingIndex = await showModal({ title: "Who Goes First?", message: "Choose which player takes the first turn:", type: "choice", options: allNames });
        initGame(count, allNames, startingIndex || 0);
    }
}

// Generates a short, human-friendly 6-digit room code instead of PeerJS's
// default long random ID.
function generateRoomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function startHostingGame(count) {
    isHost = true;
    isMultiplayerMode = true;
    myPlayerId = 1;
    hostConns = [];
    nextAssignablePlayerId = 2;
    attemptHostPeer(count);
}

function attemptHostPeer(count, attemptsLeft = 5) {
    const attemptedCode = generateRoomCode();
    peer = new Peer(attemptedCode, PEER_ICE_CONFIG);

    peer.on('open', async (id) => {
        roomCode = id;
        let hostNames = [localPlayerName];
        for(let i=2; i<=count; i++) hostNames.push(`Player ${i}`);
        let slotLabels = hostNames.map((n, idx) => idx === 0 ? `${n} (You)` : n);
        let startingIndex = await showModal({ title: "Who Goes First?", message: "Choose which player slot takes the first turn (guest names may still update once they join):", type: "choice", options: slotLabels });
        initGame(count, hostNames, startingIndex || 0);
        await showModal({ title: "Room Hosted!", message: "Share this 6-digit code with your friends so they can join:", type: "roomcode", code: id, variant: "success" });
    });

    peer.on('connection', (connection) => {
        let handled = false;

        connection.on('data', (data) => {
            if (!handled) {
                handled = true;
                if (data && data.type === 'HELLO') {
                    handleGuestHello(connection, data, count);
                } else {
                    // A connection that skips the handshake entirely -
                    // treat it as a fresh join so it's never just dropped.
                    assignNewGuest(connection, count);
                    handleIncomingData(data, connection);
                }
                return;
            }
            handleIncomingData(data, connection);
        });

        connection.on('close', () => {
            const entry = hostConns.find(c => c.connection === connection);
            if (entry) entry.connection = null;
        });
    });

    peer.on('disconnected', () => {
        if (peer && !peer.destroyed) {
            setTimeout(() => { if (peer && !peer.destroyed) peer.reconnect(); }, 500);
        }
    });

    peer.on('error', (err) => {
        if (err && err.type === 'unavailable-id' && attemptsLeft > 0) {
            peer.destroy();
            attemptHostPeer(count, attemptsLeft - 1);
        } else if (isHost && players.length === 0) {
            notify("Couldn't start hosting a room right now. Please try again.", "Hosting Failed", "warning");
        }
    });
}

// Grants a connection a brand new player seat (the normal "someone just
// joined" path).
function assignNewGuest(connection, count) {
    if (nextAssignablePlayerId > count) {
        if (connection.open) {
            connection.send({ type: 'ROOM_FULL' });
            connection.close();
        }
        notify("Someone tried to join, but the room is already full.", "Room Full", "warning");
        return;
    }

    const assignedId = nextAssignablePlayerId++;
    const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    hostConns.push({ connection, playerId: assignedId, token });

    connection.send({ type: 'ASSIGN_PLAYER', playerId: assignedId, token });
    broadcastState();
}

function handleGuestHello(connection, data, count) {
    if (data.rejoinToken && data.rejoinPlayerId) {
        const entry = hostConns.find(c => c.token === data.rejoinToken && c.playerId === data.rejoinPlayerId);
        if (entry) {
            entry.connection = connection;
            connection.send({ type: 'ASSIGN_PLAYER', playerId: entry.playerId, token: entry.token });
            sendStateSyncTo(connection);
            const rejoinedPlayer = players.find(p => p.id === entry.playerId);
            notify(`${rejoinedPlayer ? rejoinedPlayer.playerName : 'A player'} reconnected.`, "Player Reconnected", "success");
            return;
        }
    }
    assignNewGuest(connection, count);
}

function sendStateSyncTo(connection) {
    if (!connection || !connection.open) return;
    connection.send({
        type: 'SYNC_STATE',
        gameState: gameState,
        numPlayers: numPlayers,
        activePlayerIndex: activePlayerIndex,
        lorienHolderId: lorienHolderId,
        players: players,
        events: []
    });
}

async function promptJoinGame() {
    let enteredName = await showModal({ title: "Player Name", message: "Enter your player name:", type: "prompt", defaultValue: "Player 2", maxLength: 20 });
    if (enteredName && enteredName.trim() !== "") {
        localPlayerName = enteredName.trim().slice(0, 20);
    }

    let rawCode = await showModal({ title: "Join Game", message: "Enter the 6-digit room code your host shared with you:", type: "prompt" });
    if (!rawCode) return;
    let code = rawCode.trim().replace(/\D+/g, '');
    if (!code) {
        notify("That doesn't look like a valid room code.", "Invalid Code", "warning");
        return;
    }
    roomCode = code;
    hostPeerIdForRejoin = code;

    isHost = false;
    isMultiplayerMode = true;
    peer = new Peer(PEER_ICE_CONFIG);

    peer.on('open', () => {
        conn = peer.connect(code);
        armJoinConnectTimeout();
        setupGuestConnection(conn, false);
    });

    peer.on('disconnected', () => {
        if (peer && !peer.destroyed) {
            setTimeout(() => { if (peer && !peer.destroyed) peer.reconnect(); }, 500);
        }
    });

    peer.on('error', () => {
        if (isMultiplayerMode && players.length > 0) {
            scheduleGuestReconnect();
        } else {
            clearJoinConnectTimeout();
            notify("Couldn't connect to that room code. Double check it and try again.", "Connection Failed", "warning");
            isMultiplayerMode = false;
        }
    });
}

// Guards against a join that never actually completes - e.g. a WebRTC data
// channel that stalls on a restrictive network instead of firing an error.
// Without this, entering a code on such a network just looks like "nothing
// happens" with no feedback at all.
function armJoinConnectTimeout() {
    clearJoinConnectTimeout();
    joinConnectTimeout = setTimeout(() => {
        if (isMultiplayerMode && players.length === 0) {
            isMultiplayerMode = false;
            if (peer) { peer.destroy(); peer = null; }
            notify("Couldn't reach the host - the connection timed out. Check the code, make sure the host is still hosting, and try again. If this keeps happening, it may be your network (e.g. some mobile/cellular or public Wi-Fi networks block this kind of connection).", "Connection Timed Out", "warning");
        }
    }, 15000);
}

function clearJoinConnectTimeout() {
    if (joinConnectTimeout) {
        clearTimeout(joinConnectTimeout);
        joinConnectTimeout = null;
    }
}

let joinHandshakeConfirmed = false; // guest side: true once the host has actually acknowledged our HELLO

function setupGuestConnection(connection, isReconnectAttempt) {
    connection.on('open', () => {
        clearJoinConnectTimeout();
        if (!isReconnectAttempt) {
            notify("Successfully connected to the host!", "Connected!", "success");
            document.getElementById('main-menu').style.display = 'none';
            document.getElementById('game-container').style.display = 'flex';
            clearChat();
        }
        reconnectNoticeShown = false;
        joinHandshakeConfirmed = false;
        // Some mobile browsers fire PeerJS's 'open' event slightly before the
        // underlying data channel can reliably deliver the very first message,
        // which was silently dropping this HELLO and leaving the host never
        // knowing a guest had joined. Resend a few times until the host
        // actually acknowledges (ASSIGN_PLAYER/SYNC_STATE), rather than
        // trusting a single fire-and-forget send.
        sendHelloUntilAcked(connection, 5);
    });

    connection.on('data', (data) => handleIncomingData(data, connection));

    connection.on('error', () => {
        if (!isReconnectAttempt && isMultiplayerMode && players.length === 0) {
            clearJoinConnectTimeout();
            isMultiplayerMode = false;
            if (peer) { peer.destroy(); peer = null; }
            notify("Couldn't connect to that room code. Double check it and try again.", "Connection Failed", "warning");
        }
    });

    connection.on('close', () => {
        if (!isMultiplayerMode || isHost) return;
        if (!reconnectNoticeShown) {
            reconnectNoticeShown = true;
            notify("Lost connection to the host - trying to reconnect automatically...", "Reconnecting", "warning");
        }
        scheduleGuestReconnect();
    });
}

function sendHelloUntilAcked(connection, attemptsLeft) {
    if (joinHandshakeConfirmed || !connection || !connection.open || !isMultiplayerMode || isHost) return;
    connection.send({ type: 'HELLO', rejoinToken: myRejoinToken, rejoinPlayerId: myPlayerId });
    if (attemptsLeft > 0) {
        setTimeout(() => sendHelloUntilAcked(connection, attemptsLeft - 1), 2000);
    } else {
        setTimeout(() => {
            if (!joinHandshakeConfirmed && isMultiplayerMode && players.length === 0) {
                notify("Connected to the host, but never heard back. This can happen on some mobile or cellular networks. Try leaving and rejoining.", "No Response From Host", "warning");
            }
        }, 2000);
    }
}

function attemptGuestReconnect() {
    if (!isMultiplayerMode || isHost) return;
    if (!peer || peer.destroyed || !hostPeerIdForRejoin) return;
    if (conn && conn.open) return; // already fine, nothing to do

    const doConnect = () => {
        if (!isMultiplayerMode || isHost) return;
        conn = peer.connect(hostPeerIdForRejoin);
        setupGuestConnection(conn, true);
    };

    if (peer.disconnected) {
        peer.reconnect();
        peer.once('open', doConnect);
    } else {
        doConnect();
    }
}

function scheduleGuestReconnect() {
    if (!isMultiplayerMode || isHost) return;
    if (reconnectTimer) return; // a retry is already queued
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        attemptGuestReconnect();
    }, 1500);
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !isMultiplayerMode) return;
    if (isHost) {
        if (peer && peer.disconnected) peer.reconnect();
    } else {
        attemptGuestReconnect();
    }
});

function handleIncomingData(data, sourceConnection) {
    if (data.type === 'SYNC_STATE') {
        joinHandshakeConfirmed = true;
        Object.assign(gameState, data.gameState);
        numPlayers = data.numPlayers;
        activePlayerIndex = data.activePlayerIndex;
        lorienHolderId = data.lorienHolderId;
        players = data.players;
        announceTurnChange();

        updateUI();
        renderAllMarkets();
        renderNobles();
        scheduleImagePreload();

        if (Array.isArray(data.events)) {
            data.events.forEach(e => notify(e.message, e.title, e.variant));
        }

        if (isHost) {
            hostBroadcastToAll(data, sourceConnection);
        }
    } else if (data.type === 'ASSIGN_PLAYER') {
        joinHandshakeConfirmed = true;
        myPlayerId = data.playerId;
        if (data.token) myRejoinToken = data.token;
        if (conn && conn.open) {
            conn.send({ type: 'UPDATE_PLAYER_NAME', name: localPlayerName });
        }
    } else if (data.type === 'ROOM_FULL') {
        joinHandshakeConfirmed = true;
        notify("That room is already full.", "Room Full", "warning");
        if (peer) { peer.destroy(); peer = null; }
        isMultiplayerMode = false;
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('main-menu').style.display = 'flex';
    } else if (data.type === 'CHAT_MESSAGE') {
        appendChatMessage(data.sender, data.message);
        if (isHost) {
            hostBroadcastToAll(data, sourceConnection);
        }
    } else if (data.type === 'UPDATE_PLAYER_NAME' && isHost) {
        const entry = hostConns.find(c => c.connection === sourceConnection);
        if (entry) {
            const targetPlayer = players.find(p => p.id === entry.playerId);
            if (targetPlayer) {
                targetPlayer.playerName = (data.name && data.name.trim()) ? data.name.trim().slice(0, 20) : targetPlayer.playerName;
                notify(`${targetPlayer.playerName} joined the game!`, "Player Joined", "success");
                broadcastState();
                updateUI();
            }
        }
    }
}

function hostBroadcastToAll(data, excludeConnection) {
    hostConns.forEach(c => {
        if (c.connection && c.connection.open && c.connection !== excludeConnection) {
            c.connection.send(data);
        }
    });
}

function broadcastState() {
    if (!isMultiplayerMode) return;

    const payload = {
        type: 'SYNC_STATE',
        gameState: gameState,
        numPlayers: numPlayers,
        activePlayerIndex: activePlayerIndex,
        lorienHolderId: lorienHolderId,
        players: players,
        events: pendingBroadcastEvents
    };
    pendingBroadcastEvents = [];

    if (isHost) {
        hostBroadcastToAll(payload);
    } else if (conn && conn.open) {
        conn.send(payload);
    }
}

function syncAndRefresh() {
    players.forEach(p => checkNobles(p));
    checkRingActivatorStillEligible();
    updateUI();
    renderAllMarkets();
    if (isMultiplayerMode) {
        broadcastState();
    }
}

// --- PAUSE MENU & ESCAPE KEY HANDLERS ---
function togglePauseMenu() {
    const pauseMenu = document.getElementById('pause-menu');
    const isVisible = pauseMenu.style.display === 'flex';

    const codeEl = document.getElementById('pause-room-code');
    if (codeEl) {
        if (!isVisible && isMultiplayerMode && roomCode) {
            codeEl.textContent = `Room Code: ${roomCode}`;
            codeEl.style.display = 'block';
        } else {
            codeEl.style.display = 'none';
        }
    }

    pauseMenu.style.display = isVisible ? 'none' : 'flex';
}

async function returnToMainMenu() {
    const confirmed = await showModal({ title: "Quit to Main Menu?", message: "Are you sure you want to quit to the main menu? Any active game progress will be lost.", type: "confirm", variant: "warning" });
    if (!confirmed) {
        return;
    }

    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';

    isMultiplayerMode = false; // set before clearing the timer/peer so any in-flight reconnect logic bails out immediately

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    myRejoinToken = null;
    hostPeerIdForRejoin = null;
    reconnectNoticeShown = false;

    if (peer) {
        peer.destroy();
        peer = null;
        conn = null;
        hostConns = [];
        nextAssignablePlayerId = 2;
        isHost = false;
        myPlayerId = 1;
        roomCode = null;
    }
}

// --- MULTIPLAYER CHAT SYSTEM ---
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const chatContainer = document.getElementById('chat-container');

    if (chatContainer && !document.getElementById('chat-close-btn')) {
        const closeBtn = document.createElement('span');
        closeBtn.id = 'chat-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = 'position: absolute; top: 5px; right: 8px; cursor: pointer; font-size: 18px; font-weight: bold; color: #aaa; z-index: 10;';
        closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
        closeBtn.onmouseout = () => closeBtn.style.color = '#aaa';
        closeBtn.onclick = () => {
            chatInput.value = '';
            chatInput.blur();
            chatContainer.style.display = 'none';
        };
        if (window.getComputedStyle(chatContainer).position === 'static') {
            chatContainer.style.position = 'relative';
        }
        chatContainer.appendChild(closeBtn);
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                event.stopPropagation();
                
                let messageText = chatInput.value.trim();
                if (messageText !== "") {
                    sendChatMessage(messageText);
                }
                chatInput.value = '';
            }
        });
    }
});

window.addEventListener('keydown', (event) => {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer || gameContainer.style.display !== 'flex') return;

    const chatContainer = document.getElementById('chat-container');
    const chatInput = document.getElementById('chat-input');

    if (event.key === 'Enter') {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu && pauseMenu.style.display === 'flex') return;

        if (chatContainer.style.display !== 'flex') {
            chatContainer.style.display = 'flex';
            chatInput.focus();
            event.preventDefault();
            event.stopPropagation();
        }
    } else if (event.key === 'Escape') {
        if (document.activeElement === chatInput) {
            chatInput.value = '';
            chatInput.blur();
            chatContainer.style.display = 'none';
            event.stopPropagation();
        } else {
            const pauseMenu = document.getElementById('pause-menu');
            if (pauseMenu) {
                togglePauseMenu();
            }
        }
    }
});

function getMyPlayer() {
    if (isMultiplayerMode) {
        return players.find(p => p.id === myPlayerId) || getCurrentPlayer();
    }
    return getCurrentPlayer();
}

function sendChatMessage(text) {
    const senderName = getMyPlayer().playerName;

    appendChatMessage(senderName, text);

    if (isMultiplayerMode) {
        const payload = { type: 'CHAT_MESSAGE', sender: senderName, message: text };
        if (isHost) {
            hostBroadcastToAll(payload);
        } else if (conn && conn.open) {
            conn.send(payload);
        }
    }
}

function appendChatMessage(sender, text) {
    const chatMessages = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = `<strong>${escapeHtml(sender)}:</strong> ${escapeHtml(text)}`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    chatMessages.innerHTML = '<div class="chat-msg" style="color: #66c0f4; font-style: italic;">System: Press Enter to chat with players.</div>';
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wrapNumbers(str) {
    return str.replace(/\d+/g, '<span class="stat-num">$&</span>');
}

function openSettings() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('settings-menu').style.display = 'flex';
}
function closeSettings() {
    document.getElementById('settings-menu').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
}
function quitGame() {

    window.close();

    document.body.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; height:100vh; text-align:center; padding:20px; box-sizing:border-box;">
            <div>
                <h1 style="margin-bottom:12px;">Thanks for playing!</h1>
                <p style="font-size:15px; color:#bdc3c7;">You can close this tab now.</p>
            </div>
        </div>
    `;
}
