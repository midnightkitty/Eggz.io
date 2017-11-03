var Config = require('./www/js/config.js').Config;
const config = new Config();
var express = require('express');
var app = express();
var port = 3000; // forwarded from port 80 on nginx 
var http = require('http').Server(app);
var io = require('socket.io')(http);
var webrtc = require('wrtc');
var util = require('util');

var Messenger = require('./www/js/core.js').Messenger;
var Player = require('./www/js/core.js').Player;
var msg = {}; // Messenger instance for server

var players = [];
const server_fps = 20; // server update frequency in updates / seconds
var delta; // time in ms between now and the last physics update

// webrtc aliases
var RTCPeerConnection      = webrtc.RTCPeerConnection;
var RTCSessionDescription = webrtc.RTCSessionDescription;
var RTCIceCandidate         = webrtc.RTCIceCandidate;

//
// Express Web Server
//
app.get('/', function(req, res){
    res.sendFile(__dirname + '/www/index.html');
});   

app.get('/particle-example.html', function(req, res){
  res.sendFile(__dirname + '/www/particle-example.html');
});   
      
        
// static routing for all files in /js
app.use('/js', express.static('www/js'));   

// static routing for all files in /assets
app.use('/assets', express.static('www/assets'));   


http.listen(port, function(){
    console.log('Server websocket listening on *:' + port);
});

//
//  WebSocket
//
io.on('connection', function(socket) {
  console.log('a user connected via webSocket');
  players.push(new Player(null, socket.id, socket, 0, 0));
  //clients.push(socket);

  // making new peer connection

  if (config.wrtc) {
    console.log('making new peer connection');
    socket.pc = new PeerConnection(socket.id);
    socket.pc.openNewDataChannel();
  }

  socket.on('disconnect', function(){
      console.log('user disconnected');

      for(var player of players) {
        if (socket.id == player.id) {
          players.splice(players.indexOf(player), 1);
        }
      }

      // clients.splice(clients.indexOf(socket), 1);
  });

  socket.on('wrtc_answer', function(data) {
      // console.log('wrtc answer received from client');
      desc = JSON.parse(data);
      socket.pc.set_pc1_remote_description(desc);        
      //console.log(data);
  });

  socket.on('msg', function (data) {
      console.log(data);
      socket.emit('msg',data);
  });
  
  socket.on('data', function(data) {
    handleClientWSMessage(socket, data);
  })

  socket.on('candidate', function(data) {
      // console.log('candidate received from client');

      var candidate = new RTCIceCandidate(JSON.parse(data));
      if (candidate)
          socket.pc.pc1.addIceCandidate(candidate, socket.pc.handleAddIceCandidateSuccess, socket.pc.handleAddIceCandidateError);

  });
});  

//
// Server Messenger
//
class ServerMessenger extends Messenger {
  constructor() {
    super();
  }

  consumeMessage(type, data) {
    // console.log('consuming this action');
    super.consumeMessage(type, data);
  }
}

function handleClientWSMessage(socket, data) {
  var type = data.substring(0,1);
  var result = data.substring(2,data.length);
  consumeWSMessage(socket, type, result);
}

function consumeWSMessage(socket, type, result) {
  // console.log(result);
  if (type == 'w') {
    var r = result.split('.');
    var id = r[0];
    var t_sent = parseInt(r[1]);

    var t_rec = parseInt(Date.now());
    //console.log('sending WS ping back to client');
    socket.emit('data', 'w-' + id + '.' + t_rec);
  }
  else if (type == 'i') {
    //console.log('client input received');
    var input = JSON.parse(result);

    // update player position
    players.forEach(function(player)  {
      if (player.id == input.id) {
        player.x = input.x;
        player.y = input.y;
        player.rotation = input.rotation;
        player.egg_color = input.egg_color; // need to move this to server side only updates
        //console.log(player);
      }
    });
  }
  // Relay chat message to all clients
  else if (type == 'c') {
    console.log(result);
    // broadcast the chat message to all sockets
    io.emit('data','c-' + result);
  }
  // Assign user name to socket
  else if (type == 'n') {
    var r = result.split('.');
    var id = r[0];
    var name = r[1];
    console.log(result);

    // set the name for this player's socket ID
    players.forEach(function(player) {
      if (player.id == id) {
        player.name = name;
        // console.log('name assigned to:' + player.id);
      }
    });
  }
}


function handleClientDCMessage(dc1, data) {
  var type = data.substring(0,1);
  var result = data.substring(2,data.length);
  consumeDCMessage(dc1, type, result);
}

function consumeDCMessage(dc1, type, result) {
 //console.log(type + ' ' + result);
  if (type == 'i') {
    //console.log('client input received');
    var input = JSON.parse(result);

    // update player position
    players.forEach(function(player)  {
      if (player.id == input.id) {
        player.x = input.x;
        player.y = input.y;
        player.rotation = input.rotation;
        player.egg_color = input.egg_color; // need to move this to a server side only update
        //console.log(player);
      }
    });
  }
  // ping from Data Channel
  // format: id.timestamp
  // 265b8d00-b809-11e7-8cda-4964e5318dbc.1508773509584
  else if (type == 'g') {
    var r = result.split('.');
    var id = r[0];
    var t_sent = parseInt(r[1]);

    //console.log(id + " : " + t_sent);

    //var t_sent = r.time;
    var t_rec = parseInt(Date.now());
    
    //console.log(t_rec + ',' + t_sent);
    //console.log('UDP Ping took: ' + ((t_rec-t_sent)/1000) + 's');
    dc1.send('g-' + id + '.' + t_rec);


  }
}

class PeerConnection {

  constructor(socketid) {

    this.socketid = socketid;
    this.dc1 = null;
    // io.to(this.socketid).emit('msg','lets get loco!!!');
    // console.log('making new RTCPeerConnection')
    this.pc1 = new RTCPeerConnection(
      {
        audioDeviceModule: 'fake',
        iceServers: [{url:'stun:stun.l.google.com:19302'}]
      },
      {
        'optional':  [{DtlsSrtpKeyAgreement: false}]
      }
    );

    this.pc1.onicecandidate = function(candidate) {
      if(!candidate.candidate) return;

      // console.log('candidate to send to client found');
      io.to(this.socketid).emit('candidate', JSON.stringify(candidate.candidate));
      //pc2.addIceCandidate(candidate.candidate);
    }.bind(this);
  }

  send(data) {
    this.dc1.send(data);
  }

  handleAddIceCandidateSuccess() {
   // console.log('add ice succeeded');
  }
    
  handleAddIceCandidateError() {
   // console.log('add ice error');
  }  


  
  handle_error(error) {
    console.log(error);
    throw error;
  }
  
  create_data_channels(socketid) {
    console.log('calling createDataChannel');

    this.dc1 = this.pc1.createDataChannel(socketid, { reliable: false,
                                                                            ordered: false,
                                                                            maxRetransmits: 0,
                                                                            maxPacketLifeTime: 0
                                                                           });
    this.dc1.onopen = function() {
      console.log("data channel open with user");
      this.dc1.onmessage = function(event) {
        var data = event.data;
        //console.log(data);
        // console.log("dc1: sending 'pong'");
        // dc1.send("echo from data channel");
        this.handleDCMsg(this.dc1,data);
        // io.to(this.socketid).emit('msg','sending message over data channel');        
      }.bind(this);  
    }.bind(this);
    this.create_offer();
  }

  handleDCMsg(dc1, data) {
    handleClientDCMessage(dc1, data);
  }
  
  create_offer() {
     console.log('pc1: create offer');
    var obj = this;
    this.pc1.createOffer((obj.set_pc1_local_description).bind(this), this.handle_error);
  }
  
  set_pc1_local_description(desc) {
    //console.log('pc1: set local description');
    //console.log(JSON.stringify(desc));
    //console.log('Sending client wrtc offer');
    io.to(this.socketid).emit('wrtc_offer',JSON.stringify(desc));

    this.pc1.setLocalDescription(
      new RTCSessionDescription(desc),
      // set_pc2_remote_description.bind(undefined, desc),
      this.set_pc2.bind(undefined, desc),
      this.handle_error
    ); 
  }
  
  set_pc1_remote_description(desc) {
    // console.log('pc1: set remote description called');
    
    this.pc1.setRemoteDescription(
      new RTCSessionDescription(desc),
      this.wait,
      this.handle_error
    );
  }
  
  set_pc2() { }
  wait() { 
    // console.log('awaiting data channels'); 
  }
   
  openNewDataChannel(socketid) {
    this.create_data_channels(socketid);
  }
  
  done() {
    // console.log('cleanup');
    this.pc1.close(); 
    // console.log('done');
  }
}

setInterval(function() { 

  if (players) {
    var player_list = [];
    players.forEach(function(player) {

      player_list.push({
        id: player.id,
        name: player.name
      });  
    }, this);
    console.log('conected client websockets: ' + JSON.stringify(player_list));
    //io.emit('player_list', JSON.stringify(player_list));
    //io.emit('data','l-' + JSON.stringify(player_list));

    // send player list to all players
    if (config.wrtc) {
      players.forEach(function(player)  {
        player.socket.pc.send('l-' + JSON.stringify(player_list));
      });
    }
    else {
      io.emit('data','l-' + JSON.stringify(player_list));
    }

  }
}, 10000);

/**
Length of a tick in milliseconds. The denominator is your desired framerate.
e.g. 1000 / 20 = 20 fps,  1000 / 60 = 60 fps
*/
var tickLengthMs = 1000 / server_fps;

/* gameLoop related variables */
// timestamp of each loop
var previousTick = Date.now();
// number of times gameLoop gets called
var actualTicks = 0;

function gameLoop() {
  var now = Date.now();

  actualTicks++;
  if (previousTick + tickLengthMs <= now) {
    delta = (now - previousTick) / 1000;
    previousTick = now;

    update(delta);

    //console.log('delta', delta, '(target: ' + tickLengthMs +' ms)', 'node ticks', actualTicks);
    actualTicks = 0;
  }

  if (Date.now() - previousTick < tickLengthMs - 16) {
    setTimeout(gameLoop);
  } else {
    setImmediate(gameLoop);
  }
}


/**
Update is normally where all of the logic would go. In this case we simply call
a function that takes 10 milliseconds to complete thus simulating that our game
had a very busy time.
*/
function update(delta) {
  //console.log('tick: ' + delta);


  collisionsUpdate();

  var serverUpdate = {
    time: Date.now(),
    player_update: []
  }


  players.forEach(function(player)  {
    var p = {};
    p.id = player.id;
    p.name = player.name;
    p.x = player.x;
    p.y = player.y;
    p.rotation = player.rotation;
    p.egg_color = player.egg_color;
    p.belt_color = player.belt_color;
    serverUpdate.player_update.push(p);
  });
  //console.log('sending update');
  //console.log(player_update);

  if (config.wrtc) {
    players.forEach(function(player)  {
      player.socket.pc.send('p-' + JSON.stringify(serverUpdate));
    });
  }
  // update players over web sockets
  else {
    io.emit('data', 'p-' + JSON.stringify(serverUpdate));
  }


 // aVerySlowFunction(10);
}

/**
A function that wastes time, and occupies 100% CPU while doing so.
Suggested use: simulating that a complex calculation took time to complete.
*/
function aVerySlowFunction(milliseconds) {
  // waste time
  var start = Date.now();
  while (Date.now() < start + milliseconds) { 

  }  
}

function collisionsUpdate() {

  players.forEach(function(player) {

    // player has entered the nest
    if (player.x > 1200 && player.y < 3650) {
      if(player.canLevelUp) {
        //console.log('player leveled up');
        player.canLevelUp = false;

        console.log('leveling up ' + player.name + ': ' + config.ninja_belts[config.ninja_belts.indexOf(player.belt_color) + 1]);

        // update the player's belt color
        player.belt_color =  config.ninja_belts[config.ninja_belts.indexOf(player.belt_color) + 1];

        //console.log(player.belt_color);
      }
    }

    // player has hit the pillow
    if (!player.canLevelUp && player.x < 1000 && player.y > 4400) {
        // make sure the player isn't already leveld up all the way
        if (config.ninja_belts.indexOf(player.belt_color) < (config.ninja_belts.length - 1)) {
        console.log('player can level up again');
        player.canLevelUp = true;
        }
    }
  })
}


// begin the loop !
gameLoop();