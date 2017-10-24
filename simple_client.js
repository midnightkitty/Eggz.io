var io = require('socket.io-client');
var socket = io('http://localhost:3099');


socket.on('connect', function(socket) {
    console.log('connected to server web socket');
});

socket.on('msg', function(data) {
    console.log(data);
});

socket.on('wrtc_offer', function(data) {
    console.log('wrtc offer received from Server');
    console.log(data);
    desc = JSON.parse(data);
    set_pc2_remote_description(desc);
});


// socket.emit('msg','client: sup server?');


var webrtc = require('wrtc');
var prompt = require('prompt');
prompt.start();

var RTCPeerConnection     = webrtc.RTCPeerConnection;
var RTCSessionDescription = webrtc.RTCSessionDescription;
var RTCIceCandidate       = webrtc.RTCIceCandidate;

var pc2 = new RTCPeerConnection();



pc2.onicecandidate = function(candidate) {
    //  console.log(JSON.stringify(candidate.candidate));
    // console.log('sending candidate to server');
    socket.emit('candidate', JSON.stringify(candidate.candidate));

    if(!candidate.candidate) return;
    //  pc1.addIceCandidate(candidate.candidate);
}

function handle_error(error)
{
  throw error;
}

var checks = 0;
var expected = 10;

function create_data_channels() {

  var dc2;
  pc2.ondatachannel = function(event) {
    dc2 = event.channel;
    dc2.onopen = function() {
      console.log(" data channel open wither server");
      dc2.onmessage = function(event) {
        var data = event.data;
        console.log("dc2: received '"+data+"'");
        if(++checks == expected) {
          done();
        } else {
          console.log("dc2: sending 'ping'");
          dc2.send("ping");
        }
      }
      console.log("dc2: sending 'ping'");
      dc2.send("ping");
    };
  }
}

/*

var desc;

prompt.get('desc', function(err, result) {
    // console.log(result.desc);
    desc = JSON.parse(result.desc);
    set_pc2_remote_description(desc);
    
});

*/

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
  console.log('cleanup');
  pc2.close();
  console.log('done');
}

run();

