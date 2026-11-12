const db = require("../../../sequelize/init");

const controller = {};

function sendError(res, err, code = 500){
  res.status(code).json({ status:"error" , err })
}

// OBTIENE LOS CLIENTES / CLIENTE
controller.get = async (req,res) => {
  let id = req.body.id;
  if(id){
    db.isoClient.findOne({where: {id_client: id}, include: [
        {
          model: db.datosBancarios,
          as: 'datos_bancarios',
          attributes: ['banco', 'tarjeta', 'no_cuenta', 'clabe']
        },
        {
          model: db.datosDireccion,
          as: 'datos_direccion',
          attributes: [
            'calle',
            'no_ext',
            'no_int',
            'colonia',
            'alcaldia',
            'ciudad',
            'cp',
            'id_country',
            'id_state'
          ]
        },
      ],
        raw: true
      }).then(async result => {
      if (!result) {
        return res.status(404).json({ error:"not found" });
      }

      const address = extractKeys(result, 'datos_direccion.')
      const bank    = extractKeys(result, 'datos_bancarios.')

      return res.json({
        status: "ok",
        data: {...result, address,bank}
      })
    })
    .catch(err => {
      return res.status(500).json({error: err})
    })
  } else {
    await db.isoClient.findAll().then(async result => {
      if(!result) {
        return res.status(404).json({ error:"not found" });
      }
      return res.json({
        status: "ok",
        data: result
      })
    });
  }
}

// CREAR UN CLIENTE
controller.create = async (req,res) => {

  const address = extractKeys(req.body, 'dir.')
  const bank    = extractKeys(req.body, 'banco.')
  const { 
    id_persona,
    name,
    razon_social,
    rfc,
    representative,
    url,
    description,
    agente,
    contact_cliente,
    rol_contact,
    email_contact,
    tel1_contact,
    tel2_contact,
    mobile_contact
  } = req.body;

  const validate = await db.isoClient.findOne({where: { name: name }});
  
  if (validate != null || undefined) {
      return res.json({ message : 'El nombre comercial debe ser único' }, 404)
  }

  try {
    const dataAddress           = await db.datosDireccion.create(address);
    const dataBank              = await db.datosBancarios.create(bank);
    const id_direccion          = dataAddress.id;
    const id_datos_bancarios    = dataBank.id;

    const newClientData = {
      id_persona,
      razon_social,
      name,
      rfc,
      representative,
      url,
      description,
      agente,
      contact_cliente,
      rol_contact,
      email_contact,
      tel1_contact,
      tel2_contact,
      mobile_contact,
      id_direccion,
      id_datos_bancarios
    }

    const newClient = await db.isoClient.create(newClientData);

    if(newClient){
      return res.json({ status:"ok", response: "Cliente creado exitosamente", id: newClient.id_client})
    }else{
      return res.json({ status:"error", response: "Cliente no pudo ser creado", id: 0 })
    }
  } catch (error) {
      sendError(res,error);
  }
}

function extractKeys(obj, prefico) {
  const result = {};

  for (const key in obj) {
      if (key.startsWith(prefico))
          result[key.replace(prefico, '')] = obj[key];
  }

  return result;
}

// EDITA UN CLIENTE
controller.edit = async (req,res) => {

  
  try {

    const direccion   = extractKeys(req.body, 'dir.');
    const banco       = extractKeys(req.body, 'banco.');

    const id_direccion = !req.body.id_direccion ? 
        await db.datosDireccion.create(direccion).then(dato_direccion => dato_direccion.id) :
        await db.datosDireccion.update(direccion, { where: { id: req.body.id_direccion } }).then(() => req.body.id_direccion);

    const id_datos_bancarios = !req.body.id_datos_bancarios ?
        await db.datosBancarios.create(banco).then(dato_bancario => dato_bancario.id):
        await db.datosBancarios.update(banco, { where: { id: req.body.id_datos_bancarios } }).then(() => req.body.id_datos_bancarios);
    
    const { 
      id_persona,
      name,
      razon_social,
      rfc,
      representative,
      url,
      description,
      agente,
      contact_cliente,
      rol_contact,
      email_contact,
      tel1_contact,
      tel2_contact,
      mobile_contact,
      id_client
    } = req.body;

    // return res.json({message: "en la función de edición", direccion, banco, id_direccion, id_datos_bancarios, id_client},400)

    const updated = await db.isoClient.update({
      id_persona,
      name,
      razon_social,
      rfc,
      representative,
      url,
      description,
      agente,
      contact_cliente,
      rol_contact,
      email_contact,
      tel1_contact,
      tel2_contact,
      mobile_contact,
    },{ where: { id_client: id_client } })


    if(updated){
      return res.json({ status:"ok", response: "Cliente creado exitosamente", id: updated.id_client})
    }else{
      return res.json({ status:"error", response: "Cliente no pudo ser creado", id: 0 })
    }
} catch (error) {
    console.log(error);
}
  
  
}

// ELIMINA UN CLIENTE
controller.delete =  async (req,res) => {
  try {
    await db.isoClient.destroy({ where: { id_client: req.body.id} })
    res.json({ status:'ok', response:"Cliente eliminado exitosamente" });
  } catch (error) {
    sendError(res,error);
  }
}


module.exports = controller