const userCtrl = {};
const db = require('../../../sequelize/init');
var _ = require('lodash');

// ⚡ USE THE FUCKING CACHE CONTROLLER
const transactionCacheController = require('../../transactionCacheController');

userCtrl.getDataProfile = async (req, res, next) => {
  let dataOutput = await getUserProfile(req);
  res.json(dataOutput);
}

getUserProfile = async (req) => {

  ///////////////////////////////////
  // OBTENGO LAS TRANSACCIONES - USE THE CACHE SYSTEM
  var d1, d2;
  if(req.clear){
    d1 = new Date(); d1.setDate(d1.getDate() + 1);
    d2 = new Date(); d2.setDate(d2.getDate() + 1);
  }
  else if(!req.body.fechas){
    d1 = new Date(); d1.setDate(d1.getDate() - 1);
    d2 = new Date();
  }else{
    const f = req.body.fechas.split(' ');
    d1 = new Date(f[0]);
    d2 = new Date(f[1]);
  }

  console.log('📅 Dashboard requesting data for dates:', {
    start: d1.toISOString(),
    end: d2.toISOString()
  });

  // ⚡ USE THE FUCKING CACHE SYSTEM DIRECTLY
  let transacciones = await transactionCacheController.getTransactionsByDateRange({
    onlyResponse: true,
    fechas: `${d1.toISOString()} ${d2.toISOString()}`
  }, req);

  console.log(`📊 Cache returned: ${transacciones ? transacciones.length : 0} transactions`);

  // If cache returns nothing, use direct database query
  if (!transacciones || transacciones.length === 0) {
    console.log('⚠️ Cache returned empty, using direct database query');
    transacciones = await getTransactionsDirect(d1, d2, req);
  }

  console.log(`📊 Final count: ${transacciones.length} transactions for dashboard`);

  // ⚡ NOW PROCESS THE FUCKING DATA LIKE BEFORE
  let dataOutput = {
    data: [],             total_t: transacciones.length,
    total_aprob: [],      total_rech: [],
    total_activos: 0,     total_inactivos: 0,
    rechazos: [],         fechas_aprob: [] ,              fechas_rech: [],
    label: {} ,           tipo_prod: [],                  marca_t: [],
    tipo_prod_string: '', marca_t_string: ''
  };

  let topRechazo = 5;
  for (const transaccion of transacciones) {
    let date = new Date( transaccion.creation_date ).toLocaleDateString("en-GB");
    transaccion.date = date;
    dataOutput.label[transaccion.date] = transaccion.date;

    // ✅ CONVERT AMOUNT FROM CENTS TO DOLLARS FOR DISPLAY
    // TransactionContext ensures amounts are stored in cents
    if (transaccion.amount) {
      const amountCents = Number(transaccion.amount) || 0;
      transaccion.amount_cents = amountCents;           // Keep raw cents for calculations
      transaccion.amount = (amountCents / 100).toFixed(2); // Convert to dollars for display
      transaccion.amount_formatted = `$${(amountCents / 100).toFixed(2)}`;
    }

    if((transaccion.resp_code == '00' || transaccion.resp_code == '0') && transaccion.msg_type == '0200'){
      dataOutput.total_aprob.push(transaccion);
    }else if(transaccion.msg_type == '0200'){ // Only count 0200 transactions as rejections
      dataOutput.total_rech.push(transaccion);
      if(dataOutput.rechazos.length == 0 && transaccion.codigo_resp){
        dataOutput.rechazos.push({
          id: transaccion.codigo_resp.id_response_code,
          name: transaccion.codigo_resp.description,
          count: 1
        })
      }else{
        var auxFound = false;
        for (const key in dataOutput.rechazos) {
          if (Object.hasOwnProperty.call(dataOutput.rechazos, key)) {
            const element = dataOutput.rechazos[key];
            if(!auxFound && transaccion.codigo_resp && element.id == transaccion.codigo_resp.id_response_code){
              auxFound= true;
              dataOutput.rechazos[key].count ++;
            }
          }
        }
        if(!auxFound && transaccion.codigo_resp && dataOutput.rechazos.length < (topRechazo + 1) ){
          dataOutput.rechazos.push({
            id: transaccion.codigo_resp.id_response_code,
            name: transaccion.codigo_resp.description,
            count: 1
          })
        }
      }
    }

    let tipo_prod = {};
    switch(transaccion.card_type){
      case '00': tipo_prod = {id_card_type: 0, name: 'INTERNACIONAL'}; break;
      case 'C0': tipo_prod = {id_card_type: 1, name: 'CREDITO'}; break;
      case 'P0': tipo_prod = {id_card_type: 2, name: 'DEBITO'}; break;
      default: tipo_prod = {id_card_type: -1, name: 'DESCONOCIDO'}; break;
    }
    if(tipo_prod.name){
      dataOutput.tipo_prod.push(tipo_prod);
    }

    if(transaccion.bin_info){
      dataOutput.marca_t.push(transaccion.bin_info.tipo_tarjeta);
    }else{
      let metodo = {};
      if(transaccion.bin){
        switch(transaccion.bin.substring(0,1)){
          case '3':metodo = {id_brand:1 ,name:'AMEX'}; break;
          case '4':metodo = {id_brand:4 ,name:'VISA'}; break;
          case '5':metodo = {id_brand:3 ,name:'MASTERCARD'}; break;
          default: metodo = {id_brand: -1, name: 'OTRA'}; break;
        }
      } else {
        metodo = {id_brand: -1, name: 'NO DISPONIBLE'};
      }
      if(metodo.id_brand){
        dataOutput.marca_t.push(metodo);
      }
    }

    dataOutput.data.push(transaccion);
  }

  let colors = ["#3498DB", "#E74C3C", "#9B59B6", "#BDC3C7", "#26B99A"]
  let count = 0;

  let aux = _.groupBy(dataOutput.tipo_prod,'id_card_type');
  let auxx = [];
  count = 0;
  Object.keys(aux).forEach(v =>{
    auxx.push({name: aux[v][0].name , count: aux[v].length , porc: 0 , color: colors[count]});
    count ++;
  })
  auxx.map(v =>{ v.porc = (v.count * 100 /dataOutput.tipo_prod.length).toFixed(2) });
  if(auxx.length == 0){auxx.push({name: 'Sin datos' , count: 0 , porc: 0, color: 'gray'})}
  dataOutput.tipo_prod = auxx;
  dataOutput.tipo_prod_string = JSON.stringify(auxx);

  aux = _.groupBy(dataOutput.marca_t,'id_brand');
  auxx = [];
  count = 0;
  Object.keys(aux).forEach(v =>{
    auxx.push({name: aux[v][0].name , count: aux[v].length , porc: 0, color: colors[count]} );
    count ++;
  })
  auxx.map(v =>{ v.porc = (v.count * 100 /dataOutput.marca_t.length).toFixed(2) });
  if(auxx.length == 0){auxx.push({name: 'Sin datos' , count: 0 , porc: 0, color: 'gray'})}
  dataOutput.marca_t = auxx;
  dataOutput.marca_t_string = JSON.stringify(auxx);

  let label_ready = [];
  let objGrafica = (data , labels) =>{
    label_ready = [];
    let newAux = [];
    Object.keys(labels).forEach( label =>{
      label_ready.push(label);
      let auxData = 0;
      for (const key in data) {
        if (Object.hasOwnProperty.call(data, key) && auxData == 0) {
          const element = data[key];
          if(key == label){
            auxData = element.length;
          }
        }
      }
      newAux.push(auxData);
    })
    return newAux;
  }

  aux = _.groupBy(dataOutput.total_aprob,'date');
  dataOutput.fechas_aprob = JSON.stringify(objGrafica(aux, dataOutput.label));

  aux = _.groupBy(dataOutput.total_rech,'date');
  dataOutput.fechas_rech = JSON.stringify(objGrafica(aux, dataOutput.label));

  dataOutput.label = label_ready;

  for (const key in dataOutput.rechazos) {
    if (Object.hasOwnProperty.call(dataOutput.rechazos, key)) {
      const element = dataOutput.rechazos[key];
      element.porc = (element.count * 100 / dataOutput.total_rech.length).toFixed(2);
      dataOutput.rechazos[key] = element;
    }
  }
  dataOutput.rechazos= _.orderBy(dataOutput.rechazos,'count' ,'desc')

  const merchants = await db.merchant.findAll({
    where: (req.user.is_admin == 1)? null: {
      id_client: req.user.id_cliente
    }
  });
  for (const merchant of merchants) {
    if(merchant.active == 1){
      dataOutput.total_activos ++;
    }else{
      dataOutput.total_inactivos ++;
    }
  }

  console.log(`✅ Dashboard processing completed: ${dataOutput.total_t} transactions`);
  return dataOutput;
}

// Direct database query as fallback
async function getTransactionsDirect(startDate, endDate, req) {
  try {
    const { Op } = require('sequelize');

    const transactions = await db.isoMessage.findAll({
      where: {
        creation_date: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [
        {
          model: db.cisoResponseCode,
          as: 'codigo_resp',
          attributes: ['id_response_code', 'description']
        },
        {
          model: db.cisoOperation,
          as: 'tipo_operacion',
          attributes: ['id_operation', 'name']
        },
        {
          model: db.binInfo,
          as: 'bin_info',
          attributes: ['tipo_tarjeta'],
          include: [{
            model: db.cisoCardType,
            as: 'tipo_tarjeta',
            attributes: ['name']
          }]
        }
      ],
      attributes: ['msg_type'], // Ensure msg_type is included
      order: [['creation_date', 'DESC']]
    });

    console.log(`✅ Direct query found ${transactions.length} transactions`);
    return transactions;

  } catch (error) {
    console.error('❌ Direct query error:', error);
    return [];
  }
}

module.exports = userCtrl;