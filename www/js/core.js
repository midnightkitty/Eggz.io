// code shared by the server and client

class Player {
    constructor(sprite, id) {
        this.sprite = sprite; // Phaser sprite
        this.id = id; // socket ID
    }
}

class Messenger {
    
    constructor(socket, dataChannel) {
        this.socket = socket;
        this.dc = dataChannel;
    }
    
    client_sendDC(type, data) {
        console.log(type + '-' + data);
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
        console.log(type + ':' + result);
        this.consumeMessage(type, result);
    }

    consumeMessage(type, result) {
        //
    }
}

// Try will fail when included by the client browser
try {
    module.exports = {
        Player,
        Messenger
    }
} catch(e) { }
