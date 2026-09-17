<?php
// get_shifts.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Allow cross-origin requests from your app

require_once 'db.php';

try {
    // Prepare and execute the query
    $stmt = $conn->prepare("SELECT id, shift_name, start_time, end_time FROM shifts");
    $stmt->execute();
    
    // Fetch all records
    $shifts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Output as JSON
    echo json_encode([
        'status' => 'success',
        'data' => $shifts
    ]);
} catch(PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
?>