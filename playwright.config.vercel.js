'use strict';

const base = require('./playwright.config');

const LENTITUD = Number(process.env.PW_LENTITUD || 50);

// We clone the base config to point to Vercel instead of localhost
module.exports = Object.assign({}, base, {
  use: Object.assign({}, base.use, {
    baseURL: 'https://aps-encuesta.vercel.app',
    launchOptions: Object.assign({}, base.use.launchOptions, { slowMo: LENTITUD })
  })
});

// We disable the local web server to prevent it from starting and to ensure the test points to the deployed app
delete module.exports.webServer;
