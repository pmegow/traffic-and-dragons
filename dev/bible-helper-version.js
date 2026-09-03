// Compatibility marker for the local Bible Editor writer protocol.
// Bump only when bible-server.js or its page/server contract changes; UI-only releases reuse it.
var BIBLE_HELPER_VERSION = "1.0.1";

if (typeof module !== "undefined" && module.exports) module.exports = BIBLE_HELPER_VERSION;
