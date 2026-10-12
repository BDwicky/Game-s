<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");

$dbPath = __DIR__ . "/../data/leaderboard.sqlite";

try {
    $pdo = new PDO("sqlite:" . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Initialize table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL COLLATE NOCASE,
            best_score INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard (best_score DESC, updated_at ASC);
    ");
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Database connection failed"]);
    exit;
}

function sanitizeUsername($raw) {
    if (!is_string($raw)) return null;
    $trimmed = trim($raw);
    if (strlen($trimmed) < 2 || strlen($trimmed) > 20) {
        return null;
    }
    // Allow alphanumeric, spaces, underscore, hyphen
    if (!preg_match("/^[a-zA-Z0-9_\-\. ]+$/", $trimmed)) {
        return null;
    }
    return $trimmed;
}

function getLeaderboardData($pdo, $currentUsername = null) {
    $stmt = $pdo->query("
        SELECT username, best_score, updated_at 
        FROM leaderboard 
        ORDER BY best_score DESC, updated_at ASC 
        LIMIT 25
    ");
    $rawList = $stmt->fetchAll();
    $leaderboard = [];
    $rank = 1;
    foreach ($rawList as $row) {
        $leaderboard[] = [
            "rank" => $rank++,
            "username" => htmlspecialchars($row["username"], ENT_QUOTES, "UTF-8"),
            "best_score" => (int)$row["best_score"],
            "updated_at" => $row["updated_at"]
        ];
    }

    $player = null;
    if ($currentUsername) {
        $stmtUser = $pdo->prepare("SELECT username, best_score FROM leaderboard WHERE username = :u COLLATE NOCASE LIMIT 1");
        $stmtUser->execute([":u" => $currentUsername]);
        $userData = $stmtUser->fetch();
        if ($userData) {
            $stmtRank = $pdo->prepare("SELECT COUNT(*) + 1 AS player_rank FROM leaderboard WHERE best_score > :s");
            $stmtRank->execute([":s" => $userData["best_score"]]);
            $rankRow = $stmtRank->fetch();
            $player = [
                "username" => $userData["username"],
                "best_score" => (int)$userData["best_score"],
                "rank" => (int)$rankRow["player_rank"]
            ];
        }
    }

    return ["leaderboard" => $leaderboard, "player" => $player];
}

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    $username = isset($_GET["username"]) ? sanitizeUsername($_GET["username"]) : null;
    $data = getLeaderboardData($pdo, $username);
    echo json_encode(array_merge(["status" => "success"], $data));
    exit;
}

if ($method === "POST") {
    $rawInput = file_get_contents("php://input");
    $body = json_decode($rawInput, true);

    if (!$body || !isset($body["username"])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Format input tidak valid"]);
        exit;
    }

    $username = sanitizeUsername($body["username"]);
    if (!$username) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Username harus 2-20 karakter (huruf, angka, spasi, _ - .)"]);
        exit;
    }

    $score = isset($body["score"]) ? (int)$body["score"] : 0;
    if ($score < 0 || $score > 10000000) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Skor tidak valid"]);
        exit;
    }

    // Check existing
    $stmtCheck = $pdo->prepare("SELECT id, best_score FROM leaderboard WHERE username = :u COLLATE NOCASE LIMIT 1");
    $stmtCheck->execute([":u" => $username]);
    $existing = $stmtCheck->fetch();

    $updated = false;
    if ($existing) {
        if ($score > (int)$existing["best_score"]) {
            $stmtUpd = $pdo->prepare("
                UPDATE leaderboard 
                SET best_score = :s, updated_at = CURRENT_TIMESTAMP 
                WHERE id = :id
            ");
            $stmtUpd->execute([":s" => $score, ":id" => $existing["id"]]);
            $updated = true;
        }
    } else {
        $stmtIns = $pdo->prepare("
            INSERT INTO leaderboard (username, best_score) 
            VALUES (:u, :s)
        ");
        $stmtIns->execute([":u" => $username, ":s" => $score]);
        $updated = true;
    }

    $data = getLeaderboardData($pdo, $username);
    echo json_encode(array_merge([
        "status" => "success",
        "updated" => $updated
    ], $data));
    exit;
}

http_response_code(405);
echo json_encode(["status" => "error", "message" => "Metode tidak diizinkan"]);
