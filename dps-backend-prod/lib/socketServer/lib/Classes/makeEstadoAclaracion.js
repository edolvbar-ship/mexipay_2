module.exports = function (doc) {

    const contactName    = process.env.ACOUNT_STATE_CONTACT_NAME ?? 'MENFIS TECNOLOGIA Y DESARROLLO S.A de C.V.';
    const contactAddress = process.env.ACOUNT_STATE_ADDRESS ?? 'Av. SANTA FE 505 PISO 1 MEZZANINE 2B, SANTA FE CUAJIMALPA, CUAJIMALPA DE MORELOS, 05348, CDMX';
    const contactMail    = process.env.ACOUNT_STATE_CONTACT_EMAIL ?? 'contacto@menfis.com';
    const contactPhone   = process.env.ACOUNT_STATE_CONTACT_PHONE ?? '55-1234-5678';
    const schedule       = process.env.ACOUNT_STATE_SCHEDULE ?? 'Lunes a Viernes de 9:00 a 18:00 hrs';

    // Debug logging for contact info
    console.log('📞 Contact info:', { contactName, contactAddress, contactMail, contactPhone, schedule });

    doc.addPage();

    doc.fontSize(15).text('Estado de cuenta', 0, doc.page.margins.bottom+80, { align: 'center' });

    doc.font('Helvetica-Bold').fontSize(10).text('CONSULTAS Y RECLAMACIONES:', doc.page.margins.left, doc.page.margins.bottom+100);
    doc.font('Helvetica').fontSize(9).text(`Para cualquier solicitud, aclaración o reclamación derivada de los cargos señalados en el estado de cuenta, podrá dentro del plazo de 90\ndías naturales siguientes contados a partir de la fecha de corte, o en su caso, de la realización de la operación o del servicio , presentar\nuna solicitud de alcaración en el siguiente correo: ${contactMail}.`, doc.page.margins.left, doc.page.margins.bottom+115, { align: 'center' });
    
    doc.font('Helvetica').fontSize(9).text(`Para cualquier consulta podrá contactarnos de ${schedule} en el teléfono:\n* ${contactPhone}`, doc.page.margins.left, doc.page.margins.bottom+150, { align: 'justify' });

    doc.font('Helvetica').fontSize(9).text(`Para consultas, reclamaciones o aclaraciones puede acudir personalmente en nuestra ubicación: ${contactAddress} con ${contactName}.`, doc.page.margins.left, doc.page.margins.bottom+180, { align: 'justify' });

    doc.rect(doc.page.margins.left, 257, doc.page.width-doc.page.margins.right-doc.page.margins.left, 78).fillColor('black').fill();
    doc.rect(doc.page.margins.left+2, 270, doc.page.width-doc.page.margins.right-doc.page.margins.left-4, 75-12).fillColor('#D6DBDF').fill()
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('GLOSARIO DE ABREVIATURAS', 0, 260, { width: doc.page.width, align: 'center' }).fillColor('white');

    const tags = [
        { title: 'COMISIONES COBRADAS EN EL MES', val: 'Comisión pactada mensual por las transacciones.' },
        { title: 'IVA COBRADO DE COMISIONES', val: 'Es el IVA de las comisiones cobradas a la tasa 16%.' },
        { title: 'DEVOLUCIONES DEL PERIODO', val: 'Retorno de su dinero hecho al cliente.' },
        { title: 'SALDO PROMEDIO DE TRANSACCIONES', val: 'Saldo que se tiene durante todo el periodo, dividido entre el número de dias del mismo.' },
        { title: 'TICKET PROMEDIO', val: 'Tickets de todo el periodo, dividido entre el número de dias del mismo.' },
    ]

    const x = doc.page.margins.right+3;
    const tableTop = doc.page.margins.top + 264;
    const rowHeight = (doc.page.width * 0.5)-doc.page.margins.right-4;
    doc.fontSize(8).fillColor('black');
    tags.forEach((row, rowIndex) => {
        doc.font('Helvetica-Bold').text(row.title, x, tableTop+(rowIndex*10));
        doc.font('Helvetica').text(row.val, x+rowHeight-50, tableTop+(rowIndex*10), { width: rowHeight+50, align: 'right' });
    });
}