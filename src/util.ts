'use strict';

const axios = require('axios');

export function save_session_cookie(response: any) {
    let cookie = response.headers['set-cookie'][0];
    let sid = cookie.split(';')[0].split('=')[1];
    axios.defaults.headers.common['Cookie'] = `session=${sid}`;
}