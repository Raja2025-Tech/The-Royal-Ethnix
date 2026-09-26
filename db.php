<?php
// db.php

// InfinityFree MySQL Details
$host = 'sql109.infinityfree.com'; // অথবা sql109.byetcluster.com
$db_name = 'if0_42948406_theroyalethnix'; // আপনার লাইভ ডাটাবেসের নাম
$username = 'if0_42948406'; // আপনার InfinityFree ইউজারনেম
$password = 'আপনার_INFINITYFREE_পাসওয়ার্ড'; // আপনার vPanel/cPanel পাসওয়ার্ড

try {
    $conn = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8mb4", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    die(json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]));
}
?>
