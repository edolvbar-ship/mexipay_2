const timeago = require('timeago.js');
var moment = require('moment');
const helpers = {};

/**
 * Formats a date using moment.js.
 * PCI DSS 4.0: Req 10.3 (secure audit trail display).
 * @param {Date|string} date - Date to format.
 * @param {string} format - Moment format string.
 * @param {boolean} utc - If true, use UTC; otherwise use process.env.TZ (default America/Mexico_City).
 * @returns {string} Formatted date string.
 */
helpers.dateFormat = ( date, format, utc) =>{
    return (utc === true) ? moment(date).utc().format(format) : moment(date).tz(process.env.TZ || 'America/Mexico_City').format(format);
};

/**
 * Returns a human-readable relative time string.
 * @param {Date|string} savedTimestamp - Timestamp to format.
 * @returns {string} Relative time description.
 */
helpers.timeago = (savedTimestamp) => {
    return timeago.format(savedTimestamp);
};

/**
 * Debug helper that prints the input and returns a fixed string.
 * @param {*} text - Input value.
 * @returns {string} Literal 'heree'.
 */
helpers.text = (text) =>{

    console.log('text!!', text)
    return 'heree';
}

/**
 * Checks if the user has the root profile (id_profile == 1).
 * PCI DSS 4.0: Req 7.2.1 (role-based access control).
 * @param {Object} user - User object.
 * @returns {boolean} True if the user is root.
 */
helpers.isRoot = (user) => {
    return ( user && user.id_profile == 1);
}

/**
 * Converts an object to JSON after removing sensitive fields.
 * PCI DSS 4.0: Req 3.4 (data masking), Req 7.1.6 (least privilege / data minimization).
 * @param {Object|string} json - Object or string to serialize.
 * @returns {string} JSON string or the original string.
 */
helpers.stringifyHelper = (json) =>{
    if(typeof json == 'object'){ 
        delete json.password ;  delete json.id_profile; delete json.username; delete json.id_cliente; delete json.is_admin;
    }
    return (typeof json == 'object') ? JSON.stringify(json) : json;
}

/**
 * Returns true if the resource is not a configuration item.
 * @param {Object} obj - Resource object.
 * @returns {boolean}
 */
helpers.leftbarNoConfig = (obj) =>{
    return !(obj.isConfig);
}
/**
 * Returns true if the resource is not a father node.
 * @param {Object} obj - Resource object.
 * @returns {boolean}
 */
helpers.leftbarIsFather = (obj) =>{
    return !(obj.isF);
}
/**
 * Returns true if any resource in the array is marked as configuration.
 * @param {Array<Object>} obj - Array of resource objects.
 * @returns {boolean}
 */
helpers.leftbarHasConfig = (obj) =>{
    let has = false;
    obj.map( v => {
        if(v.resource.isConfig == 1){
            has = true;
        }
    })
    return has;
}

/**
 * Handlebars loop helper.
 * @param {number} from - Start index.
 * @param {number} to - End index.
 * @param {number} incr - Increment.
 * @param {Function} block - Handlebars block function.
 * @returns {string} Accumulated block output.
 */
helpers.for = (from, to, incr, block) => {
    var accum = '';
    for(var i = from; i < to; i += incr)
        accum += block.fn(i);
    return accum;
};
/**
 * Handlebars helper that returns the first value of an array.
 * @param {Array} array - Input array.
 * @param {Function} block - Handlebars block function.
 * @returns {*} First value of the array.
 */
helpers.forarray = (array,block) => {
    for (const value of array) {
        return value;
    }
}
module.exports = helpers;