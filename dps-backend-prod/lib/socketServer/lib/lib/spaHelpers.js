const { default: axios } = require("axios");

const helpers = {};

/**
 * Performs an HTTP request with an x-access-token header.
 * PCI DSS 4.0: Req 4.2.1 (protect data in transit), Req 8.3.2 (token authentication).
 * @param {string} url - Target URL.
 * @param {string} method - HTTP method.
 * @param {Object} data - Request body.
 * @param {string} token - Bearer/access token to send in the x-access-token header.
 * @returns {Promise<{response: Object}|{error: Object}>} Axios response or error object.
 */
helpers.httpToken = async (url, method, data, token) => {
  // Send a POST request
  let response = null;
  try {
    response = await axios({
      method,
      url,
      data,
      headers: {
        post: {        // can be common or any other method
          "x-access-token": token
        }
      }
    });
  } catch (error) {
    return { error }
  }
  return { response };
};

  
module.exports = helpers;