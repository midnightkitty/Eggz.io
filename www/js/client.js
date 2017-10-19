var socket; // WebSocket
var dc2;    // RTC DataChannel
var pc2;    // RTC Peer Connection
var msg;

// Phaser
var game;
var platforms;
var player;
var cursors;

var players = [];

var localPlayer = {};

// total world dimensions
var world_x = 5000; 
var world_y = 5000;

var player_speed = 2;

var keys = {};
var keyInputStr;

$(document).ready(function() {
  setupSocketIO();
  setupWebRTC();
  setupPhaser();
  keyboardSetup();
  pageSetup();
});

//
//  ClientMessenger class
//
class ClientMessenger extends Messenger {
  constructor(socket, dataChannel) {
    super(socket,dataChannel);
  }

  // l- player list
  // m - message
  handleMessage(data) {
    var type = data.substring(0,1);
    var result = data.substring(2,data.length);
    //console.log('' + type + ':' + result);

    if (type == 'l') {
      updateLeaderboard(JSON.parse(result));
    }
  }
}


//
// Leaderboard
//
function updateLeaderboard(playerList) {
  // console.log(playerList.length + ' players online');

  if (playerList.length == 1) {
    $('#leaderboard-title').html(playerList.length + ' player online');
  }
  else {
    $('#leaderboard-title').html(playerList.length + ' players online');  
  }
}

//
//  Page HUD Setup
//
function pageSetup() {

  /*
  $('#user-id').focus();
  
      setTimeout(function() {
          $('#login').fadeIn(3000);
          $('#user-id').focus();
      }, 1000);
  
      $('#login-button').click(function () {
          login();
      });
      */
}


//
// Keyboard menu setup
//
function keyboardSetup() {

  $(document).keydown(function(e) {
    // console.log('key pressed:' + e.keyCode);
    keys[e.which] = true;
    makeInputStr();
  });

  $(document).keyup(function (e) {
    delete keys[e.which];
    makeInputStr();
  });
}

function makeInputStr() {
  var inputs = [];
  
  for (var i in keys) {
   if (!keys.hasOwnProperty(i)) continue;

   i = parseInt(i);

    switch(i) {
      case 37:
        inputs.push('l');
        break;
      case 39:
        inputs.push('r');
        break;
      case 38:
        inputs.push('u');
        break;
      case 40:
        inputs.push('d');
        break;
      case 32:
        inputs.push('s');
        break;
    }
  }
  keyInputStr = inputs.join('.');
}

//
// Phaser 
//
function setupPhaser() {
  game = new Phaser.Game(window.innerWidth, window.innerHeight, Phaser.AUTO, '', { preload: preload, create: create, update: update });

  function preload() {
    game.load.image('sky', 'assets/sky.png');
    game.load.image('ground', 'assets/platform.png');
    game.load.image('star', 'assets/star.png');
    game.load.spritesheet('dude', 'assets/dude.png', 32, 48);    
  }

  function create() {


    game.physics.startSystem(Phaser.Physics.ARCADE);
    var sky = game.add.sprite(0, 0, 'sky');
    sky.scale.setTo(9,9);

    //  The platforms group contains the ground and the 2 ledges we can jump on
    platforms = game.add.group();
    platforms.enableBody = true;

    var ground = platforms.create(0, 600, 'ground');
    ground.scale.setTo(5, 2.5);
    ground.body.immovable = true;


    var ledge = platforms.create(400, 400, 'ground');
    ledge.body.immovable = true;
    ledge = platforms.create(-150, 250, 'ground');
    ledge.body.immovable = true;

    // The player and its settings
    //player = game.add.sprite(32, game.world.height - 150, 'dude');
    player = game.add.sprite(32, 400, 'dude');

    //  We need to enable physics on the player
    game.physics.arcade.enable(player);

    //  Player physics properties. Give the little guy a slight bounce.
    player.body.bounce.y = 0.2;
    player.body.gravity.y = 300;
    player.body.collideWorldBounds = true;
    player.animations.add('left', [0, 1, 2, 3], 10, true);
    player.animations.add('right', [5, 6, 7, 8], 10, true);

    player.anchor.setTo(0.5, 0.5);

    game.world.setBounds(0,0,5000,5000);
    game.camera.follow(player, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1);

    //  Our controls.
    cursors = game.input.keyboard.createCursorKeys();

    //game.scale.setGameSize(window.innerWidth, window.innerHeight);
    //game.scale.setGameSize(800,600);
    //game.scale.refresh();

    game.stage.disableVisibilityChange = true;

    game.time.advancedTiming = true;

    // add local user to usrs list
    localPlayer = new Player(player,socket.id);

    game.time.events.loop(1000, updateStats, this);
  }

  function updateStats() {
    $('#stats').html('FPS:' + game.time.fps);
  }


  $(window).resize(function() {
    game.scale.setGameSize(window.innerWidth, window.innerHeight)
  })

  function update() {
      
      //  Collide the player and the stars with the platforms
      var hitPlatform = game.physics.arcade.collide(player, platforms);

      //  Reset the players velocity (movement)
      player.body.velocity.x = 0;
      
      if (cursors.left.isDown)
      {
          //  Move to the left
          player.body.velocity.x = -150 * player_speed;

          player.animations.play('left');
      }
      else if (cursors.right.isDown)
      {
          //  Move to the right
          player.body.velocity.x = 150 * player_speed;

          player.animations.play('right');
      }
      else
      {
          //  Stand still
          player.animations.stop();

          player.frame = 4;
      }
      
      //  Allow the player to jump if they are touching the ground.
      if (cursors.up.isDown && player.body.touching.down)
      {
          player.body.velocity.y = -350;
      }

      if (keyInputStr)
        msg.client_sendDC('i', keyInputStr);
  }
}

//
// Socket.io
//
function setupSocketIO() {
  socket = io();

  socket.on('connect', function(data){
      console.log('connected to server web socket');
      // socket.emit('msg','client browser: sup server?');
  });

  socket.on('msg', function(data) {
        // console.log('msg received form server');
        console.log(data);
  });

  socket.on('data', function(data) {
    msg.handleMessage(data);
  });

  socket.on('wrtc_offer', function(data) {
      // console.log('wrtc offer received from Server yah!');
      // console.log(data);
      desc = JSON.parse(data);
      set_pc2_remote_description(desc);
  });

  socket.on('candidate', function(data) {
    // console.log('ICE candidate received from server!');

    var candidate = new RTCIceCandidate(JSON.parse(data));
    if (candidate)
      pc2.addIceCandidate(candidate, handleAddIceCandidateSuccess, handleAddIceCandidateError);
  });

  socket.on('player_list', function(data) {
    //console.log('connected clients: ' + data);
  });
}

//
// WebRTC Data channel setup
//
function setupWebRTC() {

  pc2 = new RTCPeerConnection({ iceServers: [{url:'stun:stun.l.google.com:19302'}] },
                                                 { 'optional': [] } );

  pc2.onicecandidate = function(candidate) {
    //  console.log(JSON.stringify(candidate.candidate));
    // console.log('sending ICE candidate to server');
    socket.emit('candidate', JSON.stringify(candidate.candidate));

    if(!candidate.candidate) return;
    //  pc1.addIceCandidate(candidate.candidate);
  }
  pc2.onsignalingstatechange = function(event) {
    // console.info("signaling state change: ", event.target.signalingState);
  }
  pc2.oniceconnectionstatechange = function(event) {
   //  console.info("ice connection state change: ", event.target.iceConnectionState);
  }
  pc2.onicegatheringstatechange = function(event) {
    // console.info("ice gathering state change: ", event.target.iceGatheringState);
  }

  create_data_channels();
}

  function handleAddIceCandidateSuccess() {
   // console.log('add ice succeeded');
  }
    
  function handleAddIceCandidateError() {
    // console.log('add ice error');
  }  

  function handle_error(error) {
    throw error;
  }

  function create_data_channels() {
    pc2.ondatachannel = function(event) {
      dc2 = event.channel;
      dc2.onopen = function() {
        console.log(" data channel open wither server");
        dc2.send('creating ClientMessenger');
        msg = new ClientMessenger(socket, dc2);

        dc2.onmessage = function(event) {
          var data = event.data;
          // console.log("dc2: received '"+data+"'");
          msg.handleMessage(data);
        }
      };
    }
  }

  function set_pc2_remote_description(desc) {
   // console.log('pc2: set remote description');
    pc2.setRemoteDescription(
      new RTCSessionDescription(desc),
      create_answer,
      handle_error
    );
  }

  function create_answer() {
   // console.log('pc2: create answer');
    pc2.createAnswer(
      set_pc2_local_description,
      handle_error
    );
  }

  function set_pc2_local_description(desc) {
    // console.log('pc2: set local description');
    // console.log(JSON.stringify(desc));

    pc2.setLocalDescription(
      new RTCSessionDescription(desc),
      set_pc1.bind(undefined, desc),
      handle_error
    )
  }

  function set_pc1(desc) {
     // console.log('Sending server wrtc answer');
      socket.emit('wrtc_answer', JSON.stringify(desc));
  }

  function wait() {
    // console.log('waiting');
  }

  function done() {
  // console.log('cleanup');
  //  pc2.close();
  //  console.log('done');
  }

