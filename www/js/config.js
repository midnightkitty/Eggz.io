
class Config {
    
    constructor() {
        this.wrtc = false; // WebRTC mode
        this.ninja_belts = ['white-belt','yellow-belt','orange-belt','green-belt','blue-belt','purple-belt','red-belt','brown-belt','black-belt'];
        this.info_label = false; // extra player info like coordinates
        this.dash_charge_time = 5000; // time to re-charge dash
        this.dash_discharge_time = 500; // time to use up dash charge
        this.debug = false; // display frame-rate, ping etc.
        this.player_speed = 25;
        this.player_jump_force = 400;
        this.player_max_x_velocity = 500;
        this.gravity = 350;
        this.restitution = 0.3; // bounciness
    }
    
}
    
// Try will fail when included by the client browser
try {
    module.exports = {
        Config
    }
} catch(e) { }
    