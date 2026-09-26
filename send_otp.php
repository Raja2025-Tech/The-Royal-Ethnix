<?php
// send_otp.php
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
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require 'PHPMailer/Exception.php';
require 'PHPMailer/PHPMailer.php';
require 'PHPMailer/SMTP.php';

$data = json_decode(file_get_contents("php://input"));
if (!$data || empty($data->email) || empty($data->phone)) {
    echo json_encode(['status' => 'error', 'message' => 'Missing contact details.']);
    exit();
}

$email = trim($data->email);
$phone = trim($data->phone);

try {
    $checkStmt = $conn->prepare("SELECT id FROM employees WHERE email = ? OR phone = ?");
    $checkStmt->execute([$email, $phone]);
    if ($checkStmt->fetch()) {
        echo json_encode(['status' => 'error', 'message' => 'Email or phone already registered.']);
        exit();
    }

    $otp_code = rand(100000, 999999);
    $stmt = $conn->prepare("INSERT INTO otp_requests (email, otp_code) VALUES (?, ?) ON DUPLICATE KEY UPDATE otp_code = ?");
    $stmt->execute([$email, $otp_code, $otp_code]);
    
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    
    $mail->Username   = 'subhasishdas025@gmail.com'; 
    $mail->Password   = 'cigxihwtntnwmsmd'; 
    
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; 
    $mail->Port       = 465;

    $mail->SMTPOptions = array(
        'ssl' => array(
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        )
    );

    $mail->setFrom('subhasishdas025@gmail.com', 'The Royal Ethnix');
    $mail->addAddress($email); 
    
    $mail->isHTML(true);
    $mail->Subject = 'Your Staff Portal Verification Code';
    $mail->Body    = "Your verification code for The Royal Ethnix is: <b style='font-size:18px;'>$otp_code</b>";

    $mail->send();
    echo json_encode(['status' => 'success', 'message' => 'OTP sent to your email.']);
        
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => 'Failed to send email. Mailer Error: ' . $mail->ErrorInfo]);
} catch(PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $e->getMessage()]);
}
?>