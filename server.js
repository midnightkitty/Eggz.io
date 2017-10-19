var express = require('express');
var app = express();
var port = process.env.PORT || 8081; 
var http = require('http').Server(app);
var io = require('socket.io')(http);
var webrtc = require('wrtc');

var Messenger = require('./www/js/core.js').Messenger;
var msg = {}; // Messenger instance for server

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

var clients = [];

io.on('connection', function(socket) {
  console.log('a user connected via webSocket');
  clients.push(socket);

  // making new peer connection
  // console.log('making new peer connection');
  socket.pc = new PeerConnection(socket.id);
  socket.pc.openNewDataChannel();

  socket.on('disconnect', function(){
      console.log('user disconnected');
      clients.splice(clients.indexOf(socket), 1);
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
    msg.handleMessage(data);
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

msg = new ServerMessenger();

class PeerConnection {

  constructor(socketid) {
    this.socketid = socketid;
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
    // console.log('calling createDataChannel');
    var dc1 = this.pc1.createDataChannel(socketid);

    dc1.onopen = function() {
      console.log("data channel open with user");
      dc1.onmessage = function(event) {
        var data = event.data;
        //console.log(data);
        // console.log("dc1: sending 'pong'");
        // dc1.send("echo from data channel");
        msg.handleMessage(data);
        // io.to(this.socketid).emit('msg','sending message over data channel');        
      }  
    }
    this.create_offer();
  }
  
  create_offer() {
    // console.log('pc1: create offer');
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

  if (clients) {
    var player_list = [];
    clients.forEach(function(client) {

      player_list.push({
        client: client.id
      });
    }, this);
    console.log('conected client websockets: ' + JSON.stringify(player_list));
    io.emit('player_list', JSON.stringify(player_list));
    io.emit('data','l-' + JSON.stringify(player_list));

  }
}, 3000);







