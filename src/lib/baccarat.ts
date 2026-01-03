export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number;
}

const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      let value: number;
      if (rank === "A") {
        value = 1;
      } else if (["10", "J", "Q", "K"].includes(rank)) {
        value = 0;
      } else {
        value = parseInt(rank);
      }
      deck.push({ suit, rank, value });
    }
  }
  return deck;
};

export const createShoe = (numDecks: number = 8): Card[] => {
  const shoe: Card[] = [];
  for (let i = 0; i < numDecks; i++) {
    shoe.push(...createDeck());
  }
  // Shuffle
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
};

export const calculateHandValue = (cards: Card[]): number => {
  const total = cards.reduce((sum, card) => sum + card.value, 0);
  return total % 10;
};

export const shouldPlayerDraw = (playerValue: number): boolean => {
  return playerValue <= 5;
};

export const shouldBankerDraw = (
  bankerValue: number,
  playerThirdCard: Card | null
): boolean => {
  if (bankerValue >= 7) return false;
  if (bankerValue <= 2) return true;

  if (!playerThirdCard) {
    return bankerValue <= 5;
  }

  const p3 = playerThirdCard.value;

  switch (bankerValue) {
    case 3:
      return p3 !== 8;
    case 4:
      return p3 >= 2 && p3 <= 7;
    case 5:
      return p3 >= 4 && p3 <= 7;
    case 6:
      return p3 === 6 || p3 === 7;
    default:
      return false;
  }
};

export interface GameResult {
  playerCards: Card[];
  bankerCards: Card[];
  playerScore: number;
  bankerScore: number;
  winner: "P" | "B" | "T";
  isNatural: boolean;
}

export const playHand = (shoe: Card[]): { result: GameResult; remainingShoe: Card[] } => {
  if (shoe.length < 6) {
    shoe = createShoe();
  }

  const newShoe = [...shoe];
  const playerCards: Card[] = [newShoe.pop()!, newShoe.pop()!];
  const bankerCards: Card[] = [newShoe.pop()!, newShoe.pop()!];

  let playerScore = calculateHandValue(playerCards);
  let bankerScore = calculateHandValue(bankerCards);

  // Check for natural
  const isNatural = playerScore >= 8 || bankerScore >= 8;

  if (!isNatural) {
    // Player draws
    let playerThirdCard: Card | null = null;
    if (shouldPlayerDraw(playerScore)) {
      playerThirdCard = newShoe.pop()!;
      playerCards.push(playerThirdCard);
      playerScore = calculateHandValue(playerCards);
    }

    // Banker draws
    if (shouldBankerDraw(bankerScore, playerThirdCard)) {
      bankerCards.push(newShoe.pop()!);
      bankerScore = calculateHandValue(bankerCards);
    }
  }

  let winner: "P" | "B" | "T";
  if (playerScore > bankerScore) {
    winner = "P";
  } else if (bankerScore > playerScore) {
    winner = "B";
  } else {
    winner = "T";
  }

  return {
    result: {
      playerCards,
      bankerCards,
      playerScore,
      bankerScore,
      winner,
      isNatural,
    },
    remainingShoe: newShoe,
  };
};
