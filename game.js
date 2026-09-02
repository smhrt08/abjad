// ============================================
// ABJAD Game Engine
// Add to your GitHub repo alongside dictionary.txt
// and puzzles_compact.json
// ============================================

// ── DICTIONARY ──────────────────────────────

let DICTIONARY = null; // Set of uppercase words

async function loadDictionary(path) {
  path = path || "dictionary.txt";
  const resp = await fetch(path);
  if (!resp.ok) throw new Error("Dictionary not found at " + path);
  const text = await resp.text();
  const words = text
    .split("\n")
    .map(function (w) { return w.trim().toUpperCase(); })
    .filter(function (w) { return w.length >= 3; });
  DICTIONARY = new Set(words);
  console.log("ABJAD: Dictionary loaded — " + DICTIONARY.size + " words");
  return DICTIONARY;
}

function isDictionaryLoaded() {
  return DICTIONARY !== null && DICTIONARY.size > 0;
}

function isValidWord(word) {
  if (!DICTIONARY) return false;
  return DICTIONARY.has(word.toUpperCase());
}


// ── SCORING ─────────────────────────────────

// Roots: the 3 letters for today's puzzle (uppercase)
// Word:  the player's submitted word (any case)
//
// Scoring rubric:
//   3 of 3 roots matched → word length × 3
//   2 of 3 roots matched → word length × 1.5
//   1 of 3 roots matched → word length × 1
//   0 roots matched      → invalid submission

function scoreWord(word, roots) {
  var upper = word.toUpperCase();

  // Must be at least 3 letters
  if (upper.length < 3) {
    return { valid: false, reason: "Too short", score: 0, matched: [], multiplier: 0 };
  }

  // Must be in the dictionary
  if (!isValidWord(upper)) {
    return { valid: false, reason: "Not a valid word", score: 0, matched: [], multiplier: 0 };
  }

  // Check which roots appear in the word
  var matched = roots.filter(function (r) {
    return upper.indexOf(r.toUpperCase()) !== -1;
  });

  if (matched.length === 0) {
    return { valid: false, reason: "Must use at least one root letter", score: 0, matched: [], multiplier: 0 };
  }

  // Calculate score
  var multiplier = matched.length === 3 ? 3 : matched.length === 2 ? 1.5 : 1;
  var score = Math.round(upper.length * multiplier);

  return {
    valid: true,
    reason: null,
    word: upper,
    length: upper.length,
    matched: matched,
    rootsHit: matched.length,
    allThree: matched.length === 3,
    multiplier: multiplier,
    score: score
  };
}


// ── DAILY PUZZLE ─────────────────────────────

// Letter tiers based on English frequency
var TIER1 = ["E","T","A","O","I","N","S"];       // common
var TIER2 = ["R","H","D","L","C","U","M","W","F"]; // mid
var TIER3 = ["G","Y","P","B","V","K","J","X","Q","Z"]; // rare

// Seeded PRNG for deterministic puzzle generation
function seededRandom(seed) {
  var s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Puzzle number: days since launch
function getPuzzleNumber(launchDate) {
  var launch = new Date(launchDate || "2026-10-01T00:00:00");
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - launch) / 86400000) + 1;
}

// Generate a puzzle from the puzzle number (fallback if JSON not available)
function generatePuzzleFromNumber(num) {
  var r = seededRandom(num * 7919 + 1337);
  var pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
  return {
    num: num,
    roots: [pick(TIER1), pick(TIER2), pick(TIER3)]
  };
}

// Load puzzles from pre-generated JSON
var PUZZLES = null;

async function loadPuzzles(path) {
  path = path || "puzzles_compact.json";
  try {
    var resp = await fetch(path);
    if (!resp.ok) throw new Error();
    PUZZLES = await resp.json();
    console.log("ABJAD: Puzzles loaded — " + PUZZLES.length + " puzzles");
  } catch (e) {
    console.warn("ABJAD: puzzles_compact.json not found, using generated puzzles");
    PUZZLES = null;
  }
}

function getTodaysPuzzle(launchDate) {
  var num = getPuzzleNumber(launchDate);
  if (PUZZLES) {
    var found = PUZZLES.find(function (p) { return p.id === num; });
    if (found) return { num: num, roots: found.letters, date: found.date };
  }
  var generated = generatePuzzleFromNumber(num);
  return { num: generated.num, roots: generated.roots, date: null };
}


// ── LOCAL STORAGE (player state) ─────────────

function getTodayKey() {
  var d = new Date();
  return "abjad-" + d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function loadTodaysResult() {
  try {
    var raw = localStorage.getItem(getTodayKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveTodaysResult(result, timeUsed) {
  try {
    localStorage.setItem(getTodayKey(), JSON.stringify({
      completed: true,
      result: result,
      timeUsed: timeUsed,
      solvedAt: Date.now()
    }));
  } catch (e) {}
}

function hasPlayedToday() {
  var saved = loadTodaysResult();
  return saved !== null && saved.completed === true;
}


// ── STATS ────────────────────────────────────

function loadStats() {
  try {
    var raw = localStorage.getItem("abjad-stats");
    return raw ? JSON.parse(raw) : { played: 0, totalScore: 0, bestScore: 0, streak: 0, maxStreak: 0 };
  } catch (e) {
    return { played: 0, totalScore: 0, bestScore: 0, streak: 0, maxStreak: 0 };
  }
}

function saveStats(stats) {
  try { localStorage.setItem("abjad-stats", JSON.stringify(stats)); } catch (e) {}
}

function recordResult(result) {
  var stats = loadStats();
  stats.played++;
  if (result && result.score) {
    stats.totalScore += result.score;
    if (result.score > stats.bestScore) stats.bestScore = result.score;
    stats.streak++;
    if (stats.streak > stats.maxStreak) stats.maxStreak = stats.streak;
  } else {
    stats.streak = 0;
  }
  saveStats(stats);
  return stats;
}


// ── SHARE TEXT ───────────────────────────────

function generateShareText(puzzleNum, result, timeUsed) {
  if (!result) return "";
  var rootsEmoji = result.allThree ? "🟩🟩🟩" : result.rootsHit === 2 ? "🟩🟩⬜" : "🟩⬜⬜";
  return "ABJAD #" + puzzleNum + " — " + result.score + " pts " + rootsEmoji + "\n"
    + result.length + " letters · " + result.rootsHit + "/3 roots · " + timeUsed + "s";
}


// ── LEADERBOARD HELPERS ──────────────────────

// Find all valid words for a given set of roots
// Returns sorted array: longest/highest-scoring first
function findAllValidWords(roots, minLength) {
  minLength = minLength || 3;
  if (!DICTIONARY) return [];

  var results = [];
  DICTIONARY.forEach(function (word) {
    if (word.length < minLength) return;
    var matched = roots.filter(function (r) { return word.indexOf(r) !== -1; });
    if (matched.length === 0) return;
    var multiplier = matched.length === 3 ? 3 : matched.length === 2 ? 1.5 : 1;
    results.push({
      word: word,
      length: word.length,
      matched: matched,
      rootsHit: matched.length,
      allThree: matched.length === 3,
      multiplier: multiplier,
      score: Math.round(word.length * multiplier)
    });
  });

  results.sort(function (a, b) { return b.score - a.score || b.length - a.length; });
  return results;
}

// Get the top N words for a puzzle (for the leaderboard display)
function getTopWords(roots, n) {
  n = n || 20;
  var all = findAllValidWords(roots, 3);
  return all.slice(0, n);
}

// Get the single best possible word for a puzzle
function getBestPossibleWord(roots) {
  var all = findAllValidWords(roots, 3);
  return all.length > 0 ? all[0] : null;
}


// ── INIT ─────────────────────────────────────

// Call this on page load to set everything up
// Returns a promise that resolves with today's puzzle
async function initGame(options) {
  options = options || {};
  var dictPath = options.dictionaryPath || "dictionary.txt";
  var puzzlePath = options.puzzlePath || "puzzles_compact.json";
  var launchDate = options.launchDate || "2026-10-01T00:00:00";

  await Promise.all([
    loadDictionary(dictPath),
    loadPuzzles(puzzlePath)
  ]);

  var puzzle = getTodaysPuzzle(launchDate);
  var played = hasPlayedToday();
  var savedResult = loadTodaysResult();
  var stats = loadStats();

  return {
    puzzle: puzzle,
    alreadyPlayed: played,
    savedResult: savedResult,
    stats: stats
  };
}


// ── EXPORTS ──────────────────────────────────
// If using as a module, export everything.
// If using as a plain script tag, everything is global.

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    loadDictionary: loadDictionary,
    isDictionaryLoaded: isDictionaryLoaded,
    isValidWord: isValidWord,
    scoreWord: scoreWord,
    getPuzzleNumber: getPuzzleNumber,
    getTodaysPuzzle: getTodaysPuzzle,
    loadPuzzles: loadPuzzles,
    loadTodaysResult: loadTodaysResult,
    saveTodaysResult: saveTodaysResult,
    hasPlayedToday: hasPlayedToday,
    loadStats: loadStats,
    saveStats: saveStats,
    recordResult: recordResult,
    generateShareText: generateShareText,
    findAllValidWords: findAllValidWords,
    getTopWords: getTopWords,
    getBestPossibleWord: getBestPossibleWord,
    initGame: initGame
  };
}
