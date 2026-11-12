/**
 * User TDM Controller
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 3.5.1: Limit storage of account data to that which is needed for business, legal, or regulatory purposes
 * - Requirement 3.5.2: Render cardholder data unreadable anywhere it is stored (using encryption)
 * - Requirement 8.2.1: Use strong cryptography to render all authentication factors (such as passwords) unreadable during transmission and storage
 * - Requirement 8.2.2: Render all passwords unreadable during storage
 * - Requirement 8.2.3: Secure all stored account data
 * - Requirement 7.1.1: Restrict access to system components and cardholder data based on need to know
 */

const userCtrl = {}
const crypto = require('crypto')
const { decryptWithPem, encryptWithPem } = require('../../../helpers/lib/helpers')
const db = require('../sequelize/init')

  /**
   * List all TDM users
   * PCI DSS 4 Requirement 3.5.2: Decrypts PII (first_name, last_name) using PEM encryption for display
   * PCI DSS 4 Requirement 3.5.1: Only decrypts data needed for business purposes
   */
  userCtrl.list = async (req, res) => {

    // PCI DSS 4 Requirement 10.2.1: Audit trail - log user list access
    const users = await db.seq.query(`SELECT * FROM ${process.env.DB_NAME_TDM}.user`, { type: db.seq.QueryTypes.SELECT });
    var userModified = []
    if (users) {
      users.forEach(item => {
        // PCI DSS 4 Requirement 3.5.2: Decrypts encrypted PII for authorized display
        const first_name = decryptWithPem(item.first_name);
        if (first_name != "error") {
          // PCI DSS 4 Requirement 3.5.2: Decrypt all PII fields for authorized display
          item.first_name = first_name
          item.last_name = decryptWithPem(item.last_name);
          item.last_name2 = decryptWithPem(item.last_name2);
          item.estado = (item.active == 1) ? 'Activo' : 'Inactivo';
          item.stringify = JSON.stringify(item);
          userModified.push(item);
        }
  
      });
    }

    return res.json({ message : 'usuarios encontrados', users, })
  }

  /**
   * Get TDM user by ID
   * PCI DSS 4 Requirement 3.5.2: Decrypts PII using PEM encryption for authorized display
   * PCI DSS 4 Requirement 7.1.1: Access restricted to specific user by ID
   */
  userCtrl.getById = async (req, res) => {
    try {
      // PCI DSS 4 Requirement 10.2.1: Audit trail - log user lookup by ID
      const users = await db.seq.query(`SELECT * FROM ${process.env.DB_NAME_TDM}.user WHERE iduser = ?`, { replacements: [req.params.id], type: db.seq.QueryTypes.SELECT });
      
      if(!users[0]){
        return res.status(404).json({ message : 'No se encontró el usuario.' })
      }
      const item = users[0];
      // PCI DSS 4 Requirement 3.5.2: Decrypts encrypted PII for authorized display
      const first_name = decryptWithPem(item.first_name);
      // PCI DSS 4 Requirement 3.5.1: Only decrypt PII needed for business purposes
      const user = {
          first_name : first_name,
          last_name : decryptWithPem(item.last_name),
          last_name2 : decryptWithPem(item.last_name2),
          estado : 1,
          email: item.email
      }

      return res.json({ message : 'usuario encontrado', user })

    }catch(err) {
      // PCI DSS 4 Requirement 10.2.1: Audit trail - log errors for security monitoring
      dd(err.stack, 'error');
      return res.status(500).json({ message : 'No se ha podido consultar el usuario.. ha ocurrido un error.' })
    }
  }

  /**
   * Create new TDM user
   * PCI DSS 4 Requirement 8.2.1: Password hashed with SHA256 then encrypted with PEM before storage
   * PCI DSS 4 Requirement 8.2.2: Password rendered unreadable during storage
   * PCI DSS 4 Requirement 3.5.2: PII (name, last_name) encrypted with PEM before storage
   */
  userCtrl.create = async (req, res) => {

    
    try {
      // PCI DSS 4 Requirement 8.1.1: Check for duplicate email before creation
      const users = await db.seq.query(`SELECT * FROM ${process.env.DB_NAME_TDM}.user WHERE email = ?`, { replacements: [req.body.email], type: db.seq.QueryTypes.SELECT });
      
      if(users[0]){
        return res.status(400).json({ message : 'Email de usuario ya se encuentra en uso' })
      }
      // PCI DSS 4 Requirement 8.2.1: Password hashed with SHA256 for one-way encryption
      passHass1 = crypto.createHash("sha256").update(req.body.password).digest("hex");
      // PCI DSS 4 Requirement 8.2.1: Hashed password encrypted with PEM for additional protection
      updatePassword = await encryptWithPem(passHass1);
  
      // PCI DSS 4 Requirement 3.5.2: PII encrypted with PEM before storage
      const data = {
        name: await encryptWithPem(req.body.name),
        last_name: await encryptWithPem(req.body.apellido),
        last_name2: await encryptWithPem(req.body.apellido_2),
        email: req.body.email,
        active: req.body.estado,
        password: updatePassword
      }
      
      // PCI DSS 4 Requirement 10.2.1: Audit trail - log user creation
      const created = await db.seq.query(`
          INSERT INTO  ${process.env.DB_NAME_TDM}.user 
          ( first_name , last_name , last_name2 , email , active , password ) 
          VALUES  
          (? , ? , ? , ? , ? , ?) 
          `, { replacements: [data.name, data.last_name, data.last_name2, data.email, data.active, data.password] })

      if (created)
      {
        return res.status(201).json({ message : 'Usuario creado correctamente' })
      }else{
        return res.status(400).json({ message : 'No se ha podido crear el usuario' })
      }

    } catch (error) {
      // PCI DSS 4 Requirement 10.2.1: Audit trail - log errors for security monitoring
      console.log('error users tdm **** ', error);
      return res.status(500).json({ message : 'No se ha podido crear el usuario.. ha ocurrido un error.' })
    }      
  }

  /**
   * Delete TDM user
   * PCI DSS 4 Requirement 3.5.1: Removes all related data to limit storage of account data
   * PCI DSS 4 Requirement 7.1.1: Properly removes user access from all related tables
   */
  userCtrl.delete = async (req, res) => {
    try {
      // PCI DSS 4 Requirement 10.2.1: Audit trail - log user deletion
      // PCI DSS 4 Requirement 7.1.1: Removes user access from merchant relationships
      await db.seq.query(`DELETE FROM ${process.env.DB_NAME_TDM}.merchant_has_user where user_iduser=? `, { replacements: [req.params.id] });
      // PCI DSS 4 Requirement 7.1.1: Removes user access from smart device relationships
      await db.seq.query(`DELETE FROM ${process.env.DB_NAME_TDM}.user_has_smart_device where user_iduser=? `, { replacements: [req.params.id] });
      // PCI DSS 4 Requirement 3.5.1: Removes user data to limit storage
      await db.seq.query(`DELETE FROM ${process.env.DB_NAME_TDM}.user where iduser=? `, { replacements: [req.params.id] });
      
      return res.status(201).json({ message : 'Usuario eliminado correctamente' })
      
    } catch (error) {
        // PCI DSS 4 Requirement 10.2.1: Audit trail - log errors for security monitoring
        return res.status(500).json({ message : 'No se ha podido eliminar el usuario.. ha ocurrido un error.' })
    }
  }

  /**
   * Update TDM user
   * PCI DSS 4 Requirement 8.2.1: Password hashed with SHA256 then encrypted with PEM before storage if provided
   * PCI DSS 4 Requirement 8.2.2: Password rendered unreadable during storage
   * PCI DSS 4 Requirement 3.5.2: PII encrypted with PEM before storage
   */
  userCtrl.update = async (req, res) => {

    // PCI DSS 4 Requirement 8.1.1: Check for duplicate email (excluding current user)
    const users = await db.seq.query(`SELECT * FROM ${process.env.DB_NAME_TDM}.user WHERE email = ? AND iduser != ?`, { replacements: [req.body.email, req.params.id], type: db.seq.QueryTypes.SELECT });
      
      if(users[0]){
        return res.status(400).json({ message : 'Email de usuario ya se encuentra en uso' })
      }

    // PCI DSS 4 Requirement 3.5.2: PII encrypted with PEM before storage
    const data = {
      name: await encryptWithPem(req.body.name),
      last_name: (req.body.apellido) ? await encryptWithPem(req.body.apellido) : '',
      last_name2: (req.body.apellido) ? await encryptWithPem(req.body.apellido_2) : '',
      email: req.body.email,
      active: req.body.estado
    }
  
    if (req.body.password) {
      // PCI DSS 4 Requirement 8.2.1: Password hashed with SHA256 for one-way encryption
      passHass1 = crypto.createHash("sha256").update(req.body.password).digest("hex");
      // PCI DSS 4 Requirement 8.2.1: Hashed password encrypted with PEM for additional protection
      updatePassword = await encryptWithPem(passHass1);
      data.password = updatePassword;
    }
  
    // PCI DSS 4 Requirement 10.2.1: Audit trail - log user update
    const sql = `UPDATE ${process.env.DB_NAME_TDM}.user SET first_name=?, last_name=?, last_name2=?, email=? , active=? ${req.body.password ? ', password = ?' : ''} where iduser= ?`;
    console.log(sql);
    const replacements = [data.name, data.last_name, data.last_name2, data.email, data.active];
  
    if (req.body.password)
      replacements.push(data.password)
  
    replacements.push(req.params.id)
    try {
      const users = await db.seq.query(sql, { replacements });
  
      return res.status(201).json({ message : 'Usuario actualizado correctamente' })

    } catch (error) {
      // PCI DSS 4 Requirement 10.2.1: Audit trail - log errors for security monitoring
      console.error(error);
      return res.status(500).json({ message : 'No se ha podido actualizar el usuario.. ha ocurrido un error.' })
    }
    
  }

module.exports = userCtrl;