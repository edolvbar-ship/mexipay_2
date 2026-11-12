-- Create mcc_operations table for MCC-based processing operations
CREATE TABLE IF NOT EXISTS mcc_operations (
    id_operation INT AUTO_INCREMENT PRIMARY KEY,
    mcc_range_start VARCHAR(3) NOT NULL,
    mcc_range_end VARCHAR(3) NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    operation_code VARCHAR(20) NOT NULL,
    msg_type VARCHAR(4),
    processing_code VARCHAR(6),
    requires_amount INT DEFAULT 1,
    requires_tip INT DEFAULT 0,
    active INT DEFAULT 1,
    display_order INT DEFAULT 0,
    icon_name VARCHAR(50),
    creation_date DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    UNIQUE KEY unique_mcc_operation (mcc_range_start, operation_code),
    INDEX idx_mcc_range_start (mcc_range_start),
    INDEX idx_mcc_range_end (mcc_range_end),
    INDEX idx_operation_active (active),
    INDEX idx_operation_code (operation_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Note: merchant table already has id_mcc field, so no need to add it
-- The existing iso_mcc table already contains merchant category codes
