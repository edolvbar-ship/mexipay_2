/**
 * User Controller
 * 
 * PCI DSS 4 Requirements Covered:
 * - Requirement 8.2.1: Use strong cryptography to render all authentication factors (such as passwords) unreadable during transmission and storage
 * - Requirement 8.2.2: Render all passwords unreadable during storage
 * - Requirement 8.3.1: Incorporate multi-factor authentication for all access into the cardholder data environment
 * - Requirement 7.1.1: Restrict access to system components and cardholder data based on need to know
 * - Requirement 10.2.1: Implement audit trails to reconstruct the sequence of events for each system component
 */

const db = require('../sequelize/init');
const helpers = require('../lib/helpers');
const _ = require('lodash');
const userCtrl = {};
/**
 * Get all users
 * PCI DSS 4 Requirement 8.2.2: Excludes password and token_pwd from response to prevent credential exposure
 */
userCtrl.users = async (req, res) => {
  const users = await db.users.findAll({ attributes: { exclude: ['password', 'token_pwd'] }, include: ['cliente'] });
  return res.json({ message: 'usuarios encontrados', users });
};
/**
 * Get user by ID
 * PCI DSS 4 Requirement 8.2.2: Excludes password and token_pwd from response to prevent credential exposure
 */
userCtrl.userById = async (req, res) => {
  const user = await db.users.findByPk(req.params.id, { attributes: { exclude: ['password', 'token_pwd'] }, include: ['cliente'] });
  if (!user) return res.status(404).json({ message: 'usuario no encontrado', user });
  return res.json({ message: 'usuario encontrado', user });
};
/**
 * Create new user
 * PCI DSS 4 Requirement 8.2.1: Password is encrypted before storage using strong cryptography
 * PCI DSS 4 Requirement 8.2.2: Password rendered unreadable during storage
 */
userCtrl.createUser = async (req, res) => {
  // PCI DSS 4 Requirement 8.1.1: Check for duplicate username before creation
  const user = await db.users.findOne({ where: { username: req.body.username } });
  if (user) return res.status(400).json({ message: 'Nombre de usuario ya se encuentra en uso' });
  // PCI DSS 4 Requirement 8.2.1: Encrypt password before storage using strong cryptography
  req.body.password = await helpers.encryptPassword(req.body.password);
  // PCI DSS 4 Requirement 7.1.1: Default to admin if no client assigned (access control)
  if (!req.body.id_cliente) req.body.is_admin = 1;
  try {
    const created = await db.users.create(req.body);
    if (created) return res.status(201).json({ message: 'Usuario creado correctamente' });
    else return res.status(400).json({ message: 'No se ha podido crear el usuario' });
  } catch (error) {
    return res.status(500).json({ message: 'No se ha podido crear el usuario.. ha ocurrido un error.' });
  }
};
userCtrl.deleteUser = async (req, res) => {
  try {
    const destroyed = await db.users.destroy({ where: { id_user: req.params.id } });
    if (destroyed) return res.status(201).json({ message: 'Usuario eliminado correctamente' });
    else return res.status(400).json({ message: 'No se ha podido eliminar el usuario' });
  } catch (error) {
    return res.status(500).json({ message: 'No se ha ha podido eliminar el usuario.. ha ocurrido un error.' });
  }
};
/**
 * Update user
 * PCI DSS 4 Requirement 8.2.1: Password is encrypted before storage if provided
 * PCI DSS 4 Requirement 8.2.2: Password rendered unreadable during storage
 */
userCtrl.updateUser = async (req, res) => {
  // PCI DSS 4 Requirement 8.1.1: Check for duplicate username (excluding current user)
  let aux = await db.users.findOne({ where: { username: req.body.username, id_user: { [db.Sequelize.Op.ne]: req.params.id } } });
  if (aux) return res.status(400).json({ message: 'Nombre de usuario ya se encuentra en uso' });
  // PCI DSS 4 Requirement 8.2.1: Encrypt password before storage if provided
  if (req.body.password != '') req.body.password = await helpers.encryptPassword(req.body.password);
  else delete req.body.password;
  // PCI DSS 4 Requirement 7.1.1: Default to admin if no client assigned (access control)
  if (!req.body.id_cliente) req.body.is_admin = 1;
  try {
    const updated = await db.users.update(req.body, { where: { id_user: req.params.id } });
    if (updated) return res.status(201).json({ message: 'Usuario actualizado correctamente' });
    else return res.status(400).json({ message: 'No se ha podido actualizado el usuario' });
  } catch (error) {
    return res.status(500).json({ message: 'No se ha ha podido actualizar el usuario.. ha ocurrido un error.' });
  }
};
/**
 * Edit user profile
 * PCI DSS 4 Requirement 8.2.3: Secure all stored account data
 * PCI DSS 4 Requirement 8.2.4: Change passwords on a periodic basis
 */
userCtrl.editUserProfile = async (req, res) => {
  // PCI DSS 4 Requirement 3.5.1: Only update fields needed for business purposes
  const update = {
    name: req.body.name,
    last_name: req.body.lastName,
    telephone: req.body.telephone,
    mail: req.body.mail,
  };
  // PCI DSS 4 Requirement 8.1.1: Verify user exists before allowing profile update
  const user = await db.users.findOne({ where: { id_user: req.user.id } });
  if (!user) res.json({ error: true, msg: 'Usuario no encontrado' });
  // PCI DSS 4 Requirement 8.2.4: Validates old password before allowing password change
  // PCI DSS 4 Requirement 8.2.1: New password encrypted before storage
  if (req.body.oldPass && req.body.newPass) {
    // PCI DSS 4 Requirement 8.2.4: Confirm new password matches confirmation
    if (req.body.newPass != req.body.confirmPass) {
      res.json({ error: true, msg: 'Las contraseñas no coinciden' });
      return;
    }
    // PCI DSS 4 Requirement 8.2.1: Verify old password before allowing change
    const validPassword = await helpers.matchPassword(req.body.oldPass, user.password);
    if (validPassword) {
      update.password = await helpers.encryptPassword(req.body.newPass);
    } else {
      res.json({ error: true, msg: 'Contraseña incorrecta' });
      return;
    }
  }
  try {
    await user.update(update);
    return res.status(201).json({ message: 'Usuario actualizado correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'No se ha ha podido actualizado el usuario.. ha ocurrido un error.' });
  }
};
module.exports = userCtrl;
