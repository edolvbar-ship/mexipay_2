//const db = require('../../../sequelize/init');
require('dotenv').config()
const db = require('../init');
async function seedResources() {
  try {
    console.log('🌱 Starting resources seeding...');

    let data = [
      {id:50 , isF:0 , icon:'fa fa-align-justify',	father_resource:null	,resource_name:'Reportes'	,resource_url:'/consolidate', isConfig: 0 },
      {id:1 , isF:0 , icon:'fa fa-home',	father_resource:null	,resource_name:'Dashboard'	,resource_url:'/dashboard', isConfig: 0 },
      {id:13 , isF:0 , icon:'fa fa-users',	father_resource:null	,resource_name:'Clientes'	,resource_url:'/cat/clientes', isConfig: 0 },
      {id:2 , isF:0 , icon:'fa fa-shopping-cart',	father_resource:null	,resource_name:'Comercios'	,resource_url:'/merchant', isConfig: 0 },
      {id:3 , isF:0 , icon:'fa fa-calculator',	father_resource:null	,resource_name:'Terminales'	,resource_url:'/terminals', isConfig: 0 },
      // TARJETS
      {id:4 , isF:1 , icon:'fa fa-credit-card',	father_resource:null	,resource_name:'Tarjetas'	,resource_url:null, isConfig: 0 },
      {id:5 , isF:0 , icon:null,	father_resource:4	,resource_name:'Bines'	,resource_url:'/bines', isConfig: 0 },
      {id:6 , isF:0 , icon:null,	father_resource:4	,resource_name:'Tipos de Tarjeta'	,resource_url:'/cardtypes', isConfig: 0 , deleted: true},
      {id:7 , isF:0 , icon:null,	father_resource:4	,resource_name:'Productos'	,resource_url:'/cardproducttypes', isConfig: 0 , deleted: true},
      {id:8 , isF:0 , icon:null,	father_resource:4	,resource_name:'Marcas'	,resource_url:'/cardbrands', isConfig: 0 ,deleted: true},
      {id:9 , isF:0 , icon:null,	father_resource:4	,resource_name:'Listas Negras'	,resource_url:'/cardblacklist', isConfig: 0 , deleted: true},
      {id:10 , isF:0 , icon:null,	father_resource:4	,resource_name:'Listas Blancas'	,resource_url:'/cardwhitelist', isConfig: 0 , deleted: true},
      // INSTITUCIONES
      {id:16 , isF:1 , icon:'fa fa-institution',	father_resource:null	,resource_name:'Instituciones'	,resource_url:null, isConfig: 0 },
      {id:17 , isF:0 , icon:null,	father_resource:16	,resource_name:'Bancos'	,resource_url:'/cat/bancoAdq', isConfig: 0 },
      {id:18 , isF:0 , icon:null,	father_resource:16	,resource_name:'Procesadores'	,resource_url:'/processors', isConfig: 0,deleted: true},
      // REPORTES
      {id:19 , isF:1 , icon:'fa fa-table',	father_resource:null	,resource_name:'Movimientos'	,resource_url:null, isConfig: 0 },
      {id:20 , isF:1 , icon:null,	father_resource:19	,resource_name:'Regulatorios'	,resource_url:null, isConfig: 0, deleted: true},
      {id:21 , isF:1 , icon:null,	father_resource:19	,resource_name:'Transaccionales'	,resource_url:null, isConfig: 0 },
      {id:22 , isF:0 , icon:null,	father_resource:21	,resource_name:'Liquidación'	,resource_url:'/report/liquidation', isConfig: 0 },
      {id:23 , isF:0 , icon:null,	father_resource:21	,resource_name:'POS JSON'	,resource_url:'/movimientos/pos-json', isConfig: 0 },
      {id:24 , isF:0 , icon:null,	father_resource:21	,resource_name:'Transacciones'	,resource_url:'/movimientos/transacciones', isConfig: 0 },
      {id:25 , isF:0 , icon:null,	father_resource:21	,resource_name:'Tickets'	,resource_url:'/movimientos/tickets', isConfig: 0 },
      {id:57 , isF:0 , icon:null,	father_resource:21	,resource_name:'Transacciones Mejoradas'	,resource_url:'/movimientos/transacciones-mejoradas', isConfig: 0 },
      {id:45 , isF:0 , icon:null,	father_resource:19	,resource_name:'Contracargos'	,resource_url:'/movimientos/contracargos', isConfig: 0 },
      // ARCHIVOS
      {id:42 , isF:1 , icon:'fa fa-files-o',	father_resource:null	,resource_name:'Archivos'	,resource_url:null, isConfig: 0 },
      {id:43 , isF:0 , icon:null,	father_resource:42	,resource_name:'Conciliación'	,resource_url:'/conciliation', isConfig: 0 },
      {id:44 , isF:0 , icon:null,	father_resource:42	,resource_name:'Contracargos'	,resource_url:'/files/contracargo', isConfig: 0 },
      {id:46 , isF:0 , icon:null,	father_resource:42	,resource_name:'Liquidación'	,resource_url:'/files/liquidacion', isConfig: 0 },
      // LINKS PAGO
      {id:47 , isF:1 , icon:'fa fa-link',	father_resource:null	,resource_name:'Links'	,resource_url:null, isConfig: 0 },
      {id:48 , isF:0 , icon:null,	father_resource:47	,resource_name:'Generación'	,resource_url:'/link', isConfig: 0 },
      {id:49 , isF:0 , icon:null,	father_resource:47	,resource_name:'Consulta'	,resource_url:'/link/links', isConfig: 0 },
      // CONFIGURACIÓN
      {id:26 , isF:1 , icon:'fa fa-book',	father_resource:null	,resource_name:'Catálogos'	,resource_url:null, isConfig: 1 },
      {id:27 , isF:0 , icon:null,	father_resource:26	,resource_name:'Tipos de Persona'	,resource_url:'/cat/tipoPersona', isConfig: 1 },
      {id:28 , isF:0 , icon:null,	father_resource:26	,resource_name:'Esquemas Transaccionales'	,resource_url:'/cat/tipoEsquema', isConfig: 1 },
      {id:29 , isF:0 , icon:null,	father_resource:26	,resource_name:'Operaciones (MCC)'	,resource_url:'/cat/mcc', isConfig: 1 },
      {id:30 , isF:0 , icon:null,	father_resource:26	,resource_name:'Bancos Adquirientes'	,resource_url:'/cat/bancoAdq', isConfig: 1 },
      {id:31 , isF:0 , icon:null,	father_resource:26	,resource_name:'Tipos de red'	,resource_url:'/cat/tipoRed', isConfig: 1 },
      {id:32 , isF:0 , icon:null,	father_resource:26	,resource_name:'Procesadores'	,resource_url:'/cat/processador', isConfig: 1 },
      {id:33 , isF:0 , icon:null,	father_resource:26	,resource_name:'Modos de transacción'	,resource_url:'/cat/modoTransaccion', isConfig: 1 },
      {id:34 , isF:0 , icon:null,	father_resource:26	,resource_name:'URLS de destino'	,resource_url:'/cat/urlDestino', isConfig: 1 },
      {id:35 , isF:0 , icon:null,	father_resource:26	,resource_name:'Operaciones MCC'	,resource_url:'/catalogos/mcc-operations', isConfig: 1 },
      {id:41 , isF:0 , icon:null,	father_resource:26	,resource_name:'Perfiles Transaccionales'	,resource_url:'/profile_transaction', isConfig: 0 },
      // SEGURIDAD
      {id:36 , isF:1 , icon:'fa fa-lock',	father_resource:null	,resource_name:'Seguridad'	,resource_url:null, isConfig: 1 },
      {id:37 , isF:0 , icon:null,	father_resource:36	,resource_name:'Usuarios'	,resource_url:'/cat/users', isConfig: 1 },
      {id:38 , isF:0 , icon:null,	father_resource:36	,resource_name:'Perfiles'	,resource_url:'/cat/profiles', isConfig: 1 },
      {id:39 , isF:0 , icon:null,	father_resource:36	,resource_name:'TDM Usuarios'	,resource_url:'/cat/tdm/users', isConfig: 1 },
      // MONITOREO
      {id:40 , isF:1 , icon:'fa fa-bar-chart-o',	father_resource:null	,resource_name:'Monitoreo'	,resource_url:null, isConfig: 1 ,deleted: true},
      {id:56 , isF:0 , icon:null,	father_resource:40	,resource_name:'Network Sesion'	,resource_url:'/isoecholog', isConfig: 1 ,deleted: true},
      {id:55, isF:0, icon:null,  father_resource:19  ,resource_name:'Estados de Cuenta'  ,resource_url:'/report/estados', isConfig: 0,deleted: true},
    ];

    let newValues = [];
    for (const resource of data) {
      const r = await db.resources.findOne({where:{id: resource.id}, paranoid: false });
      if(r){
        r.isF             = resource.isF;
        r.icon            = resource.icon;
        r.father_resource = resource.father_resource;
        r.resource_name   = resource.resource_name;
        r.resource_url    = resource.resource_url;
        r.isConfig        = resource.isConfig;
        r.deleted_at = null;
        if(resource.deleted){
          r.destroy();
        }else{
          await r.save();
        }
      }else{
        newValues.push(resource);
      }
    }

    await db.resources.bulkCreate(newValues);
    console.log('✅ Resources seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding resources:', error);
    throw error;
  }
}

module.exports = {
  seedResources
};

// Allow direct execution
if (require.main === module) {
  seedResources()
    .then(() => {
      console.log('✅ Resources seeder completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Resources seeder failed:', error);
      process.exit(1);
    });
}
