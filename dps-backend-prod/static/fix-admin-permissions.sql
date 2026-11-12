-- Fix Admin Profile Permissions - Add Missing Resources
-- Run this SQL to immediately give admin access to all operations

-- First, let's see what admin currently has:
SELECT 
    r.id,
    r.resource_name, 
    r.resource_url,
    CASE WHEN pr.id_profile IS NOT NULL THEN '✅ HAS ACCESS' ELSE '❌ MISSING' END as status
FROM resources r
LEFT JOIN profile_resources pr ON r.id = pr.id_resource AND pr.id_profile = 1
WHERE r.deleted_at IS NULL
ORDER BY r.resource_name;

-- Now add the missing permissions for admin profile:
INSERT IGNORE INTO profile_resources (id_profile, id_resource, create, edit, delete, select)
VALUES 
-- Catálogos section
(1, 35, 1, 1, 1, 1),  -- Operaciones MCC (/catalogos/mcc-operations) ← MOST IMPORTANT!
(1, 41, 1, 1, 1, 1),  -- Perfiles Transaccionales

-- Archivos section  
(1, 42, 1, 1, 1, 1),  -- Archivos (parent)
(1, 43, 1, 1, 1, 1),  -- Conciliación
(1, 44, 1, 1, 1, 1),  -- Contracargos (Archivos)
(1, 46, 1, 1, 1, 1),  -- Liquidación (Archivos)

-- Links section
(1, 47, 1, 1, 1, 1),  -- Links (parent)
(1, 48, 1, 1, 1, 1),  -- Generación de Links
(1, 49, 1, 1, 1, 1),  -- Consulta de Links

-- Reportes section
(1, 50, 1, 1, 1, 1),  -- Reportes

-- Also add missing permissions for resources that exist but weren't in original seeder:
(1, 45, 1, 1, 1, 1); -- Contracargos (Reportes)

-- Verify the fix:
SELECT 
    r.resource_name, 
    r.resource_url,
    '✅ NOW HAS ACCESS' as status
FROM resources r
INNER JOIN profile_resources pr ON r.id = pr.id_resource AND pr.id_profile = 1
WHERE r.resource_url IN (
    '/catalogos/mcc-operations',
    '/conciliation',
    '/files/contracargo', 
    '/files/liquidacion',
    '/link',
    '/link/links'
)
ORDER BY r.resource_name;

-- Expected results should show:
-- ✅ Operaciones MCC → /catalogos/mcc-operations  
-- ✅ Conciliación → /conciliation
-- ✅ Contracargos → /files/contracargo
-- ✅ Liquidación → /files/liquidacion
-- ✅ Generación → /link
-- ✅ Consulta → /link/links
