const helmet = require('helmet');

/**
 * Applies security headers (COEP, COOP, CSP, HSTS, referrer policy, noSniff) to the Express app.
 * PCI DSS 4.0: Req 4.1.1 / 11.4.6 / 12.3.1 (secure communications and attack prevention).
 * @param {import('express').Application} app - Express application instance.
 */
module.exports = app => {
    app.use((req, res, next) => {
        res.header("Cross-Origin-Embedder-Policy", "require-corp");
        res.header("Cross-Origin-Opener-Policy", "same-origin");

        return next();
    });

   app.use(
        helmet({
            xPoweredBy: true,
            xFrameOptions: false,
            contentSecurityPolicy: {
                directives: {
                    'default-src': ["'self'"],
                    'script-src': ["'self'", 'https://unpkg.com', 'https://react.dev', 'https://reactjs.org', 'https://cdn.jsdelivr.net', 'https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css', "'unsafe-eval'", 'https://code.jquery.com',  "'unsafe-inline'"],
                    'style-src': ["'self'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css', 'https://cdnjs.cloudflare.com', "'unsafe-inline'"],
                    'connect-src': ["'self'", 'https://ka-f.fontawesome.com'],
                    'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://ka-f.fontawesome.com'],
                    'script-src-attr': ["'self'", "'unsafe-inline'"],
                },
            },
            noSniff: true,
            referrerPolicy: true,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        })
    );

    app.use((_req, res, next) => {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        
        return next();
    });
}