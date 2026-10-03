import {handleRequest} from '../server/gateway.js';
// Vercel Node.js Web Standard handler; route: POST /api/dispatch.
export default {
  fetch(request) {
    return handleRequest({request,env:{APPS_SCRIPT_URL:process.env.APPS_SCRIPT_URL,API_SHARED_SECRET:process.env.API_SHARED_SECRET}});
  }
};
