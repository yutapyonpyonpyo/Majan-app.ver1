export const DEFAULT_RULES = Object.freeze({
  totalPoints: 100000,
  returnPoints: 30000,
  pointsPerPt: 1000,
  rankPoints: [40, 10, -10, -20],
});

export function round1(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10) / 10;
}

export function validateRules(rules) {
  const errors = [];
  const values = [
    rules.totalPoints,
    rules.returnPoints,
    rules.pointsPerPt,
    ...(rules.rankPoints || []),
  ];
  if (values.some((value) => !Number.isFinite(Number(value)))) {
    errors.push("ルールはすべて数値で入力してください");
  }
  if (Number(rules.totalPoints) <= 0) errors.push("持ち点合計は1点以上にしてください");
  if (Number(rules.returnPoints) < 0) errors.push("返し点は0点以上にしてください");
  if (Number(rules.pointsPerPt) <= 0) errors.push("1pt換算点は1点以上にしてください");
  if (!Array.isArray(rules.rankPoints) || rules.rankPoints.length !== 4) {
    errors.push("順位点は4つ設定してください");
  } else {
    const baseTotal =
      (Number(rules.totalPoints) - Number(rules.returnPoints) * 4) /
      Number(rules.pointsPerPt);
    const rankTotal = rules.rankPoints.reduce((sum, value) => sum + Number(value), 0);
    if (Math.abs(baseTotal + rankTotal) > 0.000001) {
      errors.push(
        `この設定では最終pt合計が${formatPt(baseTotal + rankTotal)}になります。0.0になるよう調整してください`,
      );
    }
  }
  return errors;
}

export function calculateGame(scores, rules = DEFAULT_RULES) {
  const hasBlank = scores.some(
    (score) => score === "" || score === null || score === undefined,
  );
  const numericScores = scores.map(Number);
  const complete =
    !hasBlank &&
    numericScores.length === 4 &&
    numericScores.every((score) => Number.isFinite(score));
  const scoreTotal = complete ? numericScores.reduce((sum, score) => sum + score, 0) : 0;
  const difference = scoreTotal - Number(rules.totalPoints);
  const multiplesOf100 = complete && numericScores.every((score) => score % 100 === 0);

  if (!complete) {
    return { complete: false, valid: false, scoreTotal, difference, results: [] };
  }

  const ranked = numericScores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const results = Array(4);
  let rankedIndex = 0;
  while (rankedIndex < ranked.length) {
    let tiedEnd = rankedIndex;
    while (
      tiedEnd + 1 < ranked.length &&
      ranked[tiedEnd + 1].score === ranked[rankedIndex].score
    ) {
      tiedEnd += 1;
    }
    const tiedCount = tiedEnd - rankedIndex + 1;
    const rank = rankedIndex + 1;
    const rankPosition = (rank + tiedEnd + 1) / 2;
    const rankPt =
      rules.rankPoints
        .slice(rankedIndex, tiedEnd + 1)
        .reduce((sum, value) => sum + Number(value), 0) / tiedCount;

    for (let index = rankedIndex; index <= tiedEnd; index += 1) {
      const entry = ranked[index];
      const basePt =
        (entry.score - Number(rules.returnPoints)) / Number(rules.pointsPerPt);
      results[entry.index] = {
        index: entry.index,
        score: entry.score,
        rank,
        rankPosition,
        tied: tiedCount > 1,
        basePt,
        rankPt,
        finalPt: basePt + rankPt,
      };
    }
    rankedIndex = tiedEnd + 1;
  }

  const finalTotal = round1(results.reduce((sum, result) => sum + result.finalPt, 0));
  return {
    complete: true,
    valid:
      difference === 0 &&
      multiplesOf100 &&
      Math.abs(finalTotal) < 0.000001,
    scoreTotal,
    difference,
    multiplesOf100,
    finalTotal,
    results,
  };
}

export function getStandings(tournament) {
  const totals = tournament.players.map((player, index) => ({
    ...player,
    index,
    total: 0,
    wins: 0,
  }));
  for (const game of tournament.games) {
    game.results.forEach((result, index) => {
      totals[index].total = round1(totals[index].total + Number(result.finalPt));
      if (result.rank === 1) totals[index].wins += 1;
    });
  }
  return totals.sort((a, b) => b.total - a.total || b.wins - a.wins || a.index - b.index);
}

export function getPlayerStats(tournament) {
  const gameCount = tournament.games.length;

  return tournament.players.map((player, index) => {
    const rankCounts = [0, 0, 0, 0];
    let totalPt = 0;
    let rankTotal = 0;

    tournament.games.forEach((game) => {
      const result = game.results[index];
      if (!result) return;
      totalPt += Number(result.finalPt);
      rankTotal += Number(result.rankPosition ?? result.rank);
      rankCounts[result.rank - 1] += 1;
    });

    return {
      ...player,
      index,
      gameCount,
      totalPt: round1(totalPt),
      averagePt: gameCount ? round1(totalPt / gameCount) : 0,
      averageRank: gameCount ? round1(rankTotal / gameCount) : 0,
      rankCounts,
      rankRates: rankCounts.map((count) =>
        gameCount ? round1((count / gameCount) * 100) : 0,
      ),
    };
  });
}

export function getSeries(tournament) {
  const running = [0, 0, 0, 0];
  const series = tournament.players.map((player, index) => ({
    name: player.name,
    index,
    values: [0],
  }));
  tournament.games.forEach((game) => {
    game.results.forEach((result, index) => {
      running[index] = round1(running[index] + Number(result.finalPt));
      series[index].values.push(running[index]);
    });
  });
  return series;
}

export function formatPt(value, showPlus = true) {
  const number = Math.abs(Number(value)) < 0.000001 ? 0 : Number(value);
  const prefix = showPlus && number > 0 ? "+" : "";
  return `${prefix}${number.toFixed(1)}`;
}

export function formatScore(value) {
  return `${Number(value).toLocaleString("ja-JP")}点`;
}
