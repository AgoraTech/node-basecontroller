#!/usr/bin/env node

/**
 * @fileoverview
 * 
 * Hosts the forked controller and serves an ipc connection to it.
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
    host = require('../lib/host').getInstance();

host.console = require('basecontroller-logger')
    .getInstance("CtrlScripts")
    .level(4);

Seq.run([
    host.parseArgs.bind(host),
    host.setSignalHandlers.bind(host),
    host.loadConfig.bind(host),
    host.startIPC.bind(host),
    host.start.bind(host)
], function(){
    host.console.log('Controller initialized!');
}, function(step, e){
    e.message = "Step " + step + " " + e.message;
    console.error(e);
    console.log(e.stack);
    process.exit(1);
});

