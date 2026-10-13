<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-cache, no-store, must-revalidate");

$dbPath = __DIR__ . "/../data/leaderboard.sqlite";

try {
    $pdo = new PDO("sqlite:" . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Create users table if not exists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            pin_hash TEXT NOT NULL,
            avatar TEXT DEFAULT '',
            session_token TEXT DEFAULT '',
            last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_session ON users (session_token);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
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
    if (!preg_match("/^[a-zA-Z0-9_\-\. ]+$/", $trimmed)) {
        return null;
    }
    return $trimmed;
}

function validatePin($raw) {
    if (!is_string($raw) && !is_numeric($raw)) return false;
    $str = trim((string)$raw);
    return preg_match('/^[0-9]{6}$/', $str) ? $str : false;
}

function getBearerOrCookieToken() {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
        return trim($matches[1]);
    }
    if (!empty($_COOKIE['game_hub_token'])) {
        return trim($_COOKIE['game_hub_token']);
    }
    return null;
}

function setSessionCookie($token, $expiresInSeconds = 2592000) {
    $expires = $token ? (time() + $expiresInSeconds) : (time() - 3600);
    setcookie('game_hub_token', $token ?: '', [
        'expires' => $expires,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
}

$rawInput = file_get_contents("php://input");
$body = json_decode($rawInput, true);
if (!is_array($body)) {
    $body = [];
}

$action = $_GET['action'] ?? $body['action'] ?? '';

try {
switch ($action) {
    case 'check_user':
        $rawUser = $body['username'] ?? $_GET['username'] ?? '';
        $username = sanitizeUsername($rawUser);
        if (!$username) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Username tidak valid (2-20 karakter)."]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, username, avatar FROM users WHERE username = :u COLLATE NOCASE LIMIT 1");
        $stmt->execute([':u' => $username]);
        $user = $stmt->fetch();

        if ($user) {
            echo json_encode([
                "status" => "success",
                "exists" => true,
                "username" => $user['username'],
                "avatar" => (string)($user['avatar'] ?? '')
            ]);
        } else {
            $stmtAv = $pdo->prepare("SELECT avatar FROM leaderboard WHERE username = :u COLLATE NOCASE AND avatar != '' LIMIT 1");
            $stmtAv->execute([':u' => $username]);
            $prevAv = $stmtAv->fetch();
            $suggestedAvatar = $prevAv ? (string)$prevAv['avatar'] : '';

            echo json_encode([
                "status" => "success",
                "exists" => false,
                "username" => $username,
                "suggested_avatar" => $suggestedAvatar
            ]);
        }
        break;

    case 'register':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(["status" => "error", "message" => "Method not allowed"]);
            exit;
        }

        $username = sanitizeUsername($body['username'] ?? '');
        if (!$username) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Username harus 2-20 karakter (alfanumerik, spasi, _ - .)"]);
            exit;
        }

        $pin = validatePin($body['pin'] ?? '');
        if (!$pin) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "PIN keamanan harus terdiri dari tepat 6 digit angka."]);
            exit;
        }

        $stmtCheck = $pdo->prepare("SELECT id FROM users WHERE username = :u COLLATE NOCASE LIMIT 1");
        $stmtCheck->execute([':u' => $username]);
        if ($stmtCheck->fetch()) {
            http_response_code(409);
            echo json_encode(["status" => "error", "message" => "Username sudah terdaftar. Silakan masukkan PIN 6 digit Anda."]);
            exit;
        }

        $avatar = '';
        if (isset($body['avatar']) && is_string($body['avatar']) && strlen(trim($body['avatar'])) <= 200000) {
            $avatar = trim($body['avatar']);
        }

        $pinHash = password_hash($pin, PASSWORD_DEFAULT);
        $token = bin2hex(random_bytes(32));

        $stmtInsert = $pdo->prepare("
            INSERT INTO users (username, pin_hash, avatar, session_token, last_login, created_at, updated_at)
            VALUES (:u, :p, :a, :t, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $stmtInsert->execute([
            ':u' => $username,
            ':p' => $pinHash,
            ':a' => $avatar,
            ':t' => $token
        ]);

        if ($avatar) {
            $stmtSync = $pdo->prepare("UPDATE leaderboard SET avatar = :a WHERE username = :u COLLATE NOCASE");
            $stmtSync->execute([':a' => $avatar, ':u' => $username]);
        }

        setSessionCookie($token);

        echo json_encode([
            "status" => "success",
            "message" => "Registrasi berhasil.",
            "token" => $token,
            "user" => [
                "username" => $username,
                "avatar" => $avatar
            ]
        ]);
        break;

    case 'login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(["status" => "error", "message" => "Method not allowed"]);
            exit;
        }

        $username = sanitizeUsername($body['username'] ?? '');
        if (!$username) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Username tidak valid."]);
            exit;
        }

        $pin = validatePin($body['pin'] ?? '');
        if (!$pin) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "PIN keamanan harus 6 digit angka."]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, username, pin_hash, avatar FROM users WHERE username = :u COLLATE NOCASE LIMIT 1");
        $stmt->execute([':u' => $username]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Username belum terdaftar. Silakan buat akun baru."]);
            exit;
        }

        if (!password_verify($pin, $user['pin_hash'])) {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "PIN keamanan salah. Silakan coba lagi."]);
            exit;
        }

        $token = bin2hex(random_bytes(32));
        $stmtUp = $pdo->prepare("UPDATE users SET session_token = :t, last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
        $stmtUp->execute([':t' => $token, ':id' => $user['id']]);

        setSessionCookie($token);

        echo json_encode([
            "status" => "success",
            "message" => "Login berhasil.",
            "token" => $token,
            "user" => [
                "username" => $user['username'],
                "avatar" => (string)($user['avatar'] ?? '')
            ]
        ]);
        break;

    case 'verify':
        $token = $body['token'] ?? $_GET['token'] ?? getBearerOrCookieToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode(["status" => "error", "authenticated" => false, "message" => "Tidak ada sesi aktif."]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, username, avatar FROM users WHERE session_token = :t AND session_token != '' LIMIT 1");
        $stmt->execute([':t' => $token]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(401);
            echo json_encode(["status" => "error", "authenticated" => false, "message" => "Sesi kedaluwarsa atau tidak valid."]);
            exit;
        }

        echo json_encode([
            "status" => "success",
            "authenticated" => true,
            "user" => [
                "username" => $user['username'],
                "avatar" => (string)($user['avatar'] ?? '')
            ]
        ]);
        break;

    case 'update_profile':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(["status" => "error", "message" => "Method not allowed"]);
            exit;
        }

        $token = $body['token'] ?? getBearerOrCookieToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "Autentikasi diperlukan."]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, username, pin_hash, avatar FROM users WHERE session_token = :t AND session_token != '' LIMIT 1");
        $stmt->execute([':t' => $token]);
        $user = $stmt->fetch();
        if (!$user) {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "Sesi tidak valid."]);
            exit;
        }

        $newUsername = isset($body['username']) ? sanitizeUsername($body['username']) : null;
        $newAvatar = isset($body['avatar']) ? (string)$body['avatar'] : null;
        $removeAvatar = !empty($body['remove_avatar']);
        $oldPin = $body['old_pin'] ?? null;
        $newPin = $body['new_pin'] ?? null;

        $targetUsername = $user['username'];
        $targetAvatar = (string)($user['avatar'] ?? '');

        if ($newUsername && strcasecmp($newUsername, $user['username']) !== 0) {
            $stmtEx = $pdo->prepare("SELECT id FROM users WHERE username = :u COLLATE NOCASE AND id != :id LIMIT 1");
            $stmtEx->execute([':u' => $newUsername, ':id' => $user['id']]);
            if ($stmtEx->fetch()) {
                http_response_code(409);
                echo json_encode(["status" => "error", "message" => "Username baru sudah digunakan oleh pemain lain."]);
                exit;
            }
            $targetUsername = $newUsername;
            $stmtLdb = $pdo->prepare("UPDATE leaderboard SET username = :new WHERE username = :old COLLATE NOCASE");
            $stmtLdb->execute([':new' => $newUsername, ':old' => $user['username']]);
        }

        if ($removeAvatar) {
            $targetAvatar = '';
            $stmtLdbAv = $pdo->prepare("UPDATE leaderboard SET avatar = '' WHERE username = :u COLLATE NOCASE");
            $stmtLdbAv->execute([':u' => $targetUsername]);
        } elseif ($newAvatar !== null) {
            if (strlen($newAvatar) <= 200000) {
                $targetAvatar = $newAvatar;
                $stmtLdbAv = $pdo->prepare("UPDATE leaderboard SET avatar = :a WHERE username = :u COLLATE NOCASE");
                $stmtLdbAv->execute([':a' => $targetAvatar, ':u' => $targetUsername]);
            }
        }

        $targetPinHash = $user['pin_hash'];
        if ($newPin !== null) {
            if (!$oldPin || !password_verify((string)$oldPin, $user['pin_hash'])) {
                http_response_code(403);
                echo json_encode(["status" => "error", "message" => "PIN lama tidak sesuai."]);
                exit;
            }
            $validatedNewPin = validatePin($newPin);
            if (!$validatedNewPin) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "PIN baru harus 6 digit angka numerik."]);
                exit;
            }
            $targetPinHash = password_hash($validatedNewPin, PASSWORD_DEFAULT);
        }

        $stmtSave = $pdo->prepare("
            UPDATE users 
            SET username = :u, avatar = :a, pin_hash = :p, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $stmtSave->execute([
            ':u' => $targetUsername,
            ':a' => $targetAvatar,
            ':p' => $targetPinHash,
            ':id' => $user['id']
        ]);

        echo json_encode([
            "status" => "success",
            "message" => "Profil berhasil diperbarui.",
            "user" => [
                "username" => $targetUsername,
                "avatar" => $targetAvatar
            ]
        ]);
        break;

    case 'logout':
        $token = $body['token'] ?? getBearerOrCookieToken();
        if ($token) {
            $stmt = $pdo->prepare("UPDATE users SET session_token = '' WHERE session_token = :t");
            $stmt->execute([':t' => $token]);
        }
        setSessionCookie('');
        echo json_encode(["status" => "success", "message" => "Berhasil logout."]);
        break;

    default:
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Aksi tidak dikenali."]);
        break;
}
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Terjadi kesalahan server: " . $e->getMessage()]);
    exit;
}
