<?php
// verify_code.php

// Start the session if it's not already started
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// IMPORTANT: Set your secret verification code here.
$secretVerificationCode = "rawitbingit"; // <--- CHANGE THIS!

header('Content-Type: application/json');

// Get the input from the POST request (JSON payload)
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['verification_code'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Verification code not provided.'
    ]);
    exit;
}

$userCode = trim($input['verification_code']);

if (empty($userCode)) {
    echo json_encode([
        'success' => false,
        'message' => 'Verification code cannot be empty.'
    ]);
    exit;
}

// Check if the provided code matches the secret code
if ($userCode === $secretVerificationCode) {
    // Set session variables to indicate successful verification
    $_SESSION['is_verified_for_registration'] = true;
    $_SESSION['verification_time'] = time(); // Store current time for optional expiry check

    echo json_encode([
        'success' => true,
        'message' => 'Verification successful! You can now register.'
    ]);
} else {
    // Clear any previous verification attempt if code is wrong
    unset($_SESSION['is_verified_for_registration']);
    unset($_SESSION['verification_time']);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid verification code. Please try again.'
    ]);
}

exit;
?>
