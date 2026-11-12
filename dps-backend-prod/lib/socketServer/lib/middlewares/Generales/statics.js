const express = require('express');
const { resolve } = require('path');

/**
 * Serves static files under the /gateway/static route.
 * @param {import('express').Application} app - Express application instance.
 */
module.exports = app => {
    general(app);
}

/**
 * Configures the static file route for gateway assets.
 * @param {import('express').Application} app - Express application instance.
 */
const general = app => app.use('/gateway/static', express.static(resolve('./lib/socketServer/lib/public')));