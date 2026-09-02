// ============================================
// ABJAD Scoring Calculator
// Standalone script for analyzing puzzles,
// generating leaderboards, and scoring words.
//
// Can be run in Node.js or loaded in the browser.
// ============================================

// ── SCORING RUBRIC ──────────────────────────
//
//   Roots matched    Multiplier    Example
//   ─────────────    ──────────    ────────────────────────
//   3 of 3           × 3          SKELETON (8 letters) = 24 pts
//   2 of 3           × 1.5        SPOKEN   (6 letters) = 9 pts
//   1 of 3           × 1          STINK    (5 letters) = 5 pts
//   0 of 3           invalid      —
//
//   Minimum word length: 3 letters
//   Score = word_length × multiplier (rounded)

function calculateScore(wordLength, rootsMatched) {
  if (rootsMatched === 0 || wordLength < 3) return 0;
  var multiplier = rootsMatched === 3 ? 3 : rootsMatched === 2 ? 1.5 : 1;
  return Math.round(wordLength * multiplier);
}

// Score a specific word against specific roots
function scoreSubmission(word, roots) {
  var upper = word.toUpperCase();
  var matched = [];
  for (var i = 0; i < roots.length; i++) {
    if (upper.indexOf(roots[i].toUpperCase()) !== -1) {
      matched.push(roots[i].toUpperCase());
    }
  }
  var multiplier = matched.length === 3 ? 3 : matched.length === 2 ? 1.5 : matched.length === 1 ? 1 : 0;
  var score = Math.round(upper.length * multiplier);

  return {
    word: upper,
    length: upper.length,
    roots: roots.map(function(r) { return r.toUpperCase(); }),
    matched: matched,
    rootsHit: matched.length,
    allThree: matched.length === 3,
    multiplier: multiplier,
    score: score,
    display: upper + " → " + score + " pts (" + matched.length + "/3 roots, ×" + multiplier + ")"
  };
}


// ── PUZZLE ANALYSIS ─────────────────────────
// Given a dictionary (array of words) and roots,
// find every valid word and rank them.

function analyzePuzzle(dictionary, roots) {
  var upperRoots = roots.map(function(r) { return r.toUpperCase(); });
  var results = { threeRoots: [], twoRoots: [], oneRoot: [] };
  var allScored = [];

  for (var i = 0; i < dictionary.length; i++) {
    var word = dictionary[i].toUpperCase().trim();
    if (word.length < 3) continue;

    var matched = [];
    for (var j = 0; j < upperRoots.length; j++) {
      if (word.indexOf(upperRoots[j]) !== -1) {
        matched.push(upperRoots[j]);
      }
    }
    if (matched.length === 0) continue;

    var multiplier = matched.length === 3 ? 3 : matched.length === 2 ? 1.5 : 1;
    var entry = {
      word: word,
      length: word.length,
      matched: matched,
      rootsHit: matched.length,
      multiplier: multiplier,
      score: Math.round(word.length * multiplier)
    };

    allScored.push(entry);
    if (matched.length === 3) results.threeRoots.push(entry);
    else if (matched.length === 2) results.twoRoots.push(entry);
    else results.oneRoot.push(entry);
  }

  // Sort each bucket by score descending, then word length
  var sortFn = function(a, b) { return b.score - a.score || b.length - a.length; };
  results.threeRoots.sort(sortFn);
  results.twoRoots.sort(sortFn);
  results.oneRoot.sort(sortFn);
  allScored.sort(sortFn);

  return {
    roots: upperRoots,
    totalValidWords: allScored.length,
    threeRootWords: results.threeRoots.length,
    twoRootWords: results.twoRoots.length,
    oneRootWords: results.oneRoot.length,
    bestWord: allScored.length > 0 ? allScored[0] : null,
    bestThreeRoot: results.threeRoots.length > 0 ? results.threeRoots[0] : null,
    top10: allScored.slice(0, 10),
    top10ThreeRoot: results.threeRoots.slice(0, 10),
    all: allScored
  };
}


// ── LEADERBOARD GENERATION ──────────────────
// Build a mock leaderboard from actual valid words,
// seeded by puzzle number for consistency.

function seededRandom(seed) {
  var s = seed;
  return function() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function generateLeaderboard(analysis, puzzleNum, count) {
  count = count || 15;
  var r = seededRandom(puzzleNum * 3571);

  // Pull from three-root words first, then two-root
  var pool = analysis.threeRootWords > 0
    ? analysis.top10ThreeRoot.concat(analysis.twoRootWords > 0 ? analysis.all.filter(function(e) { return e.rootsHit === 2; }).slice(0, 5) : [])
    : analysis.all.slice(0, 20);

  // Shuffle using seed
  var shuffled = pool.slice();
  for (var i = shuffled.length - 1; i > 0; i--) {
    var j = Math.floor(r() * (i + 1));
    var temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  // Take top N, assign fake percentages
  var board = shuffled.slice(0, count).map(function(entry, idx) {
    return {
      rank: idx + 1,
      word: entry.word,
      score: entry.score,
      rootsHit: entry.rootsHit,
      pct: +(0.1 + r() * (idx < 3 ? 3 : idx < 8 ? 10 : 25)).toFixed(1)
    };
  });

  // Re-sort by score
  board.sort(function(a, b) { return b.score - a.score; });
  board.forEach(function(entry, idx) { entry.rank = idx + 1; });

  return board;
}

// Insert a player's result into the leaderboard
function insertPlayerIntoLeaderboard(board, playerResult) {
  var entry = {
    word: playerResult.word,
    score: playerResult.score,
    rootsHit: playerResult.rootsHit,
    pct: +(Math.random() * 5 + 0.3).toFixed(1),
    isPlayer: true
  };

  // Check if word already exists
  var exists = board.find(function(e) { return e.word === entry.word; });
  if (exists) {
    exists.isPlayer = true;
    return board;
  }

  board.push(entry);
  board.sort(function(a, b) { return b.score - a.score; });
  board.forEach(function(e, i) { e.rank = i + 1; });
  return board;
}


// ── SHARE TEXT ───────────────────────────────

function formatShareText(puzzleNum, result, timeUsed, url) {
  if (!result) return "";
  var rootsEmoji = result.allThree ? "🟩🟩🟩"
    : result.rootsHit === 2 ? "🟩🟩⬜"
    : "🟩⬜⬜";

  var lines = [
    "ABJAD #" + puzzleNum + " — " + result.score + " pts " + rootsEmoji,
    result.length + " letters · " + result.rootsHit + "/3 roots · " + timeUsed + "s"
  ];
  if (url) lines.push(url);
  return lines.join("\n");
}


// ── SCORE TABLE (reference) ─────────────────
// Print a reference table of scores by word length and roots matched

function printScoreTable() {
  var header = "Length  |  1 root  |  2 roots  |  3 roots";
  var divider = "--------|----------|-----------|----------";
  var rows = [header, divider];
  for (var len = 3; len <= 15; len++) {
    rows.push(
      "  " + (len < 10 ? " " : "") + len + "    |    " +
      (len < 10 ? " " : "") + calculateScore(len, 1) + "    |    " +
      (calculateScore(len, 2) < 10 ? " " : "") + calculateScore(len, 2) + "     |    " +
      (calculateScore(len, 3) < 10 ? " " : "") + calculateScore(len, 3)
    );
  }
  return rows.join("\n");
}


// ── NODE.JS CLI ─────────────────────────────
// If run directly with Node, analyze a puzzle from command line
// Usage: node scoring.js E N K
//    or: node scoring.js E N K --dict dictionary.txt

if (typeof process !== "undefined" && process.argv && process.argv[1] && process.argv[1].indexOf("scoring") !== -1) {
  var args = process.argv.slice(2);
  var dictFlag = args.indexOf("--dict");
  var dictPath = "dictionary.txt";
  if (dictFlag !== -1 && args[dictFlag + 1]) {
    dictPath = args[dictFlag + 1];
    args.splice(dictFlag, 2);
  }

  var roots = args.slice(0, 3).map(function(r) { return r.toUpperCase(); });

  if (roots.length < 3) {
    console.log("Usage: node scoring.js E N K [--dict path/to/dictionary.txt]");
    console.log("");
    console.log("Score reference table:");
    console.log(printScoreTable());
    process.exit(0);
  }

  var fs = require("fs");
  try {
    var dictText = fs.readFileSync(dictPath, "utf-8");
    var dictionary = dictText.split("\n").map(function(w) { return w.trim(); }).filter(function(w) { return w.length >= 3; });
    console.log("Dictionary: " + dictionary.length + " words");
    console.log("Roots: " + roots.join(", "));
    console.log("");

    var analysis = analyzePuzzle(dictionary, roots);

    console.log("Total valid words: " + analysis.totalValidWords);
    console.log("  3-root words: " + analysis.threeRootWords);
    console.log("  2-root words: " + analysis.twoRootWords);
    console.log("  1-root words: " + analysis.oneRootWords);
    console.log("");

    if (analysis.bestWord) {
      console.log("Best overall: " + analysis.bestWord.word + " (" + analysis.bestWord.score + " pts, " + analysis.bestWord.rootsHit + "/3 roots)");
    }
    if (analysis.bestThreeRoot) {
      console.log("Best 3-root:  " + analysis.bestThreeRoot.word + " (" + analysis.bestThreeRoot.score + " pts)");
    }
    console.log("");

    console.log("Top 10:");
    analysis.top10.forEach(function(e, i) {
      console.log("  " + (i + 1) + ". " + e.word + " — " + e.score + " pts (" + e.rootsHit + "/3, " + e.length + " letters)");
    });

    console.log("");
    console.log("Score table:");
    console.log(printScoreTable());

  } catch (e) {
    console.error("Error: " + e.message);
    console.log("Make sure dictionary.txt is in the current directory or use --dict flag");
  }
}


// ── EXPORTS ─────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calculateScore: calculateScore,
    scoreSubmission: scoreSubmission,
    analyzePuzzle: analyzePuzzle,
    generateLeaderboard: generateLeaderboard,
    insertPlayerIntoLeaderboard: insertPlayerIntoLeaderboard,
    formatShareText: formatShareText,
    printScoreTable: printScoreTable
  };
}
