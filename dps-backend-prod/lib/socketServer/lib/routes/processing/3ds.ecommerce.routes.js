/**
 * @file 3D Secure verification routes for ecommerce charges.
 * Replays stored 3DS headers to the ecommerce charge endpoint and updates payment link status.
 * PCI DSS 4.0: Req 4.2.1 (secure CHD transmission), Req 8.2.1 / 8.3.2 (authentication via 3DS), Req 10.2.1 (audit logging), Req 3.4 (sensitive data handling).
 */
const router = require('express').Router();
const axios = require('axios');
const db = require('../../sequelize/init');
const { v4: uuidv4 } = require('uuid');

const { status, statusLink } = require('../../services/3ds.service');

/** Replays a 3DS-verified charge request using stored headers and a reference parameter. */
router.get('/very/charge/:referencia', statusLink, async (req, res) => {
    console.log('--> 3ds very charge link')
    const headers = req.app.get(`newHeaders_${req.params.referencia}`)
    req.app.set(`newHeaders_${req.params.referencia}`, '');
    const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${req.protocol}://${req.headers.host}/gateway/v1/ecommerce/charge`,
        headers: JSON.parse(headers),
        data: JSON.stringify(req.body)
    };

    console.log('--> 3ds very charge link', 'config', config)

    const respuesta = await axios.request(config)
        .then(async response => {
            console.log('--> 3ds very charge link - OK')
            return [response.status, response.data];
        })
        .catch(error => {
            console.log('--> 3ds very charge link - FALL')
            return [error.response.status, error.response.data]
        });
        if(req.session.paymentData != undefined && req.session.paymentData.token != undefined && req.session.paymentData.token != null){
            await db.linksPago.update({ status: respuesta[1].resp_code == '00' ? 2 : 3, info_adicional: JSON.stringify(respuesta[1]) }, { where: { token: req.session.paymentData.token } })
                .then(result => console.log('Resultado correcto', result))
                .catch(error => console.error('error en actualizar estatus', error))
        }
    return res.status(respuesta[0]).json(respuesta[1]);
});

/** Replays a 3DS-verified charge request using a reference in the body. */
router.post('/very/charge', status, async (req, res) => {
    console.log('--> 3ds very charge')
    try {
        const headers = req.app.get(`newHeaders_${req.body.reference}`)
        req.app.set(`newHeaders_${req.body.reference}`, '');
        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: `${req.protocol}://${req.headers.host}/gateway/v1/ecommerce/charge`,
            headers: JSON.parse(headers),
            data: JSON.stringify(req.body)
        };
        const respuesta = await axios.request(config)
            .then(response => [response.status, response.data])
            .catch(error => {
                console.error(error);
                return [error.response.status, error.response.data]
            });
        return res.status(respuesta[0]).json(respuesta[1]);
    } catch (error) {
        console.log(error);
        return res.json({
            request_id: uuidv4(),
            request_status: true,
            http_code: 200,
            resp_code: "05",
            description: "Rechazada por 3DS"
        });
    }
});

module.exports = router;


