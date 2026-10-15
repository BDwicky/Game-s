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
            security_question TEXT DEFAULT '',
            security_answer_hash TEXT DEFAULT '',
            last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_session ON users (session_token);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
    ");

    // Auto-migrate existing database table if columns are missing
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN security_question TEXT DEFAULT ''");
    } catch (Exception $e) {}
    try {
        $pdo->exec("ALTER TABLE users ADD COLUMN security_answer_hash TEXT DEFAULT ''");
    } catch (Exception $e) {}

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

function normalizeSecurityAnswer($raw) {
    if (!is_string($raw) && !is_numeric($raw)) return null;
    $trimmed = trim((string)$raw);
    if (strlen($trimmed) < 2 || strlen($trimmed) > 100) return null;
    // Lowercase and collapse consecutive spaces
    $normalized = mb_strtolower($trimmed, 'UTF-8');
    $normalized = preg_replace('/\s+/', ' ', $normalized);
    return $normalized;
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

        $stmt = $pdo->prepare("SELECT id, username, avatar, security_question, security_answer_hash FROM users WHERE username = :u COLLATE NOCASE LIMIT 1");
        $stmt->execute([':u' => $username]);
        $user = $stmt->fetch();

        if ($user) {
            $hasSq = !empty($user['security_question']) && !empty($user['security_answer_hash']);
            echo json_encode([
                "status" => "success",
                "exists" => true,
                "username" => $user['username'],
                "avatar" => (string)($user['avatar'] ?? ''),
                "has_security_question" => $hasSq,
                "security_question" => $hasSq ? (string)$user['security_question'] : ''
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

    case 'get_security_question':
        $rawUser = $body['username'] ?? $_GET['username'] ?? '';
        $username = sanitizeUsername($rawUser);
        if (!$username) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Username tidak valid."]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, username, avatar, security_question, security_answer_hash FROM users WHERE username = :u COLLATE NOCASE LIMIT 1");
        $stmt->execute([':u' => $username]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Pemain tidak ditemukan."]);
            exit;
        }

        $hasSq = !empty($user['security_question']) && !empty($user['security_answer_hash']);
        echo json_encode([
            "status" => "success",
            "username" => $user['username'],
            "avatar" => (string)($user['avatar'] ?? ''),
            "has_security_question" => $hasSq,
            "security_question" => $hasSq ? (string)$user['security_question'] : ''
        ]);
        break;

    case 'reset_pin_with_answer':
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

        $rawAnswer = $body['answer'] ?? '';
        $normalizedAnswer = normalizeSecurityAnswer($rawAnswer);
        if (!$normalizedAnswer) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Jawaban keamanan minimal 2 karakter."]);
            exit;
        }

        $newPin = validatePin($body['new_pin'] ?? '');
        if (!$newPin) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "PIN baru harus 6 digit angka numerik."]);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, username, avatar, security_question, security_answer_hash FROM users WHERE username = :u COLLATE NOCASE LIMIT 1");
        $stmt->execute([':u' => $username]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Pemain tidak ditemukan."]);
            exit;
        }

        if (empty($user['security_answer_hash'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Akun ini belum menyetel pertanyaan keamanan pemulihan."]);
            exit;
        }

        if (!password_verify($normalizedAnswer, $user['security_answer_hash'])) {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "Jawaban keamanan tidak cocok. Periksa kembali ejaan jawaban Anda."]);
            exit;
        }

        $newPinHash = password_hash($newPin, PASSWORD_DEFAULT);
        $token = bin2hex(random_bytes(32));

        $stmtUp = $pdo->prepare("UPDATE users SET pin_hash = :p, session_token = :t, last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = :id");
        $stmtUp->execute([
            ':p' => $newPinHash,
            ':t' => $token,
            ':id' => $user['id']
        ]);

        setSessionCookie($token);

        echo json_encode([
            "status" => "success",
            "message" => "PIN keamanan berhasil direset! Selamat datang kembali.",
            "token" => $token,
            "user" => [
                "username" => $user['username'],
                "avatar" => (string)($user['avatar'] ?? '')
            ]
        ]);
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

        $secQuestion = trim((string)($body['security_question'] ?? ''));
        $secAnswerRaw = $body['security_answer'] ?? '';
        $normalizedSecAnswer = normalizeSecurityAnswer($secAnswerRaw);
        $secAnswerHash = ($secQuestion && $normalizedSecAnswer) ? password_hash($normalizedSecAnswer, PASSWORD_DEFAULT) : '';

        $pinHash = password_hash($pin, PASSWORD_DEFAULT);
        $token = bin2hex(random_bytes(32));

        $stmtInsert = $pdo->prepare("
            INSERT INTO users (username, pin_hash, avatar, session_token, security_question, security_answer_hash, last_login, created_at, updated_at)
            VALUES (:u, :p, :a, :t, :sq, :sah, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $stmtInsert->execute([
            ':u' => $username,
            ':p' => $pinHash,
            ':a' => $avatar,
            ':t' => $token,
            ':sq' => $secQuestion,
            ':sah' => $secAnswerHash
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

        $stmt = $pdo->prepare("SELECT id, username, pin_hash, avatar, security_question, security_answer_hash FROM users WHERE username = :u COLLATE NOCASE LIMIT 1");
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
                "avatar" => (string)($user['avatar'] ?? ''),
                "has_security_question" => (!empty($user['security_question']) && !empty($user['security_answer_hash']))
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

        $stmt = $pdo->prepare("SELECT id, username, avatar, security_question, security_answer_hash FROM users WHERE session_token = :t AND session_token != '' LIMIT 1");
        $stmt->execute([':t' => $token]);
        $user = $stmt->fetch();

        if (!$user) {
            http_response_code(401);
            echo json_encode(["status" => "error", "authenticated" => false, "message" => "Sesi kedaluwarsa atau tidak valid."]);
            exit;
        }

        $hasSq = !empty($user['security_question']) && !empty($user['security_answer_hash']);
        echo json_encode([
            "status" => "success",
            "authenticated" => true,
            "user" => [
                "username" => $user['username'],
                "avatar" => (string)($user['avatar'] ?? ''),
                "has_security_question" => $hasSq,
                "security_question" => $hasSq ? (string)$user['security_question'] : ''
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

        $stmt = $pdo->prepare("SELECT id, username, pin_hash, avatar, security_question, security_answer_hash FROM users WHERE session_token = :t AND session_token != '' LIMIT 1");
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

        // Security Question & Answer updates
        $targetSecQ = $user['security_question'] ?? '';
        $targetSecAHash = $user['security_answer_hash'] ?? '';
        if (isset($body['security_question']) && isset($body['security_answer'])) {
            $newSecQ = trim((string)$body['security_question']);
            $rawSecA = $body['security_answer'];
            $normalizedSecA = normalizeSecurityAnswer($rawSecA);
            if ($newSecQ && $normalizedSecA) {
                $targetSecQ = $newSecQ;
                $targetSecAHash = password_hash($normalizedSecA, PASSWORD_DEFAULT);
            }
        }

        $stmtSave = $pdo->prepare("
            UPDATE users 
            SET username = :u, avatar = :a, pin_hash = :p, security_question = :sq, security_answer_hash = :sah, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $stmtSave->execute([
            ':u' => $targetUsername,
            ':a' => $targetAvatar,
            ':p' => $targetPinHash,
            ':sq' => $targetSecQ,
            ':sah' => $targetSecAHash,
            ':id' => $user['id']
        ]);

        $hasSq = !empty($targetSecQ) && !empty($targetSecAHash);
        echo json_encode([
            "status" => "success",
            "message" => "Profil berhasil diperbarui.",
            "user" => [
                "username" => $targetUsername,
                "avatar" => $targetAvatar,
                "has_security_question" => $hasSq,
                "security_question" => $hasSq ? $targetSecQ : ''
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
