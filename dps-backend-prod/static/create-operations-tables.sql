-- Create iso_giro table
CREATE TABLE IF NOT EXISTS iso_giro (
    id_giro INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    code VARCHAR(10) NOT NULL UNIQUE,
    active INT DEFAULT 1,
    creation_date DATETIME DEFAULT NOW(),
    updated_at DATETIME DEFAULT NOW(),
    INDEX idx_giro_code (code),
    INDEX idx_giro_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create processing_operations table
CREATE TABLE IF NOT EXISTS processing_operations (
    id_operation INT AUTO_INCREMENT PRIMARY KEY,
    id_giro INT NOT NULL,
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
    FOREIGN KEY (id_giro) REFERENCES iso_giro(id_giro) ON DELETE CASCADE,
    UNIQUE KEY unique_giro_operation (id_giro, operation_code),
    INDEX idx_operation_giro (id_giro),
    INDEX idx_operation_active (active),
    INDEX idx_operation_code (operation_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add id_giro column to merchant table if it doesn't exist
ALTER TABLE merchant 
ADD COLUMN IF NOT EXISTS id_giro INT NULL,
ADD INDEX idx_merchant_giro (id_giro);

-- Add foreign key constraint for merchant.id_giro
ALTER TABLE merchant 
ADD CONSTRAINT fk_merchant_giro 
FOREIGN KEY (id_giro) REFERENCES iso_giro(id_giro) ON DELETE SET NULL;
