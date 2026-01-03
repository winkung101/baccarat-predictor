interface StatisticsProps {
  history: ("P" | "B" | "T")[];
}

export const Statistics = ({ history }: StatisticsProps) => {
  const playerWins = history.filter((r) => r === "P").length;
  const bankerWins = history.filter((r) => r === "B").length;
  const ties = history.filter((r) => r === "T").length;
  const total = history.length;

  const playerPercent = total > 0 ? ((playerWins / total) * 100).toFixed(1) : "0";
  const bankerPercent = total > 0 ? ((bankerWins / total) * 100).toFixed(1) : "0";
  const tiePercent = total > 0 ? ((ties / total) * 100).toFixed(1) : "0";

  return (
    <div className="bg-secondary/50 rounded-lg p-4 border border-border/50">
      <h3 className="text-gold font-serif text-xl mb-4 text-center">Statistics</h3>

      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="bg-player rounded-lg p-3">
            <div className="text-2xl sm:text-3xl font-bold text-player-foreground">
              {playerWins}
            </div>
            <div className="text-xs sm:text-sm text-player-foreground/80">Player</div>
          </div>
          <div className="text-muted-foreground text-sm mt-1">{playerPercent}%</div>
        </div>

        <div className="text-center">
          <div className="bg-tie rounded-lg p-3">
            <div className="text-2xl sm:text-3xl font-bold text-tie-foreground">{ties}</div>
            <div className="text-xs sm:text-sm text-tie-foreground/80">Tie</div>
          </div>
          <div className="text-muted-foreground text-sm mt-1">{tiePercent}%</div>
        </div>

        <div className="text-center">
          <div className="bg-banker rounded-lg p-3">
            <div className="text-2xl sm:text-3xl font-bold text-banker-foreground">
              {bankerWins}
            </div>
            <div className="text-xs sm:text-sm text-banker-foreground/80">Banker</div>
          </div>
          <div className="text-muted-foreground text-sm mt-1">{bankerPercent}%</div>
        </div>
      </div>

      <div className="mt-4 text-center text-muted-foreground">
        Total Hands: <span className="text-gold font-semibold">{total}</span>
      </div>
    </div>
  );
};
