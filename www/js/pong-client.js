var socket;
var dc2;



$(document).keypress(function(e) {
  console.log('key pressed:' + e.keyCode);
  if (e.keyCode == 49) {
    console.log('sending websocket message');
    socket.emit('msg','test websocket message from client');
  }
  if (e.keyCode == 50) {
    console.log('sending dataChannel message');
    dc2.send('test dataChannel message from client');
  }
});


$(document).ready(function() {

  socket = io();

  socket.on('connect', function(data){
    console.log('connected to server web socket');
    // socket.emit('msg','client browser: sup server?');
  });

  socket.on('msg', function(data) {
      console.log('msg received form server');
      console.log(data);
  });

socket.on('wrtc_offer', function(data) {
    console.log('wrtc offer received from Server yah!');
    // console.log(data);
    desc = JSON.parse(data);
    set_pc2_remote_description(desc);
});

socket.on('candidate', function(data) {
  console.log('ICE candidate received from server!');

  var candidate = new RTCIceCandidate(JSON.parse(data));
  if (candidate)
    pc2.addIceCandidate(candidate, handleAddIceCandidateSuccess, handleAddIceCandidateError);
});

socket.on('player_list', function(data) {
  console.log('connected clients: ' + data);
});

var pc2 = new RTCPeerConnection(
  {
    iceServers: [{url:'stun:stun.l.google.com:19302'}]
  },
  {
    'optional': []
  }
);


  pc2.onicecandidate = function(candidate) {
    //  console.log(JSON.stringify(candidate.candidate));
    console.log('sending ICE candidate to server');
    socket.emit('candidate', JSON.stringify(candidate.candidate));

    if(!candidate.candidate) return;
    //  pc1.addIceCandidate(candidate.candidate);
  }
  pc2.onsignalingstatechange = function(event) {
    console.info("signaling state change: ", event.target.signalingState);
  }
  pc2.oniceconnectionstatechange = function(event) {
    console.info("ice connection state change: ", event.target.iceConnectionState);
  }
  pc2.onicegatheringstatechange = function(event) {
    console.info("ice gathering state change: ", event.target.iceGatheringState);
  }

  function handleAddIceCandidateSuccess() {
    console.log('add ice succeeded');
  }
    
  function handleAddIceCandidateError() {
    console.log('add ice error');
  }  


  function handle_error(error) {
    throw error;
  }

  var checks = 0;
  var expected = 10;


  function create_data_channels() {



    pc2.ondatachannel = function(event) {
      dc2 = event.channel;
      dc2.onopen = function() {
        console.log(" data channel open wither server");
        dc2.onmessage = function(event) {
          var data = event.data;
          console.log("dc2: received '"+data+"'");
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
      console.log('Sending server wrtc answer');
      socket.emit('wrtc_answer', JSON.stringify(desc));
  }

  function wait() {
    console.log('waiting');
  }

  function run() {
    create_data_channels();
  }

  function done() {
//    console.log('cleanup');
//    pc2.close();
//     console.log('done');
  }

  run();

});