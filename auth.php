<?php
// auth.php - User Authentication (Register, Login, Logout, Session)

// --- TEMPORARY DEBUGGING ---
error_reporting(E_ALL);
ini_set('display_errors', 1);
// --- END TEMPORARY DEBUGGING ---

// Start session management at the very beginning
if (session_status() == PHP_SESSION_NONE) {
    session_start();
    // error_log("[auth.php] Session started. SID: " . session_id()); // Log SID on start
} else {
    // error_log("[auth.php] Session already active. SID: " . session_id()); // Log SID if already active
}


require_once 'db_config.php'; // Contains $mysqli connection object

header('Content-Type: application/json'); // All responses will be JSON

// Get the request body (assuming JSON input)
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_POST['action'] ?? $_GET['action'] ?? null; // Allow action via JSON, POST, or GET (for check/logout)
// error_log("[auth.php] Action: " . $action . " Input data: " . json_encode($input) . " GET data: " . json_encode($_GET) . " SESSION data: " . json_encode($_SESSION));


if (!$mysqli) {
    error_log("[auth.php] Database connection failed in auth.php. Check db_config.php.");
    echo json_encode(['success' => false, 'message' => 'Database connection failed. Check db_config.php']);
    exit;
}

switch ($action) {
    case 'register':
        handleRegister($input, $mysqli);
        break;
    case 'login':
        handleLogin($input, $mysqli);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'check_auth':
        handleCheckAuth();
        break;
    default:
        error_log("[auth.php] Invalid action specified: " . $action);
        echo json_encode(['success' => false, 'message' => 'Invalid action specified.']);
        break;
}

if ($mysqli && $mysqli instanceof mysqli) { // Ensure $mysqli is a valid mysqli object before closing
    $mysqli->close();
}


// --- Handler Functions ---

function handleRegister($data, $db) {
    $username = trim($data['username'] ?? '');
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    // error_log("[auth.php] Register attempt for username: " . $username . ", email: " . $email);

    // Basic validation
    if (empty($username) || empty($email) || empty($password)) {
        error_log("[auth.php] Registration failed for $username: All fields are required.");
        echo json_encode(['success' => false, 'message' => 'All fields are required.']);
        return;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_log("[auth.php] Registration failed for $username: Invalid email format ($email).");
        echo json_encode(['success' => false, 'message' => 'Invalid email format.']);
        return;
    }
    if (strlen($password) < 8) {
        error_log("[auth.php] Registration failed for $username: Password too short.");
        echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters long.']);
        return;
    }

    // Check if username or email already exists
    $stmt_check = $db->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    if (!$stmt_check) {
        error_log("[auth.php] Registration DB error (prepare check): " . $db->error);
        echo json_encode(['success' => false, 'message' => 'Database error (prepare check): ' . $db->error]);
        return;
    }
    $stmt_check->bind_param("ss", $username, $email);
    if(!$stmt_check->execute()){
        error_log("[auth.php] Registration DB error (execute check): " . $stmt_check->error);
        echo json_encode(['success' => false, 'message' => 'Database error (execute check): ' . $stmt_check->error]);
        $stmt_check->close();
        return;
    }
    $stmt_check->store_result();

    if ($stmt_check->num_rows > 0) {
        error_log("[auth.php] Registration failed for $username: Username or email already taken.");
        echo json_encode(['success' => false, 'message' => 'Username or email already taken.']);
        $stmt_check->close();
        return;
    }
    $stmt_check->close();

    // Hash the password
    $password_hash = password_hash($password, PASSWORD_BCRYPT);
    if (!$password_hash) {
        error_log("[auth.php] Registration error for $username: Error hashing password.");
        echo json_encode(['success' => false, 'message' => 'Error hashing password.']);
        return;
    }

    // Insert new user
    $stmt_insert = $db->prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)");
    if (!$stmt_insert) {
        error_log("[auth.php] Registration DB error (prepare insert): " . $db->error);
        echo json_encode(['success' => false, 'message' => 'Database error (prepare insert): ' . $db->error]);
        return;
    }
    $stmt_insert->bind_param("sss", $username, $email, $password_hash);

    if ($stmt_insert->execute()) {
        $new_user_id = $stmt_insert->insert_id;
        error_log("[auth.php] Registration successful for username: " . $username . ", email: " . $email . ", New User ID: " . $new_user_id);
        echo json_encode(['success' => true, 'message' => 'Registration successful. You can now login.']);
    } else {
        error_log("[auth.php] Registration failed for $username (execute insert): " . $stmt_insert->error);
        echo json_encode(['success' => false, 'message' => 'Registration failed: ' . $stmt_insert->error]);
    }
    $stmt_insert->close();
}

function handleLogin($data, $db) {
    $usernameOrEmail = trim($data['username'] ?? ''); // User can login with username or email
    $password = $data['password'] ?? '';
    // error_log("[auth.php] Login attempt for: " . $usernameOrEmail);


    if (empty($usernameOrEmail) || empty($password)) {
        error_log("[auth.php] Login failed for $usernameOrEmail: Username/Email and password are required.");
        echo json_encode(['success' => false, 'message' => 'Username/Email and password are required.']);
        return;
    }

    // Prepare statement to fetch user by username or email
    $stmt = $db->prepare("SELECT id, username, password_hash FROM users WHERE username = ? OR email = ?");
    if (!$stmt) {
        error_log("[auth.php] Login DB error (prepare select): " . $db->error);
        echo json_encode(['success' => false, 'message' => 'Database error (prepare): ' . $db->error]);
        return;
    }
    $stmt->bind_param("ss", $usernameOrEmail, $usernameOrEmail);
    if(!$stmt->execute()){
        error_log("[auth.php] Login DB error (execute select): " . $stmt->error);
        echo json_encode(['success' => false, 'message' => 'Database error (execute select): ' . $stmt->error]);
        $stmt->close();
        return;
    }
    $result = $stmt->get_result();

    if ($user = $result->fetch_assoc()) {
        if (password_verify($password, $user['password_hash'])) {
            // Password is correct, start session
            
            // Regenerate session ID for security before setting session variables
            if (session_status() == PHP_SESSION_ACTIVE) { // Ensure session is active before regenerating
                session_regenerate_id(true);
            } else { // If somehow session isn't active, start it then regenerate
                session_start();
                session_regenerate_id(true);
            }
            
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            
            error_log("[auth.php] Login successful for user: " . $user['username'] . " (ID: " . $user['id'] . "). Session data set: " . json_encode($_SESSION) . " New SID: " . session_id());

            echo json_encode([
                'success' => true, 
                'message' => 'Login successful!',
                'user' => ['id' => $user['id'], 'username' => $user['username']]
            ]);
        } else {
            error_log("[auth.php] Login failed for $usernameOrEmail: Invalid password.");
            echo json_encode(['success' => false, 'message' => 'Invalid username/email or password.']);
        }
    } else {
        error_log("[auth.php] Login failed for $usernameOrEmail: User not found.");
        echo json_encode(['success' => false, 'message' => 'Invalid username/email or password.']);
    }
    $stmt->close();
}

function handleLogout() {
    // error_log("[auth.php] Logout attempt. Current session before destroy: " . json_encode($_SESSION) . " SID: " . session_id());
    // Unset all of the session variables
    $_SESSION = array();

    // If it's desired to kill the session, also delete the session cookie.
    // Note: This will destroy the session, and not just the session data!
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }

    // Finally, destroy the session.
    if(session_status() == PHP_SESSION_ACTIVE){ // Ensure session is active before destroying
        session_destroy();
    }
    error_log("[auth.php] Logout successful. Session destroyed.");
    echo json_encode(['success' => true, 'message' => 'Logged out successfully.']);
}

function handleCheckAuth() {
    // error_log("[auth.php] CheckAuth attempt. Current session: " . json_encode($_SESSION) . " SID: " . session_id());
    if (isset($_SESSION['user_id']) && isset($_SESSION['username'])) {
        // error_log("[auth.php] CheckAuth: User is authenticated. User ID: " . $_SESSION['user_id'] . ", Username: " . $_SESSION['username']);
        echo json_encode([
            'success' => true, 
            'authenticated' => true, 
            'user' => [
                'id' => $_SESSION['user_id'], 
                'username' => $_SESSION['username']
            ]
        ]);
    } else {
        // error_log("[auth.php] CheckAuth: User is NOT authenticated.");
        echo json_encode(['success' => true, 'authenticated' => false]);
    }
}

?>