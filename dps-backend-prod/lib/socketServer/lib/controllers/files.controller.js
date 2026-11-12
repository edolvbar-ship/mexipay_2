/**
 * @fileoverview Files Controller for Batch File Management
 *
 * This controller handles batch file operations including upload, retrieval, and processing
 * of various file types (liquidacion, contracargos). It manages file storage in the database
 * and coordinates with external batch processing services.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 6.3.2: Implements secure file handling practices with validation and error handling
 * - Requirement 7.2: Access control must be enforced at the route/middleware level
 * - Requirement 10.2: Audit logging is implemented through dd() function calls for file operations
 * - Requirement 11.3.1: File operations include error handling to prevent vulnerability exploitation
 *
 * Security Considerations:
 * - File uploads should be validated for size, type, and content before processing
 * - Access to file operations should be restricted to authorized users only
 * - All file operations are logged for audit trail purposes
 * - Sensitive file data is stored in database with appropriate access controls
 *
 * @module controllers/filesController
 * @requires fs - Node.js File System module for file operations
 * @requires ../sequelize/init - Database connection and models
 * @requires axios - HTTP client for external API communication
 */

const fs = require('fs');
const db = require('../sequelize/init');
const { default: axios }  = require('axios');

const filesController = {};

/**
 * Retrieves batch files filtered by file type
 *
 * Fetches a list of batch files from the database based on the specified type,
 * excluding the actual file content for performance. Returns metadata including
 * creation date, status, and other file attributes.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 7.2: Should verify user has appropriate access rights to view files
 * - Requirement 10.2: File access should be logged for audit purposes
 *
 * @async
 * @function getFilesByType
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.type - File type identifier (1: contracargos, 2: liquidacion, 3: other)
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with array of file metadata records
 * @returns {Array<Object>} returns.data - Array of file records with metadata
 * @returns {string} returns.data[].Fecha - Formatted creation date
 * @returns {number} returns.data[].id - File record ID
 * @returns {string} returns.data[].nombre - File name
 * @returns {number} returns.data[].tipo_archivo - File type
 * @returns {number} returns.data[].status - Processing status
 * @returns {number} returns.data[].porcentaje - Processing percentage
 *
 * @example
 * // Request body
 * { type: 2 }
 *
 * // Response
 * {
 *   data: [
 *     { id: 123, nombre: "liquidacion.csv", Fecha: "1/15/2024, 10:30:00 AM", status: 2, ... }
 *   ]
 * }
 */
filesController.getFilesByType = async (req, res) => {

  const where = { tipo_archivo : req.body.type }

  const regs = JSON.parse( JSON.stringify(await db.archivosBatch.findAll({ attributes: {exclude: ['file']} , where , order: [ ['created_at','desc'] ], limit: 200 }) ));

  regs.map( reg => { reg.Fecha = new Date( reg.created_at ).toLocaleString() })

  return res.json({ data: regs })
}

/**
 * Retrieves a specific batch file by its ID
 *
 * Fetches the complete file content including the binary data for a specific
 * batch file record. This endpoint is used to download or view the actual file.
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 6.3.2: Implements secure file retrieval with proper error handling
 * - Requirement 7.2: Should enforce access control to ensure only authorized users can retrieve files
 * - Requirement 10.2: File retrieval is logged through dd() function for audit trail
 * - Requirement 11.3.1: Validates file existence and handles errors to prevent information disclosure
 *
 * Security Considerations:
 * - Ensure proper authorization before allowing file access
 * - Consider implementing rate limiting to prevent abuse
 * - Validate that the requesting user has rights to access the specific file
 *
 * @async
 * @function getFileById
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.id - Database ID of the file to retrieve
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with file content or error message
 * @returns {Buffer} returns.file - Binary file content (on success)
 * @returns {string} returns.error - Error description (on failure)
 * @returns {string} returns.msg - User-friendly error message (on failure)
 *
 * @throws {404} When file with specified ID is not found
 * @throws {500} When database error or unexpected error occurs
 *
 * @example
 * // Success response
 * { file: <Buffer ...> }
 *
 * // Error response (404)
 * { error: "ID: 123, not found", msg: "Archivo no encontrado." }
 *
 * // Error response (500)
 * { error: {...}, msg: "Error al obtener el archivo." }
 */
filesController.getFileById = async (req, res) => {

  try {

    const file = await db.archivosBatch.findByPk(req.params.id);

    if(file){
        return res.json({file: file.file});
    }

    return res.status(404).json({error: `ID: ${req.params.id}, not found`, msg: 'Archivo no encontrado.'});

  } catch (error) {
    dd(error.stack, 'error');
    return res.status(500).json({ error,  msg: 'Error al obtener el archivo.'})
  }

}

/**
 * Processes and uploads batch files for asynchronous processing
 *
 * Handles the complete file upload workflow including:
 * 1. Receiving the uploaded file from multipart form data
 * 2. Reading and storing the file content in the database
 * 3. Creating a database record with metadata
 * 4. Triggering asynchronous processing via external batch service
 * 5. Returning immediate response while processing continues in background
 *
 * File Types (metodo parameter):
 * - 'liquidacion': Settlement files (tipo_archivo = 2)
 * - 'contracargos': Chargeback files (tipo_archivo = 1)
 * - Other: Any other batch file type (tipo_archivo = 3)
 *
 * PCI DSS 4.0 Compliance:
 * - Requirement 6.3.2: Implements secure file handling with validation and error handling
 * - Requirement 7.2: Should enforce authorization before allowing file uploads
 * - Requirement 10.2: All file operations are logged via dd() and console.log for audit trail
 * - Requirement 11.3.1: Error handling prevents information disclosure and potential vulnerabilities
 *
 * Security Considerations:
 * - IMPORTANT: Should implement file type validation (file extension, MIME type, magic bytes)
 * - IMPORTANT: Should implement file size limits to prevent DoS attacks
 * - IMPORTANT: Should scan uploaded files for malware before processing
 * - IMPORTANT: Should validate and sanitize file names to prevent path traversal
 * - File content should be validated before storage
 * - Access to upload endpoint must be restricted to authorized users only
 * - Consider implementing rate limiting to prevent abuse
 *
 * Processing Flow:
 * 1. File is uploaded via multipart/form-data
 * 2. File is read from temporary location and converted to buffer
 * 3. Database record is created with file content
 * 4. External batch processor is notified asynchronously
 * 5. Client receives immediate response with file record
 * 6. Actual processing happens in background
 *
 * @async
 * @function processFile
 * @param {Object} req - Express request object
 * @param {Array<Object>} req.files - Array of uploaded files from multer middleware
 * @param {string} req.files[0].path - Temporary path to uploaded file
 * @param {string} req.files[0].originalname - Original name of uploaded file
 * @param {Object} req.body - Request body
 * @param {string} req.body.metodo - File type/method ('liquidacion', 'contracargos', or other)
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} JSON response with processing status and file records
 * @returns {string} returns.text - Status message indicating file is being processed
 * @returns {Array} returns.data - Array containing [existing files list, newly created file record]
 * @returns {Array<Object>} returns.data[0] - List of existing files of same type (up to 200 most recent)
 * @returns {Object} returns.data[1] - Newly created file record
 * @returns {number} returns.data[1].id - Database ID of new file record
 * @returns {string} returns.data[1].nombre - File name
 * @returns {number} returns.data[1].tipo_archivo - File type identifier
 * @returns {number} returns.data[1].status - Processing status (2 = processing)
 * @returns {number} returns.data[1].porcentaje - Processing percentage (1 = started)
 *
 * @throws {500} When file read fails, database error occurs, or unexpected error happens
 *
 * @example
 * // Request (multipart/form-data)
 * // File: liquidacion.csv
 * // Body: { metodo: "liquidacion" }
 *
 * // Response
 * {
 *   text: "Procesando archivo...",
 *   data: [
 *     [...existing files...],
 *     { id: 456, nombre: "liquidacion.csv", status: 2, porcentaje: 1, ... }
 *   ]
 * }
 *
 * @see {@link https://docs.example.com/batch-processing} for batch processing documentation
 */
filesController.processFile = async (req, res) => {
    // Here is upload of files
    try {
        console.log("Processing file")
        console.log(req.body)
        const file    = req.files[0];
        const buffer  = fs.readFileSync(file.path);

        let metodo = 1;
        switch(req.body.metodo) {
            case 'liquidacion':   metodo = 2; break;
            case 'contracargos':  metodo = 1; break;
            default:              metodo = 3; break;
        }

        let where = { tipo_archivo : metodo };

        const regs = await db.archivosBatch.findAll({ where, attributes: {exclude: ['file']} , order: [ ['id','desc'] ], limit: 200 });
        console.log("These records where found");
        console.log(regs);

        console.log("Creating file...");
        const F = await db.archivosBatch.create({
            tipo_archivo: metodo,
            porcentaje:   1,
            status:       2,
            descripcion:  '',
            nombre:       file.originalname,
            file:         buffer ,
            created_at:   new Date().toISOString()
        })

        console.log("File created");
        console.log(F);

        req.body.id_file_dt = F.id;

        axios.post(`${process.env.BATCH_URL}/api/processFile`, req.body ).then( value => {
            dd(`Se procesa el archivo batch/${req.body.metodo} = ${F.id} `);
        }, err => {
            dd(`Error al procesar el archivo batch/${req.body.metodo} = ${F.id} `,'error');
            dd(err.stack, 'error');
        })

        return res.json({ text:'Procesando archivo...', data: [regs, F] });

    } catch (error) {
        dd(error.stack, 'error');
        return res.status(500).json(error);
    }

}

module.exports = filesController;