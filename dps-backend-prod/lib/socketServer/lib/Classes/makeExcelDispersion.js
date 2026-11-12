const ExcelJS = require('exceljs');
const { resolve } = require('path');
const { readFileSync } = require('fs');
const puppeteer = require('puppeteer');

let resumen = [];

let resumenTodos = [
    ['Cliente', 'Producto', 'No. Transacciones', 'Monto Bruto', 'Tasa',   'IVA Tasa (16%)',  'Comisiones Antifraude',   'IVA Comisiones Antifraude (16%)', 'Monto Neto']
];

const geoData = (dayStart, dayEnd, cli, id_merchant, name_merchant, rfc, clabe, cargoDebito, cargoCredito, cargoInternacional, cargoDebitoLink, cargoCreditoLink, cargoInternacionalLink, cargoCreditoMSI3, cargoCreditoMSI6, cargoCreditoMSI9, cargoCreditoMSI12, cargoCreditoMSI18, devolucionDebito, devolucionCredito, devolucionInternacioal, cancelacionDebito, cancelacionCredito, cancelacionInternacional, retencion) => {
    //Debito
    const brutoTasas = [
        parseFloat(cargoDebito.tasas),
        parseFloat(cargoDebitoLink.tasas),
        parseFloat(devolucionDebito.tasas),
        parseFloat(cancelacionDebito.tasas)
    ].filter(v => 0 !== v)

    const no = cargoDebito.no + cargoDebitoLink.no + devolucionDebito.no + cancelacionDebito.no;
    const bruto = cargoDebito.montoBruto + cargoDebitoLink.montoBruto + devolucionDebito.montoBruto + cancelacionDebito.montoBruto;
    const tasas = `${-1*(brutoTasas.reduce((neto, v) => neto + v, 0)/brutoTasas.length).toFixed(2)}%`;
    const tasa = -1*(cargoDebito.tasa + cargoDebitoLink.tasa + devolucionDebito.tasa + cancelacionDebito.tasa);
    const iva = -1*(cargoDebito.ivaTasa + cargoDebitoLink.ivaTasa + devolucionDebito.ivaTasa + cancelacionDebito.ivaTasa);
    const comision = -1*(cargoDebito.comision + cargoDebitoLink.comision + devolucionDebito.comision + cancelacionDebito.comision);
    const ivaComision = -1*(cargoDebito.ivaComision + cargoDebitoLink.ivaComision + devolucionDebito.ivaComision + cancelacionDebito.ivaComision);
    const neto = cargoDebito.montoNeto + cargoDebitoLink.montoNeto + devolucionDebito.montoNeto + cancelacionDebito.montoNeto;

    //Credito
    const brutoTasasCredit = [
        parseFloat(cargoCredito.tasas),
        parseFloat(cargoCreditoLink.tasas),
        parseFloat(cargoCreditoMSI3.tasas),
        parseFloat(cargoCreditoMSI6.tasas),
        parseFloat(cargoCreditoMSI9.tasas),
        parseFloat(cargoCreditoMSI12.tasas),
        parseFloat(cargoCreditoMSI18.tasas),
        parseFloat(devolucionCredito.tasas),
        parseFloat(cancelacionCredito.tasas)
    ].filter(v => 0 !== v)

    const noCredit = cargoCredito.no + cargoCreditoLink.no + cargoCreditoMSI3.no + cargoCreditoMSI6.no + cargoCreditoMSI9.no + cargoCreditoMSI12.no + cargoCreditoMSI18.no + devolucionCredito.no + cancelacionCredito.no;
    const brutoCredit = cargoCredito.montoBruto + cargoCreditoLink.montoBruto + cargoCreditoMSI3.montoBruto + cargoCreditoMSI6.montoBruto + cargoCreditoMSI9.montoBruto + cargoCreditoMSI12.montoBruto + cargoCreditoMSI18.montoBruto + devolucionCredito.montoBruto + cancelacionCredito.montoBruto;
    const tasasCredit = `${-1*(brutoTasasCredit.reduce((neto, v) => neto + v, 0)/brutoTasasCredit.length).toFixed(2)}%`;
    const tasaCredit = -1*(cargoCredito.tasa + cargoCreditoLink.tasa + cargoCreditoMSI3.tasa + cargoCreditoMSI6.tasa + cargoCreditoMSI9.tasa + cargoCreditoMSI12.tasa + cargoCreditoMSI18.tasa + devolucionCredito.tasa + cancelacionCredito.tasa);
    const ivaCredit = -1*(cargoCredito.ivaTasa + cargoCreditoLink.ivaTasa + cargoCreditoMSI3.ivaTasa + cargoCreditoMSI6.ivaTasa + cargoCreditoMSI9.ivaTasa + cargoCreditoMSI12.ivaTasa + cargoCreditoMSI18.ivaTasa + devolucionCredito.ivaTasa + cancelacionCredito.ivaTasa);
    const comisionCredit = -1*(cargoCredito.comision + cargoCreditoLink.comision + cargoCreditoMSI3.comision + cargoCreditoMSI6.comision + cargoCreditoMSI9.comision + cargoCreditoMSI12.comision + cargoCreditoMSI18.comision + devolucionCredito.comision + cancelacionCredito.comision);
    const ivaComisionCredit = -1*(cargoCredito.ivaComision + cargoCreditoLink.ivaComision + cargoCreditoMSI3.ivaComision + cargoCreditoMSI6.ivaComision + cargoCreditoMSI9.ivaComision + cargoCreditoMSI12.ivaComision + cargoCreditoMSI18.ivaComision + devolucionCredito.ivaComision + cancelacionCredito.ivaComision);
    const netoCredit = cargoCredito.montoNeto + cargoCreditoLink.montoNeto + cargoCreditoMSI3.montoNeto + cargoCreditoMSI6.montoNeto + cargoCreditoMSI9.montoNeto + cargoCreditoMSI12.montoNeto + cargoCreditoMSI18.montoNeto + devolucionCredito.montoNeto + cancelacionCredito.montoNeto;

    //Internacional
    const brutoTasasInternacional = [
        parseFloat(cargoInternacional.tasas),
        parseFloat(cargoInternacionalLink.tasas),
        parseFloat(devolucionInternacioal.tasas),
        parseFloat(cancelacionInternacional.tasas)
    ].filter(v => 0 !== v)

    const noInternacional = cargoInternacional.no + cargoInternacionalLink.no + cancelacionInternacional.no + cancelacionInternacional.no;
    const brutoInternacional = cargoInternacional.montoBruto + cargoInternacionalLink.montoBruto + cancelacionInternacional.montoBruto + cancelacionInternacional.montoBruto;
    const tasasInternacional = `${-1*(brutoTasasInternacional.reduce((neto, v) => neto + v, 0)/brutoTasasInternacional.length).toFixed(2)}%`;
    const tasaInternacional = -1*(cargoInternacional.tasa + cargoInternacionalLink.tasa + cancelacionInternacional.tasa + cancelacionInternacional.tasa);
    const ivaInternacional = -1*(cargoInternacional.ivaTasa + cargoInternacionalLink.ivaTasa + cancelacionInternacional.ivaTasa + cancelacionInternacional.ivaTasa);
    const comisionInternacional = -1*(cargoInternacional.comision + cargoInternacionalLink.comision + cancelacionInternacional.comision + cancelacionInternacional.comision);
    const ivaComisionInternacional = -1*(cargoInternacional.ivaComision + cargoInternacionalLink.ivaComision + cancelacionInternacional.ivaComision + cancelacionInternacional.ivaComision);
    const netoInternacional = cargoInternacional.montoNeto + cargoInternacionalLink.montoNeto + cancelacionInternacional.montoNeto + cancelacionInternacional.montoNeto;

    const table = [
        ['ID Comercio', id_merchant],
        ['Comercio',    name_merchant],
        ['RFC', rfc],
        ['CLABE',   clabe],
        [],
        ['Concepto', 'No. Transacciones', 'Monto Bruto', '% Tasa', 'Tasa',  'IVA Tasa (16%)',  'Comisiones Antifraude',   'IVA Comisiones Antifraude (16%)', 'Monto Neto'],
        ['Compras/Ventas Débito', cargoDebito.no,   cargoDebito.montoBruto, -1*cargoDebito.tasas, -1*cargoDebito.tasa, -1*cargoDebito.ivaTasa,    -1*cargoDebito.comision,   -1*cargoDebito.ivaComision,    cargoDebito.montoNeto],
        ['Compras/Ventas Crédito', cargoCredito.no, cargoCredito.montoBruto, -1*cargoCredito.tasas, -1*cargoCredito.tasa,  -1*cargoCredito.ivaTasa,   -1*cargoCredito.comision,  -1*cargoCredito.ivaComision,   cargoCredito.montoNeto],

        ['Compras/Ventas Débito/Link', cargoDebitoLink.no,  cargoDebitoLink.montoBruto, -1*cargoDebitoLink.tasas, -1*cargoDebitoLink.tasa, -1*cargoDebitoLink.ivaTasa,    -1*cargoDebitoLink.comision,   -1*cargoDebitoLink.ivaComision,    cargoDebitoLink.montoNeto],
        ['Compras/Ventas Crédito/Link', cargoCreditoLink.no,    cargoCreditoLink.montoBruto, -1*cargoCreditoLink.tasas, -1*cargoCreditoLink.tasa,  -1*cargoCreditoLink.ivaTasa,   -1*cargoCreditoLink.comision,  -1*cargoCreditoLink.ivaComision,   cargoCreditoLink.montoNeto],

        ['Compras/Ventas Crédito/msi 3', cargoCreditoMSI3.no,   cargoCreditoMSI3.montoBruto, -1*cargoCreditoMSI3.tasas, -1*cargoCreditoMSI3.tasa,  -1*cargoCreditoMSI3.ivaTasa,   -1*cargoCreditoMSI3.comision,  -1*cargoCreditoMSI3.ivaComision,   cargoCreditoMSI3.montoNeto],
        ['Compras/Ventas Crédito/msi 6', cargoCreditoMSI6.no,   cargoCreditoMSI6.montoBruto, -1*cargoCreditoMSI6.tasas, -1*cargoCreditoMSI6.tasa,  -1*cargoCreditoMSI6.ivaTasa,   -1*cargoCreditoMSI6.comision,  -1*cargoCreditoMSI6.ivaComision,   cargoCreditoMSI6.montoNeto],
        ['Compras/Ventas Crédito/msi 9', cargoCreditoMSI9.no,   cargoCreditoMSI9.montoBruto, -1*cargoCreditoMSI9.tasas, -1*cargoCreditoMSI9.tasa,  -1*cargoCreditoMSI9.ivaTasa,   -1*cargoCreditoMSI9.comision,  -1*cargoCreditoMSI9.ivaComision,   cargoCreditoMSI9.montoNeto],
        ['Compras/Ventas Crédito/msi 12', cargoCreditoMSI12.no, cargoCreditoMSI12.montoBruto, -1*cargoCreditoMSI12.tasas, -1*cargoCreditoMSI12.tasa,   -1*cargoCreditoMSI12.ivaTasa,  -1*cargoCreditoMSI12.comision, -1*cargoCreditoMSI12.ivaComision,  cargoCreditoMSI12.montoNeto],
        ['Compras/Ventas Crédito/msi 18', cargoCreditoMSI18.no, cargoCreditoMSI18.montoBruto, -1*cargoCreditoMSI18.tasas, -1*cargoCreditoMSI18.tasa,   -1*cargoCreditoMSI18.ivaTasa,  -1*cargoCreditoMSI18.comision, -1*cargoCreditoMSI18.ivaComision,  cargoCreditoMSI18.montoNeto],

        ['Compras/Ventas Internacional', cargoInternacional.no, cargoInternacional.montoBruto, -1*cargoInternacional.tasas, -1*cargoInternacional.tasa,    -1*cargoInternacional.ivaTasa, -1*cargoInternacional.comision,    -1*cargoInternacional.ivaComision, cargoInternacional.montoNeto],
        ['Compras/Ventas Internacional/Link', cargoInternacionalLink.no,    cargoInternacionalLink.montoBruto, -1*cargoInternacionalLink.tasas, -1*cargoInternacionalLink.tasa,    -1*cargoInternacionalLink.ivaTasa, -1*cargoInternacionalLink.comision,    -1*cargoInternacionalLink.ivaComision, cargoInternacionalLink.montoNeto],

        ['Devoluciones Débito', devolucionDebito.no,    devolucionDebito.montoBruto, -1*devolucionDebito.tasas,    -1*devolucionDebito.tasa,  -1*devolucionDebito.ivaTasa,   -1*devolucionDebito.comision,  -1*devolucionDebito.ivaComision,   devolucionDebito.montoNeto],
        ['Devoluciones Crédito', devolucionCredito.no,  devolucionCredito.montoBruto,  -1*devolucionCredito.tasas, -1*devolucionCredito.tasa, -1*devolucionCredito.ivaTasa,  -1*devolucionCredito.comision, -1*devolucionCredito.ivaComision,  devolucionCredito.montoNeto],
        ['Devoluciones Internacional', devolucionInternacioal.no,   devolucionInternacioal.montoBruto, -1*devolucionInternacioal.tasas, -1*devolucionInternacioal.tasa,   -1*devolucionInternacioal.ivaTasa, -1*devolucionInternacioal.comision,    -1*devolucionInternacioal.ivaComision, devolucionInternacioal.montoNeto],
        ['Cancelaciones Débito', cancelacionDebito.no,  cancelacionDebito.montoBruto, -1*cancelacionDebito.tasas,  -1*cancelacionDebito.tasa, -1*cancelacionDebito.ivaTasa,  -1*cancelacionDebito.comision, -1*cancelacionDebito.ivaComision,  cancelacionDebito.montoNeto],
        ['Cancelaciones Crédito', cancelacionCredito.no,    cancelacionCredito.montoBruto, -1*cancelacionCredito.tasas,    -1*cancelacionCredito.tasa,    -1*cancelacionCredito.ivaTasa, -1*cancelacionCredito.comision,    -1*cancelacionCredito.ivaComision, cancelacionCredito.montoNeto],
        ['Cancelaciones Internacional', cancelacionInternacional.no,    cancelacionInternacional.montoBruto, -1*cancelacionInternacional.tasas,    -1*cancelacionInternacional.tasa,  -1*cancelacionInternacional.ivaTasa,   -1*cancelacionInternacional.comision,  -1*cancelacionInternacional.ivaComision,   cancelacionInternacional.montoNeto],
        ['Contracargos',    0, 0, 0, 0, 0, 0, 0, 0],
        [],
        ['Sub Totales:', no + noCredit + noInternacional, bruto + brutoCredit + brutoInternacional, tasas + tasasCredit + tasasInternacional, tasa + tasaCredit + tasaInternacional,    iva + ivaCredit + ivaInternacional, comision + comisionCredit + comisionInternacional, ivaComision + ivaComisionCredit + ivaComisionInternacional, neto + netoCredit + netoInternacional],
        ['Monto a Depositar', '', '', '', '', '', '', '', neto + netoCredit + netoInternacional],
        ['% Retención en garantía', '', '', '', '', '', '', '', retencion],
    ]

    resumen.push([`${id_merchant} - ${name_merchant}`, no + noCredit + noInternacional, bruto + brutoCredit + brutoInternacional, tasas + tasasCredit + tasasInternacional,   iva + ivaCredit + ivaInternacional, comision + comisionCredit + comisionInternacional, ivaComision + ivaComisionCredit + ivaComisionInternacional, neto + netoCredit + netoInternacional]);
    resumenTodos.push([`${cli.id} - ${cli.name}`, 'Debito', no, bruto, tasa,  iva, comision, ivaComision, neto]);
    resumenTodos.push([`${cli.id} - ${cli.name}`, 'Credito', noCredit, brutoCredit, tasaCredit,   ivaCredit, comisionCredit, ivaComisionCredit, netoCredit]);
    resumenTodos.push([`${cli.id} - ${cli.name}`, 'Internacional', noInternacional, brutoInternacional, tasaInternacional,    ivaInternacional, comisionInternacional, ivaComisionInternacional, netoInternacional]);

    return table;
};

const syleTitle = c => {
    c.font = {
        name: 'Arial',
        size: 14,
        color: {
            argb: 'ffffff'
        }
    };

    c.alignment = {
        vertical: 'top',
        horizontal: 'center'
    };

    c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
            argb:'074375'
        }
    };
}

const syleHeadTable = (c, ahorizontal = 'center') => {
    c.font = {
        name: 'Arial',
        size: 12,
        color: {
            argb: 'ffffff'
        }
    };

    c.alignment = {
        vertical: 'top',
        horizontal: ahorizontal
    };

    c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
            argb:'074375'
        }
    };
}

const syleTexto = (c, aHorizontal = 'center', par = false) => {
    c.font = {
        name: 'Arial',
        size: 10,
        color: {
            argb: '000000'
        }
    };

    c.alignment = {
        vertical: 'center',
        horizontal: aHorizontal
    };

    c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
            argb: !par ? 'E2E2E2' : 'C1C1C1',
        }
    };
}

const syleTextoNegro = (c, aHorizontal = 'center', par = false) => {
    c.font = {
        name: 'Arial',
        size: 10,
        color: {
            argb: '000000'
        },
        bold: true
    };

    c.alignment = {
        vertical: 'center',
        horizontal: aHorizontal
    };

    c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
            argb: !par ? 'E2E2E2' : 'C1C1C1',
        }
    };
}

const syleDinero = (c, aHorizontal = 'right', par = false) => {
    c.font = {
        name: 'Arial',
        size: 10,
        color: {
            argb: 0 > c.value ? 'FFFF0000' : '000000'
        }
    };

    c.alignment = {
        vertical: 'center',
        horizontal: aHorizontal
    };

    c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
            argb: !par ? 'E2E2E2' : 'C1C1C1',
        }
    };

    c.numFmt = '"$"#,##0.00_-';
}

function addRowWithStyle(worksheet, rowData, styleFunction, alignment, isEven) {
    const row = worksheet.addRow(rowData);
    row._cells.forEach(cell => {
        const testPatterns = [
            { regex: /^A\d+$/, method: 'left' },
            { regex: /^B\d+$/, method: 'center' },
            { regex: /^D\d+$/, method: 'center' },
            { regex: /^I\d+$/, method: 'center' }
        ];

        for (const pattern of testPatterns) {
            if (pattern.regex.test(cell._address)) {
                styleFunction(cell, pattern.method, isEven);
                return;
            }
        }

        styleFunction(cell, alignment || 'right', isEven);
    });
}

async function generateHtml(datas, dayStart, dayEnd) {
    const logo = process.env.ENV_LOGO;
    const imaContenido = readFileSync(resolve(logo)).toString('base64');
    const imageSrc = `data:image/jpeg;base64,${imaContenido}`;

    let html = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 8px; text-align: center; border: 1px solid #ddd; }
        .title { font-size: 14pt; color: white; background-color: #074375; text-align: center; }
        .head { font-size: 12pt; color: white; background-color: #074375; }
        .texto { font-size: 10pt; color: black; background-color: #E2E2E2; }
        .texto-negro { font-size: 10pt; color: black; font-weight: bold; background-color: #E2E2E2; }
        .dinero { font-size: 10pt; text-align: right; }
        .dinero-negative { color: red; }
        .left { text-align: left; }
        .right { text-align: right; }
        .center { text-align: center; }
        .page-break { page-break-before: always; }
      </style>
    </head>
    <body>`;

    // Resumen de clientes
    html += `<h2 class="title">Resumen concentrado de transacciones</h2>`;
    html += `<p>Del ${dayStart.toISOString()} al ${dayEnd.toISOString()}</p>`;
    html += `<img src="${imageSrc}" style="width: 200px; height: auto;">`;
    html += `<table><thead><tr>`;
    ['Cliente', 'Producto', 'No. Transacciones', 'Monto Bruto', 'Tasa', 'IVA Tasa (16%)', 'Comisiones Antifraude', 'IVA Comisiones Antifraude (16%)', 'Monto Neto'].forEach(h => {
        html += `<th class="head">${h}</th>`;
    });
    html += `</tr></thead><tbody>`;

    const resumenMaster = [];
    [...new Set(resumenTodos.slice(1).map(r => r[0]))].forEach(cliente => {
        const netoAll = resumenTodos.filter(r => cliente === r[0])
        return ['Debito', 'Credito', 'Internacional'].forEach(p => {
            const subNeto = netoAll.filter(n => p === n[1]);

            const datos = [2,3,4,5,6,7,8].map(i => subNeto.map(fila => fila[i]).reduce((a, v) => a + v));

            datos.unshift(cliente, p)

            resumenMaster.push(datos)
        })
    });

    resumenMaster.forEach(resumen => {
        html += `<tr>`;
        resumen.forEach((cell, idx) => {
            let className = idx < 3 ? 'texto-negro' : 'dinero';
            if (idx === 0) className += ' left';
            if (idx === 1 || idx === 2) className += ' center';
            if (cell < 0) className += ' dinero-negative';
            html += `<td class="${className}">${idx >= 3 ? `$${cell.toFixed(2)}` : cell}</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table>`;

    // Per client sections
    datas.forEach(hoja => {
        html += `<div class="page-break"></div>`;
        html += `<h2 class="title">Cliente (ID ${hoja.ID}) ${hoja.name}</h2>`;
        html += `<img src="${imageSrc}" style="width: 200px; height: auto;">`;
        html += `<p>Resumen de transacciones</p>`;
        html += `<p>Del ${dayStart.toISOString()} al ${dayEnd.toISOString()}</p>`;

        html += `<table><thead><tr>`;
        ['Comercio', 'No. Transacciones', 'Monto Bruto', 'Tasa', 'IVA Tasa (16%)', 'Comisiones Antifraude', 'IVA Comisiones Antifraude (16%)', 'Monto Neto'].forEach(h => {
            html += `<th class="head">${h}</th>`;
        });
        html += `</tr></thead><tbody>`;
        hoja.resumen.forEach((r, index) => {
            html += `<tr>`;
            r.forEach((cell, idx) => {
                let className = idx === 0 ? 'texto-negro left' : (idx === 1 ? 'texto-negro center' : 'dinero right');
                if (cell < 0) className += ' dinero-negative';
                html += `<td class="${className}">${idx >= 2 && typeof cell === 'number' ? `$${cell.toFixed(2)}` : cell}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;

        hoja.body.forEach(comercio => {
            html += `<table><tbody>`;
            comercio.forEach((row, nFila) => {
                html += `<tr>`;
                row.forEach((cell, idx) => {
                    let className = '';
                    if (nFila < 4) {
                        className = idx === 0 ? 'head right' : 'texto-negro left';
                    } else if (nFila === 5) {
                        className = 'head';
                    } else if ((5 < nFila && 24 > nFila) || [25,26,27].includes(nFila)) {
                        className = idx === 0 ? 'texto-negro left' : (idx === 1 ? 'texto-negro center' : 'dinero right');
                        if ([25,26,27].includes(nFila) && idx === 0) className = 'head right';
                        if (cell < 0) className += ' dinero-negative';
                    }
                    html += `<td class="${className}">${typeof cell === 'number' ? (idx >= 2 ? `$${cell.toFixed(2)}` : cell) : cell}</td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody></table>`;
        });
    });

    html += `</body></html>`;
    return html;
}

async function generateXLSX(workbook, hojas, dayStart, dayEnd, imageId) {
    const worksheetMain = workbook.addWorksheet('Resumen de clientes');

    dayStart.setHours(dayStart.getHours() - 6);
    dayEnd.setHours(dayEnd.getHours() - 6);

    worksheetMain.addImage(imageId, 'C1:G5')
    worksheetMain.addRow([]);
    worksheetMain.addRow([]);
    worksheetMain.addRow([]);
    worksheetMain.addRow([]);
    worksheetMain.addRow([]);
    worksheetMain.addRow([]);
    worksheetMain.addRow(['Resumen concentrado de transacciones']);
    worksheetMain.addRow([`Del ${dayStart.toISOString()} al ${dayEnd.toISOString()}`]);
    worksheetMain.mergeCells('A7:I7')
    worksheetMain.mergeCells('A8:I8')
    worksheetMain.mergeCells('C1:G5')
    syleTitle(worksheetMain.getCell('A7'))
    syleTexto(worksheetMain.getCell('A8'))

    worksheetMain.addRow([]);
    const filaHeadTable = worksheetMain.addRow(['Cliente', 'Producto', 'No. Transacciones', 'Monto Bruto', 'Tasa',    'IVA Tasa (16%)',  'Comisiones Antifraude',   'IVA Comisiones Antifraude (16%)', 'Monto Neto'])
    filaHeadTable._cells.forEach(cell => syleHeadTable(cell))

    const resumenMaster = [];
    [...new Set(resumenTodos.slice(1).map(r => r[0]))].forEach(cliente => {
        const netoAll = resumenTodos.filter(r => cliente === r[0])
        return ['Debito', 'Credito', 'Internacional'].forEach(p => {
            const subNeto = netoAll.filter(n => p === n[1]);

            const datos = [2,3,4,5,6,7,8].map(i => subNeto.map(fila => fila[i]).reduce((a, v) => a + v));

            datos.unshift(cliente, p)

            resumenMaster.push(datos)
        })
    })

    resumenMaster.forEach(resumen => {
        const fila = worksheetMain.addRow(resumen)
        fila._cells.forEach(cell => {
            if (/^A\d+$/.test(cell._address))
                syleTextoNegro(cell, 'left')
            else if (/^B\d+$/.test(cell._address) || /^C\d+$/.test(cell._address))
                syleTextoNegro(cell)
            else
                syleDinero(cell)
        })
    })

    hojas.forEach(hoja => {
        const worksheet = workbook.addWorksheet(`Cliente (ID ${hoja.ID}) ${hoja.name}`);
        worksheet.addRow([]);
        worksheet.addRow([]);
        worksheet.addRow(['ID Cliente', hoja.ID]);
        worksheet.addRow(['Cliente', hoja.name]);
        syleHeadTable(worksheet.getCell('A3'), 'right')
        syleHeadTable(worksheet.getCell('A4'), 'right')
        worksheet.addImage(imageId, 'G1:I5')
        worksheet.mergeCells('G1:I5')
        worksheet.addRow([]);
        worksheet.addRow([]);
        worksheet.addRow([]);

        worksheet.addRow(['Resumen de transacciones']);
        worksheet.addRow([`Del ${dayStart.toISOString()} al ${dayEnd.toISOString()}`]);
        worksheet.mergeCells('A9:I9')
        worksheet.mergeCells('A10:I10')
        syleTitle(worksheet.getCell('A9'))
        syleTexto(worksheet.getCell('A10'))

        worksheet.addRow([]);
        worksheet.addRow([]);

        const filaHeadTable = worksheet.addRow(['Comercio', 'No. Transacciones', 'Monto Bruto', 'Tasa', 'IVA Tasa (16%)',  'Comisiones Antifraude',   'IVA Comisiones Antifraude (16%)', 'Monto Neto']);
        filaHeadTable._cells.forEach(cell => syleHeadTable(cell))
        hoja.resumen.forEach((r, index) => {
            const fila = worksheet.addRow(r);
            fila._cells.forEach(cell => {
                if (/^A\d+$/.test(cell._address))
                    syleTextoNegro(cell, 'left', 0 === index%2)
                else if (/^B\d+$/.test(cell._address))
                    syleTextoNegro(cell, 'center', 0 === index%2)
                else
                    syleDinero(cell, 'right', 0 === index%2)
            })
        });

        worksheet.addRow([]);
        worksheet.addRow([]);
        worksheet.addRow([]);

        hoja.body.forEach(comercio => {
            comercio.forEach((c, nFila) => {
                const fila = worksheet.addRow(c);
                if((5 < nFila && 24 > nFila) || 25 === nFila || 26 === nFila || 27 === nFila) {
                    fila._cells.forEach(cell => {
                        if (/^A\d+$/.test(cell._address))
                            syleTextoNegro(cell, 'left', 0 === nFila%2)
                        else if (/^B\d+$/.test(cell._address))
                            syleTextoNegro(cell, 'center', 0 === nFila%2)
                        else if (/^D\d+$/.test(cell._address) || 27 === nFila || /^I\d+$/.test(cell._address))
                            syleTextoNegro(cell, 'center', 0 === nFila%2)
                        else
                            syleDinero(cell, 'right', 0 === nFila%2)
                    });
                }

                if(5 === nFila)
                    fila._cells.forEach(cell => syleHeadTable(cell));

                if (0 <= nFila && 3 >= nFila) {
                    fila._cells.forEach(cell => {
                        if (/^A\d+$/.test(cell._address))
                            syleHeadTable(cell, 'right')
                        else
                            syleTextoNegro(cell, 'left', 0 === nFila%2)
                    })
                }

                if(25 === nFila || 26 === nFila || 27 === nFila) {
                    fila._cells.forEach(cell => {
                        if (/^A\d+$/.test(cell._address)) {
                            syleHeadTable(cell, 'right')
                            if(26 === nFila || 27 === nFila)
                                worksheet.mergeCells(`${cell._address}:${cell._address.replace('A', 'H')}`)
                        }
                    })
                }
            })

            worksheet.addRow([]);
            worksheet.addRow([]);
            worksheet.addRow([]);
        })
    });
}

module.exports.makeReport = async (datas, dayStart, dayEnd, name, format = 'pdf') => {
    console.log(`makeReport - Generating both XLSX (for records) and PDF (for distribution)`);

    const logo = process.env.ENV_LOGO;
    const imaContenido = readFileSync(resolve(logo));

    // Always generate XLSX for internal records
    const workbook = new ExcelJS.Workbook();
    const imageId = workbook.addImage({
        buffer: imaContenido,
        extension: 'jpeg',
    });

    const hojas = datas.map(data => {
        const ID = data.cli.id;
        const name = data.cli.name;

        const body = data.merchants.map(merchant => {
            return geoData(dayStart, dayEnd, data.cli,
                merchant.id, merchant.name, merchant.rfc, merchant.clabe,
                merchant.dataCargo_debit, merchant.dataCargo_credit, merchant.dataCargo_internacional,
                merchant.dataCargo_debit_link, merchant.dataCargo_credit_link, merchant.dataCargo_internacional_link,
                merchant.dataCargo_credit_msi3, merchant.dataCargo_credit_msi6, merchant.dataCargo_credit_msi9, merchant.dataCargo_credit_msi12, merchant.dataCargo_credit_msi18,
                merchant.dataDevolucion_debit, merchant.dataDevolucion_credit, merchant.dataDevolucion_internacional,
                merchant.dataCancelacion_debit, merchant.dataCancelacion_credit, merchant.dataCancelacion_internacional,
                merchant.retencion
            )
        })

        const respuesta = { ID, name, resumen, body }

        resumen = [];

        return respuesta;
    });

    // Generate XLSX file for internal records
    console.log('Generating XLSX file for internal records...');
    await generateXLSX(workbook, hojas, dayStart, dayEnd, imageId);
    const xlsxFileName = `${name}.xlsx`;
    await workbook.xlsx.writeFile(xlsxFileName);
    console.log(`XLSX file saved as: ${xlsxFileName}`);

    // Generate PDF file for distribution
    console.log('Generating PDF file for distribution...');
    const html = await generateHtml(hojas, dayStart, dayEnd);
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfFileName = `${name}.pdf`;
    await page.pdf({ path: pdfFileName, format: 'A4', printBackground: true });
    await browser.close();
    console.log(`PDF file saved as: ${pdfFileName}`);

    // Reset resumenTodos for next use
    resumenTodos = [
        ['Cliente', 'Producto', 'No. Transacciones', 'Monto Bruto', 'Tasa', 'IVA Tasa (16%)',  'Comisiones Antifraude',   'IVA Comisiones Antifraude (16%)', 'Monto Neto']
    ];

    // Return PDF file path as the primary result for distribution
    return {
        pdfPath: pdfFileName,
        xlsxPath: xlsxFileName,
        message: 'PDF generated for distribution, XLSX kept for internal records'
    };
};