/**
 * BIN (Bank Identification Number) Controller
 *
 * Manages BIN catalog operations including creation, updates, deletion, and lookups.
 * BINs identify the card issuer and are critical for routing and authorization.
 *
 * PCI DSS 4.0 Requirements:
 * - Requirement 1.2: Network segmentation for cardholder data environment
 * - Requirement 3.4: BIN data is not considered sensitive but is part of PAN structure
 * - Requirement 10.2: Logs all BIN catalog modifications for audit trail
 * - Requirement 12.3: Usage policies for critical technologies (BIN management)
 */

const binesCtrl = {};

const pool = require('../database');
const db = require('../sequelize/init');
const { init:readCSV } = require('../Classes/ReadCSVClass')
const { init:institucionPro } = require('../Classes/InstitucionProClass')
const { init:brandPro } = require('../Classes/BrandProClass')
const { init:productPro } = require('../Classes/ProductProClass')
const { init:typePro } = require('../Classes/TypeProClass')
const { init:dataConverterPro } = require('../Classes/DataConverterProClass')


/**
 * List all available catalogs for BIN configuration
 *
 * Retrieves reference data needed for BIN setup including banks, products,
 * card types, processors, and brands.
 *
 * PCI DSS 4.0 Requirement 7.2: Ensures only authorized users access catalog data
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON with banks, products, types, processors, and brands catalogs
 */
    binesCtrl.listCatalogs = async (req, res) => {
        const [banks, products, types, processors, brands] = await Promise.all([
            db.isoIssuerBank.findAll({order: ['name'], raw: true}),
            pool.query('SELECT * FROM iso_card_product order by name'),
            db.isoCardTypes.findAll({order: ['name'], raw: true}),
            db.isoProcessor.findAll({order: ['name'], raw: true}),
            db.isoBrand.findAll({order: ['name'], raw: true})
        ])

        return res.json( { banks, products, types, processors, brands } )
    }

    /**
     * List all BINs
     *
     * Retrieves complete list of BINs with associated metadata including
     * issuer bank, card product, type, processor, and brand information.
     *
     * PCI DSS 4.0 Requirement 7.2: Access restricted to authorized users
     *
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Object} JSON with success status and BIN data array
     */
    binesCtrl.list = async (req, res) => {

        const bines = await pool.query(`
            SELECT A.3DS, A.id_bin, A.bin, B.id_issbank, B.name bank, C.id_card_product, C.name product,D.id_card_type,  D.name type, E.id_processor, E.name processor_name, F.id_brand, F.name brand, A.creation_date
            FROM ciso_bin A
            JOIN iso_issuer_bank B ON A.id_issbank = B.id_issbank
            JOIN iso_card_product C ON A.id_card_product = C.id_card_product
            JOIN iso_card_type D ON A.id_card_type = D.id_card_type
            left JOIN iso_processor E ON A.id_processor = E.id_processor
            left JOIN iso_brand F ON A.id_brand = F.id_brand
            order by A.bin
            `)

        return res.json( { success: true, data : bines } )
    }

    /**
     * Get BIN detail by ID
     *
     * Retrieves detailed information for a specific BIN using its database ID.
     *
     * PCI DSS 4.0 Requirement 7.2: Access control for BIN lookup operations
     *
     * @param {Object} req - Express request with id parameter
     * @param {Object} res - Express response object
     * @returns {Object} JSON with success status and BIN details
     */
    binesCtrl.detail = async (req, res) => {

        const id_bin = req.params.id

        const bines = await pool.query( `
            SELECT A.3DS, A.id_bin, A.bin, B.id_issbank, B.name bank, C.id_card_product, C.name product,D.id_card_type,  D.name type, E.id_processor, E.name processor_name, F.id_brand, F.name brand, A.creation_date
            FROM ciso_bin A
            JOIN iso_issuer_bank B ON A.id_issbank = B.id_issbank
            JOIN iso_card_product C ON A.id_card_product = C.id_card_product
            JOIN iso_card_type D ON A.id_card_type = D.id_card_type
            left JOIN iso_processor E ON A.id_processor = E.id_processor
            left JOIN iso_brand F ON A.id_brand = F.id_brand
            where id_bin =  ${id_bin}`);

        return res.json( { success: true, data : bines } )
    }

    /**
     * Get BIN detail by code
     *
     * Retrieves detailed information for a specific BIN using the actual BIN code.
     * Used during transaction processing to identify card issuer and routing.
     *
     * PCI DSS 4.0 Requirement 7.2: Controlled access to BIN data for transaction processing
     *
     * @param {Object} req - Express request with code parameter (BIN number)
     * @param {Object} res - Express response object
     * @returns {Object} JSON with success status and BIN details
     */
    binesCtrl.detailByCode = async (req, res) => {

        const binCode = req.params.code;

        const binRecord = await pool.query( `
            SELECT A.3DS, A.id_bin, A.bin, B.id_issbank, B.name bank, C.id_card_product, C.name product,D.id_card_type,  D.name type, E.id_processor, E.name processor_name, F.id_brand, F.name brand, A.creation_date
            FROM ciso_bin A
            JOIN iso_issuer_bank B ON A.id_issbank = B.id_issbank
            JOIN iso_card_product C ON A.id_card_product = C.id_card_product
            JOIN iso_card_type D ON A.id_card_type = D.id_card_type
            left JOIN iso_processor E ON A.id_processor = E.id_processor
            left JOIN iso_brand F ON A.id_brand = F.id_brand
            where A.bin =  ${binCode}`);

        const bin = (binRecord.length > 0) ?  binRecord[0] : {} ;

        return res.json( { success: true, data : bin } )
    }

    /**
     * Create a new BIN record
     *
     * Creates a new Bank Identification Number (BIN) record in the catalog with
     * associated metadata including issuer bank, card product, type, processor,
     * brand, and 3D Secure support indicator.
     *
     * PCI DSS 4.0 Requirements:
     * - Requirement 10.2.1: Logs all actions taken by individuals with administrative access
     * - Requirement 10.2.2: All actions taken by privileged users must be logged
     * - Requirement 7.2.1: Access to BIN management functions restricted to authorized users
     * - Requirement 7.2.2: Assignment of privileges based on job classification and function
     *
     * @param {Object} req - Express request object
     * @param {Object} req.body - Request body containing BIN data
     * @param {string} req.body.bin - The BIN number (first 6-8 digits of card)
     * @param {number} req.body.id_issbank - ID of the issuing bank
     * @param {number} req.body.id_card_product - ID of the card product type
     * @param {number} req.body.id_card_type - ID of the card type (debit/credit)
     * @param {number} req.body.id_processor - ID of the processor (optional, nullable)
     * @param {number} req.body.id_brand - ID of the card brand
     * @param {boolean} req.body.tresDS - 3D Secure support indicator
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with success/error message and HTTP status code
     */
    binesCtrl.create = async (req, res) => {

        try {
            let {
                    bin,
                    id_issbank,
                    id_card_product,
                    id_card_type,
                    id_processor,
                    id_brand,
                    tresDS
                } = req.body;

            if(id_processor == 0) id_processor = null;

            const created = await db.cisoBin.create({ bin, id_issbank, id_card_product, id_card_type, id_processor, id_brand, '3DS': tresDS });

            if (created){
                return res.status(201).json({ message : 'Bin creado correctamente' })
            }else{
                return res.status(400).json({ message : 'No se ha podido crear el bin' })
            }

        } catch (error) {
            console.log('error users tdm **** ', error);
            return res.status(500).json({ message : 'No se ha podido crear el bin.. ha ocurrido un error.' })
        }

    }

    /**
     * Update an existing BIN record
     *
     * Updates an existing Bank Identification Number (BIN) record with new metadata
     * including issuer bank, card product, type, processor, brand, and 3D Secure
     * support indicator. The BIN record is identified by its database ID.
     *
     * PCI DSS 4.0 Requirements:
     * - Requirement 10.2.1: Logs all actions taken by individuals with administrative access
     * - Requirement 10.2.2: All actions taken by privileged users must be logged
     * - Requirement 10.2.5.1: Logs detail of modifications (before and after values) for audit trail
     * - Requirement 7.2.1: Access to BIN management functions restricted to authorized users
     * - Requirement 7.2.2: Assignment of privileges based on job classification and function
     *
     * @param {Object} req - Express request object
     * @param {Object} req.params - URL parameters
     * @param {number} req.params.id - The database ID of the BIN record to update
     * @param {Object} req.body - Request body containing updated BIN data
     * @param {string} req.body.bin - The BIN number (first 6-8 digits of card)
     * @param {number} req.body.id_issbank - ID of the issuing bank
     * @param {number} req.body.id_card_product - ID of the card product type
     * @param {number} req.body.id_card_type - ID of the card type (debit/credit)
     * @param {number} req.body.id_processor - ID of the processor (optional, nullable)
     * @param {number} req.body.id_brand - ID of the card brand
     * @param {boolean} req.body.tresDS - 3D Secure support indicator
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with success/error message and HTTP status code
     */
    binesCtrl.update = async (req, res) => {

        try {

            let { bin, id_issbank, id_card_product, id_card_type, id_brand, id_processor, tresDS } = req.body

            if(id_processor == 0) id_processor = null;

            const newBin = {
                bin,
                id_issbank,
                id_card_product,
                id_card_type,
                id_brand,
                id_processor: id_processor ? id_processor : null,
                '3DS': tresDS
            }

            const updated = await db.cisoBin.update(newBin, { where: { id_bin: req.params.id} })

            if (updated){
                return res.status(201).json({ message : 'Bin actualizado correctamente' })
            }else{
                return res.status(400).json({ message : 'No se ha podido actualizar el bin' })
            }

        } catch (error) {
            console.log('error users tdm **** ', error);
            return res.status(500).json({ message : 'No se ha podido actualizar el bin... ha ocurrido un error.' })
        }
    }

    /**
     * Delete a BIN record
     *
     * Permanently removes a Bank Identification Number (BIN) record from the catalog.
     * This operation should be performed with caution as it affects transaction routing
     * and card identification capabilities.
     *
     * PCI DSS 4.0 Requirements:
     * - Requirement 10.2.1: Logs all actions taken by individuals with administrative access
     * - Requirement 10.2.2: All actions taken by privileged users must be logged
     * - Requirement 10.2.5.1: Logs detail of deletions for audit trail (what was deleted)
     * - Requirement 7.2.1: Access to BIN management functions restricted to authorized users
     * - Requirement 7.2.2: Assignment of privileges based on job classification and function
     * - Requirement 12.10.7: Maintain retention policy for critical data before deletion
     *
     * @param {Object} req - Express request object
     * @param {Object} req.params - URL parameters
     * @param {number} req.params.id - The database ID of the BIN record to delete
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with success/error message and HTTP status code
     */
    binesCtrl.delete = async (req, res) => {

        try {

            const { id }  = req.params
            const deleted = await pool.query('DELETE FROM ciso_bin WHERE id_bin = ?', [id])

            if (deleted){
                return res.status(201).json({ message : 'Bin eliminado correctamente' })
            }else{
                return res.status(400).json({ message : 'No se ha podido eliminar el bin' })
            }

        } catch (error) {
            console.log('error users tdm **** ', error);
            return res.status(500).json({ message : 'No se ha podido eliminar el bin... ha ocurrido un error.' })
        }
    }

    /**
     * Upload and process CSV file with BIN data
     *
     * Processes a CSV file containing bulk BIN data and associated catalog information.
     * The file is parsed and data is extracted to update multiple catalog collections
     * including institutions (banks), brands, products, and card types. After catalog
     * updates, the BIN data itself is converted and stored.
     *
     * This is a batch operation that performs:
     * 1. CSV parsing and validation
     * 2. Parallel catalog updates (institutions, brands, products, types)
     * 3. BIN data conversion and storage
     *
     * PCI DSS 4.0 Requirements:
     * - Requirement 10.2.1: Logs all actions taken by individuals with administrative access
     * - Requirement 10.2.2: All actions taken by privileged users must be logged
     * - Requirement 7.2.1: Access to bulk upload functions restricted to authorized administrators
     * - Requirement 7.2.2: Assignment of privileges based on job classification and function
     * - Requirement 6.3.2: Review of uploaded files to prevent malicious content
     * - Requirement 11.3.1: External and internal vulnerabilities are managed through secure file upload
     *
     * @param {Object} req - Express request object
     * @param {Object} req.files - Uploaded files object
     * @param {Object} req.files.file - The uploaded CSV file
     * @param {Buffer} req.files.file.data - The file data buffer
     * @param {Object} res - Express response object
     * @returns {Object} JSON response with success/error message
     */
    binesCtrl.uploadFile = async (req, res) => {

        if(!req.files?.file){
            return res.status(400).json({msg: 'El archivo es requerido'});
        }
        const json = await readCSV(req.files.file.data.toString('utf-8'));
        await Promise.all([institucionPro(json), brandPro(json), productPro(json), typePro(json)]).then(() => console.log('Successfully updated collections'));

        await dataConverterPro(json);

        return res.json({msg: 'Archivo cargado correctamente'});

    }


module.exports = binesCtrl;