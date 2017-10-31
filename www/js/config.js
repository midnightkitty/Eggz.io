
class Config {
    
    constructor() {
        // WebRTC mode enabled
        this.wrtc = false;
    }
    
}
    
// Try will fail when included by the client browser
try {
    module.exports = {
        Config
    }
} catch(e) { }
    