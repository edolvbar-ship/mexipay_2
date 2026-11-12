
require('dotenv').config()
const db = require('../../sequelize/init');
async function seedProfileResources() {
  try {
    console.log('🌱 Starting profile resources seeding (FIXED)...');

    let data = [
      // PERFIL ADMINISTRADOR - ALL RESOURCES
      {id_profile: 1, id_resource: 1, create: 1, edit: 1, delete: 1, select: 1 }, // Dashboard
      {id_profile: 1, id_resource: 2, create: 1, edit: 1, delete: 1, select: 1 }, // Comercios
      {id_profile: 1, id_resource: 3, create: 1, edit: 1, delete: 1, select: 1 }, // Terminales
      {id_profile: 1, id_resource: 4, create: 1, edit: 1, delete: 1, select: 1 }, // Tarjetas (parent)
      {id_profile: 1, id_resource: 5, create: 1, edit: 1, delete: 1, select: 1 }, // Bines
      {id_profile: 1, id_resource: 13, create: 1, edit: 1, delete: 1, select: 1 }, // Clientes
      {id_profile: 1, id_resource: 16, create: 1, edit: 1, delete: 1, select: 1 }, // Instituciones (parent)
      {id_profile: 1, id_resource: 17, create: 1, edit: 1, delete: 1, select: 1 }, // Bancos
      {id_profile: 1, id_resource: 18, create: 1, edit: 1, delete: 1, select: 1 }, // Procesadores
      {id_profile: 1, id_resource: 19, create: 1, edit: 1, delete: 1, select: 1 }, // Movimientos (parent)
      {id_profile: 1, id_resource: 21, create: 1, edit: 1, delete: 1, select: 1 }, // Transaccionales (parent)
      {id_profile: 1, id_resource: 22, create: 1, edit: 1, delete: 1, select: 1 }, // Liquidación
      {id_profile: 1, id_resource: 23, create: 1, edit: 1, delete: 1, select: 1 }, // JSON
      {id_profile: 1, id_resource: 24, create: 1, edit: 1, delete: 1, select: 1 }, // Transacciones
      {id_profile: 1, id_resource: 25, create: 1, edit: 1, delete: 1, select: 1 }, // Tickets
      {id_profile: 1, id_resource: 26, create: 1, edit: 1, delete: 1, select: 1 }, // Catálogos (parent)
      {id_profile: 1, id_resource: 27, create: 1, edit: 1, delete: 1, select: 1 }, // Tipos de Persona
      {id_profile: 1, id_resource: 28, create: 1, edit: 1, delete: 1, select: 1 }, // Esquemas Transaccionales
      {id_profile: 1, id_resource: 29, create: 1, edit: 1, delete: 1, select: 1 }, // Operaciones (MCC)
      {id_profile: 1, id_resource: 30, create: 1, edit: 1, delete: 1, select: 1 }, // Bancos Adquirientes
      {id_profile: 1, id_resource: 31, create: 1, edit: 1, delete: 1, select: 1 }, // Tipos de red
      {id_profile: 1, id_resource: 32, create: 1, edit: 1, delete: 1, select: 1 }, // Procesadores
      {id_profile: 1, id_resource: 33, create: 1, edit: 1, delete: 1, select: 1 }, // Modos de transacción
      {id_profile: 1, id_resource: 34, create: 1, edit: 1, delete: 1, select: 1 }, // URLS de destino
      {id_profile: 1, id_resource: 35, create: 1, edit: 1, delete: 1, select: 1 }, // Operaciones MCC ← IMPORTANT!
      {id_profile: 1, id_resource: 36, create: 1, edit: 1, delete: 1, select: 1 }, // Seguridad (parent)
      {id_profile: 1, id_resource: 37, create: 1, edit: 1, delete: 1, select: 1 }, // Usuarios
      {id_profile: 1, id_resource: 38, create: 1, edit: 1, delete: 1, select: 1 }, // Perfiles
      {id_profile: 1, id_resource: 39, create: 1, edit: 1, delete: 1, select: 1 }, // TDM Usuarios
      {id_profile: 1, id_resource: 41, create: 1, edit: 1, delete: 1, select: 1 }, // Perfiles Transaccionales
      {id_profile: 1, id_resource: 42, create: 1, edit: 1, delete: 1, select: 1 }, // Archivos (parent)
      {id_profile: 1, id_resource: 43, create: 1, edit: 1, delete: 1, select: 1 }, // Conciliación
      {id_profile: 1, id_resource: 44, create: 1, edit: 1, delete: 1, select: 1 }, // Contracargos (Archivos)
      {id_profile: 1, id_resource: 45, create: 1, edit: 1, delete: 1, select: 1 }, // Contracargos (Reportes)
      {id_profile: 1, id_resource: 46, create: 1, edit: 1, delete: 1, select: 1 }, // Liquidación (Archivos)
      {id_profile: 1, id_resource: 47, create: 1, edit: 1, delete: 1, select: 1 }, // Links (parent)
      {id_profile: 1, id_resource: 48, create: 1, edit: 1, delete: 1, select: 1 }, // Generación de Links
      {id_profile: 1, id_resource: 49, create: 1, edit: 1, delete: 1, select: 1 }, // Consulta de Links
      {id_profile: 1, id_resource: 50, create: 1, edit: 1, delete: 1, select: 1 }, // Reportes

      // PERFIL USUARIO - LIMITED ACCESS
      {id_profile: 2, id_resource: 1, create: 1, edit: 1, delete: 1, select: 1 }, // Dashboard
      {id_profile: 2, id_resource: 2, create: 1, edit: 1, delete: 1, select: 1 }, // Comercios
      {id_profile: 2, id_resource: 19, create: 1, edit: 1, delete: 1, select: 1 }, // Movimientos (parent)
      {id_profile: 2, id_resource: 21, create: 1, edit: 1, delete: 1, select: 1 }, // Transaccionales (parent)
      {id_profile: 2, id_resource: 22, create: 0, edit: 0, delete: 0, select: 1 }, // Liquidación (view only)
      {id_profile: 2, id_resource: 23, create: 0, edit: 0, delete: 0, select: 1 }, // JSON (view only)
      {id_profile: 2, id_resource: 24, create: 0, edit: 0, delete: 0, select: 1 }, // Transacciones (view only)
      {id_profile: 2, id_resource: 25, create: 0, edit: 0, delete: 0, select: 1 }, // Tickets (view only)
    ];

    // Clear existing profile resources
    await db.profileResources.destroy({ truncate: true });
    
    // Insert new profile resources
    await db.profileResources.bulkCreate(data);
    
    console.log('✅ Profile resources seeding completed successfully!');
    console.log(`📊 Created ${data.length} profile resource assignments`);
    console.log('🔧 Admin profile now has access to ALL resources including:');
    console.log('   - Operaciones MCC (/catalogos/mcc-operations)');
    console.log('   - All Catálogos sections');
    console.log('   - All Movimientos sections');
    console.log('   - All Archivos sections');
    
  } catch (error) {
    console.error('❌ Error seeding profile resources:', error);
    throw error;
  }
}

module.exports = {
  seedProfileResources
};
