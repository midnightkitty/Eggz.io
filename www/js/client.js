var socket; // WebSocket
var dc2;    // RTC DataChannel
var pc2;    // RTC Peer Connection
var msg;

// Phaser
var game;
var platforms;
var player;
var cursors;

var pingsDC = [];
var pingsWS = [];
var players = [];
var localPlayer = {};

// total world dimensions
var world_x = 5000; 
var world_y = 5000;

var player_speed = 2;

var keys = {};
var keyInputStr;

var tileLedge;

$(document).ready(function() {
  setupSocketIO();
  setupWebRTC();
  setupPhaserGame();
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
  // p - player positions
  handleMessage(data) {
    var type = data.substring(0,1);
    var result = data.substring(2,data.length);
    // console.log('' + type + ':' + result);

    // leaderboard update
    if (type == 'l') { 
      updateLeaderboard(JSON.parse(result));
    } // Other player position updates
    else if (type == 'p') {
      // console.log('player posiitons update');
      // console.log(JSON.parse(result));
      updatePlayers(JSON.parse(result));
    } // Data Channel ping
    else if (type == 'g') {
      var r = result.split('.');
      var id = r[0];
      var time = r[1];
      
      pingsDC.forEach(function(ping) {
        if (ping.id == id) {
          var t_sent = parseInt(ping.time);
          var t_rec = parseInt(Date.now());
          var delta = t_rec - t_sent;
          // console.log('DC Ping roundtrip took: ' + delta + 's');
          pingsDC.splice(pingsDC.indexOf(ping), 1);
          updateDCPing(delta);
        }
      });
    } 
  }
}

function updateDCPing(delta) {

  // console.log('updateDCPing');
  $('#dc-ping').html('DC Ping: ' + delta + 'ms queue[' + pingsDC.length + ']');

}

function updatePlayers(serverPlayers) {
  serverPlayers.forEach(function(sPlayer) {
    
    if (sPlayer.id != localPlayer.id) {
      var player_found = false;
      players.forEach(function(player) {
        if (sPlayer.id == player.id) {
          // console.log('player found, updating');
          player.x = sPlayer.x;
          player.y = sPlayer.y;

          player.sprite.x = sPlayer.x;
          player.sprite.y = sPlayer.y;
          player.sprite.angle = sPlayer.angle;
          player_found = true;
        }
      });

      if (!player_found) {
        console.log('adding player');
        addNewPlayer(sPlayer.id, sPlayer.x, sPlayer.y)
      }
    }
  });
}

function addNewPlayer(id, x, y) {
  var sprite = addPlayerSprite();
  var newPlayer = new Player(sprite, id, null, x, y);
  players.push(newPlayer);
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

  $(document).keypress(function(e) {
    //console.log(e.keyCode);
    if (e.keyCode == 48) {
      addPlayerSprite();
    }
  });


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
    //console.log(data);
    msg.handleWSMessage(data);
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


//
// DataChannel Ping
//
setInterval(function() {

  var id = uuidv1();
  var t = Date.now();
  // console.log(id + '.' + t);

  // send Data Channel ping
  pingsDC.push({ id: id, time: t });
  msg.client_sendDC('g', id + '.' + t);

}, 2000);


//
// WebSocket Ping
//
setInterval(function() {
  
    var id = uuidv1();
    var t = Date.now();
    // console.log(id + '.' + t);
  
    // send Data Channel ping
    pingsWS.push({ id: id, time: t });
    msg.client_sendWS('w', id + '.' + t);
  
  }, 2000);
  