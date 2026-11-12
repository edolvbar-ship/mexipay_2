// seeders/20260325000000-mcc-operations-seeder.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🏪 Starting MCC operations seeder...');

      // Define operations by MCC ranges
      const operationsByMccRange = [
        // 3XX: Travel & Entertainment (Restaurants, Hotels, etc.)
        {
          mcc_range_start: '300',
          mcc_range_end: '399',
          operations: [
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
              name: 'Venta con Propina',
              description: 'Procesamiento de venta con opción de propina',
              operation_code: 'SALE_WITH_TIP',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 1, // Tip optional
              display_order: 3,
              icon_name: 'restaurant'
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
            },
            {
              name: 'Cargo Adicional',
              description: 'Cargo adicional a habitación',
              operation_code: 'ROOM_CHARGE',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 0,
              display_order: 5,
              icon_name: 'plus'
            }
          ]
        },
        
        // 4XX: Transportation Services
        {
          mcc_range_start: '400',
          mcc_range_end: '499',
          operations: [
            {
              name: 'Pago de Transporte',
              description: 'Pago por servicios de transporte',
              operation_code: 'TRANSPORT_PAYMENT',
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
            },
            {
              name: 'Tarifa por Distancia',
              description: 'Cálculo basado en distancia recorrida',
              operation_code: 'DISTANCE_FARE',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 1,
              display_order: 3,
              icon_name: 'route'
            }
          ]
        },
        
        // 5XX: Retail Stores
        {
          mcc_range_start: '500',
          mcc_range_end: '599',
          operations: [
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
            },
            {
              name: 'Orden de Compra',
              description: 'Creación de orden de compra para pago posterior',
              operation_code: 'PURCHASE_ORDER',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 0,
              display_order: 4,
              icon_name: 'clipboard'
            }
          ]
        },
        
        // 7XX: Business Services
        {
          mcc_range_start: '700',
          mcc_range_end: '799',
          operations: [
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
              name: 'Renta In',
              description: 'Inicio de contrato de renta',
              operation_code: 'RENT_IN',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 0,
              display_order: 2,
              icon_name: 'arrow_in'
            },
            {
              name: 'Renta Out',
              description: 'Fin de contrato de renta y cobro final',
              operation_code: 'RENT_OUT',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 0,
              display_order: 3,
              icon_name: 'arrow_out'
            },
            {
              name: 'Depósito',
              description: 'Depósito para garantía o servicios',
              operation_code: 'DEPOSIT',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 0,
              display_order: 4,
              icon_name: 'download'
            }
          ]
        },
        
        // 8XX: Professional Services & Healthcare
        {
          mcc_range_start: '800',
          mcc_range_end: '899',
          operations: [
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
              name: 'Pago de Farmacia',
              description: 'Compra en farmacia',
              operation_code: 'PHARMACY_PAYMENT',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 0,
              display_order: 2,
              icon_name: 'pill'
            },
            {
              name: 'Servicio Profesional',
              description: 'Pago por servicios profesionales',
              operation_code: 'PROFESSIONAL_SERVICE',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 0,
              display_order: 3,
              icon_name: 'user_tie'
            },
            {
              name: 'Educación',
              description: 'Pago por servicios educativos',
              operation_code: 'EDUCATION_PAYMENT',
              msg_type: '0200',
              processing_code: '000000',
              requires_amount: 1,
              requires_tip: 0,
              display_order: 4,
              icon_name: 'book'
            }
          ]
        }
      ];

      // Create operations for each MCC range
      console.log('🔧 Creating MCC-based operations...');
      const allOperations = [];
      
      for (const range of operationsByMccRange) {
        console.log(`📝 Processing range ${range.mcc_range_start}-${range.mcc_range_end || 'XXX'}...`);
        
        for (const opData of range.operations) {
          allOperations.push({
            ...opData,
            mcc_range_start: range.mcc_range_start,
            mcc_range_end: range.mcc_range_end,
            active: 1,
            creation_date: new Date(),
            updated_at: new Date()
          });
          
          console.log(`✅ Adding operation: ${opData.name} for range ${range.mcc_range_start}-${range.mcc_range_end || 'XXX'}`);
        }
      }

      // Bulk insert all operations
      await queryInterface.bulkInsert('mcc_operations', allOperations, { ignoreDuplicates: true });

      console.log('🎉 MCC operations seeder completed successfully!');
      
    } catch (error) {
      console.error('❌ Error seeding MCC operations:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('mcc_operations', null, {});
  }
};
