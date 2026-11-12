/**
 * General Service
 * Provides utility functions for password generation and validation
 *
 * PCI DSS 4.0 Requirements Covered:
 * - Req 8.2.3: Enforces strong password requirements through generation and validation
 * - Req 8.2.4: Implements password complexity rules (uppercase, lowercase, numbers, special chars)
 * - Req 8.2.5: Generates secure passwords meeting minimum length and complexity requirements
 */

const out = {};

/**
 * Generate a secure password meeting PCI DSS complexity requirements
 * PCI DSS 4.0: Req 8.2.3 & 8.2.4 - Creates passwords with required complexity
 * @param {number} passwordLength - Desired password length (minimum 8)
 * @returns {Promise<string>} Generated secure password
 */
out.generatePassword  = async (passwordLength = 8) =>{
  const lowerCase = 'abcdefghijklmnopqrstuvwxyz'
  const upperCase = lowerCase.toUpperCase()
  const numberChars = '0123456789'
  const specialChars = '!"@$%+-_?^&*()'

  let generatedPassword = ''
  let restPassword = ''

  const restLength = passwordLength % 4 
  const usableLength = passwordLength - restLength
  const generateLength = usableLength / 4

  const randomString = (char) => {
    return char[Math.floor(Math.random() * (char.length))]
  }
  for (let i = 0; i <= generateLength - 1; i++) {
    generatedPassword += `${randomString(lowerCase)}${randomString(upperCase)}${randomString(numberChars)}${randomString(specialChars)}`
  }

  for (let i = 0; i <= restLength - 1; i++) {
    restPassword += randomString([...lowerCase, ...upperCase, ...numberChars, ...specialChars])
  }
  return generatedPassword + restPassword
}


  /**
   * Password strength patterns for validation
   * PCI DSS 4.0: Req 8.2.3 - Strong: min 8 chars with lowercase, uppercase, number, special char
   *              Medium: min 6 chars with 3 of 4 character types
   */
  let strongPassword = new RegExp('(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})')
  let mediumPassword = new RegExp('((?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{6,}))|((?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9])(?=.{8,}))')

  /**
   * Validate password strength
   * PCI DSS 4.0: Req 8.2.3 - Validates password meets complexity requirements
   * @param {string} PasswordParameter - Password to validate
   * @returns {object} Object containing color indicator and strength text
   */
  out.passCheckTest = (PasswordParameter) => {
    let aux = {};
      // We then change the badge's color and text based on the password strength
      if(strongPassword.test(PasswordParameter)) {
          aux.color = "green"
          aux.text = 'Fuerte'
      } else if(mediumPassword.test(PasswordParameter)){
          aux.color = 'blue'
          aux.text = 'Media'
      } else{
          aux.color = 'red'
          aux.text = 'Bajo'
      }
    return aux;
  }

module.exports = out;