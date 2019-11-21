const superagent = require('superagent');
const express = require('express');
const bodyParser = require('body-parser');
const RPC = require('bitcoin-rpc-promise');
const nanoid = require('nanoid');
const x11 = require('x11-hash-js');

/* ------------------ NETWORK ------------------ */
// The list of all known peers
let peers = [];

// The list of all known items on the Forge network
let items = [];

let itemsToValidate = [];

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


const authToken = nanoid();
console.info("PRIVATE: Your local auth token is '" +  authToken + "'");

// Checks if a private HTTP request was authenticated
function isAuthed (req) {
    if (req.body.auth === authToken) return true;
    return false;
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}

// Validates if an item is genuine
async function isItemValid (nItem) {
    let rawTx = await zenzo.call("getrawtransaction", nItem.tx, 1);
    if (!rawTx || !rawTx.vout || !rawTx.vout[0]) {
        console.warn('Forge: Item "' + nItem.name + '" is not in the blockchain.');
        return false;
    }
    for (let i=0; i<rawTx.vout.length; i++) {
        if (rawTx.vout[i].value === nItem.value) {
            if (rawTx.vout[i].scriptPubKey.addresses.includes(nItem.address)) {
                console.log("Found pubkey of item...");
                let isSigGenuine = await zenzo.call("verifymessage", nItem.address, nItem.sig, nItem.tx);
                if (isSigGenuine) {
                    console.info("Sig is genuine...")
                    if (hash(nItem.tx + nItem.sig + nItem.address + nItem.name + nItem.value) === nItem.hash) {
                        console.info("Hash is genuine...")
                        return true;
                    } else {
                        console.info("Hash is not genuine...")
                        return false;
                    }
                } else {
                    console.info("Sig is not genuine...")
                    return false;
                }
            }
        }
    }
    return false;
}

async function validateItems () {
    let validated = 0;
    await asyncForEach(itemsToValidate, async (item) => {
        let res = await isItemValid(item);
        if (res) validated++;
    });
    return validated;
}

async function validateItemBatch (res, nItems) {
    await asyncForEach(nItems, async (nItem) => {
        // Check all values are valid
        if (nItem.tx.length !== 64) return console.warn("Forge: Received invalid item, TX length is not 64.");
        if (nItem.sig.length < 1) return console.warn("Forge: Received invalid signature, length is below 1.");
        if (nItem.address.length !== 34) return console.warn("Forge: Received invalid address, length is not 34.");
        if (nItem.name.length < 1) return console.warn("Forge: Received invalid name, length is below 1.");
        if (nItem.value < 0.01) return console.warn("Forge: Received invalid item, value is below minimum.");
        if (nItem.hash.length !== 64) return console.warn("Forge: Received invalid item, hash length is not 64.");

        let valid = await isItemValid(nItem);
        if (!valid) return console.error("Forge: Received item is not genuine, ignored.");
        if (getItem(nItem.hash) === null) {
            items.push(nItem);
            console.info("New item received! (" + nItem.name + ") We have " + items.length + " items.");
            res.send("Thanks!");
        }
    });
}

// Get an item object from our list by it's hash
function getItem (itemArg) {
    for(let i=0; i<items.length; i++) {
        if (items[i].hash === itemArg) return items[i];
    }
    return null;
}

// Hash a string with x11
function hash (txt) {
    return x11.digest(txt);
}

// Setup Express server
let app = express();
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

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

    sendItems (itemz) {
        return superagent
        .post(this.host + "/forge/receive")
        .send(itemz)
        .then((res) => {
            this.lastPing = Date.now();
            this.setStale(false);
            console.info(`Peer "${this.host}" (${this.index}) responded to items with "${res.text}".`);
        })
        .catch((err) => {
            // Peer didn't respond, mark as stale
            this.setStale(true);    
            console.warn(`Unable to send items to peer "${this.host}" --> ${err.message}`);
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

// Forge Receive
// Allows peers to send us their Forge item data
app.post('/forge/receive', (req, res) => {
    let ip = cleanIP(req.ip);

    let nItems = req.body;

    validateItemBatch(res, nItems).then(ress => {
        console.log('Forge: Validated item batch from "' + ip + '"');
    })
});

/* LOCAL-ONLY ENDPOINTS (Cannot be used by peers, only us)*/
// Forge Create
// The endpoint for crafting new items, backed by ZNZ and validated by the ZENZO Core protocol
app.post('/forge/create', (req, res) => {
    let ip = cleanIP(req.ip);
    if (!isAuthed(req)) return console.warn("Forge: A non-authorized Forge was made by '" + ip + "', ignoring.");

    // Check we have all needed parameters
    if (req.body.amount < 0.01) return console.warn("Forge: Invalid amount parameter.");
    if (req.body.name.length < 1) return console.warn("Forge: Invalid name parameter.");

    // Cleanse the input
    req.body.amount = Number(req.body.amount);

    // Create a transaction
    zenzo.call("sendtoaddress", addy, Number(req.body.amount.toFixed(8))).then(txid => {
        // Sign the transaction hash
        zenzo.call("signmessage", addy, txid).then(sig => {
            let nItem = {
                tx: txid,
                sig: sig,
                address: addy,
                name: req.body.name,
                value: req.body.amount
            }
            nItem.hash = hash(nItem.tx + nItem.sig + nItem.address + nItem.name + nItem.value);
            console.log("Forge: Item Created!\n- TX: " + nItem.tx + "\n- Signature: " + nItem.sig + "\n- Name: " + nItem.name + "\n- Value: " + nItem.value + " ZNZ\n- Hash: " + nItem.hash);
            items.push(nItem);
            itemsToValidate.push(nItem);
        }).catch(console.error);
    }).catch(console.error);
});

app.listen(80);


/* Core Node Mechanics */
// First! Let's bootstrap the validator with seednodes
const seednodes = ["45.12.32.114"];
for(let i=0; i<seednodes.length; i++) {
    let seednode = new Peer(seednodes[i]);
    seednode.connect(true);
}

// Start the "peer janitor" loop to clean out stale peers and ping our active peers at regular intervals.
let peerJanitor = setInterval(function() {
    peers.forEach(peer => {
        peer.ping();
    });

    if (itemsToValidate.length > 0) {
        validateItems().then(validated => {
            console.log("Validated " + validated + " item(s).")
            if (itemsToValidate.length === validated) {
                peers.forEach(peer => {
                    peer.sendItems(itemsToValidate);
                });
            }
        });
    }
}, 15000);

// Setup the wallet RPC
const rpcAuth = {user: "user", pass: "pass", port: 26211};
const addy = "";
let zenzo = new RPC('http://' + rpcAuth.user + ':' + rpcAuth.pass + '@localhost:' + rpcAuth.port);