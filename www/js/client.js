var config = new Config();

var socket; // WebSocket
var dc2;    // RTC DataChannel
var pc2;    // RTC Peer Connection
var msg;

// Phaser
var game;
var platforms;
var player;
var cursors;

var server_time;
var client_time;
var server_updates = [];  // log of server updates for interpolation
const net_offset = 500;  // ms behind server that we update data from the server
const buffer_size = 50; // seconds of server_updates to keep cached
const desired_server_fps = 60;  // desired server update rate, may vary and be much lower
var target_time = 0.01; // the time where we want to be in the server timeline
var client_smooth = 1;  //amount of smoothing to apply to client update dest

var pingsDC = [];
var pingsWS = [];
var players = [];
var localPlayer = {};

// total world dimensions
const world_x = 5000; 
const world_y = 5000;

var player_speed = 2;

var keys = {};
var keyInputStr;

var tileLedge;

$(document).ready(function() {
  setupSocketIO();
  if (config.wrtc) {
    setupWebRTC();
  }
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

//
// Update from server
//
function updatePlayers(serverUpdate) {

  //console.log('players update');

  // store the server time of this update, it's offset by latency in the network
  //console.log(serverUpdate.time);
  server_time = serverUpdate.time; 
  client_time = server_time - net_offset;

  // cache the server update
  server_updates.push(serverUpdate);

  // save a cache of the server updates, but only a couple seconds worth
  if(server_updates.length > (desired_server_fps * buffer_size)) {
    server_updates.splice(0,1); // remove the oldest update
  }
  //console.log('server_update_cache_size: ' + server_updates.length);

  var current_time = client_time;
  var count = server_updates.length - 1;
  var target = null;
  var previous = null;

  // find the current time (client_time) in the timeline
  // of server updates
  for (var i = 0; i < count; ++i) {
    var point = server_updates[i];
    var next_point = server_updates[i+1];

    if (current_time > point.time && current_time < next_point.time) {
        target = next_point;
        previous = point;
        // console.log('current time found in server_updates timeline');
        break;
    }
  }

  // If no target is found,  store the last known server position and move there instead
  if(!target) {
    // console.log('failed to find server timeline spot');
    target = server_updates[0];
    previous = server_updates[0];
  }


  if (target && previous) {

    target_time = target.time;

    var difference = target_time - current_time;
    var max_difference = (target.time - previous.time).toFixed(3);
    var time_point = (difference/max_difference).toFixed(3);

    // most recent server update
    var latest_server_data = server_updates[server_updates.length-1];

    serverUpdate.player_update.forEach(function(sPlayer) {
      
      if (sPlayer.id != localPlayer.id) {
        var player_found = false;
        players.forEach(function(player) {
          if (sPlayer.id == player.id) {
            // save the serverPlayer we just found
            // var sPlayerIndex = serverUpdate.player_update.indexOf(sPlayer);
            // We found a player on the server that already exists on the server
            // we need to update its position

            var target_pos = {};
            var past_pos = {};
            var target_angle;
            var past_angle;
            
            // find the target position of each enemy player
            target.player_update.forEach(function(tPlayer) {
              if (player.id == tPlayer.id) {
                target_pos = { x: tPlayer.x, y: tPlayer.y };
                target_angle = tPlayer.angle; 
              }
            });

            previous.player_update.forEach(function(pPlayer) {
              if (player.id == pPlayer.id) {
                past_pos = { x:pPlayer.x, y:pPlayer.y };
                past_angle = pPlayer.angle;
              }
            });


            //
            // interpolation
            //
            var ghost_pos = v_lerp(past_pos, target_pos, time_point);

            //console.log('past_angle:' + past_angle + ', target_angle:' + target_angle);
            var ghost_angle = angle_lerp(past_angle, target_angle, time_point).toFixed(3);
            //console.log('ghost_angle:' + ghost_angle);

            var smooth_pos;
            var smooth_angle;

      
            var tween_speed = 1 - (client_dpt  / 1000);
            var tween_speed_bound = (Math.max(0, Math.min(1,tween_speed))).toFixed(3);
            //console.log('client_dpt:' + client_dpt);
            //console.log('tween_speed_bound:' + tween_speed_bound);


            //console.log('client_dpt:' + client_dpt);
            var current_pos = { x:player.sprite.world.x, y:player.sprite.world.y };
            //console.log(current_pos);
            smooth_pos = v_lerp(current_pos, ghost_pos, tween_speed_bound);
            //console.log(player.sprite.angle+=0);

            // update player position with interpolation and smoothing
            player.sprite.x = smooth_pos.x;
            player.sprite.y = smooth_pos.y;

            // update the player angle
            // smooth_angle = lerp(player.sprite.angle, ghost_angle, (client_dpt/1000) * client_smooth);

            if (target_angle !== undefined) {
              //console.log('player.sprite.angle:' + player.sprite.angle);
              //var test_smooth_angle = angle_lerp(player.sprite.angle, ghost_angle, (client_dpt/1000) * client_smooth);
              var test_smooth_angle = angle_lerp(player.sprite.angle, ghost_angle, tween_speed_bound);

              player.sprite.angle = ghost_angle;
              
              /*
              if (test_smooth_angle !== undefined && !isNaN(test_smooth_angle)) {
                //console.log('test_smooth_angle:' + test_smooth_angle);

                // ignore angle adjustments less than 3.5 to avoid fighting the physics engine in a loop
                //if (Math.abs(player.sprite.angle - target_angle) > 1) {
                //  player.sprite.angle = test_smooth_angle;
                //  console.log(test_smooth_angle);
                //}
              }
              else {
                console.log('ghost_angle:' + ghost_angle);
                player.sprite.angle = ghost_angle;
              }
              */
            }
            



            // update player position and angle with interpolation but no smoothing
            //player.sprite.x = ghost_pos.x;
            //player.sprite.y = ghost_pos.y;
            //player.sprite.angle = ghost_angle;

            // console.log('updating player position based on raw data');
            // update player position with raw data from the server, no interpolation or smoothing
            //player.sprite.x = sPlayer.x;
            //player.sprite.y = sPlayer.y;
            //player.sprite.angle = sPlayer.angle;
            

            player_found = true;
          }
        });

        // Add new players
        if (!player_found) {
          console.log('adding player');
          addNewPlayer(sPlayer.id, sPlayer.x, sPlayer.y)
        }
      }
    });
  }

  removeMissingPlayers(serverUpdate);
}

//
// Remove players on the client no longer found on the server
//
function removeMissingPlayers(serverUpdate) {

  players.forEach(function(client_player) {

    var found = false;
    // look for each user in the server update
    serverUpdate.player_update.forEach(function(sPlayer) {
      if (client_player.id == sPlayer.id) {
        found = true;
      }
    });

    // If we couldn't find the local player on the server update list
    // they must have dropped from the game, remove their player locally
    if (!found) {
      console.log('removing dropped other player');
      var index = players.indexOf(client_player);
      // remove the sprite from the phaser world
      players[index].sprite.destroy();
      // remove the player from the players list
      players.splice(index,1)
    }
  });
}

// linear interpolate
function lerp(p, n, t) {
  var _t = Number(t); 
  _t = (Math.max(0, Math.min(1, _t))).toFixed(3); 
  //console.log(_t);
  //console.log (p + '+' + _t + '* (' + n + '-' + p + ')))');
  var result = (p + _t * (n - p));
    //console.log((p + _t * (n - p)));
  if (isNaN(result))
    return 0;
  else
    return (p + _t * (n - p));
}

// Vector linear interpolate
function v_lerp(v, tv, t) { 
  //console.log('calculating v_lerp');
  return { x: this.lerp(v.x, tv.x, t), 
               y: this.lerp(v.y, tv.y, t) }; 
};

/*
2D Angle Interpolation (shortest distance)
Parameters:
a0 = start angle
a1 = end angle
t = interpolation factor (0.0=start, 1.0=end)
*/

function short_angle_dist(a0,a1) {
  var max = Math.PI*2;
  var da = (a1 - a0) % max;
  return 2*da % max - da;
}

function angle_lerp(a0,a1,t) {
  var _t = Number(t); 
  //_t = (Math.max(0, Math.min(1, _t))).toFixed(3); 
  var result = (a1 + short_angle_dist(a0,a1)*_t);
  if (isNaN(result)) 
    return 0;
  else 
    return Number(result);
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

  $('#login-button').click(function() {
      login();
  });
  */

  $('#refresh-button').click(function() {
    location.reload();
  });
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
  socket =  io({
    reconnection: false
  });

  socket.on('connect', function(data){
      console.log('connected to server web socket');
      // socket.emit('msg','client browser: sup server?');
  });

  socket.on('disconnect', function() {
    $('#disconnect-notice').show();
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
    console.log('cleanup');
    pc2.close();
    console.log('done');
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
  