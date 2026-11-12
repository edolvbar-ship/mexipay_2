const authCtrl = {};
const pool = require("../../../database");


authCtrl.render = async (req,res,next) => {
    let merchant = null
    const isAdmn = req.user.is_admin;
    if( isAdmn == 1){
        merchant = await pool.query(`SELECT A.*, B.name bank, C.mcc, C.description mcc_desc , iln.ln as logical_network , ic.name client_name, 
        db.banco as db_banco , db.tarjeta as db_tarjeta, db.no_cuenta as db_cuenta, db.clabe as db_clabe 
        FROM merchant A 
        LEFT JOIN datos_bancarios db ON db.id = A.id_datos_bancarios
        JOIN iso_client ic ON ic.id_client = A.id_client
        JOIN iso_acquirer_bank B ON A.id_acqbank = B.id_acqbank 
        JOIN iso_mcc C ON A.id_mcc = C.id_mcc 
        JOIN iso_logical_network iln on iln.id_ln = A.id_ln 
        WHERE A.deleted_at IS NULL  
        order by A.afiliation_number`);
    }else{
        merchant = await pool.query(`SELECT A.*, B.name bank, C.mcc, C.description mcc_desc , iln.ln as logical_network, ic.name client_name,  
        db.banco as db_banco , db.tarjeta as db_tarjeta, db.no_cuenta as db_cuenta, db.clabe as db_clabe 
        FROM merchant A 
        LEFT JOIN datos_bancarios db ON db.id = A.id_datos_bancarios
        JOIN iso_client ic ON ic.id_client = A.id_client
        JOIN iso_acquirer_bank B ON A.id_acqbank = B.id_acqbank 
        JOIN iso_mcc C ON A.id_mcc = C.id_mcc 
        JOIN iso_logical_network iln on iln.id_ln = A.id_ln
        WHERE A.id_client = ? 
        AND A.deleted_at IS NULL 
        order by A.afiliation_number`,[req.user.id_cliente]);    
    }
    merchant.map(v=>{
        if(isAdmn){
            v.t_credito = v.tasa_credito_b;
            v.t_debito  = v.tasa_debito_b;
            v.t_amex    = v.tasa_amex_b;
        }else{
            v.t_credito = v.tasa_credito_b;
            v.t_debito  = v.tasa_debito_b;
            v.t_amex    = v.tasa_amex_b;
        }
    })
    // OTIENE LOS CATALOGOS NECESARIOS 
    const clients              = await pool.query('SELECT * FROM iso_client order by name');
    const persona              = await pool.query('SELECT * FROM tipo_persona order by name');
    const banks                = await pool.query('SELECT * FROM iso_acquirer_bank where deletedAt is null order by name');
    const profile_transaction  = await pool.query('SELECT * FROM iso_profile_transaction order by id_profile_transaction');
    const ln                   = await pool.query('SELECT * FROM iso_logical_network where deletedAt is null order by id_ln');
    const esquema              = await pool.query('SELECT * FROM iso_esquema_transactional where deletedAt is null order by id_esquema_transactional');
    const mcc                  = await pool.query('SELECT * FROM iso_mcc where deletedAt is null order by mcc');
    const processor            = await pool.query('SELECT * FROM iso_processor order by id_processor');
    

  res.json({
    merchant ,
    catalogos: {
      clients,
      persona,
      banks,
      profile_transaction,
      ln,
      esquema,
      mcc,
      processor
    }
  })
}

module.exports = authCtrl;