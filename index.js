const superagent = require('superagent');
const express = require('express');
const bodyParser = require('body-parser');

/* ------------------ NETWORK ------------------ */
// The list of all known peers
let peers = [];

// Get a peer object from our list by it's host or index
function getPeer (peerArg) {
    for(let i=0; i<peers.length; i++) {
        if (peers[i].host === peerArg || peers[i].index === peerArg) return peers[i];
    }
    return null;
}

// Updates the contents of a peer object
function updatePeer (peerArg) {
    for(let i=0; i<peers.length; i++) {
        if (peers[i].host === peerArg.host || peers[i].index === peerArg.index) {
            peers[i] = peerArg;
            return true;
        }
    }
    return false;
}

// Setup Express server
let app = express();
app.use(bodyParser.json());

// Cleanse the IP of unimportant stuff
function cleanIP (ip) {
    return ip.replace(/::ffff:/g, "");
}

class Peer {
    constructor (host) {
        this.host = "http://" + host; // The host (http URL) of the peer
        this.lastPing = 0; // The timestamp of the last succesful ping to this peer
        this.index = ((peers.length != 0) ? peers[peers.length - 1].index + 1 : 0); // The order in which we connected to this peer
        this.stale = false; // A peer is stale if they do not respond to our requests
    }

    isStale () {
        return this.stale;
    }

    setStale (bool) {
        this.stale = bool;
    }

    connect (shouldPing) {
        if (getPeer(this.host) === null) {
            if (!shouldPing) {
                peers.push(this);
                return console.info(`Peer "${this.host}" (${this.index}) appended to peers list!`);
            } else {
                return superagent
                .post(this.host + "/ping")
                .send("ping!")
                .then((res) => {
                    // Peer responded, add it to our list
                    this.lastPing = Date.now();
                    this.setStale(false);
                    peers.push(this);
                    console.info(`Peer "${this.host}" (${this.index}) responded to ping, appended to peers list!`);
                })
                .catch((err) => {
                    // Peer didn't respond, don't add to peers list
                    this.setStale(true);
                    console.warn(`Unable to ping peer "${this.host}" --> ${err.message}`);
                });
            }
        }
    }

    ping () {
        return superagent
        .post(this.host + "/ping")
        .send("ping!")
        .then((res) => {
            this.lastPing = Date.now();
            this.setStale(false);
            console.info(`Peer "${this.host}" (${this.index}) responded to ping.`);
        })
        .catch((err) => {
            // Peer didn't respond, mark as stale
            this.setStale(true);
            console.warn(`Unable to ping peer "${this.host}" --> ${err.message}`);
        });
    }
}


/* Express Endpoints */
// Ping
// An easy way to check if a node is online and responsive
app.post('/ping', (req, res) => {
    let ip = cleanIP(req.ip);
    req.peer = getPeer("http://" + ip);
    if (req.peer !== null) {
        req.peer = getPeer("http://" + ip);
        req.peer.setStale(false);
        req.peer.lastPing = Date.now();
        updatePeer(req.peer);
    } else {
        req.peer = new Peer(ip);
        req.peer.lastPing = Date.now();
        req.peer.connect(false);
    }
    console.info('Received ping from "' + ip + '" (' + req.peer.index + ')');
    
    res.send("Pong!");
});

app.listen(80);


/* Core Node Mechanics */
// First! Let's bootstrap the validator with seednodes
const seednodes = ["45.12.32.114"];
for(let i=0; i<seednodes.length; i++) {
    let seednode = new Peer(seednodes[i]);
    seednode.connect(true);
}

// Second, start the "peer janitor" loop to clean out stale peers and ping our active peers at regular intervals.
let peerJanitor = setInterval(function() {
    peers.forEach(peer => {
        peer.ping();
    });
}, 15000);