// code shared by the server and client
var client_lpt; // time of the last client physics update
var client_dpt = 16; // delta time between now and the last client physics updates
var max_velocity = 250;
var chat_msg_life = 3000; // how long chat messages stay on the screen in miliseconds

var dc_open = false; // is the data channel open?

var eggs_list = ['egg','egg2','egg3','egg4','egg5','egg6','egg7','egg8'];

var gameFocus = false;

// Phaser
var manager = null;
var emitter = null;


var eggEmitter;

var map;
var tileset;
var layer;
var p;
var cursors;

class Player {
    constructor(sprite, id, socket, x, y, rotation, egg_color) {
        this.sprite = sprite;
        this.id = id;    
        this.socket = socket;
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        this.name = '';
        this.egg_color = egg_color;
        this.name_label = {};
        this.dialog_box = {};
        this.belt = {}; // sprite assigned later
        this.belt_color = 'white-belt';

        // only used server side
        this.canLevelUp = true;
    }
}

class Messenger {
    
    constructor(socket, dataChannel) {
        this.socket = socket;
        this.dc = dataChannel;
    }
    
    client_sendDC(type, data) {
        // console.log(type + '-' + data);
        this.dc.send(type + '-' + data);
    }

    client_sendWS(type, data) {
        this.socket.emit('data', type + '-' + data);
    }
    
    // l- player list
    // m - message
    handleMessage(data) {
        var type = data.substring(0,1);
        var result = data.substring(2,data.length);
        // console.log(type + ':' + result);
    }

    handleWSMessage(data) {
        var type = data.substring(0,1);
        var result = data.substring(2,data.length);
        this.consumeWSMessage(type, result);      
    }

    consumeDCMessage(type, result) {
        if (type == 'g') {
            console.log(result);
        }
    }
    consumeWSMessage(type, result) {
        if (type == 'w') {
            var r = result.split('.');
            var id = r[0];
            var time = r[1];
            
            pingsWS.forEach(function(ping) {
              if (ping.id == id) {
                var t_sent = parseInt(ping.time);
                var t_rec = parseInt(Date.now());
                var delta = t_rec - t_sent;
                //console.log('WS Ping roundtrip took: ' + delta * 1000+ 's');
                pingsWS.splice(pingsWS.indexOf(ping), 1);
                updateWSPing(delta);
              }
            });    
        }
    }
}

function updateWSPing(delta) {
    // console.log('updateWSPing');
    $('#ws-ping').html('WS Ping: ' + delta  + 'ms queue[' + pingsWS.length + ']');    
}

//
// Phaser game engine creation
//
function setupPhaserGame() {
    game = new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.AUTO, '', { preload: preload, create: create, update: update, render: render });
  
    function preload() {
    
        // scenery
        game.load.image('sky', 'assets/blue-sky.jpg');

        // egg colors
        game.load.image('egg', 'assets/egg128.png');
        game.load.image('egg2', 'assets/egg128-2.png');
        game.load.image('egg3', 'assets/egg128-3.png');
        game.load.image('egg4', 'assets/egg128-4.png');
        game.load.image('egg5', 'assets/egg128-5.png');
        game.load.image('egg6', 'assets/egg128-6.png');
        game.load.image('egg7', 'assets/egg128-7.png');
        game.load.image('egg8', 'assets/egg128-8.png');

        // egg ninja belts
        game.load.image('white-belt','assets/belt-white-98.png');
        game.load.image('yellow-belt','assets/belt-yellow-98.png');
        game.load.image('orange-belt','assets/belt-orange-98.png');
        game.load.image('green-belt','assets/belt-green-98.png');
        game.load.image('blue-belt','assets/belt-blue-98.png');
        game.load.image('purple-belt','assets/belt-purple-98.png');                 
        game.load.image('red-belt','assets/belt-red-98.png');              
        game.load.image('brown-belt','assets/belt-brown-98.png');
        game.load.image('black-belt','assets/belt-black-98.png');              

        // other world objects
        game.load.image('nest', 'assets/nest.png');
        game.load.image('pillow', 'assets/pillow.png');
        game.load.image('nest_hitbox', 'assets/nest-powerup-hitbox.png');
        game.load.spritesheet('egg-explode', 'assets/egg-explode-frames.png', 17, 17);
        
        // phsyics data for object collisions
        game.load.physics('pillowPhysicsData', 'assets/pillow_physics.json');
        game.load.physics('nestPhysicsData', 'assets/nest_physics.json');
        game.load.physics('eggPhysicsData', 'assets/egg_physics128_detailed.json');

        // *tiles*
        game.load.tilemap('eggz-tile-map', 'assets/eggz.json', null, Phaser.Tilemap.TILED_JSON);
        game.load.image('tiles', 'assets/eggz-tiles.png');        

        // particle test
        game.forceSingleUpdate = true;
        game.load.image('sky', 'assets/haze.png');
        game.load.atlas('colorsHD', 'assets/colorsHD.png', 'assets/colorsHD.json', Phaser.Loader.TEXTURE_ATLAS_JSON_HASH);
    }
  
    function create() {

        game.physics.startSystem(Phaser.Physics.P2JS);        

        // background image
        var sky = game.add.sprite(0, 0, 'sky');
        sky.scale.setTo(1.5,1.5);        

        map = game.add.tilemap('eggz-tile-map');
        map.addTilesetImage('eggz-tiles', 'tiles');        

        layer = map.createLayer('World1');      

        // must set which tiles have collisions enabled BEFORE calling converTilemap
        map.setCollision(1);
        map.setCollision(21);

        game.physics.p2.convertTilemap(map, layer);
    
        //layer.debug = true;  
        //game.time.advancedTiming = true;
        //game.time.desiredFps = 45;

        var nest = new Phaser.Sprite(game, 1000, 1280, 'nest');
        game.physics.p2.enable(nest, false);
        nest.body.static = true;
        game.world.add(nest);
        nest.body.clearShapes();
        nest.body.loadPolygon('nestPhysicsData', 'nest');    
        nest.body.label = 'ground';

        var pillow = new Phaser.Sprite(game, 485,4410, 'pillow');
        game.physics.p2.enable(pillow, false);
        pillow.body.static = true;
        game.world.add(pillow);
        pillow.body.clearShapes();
        pillow.body.loadPolygon('pillowPhysicsData', 'pillow');

        var playerMaterial = game.physics.p2.createMaterial('playerMaterial');
        var ledgeMaterial = game.physics.p2.createMaterial('ledgeMaterial');    
        game.physics.p2.setWorldMaterial(ledgeMaterial, true, true, true, true);
        var contactMaterial = game.physics.p2.createContactMaterial(playerMaterial, ledgeMaterial);
        contactMaterial.friction = 0.9;     // Friction to use in the contact of these two materials.
        contactMaterial.restitution = 0.35;  // Restitution (i.e. how bouncy it is!) to use in the contact of these two materials.
        contactMaterial.stiffness = 1e20;    // Stiffness of the resulting ContactEquation that this ContactMaterial generate.
        contactMaterial.frictionStiffness = 1e20;    // Stiffness of the resulting FrictionEquation that this ContactMaterial generate.
        contactMaterial.surfaceVelocity = 0;        // Will add surface velocity to this material. If bodyA rests on top if bodyB, and the surface velocity is positive, bodyA will slide to the right.

        // Pick an egg color at random
        var egg_color = eggs_list[Math.floor(Math.random()*eggs_list.length)];
        // console.log('random egg color: ' + egg_color);

        player = game.add.sprite(400, 1500, egg_color);
        game.physics.p2.enable(player, false);
        player.body.clearShapes();
        player.body.loadPolygon('eggPhysicsData', 'egg128');
        player.body.setMaterial(playerMaterial);
        player.anchor.setTo(0.5, 0.5);

        game.physics.p2.gravity.y = config.gravity;
        game.physics.p2.restitution = config.restitution;

        game.world.setBounds(0,0,world_x,world_y);
        game.camera.follow(player, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1);

        cursors = game.input.keyboard.createCursorKeys();

        //space_bar = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
        game.stage.disableVisibilityChange = true;
        game.time.advancedTiming = true;

        // add local user to users list
        localPlayer = new Player(player,socket.id, null, player.body.x, player.body.y, 0, egg_color);

        console.log('created local player with id: ' + socket.id);

        game.time.events.loop(1000, updateStats, this);

        localPlayer.name_label = game.add.text(100, 4500, '', { font: "16px Arial", fill: "#000000", align: "center"});
        localPlayer.name_label.alpha = 0.5;
        localPlayer.name_label.anchor.set(0.5);

        localPlayer.info_label = game.add.text(100, 4500, 'info', { font: "16px Arial", fill: "#000000", align: "center"});
        localPlayer.info_label.anchor.set(0.5);
        // Set whether the info label is visible or not
        localPlayer.info_label.visible = config.info_label;
        
        localPlayer.dialog_box = game.add.text(100, 4500, '', { font: "16px Arial", fill: "#000000", align: "center", backgroundColor: "#FFFFFF"});
        localPlayer.dialog_box.alpha = 0.5;
        localPlayer.dialog_box.anchor.set(0.5);

        localPlayer.belt = new Phaser.Sprite(game, 0,0,'white-belt');
        localPlayer.belt.anchor.y = 0.15;
        localPlayer.belt.anchor.x = 0.5;
        game.world.add(localPlayer.belt);
        localPlayer.sprite.addChild(localPlayer.belt);
        localPlayer.belt_color = 'white-belt';

        manager = this.game.plugins.add(Phaser.ParticleStorm);
        
        //  This example illustrates:
        //  
        //  * Selection from a list of image source names (image)
        //  * Random range between min and max values (lifespan, vx)
        //  * Simple control graph for constant downward acceleration (vy)
        //  * Simple control graph to shrink from full size to half size (scaleX, scaleY)
        //  * Simple control graph to fade alpha during the last half of it's life span
        //  * Emission of child particles at a rate determined by the control graph (emit)
        //  * glowyChild: Using scale instead of scaleX and scaleY to control both axis simultaneously
        //  * glowyChild: Simple control graph to fade alpha during it's entire life span
    
        var glowy = {
            image: 'colorsHD',
            frame: [ 'yellow', 'white' ],
            lifespan: { min: 600, max: 900 },
            vx: { value: { min: 4, max: 12 }, delta: -0.1 },
            vy: { value: { min: -15.0, max: -10 }, delta: 0.5 },
            scale : { value: .5, control: [ { x: 0, y: 1 }, { x: 1, y: 0.5 } ] },
            alpha: { value: 1, control: [ { x: 0, y: 1 }, { x: 0.5, y: 1 }, { x: 1, y: 0 } ] },
            emit: {
                name: 'glowyChild',
                value: 1,
                control: [ { x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 1, y: 1 } ]
            }
        };
    
        var glowyChild = {
            image: 'colorsHD',
            frame: [ 'red', 'green', 'blue' ],
            blendMode: 'HARD_LIGHT',
            lifespan: 1000,
            vx: { min: -4, max: 4 },
            vy: { value: { min: -10, max: -6 }, delta: 0.5 },
            scale: { value: { min: 0.5, max: .25 }, control: [ { x: 0, y: 1 }, { x: 1, y: 0.5 } ] },
            alpha: { value: 1, control: [ { x: 0, y: 1 }, { x: 1, y: 0 } ] }
        };
    
        manager.addData('glowy', glowy);
        manager.addData('glowyChild', glowyChild);
        emitter = manager.createEmitter();
        emitter.addToWorld();

        dash_meter = new DashMeter();
    }

    function render() {

    }

    function canPlayerJump() {
        var yAxis = p2.vec2.fromValues(0, 1);
        var result = false;
    
        for (var i = 0; i < game.physics.p2.world.narrowphase.contactEquations.length; i++)
        {
            var c = game.physics.p2.world.narrowphase.contactEquations[i];
    
            if (c.bodyA === localPlayer.sprite.body.data || c.bodyB === localPlayer.sprite.body.data)
            {
                var d = p2.vec2.dot(c.normalA, yAxis); // Normal dot Y-axis
                if (c.bodyA === localPlayer.sprite.body.data) d *= -1;
                if (d > 0.5) result = true;
            }
        }
        
        return result;
    }
  
  
    function updateStats() {
      $('#stats').html('FPS:' + game.time.fps);
    }
  
    $(window).resize(function() {
      game.scale.setGameSize(window.innerWidth, window.innerHeight);
      layer.resize(window.innerWidth, window.innerHeight);
    })

    //
    // Physics update
    //
    function update() {

        // update the position of the player's name label
        localPlayer.name_label.x = localPlayer.sprite.x;
        localPlayer.name_label.y  = localPlayer.sprite.y + localPlayer.sprite.height/2 + 10;

        // update the position of the player's info label
        localPlayer.info_label.x = localPlayer.sprite.x;
        localPlayer.info_label.y  = localPlayer.sprite.y + localPlayer.sprite.height/2 + 30;      
        localPlayer.info_label.setText('(' + Math.round(localPlayer.sprite.x / 10) * 10 + ',' + Math.round(localPlayer.sprite.y / 10) * 10 + ')');  

        // update the position of the player's dialog box
        localPlayer.dialog_box.x = localPlayer.sprite.x;
        localPlayer.dialog_box.y  = localPlayer.sprite.y - localPlayer.sprite.height/2 - 10;
        
        // keep track of the time and delta time between each physics update
        client_dpt = Date.now() - client_lpt;
        // first time client_lpt is null;
        if (client_dpt == undefined || Number.isNaN(client_dpt))
            client_dpt = 0;
        client_lpt = Date.now();
        // console.log(client_dpt); at 60FPS this is about 16ms

        // only allow player movement if the game is in focus
        if (gameFocus) {

            if (cursors.left.isDown || game.input.keyboard.isDown(Phaser.Keyboard.A)) {

                // slow momentum when user changes direction
                if (player.body.velocity.x > 0) {
                    player.body.velocity.x = player.body.velocity.x / 2;
                }

                //  Dash to the left
                if (game.input.keyboard.isDown(Phaser.Keyboard.SPACEBAR)) {
                    player.body.force.x = (-150 * dash_speed);
                }
                //  Move to the left
                else if (Math.abs(player.body.velocity.x) < max_velocity) {
                    player.body.force.x = (-150 * config.player_speed);
                }
            }
            else if (cursors.right.isDown || game.input.keyboard.isDown(Phaser.Keyboard.D)) {

                // slow momentum when user changes direction
                if (player.body.velocity.x < 0) {
                    player.body.velocity.x = player.body.velocity.x / 2;
                }

                //  Dash to the right
                if (game.input.keyboard.isDown(Phaser.Keyboard.SPACEBAR)) {
                    player.body.force.x = (150 * dash_speed);
                }
                // Move to the right
                else if (Math.abs(player.body.velocity.x) < max_velocity) {
                    player.body.force.x = (150 * config.player_speed);
                }
                // console.log('(' + player.body.velocity.x + ',' + player.body.velocity.y + ')');
            }
            
            if ( (cursors.up.isDown || game.input.keyboard.isDown(Phaser.Keyboard.W)) && canPlayerJump()) {
                player.body.velocity.y = -config.player_jump_force;
            }

            // limit max vertical velocity up
            if (player.body.velocity.y < -500)
                player.body.velocity.y = -500;

            // limit max vertical velocity down
            if (player.body.velocity.y > 500)
                player.body.velocity.y = 500;

            // unless we are dashing and have charge, limit x velocity
            if (dash_meter.charge_level < 5) {
                if (player.body.velocity.x > config.player_max_x_velocity)
                    player.body.velocity.x = config.player_max_x_velocity;
                
                if (player.body.velocity.x < -config.player_max_x_velocity)
                    player.body.velocity.x = -config.player_max_x_velocity;
            }
        }

        // Error key presses should close the chat window if it's open
        if (chatOpen) {
            if (cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown) {
                $('#chatinput').hide();
                chatOpen = false;
                gameFocus = true;
            }
        }

        if (keyInputStr && localPlayer.id != undefined) {

            var input_update = {
                id: localPlayer.id,
                keys: keyInputStr,
                x: localPlayer.sprite.x,
                y: localPlayer.sprite.y,
                rotation: localPlayer.sprite.rotation,
                egg_color: localPlayer.egg_color,
                belt_color: localPlayer.belt_color
            }
            // console.log(keyInputStr + '(' + player.body.x + ',' + player.body.y + ')');
            //console.log(JSON.stringify(input_update));
            if (config.wrtc) {
                msg.client_sendDC('i', JSON.stringify(input_update));
            }
            else {
                //console.log('sending input update to server');
                client_sendWS('i', JSON.stringify(input_update));
            }
        }
        else if ( localPlayer.id != undefined) {
            var input_update = {
                id: localPlayer.id,
                keys: null,
                x: localPlayer.sprite.x,
                y: localPlayer.sprite.y,
                rotation: localPlayer.sprite.rotation,
                egg_color: localPlayer.egg_color,
                belt_color: localPlayer.belt_color
            }
            // console.log(keyInputStr + '(' + player.body.x + ',' + player.body.y + ')');
            // console.log(JSON.stringify(input_update));
            if (config.wrtc && dc_open) {
                msg.client_sendDC('i', JSON.stringify(input_update));
            }
            else {
                //console.log('sending input update to server');
                client_sendWS('i', JSON.stringify(input_update));
            }
        }

        updatePlayers();

        // Drain the dash meter if space bar is down,
        // otherwise recharge it
        if (game.input.keyboard.isDown(Phaser.Keyboard.SPACEBAR)) {
            dash_meter.drain();
        }
        else {
            dash_meter.charge();
        }

        dash_meter.draw();

    }
}

function addPlayerSprite(egg_color) {
    var newPlayerSprite = game.add.sprite(getRandomInt(0,500), world_y-1500, egg_color);
    newPlayerSprite.anchor.setTo(0.5, 0.5);
    return newPlayerSprite;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

// Try will fail when included by the client browser
try {
    module.exports = {
        Player,
        Messenger,
        setupPhaserGame
    }
} catch(e) { }
