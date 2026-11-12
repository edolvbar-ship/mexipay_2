const axios = require('axios');

const tlvClass = class tlvClass {
  constructor() {
    this.object = {
      isoType: 'ISO',
      amount: '5.00',
      reference: '200216122612',
      cardInformation: {
        holder_name: 'Luis Bravo Murrieta',
        card_number: '5579100155521006',
        last4: '1111',
        bin: '557910',
        expiration_year: '21',
        expiration_month: '12',
        cvv: '123',
      },
      entry_mode: 'manual',
      authentication: 'unknown',
      draftCapture: '1',
      tpv: false,
      periodic: false,
    };

    this.data_headers = {
      id_comerce: '8621349',
    };
  }
  randomTx(){
    this.object.amount    = Math.floor((Math.random() * 100) + 1).toFixed(2);
    this.object.reference = Math.floor(100000 + Math.random() * 900000000000);
    this.object.cardInformation.last4     = Math.floor(1000 + Math.random() * 9999);
  }
  ejecutarTxs(number = 3 , req = { body:{} }) {

    console.log(`**************** Ejecutando transacciones *****************`);
    const url = req.body.url ? req.body.url : 'http://localhost:3000/gateway/v1/ecommerce/charge';
    const headers = {
      'Content-Type': 'application/json',
      'commerce-id':  (req.body.commerce_id) ? req.body.commerce_id : '8262003',
      'commerce-name':(req.body.commerce_name) ? req.body.commerce_name : 'Comercio Pruebas1',
      'system-fiid':  'B021',
      'X-Time':       (req.body.x_time) ? req.body.x_time : '1637129080992',
      'X-Auth':       (req.body.x_auth) ? req.body.x_auth : '$2b$11$kWdx27kL/hUlzf1MWuNfX.FIe9sSdyseeQvvYy.lNO4MX9kE7QrVy'
    }
    for (let index = 0; index <= number; index++) {
      this.randomTx();
      console.log('****** Se ejecuta petición ', this.object);

      axios.post( url , this.object , {
        headers: headers
      }).then(res => {
        console.log(`statusCode: ${res.status}`)
        console.log(res.data)
      }).catch(error => {
        console.log(`Error..... en peticion `)
        // console.error(error)
      })
      
    }

    console.log(`****************Finaliza ejecutar transacciones*****************`);
  }

    
}

module.exports = tlvClass;