const { dd } = require('./helpers/index');

class SocketManager {
    constructor() {
        this.isMaster = false;
        this.servers = {};
        this.checkInterval = null;
    }

    initialize(c) {
        // Check if this should be the master
        this.isMaster = process.env.ENABLE_PAYMENT_SOCKETS === 'true' ||
            process.env.SERVICE_GROUP === 'service1';

        if (this.isMaster) {
            this.startSocketServers(c);
            dd('This instance is now the payment socket master');
        } else {
            dd('This instance is running in socket slave mode');
        }
    }

    startSocketServers(c) {
        // Your existing socket initialization logic here
        const socketServer = require('./socketServer/index');

        this.servers.tcpServer1 = !c.tcpServerPort1 ? new socketServer.tcpClient1(c) : new socketServer.tcpServer1(c);
        this.servers.tcpServer2 = !c.tcpServerPort2 ? new socketServer.tcpClient2(c) : new socketServer.tcpServer2(c);
        this.servers.tlsServer1 = !c.tlsServerPort1 ? new socketServer.tlsClient1(c) : new socketServer.tlsServer1(c);
        this.servers.tlsServer2 = !c.tlsServerPort2 ? new socketServer.tlsClient2(c) : new socketServer.tlsServer2(c);
        this.servers.tlsServerAmex1 = !c.tlsServerPortAmex1 ? new socketServer.tcpClientAmex1(c) : new socketServer.tlsServerAmex1(c);

        if (c.httpClientHost1) {
            this.servers.httpServerHost1 = new socketServer.httpClient1(c);
        }

        if (c.broxelGWUrl) {
            const { tranWhitelabel } = require('./Translator/index.js');
            this.servers.httpClientBroxelWhitelabel = new socketServer.httpClient(c, 'BROXEL_WHITELABEL', new tranWhitelabel(c.broxelGWUrl));
        }

        dd('All payment socket servers started');
    }

    gracefulShutdown() {
        if (this.isMaster) {
            // Gracefully close all socket connections
            Object.values(this.servers).forEach(server => {
                if (server && typeof server.emit === 'function') {
                    server.emit('terminate');
                }
            });
            dd('Payment socket servers shut down gracefully');
        }
    }
}

module.exports = new SocketManager();