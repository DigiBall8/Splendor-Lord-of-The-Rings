const numPlayers = 4;
let activePlayerIndex = 0;
let lorienHolderId = null;

const players = [];
for (let i = 1; i <= numPlayers; i++) {
    players.push({
        id: i,
        victoryPoints: 0,
        leaves: 0,
        hasReceivedOnyxToken: false,
        gems: { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 0, onyx: 0, joker: 0 },
        bonuses: { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 0 },
        purchasedCards: [],
        reservedCards: []
    });
}

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
        6: { points: 3, gem: 'sapphire', leaves: false, cost: { emerald: 0, diamond: 0, sapphire: 6, ruby: 0, gold: 0 } },
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
    if (CARD_DATABASE[tier] && CARD_DATABASE[tier][randNum]) {
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

    const gems = ['emerald', 'diamond', 'sapphire', 'ruby', 'gold'];
    const gem = gems[Math.floor(Math.random() * gems.length)];
    let points = tier === 1 ? (Math.random() < 0.7 ? 0 : 1) : (tier === 2 ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 3) + 3);
    
    let cost = { emerald: 0, diamond: 0, sapphire: 0, ruby: 0, gold: 0 };
    let totalCost = tier === 1 ? 3 : (tier === 2 ? 5 : 7);
    for (let i = 0; i < totalCost; i++) {
        let rGem = gems[Math.floor(Math.random() * gems.length)];
        cost[rGem] = (cost[rGem] || 0) + 1;
    }

    return {
        id: tier * 1000 + randNum,
        points: points,
        gem: gem,
        leaves: Math.random() > 0.8 ? 2 : (Math.random() > 0.6 ? 1 : 0),
        cost: cost,
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
    bank: { emerald: 4, diamond: 4, sapphire: 4, ruby: 4, gold: 4 },
    
    decks: {
        1: createDeck(1),
        2: createDeck(2),
        3: createDeck(3)
    },

    marketTier1: [],
    marketTier2: [],
    marketTier3: [],

    destinationsPool: [
        { id: 901, points: 3, requirements: { emerald: 4, diamond: 4, sapphire: 0, ruby: 0, gold: 0 }, image: 'Destinations/1.jpg' },
        { id: 902, points: 3, requirements: { emerald: 0, diamond: 0, sapphire: 4, ruby: 4, gold: 0 }, image: 'Destinations/2.jpg' },
        { id: 903, points: 3, requirements: { emerald: 3, diamond: 0, sapphire: 3, ruby: 0, gold: 3 }, image: 'Destinations/3.jpg' },
        { id: 904, points: 3, requirements: { emerald: 0, diamond: 3, sapphire: 0, ruby: 3, gold: 3 }, image: 'Destinations/4.jpg' },
        { id: 905, points: 3, requirements: { emerald: 3, diamond: 3, sapphire: 0, ruby: 0, gold: 3 }, image: 'Destinations/5.jpg' },
        { id: 906, points: 3, requirements: { emerald: 4, diamond: 0, sapphire: 4, ruby: 0, gold: 0 }, image: 'Destinations/6.jpg' },
        { id: 907, points: 3, requirements: { emerald: 0, diamond: 4, sapphire: 0, ruby: 0, gold: 4 }, image: 'Destinations/7.jpg' },
        { id: 908, points: 3, requirements: { emerald: 0, diamond: 0, sapphire: 0, ruby: 4, gold: 4 }, image: 'Destinations/8.jpg' },
        { id: 909, points: 3, requirements: { emerald: 3, diamond: 3, sapphire: 3, ruby: 0, gold: 0 }, image: 'Destinations/9.jpg' },
        { id: 910, points: 3, requirements: { emerald: 0, diamond: 0, sapphire: 3, ruby: 3, gold: 3 }, image: 'Destinations/10.jpg' },
        { id: 911, points: 3, requirements: { emerald: 2, diamond: 2, sapphire: 2, ruby: 2, gold: 0 }, image: 'Destinations/11.jpg' },
        { id: 912, points: 3, requirements: { emerald: 0, diamond: 2, sapphire: 2, ruby: 2, gold: 2 }, image: 'Destinations/12.jpg' }
    ],
    activeDestinations: []
};

gameState.marketTier1 = [gameState.decks[1].pop(), gameState.decks[1].pop(), gameState.decks[1].pop(), gameState.decks[1].pop()];
gameState.marketTier2 = [gameState.decks[2].pop(), gameState.decks[2].pop(), gameState.decks[2].pop(), gameState.decks[2].pop()];
gameState.marketTier3 = [gameState.decks[3].pop(), gameState.decks[3].pop(), gameState.decks[3].pop(), gameState.decks[3].pop()];

function drawCardFromDeck(tierNumber) {
    const deck = gameState.decks[tierNumber];
    if (!deck || deck.length === 0) {
        return null;
    }
    return deck.pop();
}

function initGame() {
    gameState.activeDestinations = [...gameState.destinationsPool].sort(() => Math.random() - 0.5).slice(0, 3);
    updateUI();
    renderAllMarkets();
    renderNobles();
    updateLorienDisplay();
}

function getCurrentPlayer() {
    return players[activePlayerIndex];
}

function renderAllMarkets() {
    renderMarket('tier-1-market', gameState.marketTier1, 1);
    renderMarket('tier-2-market', gameState.marketTier2, 2);
    renderMarket('tier-3-market', gameState.marketTier3, 3);
    renderReservedCards();
}

function renderMarket(elementId, marketArray, tierNumber) {
    const marketContainer = document.getElementById(elementId);
    marketContainer.innerHTML = '';

    marketArray.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';

        if (card) {
            cardDiv.innerHTML = `<img src="${card.image}" alt="Card" class="card-img">`;
            cardDiv.onclick = () => buyCard(tierNumber, index);
        } else {
            cardDiv.style.visibility = 'hidden';
        }
        
        marketContainer.appendChild(cardDiv);
    });
}

function renderNobles() {
    const container = document.getElementById('nobles-container');
    container.innerHTML = '';

    gameState.activeDestinations.forEach(noble => {
        const nobleDiv = document.createElement('div');
        nobleDiv.className = 'noble-card';
        nobleDiv.innerHTML = `
            <div class="noble-img-container">
                <img src="${noble.image}" alt="Destination Card" class="destination-img">
            </div>
        `;
        container.appendChild(nobleDiv);
    });
}

function renderReservedCards() {
    const container = document.getElementById('reserved-cards-container');
    container.innerHTML = '';
    const player = getCurrentPlayer();

    if (player.reservedCards.length === 0) {
        container.innerHTML = '<span style="font-size: 10px; color: #bdc3c7;">None</span>';
        return;
    }

    player.reservedCards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.innerHTML = `<img src="${card.image}" alt="Card" class="card-img">`;

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
        playerDiv.style.fontSize = '10px';
        playerDiv.style.padding = '3px 4px';
        playerDiv.style.marginBottom = '2px';
        playerDiv.style.borderRadius = '3px';
        playerDiv.style.background = isCurrent ? 'rgba(26, 188, 156, 0.2)' : 'rgba(0,0,0,0.15)';
        playerDiv.style.border = isCurrent ? '1px solid #1abc9c' : '1px solid transparent';

        let totalTokens = Object.values(p.gems).reduce((a, b) => a + b, 0);
        
        playerDiv.innerHTML = `
            <div style="font-weight: bold; color: ${isCurrent ? '#1abc9c' : '#ecf0f1'};">
                Player ${p.id} ${isCurrent ? '⭐ (Active)' : ''} — VP: ${p.victoryPoints} | Tokens: ${totalTokens}/10
            </div>
            <div style="color: #bdc3c7; margin-top: 1px;">
                Em:${p.gems.emerald} Di:${p.gems.diamond} Sa:${p.gems.sapphire} Ru:${p.gems.ruby} Go:${p.gems.gold} Onyx:${p.gems.onyx} Jok:${p.gems.joker}
            </div>
        `;
        container.appendChild(playerDiv);
    });
}

function renderPurchasedCardStacks() {
    const player = getCurrentPlayer();
    const container = document.getElementById('purchased-stacks-container');
    document.getElementById('purchased-header').innerText = `Purchased Cards Inventory (Player ${player.id})`;
    container.innerHTML = '';

    if (player.purchasedCards.length === 0) {
        container.innerHTML = '<span style="font-size: 11px; color: #bdc3c7;">None</span>';
        return;
    }

    const groups = { emerald: [], diamond: [], sapphire: [], ruby: [], gold: [] };
    player.purchasedCards.forEach(card => {
        if (groups[card.gem]) {
            groups[card.gem].push(card);
        }
    });

    for (let gemType in groups) {
        const cardsInGroup = groups[gemType];
        if (cardsInGroup.length === 0) continue;

        const stackCol = document.createElement('div');
        stackCol.className = 'card-stack-column';
        stackCol.style.width = '65px';

        cardsInGroup.forEach((card, idx) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'staggered-card';
            cardDiv.style.top = `${idx * 16}px`;
            cardDiv.style.zIndex = idx + 1;
            cardDiv.innerHTML = `<img src="${card.image}" alt="Card">`;
            stackCol.appendChild(cardDiv);
        });

        stackCol.style.height = `${75 + (cardsInGroup.length - 1) * 16}px`;
        container.appendChild(stackCol);
    }
}

function getTotalPlayerTokens(player) {
    return Object.values(player.gems).reduce((a, b) => a + b, 0);
}

function drawCard(tierNumber) {
    if (gameState.actionTakenThisTurn) {
        alert("You already performed an action this turn!");
        return;
    }

    const player = getCurrentPlayer();
    if (player.reservedCards.length >= 3) {
        alert("Maximum 3 reserved cards allowed!");
        return;
    }

    let drawnCard = drawCardFromDeck(tierNumber);
    if (!drawnCard) {
        alert("This draw pile is empty!");
        return;
    }

    player.reservedCards.push(drawnCard);
    player.gems.joker++;

    gameState.actionTakenThisTurn = true;
    updateUI();
    renderAllMarkets();
}

function takeGemToken(gemType) {
    const player = getCurrentPlayer();
    if (gameState.actionTakenThisTurn && gameState.turnGemsPicked.length === 0) {
        alert("You already performed a different action this turn!");
        return;
    }

    if (gameState.bank[gemType] <= 0) {
        alert("That gem stack is empty!");
        return;
    }

    const currentPicks = gameState.turnGemsPicked;

    if (currentPicks.length === 2 && currentPicks[0] === currentPicks[1]) {
        alert("You already took 2 tokens of the same color!");
        return;
    }

    if (currentPicks.length >= 3) {
        alert("You can only take up to 3 tokens per turn!");
        return;
    }

    if (currentPicks.length === 1) {
        if (currentPicks[0] === gemType) {
            if (gameState.bank[gemType] < 1) {
                alert("Not enough tokens left to take a pair!");
                return;
            }
        } else {
            if (currentPicks.includes(gemType)) {
                alert("Cannot pick the same color twice when taking different chips!");
                return;
            }
        }
    }

    if (currentPicks.length === 2) {
        if (currentPicks.includes(gemType)) {
            alert("Cannot pick a duplicate color when taking 3 different chips!");
            return;
        }
    }

    gameState.bank[gemType]--;
    player.gems[gemType]++;
    gameState.turnGemsPicked.push(gemType);
    gameState.actionTakenThisTurn = true;
    
    updateUI();
}

function returnToken(gemType) {
    const player = getCurrentPlayer();
    if (gemType === 'onyx' || gemType === 'joker') {
        alert("Onyx and Joker tokens cannot be returned to the bank.");
        return;
    }

    if (player.gems[gemType] > 0) {
        player.gems[gemType]--;
        gameState.bank[gemType]++;
        updateUI();
    } else {
        alert(`You don't have any ${gemType} tokens to return!`);
    }
}

function buyCard(tierNumber, index) {
    if (gameState.actionTakenThisTurn) {
        alert("You already performed an action this turn!");
        return;
    }

    let marketArray;
    if (tierNumber === 1) marketArray = gameState.marketTier1;
    else if (tierNumber === 2) marketArray = gameState.marketTier2;
    else if (tierNumber === 3) marketArray = gameState.marketTier3;

    const card = marketArray[index];
    if (!card) return;

    processCardPurchase(card, tierNumber, () => {
        const nextCard = drawCardFromDeck(tierNumber);
        if (nextCard) {
            marketArray.splice(index, 1, nextCard);
        } else {
            marketArray.splice(index, 1, null);
        }
    });
}

function buyReservedCard(reservedIndex) {
    if (gameState.actionTakenThisTurn) {
        alert("You already performed an action this turn!");
        return;
    }

    const player = getCurrentPlayer();
    const card = player.reservedCards[reservedIndex];

    let tierNumber = 1;
    if (card.id >= 2000 && card.id < 3000) tierNumber = 2;
    if (card.id >= 3000) tierNumber = 3;

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
            let deficit = netCost - tempPlayerGems[gem];
            tempPlayerGems[gem] = 0;
            deficitTotal += deficit;
        }
    }

    if (tempPlayerGems.joker < deficitTotal) {
        alert("Not enough gems/jokers to buy this card!");
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
        if (remainingDeficit > 0) {
            player.gems.joker -= remainingDeficit;
        }
    }

    player.victoryPoints += card.points;
    player.bonuses[card.gem]++;
    player.purchasedCards.push(card);

    if (tierNumber === 3 && !player.hasReceivedOnyxToken) {
        player.hasReceivedOnyxToken = true;
        player.gems.onyx++;
        alert(`Player ${player.id} purchased their first Tier 3 card and received 1 Onyx Token!`);
    }

    if (card.leaves > 0) {
        player.leaves += card.leaves;
        checkLorienLeaf(player);
    }
    
    removeCardCallback();
    checkNobles(player);

    gameState.actionTakenThisTurn = true;
    updateUI();
    renderAllMarkets();
}

function tryClaimRing() {
    const player = getCurrentPlayer();

    let hasEnoughPoints = player.victoryPoints >= 16;
    let hasAllTokens = player.gems.emerald >= 1 &&
                       player.gems.diamond >= 1 &&
                       player.gems.sapphire >= 1 &&
                       player.gems.ruby >= 1 &&
                       player.gems.gold >= 1 &&
                       player.gems.onyx >= 1;

    if (!hasEnoughPoints || !hasAllTokens) {
        alert(`Cannot claim The Ring yet! Requirements:\n- Minimum 16 Victory Points (You have ${player.victoryPoints})\n- At least 1 token of every color including Gold, Onyx, and Joker`);
        return;
    }

    alert(`SUCCESS! Player ${player.id} claimed The Ring and won the game with ${player.victoryPoints} Victory Points!`);
}

function checkLorienLeaf(activePlayer) {
    if (activePlayer.leaves < 3) return;

    if (lorienHolderId === null) {
        lorienHolderId = activePlayer.id;
        activePlayer.victoryPoints += 3;
        alert(`Player ${activePlayer.id} reached 3+ leaves, claimed the Lorien Leaf, and gained 3 Victory Points!`);
    } else if (lorienHolderId !== activePlayer.id) {
        let currentHolder = players.find(p => p.id === lorienHolderId);
        if (activePlayer.leaves > currentHolder.leaves) {
            currentHolder.victoryPoints -= 3;
            lorienHolderId = activePlayer.id;
            activePlayer.victoryPoints += 3;
            alert(`Player ${activePlayer.id} surpassed the previous leaf count, taking control of the Lorien Leaf and its 3 Victory Points!`);
        }
    }
    updateLorienDisplay();
}

function updateLorienDisplay() {
    const currentPlayer = getCurrentPlayer();
    document.getElementById('p-has-lorien').style.display = (currentPlayer.id === lorienHolderId) ? 'inline' : 'none';
}

function checkNobles(player) {
    for (let i = gameState.activeDestinations.length - 1; i >= 0; i--) {
        const noble = gameState.activeDestinations[i];
        let qualifies = true;

        for (let gem in noble.requirements) {
            if (player.bonuses[gem] < noble.requirements[gem]) {
                qualifies = false;
                break;
            }
        }

        if (qualifies) {
            player.victoryPoints += noble.points;
            gameState.activeDestinations.splice(i, 1);
            alert(`Player ${player.id} reached a Destination and gained 3 Victory Points!`);
            renderNobles();
            break;
        }
    }
}

function endTurn() {
    const player = getCurrentPlayer();
    if (!gameState.actionTakenThisTurn) {
        let proceed = confirm("No action taken this turn. Pass anyway?");
        if (!proceed) return;
    }

    if (getTotalPlayerTokens(player) > 10) {
        alert("You have more than 10 total tokens! Click tokens in your inventory to return them until you have 10 or fewer.");
        return;
    }

    activePlayerIndex = (activePlayerIndex + 1) % numPlayers;
    if (activePlayerIndex === 0) {
        gameState.turnNumber++;
    }

    gameState.actionTakenThisTurn = false;
    gameState.turnGemsPicked = [];
    updateUI();
    renderAllMarkets();
    updateLorienDisplay();
}

function updateUI() {
    const player = getCurrentPlayer();

    for (let gem in gameState.bank) {
        document.getElementById(`bank-${gem}`).innerText = gameState.bank[gem];
        
        const bankItemElem = document.querySelector(`.bank-token-item img[alt="${gem.charAt(0).toUpperCase() + gem.slice(1)}"]`);
        if (bankItemElem) {
            bankItemElem.style.display = gameState.bank[gem] > 0 ? 'block' : 'none';
        }

        document.getElementById(`p-${gem}`).innerText = player.gems[gem];
        if (gem !== 'gold' && gem !== 'onyx' && document.getElementById(`b-${gem}`)) {
            document.getElementById(`b-${gem}`).innerText = player.bonuses[gem];
        }
    }

    document.getElementById('p-onyx-token').innerText = player.gems.onyx;
    document.getElementById('p-joker').innerText = player.gems.joker;
    document.getElementById('b-gold').innerText = player.bonuses.gold;

    let totalTokens = getTotalPlayerTokens(player);
    document.getElementById('turn-indicator').innerText = `Turn: ${gameState.turnNumber}`;
    document.getElementById('player-turn-indicator').innerText = `Player ${player.id}'s Turn`;
    document.getElementById('score-indicator').innerText = `VP: ${player.victoryPoints} / 16`;
    document.getElementById('token-count-indicator').innerText = `Tokens: ${totalTokens} / 10`;
    document.getElementById('turn-gems-tracker').innerText = gameState.turnGemsPicked.join(', ') || 'None';
    document.getElementById('p-leaves').innerText = player.leaves;

    renderPurchasedCardStacks();
    renderAllPlayersStatus();
}

initGroupGame = initGame();
initGame();