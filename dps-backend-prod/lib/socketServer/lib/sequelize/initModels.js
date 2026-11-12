// lib/socketServer/lib/sequelize/initModels.js
module.exports = (sequelize , Sequelize, db) => {
  // INSTANCIA LOS MODELOS 

    //  TRANSACCIONES
    db.isoMessage  = require('./models/IsoMessage')(sequelize, Sequelize);
    db.cisoOperation  = require('./models/CisoOperation')(sequelize,Sequelize);
    db.cisoBin     = require('./models/CisoBin')(sequelize,Sequelize);
    db.isoClient   = require('./models/IsoClient')(sequelize,Sequelize);
    db.cisoRespCode   = require('./models/CisoResponseCode')(sequelize,Sequelize);
    db.isoIssuerBank  = require('./models/IsoIssuerBank')(sequelize,Sequelize);
    db.catStatusF = require('./models/CatStatusFinanciero')(sequelize,Sequelize);

    //
    db.isoApiLog = require('./models/IsoApiLog')(sequelize,Sequelize);
    db.contracargos = require('./models/Contracargos')(sequelize,Sequelize);
    db.signatures = require('./models/Signatures')(sequelize,Sequelize);

    // CATALOGOS
    db.isoCardTypes = require('./models/isoCardType')(sequelize,Sequelize);
    db.isoBrand = require('./models/IsoBrand')(sequelize,Sequelize);
    db.isoProcessor = require('./models/IsoProcessor')(sequelize,Sequelize);
    db.tipoPersona = require('./models/tipoPersona')(sequelize,Sequelize);
    db.isoEsquemaTrans = require('./models/IsoEsquemaTransactional')(sequelize,Sequelize);
    db.isoMcc = require('./models/IsoMcc')(sequelize,Sequelize);
    db.isoAcquiererBank = require('./models/IsoAcquirerBank')(sequelize,Sequelize);
    db.isoLogicalNetwork = require('./models/IsoLogicalNetwork')(sequelize,Sequelize);
    db.cisoState = require('./models/CisoState')(sequelize,Sequelize);
    db.cisoCountry = require('./models/CisoCountry')(sequelize,Sequelize);
    db.isoAggregator = require('./models/IsoAgregador')(sequelize,Sequelize);
    db.taxRegimen = require('./models/TaxRegimen')(sequelize,Sequelize);
    db.bnrgModoTransac = require('./models/BnrgModoTransac')(sequelize,Sequelize);
    db.bnrgUrlDest = require('./models/BnrgUrlDest')(sequelize,Sequelize);
    
    // MERCHANT
    db.merchant    = require('./models/Merchant')(sequelize);
    db.datosDireccion = require('./models/DatosDireccion')(sequelize,Sequelize);
    db.datosBancarios = require('./models/DatosBancarios')(sequelize,Sequelize);
    db.isoProfileTrans = require('./models/IsoProfileTrans')(sequelize,Sequelize);

    // GIRO AND OPERATIONS
    db.isoGiro = require('./models/IsoGiro')(sequelize,Sequelize);
    db.processingOperations = require('./models/ProcessingOperations')(sequelize,Sequelize);
    db.mccOperations = require('./models/MccOperations')(sequelize,Sequelize);

    // ROLES DE USUARIO
    db.profileUsers = require('./models/ProfileUsers')(sequelize,Sequelize);
    db.resources = require('./models/Resources')(sequelize,Sequelize);
    db.profileResources = require('./models/ProfileResources')(sequelize,Sequelize);
    db.users = require('./models/Users')(sequelize,Sequelize);

    db.migrations = require('./models/Migrations')(sequelize,Sequelize);

    // LINKS DE PAGO
    db.linksPago = require('./models/linksPago')(sequelize,Sequelize);
    db.archivosBatch = require('./models/archivosBatch')(sequelize,Sequelize);

    // CONSOLIDADO
    db.consolidadosTx = require('./models/ConsolidadosTx')(sequelize,Sequelize);
    db.keyOp = require('./models/KeysOp')(sequelize,Sequelize);
    db.consolidacion = require('./models/Consolidacion')(sequelize);

    db.tresds = require('./models/tresds')(sequelize, Sequelize);

    db.ciso3166  = require('./models/Ciso3166')(sequelize);

    //invoices
    db.invoices = require('./models/invoice')(sequelize,Sequelize);

    // Activity log
    db.activityLog = require('./models/ActivityLog')(sequelize,Sequelize);

    // Selia error codes
    db.selia_error_code = require('./models/SeliaErrorCodes')(sequelize,Sequelize);

    // LDI credentials
    db.ldi_credentials = require('./models/LdiCredentials')(sequelize,Sequelize);

    // MSI Templates
    db.msiTemplate = require('./models/MsiTemplate')(sequelize,Sequelize);
    db.Session = require('./models/Session')(sequelize,Sequelize);

    return db;
}