require('dotenv').config()
const db = require('../init');

async function seedEnhancedMccOperations() {
  try {
    console.log('🏪 Starting Enhanced MCC-based operations seeding...');

    // Define operations by specific category codes with backend routes
    const operationsByCategory = [
      // FOOD_58X - Restaurant Operations
      {
        category_code: 'FOOD_58X',
        mcc_range_start: '581',
        mcc_range_end: '581',
        backend_route: 'restaurant',
        description: 'Restaurant & Food Services',
        operations: [
          {
            name: 'Check In',
            description: 'Registro de mesa y preautorización',
            operation_code: 'checkin',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 1,
            icon_name: 'login'
          },
          {
            name: 'Charge',
            description: 'Cargo estándar de restaurante',
            operation_code: 'charge',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 2,
            icon_name: 'restaurant'
          },
          {
            name: 'Check Out',
            description: 'Cierre de cuenta y pago final',
            operation_code: 'checkout',
            msg_type: '0220',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 1,
            display_order: 3,
            icon_name: 'logout'
          },
          {
            name: 'Add Tip',
            description: 'Agregar propina a transacción',
            operation_code: 'tip',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 1,
            display_order: 4,
            icon_name: 'dollar'
          },
          {
            name: 'Post Tip',
            description: 'Propina diferida',
            operation_code: 'posttip',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 1,
            display_order: 5,
            icon_name: 'clock'
          },
          {
            name: 'Close Post Tip',
            description: 'Cerrar propina diferida',
            operation_code: 'closePostTip',
            msg_type: '0220',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 1,
            display_order: 6,
            icon_name: 'check'
          },
          {
            name: 'Reauthorize',
            description: 'Reautorizar transacción',
            operation_code: 'reauthorize',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 7,
            icon_name: 'refresh'
          }
        ]
      },

      // BAR_FOOD_58X - Bar Operations (Tab Management)
      {
        category_code: 'BAR_FOOD_58X',
        mcc_range_start: '581',
        mcc_range_end: '581',
        backend_route: 'bar',
        description: 'Bar & Tab Management',
        operations: [
          {
            name: 'Check In',
            description: 'Abrir tab y preautorización',
            operation_code: 'checkin',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 1,
            icon_name: 'login'
          },
          {
            name: 'Check Out',
            description: 'Cerrar tab y liquidar',
            operation_code: 'checkout',
            msg_type: '0220',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 1,
            display_order: 2,
            icon_name: 'logout'
          },
          {
            name: 'Reauthorize',
            description: 'Aumentar límite del tab',
            operation_code: 'reauthorize',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 3,
            icon_name: 'refresh'
          }
        ]
      },

      // BUSINESS_7XX - Hotel Operations
      {
        category_code: 'BUSINESS_7XX',
        mcc_range_start: '700',
        mcc_range_end: '799',
        backend_route: 'hotel',
        description: 'Hotel & Business Services',
        operations: [
          {
            name: 'Check In',
            description: 'Registro de huésped y preautorización',
            operation_code: 'checkin',
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
            operation_code: 'checkout',
            msg_type: '0220',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 1,
            display_order: 2,
            icon_name: 'logout'
          },
          {
            name: 'Reauthorize',
            description: 'Extender o modificar autorización',
            operation_code: 'reauthorize',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 3,
            icon_name: 'refresh'
          }
        ]
      },

      // RETAIL_5XX - Standard Retail Operations
      {
        category_code: 'RETAIL_5XX',
        mcc_range_start: '500',
        mcc_range_end: '580',
        backend_route: 'retail',
        description: 'Standard POS Retail',
        operations: [
          {
            name: 'Charge',
            description: 'Venta estándar de retail',
            operation_code: 'charge',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 1,
            icon_name: 'shopping_cart'
          },
          {
            name: 'Refund',
            description: 'Devolución de pago',
            operation_code: 'refund',
            msg_type: '0220',
            processing_code: '020000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 2,
            icon_name: 'return'
          },
          {
            name: 'Cancel',
            description: 'Cancelar transacción',
            operation_code: 'cancel',
            msg_type: '0220',
            processing_code: '020000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 3,
            icon_name: 'cancel'
          },
          {
            name: 'Reverse',
            description: 'Reversar transacción',
            operation_code: 'reverse',
            msg_type: '0420',
            processing_code: '020000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 4,
            icon_name: 'undo'
          }
        ]
      },

      // ECOMMERCE_RETAIL_5XX - E-commerce Operations
      {
        category_code: 'ECOMMERCE_RETAIL_5XX',
        mcc_range_start: '500',
        mcc_range_end: '580',
        backend_route: 'ecommerce',
        description: 'Online Retail with 3DS',
        operations: [
          {
            name: 'Charge',
            description: 'Pago en línea',
            operation_code: 'charge',
            msg_type: '0200',
            processing_code: '090000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 1,
            icon_name: 'credit_card'
          },
          {
            name: 'Preauth',
            description: 'Preautorización en línea',
            operation_code: 'preauth',
            msg_type: '0200',
            processing_code: '090000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 2,
            icon_name: 'lock'
          },
          {
            name: 'Postauth',
            description: 'Completar preautorización',
            operation_code: 'postauth',
            msg_type: '0220',
            processing_code: '090000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 3,
            icon_name: 'check'
          },
          {
            name: 'Cancel',
            description: 'Cancelar transacción',
            operation_code: 'cancel',
            msg_type: '0220',
            processing_code: '090000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 4,
            icon_name: 'cancel'
          },
          {
            name: 'Refund',
            description: 'Devolución en línea',
            operation_code: 'refund',
            msg_type: '0220',
            processing_code: '090000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 5,
            icon_name: 'return'
          },
          {
            name: 'Reverse',
            description: 'Reversar transacción',
            operation_code: 'reverse',
            msg_type: '0420',
            processing_code: '090000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 6,
            icon_name: 'undo'
          }
        ]
      },

      // MOTO_RETAIL_5XX - Mail/Telephone Order Operations
      {
        category_code: 'MOTO_RETAIL_5XX',
        mcc_range_start: '500',
        mcc_range_end: '580',
        backend_route: 'moto',
        description: 'Mail/Telephone Order',
        operations: [
          {
            name: 'Charge',
            description: 'Pago por teléfono/correo',
            operation_code: 'charge',
            msg_type: '0200',
            processing_code: '080000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 1,
            icon_name: 'phone'
          },
          {
            name: 'Cancel',
            description: 'Cancelar orden telefónica',
            operation_code: 'cancel',
            msg_type: '0220',
            processing_code: '080000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 2,
            icon_name: 'cancel'
          },
          {
            name: 'Refund',
            description: 'Devolución de orden telefónica',
            operation_code: 'refund',
            msg_type: '0220',
            processing_code: '080000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 3,
            icon_name: 'return'
          },
          {
            name: 'Reverse',
            description: 'Reversar orden telefónica',
            operation_code: 'reverse',
            msg_type: '0420',
            processing_code: '080000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 4,
            icon_name: 'undo'
          }
        ]
      },

      // SERVICES_3XX - Car Rental Operations
      {
        category_code: 'SERVICES_3XX',
        mcc_range_start: '300',
        mcc_range_end: '399',
        backend_route: 'car',
        description: 'Car Rental & Services',
        operations: [
          {
            name: 'Check In',
            description: 'Inicio de renta',
            operation_code: 'checkin',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 1,
            icon_name: 'car'
          },
          {
            name: 'Charge',
            description: 'Cargo por renta',
            operation_code: 'charge',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 2,
            icon_name: 'dollar'
          },
          {
            name: 'Check Out',
            description: 'Fin de renta',
            operation_code: 'checkout',
            msg_type: '0220',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 3,
            icon_name: 'car_return'
          },
          {
            name: 'Rent In',
            description: 'Rentar vehículo',
            operation_code: 'rentin',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 4,
            icon_name: 'arrow_in'
          },
          {
            name: 'Rent Out',
            description: 'Devolver vehículo',
            operation_code: 'rentout',
            msg_type: '0220',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 5,
            icon_name: 'arrow_out'
          },
          {
            name: 'Reauthorize',
            description: 'Modificar renta',
            operation_code: 'reauthorize',
            msg_type: '0200',
            processing_code: '000000',
            requires_amount: 1,
            requires_tip: 0,
            display_order: 6,
            icon_name: 'refresh'
          }
        ]
      }
    ];

    // Create operations for each category
    console.log('🔧 Creating enhanced MCC-based operations...');
    for (const category of operationsByCategory) {
      console.log(`📝 Processing category ${category.category_code} (${category.backend_route})...`);
      
      for (const opData of category.operations) {
        const [operation, created] = await db.mccOperations.findOrCreate({
          where: { 
            mcc_range_start: category.mcc_range_start,
            operation_code: opData.operation_code,
            category_code: category.category_code
          },
          defaults: {
            ...opData,
            mcc_range_start: category.mcc_range_start,
            mcc_range_end: category.mcc_range_end,
            category_code: category.category_code,
            backend_route: category.backend_route,
            active: 1,
            updated_at: new Date()
          }
        });
        
        if (!created) {
          // Update existing operation to ensure it matches the requested configuration
          await operation.update({
            ...opData,
            mcc_range_end: category.mcc_range_end,
            category_code: category.category_code,
            backend_route: category.backend_route,
            updated_at: new Date()
          });
          console.log(`✅ Updated existing operation: ${operation.name} for category ${category.category_code}`);
        } else {
          console.log(`✅ Created operation: ${operation.name} for category ${category.category_code}`);
        }
      }
    }

    // Summary report
    console.log('\n📊 Enhanced MCC Operations Summary:');
    for (const category of operationsByCategory) {
      const count = category.operations.length;
      console.log(`   ${category.category_code}: ${count} operations -> ${category.backend_route}`);
    }

    console.log('\n🎉 Enhanced MCC-based operations seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding enhanced MCC operations:', error);
    throw error;
  }
}

module.exports = {
  seedEnhancedMccOperations
};
