const QRCode = require('qrcode');

module.exports = async function (doc, detaails = {} ) {

    const resultData = detaails?.response?.data || {};
    const products   = detaails?.request?.products || {};

     // products section

        let subTotal = 0;
        let total = 0;
        let totalIva = 0;

        products.forEach(product => { 
            totalIva    = totalIva + product.taxes[0].total;
            subTotal    = subTotal + product.subtotal;
        });

        subTotal = parseFloat(subTotal.toFixed(2));
        totalIva = parseFloat(totalIva.toFixed(2));
        total = parseFloat((subTotal + totalIva).toFixed(2));

    // end products page


    // QR code
        let imgUrl = '';
        let imgBuffer = ''

        try {
            const urlCFDI = await QRCode.toDataURL(resultData.cfdiUrl);
            imgUrl = urlCFDI;
        } catch (err) {
            console.error(err);
        }

        doc.addPage();

        const base64Data = imgUrl.split(',')[1];
        imgBuffer = Buffer.from(base64Data, 'base64');
        const imagenPath = imgBuffer;
        const imagenAncho = doc.page.width * 0.2;
        const imagenX =  25; // mueve a la derecha
        const offsetY = 280; // mueve arriba
        const imagenY = doc.page.height - imagenAncho - offsetY;

        doc.image(imagenPath, imagenX, imagenY, { width: imagenAncho });

    // End QR code
     
    doc.fontSize(15).text('Comprobante fiscal digital', 0, doc.page.margins.bottom+80, { align: 'center' });

    resumen(twoDecimals(subTotal), twoDecimals(totalIva), twoDecimals(total) );

    doc.text('', doc.page.margins.left, 180, { width: doc.page.width * 0.55, align: 'left' });

    doc.font('Helvetica-Bold').fontSize(9).text(`Folio Fiscal: `, { continued: true }).font('Helvetica').text(`${resultData.fiscalId}`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text(`No de Serie del Certificado del SAT: `, { continued: true }).font('Helvetica').text(`${resultData.noSerieCertSat}`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text(`No de serie del Certigicado del Emisor: `, { continued: true }).font('Helvetica').text(`${resultData.noSerieCertEmisor}`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text(`Fecha y Hora de Certificado: `, { continued: true }).font('Helvetica').text(`${resultData.date}`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text(`Lugar y Fecha de Elaboración: `, { continued: true }).font('Helvetica').text(`${resultData.placeDate}`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text(`Forma de pago: `, { continued: true }).font('Helvetica').text(`${resultData.paymentForm}`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text(`Sello Digital del CFDI: `, { continued: false }).font('Helvetica').text(`${resultData.digitalSignCFDI}`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(9).text(`Sello del SAT: `, { continued: false }).font('Helvetica').text(`${resultData.digitalSignSAT}`);

    doc.moveDown();

    const marginRight = 180; // Ajusta este valor para lanzar el texto a la derecha
   
    doc.font('Helvetica-Bold').fontSize(9)
        .text(`Cadena origianl del complemento de certificación: `, marginRight, undefined, { continued: false })
            .font('Helvetica').text(`${resultData.originalChain}`);

    // doc.moveDown(0.5);
    // doc.font('Helvetica-Bold').fontSize(9).text(`Versión CFDI: `, { continued: true }).font('Helvetica').text(`${resultData.cfdiVersion}`);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).text(`Método de pago: `, { continued: true }).font('Helvetica').text(`${resultData.paymentMethod}`);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).text(`Lugar de Expedición: `, { continued: true }).font('Helvetica').text(`${resultData.expeditionPlace}`);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).text(`Régimen Fiscal del Emisor: `, { continued: true }).font('Helvetica').text(`${resultData.fiscalRegimenIssuer}`);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).text(`Unidad: `, { continued: true }).font('Helvetica').text(`${resultData.unit}`);

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(9).text(`Código Postal del Receptor: `, { continued: true }).font('Helvetica').text(`${resultData.zipCodeReceptor}`);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).text(`Régimen Fiscal del Receptor: `, { continued: true }).font('Helvetica').text(`${resultData.fiscalRegimenReceptor}`);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).text(`Uso del CFDI: `, { continued: true }).font('Helvetica').text(`${resultData.cfdiUsage}`);
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(9).text(`Este documento es una representación impresa de un CFDI`);



    // end products section

    function resumen(subtotal = 0, iva = 0, total = 0) {

        const topP = doc.page.margins.top + 105;
        const x = doc.page.margins.left;

        doc.rect(x, topP, (doc.page.width*0.9), 1).fill().fillColor('black');
        doc.rect(x, topP + 52, (doc.page.width*0.9), 1).fill().fillColor('black')

        doc.font('Helvetica-Bold').fontSize(10);
        doc.text(`RESUMEN`, x+1, topP + 7, { width: doc.page.width * 0.9, align: 'center' });
            
        const tags = [
          { title: 'Subtotal de Comisiones de Mes', val: subtotal, bold: true },
          { title: 'Total de IVA (16%)', val: iva, bold: false },
          { title: 'Total', val: total, bold: true },
        ]
      
        const tableTop = topP + 22;
        const rowHeight = (doc.page.width * 0.5)*0.5;

        doc.font('Helvetica').fontSize(8);
        tags.forEach((row, rowIndex) => {
          doc.font(!row.bold ? 'Helvetica' : 'Helvetica-Bold');
          if(row.bold)
            doc.rect(x, tableTop+(rowIndex*10)-1, (doc.page.width*0.9), 8).fillColor('#D6DBDF').fill().fillColor('black')
      
          doc.text(row.title, x, tableTop+(rowIndex*10));
          doc.text(row.val, x+rowHeight-50, tableTop+(rowIndex*10), { width: rowHeight+250, align: 'right' });
        });

    }

    function twoDecimals(number) {
        return Math.floor(number * 100) / 100;
    }


}