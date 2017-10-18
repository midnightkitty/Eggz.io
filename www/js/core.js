try {
    exports = module.exports;
    exports.Player = Player;
    exports.Messenger = Messenger;
 } catch (e) {}


class Player {
    constructor(sprite, id, isLocal) {
        this.sprite = sprite; // Phaser sprite
        this.id = id; // socket ID
        this.isLocal = isLocal;
    }
}

class Messenger {
    
    constructor(socket, dataChannel) {
        this.socketOn = true;
        this.dcOn = true;
        this.socket = socket;
        this.dc = dataChannel;
    }
    
    send(type, data) {
        console.log('messenger sending: ' + data);
        if (this.socketOn) {
            socket.emit('data', type + '-' + data);
        }
        if (this.dcOn) {
            dc.send(type + '-' + data);
        }
    }
    
    // l- player list
    // m - message
    handleMessage(data) {
        var type = data.substring(0,1);
        var result = data.substring(2,data.length);
        console.log('' + type + ':' + result);
    }
}