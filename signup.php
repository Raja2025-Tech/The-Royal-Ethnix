<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once 'db.php';

// Get JSON input
$data = json_decode(file_get_contents("php://input"));

if(!isset($data->name) || !isset($data->email) || !isset($data->phone) || !isset($data->password)) {
    die(json_encode(['status' => 'error', 'message' => 'Missing required fields']));
}

$name = $data->name;
$email = $data->email;
$phone = $data->phone;
// Hash the password securely before saving
$password_hash = password_hash($data->password, PASSWORD_DEFAULT); 
$role = "Staff"; // Default role

try {
    $stmt = $conn->prepare("INSERT INTO employees (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$name, $email, $phone, $password_hash, $role]);
    
    echo json_encode([
        'status' => 'success', 
        'message' => 'User registered successfully. (In production, trigger OTP SMS here)'
    ]);
} catch(PDOException $e) {
    if ($e->getCode() == 23000) {
        echo json_encode(['status' => 'error', 'message' => 'Email or Phone number already exists.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Registration failed: ' . $e->getMessage()]);
    }
}
?>