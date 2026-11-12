const package = require('../../../../../../package.json');
const aboutCtrl = {};

aboutCtrl.getInfo = async (req, res, next) => {
    const processors = [];
    if(!!process.env.BROXEL_WHITELABEL_BASE_URL) {
        processors.push('MBBL');
    }
    res.status(200).json({ version: package.version, processors})
}


module.exports = aboutCtrl;