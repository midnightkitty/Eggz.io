var express = require('express');
var app = express();
//var port = process.env.PORT || 3097; // AWS will default to port 80, locally port 3000
var port = 8081;
var http = require('http').Server(app);
var io = require('socket.io')(http);
var webrtc = require('wrtc');

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

http.listen(port, function(){
    console.log('Server websocket listening on *:' + port);
});

//
//  WebSocket
//
io.on('connection', function(socket) {
  console.log('a user connected via webSocket');

  // making new peer connection
  console.log('making new peer connection');
  socket.pc = new PeerConnection(socket.id);
  socket.pc.openNewDataChannel();

  socket.on('disconnect', function(){
      console.log('user disconnected');
  });

  socket.on('wrtc_answer', function(data) {
      console.log('wrtc answer received from client');
      desc = JSON.parse(data);
      socket.pc.set_pc1_remote_description(desc);        
      //console.log(data);
  });

  socket.on('msg', function (data) {
      console.log(data);
      socket.emit('msg','echo from websocket');
  });    

  socket.on('candidate', function(data) {
      // console.log('candidate received from client');

      var candidate = new RTCIceCandidate(JSON.parse(data));
      if (candidate)
          socket.pc.pc1.addIceCandidate(candidate, socket.pc.handleAddIceCandidateSuccess, socket.pc.handleAddIceCandidateError);

  });
});  

class PeerConnection {

  constructor(socketid) {
    this.socketid = socketid;

    console.log('making new RTCPeerConnection')
    this.pc1 = new RTCPeerConnection(
      {
        iceServers: [{url:'stun:stun.l.google.com:19302'}]
      },
      {
        'optional': []
      }
    );

    this.pc1.onicecandidate = function(candidate) {
      //  console.log(candidate);
      if(!candidate.candidate) return;
      //pc2.addIceCandidate(candidate.candidate);
    }
  }

  handleAddIceCandidateSuccess() {
    console.log('add ice succeeded');
  }
    
  handleAddIceCandidateError() {
    console.log('add ice error');
  }  


  
  handle_error(error) {
    console.log(error);
    throw error;
  }
  
  create_data_channels(socketid) {
    console.log('calling createDataChannel');
    var dc1 = this.pc1.createDataChannel(socketid);

    dc1.onopen = function() {
      console.log("data channel open with user");
      dc1.onmessage = function(event) {
        var data = event.data;
        console.log(data);
        //console.log("dc1: sending 'pong'");
        dc1.send("echo from data channel");
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
    console.log('pc1: set remote description called');
    
    this.pc1.setRemoteDescription(
      new RTCSessionDescription(desc),
      this.wait,
      this.handle_error
    );
  }
  
  set_pc2() { }
  wait() { }
  
  openNewDataChannel(socketid) {
    this.create_data_channels(socketid);
  }
  
  done() {
    console.log('cleanup');
    this.pc1.close();
    console.log('done');
  }
}







