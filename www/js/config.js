
class Config {
    
    constructor() {
        // WebRTC mode enabled
        this.wrtc = false;
        this.ninja_belts = ['white-belt','yellow-belt','orange-belt','green-belt','blue-belt','purple-belt','red-belt','brown-belt','black-belt'];
        this.info_label = false;
    }
    
}
    
// Try will fail when included by the client browser
try {
    module.exports = {
        Config
    }
} catch(e) { }
    