# DEPRECATED - The Forge Validator node has been merged with the Forge GUI into a single repo

Visit the **ZENZO Forge** repository for the new Forge repository:

https://github.com/ZENZO-Ecosystem/zenzo-forge

.

.

.

.

# forge-validator
The Source of the Decentralized ZENZO Forge Validator Node


## What is the ZENZO Forge?
The ZENZO Forge ("the Forge") is a blanket term for the ZENZO Forge Validator Network, a distributed database of "Items" backed by validations and blockchain entries on the ZENZO Core Protocol.

The Forge is essentially a metadata network used to store less significant data. This prevents putting not so important data into the ZENZO Core Blockchain, which would result in bloating it with information, that in the future doesn't exist or could be irrelevant. The Forge allows for a safe storage of verifiable, non-priority data without weighing down the ZENZO Core Blockchain.

The Forge handles this data independently, validating it with subcomponents of ZENZO Core, like the Blockchain and keypair signatures.
This method is lightweight and acts as a "plugin" to an already running ZENZO Core server by using RPC commands to verify data within the Forge Network. This could be seen as something similar to IPFS or Bitcoin's Lightning Network, providing an additional layer of data processing and lessening the impact of the Core layer without compromising security.

## How do I setup a Forge Validator?
A Forge Validator has some minor prerequisites:
- A port-forwarded (Port 80) setup is recommended for better connectivity, but not required.
- An unlocked ZENZO Core wallet (latest version is always recommended).
- Node.js

**1. Install Node.js**

Official Mirrors: https://nodejs.org/

**2. Setup ZENZO Core**

Ensure the "zenzo.conf" file has been edited to contain the following, modified for your preference:
```
txindex=1
rpcuser=user
rpcpassword=pass
listen=1
server=1
```

**3. Edit the config file**

Ensure the "data/config.json" file in the Validator's directory has been modified to suit your preferences and you have a ZNZ address, generated by your local ZENZO Core node added to your config.

**4. Install Dependencies**

Use command `npm i` in the Validator's directory to install the required dependencies.

**5. Start the Forge Node**

Use command `node index` within the Validator's directory to start the node.

Your node will automatically sync up to the network, validating items and distributing them to peers it finds. If you use the built-in local endpoints with your auth-token, you can create your own items and add them to the Forge globally.
