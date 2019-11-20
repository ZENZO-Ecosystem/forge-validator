const superagent = require('superagent');
const express = require('express');
const bodyParser = require('body-parser');

/* ------------------ NETWORK ------------------ */
// The list of all known peers
let peers = [];

// Setup Express server
let app = express();
app.use(bodyParser.json())

class Peer {
    constructor (host) {
        this.host = "http://" + host; // The host (http URL) of the peer
        this.lastPing = 0; // The timestamp of the last succesful ping to this peer
        this.index = ((peers.length != 0) ? peers[peers.length - 1].index + 1 : 1); // The order in which we connected to this peer
        this.stale = false; // A peer is stale if they do not respond to our requests
    }

    isStale () {
        return this.stale;
    }

    setStale (bool) {
        this.stale = bool;
    }

    connect () {
        return superagent
        .post(host + "/ping")
        .send("ping!")
        .then((res) => {
            // Peer responded, add it to our list
            this.lastPing = Date.now();
            this.setStale(false);
            peers.push(this);
            console.info(`Peer "${host}" (${this.index}) responded to ping, appended to peers list!`);
        })
        .catch((err) => {
            // Peer didn't respond, don't add to peers list
            this.setStale(true);
            console.warn(`Unable to ping peer "${host}" --> ${err.message}`);
        })
    }

    ping () {
        return superagent
        .post(host + "/ping")
        .send("ping!")
        .then((res) => {
            this.lastPing = Date.now();
            this.setStale(false);
            console.info(`Peer "${host}" (${this.index}) responded to ping.`);
        })
        .catch((err) => {
            // Peer didn't respond, mark as stale
            this.setStale(true);
            console.warn(`Unable to ping peer "${host}" --> ${err.message}`);
        })
    }
}


/* Express Endpoints */
// Ping
// An easy way to check if a node is online and responsive
app.post('/ping', (req, res) => {
    res.send("Pong!");
});


/* Core Node Mechanics */
// First! Let's bootstrap the validator with seednodes
const seednodes = [];
for(let i=0; i<seednodes.length; i++) {
    let seednode = new Peer(seednodes[i]);
    seednode.connect();
}

// Second, start the "peer janitor" loop to clean out stale peers and ping our active peers at regular intervals.
let peerJanitor = setInterval(function(){
    peers.forEach(peer => {
        peer.ping();
    });
}, 15000);