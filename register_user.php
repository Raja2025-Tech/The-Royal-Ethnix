<?php
// register_user.php
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
$data = json_decode(file_get_contents("php://input"));

if (!$data || empty($data->email) || empty($data->otp) || empty($data->name) || empty($data->password)) {
    echo json_encode(['status' => 'error', 'message' => 'Missing registration data.']);
    exit();
}

$email = trim($data->email);
$otp = trim($data->otp);
$name = trim($data->name);
$phone = !empty($data->phone) ? trim($data->phone) : ''; 
$password_hash = password_hash($data->password, PASSWORD_DEFAULT); 
$role = "Staff";
$employee_code = 'EMP-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 5));

try {
    $stmt = $conn->prepare("SELECT id FROM otp_requests WHERE email = ? AND otp_code = ?");
    $stmt->execute([$email, $otp]);
    
    if ($stmt->fetch()) {
        $insertStmt = $conn->prepare("INSERT INTO employees (employee_code, full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)");
        $insertStmt->execute([$employee_code, $name, $email, $phone, $password_hash, $role]);
        
        $delStmt = $conn->prepare("DELETE FROM otp_requests WHERE email = ?");
        $delStmt->execute([$email]);

        echo json_encode(['status' => 'success', 'message' => 'Account verified and created successfully!']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Invalid OTP. Please try again.']);
    }
} catch(PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
}
?>