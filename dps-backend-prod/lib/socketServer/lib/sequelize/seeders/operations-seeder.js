require('dotenv').config()
const db = require('../init');

async function seedGirosAndOperations() {
  try {
    console.log('🌱 Starting giros and operations seeding...');

    // 1. Seed Giros (Business Categories)
    const giros = [
      {
        name: 'RESTAURANT',
        description: 'Restaurantes y servicios de alimentación',
        code: 'REST',
        active: 1
      },
      {
        name: 'HOTEL',
        description: 'Hoteles y hospedaje',
        code: 'HOTEL',
        active: 1
      },
      {
        name: 'RETAIL',
        description: 'Tiendas minoristas y comercio general',
        code: 'RETAIL',
        active: 1
      },
      {
        name: 'TRANSPORT',
        description: 'Servicios de transporte',
        code: 'TRANS',
        active: 1
      },
      {
        name: 'HEALTHCARE',
        description: 'Servicios médicos y de salud',
        code: 'HEALTH',
        active: 1
      },
      {
        name: 'SERVICES',
        description: 'Servicios profesionales y generales',
        code: 'SERV',
        active: 1
      }
    ];

    console.log('📝 Creating giros...');
    for (const giroData of giros) {
      const [giro, created] = await db.isoGiro.findOrCreate({
        where: { code: giroData.code },
        defaults: giroData
      });
      
      if (created) {
        console.log(`✅ Created giro: ${giro.name}`);
      } else {
        console.log(`ℹ️ Giro already exists: ${giro.name}`);
      }
    }

    // 2. Seed Operations by Giro
    const operationsByGiro = {
      REST: [
        {
          name: 'Venta con Propina',
          description: 'Procesamiento de venta con opción de propina',
          operation_code: 'SALE_WITH_TIP',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 1, // Tip optional
          display_order: 1,
          icon_name: 'restaurant'
        },
        {
          name: 'Venta Rápida',
          description: 'Procesamiento de venta sin propina',
          operation_code: 'QUICK_SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'sale'
        },
        {
          name: 'Preautorización',
          description: 'Preautorización de monto',
          operation_code: 'PREAUTH',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 3,
          icon_name: 'lock'
        },
        {
          name: 'Confirmación de Preautorización',
          description: 'Confirmar preautorización existente',
          operation_code: 'PREAUTH_COMPLETE',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 4,
          icon_name: 'check'
        },
        {
          name: 'Cancelación de Preautorización',
          description: 'Cancelar preautorización existente',
          operation_code: 'PREAUTH_CANCEL',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 0,
          requires_tip: 0,
          display_order: 5,
          icon_name: 'cancel'
        }
      ],
      HOTEL: [
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
          requires_tip: 1, // Tip optional
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
          name: 'Preautorización Extendida',
          description: 'Extender preautorización existente',
          operation_code: 'EXTEND_PREAUTH',
          msg_type: '0220',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 4,
          icon_name: 'clock'
        }
      ],
      RETAIL: [
        {
          name: 'Venta',
          description: 'Venta estándar de retail',
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
      TRANSPORT: [
        {
          name: 'Pago de Servicio',
          description: 'Pago por servicios de transporte',
          operation_code: 'SERVICE_PAYMENT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 1, // Tip optional
          display_order: 1,
          icon_name: 'car'
        },
        {
          name: 'Prepago',
          description: 'Recarga o prepago de servicios',
          operation_code: 'PREPAY',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'wallet'
        }
      ],
      HEALTHCARE: [
        {
          name: 'Pago de Consulta',
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
          name: 'Pago de Farmacia',
          description: 'Compra en farmacia',
          operation_code: 'PHARMACY_PAYMENT',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'pill'
        }
      ],
      SERVICES: [
        {
          name: 'Pago de Servicio',
          description: 'Pago por servicios profesionales',
          operation_code: 'PROFESSIONAL_SERVICE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 1,
          icon_name: 'briefcase'
        },
        {
          name: 'Venta General',
          description: 'Venta de productos o servicios',
          operation_code: 'GENERAL_SALE',
          msg_type: '0200',
          processing_code: '000000',
          requires_amount: 1,
          requires_tip: 0,
          display_order: 2,
          icon_name: 'store'
        }
      ]
    };

    // 3. Create operations for each giro
    console.log('🔧 Creating operations...');
    for (const [giroCode, operations] of Object.entries(operationsByGiro)) {
      const giro = await db.isoGiro.findOne({ where: { code: giroCode } });
      
      if (!giro) {
        console.log(`⚠️ Giro not found: ${giroCode}`);
        continue;
      }

      for (const opData of operations) {
        const [operation, created] = await db.processingOperations.findOrCreate({
          where: { 
            id_giro: giro.id_giro,
            operation_code: opData.operation_code 
          },
          defaults: {
            ...opData,
            id_giro: giro.id_giro,
            active: 1,
            updated_at: new Date()
          }
        });
        
        if (created) {
          console.log(`✅ Created operation: ${operation.name} for ${giro.name}`);
        } else {
          console.log(`ℹ️ Operation already exists: ${operation.name} for ${giro.name}`);
        }
      }
    }

    console.log('🎉 Giros and operations seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding giros and operations:', error);
    throw error;
  }
}

module.exports = {
  seedGirosAndOperations
};
