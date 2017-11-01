var config = new Config();

var socket; // WebSocket
var dc2;    // RTC DataChannel
var pc2;    // RTC Peer Connection
var msg;
var menuOpen = true;
var chatOpen = false;

// Phaser
var game;
var platforms;
var player;
var cursors;

var server_time;
var client_time;
var server_updates = [];  // log of server updates for interpolation
const net_offset = 100;  // ms behind server that we update data from the server
const buffer_size = 300; // seconds of server_updates to keep cached
const desired_server_fps = 60;  // desired server update rate, may vary and be much lower
var target_time = 0.01; // the time where we want to be in the server timeline
var client_smooth = 5;  //amount of smoothing to apply to client update dest  -1 disables smoothing. lower number adds more smoothing, useful if the server updates are lower FPS

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
  setupPhaserGame();
  keyboardSetup();
  pageSetup();
  setupSocketIO();
  if (config.wrtc) {
    console.log('setting up webrtc');
    setupWebRTC();
  }
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
      //updatePlayers(JSON.parse(result));
      consumePlayerUpdate(JSON.parse(result));
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
    else if (type == 'c') {
      console.log(data);
    } 
  }
}

function updateDCPing(delta) {
  // console.log('updateDCPing');
  $('#dc-ping').html('DC Ping: ' + delta + 'ms queue[' + pingsDC.length + ']');
}


function consumePlayerUpdate(serverUpdate) {
  //console.log('consuming player update from server');
  // cache the server update
  server_updates.push(serverUpdate);
  
   // console.log('server_updates length:' + server_updates.length);
    // save a cache of the server updates, but only a couple seconds worth
    if(server_updates.length > (desired_server_fps * buffer_size)) {
      server_updates.splice(0,1); // remove the oldest update
    }

    server_time  = serverUpdate.time;
}

//
// Update from server
//
function updatePlayers() {
  //console.log(localPlayer.id);
  //console.log(serverUpdate);
  //console.log('players update');

  // store the server time of this update, it's offset by latency in the network
  //console.log(serverUpdate.time);
  client_time = server_time - net_offset;

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
    //console.log('failed to find server timeline spot');
    target = server_updates[count];
    previous = server_updates[count];
  }


  if (target && previous) {

    target_time = target.time;

    var difference = target_time - current_time;
    var max_difference = (target.time - previous.time).toFixed(3);
    var time_point = (difference/max_difference).toFixed(3);

   // console.log('difference:' + difference + ', max_difference:' + max_difference + ', time_point:' + time_point)

  /*
  if( isNaN(time_point) )
    console.log('time error NaN');
  if(time_point == -Infinity)
    console.log('time error -infinity');
  if(time_point == Infinity)
    console.log('time error infinity');
  */

    if( isNaN(time_point) ) time_point = 0;
    if(time_point == -Infinity) time_point = 0;
    if(time_point == Infinity) time_point = 0;      


    // most recent server update
    var latest_server_data = server_updates[server_updates.length-1];

   // serverUpdate.player_update.forEach(function(sPlayer) {
      
   target.player_update.forEach(function(sPlayer) {
      if (sPlayer.id != localPlayer.id) {
        var player_found = false;
        players.forEach(function(player) {
          if (sPlayer.id == player.id) {
            // The server user may have a name assigned now, make sure we have it locally
            player.name = sPlayer.name;

            // The server user should have an egg color, update it locally
            if (player.egg_color != sPlayer.egg_color) {
              console.log('updating player(' + sPlayer.id + ') color: ' + sPlayer.egg_color);
              player.egg_color = sPlayer.egg_color;
              player.sprite.loadTexture(sPlayer.egg_color);
            }



            // save the serverPlayer we just found
            // var sPlayerIndex = serverUpdate.player_update.indexOf(sPlayer);
            // We found a player on the server that already exists on the server
            // we need to update its position

            var target_pos = {};
            var past_pos = {};
            var target_rotation;
            var past_rotation;
            
            // find the target position of each enemy player
            target.player_update.forEach(function(tPlayer) {
              if (player.id == tPlayer.id) {
                target_pos = { x: tPlayer.x, y: tPlayer.y };
                target_rotation = tPlayer.rotation; 
              }
            });

            previous.player_update.forEach(function(pPlayer) {
              if (player.id == pPlayer.id) {
                past_pos = { x:pPlayer.x, y:pPlayer.y };
                past_rotation = pPlayer.rotation;
              }
            });

            //console.log('past_angle:' + past_angle + ', target_angle:' + target_angle);

            //
            // interpolation
            //
            var ghost_pos = v_lerp(past_pos, target_pos, time_point);

            //console.log('time_point' + time_point);
            //console.log('past_angle:' + past_angle + ', target_angle:' + target_angle);

            ghost_rotation = interpolateAngle(past_rotation, target_rotation, time_point);
            //console.log('past_rotation:' + past_rotation + ', target_rotation:' + target_rotation + ', ghost_rotation:' + ghost_rotation);

           // console.log('past_angle:' + past_angle + ', target_angle:' + target_angle + ', ghost_angle:' + ghost_angle);            

            // update player position with interpolation and smoothing
            if (client_smooth == -1) {
              player.sprite.x = ghost_pos.x;
              player.sprite.y = ghost_pos.y;
              player.sprite.rotation = ghost_rotation;
            }
            // apply client smoothing. If the frame rate from the server is slow, this will interpolate extra frames
            else {
              var smooth_pos;
              var smooth_rotation;
        
              var tween_speed = (client_dpt  / 1000) * client_smooth;
              // console.log(tween_speed);
              var tween_speed_bound = (Math.max(0, Math.min(1,tween_speed))).toFixed(3);
              var current_pos = { x:player.sprite.world.x, y:player.sprite.world.y };

              // smooth the player position
              smooth_pos = v_lerp(current_pos, ghost_pos, tween_speed_bound);

              // smooth the player angle
              smooth_rotation = interpolateAngle(player.sprite.rotation, ghost_rotation, tween_speed_bound);
              // console.log('player.sprite.rotation: '  +player.sprite.rotation + ', ghost_rotation:' + ghost_rotation + ', smooth_rotation:' + smooth_rotation);


              // update player position and angle
              player.sprite.x = smooth_pos.x;
              player.sprite.y = smooth_pos.y;


              // use these to turn off smoothing
              // set server FPS to 5 or lower to see extreme lag results
              if (client_smooth == -1) {
              player.sprite.x = ghost_pos.x;
              player.sprite.y = ghost_pos.y;
              player.sprite.rotation = ghost_rotation;
              }
              else {
                if (smooth_rotation != undefined) {
                  //console.log('using smooth angle for smoothing');
                  player.sprite.rotation = smooth_rotation;
                  player.rotation = smooth_rotation;
                }
                // the egg starts at 0/undefined, this will catch the first movement when
                // the tween would fail
                else {
                // console.log('using ghost angle for smoothing');
                  player.sprite.rotation = ghost_rotation;
                  player.rotation = ghost_rotation;
                }
              }
            }

            // update the players name label location, we have to do this as a separate game
            // object otherwise it would rotate with the players egg
                    // update the position of the player's name label
            player.name_label.setText(player.name);
            player.name_label.x = player.sprite.x;
            player.name_label.y  = player.sprite.y + player.sprite.height/2 + 10;

            // updat the players dialog box location
            player.dialog_box.x = player.sprite.x;
            player.dialog_box.y  = player.sprite.y - player.sprite.height/2 - 10;            
            
            player_found = true;
          }
          
        });

        // Add new players
        if (!player_found) {
          console.log('adding remote player: color=' + sPlayer.egg_color);
          addNewPlayer(sPlayer.id, sPlayer.x, sPlayer.y, sPlayer.rotation, sPlayer.egg_color);
        }
      }
    });
  }

  removeMissingPlayers(target);
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
      players[index].dialog_box.destroy();
      players[index].name_label.destroy();
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
  var result = (a0 + short_angle_dist(a0,a1)*_t);
  if (isNaN(result)) {
    return 0;
  }
  else { 
    return Number(result);
  }
}

function interpolateAngle(fromAngle, toAngle, t) {

  var PI = Math.PI;
  var TWO_PI = Math.PI * 2;


  fromAngle = (fromAngle + TWO_PI) % TWO_PI;
  toAngle = (toAngle + TWO_PI) % TWO_PI;

  var diff = Math.abs(fromAngle - toAngle);
  if (diff < PI) {
      return lerp(fromAngle, toAngle, t);
  }
  else {
      if (fromAngle > toAngle) {
          fromAngle = fromAngle - TWO_PI;
          return lerp(fromAngle, toAngle, t);
          return from;
      }
      else if (toAngle > fromAngle) {
          toAngle = toAngle - TWO_PI;
          return lerp(fromAngle, toAngle, t);
          return from;
      }
  }
}

function degrees_to_radians(degrees)
{
  var pi = Math.PI;
  return degrees * (pi/180);
}

function radians_to_degrees(radians)
{
  var pi = Math.PI;
  return radians * (180/pi);
}


function addNewPlayer(id, x, y, rotation, egg_color) {
  var sprite = addPlayerSprite(egg_color);
  var newPlayer = new Player(sprite, id, null, x, y, rotation, egg_color);
  newPlayer.name_label =  newPlayer.name_label = game.add.text(100, 4500, 'baddy', { font: "16px Arial", fill: "#000000", align: "center", backgroundColor: "#FFFFFF"});
  newPlayer.name_label.anchor.set(0.5);
  newPlayer.name_label.alpha = 0.5;
  newPlayer.dialog_box = game.add.text(100, 4500, '', { font: "16px Arial", fill: "#000000", align: "center", backgroundColor: "#FFFFFF"});
  newPlayer.dialog_box.anchor.set(0.5);
  newPlayer.dialog_box.alpha = 0.5;  

  players.push(newPlayer);
}

//
// Leaderboard
//
function updateLeaderboard(playerList) {
  // console.log(playerList.length + ' players online');

  // update local copy of player name
  playerList.forEach(function(listPlayer) {
    players.forEach(function(player) { 
      if(listPlayer.id == player.id) {
        player.name = listPlayer.name;
      }
    });
  });

  // remove existing player list
  $(".leaderboard-user").remove();

  playerList.forEach(function(player) {
    if (player.name) {
      $('#leaderboard').append('<li class="leaderboard-user">' + player.name +'</li>');
    }
  });

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
  $('#user-id').focus();
  gameFocus = false;
  
  setTimeout(function() {
      $('#login').fadeIn(3000);
      $('#user-id').focus();
  }, 1000);

  $('#login-button').click(function() {
      login();
  });

  $('#refresh-button').click(function() {
    location.reload();
  });
}

function login() {
  if (localPlayer.name == '' && $('#user-id').text() != '') {
      var name = $('#user-id').text();
      localPlayer.name = name;
      localPlayer.name_label.setText(name);
      //localUser.ID = localUser.name + getRandomInt(1,100000);        
      socket.emit('data', 'n-' + localPlayer.id + '.' + localPlayer.name);
      $('#login').fadeOut(1000);
      gameFocus = true;
  }
}


//
// Keyboard menu setup
//
function keyboardSetup() {

  $(document).keypress(function(e) {
    console.log(e.keyCode);

    if ($('#user-id').is(':focus')) {
      if (e.keyCode == 13) {
          e.preventDefault();
          login();
      }
    }

    if (gameFocus) {
      if (e.keyCode == 96) {
        e.preventDefault();
        if (!chatOpen) {
            $('#chatinput').show();
            $('#msg-input').focus();
            $('#msg-input').val('');            
            chatOpen = true;
            gameFocus = false;
        }
        else {
            $('#chatinput').hide();
          chatOpen = false;
          gameFocus = true;
        }
      }
    }
    else if (chatOpen) {
      if (e.keyCode == 13) {
          e.preventDefault();

          // Send the message
          var msg = $('#msg-input').html();
          socket.emit('data', 'c-' + localPlayer.id + '.' + msg);
          $('#msg-input').html('');

          localPlayer.dialog_box.setText(msg);
          setTimeout(function() {
            localPlayer.dialog_box.setText('');
          }, chat_msg_life);
      }
      if (e.keyCode == 96) {
          $('#msg-input').val('');
          $('#chatinput').hide();
          chatOpen = false;
          gameFocus = true;
      }
    } 
  });

  if (gameFocus) {

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
    $('#login').hide(); // hide the login if it's showing
    $('#disconnect-notice').show();
    gameFocus = false;
  });

  socket.on('msg', function(data) {
        // console.log('msg received form server');
        console.log(data);
  });

  socket.on('data', function(data) {
    //console.log(data);
    handleWSMessage(data);
  });

  socket.on('wrtc_offer', function(data) {
      console.log('wrtc offer received from Server yah!');
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

function handleWSMessage(data) {
  var type = data.substring(0,1);
  var result = data.substring(2,data.length);
  consumeWSMessage(socket, type, result);
}

function consumeWSMessage(socket, type, result) {
  //console.log(result);
  // Websocket ping latency check from server
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
  // list of other players from server
  else if (type == 'l') {
    //console.log('player list received from server');
    updateLeaderboard(JSON.parse(result));
  }
  // player positions update from server
  else if (type == 'p') {
    //console.log('player positions update received from server');
    // only update if the local player and world are setup
    if (localPlayer.id != undefined)
      // updatePlayers(JSON.parse(result));
      consumePlayerUpdate(JSON.parse(result));
  }
  else if (type == 'c') {
    var r = result.split('.');
    var id = r[0];
    var message = r[1];
    // print the received message
    var name = id;

    if (id == localPlayer.id) {
      name = localPlayer.name;
    }

    players.forEach(function(player) {
      if (player.id == id) {
        name = player.name;

        // update the dialog box for the remote user that sent this meessage
        player.dialog_box.setText(message);        

        setTimeout(function() {
          player.dialog_box.setText('');
        }, chat_msg_life);
      }
    });


    var $item = $('<li>' + name + ':' + message +'</li>');
    $( '#chat').prepend($item);

    // remove the message after a bit
    setTimeout(function() {
        $item.toggle('drop').promise().done(function() {
           $item.remove();
       })
    }, chat_msg_life);

  }
}

function client_sendWS(type, data) {
  this.socket.emit('data', type + '-' + data);
}

function updateWSPing(delta) {
  // console.log('updateWSPing');
  $('#ws-ping').html('WS Ping: ' + delta  + 'ms queue[' + pingsWS.length + ']');    
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
    console.log('create_data_channel called');
    pc2.ondatachannel = function(event) {
      dc2 = event.channel;
      dc2.onopen = function() {
        console.log(" data channel open wither server");
        dc_open = true;
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
    console.log('pc2: set remote description');
    pc2.setRemoteDescription(
      new RTCSessionDescription(desc),
      create_answer,
      handle_error
    );
  }

  function create_answer() {
    console.log('pc2: create answer');
    pc2.createAnswer(
      set_pc2_local_description,
      handle_error
    );
  }

  function set_pc2_local_description(desc) {
    console.log('pc2: set local description');
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

if (config.wrtc) {
  setInterval(function() {
      if (dc_open) { 
        var id = uuidv1();
        var t = Date.now();
        // console.log(id + '.' + t);

        // send Data Channel ping
        pingsDC.push({ id: id, time: t });
        msg.client_sendDC('g', id + '.' + t);
      }
  }, 1000);
}

//
// WebSocket Ping
//
setInterval(function() {
  
    var id = uuidv1();
    var t = Date.now();
    //console.log(id + '.' + t);
  
    // send Data Channel ping
    pingsWS.push({ id: id, time: t });
    client_sendWS('w', id + '.' + t);
  
  }, 1000);
  