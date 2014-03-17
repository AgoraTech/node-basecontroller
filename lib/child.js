/**
 * @fileoverview
 * 
 * Starts the forked controller and registers ipc connection in it.
 * 
 * @author Michał Czapracki <michalcz@agora.pl>
 */

var IPC = require('basecontroller-libs').IPC;

if (!process.argv[2])

    throw new Error('A valid script name must be passed as the first argument!');

try {

    var BaseController = require(process.argv[2]);
    var instance = new BaseController();

} catch(e) {

    e.message = "Error while loading controller: " + e.message;
    throw e;

}

instance.registerIPC(new IPC());

var ignore = function() {};

process.on('SIGINT', ignore);
process.on('SIGUSR1', ignore);
process.on('SIGUSR2', ignore);

process.on('uncaughtException', function(e) {
    instance.ipc && instance.ipc.send('error', 'Error in application:\n' + e.stack);
    instance._exitStatus = 5;
});
