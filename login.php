<?php
// login.php
error_reporting(0); 
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, ngrok-skip-browser-warning');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db.php';

$rawInput = file_get_contents("php://input");
$data = json_decode($rawInput);

if (!$data || empty($data->loginId) || empty($data->password)) {
    echo json_encode(['status' => 'error', 'message' => 'Please enter both login ID and password.']);
    exit();
}

$loginId = trim($data->loginId); 
$password = $data->password;

try {
    $stmt = $conn->prepare("SELECT id, employee_code, full_name, password_hash, role FROM employees WHERE email = ? OR phone = ?");
    $stmt->execute([$loginId, $loginId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user && password_verify($password, $user['password_hash'])) {
        echo json_encode([
            'status' => 'success', 
            'message' => 'Login successful',
            'user' => [
                'id' => $user['id'],
                'employee_code' => $user['employee_code'],
                'name' => $user['full_name'],
                'role' => $user['role']
            ]
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid email/phone or password.']);
    }
} catch(PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
}
?>