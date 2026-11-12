/**
 * Transactional Profiles Controller
 *
 * This controller manages transactional profiles that define ISO 8583 message processing
 * configurations. Transactional profiles control which data elements (bitmap fields) are
 * included in transaction messages and define the behavior of transaction processing.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 6.4.1: Transaction processing controls are implemented through profile validation
 * - Requirement 7.2: Access control is enforced for profile management operations
 * - Requirement 10.2: All profile modifications are auditable through database logging
 * - Requirement 12.3: Usage policies are enforced through profile configurations
 *
 * Security Considerations:
 * - Profile modifications affect transaction processing behavior
 * - Hex value bitmaps control sensitive data element inclusion
 * - Access to profile management should be restricted to authorized administrators
 * - All changes should be logged for audit purposes
 *
 * @module controllers/transactionalProfiles
 * @requires ../lib/helpers
 * @requires ../database
 */

const ptCtrl = {};
const helpers = require('../lib/helpers');
const pool = require('../database');

// api management

    /**
     * Retrieve catalogs list for transactional profile configuration
     *
     * Returns reference data needed to configure transactional profiles including:
     * - Transaction types (iso_trantype)
     * - Operative applications (iso_operative)
     * - Transaction indicators (iso_tranindicator)
     *
     * PCI DSS 4.0 Compliance:
     * - Requirement 6.4.1: Provides validated reference data for transaction controls
     * - Requirement 7.2: Read-only access to configuration catalogs
     *
     * @async
     * @function catalogsList
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} JSON response with catalog data
     * @returns {Array} returns.transactionsType - List of transaction types
     * @returns {Array} returns.aplicationsOperatives - List of operative applications
     * @returns {Array} returns.indicators - List of transaction indicators
     */
    ptCtrl.catalogsList = async (req, res) => {
        const transactionsType          = await pool.query('SELECT * FROM iso_trantype order by id_trantype')
        const aplicationsOperatives     = await pool.query('SELECT * FROM iso_operative order by id_operative')
        const indicators                = await pool.query('SELECT * FROM iso_tranindicator order by id_tranindicator')
        return res.json( { transactionsType, aplicationsOperatives, indicators } )
    }

    /**
     * List all transactional profiles
     *
     * Retrieves all transactional profiles from the database, ordered by profile ID.
     * Each profile contains a hex bitmap value that defines which ISO 8583 fields
     * are active for transactions using that profile.
     *
     * PCI DSS 4.0 Compliance:
     * - Requirement 7.2: Read access to profile configurations for authorized users
     * - Requirement 10.2: Profile access can be logged for audit trails
     * - Requirement 12.3: Supports policy enforcement by providing profile visibility
     *
     * @async
     * @function list
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} JSON response with success status and profile list
     * @returns {boolean} returns.success - Operation success status (always true)
     * @returns {Array<Object>} returns.data - Array of transactional profile objects
     * @returns {string} returns.message - Success message in Spanish
     */
    ptCtrl.list = async (req, res) => {

        const transactionalProfiles = await pool.query('SELECT * FROM iso_profile_transaction order by id_profile_transaction')

        return res.json( { success: true, data : transactionalProfiles, message : "Perfiles transaccionales encontrados" } )
    }

    /**
     * Get detailed information for a specific transactional profile
     *
     * Retrieves a single transactional profile by ID and decrypts its bitmap
     * to show which ISO 8583 fields are enabled. The bitmap represents a binary
     * configuration where each bit corresponds to a specific data element in the
     * ISO 8583 message format.
     *
     * PCI DSS 4.0 Compliance:
     * - Requirement 6.4.1: Provides visibility into transaction processing controls
     * - Requirement 7.2: Access control for viewing sensitive profile configurations
     * - Requirement 10.2: Profile detail access should be logged for audit purposes
     *
     * Security Note: The hex_value bitmap may control inclusion of sensitive data
     * elements in transaction messages.
     *
     * @async
     * @function detail
     * @param {Object} req - Express request object
     * @param {Object} req.params - URL parameters
     * @param {string|number} req.params.id - Profile ID to retrieve
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} JSON response with profile details and decoded bitmap
     * @returns {boolean} returns.success - Operation success status
     * @returns {Array<Object>} returns.data - Array containing the profile object
     * @returns {Object} returns.bitMap - Decoded bitmap showing enabled fields
     * @throws {404} When profile with specified ID is not found
     */
    ptCtrl.detail = async (req, res) => {

        const id = req.params.id

        const transactionalProfile = await pool.query(`SELECT * FROM iso_profile_transaction WHERE id_profile_transaction = ${id}`)

        if(transactionalProfile.length == 0){
            return res.status(404)
            .json({ message : 'No se ha encontrado el perfil.' })
        }

        const bitMap = await helpers.decript_bitmap_profile(transactionalProfile[0].hex_value)

        return res.json( { success: true, data : transactionalProfile, bitMap } )
    }

    /**
     * Create a new transactional profile
     *
     * Creates a new transactional profile with a specified name and hex bitmap value.
     * The hex_value defines which ISO 8583 fields will be included in transaction
     * messages that use this profile. This is a critical operation that affects
     * transaction processing behavior.
     *
     * PCI DSS 4.0 Compliance:
     * - Requirement 6.4.1: Transaction processing controls are configured through profile creation
     * - Requirement 7.2: Only authorized administrators should have access to create profiles
     * - Requirement 10.2: Profile creation must be logged for audit trails
     * - Requirement 12.3: New profiles must comply with usage policies
     *
     * Security Considerations:
     * - Profile creation should be restricted to authorized users only
     * - Hex bitmap values should be validated to prevent invalid configurations
     * - Creation activity should be logged with user identification
     * - Invalid profiles could expose sensitive data or break transaction processing
     *
     * @async
     * @function create
     * @param {Object} req - Express request object
     * @param {Object} req.body - Request body
     * @param {string} req.body.conca - Hex value bitmap defining enabled ISO 8583 fields
     * @param {string} req.body.name - Descriptive name for the transactional profile
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} JSON response with creation status
     * @returns {string} returns.message - Success or error message in Spanish
     * @throws {201} On successful creation
     * @throws {400} When profile creation fails
     * @throws {500} On server error during profile creation
     */
    ptCtrl.create = async (req, res) => {

        try {
            const newProfile_Transaction = {
                hex_value: req.body.conca,
                name: req.body.name
            }

            const created = await pool.query('INSERT INTO iso_profile_transaction set ?', [newProfile_Transaction]);

            if (created){
                return res.status(201).json({ message : 'Perfil transaccional creado correctamente' })
            }else{
                return res.status(400).json({ message : 'No se ha podido crear el perfil transaccional' })
            }

        } catch (error) {
            console.log('error perfil transaccional **** ', error);
            return res.status(500).json({ message : 'No se ha podido crear el perfil transaccional.. ha ocurrido un error.' })
        }

    }

    /**
     * Update an existing transactional profile
     *
     * Modifies an existing transactional profile's name and/or hex bitmap value.
     * Profile updates directly affect transaction processing for all transactions
     * using the modified profile. This is a critical operation that requires
     * careful validation and authorization.
     *
     * PCI DSS 4.0 Compliance:
     * - Requirement 6.4.1: Changes to transaction processing controls must be validated
     * - Requirement 7.2: Only authorized administrators should modify profiles
     * - Requirement 10.2: All profile modifications must be logged for audit purposes
     * - Requirement 12.3: Profile changes must maintain compliance with usage policies
     *
     * Security Considerations:
     * - Profile updates should be restricted to authorized administrators
     * - Changes affect all transactions using the profile immediately
     * - Bitmap modifications should be validated before application
     * - Update activity must be logged with user identification
     * - Invalid updates could disrupt transaction processing or expose sensitive data
     *
     * @async
     * @function update
     * @param {Object} req - Express request object
     * @param {Object} req.body - Request body
     * @param {string} req.body.conca - Updated hex value bitmap for ISO 8583 fields
     * @param {string} req.body.name - Updated descriptive name for the profile
     * @param {string|number} req.body.id - Profile ID to update
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} JSON response with update status
     * @returns {string} returns.message - Success or error message in Spanish
     * @throws {201} On successful update
     * @throws {400} When profile update fails
     * @throws {500} On server error during profile update
     */
    ptCtrl.update = async (req, res) => {
        try {
            const updated = await pool.query('UPDATE iso_profile_transaction set hex_value=? , name=? where  id_profile_transaction= ?', [req.body.conca , req.body.name , req.body.id ]);

            if (updated){
                return res.status(201).json({ message : 'Perfil transaccional actualizado correctamente' })
            }else{
                return res.status(400).json({ message : 'No se ha podido actualizar el perfil transaccional' })
            }

        } catch (error) {
            console.log('error users tdm **** ', error);
            return res.status(500).json({ message : 'No se ha podido actualizar el perfil transaccional... ha ocurrido un error.' })
        }
    }

    /**
     * Delete a transactional profile
     *
     * Permanently removes a transactional profile from the system. This is a
     * high-risk operation as it may affect transaction processing if the profile
     * is currently in use by any terminals or merchants. The system should verify
     * that the profile is not in active use before deletion.
     *
     * PCI DSS 4.0 Compliance:
     * - Requirement 6.4.1: Profile deletion affects transaction processing controls
     * - Requirement 7.2: Only authorized administrators should delete profiles
     * - Requirement 10.2: Profile deletion must be logged for audit trails with full context
     * - Requirement 12.3: Deletion must be validated against usage policies
     *
     * Security Considerations:
     * - Profile deletion should be restricted to authorized administrators only
     * - Verify profile is not in active use before deletion
     * - Consider soft delete or archival instead of hard delete
     * - Deletion activity must be logged with user identification
     * - Deleting active profiles could disrupt transaction processing
     * - Foreign key constraints should prevent deletion of profiles in use
     *
     * @async
     * @function delete
     * @param {Object} req - Express request object
     * @param {Object} req.params - URL parameters
     * @param {string|number} req.params.id - Profile ID to delete
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} JSON response with deletion status
     * @returns {string} returns.message - Success or error message in Spanish
     * @throws {201} On successful deletion
     * @throws {400} When profile deletion fails
     * @throws {500} On server error during profile deletion (may indicate foreign key constraint)
     */
    ptCtrl.delete = async (req, res) => {

        try {

            const { id }  = req.params
            const deleted = await pool.query('DELETE FROM iso_profile_transaction WHERE id_profile_transaction = ?', [id]);

            if (deleted){
                return res.status(201).json({ message : 'Perfil transaccional eliminado correctamente' })
            }else{
                return res.status(400).json({ message : 'No se ha podido eliminar el perfil transaccional' })
            }

        } catch (error) {
            return res.status(500).json({ message : 'No se ha podido eliminar el perfil transaccional... ha ocurrido un error.' })
        }
    }


module.exports = ptCtrl;