<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");

$dbPath = __DIR__ . "/../data/leaderboard.sqlite";

try {
    $pdo = new PDO("sqlite:" . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Initialize table with multi-game composite constraint
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS leaderboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game TEXT NOT NULL DEFAULT '2048',
            username TEXT NOT NULL COLLATE NOCASE,
            best_score INTEGER NOT NULL DEFAULT 0,
            avatar TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(game, username)
        );
        CREATE INDEX IF NOT EXISTS idx_leaderboard_game_score ON leaderboard (game, best_score DESC, updated_at ASC);
    ");

    // Migration: If table was created with old single UNIQUE(username) constraint, upgrade cleanly
    $tableSql = (string)$pdo->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='leaderboard'")->fetchColumn();
    if ($tableSql && (stripos($tableSql, "username TEXT UNIQUE") !== false || stripos($tableSql, "UNIQUE (username)") !== false)) {
        $pdo->exec("
            CREATE TABLE leaderboard_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game TEXT NOT NULL DEFAULT '2048',
                username TEXT NOT NULL COLLATE NOCASE,
                best_score INTEGER NOT NULL DEFAULT 0,
                avatar TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(game, username)
            );
            INSERT OR IGNORE INTO leaderboard_v2 (id, game, username, best_score, avatar, created_at, updated_at)
            SELECT id, COALESCE(game, '2048'), username, best_score, COALESCE(avatar, ''), created_at, updated_at
            FROM leaderboard;
            DROP TABLE leaderboard;
            ALTER TABLE leaderboard_v2 RENAME TO leaderboard;
            CREATE INDEX IF NOT EXISTS idx_leaderboard_game_score ON leaderboard (game, best_score DESC, updated_at ASC);
        ");
    }
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

function sanitizeGame($raw) {
    if (!is_string($raw)) return "2048";
    $trimmed = strtolower(trim($raw));
    $allowed = ["2048", "memory", "pacman", "xox", "flappy"];
    return in_array($trimmed, $allowed, true) ? $trimmed : "2048";
}

function getLeaderboardData($pdo, $currentUsername = null, $game = "2048") {
    $stmt = $pdo->prepare("
        SELECT username, best_score, avatar, updated_at 
        FROM leaderboard 
        WHERE game = :g
        ORDER BY best_score DESC, updated_at ASC 
        LIMIT 25
    ");
    $stmt->execute([":g" => $game]);
    $rawList = $stmt->fetchAll();
    $leaderboard = [];
    $rank = 1;
    foreach ($rawList as $row) {
        $leaderboard[] = [
            "rank" => $rank++,
            "username" => htmlspecialchars($row["username"], ENT_QUOTES, "UTF-8"),
            "best_score" => (int)$row["best_score"],
            "avatar" => !empty($row["avatar"]) ? (string)$row["avatar"] : "",
            "updated_at" => $row["updated_at"]
        ];
    }

    $player = null;
    if ($currentUsername) {
        $stmtUser = $pdo->prepare("SELECT username, best_score, avatar FROM leaderboard WHERE game = :g AND username = :u COLLATE NOCASE LIMIT 1");
        $stmtUser->execute([":g" => $game, ":u" => $currentUsername]);
        $userData = $stmtUser->fetch();
        if ($userData) {
            $stmtRank = $pdo->prepare("SELECT COUNT(*) + 1 AS player_rank FROM leaderboard WHERE game = :g AND best_score > :s");
            $stmtRank->execute([":g" => $game, ":s" => $userData["best_score"]]);
            $rankRow = $stmtRank->fetch();
            $player = [
                "username" => $userData["username"],
                "best_score" => (int)$userData["best_score"],
                "avatar" => !empty($userData["avatar"]) ? (string)$userData["avatar"] : "",
                "rank" => (int)$rankRow["player_rank"]
            ];
        } else {
            // Find avatar from player in any game to preserve their photo
            $stmtAv = $pdo->prepare("SELECT avatar FROM leaderboard WHERE username = :u COLLATE NOCASE AND avatar != '' LIMIT 1");
            $stmtAv->execute([":u" => $currentUsername]);
            $rowAv = $stmtAv->fetch();
            $prefillAvatar = $rowAv ? (string)$rowAv["avatar"] : "";
            $player = [
                "username" => $currentUsername,
                "best_score" => 0,
                "avatar" => $prefillAvatar,
                "rank" => "-"
            ];
        }
    }

    // Global best score across all players in this game
    $stmtGlobal = $pdo->prepare("SELECT MAX(best_score) AS global_best FROM leaderboard WHERE game = :g");
    $stmtGlobal->execute([":g" => $game]);
    $globalBestRow = $stmtGlobal->fetch();
    $globalBest = ($globalBestRow && $globalBestRow["global_best"] !== null) ? (int)$globalBestRow["global_best"] : 0;

    return [
        "game" => $game,
        "leaderboard" => $leaderboard,
        "player" => $player,
        "global_best_score" => $globalBest
    ];
}

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
    $game = isset($_GET["game"]) ? sanitizeGame($_GET["game"]) : "2048";
    $username = isset($_GET["username"]) ? sanitizeUsername($_GET["username"]) : null;
    $data = getLeaderboardData($pdo, $username, $game);
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

    $game = isset($body["game"]) ? sanitizeGame($body["game"]) : "2048";

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

    $oldUsername = isset($body["old_username"]) ? sanitizeUsername($body["old_username"]) : null;
    $removeAvatar = !empty($body["remove_avatar"]);

    $avatar = "";
    if (isset($body["avatar"]) && is_string($body["avatar"])) {
        $avatarVal = trim($body["avatar"]);
        if (strlen($avatarVal) <= 200000) {
            $avatar = $avatarVal;
        }
    }

    $updated = false;

    // 1. In-place Rename operation across games if old_username is provided
    if ($oldUsername && strcasecmp($oldUsername, $username) !== 0) {
        $stmtOld = $pdo->prepare("SELECT id, best_score, avatar FROM leaderboard WHERE game = :g AND username = :u COLLATE NOCASE LIMIT 1");
        $stmtOld->execute([":g" => $game, ":u" => $oldUsername]);
        $oldRow = $stmtOld->fetch();

        if ($oldRow) {
            // Check if target username already belongs to a different record in this game
            $stmtTaken = $pdo->prepare("SELECT id FROM leaderboard WHERE game = :g AND username = :u COLLATE NOCASE AND id != :id LIMIT 1");
            $stmtTaken->execute([":g" => $game, ":u" => $username, ":id" => $oldRow["id"]]);
            if ($stmtTaken->fetch()) {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "Username '$username' sudah digunakan oleh pemain lain."]);
                exit;
            }

            $newScore = max((int)$oldRow["best_score"], $score);
            if ($removeAvatar) {
                $newAvatar = "";
            } elseif (!empty($avatar)) {
                $newAvatar = $avatar;
            } else {
                $newAvatar = !empty($oldRow["avatar"]) ? $oldRow["avatar"] : "";
            }

            $stmtRename = $pdo->prepare("
                UPDATE leaderboard 
                SET username = :new_u, best_score = :s, avatar = :av, updated_at = CURRENT_TIMESTAMP 
                WHERE id = :id
            ");
            $stmtRename->execute([
                ":new_u" => $username,
                ":s"     => $newScore,
                ":av"    => $newAvatar,
                ":id"    => $oldRow["id"]
            ]);

            // Sync avatar & rename across other games for consistency
            $stmtSyncOther = $pdo->prepare("UPDATE leaderboard SET username = :new_u, avatar = :av WHERE username = :old_u COLLATE NOCASE");
            $stmtSyncOther->execute([":new_u" => $username, ":av" => $newAvatar, ":old_u" => $oldUsername]);

            $updated = true;
        }
    }

    // 2. Standard Upsert if not handled by rename
    if (!$updated) {
        $stmtCheck = $pdo->prepare("SELECT id, best_score, avatar FROM leaderboard WHERE game = :g AND username = :u COLLATE NOCASE LIMIT 1");
        $stmtCheck->execute([":g" => $game, ":u" => $username]);
        $existing = $stmtCheck->fetch();

        if ($existing) {
            $newScore = max((int)$existing["best_score"], $score);
            if ($removeAvatar) {
                $newAvatar = "";
            } elseif (!empty($avatar)) {
                $newAvatar = $avatar;
            } else {
                $newAvatar = !empty($existing["avatar"]) ? $existing["avatar"] : "";
            }

            $stmtUpd = $pdo->prepare("
                UPDATE leaderboard 
                SET best_score = :s, avatar = :av, updated_at = CURRENT_TIMESTAMP 
                WHERE id = :id
            ");
            $stmtUpd->execute([
                ":s"  => $newScore,
                ":av" => $newAvatar,
                ":id" => $existing["id"]
            ]);

            // Keep avatar synced across games
            if (!empty($avatar) || $removeAvatar) {
                $stmtSyncAv = $pdo->prepare("UPDATE leaderboard SET avatar = :av WHERE username = :u COLLATE NOCASE");
                $stmtSyncAv->execute([":av" => $newAvatar, ":u" => $username]);
            }

            $updated = true;
        } else {
            // Check if player already had an avatar from another game
            if (empty($avatar) && !$removeAvatar) {
                $stmtPrevAv = $pdo->prepare("SELECT avatar FROM leaderboard WHERE username = :u COLLATE NOCASE AND avatar != '' LIMIT 1");
                $stmtPrevAv->execute([":u" => $username]);
                $prevAvRow = $stmtPrevAv->fetch();
                if ($prevAvRow && !empty($prevAvRow["avatar"])) {
                    $avatar = $prevAvRow["avatar"];
                }
            }

            $newAvatar = $removeAvatar ? "" : $avatar;
            $stmtIns = $pdo->prepare("
                INSERT INTO leaderboard (game, username, best_score, avatar) 
                VALUES (:g, :u, :s, :av)
            ");
            $stmtIns->execute([
                ":g"  => $game,
                ":u"  => $username,
                ":s"  => $score,
                ":av" => $newAvatar
            ]);

            if (!empty($avatar)) {
                $stmtSyncAv = $pdo->prepare("UPDATE leaderboard SET avatar = :av WHERE username = :u COLLATE NOCASE");
                $stmtSyncAv->execute([":av" => $newAvatar, ":u" => $username]);
            }

            $updated = true;
        }
    }

    $data = getLeaderboardData($pdo, $username, $game);
    echo json_encode(array_merge([
        "status" => "success",
        "updated" => $updated
    ], $data));
    exit;
}

http_response_code(405);
echo json_encode(["status" => "error", "message" => "Metode tidak diizinkan"]);
