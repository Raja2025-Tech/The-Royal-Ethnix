<?php
// get_shifts.php
error_reporting(0);

// Essential CORS headers - notice the addition of 'ngrok-skip-browser-warning'
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, ngrok-skip-browser-warning');

// Handle the browser's preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db.php';

try {
    // Fetch all shifts from the database
    $stmt = $conn->prepare("SELECT id, shift_name, start_time, end_time FROM shifts ORDER BY start_time ASC");
    $stmt->execute();
    $shifts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'status' => 'success', 
        'data' => $shifts
    ]);
} catch(PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
}
?>