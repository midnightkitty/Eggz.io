// code shared by the server and client

class Player {
    constructor(sprite, id, socket, x, y) {
        this.sprite = sprite;
        this.id = id;    
        this.socket = socket;
        this.x = x;
        this.y = y;
        this.angle;
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
                var t_sent = parseInt(time);
                var t_rec = parseInt(Date.now());
                var delta = (t_rec - t_sent) / 1000;
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
    game = new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.AUTO, '', { preload: preload, create: create, update: update });
  
    function preload() {
      game.load.image('sky', 'assets/blue-sky.jpg');
      game.load.image('ground', 'assets/grass.png');
      game.load.image('ledge', 'assets/ledge-grass.png');
      game.load.image('ledge-tile', 'assets/ledge-tile.png');
      game.load.image('repeating-tile', 'assets/repeating-tile.png')
      game.load.image('star', 'assets/star.png');
      game.load.spritesheet('dude', 'assets/dude.png', 32, 48);    
      game.load.image('egg', 'assets/egg128.png');
      game.load.image('tetrisblock1', 'assets/tetrisblock1.png');
      game.load.physics('physicsData', 'assets/sprites.json');
      game.load.physics('eggPhysicsData', 'assets/egg_physics128.json');
    }
  
    function create() {
  
      game.physics.startSystem(Phaser.Physics.P2JS);
  
      var sky = game.add.sprite(0, 0, 'sky');
      sky.scale.setTo(1.5,1.5);
  
      tileLedges = game.add.group();
  
      var gr = new Phaser.TileSprite(game,0,world_y-100,10000,300,'repeating-tile');
      //game.physics.arcade.enable(gr);
      game.physics.p2.enable(gr);
      //gr.body.immovable = true;
      gr.body.label = 'ground';
      gr.body.static = true;
      gr.body.setMaterial(ledgeMaterial);
      tileLedges.add(gr);
  
      var ts = new Phaser.TileSprite(game,600,world_y-400,537,50,'repeating-tile');
      //game.physics.arcade.enable(ts);
      game.physics.p2.enable(ts);
      //ts.body.immovable = true;
      ts.body.label = 'ground';
      ts.body.static = true;
      ts.body.setMaterial(ledgeMaterial);
      tileLedges.add(ts);
  
      var ts2 = new Phaser.TileSprite(game,1500,world_y-600,1000,50,'repeating-tile');
      //game.physics.arcade.enable(ts);
      game.physics.p2.enable(ts2);
      //ts.body.immovable = true;
      ts2.body.static = true;
      ts2.body.label = 'ground';
      ts2.body.setMaterial(ledgeMaterial);
      tileLedges.add(ts2);
  
      var tetris1 = game.add.sprite(600,4500, 'tetrisblock1');
      game.physics.p2.enable(tetris1, false);
      // game.physics.arcade.enable(tetris1);
      tetris1.body.clearShapes();
      tetris1.body.loadPolygon('physicsData', 'tetrisblock1');    
  
      var playerMaterial = game.physics.p2.createMaterial('playerMaterial');
      var ledgeMaterial = game.physics.p2.createMaterial('ledgeMaterial');    
      game.physics.p2.setWorldMaterial(ledgeMaterial, true, true, true, true);
      var contactMaterial = game.physics.p2.createContactMaterial(playerMaterial, ledgeMaterial);
      contactMaterial.friction = 0.9;     // Friction to use in the contact of these two materials.
      contactMaterial.restitution = 0.35;  // Restitution (i.e. how bouncy it is!) to use in the contact of these two materials.
      contactMaterial.stiffness = 1e20;    // Stiffness of the resulting ContactEquation that this ContactMaterial generate.
      contactMaterial.frictionStiffness = 1e20;    // Stiffness of the resulting FrictionEquation that this ContactMaterial generate.
      contactMaterial.surfaceVelocity = 0;        // Will add surface velocity to this material. If bodyA rests on top if bodyB, and the surface velocity is positive, bodyA will slide to the right.
  
      player = game.add.sprite(200, world_y-1000, 'egg');
      game.physics.p2.enable(player, false);
      player.body.clearShapes();
      player.body.loadPolygon('eggPhysicsData', 'egg128');
      player.body.setMaterial(playerMaterial);
      player.body.onGround = false;
      player.body.onBeginContact.add(playerHit, this);
      player.body.onEndContact.add(playerNoHit, this);
      player.anchor.setTo(0.5, 0.5);
  
      game.physics.p2.gravity.y = 300;
      game.physics.p2.restitution = 0.3;
  
      game.world.setBounds(0,0,world_x,world_y);
      game.camera.follow(player, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1);
  
      cursors = game.input.keyboard.createCursorKeys();
      game.stage.disableVisibilityChange = true;
      game.time.advancedTiming = true;
  
      // add local user to users list
      localPlayer = new Player(player,socket.id, null, player.body.x, player.body.y);

      console.log('created local player with id: ' + socket.id);
  
      game.time.events.loop(1000, updateStats, this);
    }
  
    function playerHit(body, bodyB, shapeA, shapeB, equation) {
      //console.log('player contact ' + body.label);
      if (body && body.label && body.label == 'ground')
        player.body.onGround = true;
    }
  
    function playerNoHit(body, bodyB, shapeA, shapeB, equation) {
      //console.log('contact ended');
      if (body && body.label && body.label == 'ground')
        player.body.onGround = false;
    }
  
  
    function updateStats() {
      $('#stats').html('FPS:' + game.time.fps);
    }
  
  
    $(window).resize(function() {
      game.scale.setGameSize(window.innerWidth, window.innerHeight)
    })
  
    function update() {
        
        if (cursors.left.isDown) {
            //  Move to the left
            player.body.force.x = (-150 * player_speed);
        }
        else if (cursors.right.isDown) {
          //  Move to the right
          player.body.force.x = (150 * player_speed);
        }
        
        //  Allow the player to jump if they are touching the ground.
        if (cursors.up.isDown && player.body.onGround) {
          player.body.velocity.y = -350;
        }
  
        if (keyInputStr && msg) {

            var input_update = {
                id: localPlayer.id,
                keys: keyInputStr,
                x: localPlayer.sprite.x,
                y: localPlayer.sprite.y,
                angle: localPlayer.sprite.angle
            }
            // console.log(keyInputStr + '(' + player.body.x + ',' + player.body.y + ')');
            // console.log(JSON.stringify(input_update));
            msg.client_sendDC('i', JSON.stringify(input_update));
        }
        else if (msg) {
            var input_update = {
                id: localPlayer.id,
                keys: null,
                x: localPlayer.sprite.x,
                y: localPlayer.sprite.y,
                angle: localPlayer.sprite.angle
            }
            // console.log(keyInputStr + '(' + player.body.x + ',' + player.body.y + ')');
            // console.log(JSON.stringify(input_update));
            msg.client_sendDC('i', JSON.stringify(input_update));
        }
    }
}

function addPlayerSprite() {
    var newPlayerSprite = game.add.sprite(getRandomInt(0,800), world_y-600, 'egg');
    newPlayerSprite.anchor.setTo(0.5, 0.5);
    //game.physics.p2.enable(newPlayerSprite, false);
    //newPlayerSprite.body.clearShapes();
    //newPlayerSprite.body.loadPolygon('eggPhysicsData', 'egg128');
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
