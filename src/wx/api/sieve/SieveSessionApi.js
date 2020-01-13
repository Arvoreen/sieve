/*
 * The content of this file is licensed. You may obtain a copy of
 * the license at https://github.com/thsmi/sieve/ or request it via
 * email from the author.
 *
 * Do not remove or change this comment.
 *
 * The initial author of the code is:
 *   Thomas Schmid <schmid-thomas@gmx.net>
 */

(function (exports) {

  "use strict";

  /* global ExtensionCommon */
  /* global ChromeUtils */

  /**
   * Implements a webextension api for sieve session and connection management.
   */
  class SieveSessionApi extends ExtensionCommon.ExtensionAPI {
    /**
     * @inheritdoc
     */
    getAPI(context) {

      const url = context.extension.getURL("/");

      const { require } = ChromeUtils.import(`${url}/SieveRequire.jsm`).loadRequire(`${url}/libs/libManageSieve/`);
      const { SieveSession } = require("./SieveSession.js");

      const sessions = new Map();

      console.dir(SieveSession);
      console.dir(require);

      // webExtension.localizeMessage("libraryLabel");

      return {
        sieve: {
          session: {

            onAuthenticate: new ExtensionCommon.EventManager({
              context,
              name: "sieve.session.onAuthenticate",
              register: (fire, id) => {

                const callback = async (hasPassword) => {

                  const rv = await fire.async(hasPassword);
                  console.log(`The onAuthenticate returned ${rv}`);
                  return rv;
                };

                sessions.get(id).on("authenticate", callback);

                return () => {
                  if (sessions.has(id))
                    sessions.get(id).on("authenticate");
                };
              }
            }).api(),

            onAuthorize: new ExtensionCommon.EventManager({
              context,
              name: "sieve.session.onAuthorize",
              register: (fire, id) => {

                const callback = async () => {

                  const rv = await fire.async();
                  console.log(`The onAuthorize returned ${rv}`);
                  return rv;
                };

                sessions.get(id).on("authorize", callback);

                return () => {
                  if (sessions.has(id))
                    sessions.get(id).on("authorize");
                };
              }
            }).api(),

            onProxyLookup: new ExtensionCommon.EventManager({
              context,
              name: "sieve.session.onProxyLookup",
              register: (fire, id) => {

                const callback = async (host, port) => {

                  const rv = await fire.async(host, port);
                  console.log(`The onProxyLookup returned ${rv}`);
                  return rv;
                };

                sessions.get(id).on("proxy", callback);

                return () => {
                  if (sessions.has(id))
                    sessions.get(id).on("proxy");
                };
              }
            }).api(),

            // TODO Implement a minimal pref parser.
            // TODO Implement account settings.

            // Open Editor in tab.

            async create(id, options) {

              if (sessions.has(id))
                throw new Error("Id already in use");

              sessions.set(id,
                new SieveSession(id, options));
            },

            async destroy(id) {
              if (!sessions.has(id))
                return;

              await this.disconnect(id, true);
              sessions.delete(id);
            },

            async connect(id, host, port) {
              await sessions.get(id).connect(host, port);
            },

            async disconnect(id, force) {
              await sessions.get(id).disconnect(force);
            },

            async isConnected(id) {
              if (!sessions.has(id))
                return false;

              return await sessions.get(id).isConnected();
            },

            async capabilities(id) {
              return await sessions.get(id).capabilities();
            },

            async listScripts(id) {
              return await sessions.get(id).listScripts();
            },

            async putScript(id, name, body) {
              return await sessions.get(id).putScript(name, body);
            },

            async getScript(id, name) {
              return await sessions.get(id).getScript(name);
            },

            async renameScript(id, oldname, newname) {
              return await sessions.get(id).renameScript(oldname, newname);
            },

            async deleteScript(id, name) {
              return await sessions.get(id).deleteScript(name);
            },

            async activateScript(id, name) {
              return await sessions.get(id).activateScript(name);
            },

            async checkScript(id, body) {
              // TODO move the try catch into checkscript...
              try {
                await sessions.get(id).checkScript(body);
              } catch (ex) {
                // FIXME We need to rethrow incase checkscript returns a SieveServerException.
                return ex.getResponse().getMessage();
              }

              return "";
            },

            async probe(host, port) {

              const { Sieve } = require("./SieveSession.js");
              const { SieveLogger } = require("./SieveLogger.js");
              const { SieveInitRequest } = require("./SieveRequest.js");

              const sieve = new Sieve(new SieveLogger());

              return await new Promise((resolve) => {

                const listener = {

                  onInitResponse: function () {
                    resolve(true);
                    sieve.disconnect();
                  },

                  onError: function () {
                    resolve(false);
                    sieve.disconnect();
                  },

                  onTimeout: function () {
                    resolve(false);
                    sieve.disconnect();
                  },

                  onDisconnect: function () {
                    // we are already disconnected....
                    resolve(false);
                  }
                };

                const request = new SieveInitRequest();
                request.addErrorListener(listener.onError);
                request.addResponseListener(listener.onInitResponse);
                sieve.addRequest(request);

                sieve.addListener(listener);

                sieve.connect(host, port, false);
              });
            }
          }
        }
      };
    }
  }

  exports.SieveSessionApi = SieveSessionApi;

})(this);
