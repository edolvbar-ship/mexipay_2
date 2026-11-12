/**
 * @file ISO reference catalog route aggregator.
 * Mounts controllers for person types, MCCs, banks, networks, processors, countries, etc.
 * PCI DSS 4.0: Req 7.1.1 (access control), Req 12.3.1 (configuration management).
 */
const express = require('express');

const router = express.Router();

const ctrl = require('../../../controllers/SPA/Catalgues/index.controller')
const personTypeController = require('../../../controllers/SPA/Catalgues/ISO/personTypes.controller');
const transactionalSchemasController = require('../../../controllers/SPA/Catalgues/ISO/transactionalSchemas.controller');
const mccsController = require('../../../controllers/SPA/Catalgues/ISO/merchantCategoryCodes.controller');
const acquirerBanksController = require('../../../controllers/SPA/Catalgues/ISO/acquirerBanks.controller');
const logicalNetworksController = require('../../../controllers/SPA/Catalgues/ISO/logicalNetworks.controller');
const processorsController = require('../../../controllers/SPA/Catalgues/ISO/processors.controller');
const transactionModesController = require('../../../controllers/SPA/Catalgues/ISO/transactionModes.controller');
const targetUrlsController = require('../../../controllers/SPA/Catalgues/ISO/targetUrls.controller');
const transactionProfilesController = require('../../../controllers/SPA/Catalgues/ISO/transactionProfiles.controller');
const aggregatorController = require('../../../controllers/SPA/Catalgues/ISO/aggregator.controller');
const countryController = require('../../../controllers/SPA/Catalgues/ISO/countries.controller');
const stateController = require('../../../controllers/SPA/Catalgues/ISO/states.controller');
const taxRegimenController = require('../../../controllers/SPA/Catalgues/ISO/taxRegimens.controller');

/** Returns merchant-related catalog data. */
router.get('/merchant', ctrl.get)

/** Mounts person type catalog routes. */
router.use('/personTypes', personTypeController);
/** Mounts transactional schema catalog routes. */
router.use('/transactionalSchemas', transactionalSchemasController);
/** Mounts merchant category code catalog routes. */
router.use('/merchantCategoryCodes', mccsController);
/** Mounts acquirer bank catalog routes. */
router.use('/acquirerBanks', acquirerBanksController);
/** Mounts logical network catalog routes. */
router.use('/logicalNetworks', logicalNetworksController);
/** Mounts processor catalog routes. */
router.use('/processors', processorsController);
/** Mounts transaction mode catalog routes. */
router.use('/transactionModes', transactionModesController);
/** Mounts target URL catalog routes. */
router.use('/targetUrls', targetUrlsController);
/** Mounts transaction profile catalog routes. */
router.use('/transactionProfiles', transactionProfilesController);
/** Mounts ISO aggregator catalog routes. */
router.use('/isoAggregators', aggregatorController);
/** Mounts state catalog routes. */
router.use('/cisoStates', stateController);
/** Mounts country catalog routes. */
router.use('/cisoCountries', countryController);
/** Mounts tax regimen catalog routes. */
router.use('/taxRegimens',taxRegimenController);

module.exports = router;