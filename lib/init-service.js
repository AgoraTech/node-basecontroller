/**
 * @fileoverview
 * 
 * Hosts the forked service and serves an ipc connection to it.
 * 
 * @author Michał Czapracki <michalcz@agora.pl>
 * TODO:
 *      - sighandlers
 *  - load JSON config/flavour
 *  - create listen channel (PID based)
 *  - fork child
 *  - init child
 *  - handle messages:
 *      o reopen
 *      o restart
 *      o exception (killed)
 */

var Seq = require('basecontroller-libs').Seq,
    path = require('path'),
    host = require('./host').getInstance();
    
    host.console = require('basecontroller-logger')
        .getInstance("Service")
        .file(path.join(process.env.HOME, 'svclog', 'all.log'))
        .level(4);

Seq.run(
    [
//        Seq.defer,
        host.parseServiceArgs.bind(host),
        host.setSignalHandlers.bind(host),
        host.loadConfig.bind(host),
        host.startIPC.bind(host),
        host.start.bind(host)
    ],
    function() {}, 
    function(step, e) {
        e.message += " [Step " + step + "]";
        console.error(e);
        console.log(e.stack);
        process.exit(1);
    }
);

