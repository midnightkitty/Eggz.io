class Config {
    
    constructor() {

        this.ninja_belts = ['white-belt','yellow-belt','orange-belt','green-belt','blue-belt','purple-belt','red-belt','brown-belt','black-belt'];

        this.dash_charge_time = 5000; // time to re-charge dash
        this.dash_discharge_time = 500; // time to use up dash charge
        this.player_speed = 25;
        this.player_jump_force = 400;
        this.player_max_x_velocity = 500;
        this.gravity = 350;
        this.restitution = 0.1; // bounciness
        this.dash_speed = 20;
        this.inactive_disconnect = 3000; // ms

        this.wrtc = false; // WebRTC mode        
    }
}
    
// Try will fail when included by the client browser
try {
    module.exports = {
        Config
    }
} catch(e) { }
    