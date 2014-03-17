#!/usr/bin/env node

var fc = require('flatconfig'),
    cfg = require('../lib/serviceconfig')(),
    path = require('path'),
    isroot = process.getuid() == 0;

function usage() {
    console.log("Usage: service.js <service-name> [start|stop|kill|force-restart|reopen|restart|status]");
    process.exit(2);
}

if (process.argv.length < 4) {
    usage();
}

var service = process.argv[2],
    cmd = process.argv[3];

try {
    
    if (isroot)
        fc.join.ini(cfg, path.join('/etc/node-service.d', service + '.conf'));
    else
        fc.join.ini(cfg, path.join(process.env.HOME, '.node-service.d', service + '.conf'));

} catch(e) {
    
    console.log("Could not load configuration for service " + service);
    console.error(e);
    process.exit(1);
    
}

cfg.daemon.argv = ['--appconf=' + JSON.stringify(cfg.app)];
cfg.daemon.main = require.resolve('../lib/init-service');
                
var svcname = "`" + cfg.name + "'",
    daemon = require("daemonize2").setup(cfg.daemon);

if (cfg.root && !isroot) {
    console.log("Service `" + svcname + "' is expected to run as root");
    process.exit(1);
}

var started = false;
function startlog(text) {
    started = true;
    process.stdout.write(text);
    midlog('..', '..');
    return true;
}

function midlog(text, fix) {
    fix = fix || '[]';
    var len = text.length + 2;
    text = fix[0] + text.substr(0, 18) + fix[1];
    text = new Array(20 - len).join(' ') + text;
    
    process.stdout.write("\x1B[1000C\x1B[20D" + text);
    return true;
}

function endlog(text, fix) {
    started = false;
    midlog(text, fix);
    process.stdout.write("\n");
    return true;
}

var cyel = ['<\x1B[33m','\x1B[m>'],
    cgre = ['[\x1B[32m','\x1B[m]'],
    cred = ['[\x1B[31m','\x1B[m]'];

function exit(status) {
    process.nextTick(process.exit.bind(process, status));
}

daemon
    .on("error", function(err) {
        started && endlog("ERR");
        console.log("Daemon failed to start:  " + err.message);
    });


function dstart(callback) {
    daemon.start()
        .once("started", function() {
            setTimeout(function(){
                callback(daemon.status());
            }, 500);
        });
};

function dstop(callback) {
    daemon.stop()
        .once("stopped", function() {
            callback();
        })
        .once("notrunning", function(){
            callback();
        });
}

function dkill(callback) {
    daemon.stop()
        .once("stopped", function() {
            callback();
        })
        .once("notrunning", function(){
            callback();
        });
}

switch (process.argv[3]) {
    
    case "start":
        if (!daemon.status()) {
            startlog('Starting service ' + svcname);
            midlog('starting', cyel);
            dstart(function(status) {
                if (status)
                    endlog('OK', cgre) && exit(0);
                else
                    endlog('FAIL', cred) && exit(1);
            });
        } else {
            console.log('Service ' + svcname + ' is already running.');
            exit(1);
        }
        break;
    
    case "stop":
        if (daemon.status()) {
            startlog('Stopping service ' + svcname);
            midlog('stopping', cyel);
            dstop(function() {
                endlog("OK", cgre) && exit(0);
            });
        } else {
            console.log('Service ' + svcname + ' is not running.');
            exit(1);
        }
        break;
    
    case "kill":
        if (daemon.status()) {
            startlog('Killing service ' + svcname);
            dkill(function() {
                endlog("OK", cgre) && exit(0);
            });
        } else {
            console.log('Service ' + svcname + ' is not running.') && exit(1);
        }
        break;
    
    case "force-restart":
        if (daemon.status()) {
            startlog('Force-restarting service ' + svcname);
            midlog('stopping', cyel);
            dstop(function() {
                midlog('starting', cyel);
                dstart(function(status) {
                    if (status)
                        endlog('OK', cgre) && exit(0);
                    else
                        endlog('FAIL', cred) && exit(1);
                });
            });
        } else {
            startlog('Starting service ' + svcname);
            dstart(function(status) {
                midlog('starting', cyel);
                if (status)
                    endlog('OK', cgre) && exit(0);
                else
                    endlog('FAIL', cred) && exit(1);
            });
        }
        break;

    case "reopen":
        daemon.sendSignal("SIGUSR1");
        console.log('Asked service ' + svcname + ' to reopen descriptors.');
        exit(0);
        break;

    case "restart":
        daemon.sendSignal("SIGUSR2");
        console.log('Asked service ' + svcname + ' to restart.');
        exit(0);
        break;

    case "status":
        var pid = daemon.status();
        if (pid) {
            console.log("Service " + svcname + " running. PID: " + pid);
            exit(0);
        } else {
            console.log("Service " + svcname + " is not running.");
            exit(1);
        }
        break;
    
    default:
        usage();
}
