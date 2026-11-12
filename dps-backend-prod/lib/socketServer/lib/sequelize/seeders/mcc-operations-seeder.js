require('dotenv').config()
const db = require('../init');

async function migrateTableSchema() {
  try {
    console.log('🔍 Checking table schema...');
    
    // Check if table exists
    const tableExists = await db.sequelize.query(
      "SHOW TABLES LIKE 'mcc_operations'",
      { type: db.Sequelize.QueryTypes.SELECT }
    );
    
    if (tableExists.length === 0) {
      console.log('📋 Table does not exist, will be created by sync()');
      return;
    }
    
    // Check current table structure
    const columns = await db.sequelize.query(
      "SHOW COLUMNS FROM mcc_operations",
      { type: db.Sequelize.QueryTypes.SELECT }
    );
    
    const columnNames = columns.map(col => col.Field);
    console.log('📋 Current columns:', columnNames);
    
    // Check if we need to migrate from old schema
    const hasOldSchema = columnNames.includes('mcc_range_start');
    const hasNewSchema = columnNames.includes('mcc_code');
    
    if (hasOldSchema && !hasNewSchema) {
      console.log('🔄 Migrating from old schema (mcc_range_start/mcc_range_end) to new schema (mcc_code)...');
      
      // Add new columns
      await db.sequelize.query(`
        ALTER TABLE mcc_operations 
        ADD COLUMN mcc_code VARCHAR(4) AFTER id_operation,
        ADD COLUMN category_code VARCHAR(50) AFTER icon_name
      `);
      console.log('✅ Added new columns mcc_code and category_code');
      
      // Migrate data: convert range to single mcc_code
      const oldData = await db.sequelize.query(
        'SELECT id_operation, mcc_range_start, mcc_range_end FROM mcc_operations',
        { type: db.Sequelize.QueryTypes.SELECT }
      );
      
      for (const row of oldData) {
        // Use mcc_range_start as the new mcc_code
        await db.sequelize.query(
          'UPDATE mcc_operations SET mcc_code = ? WHERE id_operation = ?',
          { replacements: [row.mcc_range_start, row.id_operation] }
        );
      }
      console.log(`✅ Migrated ${oldData.length} records to new schema`);
      
      // Add index on mcc_code
      await db.sequelize.query('CREATE INDEX idx_mcc_code ON mcc_operations(mcc_code)');
      await db.sequelize.query('CREATE INDEX idx_category_code ON mcc_operations(category_code)');
      console.log('✅ Added indexes on mcc_code and category_code');
      
      // Drop old columns
      await db.sequelize.query(`
        ALTER TABLE mcc_operations 
        DROP COLUMN mcc_range_start,
        DROP COLUMN mcc_range_end
      `);
      console.log('✅ Dropped old columns mcc_range_start and mcc_range_end');
      
      // Update unique index
      await db.sequelize.query('DROP INDEX IF EXISTS unique_mcc_operation ON mcc_operations');
      await db.sequelize.query('CREATE UNIQUE INDEX unique_mcc_operation ON mcc_operations(mcc_code, operation_code)');
      console.log('✅ Updated unique index to use mcc_code and operation_code');
      
    } else if (hasNewSchema) {
      console.log('✅ Table already has new schema');
    } else {
      console.log('✅ Table has no schema to migrate');
    }
    
  } catch (error) {
    console.error('❌ Error migrating table schema:', error);
    throw error;
  }
}

async function seedMccOperations() {
  try {
    console.log('🏪 Starting MCC operations seeding from giros list...');

    // Giros list - single source of truth for MCC codes
    const girosList = [
      { id_mcc: 1, mcc: '5399', description: 'Agregador' },
      { id_mcc: 2, mcc: '5221', description: 'Restaurantes' },
      { id_mcc: 3, mcc: '742', description: 'MEDICOS VETERINARIOS, COMERCIO DE ACCESORIOS, ESTETICA Y/O ALIMENTO PARA ANIMALES DOMESTICOS, DE GRANJA, GANADO O ANIMALES EXOTICOS SOLO SI CUENTAN CO' },
      { id_mcc: 4, mcc: '763', description: 'COOPERATIVAS AGRICOLAS' },
      { id_mcc: 5, mcc: '780', description: 'SERVICIOS DE HORTICULTURA Y DE JARDINERIA' },
      { id_mcc: 6, mcc: '1520', description: 'CONTRATISTAS EN GENERAL- RESIDENCIAL Y COMERCIAL' },
      { id_mcc: 7, mcc: '1711', description: 'CONTRATISTAS  ( CALEFACCION VENTAS, SERVICIO E INSTALACION ), ( AIRE ACONDICIONADO VENTAS E INSTALACION ) ( PLOMERIA )' },
      { id_mcc: 8, mcc: '1731', description: 'CONTRATISTAS ELECTRICISTAS' },
      { id_mcc: 9, mcc: '1740', description: 'CONTRATISTAS (YESO) (CANTERA Y MAMPOSTERIA) (TEJAS, PISOS Y AZULEJOS) (MAMPOSTERIA Y CANTERIA) (AISLAMIENTO)' },
      { id_mcc: 10, mcc: '1750', description: 'CONTRATISTAS CARPINTERIA' },
      { id_mcc: 11, mcc: '1761', description: 'CONTRATISTAS TECHOS, ESTRUCTURAS Y LAMINAS' },
      { id_mcc: 12, mcc: '1771', description: 'CONTRATISTAS CONSTRUCTORAS' },
      { id_mcc: 13, mcc: '1799', description: 'CONTRATISTAS (DEMOLICIONES) (PERFORACION) (CRISTALES) (DECORACION) (NO CLASIFICADOS) (TAPICEROS)' },
      { id_mcc: 14, mcc: '2741', description: 'PUBLICACIONES E IMPRESIONES EN GENERAL' },
      { id_mcc: 15, mcc: '2791', description: 'TIPOGRAFIAS, PLACAS, TRABAJOS SIMILARES' },
      { id_mcc: 16, mcc: '2842', description: 'LIMPIEZA ESPECIALIZADA, PULIDOS, Y SERVICIOS SANITARIOS' },
      { id_mcc: 17, mcc: '3000', description: 'UNITED AIRLINES' },
      { id_mcc: 18, mcc: '3001', description: 'AMERICAN AIRLINES' },
      { id_mcc: 19, mcc: '3002', description: 'PAN AMERICAN' },
      { id_mcc: 20, mcc: '3004', description: 'TRANS WORLD AIRLINES' },
      { id_mcc: 21, mcc: '3005', description: 'BRITISH AIRWAYS' },
      { id_mcc: 22, mcc: '3006', description: 'JAPAN AIR LINES' },
      { id_mcc: 54, mcc: '5541', description: 'ESTACIONES DE SERVICIO GASOLINERIAS ESTACIONES DE SERVICIO PARA TODO TIPO DE TRANSPORTE CON O SIN SERVICIOS AUXILIARES' },
      { id_mcc: 55, mcc: '8299', description: 'ACADEMIAS Y ESCUELAS SIN GRADO ACADMICO INSTRUCCIN O CURSOS DE MSICAARTE COCINA MODELAJE KARATE MANEJO U OTROS' },
      { id_mcc: 56, mcc: '8999', description: 'SERVICIOS PROFESIONALES  NO CLASIFICADOS' },
      { id_mcc: 57, mcc: '5045', description: 'COMPUTADORAS  EQUIPO PERIFERICO DE COMPUTADORAS SOFTWARE' },
      { id_mcc: 58, mcc: '7399', description: 'OTROS SERVICIOS EMPRESARIALES  NO CLASIFICADOS' },
      { id_mcc: 59, mcc: '8021', description: 'ODONTOLOGOS GENERALES O DE ESPECIALIDAD ORTODONCIA ENDODONCIA PERIODONCIA U OTRA DENTISTAS CONSULTORIOS DENTALES' },
      { id_mcc: 60, mcc: '7941', description: 'CLUBES DEPORTIVOS PROFESIONALESHIPODROMOS AUTODROMOS GALGODROMOSESTADIOS DEPORTIVOSCAMPOS DE ATLETISMODEPORTES  PROMOTORES Y PROFESIONALES' },
      { id_mcc: 71, mcc: '5814', description: 'RESTAURANTE DE COMIDA RAPIDA' },
      { id_mcc: 72, mcc: '511', description: 'Agencia Autos' },
      { id_mcc: 74, mcc: '5013', description: 'Vehículos de motor Accesorios y Autos' },
      { id_mcc: 75, mcc: '5511', description: 'Distribuidores de automóviles (Nuevos y usados) y Venta de arrendamiento' },
      { id_mcc: 76, mcc: '7011', description: 'Servicios no clasificados - Hoteles, moteles, centros turísticos' },
      { id_mcc: 77, mcc: '6011', description: 'BANCOS - DISPOSICIONES AUTOMATICAS DE EFECTIVO, (AUTOFINANCIAMIENTOS - DISPOSICIONES AUTOMATICAS DE' },
      { id_mcc: 78, mcc: '5065', description: 'PARTES Y EQUIPO ELECTRONICO' },
      { id_mcc: 79, mcc: '7911', description: 'BAILE - SALONES Y ESCUELAS DE BAILE' },
      { id_mcc: 80, mcc: '8249', description: 'ESCUELAS - PROFESIONALES, (PROFESIONAL), (ESCUELAS - DIPLOMADOS)' },
      { id_mcc: 81, mcc: '5945', description: 'JUGOS DE MESA Y PASATIEMPOS, (JUGUETERIAS, JUGOS DE MESA Y PASATIEMPOS), (TIENDAS - JUEGOS)' },
      { id_mcc: 82, mcc: '7392', description: 'SERVICIOS - RELACIONES PUBLICAS (SERVICIOS - CONSULTORIA Y ADMINISTRACIÓN) SERVICIOS - CONSULTORIAS' },
      { id_mcc: 83, mcc: '7538', description: 'TALLERES - MECANICOS' }
    ];

    // Define operations templates based on business type
    const operationTemplates = {
      // Restaurants
      restaurant: [
        {
          name: 'Check In',
          description: 'Registro de mesa y preautorización',
          operation_code: 'CHECK_IN',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'login'
        },
        {
          name: 'Check Out',
          description: 'Pago final y cierre de cuenta',
          operation_code: 'CHECK_OUT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 1,
          display_order: 2,
          icon_name: 'logout'
        },
        {
          name: 'Venta con Propina',
          description: 'Procesamiento de venta con opción de propina',
          operation_code: 'SALE_WITH_TIP',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 1,
          display_order: 3,
          icon_name: 'restaurant'
        },
        {
          name: 'Venta',
          description: 'Venta estándar',
          operation_code: 'SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 4,
          icon_name: 'shopping_cart'
        },
        {
          name: 'Devolución',
          description: 'Procesamiento de devolución',
          operation_code: 'RETURN',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 5,
          icon_name: 'return'
        }
      ],
      // Hotels
      hotel: [
        {
          name: 'Check In',
          description: 'Registro de huésped y preautorización',
          operation_code: 'CHECK_IN',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'login'
        },
        {
          name: 'Check Out',
          description: 'Pago final y cierre de cuenta',
          operation_code: 'CHECK_OUT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 1,
          display_order: 2,
          icon_name: 'logout'
        },
        {
          name: 'Cargo Adicional',
          description: 'Cargo adicional a habitación',
          operation_code: 'ROOM_CHARGE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 3,
          icon_name: 'plus'
        },
        {
          name: 'Preautorización',
          description: 'Preautorización de monto',
          operation_code: 'PREAUTH',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 4,
          icon_name: 'lock'
        }
      ],
      // Retail
      retail: [
        {
          name: 'Venta',
          description: 'Venta estándar',
          operation_code: 'SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'shopping_cart'
        },
        {
          name: 'Devolución',
          description: 'Procesamiento de devolución',
          operation_code: 'RETURN',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'return'
        },
        {
          name: 'Venta con Cuotas',
          description: 'Venta en cuotas (MSI)',
          operation_code: 'INSTALLMENT_SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 3,
          icon_name: 'calendar'
        }
      ],
      // Professional Services
      professional: [
        {
          name: 'Pago de Servicio',
          description: 'Pago por servicios profesionales',
          operation_code: 'SERVICE_PAYMENT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'briefcase'
        },
        {
          name: 'Venta',
          description: 'Venta estándar',
          operation_code: 'SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'shopping_cart'
        }
      ],
      // Medical/Healthcare
      medical: [
        {
          name: 'Consulta Médica',
          description: 'Pago por servicios médicos',
          operation_code: 'MEDICAL_PAYMENT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'medical'
        },
        {
          name: 'Venta',
          description: 'Venta estándar',
          operation_code: 'SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'shopping_cart'
        }
      ],
      // Education
      education: [
        {
          name: 'Educación',
          description: 'Pago por servicios educativos',
          operation_code: 'EDUCATION_PAYMENT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'book'
        },
        {
          name: 'Venta',
          description: 'Venta estándar',
          operation_code: 'SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'shopping_cart'
        }
      ],
      // Transportation
      transport: [
        {
          name: 'Pago de Transporte',
          description: 'Pago por servicios de transporte',
          operation_code: 'TRANSPORT_PAYMENT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 1,
          display_order: 1,
          icon_name: 'car'
        },
        {
          name: 'Venta',
          description: 'Venta estándar',
          operation_code: 'SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'shopping_cart'
        }
      ],
      // Bar
      bar: [
        {
          name: 'Check In',
          description: 'Pre-autorización de cuenta',
          operation_code: 'CHECK_IN',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'login'
        },
        {
          name: 'Check Out',
          description: 'Liquidación de cuenta',
          operation_code: 'CHECK_OUT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 1,
          display_order: 2,
          icon_name: 'logout'
        },
        {
          name: 'Reautorización',
          description: 'Extender límite de cuenta',
          operation_code: 'REAUTHORIZE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 3,
          icon_name: 'refresh'
        },
        {
          name: 'Venta',
          description: 'Venta estándar',
          operation_code: 'SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 4,
          icon_name: 'shopping_cart'
        },
        {
          name: 'Devolución',
          description: 'Procesamiento de devolución',
          operation_code: 'RETURN',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 5,
          icon_name: 'return'
        },
        {
          name: 'Cancelar',
          description: 'Cancelar autorización',
          operation_code: 'CANCEL',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 6,
          icon_name: 'cancel'
        }
      ],
      // Car Rental
      car_rental: [
        {
          name: 'Check In',
          description: 'Pre-autorización recogida',
          operation_code: 'CHECK_IN',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'login'
        },
        {
          name: 'Check Out',
          description: 'Liquidación devolución',
          operation_code: 'CHECK_OUT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'logout'
        },
        {
          name: 'Rent In',
          description: 'Recogida de alquiler',
          operation_code: 'RENT_IN',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 3,
          icon_name: 'car'
        },
        {
          name: 'Rent Out',
          description: 'Devolución de alquiler',
          operation_code: 'RENT_OUT',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 4,
          icon_name: 'car_return'
        },
        {
          name: 'Reautorización',
          description: 'Extender alquiler',
          operation_code: 'REAUTHORIZE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 5,
          icon_name: 'refresh'
        },
        {
          name: 'Venta',
          description: 'Venta estándar',
          operation_code: 'SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 6,
          icon_name: 'shopping_cart'
        },
        {
          name: 'Devolución',
          description: 'Procesamiento de devolución',
          operation_code: 'RETURN',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 7,
          icon_name: 'return'
        },
        {
          name: 'Cancelar',
          description: 'Cancelar autorización',
          operation_code: 'CANCEL',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 8,
          icon_name: 'cancel'
        }
      ],
      // Default/Generic
      default: [
        {
          name: 'Venta',
          description: 'Venta estándar',
          operation_code: 'SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'shopping_cart'
        },
        {
          name: 'Devolución',
          description: 'Procesamiento de devolución',
          operation_code: 'RETURN',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'return'
        }
      ]
    };

    // Map MCC codes to category codes for terminal routing
    function getCategoryCode(mcc, description) {
      const desc = description.toUpperCase();
      
      // Restaurants
      if (desc.includes('RESTAURANTE') || mcc === '5221' || mcc === '5814') {
        return 'FOOD_58X';
      }
      
      // Hotels
      if (desc.includes('HOTEL') || desc.includes('MOTEL') || mcc === '7011') {
        return 'BUSINESS_7XX';
      }
      
      // Airlines/Transportation
      if (desc.includes('AIRLINES') || desc.includes('AIR') || mcc.startsWith('300')) {
        return 'SERVICES_3XX';
      }
      
      // Gas stations
      if (desc.includes('GASOLINERIA') || mcc === '5541') {
        return 'RETAIL_5XX';
      }
      
      // Automotive
      if (desc.includes('AUTO') || desc.includes('VEHICULO') || mcc === '511' || mcc === '5013' || mcc === '5511' || mcc === '7538') {
        return 'RETAIL_5XX';
      }
      
      // Medical/Healthcare
      if (desc.includes('MEDIC') || desc.includes('ODONTOLOG') || desc.includes('DENTIST') || mcc === '8021') {
        return 'PROFESSIONAL_8XX';
      }
      
      // Education
      if (desc.includes('ESCUELA') || desc.includes('ACADEMI') || desc.includes('EDUCACION') || mcc === '8299' || mcc === '8249') {
        return 'PROFESSIONAL_8XX';
      }
      
      // Professional Services
      if (desc.includes('SERVICIO') || desc.includes('PROFESIONAL') || mcc === '8999' || mcc === '7399' || mcc === '7392') {
        return 'PROFESSIONAL_8XX';
      }
      
      // Construction/Contractors
      if (desc.includes('CONTRATISTA') || desc.includes('CONSTRUCTOR') || mcc.startsWith('17') || mcc === '1520') {
        return 'PROFESSIONAL_8XX';
      }
      
      // Sports/Recreation
      if (desc.includes('DEPORTIV') || desc.includes('BAILE') || mcc === '7941' || mcc === '7911') {
        return 'PROFESSIONAL_8XX';
      }
      
      // Retail/Generic
      return 'RETAIL_5XX';
    }

    // Map MCC codes to operation templates based on description
    function getOperationTemplate(mcc, description) {
      const desc = description.toUpperCase();
      
      // Restaurants
      if (desc.includes('RESTAURANTE') || mcc === '5221' || mcc === '5814') {
        return operationTemplates.restaurant;
      }
      
      // Hotels
      if (desc.includes('HOTEL') || desc.includes('MOTEL') || mcc === '7011') {
        return operationTemplates.hotel;
      }
      
      // Bar/Nightclub
      if (desc.includes('BAR') || desc.includes('CANTINA') || desc.includes('NIGHTCLUB') || desc.includes('TABERNA') || mcc === '5813') {
        return operationTemplates.bar;
      }
      
      // Car Rental
      if (desc.includes('ALQUILER') || desc.includes('RENTA') || desc.includes('RENTAL') || desc.includes('AUTO RENTAL') || mcc === '7512') {
        return operationTemplates.car_rental;
      }
      
      // Airlines
      if (desc.includes('AIRLINES') || desc.includes('AIR') || mcc.startsWith('300')) {
        return operationTemplates.transport;
      }
      
      // Medical/Healthcare
      if (desc.includes('MEDIC') || desc.includes('ODONTOLOG') || desc.includes('DENTIST') || mcc === '8021') {
        return operationTemplates.medical;
      }
      
      // Education
      if (desc.includes('ESCUELA') || desc.includes('ACADEMI') || desc.includes('EDUCACION') || mcc === '8299' || mcc === '8249') {
        return operationTemplates.education;
      }
      
      // Automotive
      if (desc.includes('AUTO') || desc.includes('VEHICULO') || desc.includes('GASOLINERIA') || mcc === '511' || mcc === '5013' || mcc === '5511' || mcc === '5541' || mcc === '7538') {
        return operationTemplates.retail;
      }
      
      // Professional Services
      if (desc.includes('SERVICIO') || desc.includes('PROFESIONAL') || mcc === '8999' || mcc === '7399' || mcc === '7392') {
        return operationTemplates.professional;
      }
      
      // Construction/Contractors
      if (desc.includes('CONTRATISTA') || desc.includes('CONSTRUCTOR') || mcc.startsWith('17') || mcc === '1520') {
        return operationTemplates.professional;
      }
      
      // Sports/Recreation
      if (desc.includes('DEPORTIV') || desc.includes('BAILE') || mcc === '7941' || mcc === '7911') {
        return operationTemplates.professional;
      }
      
      // Retail/Generic
      return operationTemplates.default;
    }

    // Create operations for each MCC from giros list
    console.log('🔧 Creating MCC operations from giros list...');
    for (const giro of girosList) {
      console.log(`📝 Processing MCC ${giro.mcc}: ${giro.description.substring(0, 50)}...`);
      
      const operations = getOperationTemplate(giro.mcc, giro.description);
      const categoryCode = getCategoryCode(giro.mcc, giro.description);
      
      for (const opData of operations) {
        const [operation, created] = await db.mccOperations.findOrCreate({
          where: { 
            mcc_code: giro.mcc,
            operation_code: opData.operation_code 
          },
          defaults: {
            ...opData,
            mcc_code: giro.mcc,
            name: opData.name,
            description: opData.description,
            category_code: categoryCode,
            active: 1,
            updated_at: new Date()
          }
        });
        
        if (!created) {
          // Update existing operation to ensure it matches the requested configuration
          await operation.update({
            ...opData,
            mcc_code: giro.mcc,
            category_code: categoryCode,
            updated_at: new Date()
          });
          console.log(`✅ Updated existing operation: ${operation.name} for MCC ${giro.mcc} (category: ${categoryCode})`);
        } else {
          console.log(`✅ Created operation: ${operation.name} for MCC ${giro.mcc} (category: ${categoryCode})`);
        }
      }
    }

    console.log('🎉 MCC operations seeding from giros list completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding MCC operations:', error);
    throw error;
  }
}

// Execute the seeding function
if (require.main === module) {
  seedMccOperations()
    .then(() => {
      console.log('✅ Seeder completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeder failed:', error);
      process.exit(1);
    });
}

module.exports = {
  seedMccOperations
};
