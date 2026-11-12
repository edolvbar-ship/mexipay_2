const db = require("../../../sequelize/init");

const controller = {};

controller.get = async (req, res , next) => {
  try {
    const [ perfilTransaccional, esquemaTransaccional, tipoPersona, procesador, mcc, bancosAdquirientes, redLogica, modoTransaccion, urlDestino, ] = await Promise.all([
      db.isoProfileTrans.findAll(),
      db.isoEsquemaTrans.findAll(),
      db.tipoPersona.findAll(),
      db.isoProcessor.findAll(),
      db.isoMcc.findAll(),
      db.isoAcquiererBank.findAll(),
      db.isoLogicalNetwork.findAll(),
      db.bnrgModoTransac.findAll(),
      db.bnrgUrlDest.findAll(),
    ]);

    return res.json({
      perfilTransaccional,
      esquemaTransaccional,
      tipoPersona,
      procesador,
      mcc,
      bancosAdquirientes,
      redLogica,
      modoTransaccion,
      urlDestino,
    });
  } catch (error) {
    return res.status(500).json({ error })
  }
}

module.exports = controller