<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'db.php';

$data = json_decode(file_get_contents("php://input"));

if(!isset($data->loginId) || !isset($data->password)) {
    die(json_encode(['status' => 'error', 'message' => 'Missing credentials']));
}

$loginId = $data->loginId; // This can be email or phone
$password = $data->password;

try {
    // Check if the loginId matches an email OR a phone number
    $stmt = $conn->prepare("SELECT id, full_name, password_hash, role FROM employees WHERE email = ? OR phone = ?");
    $stmt->execute([$loginId, $loginId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Verify the hashed password
    if ($user && password_verify($password, $user['password_hash'])) {
        echo json_encode([
            'status' => 'success', 
            'message' => 'Login successful',
            'user' => [
                'id' => $user['id'],
                'name' => $user['full_name'],
                'role' => $user['role']
            ]
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid email/phone or password.']);
    }
} catch(PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Login failed: ' . $e->getMessage()]);
}
?>