const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../sequelize/init');

const makeEstadoAclaracion = require('./makeEstadoAclaracion');
const makeEstadoInvoiceSection = require('./makeEstadoInvoiceSection');

function h4(doc, pTop, tag) {
    const rowHeight = 12;
    const tableLeft = doc.page.margins.left; 
    const tableWidth = doc.page.width-doc.page.margins.left-doc.page.margins.right;

    doc.rect(tableLeft, pTop, tableWidth, rowHeight)
        .fillColor('black')
        .fill()
        .fillColor('white')
        .fontSize(10).font('Helvetica-Bold').text(tag, tableLeft, pTop + 2, {
            width: tableWidth,
            align: 'center',
            valign: 'center'
        })
        .moveDown()
        .fill()
        .fillColor('black');
}

function head(doc) {

  const corpName     = process.env.ACOUNT_STATE_CORP_NAME     || 'MENFIS TECNOLOGIA Y DESARROLLO S.A de C.V.';
  const corpRFC      = process.env.ACOUNT_STATE_CORP_RFC      || 'MTD1907167B8';
  const corpAddress  = process.env.ACOUNT_STATE_CORP_ADDRESS  || 'Av. SANTA FE 505 PISO 1 MEZZANINE 2B, SANTA FE CUAJIMALPA, CUAJIMALPA DE MORELOS, 05348, CDMX';
 
  // Debug logging for corporate info
  console.log('🏢 Corporate info:', { corpName, corpRFC, corpAddress });
  
  doc.font('Helvetica-Bold').fontSize(14);
  doc.text(`${corpName}\nR.F.C: ${corpRFC}`, doc.page.margins.left, doc.page.margins.top + 20, { width: doc.page.width * 0.8, align: 'left' });
  doc.font('Helvetica').fontSize(8);
  doc.text(`${corpAddress}`, doc.page.margins.left, doc.page.margins.top + 50, { width: doc.page.width * 0.8, align: 'left' });
  
  const imagenPath = process.env.ENV_LOGO;
  if (imagenPath && fs.existsSync(imagenPath)) {
    const imagenX = doc.page.width - doc.page.margins.right - (doc.page.width * 0.2);
    const imagenY = doc.page.margins.top;
    const imagenAncho = doc.page.width * 0.2;

    doc.image(imagenPath, imagenX, imagenY, { width: imagenAncho });
  } else {
    console.log('⚠️ Logo not found at path:', imagenPath);
  }

  doc.rect(doc.page.margins.left, doc.page.margins.top + 70, doc.page.width-60, 5).fillColor('#D6DBDF').fill().fillColor('black')
}

function agregarComas(numero) {
  const partes = parseFloat(parseFloat(numero).toFixed(2)).toString().split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return partes.join('.');
}

function resumenMensual(doc, detalles) {
  
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('CIFRAS EXPRESADAS EN PESOS MEXICANOS', doc.page.margins.left, 220, { width: doc.page.width * 0.55, align: 'left' });
  doc.rect(doc.page.margins.left, 228, doc.page.width-doc.page.margins.right-doc.page.margins.left, 78).fillColor('black').fill();
  doc.rect(doc.page.margins.left+2, 241, doc.page.width-doc.page.margins.right-doc.page.margins.left-4, 75-12).fillColor('#D6DBDF').fill()
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('RESUMEN DE CUENTA MENSUAL', 0, 231, { width: doc.page.width, align: 'center' }).fillColor('white');

  const traPositiva = detalles.map(d => d[3]).filter(m => m);
  const traContra = detalles.filter(d => 'CANCELACION' === d[1]).map(d => d[3]).filter(m => m).reduce((total, valor) => total + valor, 0);
  const traDevolucion = detalles.filter(d => 'DEVOLUCION' === d[1]).map(d => d[3]).filter(m => m).reduce((total, valor) => total + valor, 0);

  const traComicion = detalles.map(d => (d[4][0]+d[4][1])+d[5]).filter(m => m).reduce((total, valor) => total + valor, 0);
  const traIva = detalles.map(d => ('s' === d[6][2] ? (d[6][0] + d[6][1]) : (d[6][0] - d[6][1]))).filter(m => m).reduce((total, valor) => total + valor, 0);

  const tags = [
    { title: 'COMISIONES COBRADAS EN EL MES', val: agregarComas(0 !== traComicion ? (traComicion).toFixed(2) : 0) },
    { title: 'IVA COBRADO DE COMISIONES', val: agregarComas(0 !== traIva ? (traIva).toFixed(2) : 0) },
    { title: 'DEVOLUCIONES DEL PERIODO', val: agregarComas(0 !== traDevolucion ? (traDevolucion * -1).toFixed(2) : 0) },
    { title: 'CANCELACIONES DEL PERIODO', val: agregarComas(0 !== traContra ? (traContra * -1).toFixed(2) : 0) },
    { title: 'SALDO PROMEDIO DE TRANSACCIONES', val: agregarComas(0) },
    { title: 'TICKET PROMEDIO', val: agregarComas(traPositiva.length ? (traPositiva.reduce((total, valor) => total + valor, 0) / traPositiva.length).toFixed(2) : 0) },
  ]

  const x = doc.page.margins.right+3;
  const tableTop = doc.page.margins.top + 235;
  const rowHeight = (doc.page.width * 0.5)-doc.page.margins.right-4;
  doc.font('Helvetica').fontSize(8).fillColor('black');
  tags.forEach((row, rowIndex) => {
    doc.text(row.title, x, tableTop+(rowIndex*10));
    doc.text(row.val, x+rowHeight-50, tableTop+(rowIndex*10), { width: rowHeight+50, align: 'right' });
  });
}

function rellenarConCeros(cadena) {
  cadena = cadena.toString();
  if (cadena.length < 6) {
    const cerosFaltantes = 6 - cadena.length;
    const ceros = '0'.repeat(cerosFaltantes);
    cadena = ceros + cadena;
  }

  return cadena;
}

function infoComercio(doc, comercio) {
  const topP = doc.page.margins.top + 100;
  doc.font('Helvetica').fontSize(10);
  
  // Debug logging to check merchant data structure
  console.log('🔍 Merchant data structure:', JSON.stringify(comercio, null, 2));
  
  // Handle merchant name and RFC - provide fallbacks if data is missing
  const merchantName = comercio.razon_social || comercio.name_merchant || 'COMERCIO SIN NOMBRE';
  const merchantRFC = comercio.rfc_merchant || 'RFC NO DISPONIBLE';
  
  const textDir1 = doc.text(`${merchantName}\nR.F.C: ${merchantRFC}`, doc.page.margins.left, topP, { width: doc.page.width * 0.40, align: 'left' });
  
  // Handle address data - now using nested object structure (raw: false)
  let addressText = '';
  if (comercio.datos_direccion && typeof comercio.datos_direccion === 'object') {
    const addr = comercio.datos_direccion;
    addressText = `${addr.calle || ''} ${addr.no_ext || ''} ${addr.no_int || ''}\n${addr.colonia || ''}\n${addr.alcaldia || ''} ${addr.ciudad || ''}. CP. ${addr.cp || ''}`;
  } else {
    // Fallback for missing address data
    addressText = 'DIRECCIÓN NO DISPONIBLE';
  }
  
  // Additional fallback if address is still empty after building
  if (!addressText.trim() || addressText === 'DIRECCIÓN NO DISPONIBLE') {
    addressText = 'DIRECCIÓN NO DISPONIBLE';
  }
  
  doc.font('Helvetica');
  const textDir2 = doc.text(addressText, doc.page.margins.left, topP + textDir1.x + 5, { width: doc.page.width * 0.40, align: 'left' });
  
  // Handle contract and client numbers with proper fallbacks
  const contractNumber = comercio.id_merchant ? rellenarConCeros(comercio.id_merchant) : '000000';
  const clientNumber = comercio.id_client ? rellenarConCeros(comercio.id_client) : '000000';
  
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text(`NUMERO DE CONTRATO: ${contractNumber}\nNUMERO DE CLIENTE: ${clientNumber}`, doc.page.margins.left, topP + 35 + textDir2.x + 20, { width: doc.page.width * 0.55, align: 'left' });
}

function obtenerDiasDelMes(anio, mes) {
  const fecha = new Date(anio, mes - 1, 1);
  fecha.setMonth(fecha.getMonth() + 1);
  fecha.setDate(fecha.getDate() - 1);

  return fecha.getDate();
}

function obtenerMes(mes) {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return monthNames[mes-1];
}

function resumen(doc, anio, mes, detalles) {
  const topP = doc.page.margins.top + 105;
  const x = doc.page.width - doc.page.margins.right - (doc.page.width * 0.5);
  doc.rect(x, topP, (doc.page.width*0.5), 5).fill().fillColor('black')
  doc.rect(x, topP + 92, (doc.page.width*0.5), 5).fill().fillColor('black')
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text(`RESUMEN DE CUENTAS`, x+1, topP + 7, { width: doc.page.width * 0.5, align: 'center' });

  const strMes = obtenerMes(mes);
  const finDia = obtenerDiasDelMes(anio, mes);

  const traPositiva = detalles.map(d => d[3]).filter(m => m).reduce((total, valor) => total + valor, 0);
  const traLiquida = detalles.filter(d => d[1].startsWith("L/VENTA/")).map(d => {
    return d[3]+((d[4][0]+d[4][1]) + d[5] + ('s' === d[6][2] ? (d[6][0] + d[6][1]) : (d[6][0] - d[6][1])));
  }).filter(m => m).reduce((total, valor) => total + valor, 0);

  const traResta = detalles.filter(d => ['DEVOLUCION', 'CANCELACION'].includes(d[1])).map(d => d[3]).filter(m => m).reduce((total, valor) => total + valor, 0);
  const traComicion = detalles.map(d => (d[4][0]+d[4][1])+d[5]).filter(m => m).reduce((total, valor) => total + valor, 0);
  const traIva = detalles.map(d => ('s' === d[6][2] ? (d[6][0] + d[6][1]) : (d[6][0] - d[6][1]))).filter(m => m).reduce((total, valor) => total + valor, 0);  

  const sumaResta = (traResta * -1) + traComicion + traIva;

  const tags = [
    { title: 'SALDO INICIAL DEL PERIODO', val: 0, bold: true },
    { title: 'DEPÓSITOS POR TRANSACCIONES', val: agregarComas(0 !== traPositiva ? traPositiva : 0), bold: false },
    { title: 'RETIROS POR LIQUIDACIONES', val: agregarComas(0 !== traLiquida ? (traLiquida * 1) : 0), bold: false },
    { title: 'OTROS DESCUENTOS', val: agregarComas(0 !== sumaResta ? (sumaResta) : 0), bold: false },
    { title: 'SALDO AL FINAL DEL PERIODO', val: 0, bold: true },
    { title: 'DÍAS TRANSCURRIDOS DEL MES', val: finDia, bold: false },
    { title: 'PERIODO DEL', val: `01 de ${strMes} del 2023 al ${finDia} de ${strMes} del 2023`, bold: false },
  ]

  const tableTop = topP + 22;
  const rowHeight = (doc.page.width * 0.5)*0.5;
  doc.font('Helvetica').fontSize(8);
  tags.forEach((row, rowIndex) => {
    doc.font(!row.bold ? 'Helvetica' : 'Helvetica-Bold');
    if(row.bold)
      doc.rect(x, tableTop+(rowIndex*10)-1, (doc.page.width*0.5), 8).fillColor('#D6DBDF').fill().fillColor('black')

    doc.text(row.title, x, tableTop+(rowIndex*10));
    doc.text(row.val, x+rowHeight-50, tableTop+(rowIndex*10), { width: rowHeight+50, align: 'right' });
  });
}

function descripcion(doc, detalles) {
  detalles = detalles.sort(function(a, b) {
    return a[0] - b[0];
  });
  h4(doc, 320, 'DETALLE DE MOVIMIENTOS');
  const table = {
    headers: [{
      tag: 'Dia',
      part: 0
    }, {
      tag: 'Descripción',
      part: 1
    }, {
      tag: 'Referencia',
      part: 7
    }, {
      tag: 'Monto de\nOperación',
      part: 11
    }, {
      tag: 'Tasa de\nDescuento',
      part: 14
    }, {
      tag: 'Comisiones\nAntifraudes',
      part: 17
    }, {
      tag: 'IVA Total',
      part: 21
    }, {
      tag: 'SALDO',
      part: 25
    }],
    rows: detalles.map(transaccion => transaccion.slice(0, 8))
  };

  let tableTop = 338;
  const rowHeight = 14; 
  const tableLeft = doc.page.margins.left;
  const tableWidth = doc.page.width-doc.page.margins.left-doc.page.margins.right;

  // Dibujar encabezados de la tabla
  doc.font('Helvetica-Bold').fontSize(9);
  doc.rect(tableLeft, tableTop-3, tableWidth, 22).fillColor('#D6DBDF').fill().fillColor('black')
  table.headers.forEach(header => {
    doc.text(header.tag, tableLeft + (header.part * (tableWidth / 28)), tableTop);
  });

  doc.font('Helvetica').fontSize(8);
  let delta = [];

  table.rows.forEach((r) => {
    delta.push([r[0], r[1], r[2], r[3], r[4][0], r[5], r[6][0], r[7]]);
    if(r[1].includes('MSI'))
      delta.push(['', `SOBRE TASA${r[1].replace(/L?\/VENTA\/CREDITO/g, '')}`, '', 0, r[4][1], 0, r[6][1], r[7]])
  });

  table.rows = delta;

  table.rows.forEach((row, rowIndex) => {
    const subSaldo = parseFloat(parseFloat(parseFloat(row[3]) + (parseFloat(row[4]) + parseFloat(row[5]) + parseFloat(row[6]))).toFixed(2));

    row[1] = row[1].replace('L/VENTA', 'VENTA');
    row[3] = row[3] ? agregarComas(row[3]) : row[3];
    row[4] = row[4] ? agregarComas(row[4]) : row[4];
    row[5] = row[5] ? agregarComas(row[5]) : row[5];
    row[6] = row[6] ? agregarComas(row[6]) : row[6];
    
    row[7] = 0 === rowIndex ? parseFloat(parseFloat(subSaldo).toFixed(2)) : parseFloat(parseFloat(parseFloat(parseFloat(table.rows[rowIndex-1][7].replace(',','')).toFixed(2)) + subSaldo).toFixed(2))
    row[7] =  agregarComas(row[7]);

    let yPos = tableTop + 9 + (rowIndex + 1) * rowHeight;
    if(yPos > doc.page.height-doc.page.margins.bottom-30) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(9);
      doc.rect(tableLeft, 84, tableWidth, 22).fillColor('#D6DBDF').fill().fillColor('black')
      table.headers.forEach(header => {
        doc.text(header.tag, tableLeft + (header.part * (tableWidth / 28)), 86);
      });
      doc.font('Helvetica').fontSize(8);
      tableTop = doc.page.margins.top-((rowIndex + 1) * rowHeight)+(doc.page.margins.top + 83)+9;
      yPos = tableTop + (rowIndex + 1) * rowHeight;
    }

    doc.rect(tableLeft, yPos+8, tableWidth, 1).fill().fillColor('black')
    row.forEach((cell, columnIndex) => {
      doc.text(cell, tableLeft + (table.headers[columnIndex].part) * (tableWidth / 28), yPos);
    });
  });
}

function concentrado(doc, detalles) {
  h4(doc, 320, 'CONCENTRADO DE MOVIMIENTOS');
  const table = {
    headers: [{
      tag: 'Producto',
      part: 0
    }, {
      tag: `Numero de\noperaciones`,
      part: 6
    }, {
      tag: 'Monto de\nOperaciones',
      part: 10
    }, {
      tag: 'Tasa de\nDescuento',
      part: 14
    }, {
      tag: 'Comisiones\nAntifraudes',
      part: 17  
    }, {
      tag: 'IVA\nTotal',
      part: 21
    }, {
      tag: 'Monto Neto',
      part: 23
    }, {
      tag: 'Saldo',
      part: 26
    }],
    rows: detalles.map(transaccion => transaccion.slice(0, 2).concat(transaccion.slice(3, 7))),
    footer: [{
      val: 'TOTAL',
    }, {
      val: 0
    }, {
      val: 0,
    }, {
      val: 0,
    }, {
      val: 0,
    }, {
      val: 0,
    }, {
      val: '',
    }, {
      val: 0
    }],
  };

  let tableTop = 338;
  const rowHeight = 14; 
  const tableLeft = doc.page.margins.left;
  const tableWidth = doc.page.width-doc.page.margins.left-doc.page.margins.right;

  doc.font('Helvetica-Bold').fontSize(9);
  doc.rect(tableLeft, tableTop-3, tableWidth, 22).fillColor('#D6DBDF').fill().fillColor('black')
  table.headers.forEach(header => {
    doc.text(header.tag, tableLeft + (header.part * (tableWidth / 28)), tableTop);
  });

  let groupedMaster = [];

  table.rows = table.rows.map(r => {
    r[3] = r[3][0]+r[3][1];
    r[5] = 's' === r[5][2] ? (r[5][0] + r[5][1]) : (r[5][0] - r[5][1])

    return r;
  })

  table.rows.reduce((result, subarray) => {
    const concepto = subarray[1];
    const amounts = subarray.slice(2);

    const existingGroup = result.find(group => group.concepto === concepto);
    if (existingGroup) {
        existingGroup.amounts = existingGroup.amounts.map((amount, index) => amount + amounts[index]);
        existingGroup.count += 1;
    } else
      result.push({ concepto, amounts, count: 1 });

    return result;
  }, []).forEach((group, i) => {
    table.footer[5].val = table.footer[5].val + group.amounts[3]
    table.footer[4].val = table.footer[4].val + group.amounts[2]
    table.footer[3].val = table.footer[3].val + group.amounts[1]
    table.footer[2].val = table.footer[2].val + group.amounts[0]
    
    const subSaldo = group.amounts[0] + (group.amounts[1] + group.amounts[2] + group.amounts[3]);
    saldo = (0 === i ? 0 : groupedMaster[i-1][7]) + subSaldo;

    table.footer[7].val = saldo
    table.footer[1].val = table.footer[1].val + group.count
    groupedMaster.push([group.concepto, group.count, group.amounts[0], group.amounts[1], group.amounts[2], group.amounts[3], subSaldo, saldo]);
  });

  doc.font('Helvetica').fontSize(8);
  let tmpY = 0;
  const mapping = {
    'VENTA/DEBITO': 'DEBITO NACIONAL',
    'VENTA/CREDITO': 'CREDITO NACIONAL',
    'INTERNACIONAL': 'INTERNACIONAL',
    'VENTA/DEBITO - LINK': 'DEBITO NACIONAL / LINK',
    'VENTA/CREDITO - LINK': 'CREDITO NACIONAL / LINK',
    'INTERNACIONAL - LINK': 'INTERNACIONAL / LINK',
    'VENTA/CREDITO - MSI 3': '3 MESES SIN INTERESES',
    'VENTA/CREDITO - MSI 6': '6 MESES SIN INTERESES',
    'VENTA/CREDITO - MSI 9': '9 MESES SIN INTERESES',
    'VENTA/CREDITO - MSI 12': '12 MESES SIN INTERESES',
    'VENTA/CREDITO - MSI 18': '18 MESES SIN INTERESES',
    'CANCELACION': 'CANCELACION',
    'DEVOLUCION': 'DEVOLUCION'
  };

  const otrosTag = Object.keys(mapping);

  const existe = groupedMaster.map(g => {
    g[0].replace('L/VENTA', 'VENTA');

    return g;
  })

  otrosTag.filter(v => !existe.includes(v)).forEach(k => {
    groupedMaster.push([k, '-', '-', '-', '-', '-', '-', '-'])
  })
  
  groupedMaster = groupedMaster.sort((a, b) => {
    return otrosTag.indexOf(a[0].replace('L/VENTA', 'VENTA')) - otrosTag.indexOf(b[0].replace('L/VENTA', 'VENTA'));
  });

  groupedMaster.forEach((row, rowIndex) => {
    row[0] = row[0].replace('L/VENTA', 'VENTA')
    
    // Reemplazar el valor si existe en el mapeo
    if (mapping[row[0]])
      row[0] = mapping[row[0]];
    
    // Optimizar la adición de comas
    for (let i = 2; i <= 7; i++)
      row[i] = row[i] && '-' !== row[i] ? agregarComas(row[i]) : row[i];
    
    let yPos = tableTop + 10 + (rowIndex + 1) * rowHeight;

    if(yPos > doc.page.height-doc.page.margins.bottom-25) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(9);
      doc.rect(tableLeft, 84, tableWidth, 13).fillColor('#D6DBDF').fill().fillColor('black')
      table.headers.forEach(header => {
        doc.text(header.tag, tableLeft + (header.part * (tableWidth / 28)), 86);
      });
      doc.font('Helvetica').fontSize(8);
      tableTop = doc.page.margins.top-((rowIndex + 1) * rowHeight)+(doc.page.margins.top + 83);
      yPos = tableTop + (rowIndex + 1) * rowHeight;
    }

    doc.rect(tableLeft, yPos+8, tableWidth, 1).fill().fillColor('black')
    row.forEach((cell, columnIndex) => {
      doc.text(cell, tableLeft + (table.headers[columnIndex].part) * (tableWidth / 28), yPos);
    });

    tmpY = yPos
  });
  
  doc.font('Helvetica-Bold').fontSize(9);
  doc.rect(tableLeft, tmpY+15, tableWidth, 13).fillColor('#D6DBDF').fill().fillColor('black'),

  [2, 3, 4, 5, 7].forEach(index => {
    table.footer[index].val = agregarComas(table.footer[index].val);
  });

  table.footer.forEach((cell, columnIndex) => {
    doc.text(cell.val, tableLeft + (table.headers[columnIndex].part) * (tableWidth / 28), tmpY+18);
  });
}

let nPage = {};

function footer(doc, index) {
  doc.font('Helvetica').fontSize(6).text(`EMITIDO POR: MENFIS TECNOLOGIA Y DESARROLLO S.A de C.V R.F.C: MTD1907167B8\nAv. SANTA FE 505 PISO 1 MEZZANINE 2B, SANTA FE CUAJIMALPA, CUAJIMALPA DE MORELOS, 05348, CDMX\n- Pag. ${nPage[index]} -`, doc.page.margins.left, doc.page.height-doc.page.margins.bottom-21, { align: 'center' });
}

function tags(status, medio, msi, isLink) {
  if (2 == status) {
    return `VENTA/${'debit' === medio ? 'DEBITO' : ('internacional' === medio ? 'INTERNACIONAL' : 'CREDITO')}${msi ? ` - MSI ${msi}` : ''}${ isLink ? ' - LINK' : ''}`;
  }
  else if (4 == status)
    return 'DEVOLUCION';
  else if (3 == status) {
    return `L/VENTA/${'debit' === medio ? 'DEBITO' : ('internacional' === medio ? 'INTERNACIONAL' : 'CREDITO')}${msi ? ` - MSI ${msi}` : ''}${ isLink ? ' - LINK' : ''}`;
    //return 'LIQUIDACION';
  }
  else
    return 'CANCELACION';
}

function comision(r, configMSI) {
  if(!configMSI)
    configMSI = [];

  const plantInfo = configMSI.filter(cm => cm.type === r.msi);
  const vTasa = parseFloat(parseFloat(r['debit' === r.t_medio ? 'tasa_debito_b' : ('internacional' === r.t_medio ? 'tasa_amex_b' : 'tasa_credito_b')]).toFixed(2));
  const vPlanet = parseFloat(parseFloat(plantInfo.length ? plantInfo[0].percent : 0).toFixed(2));

  const tasa = parseFloat(parseFloat(((0 > r.amount ? r.amount * -1 : r.amount)/100) * vTasa).toFixed(2));
  const planet = parseFloat(parseFloat(((0 > r.amount ? r.amount * -1 : r.amount)/100) * vPlanet).toFixed(2));
  const vComision = parseFloat(parseFloat(r['debit' === r.t_medio ? 'tasa_debito_d' : ('internacional' === r.t_medio ? 'tasa_amex_d' : 'tasa_credito_d')]).toFixed(2))

  return (2 === r.status || 3 === r.status) ? [-1*tasa, -1*planet, -1*vComision] : [tasa, planet, vComision]
}

function ivaComision(r, [tasa, planet, comicion]) {
  const iTasa = parseFloat(parseFloat(tasa*0.16).toFixed(2))
  const iComicion = parseFloat(parseFloat(comicion*0.16).toFixed(2))
  const iPlanet = parseFloat(parseFloat(planet*0.16).toFixed(2))

  return (2 === r.status || 3 === r.status) ? [(parseFloat(parseFloat(iTasa + iComicion).toFixed(2))), -1*iPlanet, 's'] : [parseFloat(parseFloat(iTasa - iComicion).toFixed(2)), iPlanet, 'r'];
}

module.exports = async function (rDetalle, anio, mes, comercio, registros) {
  try {
  console.log(rDetalle, anio, mes, comercio, registros)
  console.log('🔍🧨 makeEstado ENTRY - called with:', { rDetalle, anio, mes, comercioId: comercio?.id_merchant, registrosCount: registros?.length });
  console.log('🔍🧨 comercio keys:', Object.keys(comercio || {}));
  console.log('🔍🧨 comercio.msi type:', typeof comercio?.msi, 'value:', comercio?.msi);
  
  // Validate comercio object
  if (!comercio || !comercio.id_merchant) {
    throw new Error('Invalid comercio object: missing id_merchant');
  }

  const invoiceCreated = await db.invoices.findOne({
    where: {
      id_merchant: comercio.id_merchant,
      month:mes, 
      year: anio
    }
  });

  
  const index = `${rellenarConCeros(comercio.id_merchant)}_${obtenerMes(mes)}${anio}`;
  nPage[index] = 1;
  const doc = new PDFDocument({ autoFirstPage: false, margins: { top: 10, left: 30, right: 30, bottom: 10 } });

  const configMSI = (() => {
  try {
    if (!comercio.msi || comercio.msi === 'undefined' || comercio.msi === 'null') {
      console.log('🔧 MSI is null/undefined, using empty array');
      return [];
    }
    console.log('🔧 Parsing MSI:', comercio.msi);
    return JSON.parse(comercio.msi);
  } catch (error) {
    console.error('❌ Error parsing comercio.msi:', error, 'Value was:', comercio.msi);
    return [];
  }
})();

  let detalles = registros.map(r => {
    // Convert string amounts to numbers properly
    const originalAmount = parseFloat(r.amount) || 0;
    r.amount = parseFloat(originalAmount.toFixed(2));
    
    // Convert rate fields from strings to numbers
    r.taza_credito = parseFloat(parseFloat(r.taza_credito || 0).toFixed(2));
    r.taza_debito = parseFloat(parseFloat(r.taza_debito || 0).toFixed(2));
    r.taza_amex = parseFloat(parseFloat(r.taza_amex || 0).toFixed(2));
    r.tasa_credito_b = parseFloat(parseFloat(r.tasa_credito_b || 0).toFixed(2));
    r.tasa_debito_b = parseFloat(parseFloat(r.tasa_debito_b || 0).toFixed(2));
    r.tasa_amex_b = parseFloat(parseFloat(r.tasa_amex_b || 0).toFixed(2));
    r.tasa_credito_c = parseFloat(parseFloat(r.tasa_credito_c || 0).toFixed(2));
    r.tasa_debito_c = parseFloat(parseFloat(r.tasa_debito_c || 0).toFixed(2));
    r.tasa_amex_c = parseFloat(parseFloat(r.tasa_amex_c || 0).toFixed(2));
    r.tasa_credito_d = parseFloat(parseFloat(r.tasa_credito_d || 0).toFixed(2));
    r.tasa_debito_d = parseFloat(parseFloat(r.tasa_debito_d || 0).toFixed(2));
    r.tasa_amex_d = parseFloat(parseFloat(r.tasa_amex_d || 0).toFixed(2));

    return r;
  }).map(r => {
    let amount = r.amount;
    const originalAmount = amount;
    
    // PROPER STATUS FILTERING: Only include approved transactions (status = 2)
    // For cancellations (status = 3) and refunds (status = 4), make amounts negative
    if (r.status === 3 || r.status === 4) {
      amount = Math.abs(amount) * -1;
    } else if (r.status !== 2) {
      // Skip transactions that are not approved, cancelled, or refunded
      return null;
    }
    
    console.log('🔧 Amount processing for transaction:', {
      status: r.status,
      originalAmount: originalAmount,
      processedAmount: amount,
      reference_number: r.reference_number,
      isInStatusList: [3, 4].includes(r.status),
      note: 'Status filtering properly applied'
    });

    const [tasa, planet, comicion] = comision(r, configMSI)
    const [iva, ivaPlanet, opera] = ivaComision(r, [tasa, planet, comicion])

    return [
      r.dia,
      tags(r.status, r.t_medio, r.msi, r.isLink),
      r.reference_number,
      amount,
      [tasa, planet],
      comicion,
      [iva, ivaPlanet, opera],
      0
    ];
  }).filter(detail => detail !== null); // Filter out null transactions

  const orden = [
    'VENTA/DEBITO',
    'VENTA/CREDITO',
    'VENTA/INTERNACIONAL',
    'VENTA/DEBITO - LINK',
    'VENTA/CREDITO - LINK',
    'VENTA/INTERNACIONAL - LINK',
    'VENTA/CREDITO - MSI 3',
    'VENTA/CREDITO - MSI 6',
    'VENTA/CREDITO - MSI 9',
    'VENTA/CREDITO - MSI 12',
    'VENTA/CREDITO - MSI 18',
    'CANCELACION',
    'DEVOLUCION'
  ];

  detalles = detalles.sort((a, b) => {
    return orden.indexOf(a[1].replace('L/VENTA', 'VENTA')) - orden.indexOf(b[1].replace('L/VENTA', 'VENTA'));
  });

  doc.on('pageAdded', () => {
    head(doc);
    footer(doc, index);

    nPage[index]++;
  });

  doc.addPage();
  
  const fileName = `${index}_estadoCuenta.pdf`;

  doc.fontSize(15).text('Estado de cuenta', 0, doc.page.margins.bottom+80, { align: 'center' });

  infoComercio(doc, comercio);
  resumen(doc, anio, mes, detalles);

  resumenMensual(doc, detalles);

  if('Y' === rDetalle)
    descripcion(doc, detalles);
  else
    concentrado(doc, detalles);

  // doc.addPage();

  // aquí invoice en caso de tener la información
  if(comercio?.with_invoices && invoiceCreated && invoiceCreated.details){
    const details = JSON.parse(invoiceCreated.details);
    if(details?.response?.data){
      await makeEstadoInvoiceSection(doc, details );
    }
  }
  // temrina sección de timbre


  makeEstadoAclaracion(doc);

  const directoryPath = path.join('state', anio, mes);
  if (!fs.existsSync(directoryPath))
    fs.mkdirSync(directoryPath, { recursive: true });

  const filePath = path.join(directoryPath, fileName);

  const fileData = fs.createWriteStream(filePath);

  doc.pipe(fileData);
  doc.end();

  return new Promise(resolve => {
    fileData.on('finish', () => {
      console.log(`File: ${filePath}, generado exitosamente`);
      delete nPage[index];

      resolve({OK:true, filePath});
    });
    
    fileData.on('error', err => {
      console.error(`File: ${filePath}, generado fallidamente`, err);
      delete nPage[index];

      resolve({OK:false, filePath});
    });
  });
  } catch (error) {
    console.error('❌ Error in makeEstado:', error);
    return {OK:false, filePath: null, error: error.message};
  }
};