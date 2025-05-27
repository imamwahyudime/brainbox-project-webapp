<?php
// db_config.php - Database Configuration

define('DB_SERVER', 'localhost'); // Your database server (e.g., 'localhost' or an IP address)
define('DB_USERNAME', 'user');    // Your database username
define('DB_PASSWORD', 'pw'); // Your database password
define('DB_NAME', 'db');      // Your database name

/* Attempt to connect to MySQL database */
$mysqli = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_NAME);

// Check connection
if ($mysqli === false || $mysqli->connect_error) {
    // For a production environment, you might want to log this error instead of displaying it
    die("ERROR: Could not connect to database. " . $mysqli->connect_error);
}

// Optional: Set charset to utf8mb4 for full Unicode support
if (!$mysqli->set_charset("utf8mb4")) {
    // Log or handle charset error if needed
    // printf("Error loading character set utf8mb4: %s\n", $mysqli->error);
}

// The $mysqli object will be used by other PHP scripts to interact with the database.
?>