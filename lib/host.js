/**
 * @fileoverview
 * 
 * The IPC host class
 * 
 * @author Michał Czapracki <michalcz@agora.pl>
 */

var fs = require('fs'),
    path = require('path'),
    flatconfig = require('flatconfig'),
    child_process = require('child_process'),
    IPC = require('basecontroller-libs').IPC; 

var Host = exports.Host = function() {};

var _instance = null;
exports.getInstance = function() {
    _instance = _instance || new Host();
    return _instance;
};

var dummyCallback = function() {};
var hostArgs = ['flavour', 'spawn', 'config', 'ipcsock', 'autorestart'];

Host.prototype.log = function() {
    this.console && this.console.log.apply(this.console, arguments);
};

Host.prototype._error = function() {
    this.console && this.console.error.apply(this.console, arguments);
    if (this.checkAutorestart()) {
        this.log('Autorestarting after error!');
        this.autorestarts.push(Date.now());
        this._restart(true);
    } else {
        this.log('Shutting down after error!');
        this._kill(10);
    }
};

Host.prototype._ready = function(info) {
    if (this.console.getSub && info && info.name)
        this.console = this.console.getSub(info.name.replace(/^[^\w]+|[^\w].*$/g, ''));
    
    this.log('Application is ready to init.');
};

Host.prototype.checkAutorestart = function () { 
    var r = +this.autorestart;
    
    if (r === 0)
        return false;
    
    while(this.autorestarts[0] && this.autorestarts[0] < Date.now() - 36e5) {
        this.autorestarts.shift();
    }
    
    return this.autorestarts.length < r;
};

/**
 * Initializes signal handlers.
 */
Host.prototype.setSignalHandlers = function(callback) {
        
    this.log('Hooking signal handlers...');
    if (!this._sigHandlersSet) {
        process.on('exit', this._kill.bind(this));
        process.on('SIGTERM', this._stop.bind(this));
        process.on('SIGINT', this._stop.bind(this));
        process.on('SIGUSR1', this._reopen.bind(this));
        process.on('SIGUSR2', this._restart.bind(this));
    
        this._sigHandlersSet = true;
    }
    
    return callback;

};

Host.prototype.parseArgs = function(callback) {

    this.log('Parsing arguments...');
    this.args = flatconfig.setArgs(process.argv.slice(2));
    
    return callback;
};

Host.prototype.parseServiceArgs = function(callback) {

    this.log('Parsing service arguments...');
    this.args = JSON.parse(flatconfig.setArgs(process.argv.slice(2)).appconf[0]);
    
    return callback;
};

/**
 * 
 * @throws file not found, unable to parse JSON 
 * @param callback
 * @returns
 */
Host.prototype.loadConfig = function(callback) {
    
    var cfg = require.resolve(path.resolve(process.cwd(), this.args.config[0]));
    this._baseDir = path.dirname(cfg);
    
    this.log('Loading config from ' + cfg + ' (' + this.args.config[0] + ')');
    
    if (cfg in require.cache) {
        delete require.cache[cfg];
    }
    
    this._setup = require(cfg);
    
    var fv = '';        
    while (this.args.flavour && this.args.flavour.length) {
        fv = this.args.flavour.pop();
        this.log('Adding flavour ' + fv);
        flatconfig.join.ini(this._setup, path.resolve(this._baseDir, fv));
    }
    
    this.autorestart = +this.args.autorestart;
    this.autorestarts = [];
    
    if (this.args.spawn && this.args.spawn.length) {
        this._setup.spawn = !!this.args.spawn[0];
    } else {
        this._setup.spawn = true;
    }
    
    this._argsBk = {};
    for (var i = 0; i < hostArgs.length; i++) {
        var arg = hostArgs[i];
        if (arg in this.args) {
            this._argsBk[arg] = this.args[arg];
            delete this.args[arg];
        }
    }

    flatconfig.join.args(this._setup, this.args);
    this.check();
    return callback;
};

Host.prototype.check = function() {

    this._setup.ctrl = path.resolve(this._baseDir, this._setup.ctrl);
    this.log('Controller resolved to ' + this._setup.ctrl);

    if (!this._setup.ctrl)
        throw new Error('No controller class declared in args or config');
        
};

Host.prototype.startIPC = function(callback) {

    this.log('Starting IPC... ');
    this.ipc = new IPC();

    this.ipc.on('ready', this._ready.bind(this));
    this.ipc.on('restart', this._restart.bind(this));
    this.ipc.on('error', this._error.bind(this));
    
    return callback;

};

Host.prototype._die = function() {
    if (this._deathExpected)
        return;
    
    this.log('Unexpected child death!');
    process.exit(1);
};

Host.prototype._restart = function(force) {
    this._deathExpected = true;
    this.ipc.send(force ? 'kill' : 'shutdown');
    this.ipc.once('close', this.start.bind(this, dummyCallback));   
};

Host.prototype._reopen = function() {
    this.ipc.send('reopen');
};

Host.prototype._stop = function() {
    this.ipc.send('shutdown', this._deathExpected === true);
    this._deathExpected = true;
    
    this.ipc.once('close', function() {
        process.exit(0);
    });
};

Host.prototype._kill = function(level) {
    this._deathExpected = true;
    this.child && this.child.kill();
    process.exit(level || 0)
};

Host.prototype.start = function(callback) {
    this.log('Starting daemon...');
        
    var args = [this._setup.ctrl];
    if (this._setup.spawn) {
        var cmd = __dirname + '/child';
        
        // TODO: Using a nasty hack. Get back to this when options.execArgv is supported!
        if (this._setup.debug && this._setup.debug.port) {
            args.unshift(cmd);
            cmd = (this._setup.debug.brk ? '--debug-brk=' : '--debug=') + this._setup.debug.port;
        }
        
        if (this._setup.spawn) {
            this.child = child_process.fork(cmd, args);
            this.log('Pids: ' + this.child.pid + '/' + process.pid);
        }
    } else {
        var Child = require(__dirname + '/child-nospawn');
        this.child = new Child(this._setup.ctrl, this._setup);
        this.log('Created child in no-spawn mode');
    }
    
    this.child.on('exit', this._die.bind(this));
    this.ipc.setProcess(this.child);
    this.ipc.once('init', callback);
    this.ipc.send('init', this._setup);
        
};

