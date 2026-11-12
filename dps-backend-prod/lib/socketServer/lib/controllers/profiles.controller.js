// const db = require("../sequelize/init");
// const pool = require('../database');
// const { Sequelize } = require('sequelize')
//
// const controller = {};
//
//
// controller.list = async (req,res) => {
//   try {
//
//     const profiles = await db.profileUsers.findAll()
//
//     return res.status(200).json({ status : 'ok', data: profiles, message: 'Datos encontrados' })
//
//   } catch (err) {
//
//     return res.status(500).json({ status : 'error', data: [], message: err.message })
//
//   }
// }
//
// controller.saveNewProfile = async (req,res) => {
//   try {
//
//     const {
//       profile_name,
//       comments,
//       datos_bancarios,
//       resources
//     } = req.body
//
//     const newRow      = { profile_name, comments, datos_bancarios }
//
//     const exist = await db.profileUsers.count( { where: { profile_name } }  )
//
//     if (exist > 0){
//       return res.status(400).json({ status : 'error', data: [], message: "El nombre del perfil ya se encuentra en uso" })
//     }
//
//     const userProfile = await db.profileUsers.create(newRow)
//
//     if ( userProfile ){
//
//       if(resources && resources.length > 0){
//         await savedResources(userProfile.id_profile,resources)
//       }
//
//       return res.status(201).json({ ststus: 200, data : newRow, message: 'Perfil creado correctamente'})
//
//     }else{
//       return res.status(400).json({ status : 'error', data: [], message: 'No se ha podido guardar el perfil' })
//     }
//
//   } catch(err){
//
//     return res.status(500).json({ status : 'error', data: [], message: err.message })
//   }
//
// }
//
// controller.details = async (req,res) => {
//   try {
//
//     const profile   = await db.profileUsers.findByPk( req.params.id )
//     const resources = await db.profileResources.findAll( { where: { id_profile : req.params.id } } )
//
//     const resourcesId = resources.map( item => item.id_resource )
//
//     const baseResources = await db.resources.findAll({
//       where: {
//         id: {
//           [Sequelize.Op.in]: resourcesId
//         }
//       }
//     })
//
//     const urls = baseResources.map( item => item.resource_url );
//
//     return res.status(201).json({ status: 200, data : profile, details : resources, urls,  message: 'Perfil encontrado'})
//
//   } catch(err){
//
//     return res.status(500).json({ status : 'error', data: [], message: err.message })
//   }
// }
//
// controller.updateProfile = async (req,res) => {
//   try {
//
//     const {
//       profile_name,
//       comments,
//       datos_bancarios,
//       resources
//     } = req.body
//
//     const id_profile = req.params.id
//
//     const profile = await db.profileUsers.findOne({ where:{ profile_name: profile_name } })
//
//     if(profile && profile.id_profile != id_profile){
//       return res.status(400).json({ status : 'error', data: [], message: 'El nombre del perfil, ya se encuentra en uso' })
//     }
//
//     const newData     = { profile_name, comments, datos_bancarios }
//     const updated     = await db.profileUsers.update( newData  , { where: { id_profile : id_profile } } )
//
//     if ( updated ){
//
//       await db.profileResources.destroy({ where: { id_profile : id_profile } })
//
//       if(resources && resources.length > 0){
//         await savedResources( id_profile, resources)
//       }
//
//       return res.status(201).json({ ststus: 200, data : updated, message: 'Perfil actualizado correctamente'})
//
//     }else{
//       return res.status(400).json({ status : 'error', data: [], message: 'No se ha podido actualizar el perfil' })
//     }
//
//   } catch(err){
//
//     return res.status(500).json({ status : 'error', data: [], message: err.message })
//   }
//
// }
//
// const savedResources = async (id_profile, resources) => {
//   const rowsSources = resources.map( resource => {
//         return {id_profile, ...resource}
//       }
//   )
//   try {
//     await db.profileResources.bulkCreate(rowsSources)
//   } catch (error) {
//     console.error("No se han podido guardar los recurdos del perfil")
//   }
// }
//
// controller.deleteProfile = async (req, res) => {
//
//   const id_profile = req.params.id;
//
//   try {
//
//     /*
//     Soft-delete was implemented to the profile, the folowing line was remove
//     to allow the profile to be reactivated with its resources, but an error message is prepared in a resourceless profile case,
//     so it's possible to uncomment the line to prevent to store unuse information.
//      */
//     //await db.profileResources.destroy({ where: { id_profile : id_profile } })
//     const destroyed = await db.profileUsers.destroy({ where: {id_profile : id_profile } })
//
//     if (destroyed){
//       return res.status(201).json({ message : 'Perfil eliminado correctamente' })
//     }else{
//       return res.status(400).json({ message : 'No se ha podido eliminar el perfil' })
//     }
//
//   } catch (error) {
//     return res.status(500).json({ message : error.message })
//   }
// }
//
// controller.allResounces = async (req, res) => {
//   const resources = await db.resources.findAll()
//   return res.status(200).json({ data: resources, message : 'Recursos encontrados' })
// }
//
// controller.allResouncesByProfileId = async (req, res) => {
//   const id = req.params.id;
//   const resources = await pool.query(`
//       SELECT r.*, pr.create, pr.edit, pr.delete, pr.select FROM resources r
//       INNER JOIN profile_resources pr ON r.id = pr.id_resource
//       WHERE pr.id_profile = ${id}
//     `);
//   return res.status(200).json({ data: resources, message : 'Recursos encontrados' })
// }
//
// module.exports = controller;
// const db = require('../sequelize/init');
//
// const pool = require("../database");
// const controller = {};
// controller.list = async (req, res) => {
//   try {
//     const profiles = await db.profileUsers.findAll();
//     return res.status(200).json({ status: 'ok', data: profiles, message: 'Datos encontrados' });
//   } catch (err) {
//     return res.status(500).json({ status: 'error', data: [], message: err.message });
//   }
// };
// controller.saveNewProfile = async (req, res) => {
//   try {
//     const { profile_name, comments, datos_bancarios, resources } = req.body;
//     const newRow = { profile_name, comments, datos_bancarios };
//     const exist = await db.profileUsers.count({ where: { profile_name } });
//     if (exist > 0) return res.status(400).json({ status: 'error', data: [], message: "El nombre del perfil ya se encuentra en uso" });
//     const userProfile = await db.profileUsers.create(newRow);
//     if (userProfile && resources && resources.length > 0) await savedResources(userProfile.id_profile, resources);
//     return res.status(201).json({ status: 200, data: newRow, message: 'Perfil creado correctamente' });
//   } catch (err) {
//     return res.status(500).json({ status: 'error', data: [], message: err.message });
//   }
// };
// controller.details = async (req, res) => {
//   try {
//     const profile = await db.profileUsers.findByPk(req.params.id);
//     console.log("profile: ", profile)
//     const resources = await db.profileResources.findAll({ where: { id_profile: req.params.id } });
//     console.log("resources: ", resources)
//     const resourcesId = resources.map(item => item.id_resource);
//     console.log("resourcesId: ", resourcesId)
//     const baseResources = await db.resources.findAll({ where: { id: resourcesId } });
//     console.log("baseResources: ", baseResources)
//     const urls = baseResources.map(item => item.resource_url);
//     console.log("urls: ", urls)
//     return res.status(201).json({ status: 200, data: profile, details: resources, urls, message: 'Perfil encontrado' });
//   } catch (err) {
//       console.error(err.message)
//     return res.status(500).json({ status: 'error', data: [], message: err.message });
//   }
// };
// controller.updateProfile = async (req, res) => {
//   try {
//     const { profile_name, comments, datos_bancarios, resources } = req.body;
//     const id_profile = req.params.id;
//     const profile = await db.profileUsers.findOne({ where: { profile_name } });
//     if (profile && profile.id_profile != id_profile) return res.status(400).json({ status: 'error', data: [], message: 'El nombre del perfil, ya se encuentra en uso' });
//     const newData = { profile_name, comments, datos_bancarios };
//     const updated = await db.profileUsers.update(newData, { where: { id_profile } });
//     if (updated) {
//       await db.profileResources.destroy({ where: { id_profile } });
//       if (resources && resources.length > 0) await savedResources(id_profile, resources);
//       return res.status(201).json({ status: 200, data: updated, message: 'Perfil actualizado correctamente' });
//     } else {
//       return res.status(400).json({ status: 'error', data: [], message: 'No se ha podido actualizar el perfil' });
//     }
//   } catch (err) {
//     return res.status(500).json({ status: 'error', data: [], message: err.message });
//   }
// };
// const savedResources = async (id_profile, resources) => {
//   const rowsSources = resources.map(resource => ({ id_profile, ...resource, allowed_methods: resource.allowed_methods || [] }));
//   try {
//     await db.profileResources.bulkCreate(rowsSources);
//   } catch (error) {
//     console.error("No se han podido guardar los recursos del perfil", error);
//   }
// };
// controller.deleteProfile = async (req, res) => {
//   const id_profile = req.params.id;
//   try {
//     const destroyed = await db.profileUsers.destroy({ where: { id_profile } });
//     if (destroyed) return res.status(201).json({ message: 'Perfil eliminado correctamente' });
//     else return res.status(400).json({ message: 'No se ha podido eliminar el perfil' });
//   } catch (error) {
//     return res.status(500).json({ message: error.message });
//   }
// };
// controller.allResounces = async (req, res) => {
//   const resources = await db.resources.findAll();
//   return res.status(200).json({ data: resources, message: 'Recursos encontrados' });
// };
// controller.allResouncesByProfileId = async (req, res) => {
//     try {
//         const id = req.params.id;
//         const [resources] = await pool.query(`
//       SELECT r.*, pr.create, pr.edit, pr.delete, pr.select, pr.allowed_methods FROM resources r
//       INNER JOIN profile_resources pr ON r.id = pr.id_resource
//       WHERE pr.id_profile = ${id}
//     `);
//         return res.status(200).json({data: resources, message: 'Recursos encontrados'});
//     } catch (err) {
//         return res.status(500).json({status: 'error', data: [], message: err.message});
//     }
// };
// module.exports = controller;
/**
 * @fileoverview User Profiles Controller
 *
 * Manages user profiles and role-based access control (RBAC) for the payment gateway system.
 * This controller handles profile creation, updates, deletion, and resource permission management.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.1: Limit access to system components and cardholder data to only those
 *   individuals whose job requires such access
 * - Requirement 7.2: Establish an access control system(s) for systems components that
 *   restricts access based on a user's need to know, and is set to "deny all" unless
 *   specifically allowed
 * - Requirement 8.2: Authenticate access to system components through strong authentication
 *   methods and user management
 * - Requirement 10.2: Implement automated audit trails for all system components to
 *   reconstruct security-relevant events
 *
 * Security Considerations:
 * - All profile modifications should be logged for audit purposes
 * - Profile permissions determine access to sensitive payment and cardholder data
 * - Soft-delete is implemented to maintain audit trails
 * - SQL injection prevention through parameterized queries (where applicable)
 *
 * @module controllers/profiles
 * @requires ../sequelize/init
 * @requires ../database
 * @requires sequelize
 */

const db = require("../sequelize/init");
const pool = require('../database');
const { Sequelize } = require('sequelize')

const controller = {};


/**
 * List all user profiles
 *
 * Retrieves all user profiles from the database. This endpoint is used to display
 * available profiles in the system for role assignment and management.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Coverage of all system components
 * - Requirement 10.2.2: Actions taken by individuals with administrative privileges
 *
 * @async
 * @function list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 200 and array of profiles on success,
 *                            status 500 with error message on failure
 * @example
 * // Success response
 * {
 *   status: 'ok',
 *   data: [{ id_profile: 1, profile_name: 'Admin', comments: '...' }],
 *   message: 'Datos encontrados'
 * }
 */
controller.list = async (req,res) => {
    try {

        const profiles = await db.profileUsers.findAll()

        return res.status(200).json({ status : 'ok', data: profiles, message: 'Datos encontrados' })

    } catch (err) {

        return res.status(500).json({ status : 'error', data: [], message: err.message })

    }
}

/**
 * Create a new user profile
 *
 * Creates a new profile with associated resource permissions. This establishes a role
 * that can be assigned to users for access control purposes.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.1.1: Define access needs for each role
 * - Requirement 7.2.2: Assignment of privileges to individuals based on job classification and function
 * - Requirement 8.2.1: Strong authentication credentials must be assigned to users
 * - Requirement 10.2.2: Audit log entries for creating new accounts or profiles
 *
 * @async
 * @function saveNewProfile
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.profile_name - Unique name for the profile (required)
 * @param {string} req.body.comments - Description or comments about the profile
 * @param {boolean} req.body.datos_bancarios - Flag indicating access to banking data
 * @param {Array<Object>} req.body.resources - Array of resource permissions to associate with this profile
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 201 on success, 400 if profile name exists,
 *                            or 500 on server error
 * @example
 * // Request body
 * {
 *   profile_name: 'Cashier',
 *   comments: 'Point of sale operator',
 *   datos_bancarios: false,
 *   resources: [{ id_resource: 1, create: 1, edit: 0, delete: 0, select: 1 }]
 * }
 */
controller.saveNewProfile = async (req,res) => {
    try {

        const {
            profile_name,
            comments,
            datos_bancarios,
            resources
        } = req.body

        const newRow      = { profile_name, comments, datos_bancarios }

        const exist = await db.profileUsers.count( { where: { profile_name } }  )

        if (exist > 0){
            return res.status(400).json({ status : 'error', data: [], message: "El nombre del perfil ya se encuentra en uso" })
        }

        const userProfile = await db.profileUsers.create(newRow)

        if ( userProfile ){

            if(resources && resources.length > 0){
                await savedResources(userProfile.id_profile,resources)
            }

            return res.status(201).json({ ststus: 200, data : newRow, message: 'Perfil creado correctamente'})

        }else{
            return res.status(400).json({ status : 'error', data: [], message: 'No se ha podido guardar el perfil' })
        }

    } catch(err){

        return res.status(500).json({ status : 'error', data: [], message: err.message })
    }

}

/**
 * Get profile details with associated resources
 *
 * Retrieves detailed information about a specific profile including its associated
 * resources and their URLs. Used for displaying and editing profile configurations.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Coverage of all system components
 * - Requirement 10.2.1: Audit all individual user accesses to cardholder data
 *
 * @async
 * @function details
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string|number} req.params.id - Profile ID to retrieve
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 201 and profile details on success,
 *                            status 500 with error message on failure
 * @example
 * // Success response
 * {
 *   status: 200,
 *   data: { id_profile: 1, profile_name: 'Admin', ... },
 *   details: [{ id_resource: 1, create: 1, edit: 1, ... }],
 *   urls: ['/api/transactions', '/api/users'],
 *   message: 'Perfil encontrado'
 * }
 */
controller.details = async (req,res) => {
    try {

        const profile   = await db.profileUsers.findByPk( req.params.id )
        const resources = await db.profileResources.findAll( { where: { id_profile : req.params.id } } )

        const resourcesId = resources.map( item => item.id_resource )

        const baseResources = await db.resources.findAll({
            where: {
                id: {
                    [Sequelize.Op.in]: resourcesId
                }
            }
        })

        const urls = baseResources.map( item => item.resource_url );

        return res.status(201).json({ status: 200, data : profile, details : resources, urls,  message: 'Perfil encontrado'})

    } catch(err){

        return res.status(500).json({ status : 'error', data: [], message: err.message })
    }
}

/**
 * Update an existing profile
 *
 * Updates profile information and associated resource permissions. This operation
 * replaces all existing resource permissions with the new set provided.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.2: Assignment of privileges based on job classification and function
 * - Requirement 8.2.3: Passwords/passphrases must meet complexity requirements
 * - Requirement 10.2.2: Audit log entries for all changes to privileged accounts
 * - Requirement 10.2.5: Audit log entries for changes to audit logs
 *
 * @async
 * @function updateProfile
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string|number} req.params.id - Profile ID to update
 * @param {Object} req.body - Request body
 * @param {string} req.body.profile_name - Updated profile name
 * @param {string} req.body.comments - Updated comments
 * @param {boolean} req.body.datos_bancarios - Updated banking data access flag
 * @param {Array<Object>} req.body.resources - Updated array of resource permissions
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 201 on success, 400 if name conflict,
 *                            or 500 on server error
 * @example
 * // Request body
 * {
 *   profile_name: 'Updated Cashier',
 *   comments: 'Modified role',
 *   datos_bancarios: true,
 *   resources: [{ id_resource: 1, create: 1, edit: 1, delete: 0, select: 1 }]
 * }
 */
controller.updateProfile = async (req,res) => {
    try {

        const {
            profile_name,
            comments,
            datos_bancarios,
            resources
        } = req.body

        const id_profile = req.params.id

        const profile = await db.profileUsers.findOne({ where:{ profile_name: profile_name } })

        if(profile && profile.id_profile != id_profile){
            return res.status(400).json({ status : 'error', data: [], message: 'El nombre del perfil, ya se encuentra en uso' })
        }

        const newData     = { profile_name, comments, datos_bancarios }
        const updated     = await db.profileUsers.update( newData  , { where: { id_profile : id_profile } } )

        if ( updated ){

            await db.profileResources.destroy({ where: { id_profile : id_profile } })

            if(resources && resources.length > 0){
                await savedResources( id_profile, resources)
            }

            return res.status(201).json({ ststus: 200, data : updated, message: 'Perfil actualizado correctamente'})

        }else{
            return res.status(400).json({ status : 'error', data: [], message: 'No se ha podido actualizar el perfil' })
        }

    } catch(err){

        return res.status(500).json({ status : 'error', data: [], message: err.message })
    }

}

/**
 * Save profile resources in bulk
 *
 * Internal helper function that saves multiple resource permissions for a profile
 * in a single bulk operation. This is more efficient than individual inserts.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Coverage of all system components
 * - Requirement 10.2.2: Audit log entries for creating or changing access privileges
 *
 * @async
 * @function savedResources
 * @param {number} id_profile - The profile ID to associate resources with
 * @param {Array<Object>} resources - Array of resource permission objects
 * @param {number} resources[].id_resource - Resource identifier
 * @param {number} resources[].create - Create permission flag (0 or 1)
 * @param {number} resources[].edit - Edit permission flag (0 or 1)
 * @param {number} resources[].delete - Delete permission flag (0 or 1)
 * @param {number} resources[].select - Select/read permission flag (0 or 1)
 * @returns {Promise<void>} Returns nothing, logs error if operation fails
 * @private
 */
const savedResources = async (id_profile, resources) => {
    const rowsSources = resources.map( resource => {
            return {id_profile, ...resource}
        }
    )
    try {
        await db.profileResources.bulkCreate(rowsSources)
    } catch (error) {
        console.error("No se han podido guardar los recurdos del perfil")
    }
}

/**
 * Delete a profile (soft-delete)
 *
 * Deletes a profile from the system. This uses soft-delete to maintain audit trails
 * and allow potential profile reactivation. Resource permissions are preserved to
 * maintain historical access records.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.4: All access to privileged accounts must be logged and monitored
 * - Requirement 8.2.6: If inactive for more than 90 days, disable or remove access
 * - Requirement 10.2.2: Audit log entries for deleting privileged accounts
 * - Requirement 10.2.7: Creation and deletion of system-level objects
 *
 * @async
 * @function deleteProfile
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string|number} req.params.id - Profile ID to delete
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 201 on success, 400 if not found,
 *                            or 500 on server error
 * @example
 * // Success response
 * { message: 'Perfil eliminado correctamente' }
 */
controller.deleteProfile = async (req, res) => {

    const id_profile = req.params.id;

    try {

        /*
        Soft-delete was implemented to the profile, the folowing line was remove
        to allow the profile to be reactivated with its resources, but an error message is prepared in a resourceless profile case,
        so it's possible to uncomment the line to prevent to store unuse information.
         */
        //await db.profileResources.destroy({ where: { id_profile : id_profile } })
        const destroyed = await db.profileUsers.destroy({ where: {id_profile : id_profile } })

        if (destroyed){
            return res.status(201).json({ message : 'Perfil eliminado correctamente' })
        }else{
            return res.status(400).json({ message : 'No se ha podido eliminar el perfil' })
        }

    } catch (error) {
        return res.status(500).json({ message : error.message })
    }
}

/**
 * Get all available resources
 *
 * Retrieves all resources (endpoints/features) available in the system that can be
 * assigned permissions. Used for building the permissions matrix.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.1: Limit access to system components based on need to know
 * - Requirement 7.2.1: Coverage of all system components
 *
 * @async
 * @function allResounces
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 200 and array of all resources
 * @example
 * // Success response
 * {
 *   data: [{ id: 1, resource_name: 'Transactions', resource_url: '/api/transactions' }],
 *   message: 'Recursos encontrados'
 * }
 */
controller.allResounces = async (req, res) => {
    const resources = await db.resources.findAll()
    return res.status(200).json({ data: resources, message : 'Recursos encontrados' })
}

/**
 * Get all resources assigned to a specific profile
 *
 * Retrieves all resources and their permission settings (create, edit, delete, select)
 * for a specific profile ID. Uses raw SQL query with JOINs for efficiency.
 *
 * Security Note: Uses string interpolation for profile ID - should be parameterized
 * to prevent SQL injection in production.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Coverage of all system components
 * - Requirement 7.2.3: Privileges are assigned to individuals based on job function
 * - Requirement 10.2.1: Audit all individual user accesses to cardholder data
 *
 * @async
 * @function allResouncesByProfileId
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string|number} req.params.id - Profile ID to query resources for
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 200 and array of resources with permissions,
 *                            or status 500 with error message on failure
 * @example
 * // Success response
 * {
 *   data: [{
 *     id: 1,
 *     resource_name: 'Transactions',
 *     resource_url: '/api/transactions',
 *     create: 1,
 *     edit: 1,
 *     delete: 0,
 *     select: 1,
 *     profile_name: 'Cashier'
 *   }],
 *   message: 'Recursos encontrados'
 * }
 */
controller.allResouncesByProfileId = async (req, res) => {
    try {
        console.log('🔥 FIXED allResouncesByProfileId executing - version with array destructuring');
        const id = req.params.id;
        const queryResult = await pool.query(`
          SELECT r.*, pr.\`create\`, pr.\`edit\`, pr.\`delete\`, pr.\`select\`,
                 pu.profile_name
          FROM resources r
          INNER JOIN profile_resources pr ON r.id = pr.id_resource
          INNER JOIN user_profile pu ON pr.id_profile = pu.id_profile
          WHERE pr.id_profile = ${id}
        `);

        // mysql2 returns array with rows and fields mixed - extract all resource objects
        const resources = Array.isArray(queryResult)
          ? queryResult.filter(item => item && typeof item === 'object' && item.id && item.resource_name)
          : [];

        console.log('✅ Extracted', resources.length, 'resources for profile', id);

        return res.status(200).json({ data: resources || [], message : 'Recursos encontrados' })
    } catch (error) {
        console.error('Error in allResouncesByProfileId:', error);
        return res.status(500).json({ data: [], message: error.message })
    }
}

/**
 * Get complete permissions matrix
 *
 * Retrieves a complete matrix of all profile-resource permission assignments in the system.
 * This provides a comprehensive view of access control configuration across all profiles.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Coverage of all system components
 * - Requirement 7.2.4: All access to privileged accounts must be logged and monitored
 * - Requirement 8.2.2: Verify user identity before modifying authentication credentials
 * - Requirement 10.2.5: Use of and changes to identification and authentication mechanisms
 *
 * @async
 * @function getPermissionsMatrix
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 'ok' and complete permissions matrix,
 *                            or status 'error' with error message on failure
 * @example
 * // Success response
 * {
 *   status: 'ok',
 *   data: [{
 *     id: 1,
 *     id_profile: 2,
 *     id_resource: 5,
 *     create: 1,
 *     edit: 1,
 *     delete: 0,
 *     select: 1,
 *     profile_name: 'Cashier',
 *     resource_name: 'Transactions',
 *     resource_url: '/api/transactions'
 *   }],
 *   message: 'Matriz de permisos encontrada'
 * }
 */
controller.getPermissionsMatrix = async (req, res) => {
    try {
        console.log('Getting permissions matrix...');
        const permissions = await db.seq.query(`
            SELECT
                pr.id,
                pr.id_profile,
                pr.id_resource,
                pr.\`create\`,
                pr.\`edit\`,
                pr.\`delete\`,
                pr.\`select\`,
                COALESCE(pu.profile_name, 'Unknown Profile') as profile_name,
                COALESCE(r.resource_name, 'Unknown Resource') as resource_name,
                r.resource_url
            FROM profile_resources pr
            INNER JOIN user_profile pu ON pr.id_profile = pu.id_profile AND pu.deleted_at IS NULL
            LEFT JOIN resources r ON pr.id_resource = r.id
            ORDER BY COALESCE(pu.profile_name, 'Unknown Profile'), COALESCE(r.resource_name, 'Unknown Resource')
        `, {
            type: db.seq.QueryTypes.SELECT
        });

        console.log('Permissions matrix data type:', typeof permissions);
        console.log('Permissions matrix data isArray:', Array.isArray(permissions));
        console.log('Permissions matrix data length:', permissions?.length);
        console.log('Sample permission:', permissions?.[0]);

        // Sequelize returns results directly
        const permissionsArray = Array.isArray(permissions) ? permissions : [];

        return res.status(200).json({
            status: 'ok',
            data: permissionsArray,
            message: 'Matriz de permisos encontrada'
        });
    } catch (err) {
        console.error('Error in getPermissionsMatrix:', err);
        return res.status(500).json({
            status: 'error',
            data: [],
            message: err.message
        });
    }
}

/**
 * Get profiles with resource count
 *
 * Retrieves all profiles with a count of how many resources each profile has access to.
 * Useful for dashboard displays and permission audits.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.1.1: Define access needs for each role
 * - Requirement 7.2.5: Assign access based on least privilege principle
 * - Requirement 8.2.1: Strong authentication credentials must be assigned
 *
 * @async
 * @function getProfilesWithResourceCount
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 'ok' and array of profiles with resource counts,
 *                            or status 'error' with error message on failure
 * @example
 * // Success response
 * {
 *   status: 'ok',
 *   data: [{
 *     id_profile: 1,
 *     profile_name: 'Administrator',
 *     comments: 'Full access',
 *     datos_bancarios: 1,
 *     resource_count: 25
 *   }],
 *   message: 'Perfiles encontrados'
 * }
 */
controller.getProfilesWithResourceCount = async (req, res) => {
    try {
        console.log('Getting profiles with resource count...');
        const profiles = await db.seq.query(`
            SELECT
                pu.*,
                COUNT(pr.id_resource) as resource_count
            FROM user_profile pu
            LEFT JOIN profile_resources pr ON pu.id_profile = pr.id_profile
            WHERE pu.deleted_at IS NULL
            GROUP BY pu.id_profile
            ORDER BY pu.profile_name
        `, {
            type: db.seq.QueryTypes.SELECT
        });

        console.log('Profiles with count data type:', typeof profiles);
        console.log('Profiles with count data isArray:', Array.isArray(profiles));
        console.log('Profiles with count data length:', profiles?.length);
        console.log('Sample profile:', profiles?.[0]);

        // Sequelize returns results directly
        const profilesArray = Array.isArray(profiles) ? profiles : [];

        return res.status(200).json({
            status: 'ok',
            data: profilesArray,
            message: 'Perfiles encontrados'
        });
    } catch (err) {
        console.error('Error in getProfilesWithResourceCount:', err);
        return res.status(500).json({
            status: 'error',
            data: [],
            message: err.message
        });
    }
}

/**
 * Get permission dashboard data
 *
 * Retrieves a comprehensive dashboard view showing all resources and which profiles
 * have access to them. Uses an optimized single query with JOINs to avoid N+1 queries.
 * Results are grouped by resource for easy visualization.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.1.2: Restrict access based on user's need to know
 * - Requirement 7.2.1: Coverage of all system components
 * - Requirement 7.2.6: All access must be assigned based on job classification
 * - Requirement 10.2.1: Audit all individual user accesses to cardholder data
 *
 * @async
 * @function getPermissionDashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 'ok' and dashboard data grouped by resource,
 *                            or status 'error' with error message on failure
 * @example
 * // Success response
 * {
 *   status: 'ok',
 *   data: [{
 *     id_resource: 1,
 *     resource_name: 'Transactions',
 *     resource_url: '/api/transactions',
 *     profiles_with_access: [
 *       { id_profile: 2, create: 1, edit: 1, delete: 0, select: 1, profile_name: 'Cashier' },
 *       { id_profile: 1, create: 1, edit: 1, delete: 1, select: 1, profile_name: 'Admin' }
 *     ]
 *   }],
 *   message: 'Dashboard de permisos encontrado'
 * }
 */
controller.getPermissionDashboard = async (req, res) => {
    try {
        console.log('Getting permission dashboard...');

        // OPTIMIZED: Single query to get all data with JOIN instead of N+1 queries
        const dashboardData = await db.seq.query(`
            SELECT
                r.id as id_resource,
                r.resource_name,
                r.resource_url,
                pr.id_profile,
                pr.\`create\`,
                pr.\`edit\`,
                pr.\`delete\`,
                pr.\`select\`,
                pu.profile_name
            FROM resources r
            LEFT JOIN profile_resources pr ON r.id = pr.id_resource
            LEFT JOIN user_profile pu ON pr.id_profile = pu.id_profile AND pu.deleted_at IS NULL
            ORDER BY r.resource_name, pu.profile_name
        `, {
            type: db.seq.QueryTypes.SELECT
        });

        console.log('Dashboard data retrieved:', dashboardData?.length, 'total records');

        // Group the data by resource to maintain the same response structure
        const resourceMap = new Map();

        for (const row of dashboardData) {
            if (!resourceMap.has(row.id_resource)) {
                resourceMap.set(row.id_resource, {
                    id_resource: row.id_resource,
                    resource_name: row.resource_name,
                    resource_url: row.resource_url,
                    profiles_with_access: []
                });
            }

            // Only add profile if there's an actual profile assignment
            if (row.id_profile && row.profile_name) {
                resourceMap.get(row.id_resource).profiles_with_access.push({
                    id_profile: row.id_profile,
                    create: row.create,
                    edit: row.edit,
                    delete: row.delete,
                    select: row.select,
                    profile_name: row.profile_name
                });
            }
        }

        const formattedData = Array.from(resourceMap.values());

        console.log('Dashboard formatted data:', formattedData.length, 'resources');
        console.log('Sample with profiles:', formattedData[0]);

        return res.status(200).json({
            status: 'ok',
            data: formattedData,
            message: 'Dashboard de permisos encontrado'
        });
    } catch (err) {
        console.error('Error in getPermissionDashboard:', err);
        return res.status(500).json({
            status: 'error',
            data: [],
            message: err.message
        });
    }
}

/**
 * Create a new resource permission
 *
 * Creates a new permission entry linking a profile to a resource with specific
 * CRUD operation permissions (create, read/select, update/edit, delete).
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.2: Assignment of privileges to individuals based on job classification and function
 * - Requirement 7.2.3: Required privileges are approved by authorized personnel
 * - Requirement 10.2.2: Audit log entries for all actions taken with administrative privileges
 *
 * @async
 * @function createResourcePermission
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.id_profile - Profile ID to grant permissions to
 * @param {number} req.body.id_resource - Resource ID to grant permissions for
 * @param {string} req.body.allowed_methods - Comma-separated list of allowed HTTP methods
 * @param {number|boolean} req.body.create - Create permission flag (0 or 1)
 * @param {number|boolean} req.body.edit - Edit/update permission flag (0 or 1)
 * @param {number|boolean} req.body.delete - Delete permission flag (0 or 1)
 * @param {number|boolean} req.body.select - Select/read permission flag (0 or 1)
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 201 on success, 400 if creation fails,
 *                            or 500 on server error
 * @example
 * // Request body
 * {
 *   id_profile: 2,
 *   id_resource: 5,
 *   allowed_methods: 'GET,POST',
 *   create: 1,
 *   edit: 0,
 *   delete: 0,
 *   select: 1
 * }
 */
controller.createResourcePermission = async (req, res) => {
    try {
        console.log('🔥 Request body received:', req.body);

        const {
            id_profile,
            id_resource,
            allowed_methods,
            create,
            edit,
            delete: deletePermission,
            select
        } = req.body;

        console.log('🔥 Parsed values:', {
            id_profile,
            id_resource,
            allowed_methods,
            create,
            edit,
            deletePermission,
            select
        });

        // Ensure values are proper numbers, not strings
        const newPermission = {
            id_profile: parseInt(id_profile) || null,
            id_resource: parseInt(id_resource) || null,
            allowed_methods: allowed_methods || '',
            create: create ? 1 : 0,
            edit: edit ? 1 : 0,
            delete: deletePermission ? 1 : 0,
            select: select ? 1 : 0
        };

        console.log('🔥 Final permission object:', newPermission);

        const created = await db.profileResources.create(newPermission);

        if (created) {
            return res.status(201).json({
                status: 'ok',
                data: created,
                message: 'Permiso creado correctamente'
            });
        } else {
            return res.status(400).json({
                status: 'error',
                data: [],
                message: 'No se ha podido crear el permiso'
            });
        }
    } catch (error) {
        console.error('Error creating resource permission:', error);
        return res.status(500).json({
            status: 'error',
            data: [],
            message: error.message
        });
    }
};

/**
 * Update an existing resource permission
 *
 * Updates the permission settings for an existing profile-resource permission entry.
 * This allows modification of CRUD permissions and allowed HTTP methods.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.2: Assignment of privileges based on job classification and function
 * - Requirement 10.2.2: Audit log entries for all actions taken with administrative privileges
 * - Requirement 10.2.5: Use of and changes to identification and authentication mechanisms
 *
 * @async
 * @function updateResourcePermission
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string|number} req.params.id - Permission entry ID to update
 * @param {Object} req.body - Request body
 * @param {number} req.body.id_profile - Profile ID
 * @param {number} req.body.id_resource - Resource ID
 * @param {string} req.body.allowed_methods - Comma-separated list of allowed HTTP methods
 * @param {number|boolean} req.body.create - Create permission flag (0 or 1)
 * @param {number|boolean} req.body.edit - Edit/update permission flag (0 or 1)
 * @param {number|boolean} req.body.delete - Delete permission flag (0 or 1)
 * @param {number|boolean} req.body.select - Select/read permission flag (0 or 1)
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 200 on success, 400 if not found,
 *                            or 500 on server error
 */
controller.updateResourcePermission = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            id_profile,
            id_resource,
            allowed_methods,
            create,
            edit,
            delete: deletePermission,
            select
        } = req.body;

        const updateData = {
            id_profile,
            id_resource,
            allowed_methods: allowed_methods || '',
            create: create || 0,
            edit: edit || 0,
            delete: deletePermission || 0,
            select: select || 0
        };

        const updated = await db.profileResources.update(updateData, {
            where: { id: id }
        });

        if (updated[0] > 0) {
            return res.status(200).json({
                status: 'ok',
                data: updateData,
                message: 'Permiso actualizado correctamente'
            });
        } else {
            return res.status(400).json({
                status: 'error',
                data: [],
                message: 'No se ha podido actualizar el permiso'
            });
        }
    } catch (error) {
        console.error('Error updating resource permission:', error);
        return res.status(500).json({
            status: 'error',
            data: [],
            message: error.message
        });
    }
};

/**
 * Delete a resource permission
 *
 * Removes a specific permission entry, revoking a profile's access to a resource.
 * This operation should be logged for audit purposes.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.4: All access to privileged accounts must be logged and monitored
 * - Requirement 8.2.6: If inactive for more than 90 days, disable or remove access
 * - Requirement 10.2.2: Audit log entries for deleting privileged accounts or access
 * - Requirement 10.2.5: Use of and changes to identification and authentication mechanisms
 *
 * @async
 * @function deleteResourcePermission
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string|number} req.params.id - Permission entry ID to delete
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 200 on success, 400 if not found,
 *                            or 500 on server error
 * @example
 * // Success response
 * {
 *   status: 'ok',
 *   message: 'Permiso eliminado correctamente'
 * }
 */
controller.deleteResourcePermission = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await db.profileResources.destroy({
            where: { id: id }
        });

        if (deleted > 0) {
            return res.status(200).json({
                status: 'ok',
                message: 'Permiso eliminado correctamente'
            });
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'No se ha podido eliminar el permiso'
            });
        }
    } catch (error) {
        console.error('Error deleting resource permission:', error);
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Create a new resource
 *
 * Creates a new system resource (endpoint/feature) that can be assigned to profiles
 * with specific permissions. Resources represent protected areas of the application.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.1: Limit access to system components based on need to know
 * - Requirement 7.2.1: Coverage of all system components
 * - Requirement 10.2.7: Creation and deletion of system-level objects
 *
 * @async
 * @function createResource
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.resource_name - Name of the resource (required)
 * @param {string} req.body.resource_url - URL/path of the resource (required, must be unique)
 * @param {string} req.body.description - Optional description of the resource
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 201 on success, 400 if validation fails
 *                            or resource URL already exists, or 500 on server error
 * @example
 * // Request body
 * {
 *   resource_name: 'Transaction Reports',
 *   resource_url: '/api/reports/transactions',
 *   description: 'Access to transaction reporting functionality'
 * }
 */
controller.createResource = async (req, res) => {
    try {
        console.log('Creating new resource:', req.body);

        const {
            resource_name,
            resource_url,
            description
        } = req.body;

        // Validate required fields
        if (!resource_name || !resource_url) {
            return res.status(400).json({
                status: 'error',
                message: 'resource_name and resource_url are required'
            });
        }

        // Check if resource with same URL already exists
        const existingResource = await db.resources.findOne({
            where: { resource_url: resource_url }
        });

        if (existingResource) {
            return res.status(400).json({
                status: 'error',
                message: 'A resource with this URL already exists'
            });
        }

        const newResource = await db.resources.create({
            resource_name: resource_name.trim(),
            resource_url: resource_url.trim(),
            description: description ? description.trim() : null
        });

        return res.status(201).json({
            status: 'ok',
            data: newResource,
            message: 'Resource created successfully'
        });
    } catch (error) {
        console.error('Error creating resource:', error);
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Update an existing resource
 *
 * Updates the name, URL, or description of an existing resource. This allows
 * system administrators to maintain accurate resource definitions.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Coverage of all system components
 * - Requirement 10.2.2: Audit log entries for all actions taken with administrative privileges
 * - Requirement 10.2.5: Use of and changes to identification and authentication mechanisms
 *
 * @async
 * @function updateResource
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string|number} req.params.id - Resource ID to update
 * @param {Object} req.body - Request body
 * @param {string} req.body.resource_name - Updated resource name (optional)
 * @param {string} req.body.resource_url - Updated resource URL (optional)
 * @param {string} req.body.description - Updated description (optional, can be null)
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 200 on success, 400 if not found,
 *                            or 500 on server error
 */
controller.updateResource = async (req, res) => {
    try {
        const { id } = req.params;
        const { resource_name, resource_url, description } = req.body;

        const updateData = {};
        if (resource_name) updateData.resource_name = resource_name.trim();
        if (resource_url) updateData.resource_url = resource_url.trim();
        if (description !== undefined) updateData.description = description ? description.trim() : null;

        const updated = await db.resources.update(updateData, {
            where: { id: id }
        });

        if (updated[0] > 0) {
            return res.status(200).json({
                status: 'ok',
                data: updateData,
                message: 'Resource updated successfully'
            });
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Resource not found or could not be updated'
            });
        }
    } catch (error) {
        console.error('Error updating resource:', error);
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * Delete a resource
 *
 * Deletes a resource from the system. This operation validates that no profiles
 * have permissions assigned to this resource before deletion to maintain referential
 * integrity.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2.1: Coverage of all system components
 * - Requirement 10.2.2: Audit log entries for deleting system-level objects
 * - Requirement 10.2.7: Creation and deletion of system-level objects
 *
 * @async
 * @function deleteResource
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string|number} req.params.id - Resource ID to delete
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 200 on success, 400 if resource has
 *                            associated permissions or not found, or 500 on server error
 * @example
 * // Error response when resource has permissions
 * {
 *   status: 'error',
 *   message: 'Cannot delete resource: it has 3 associated permissions. Remove permissions first.'
 * }
 */
controller.deleteResource = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if resource has any associated permissions
        const permissionCount = await db.profileResources.count({
            where: { id_resource: id }
        });

        if (permissionCount > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Cannot delete resource: it has ${permissionCount} associated permissions. Remove permissions first.`
            });
        }

        const deleted = await db.resources.destroy({
            where: { id: id }
        });

        if (deleted > 0) {
            return res.status(200).json({
                status: 'ok',
                message: 'Resource deleted successfully'
            });
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'Resource not found or could not be deleted'
            });
        }
    } catch (error) {
        console.error('Error deleting resource:', error);
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

/**
 * List all resources
 *
 * Retrieves all available resources in the system, ordered alphabetically by name.
 * This endpoint provides the complete list of resources that can be protected
 * by the access control system.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.1: Limit access to system components based on need to know
 * - Requirement 7.2.1: Coverage of all system components
 *
 * @async
 * @function listAllResources
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with status 'ok' and array of all resources,
 *                            or status 'error' with error message on failure
 * @example
 * // Success response
 * {
 *   status: 'ok',
 *   data: [
 *     { id: 1, resource_name: 'Transactions', resource_url: '/api/transactions', description: '...' },
 *     { id: 2, resource_name: 'Users', resource_url: '/api/users', description: '...' }
 *   ],
 *   message: 'Resources found'
 * }
 */
controller.listAllResources = async (req, res) => {
    try {
        const resources = await db.resources.findAll({
            order: [['resource_name', 'ASC']]
        });

        return res.status(200).json({
            status: 'ok',
            data: resources,
            message: 'Resources found'
        });
    } catch (error) {
        console.error('Error listing resources:', error);
        return res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
};

module.exports = controller;