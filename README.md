Node-Basecontroller
=====================

A node.js server framework that takes care of daemonizing, logging, configuration etc. designed to run node.js application on premises.

Why use Node-BaseController
-----------------------------

Usually when you need to deploy a node.js aplication you need to take care of lots of standard tasks before puttting it into production. Sure, you can always use some PAAS node.js hosting, but things get tricky when you want to take advantage of your own infrastructure. You'll need process management, error and application logging, configuration and probably some special modules for application monitoring.

BaseController was built to handle all these tasks for you.

A "could be a bit simplier" app
---------------------------------

file: app/cfg.js

    module.exports = {
        "appname": "ABC",                   // Application name
        "ctrl": "../lib/app-controller",    // Main controller location
        "logfile": __dirname + "/logs/my-controller2.log",
                                            // Log file location
        "loglevel": 9,                      // Log level
        "init": true,                       // Should the controller be initialized? (calls init)
        "debug": {
             "port": 0,                     // This will cause BaseController to start application with nodejs debug if port > 0
             "brk": false                   // This will cause to pass --debug-brk to controller
        },
        "services": {                       // Turn on services you like
            "http": {                       // Will require ./services/http, this._basename + '/services/http' or basecontroller-svc-http
                "port": 31337               // Provide port
            }
        },
        "myhandler": {                      // The above configuration is more or less required.
            "response": {                   // You can specify own config
                "ver": "1.0.0",
                "url": "http://localhost:8080/"
            }
        }
    }

file: app/lib/my.js

    var util = require('util'),
        BaseController = require('basecontroller-core');
    
    var MyController = function MyController() {
        BaseController.call(this);
    };

    util.inherits(MyController, BaseController);

    MyController.initBeforeHandlers = function() {
        require('./myhandler').call(this, this.cfg.myhandler);
    };
    
file: app/lib/myhandler.js

    module.exports = function(cfg) {
        // we did call this using MyController instance as context
        this.addHandler('http', 'redir', function(req, data, callback){
            callback(cfg.response);
            return true;
        });
    };

file: ~/.node-service.d/my.conf
    
    name = MyController
    root = false

    [daemon]
    name = my
    pidfile = ${HOME}/run/my.pid
    user = false
    group = false

    [app]
    config = /path/to/my/app/cfg.json
    ipcsock = ${HOME}/run/my.sock



And lets run this and test it:
    
    # create directories first
    mkdir ${HOME}/run
    mkdir ${HOME}/svclog
    mkdir /path/to/my/app/logs

    #exec
    node-service my start
    curl -q 'http://localhost:31337/redir/'
    node-service my stop

What does it do
-----------------

When you start BaseController the initialization script:
* loads the specified configuration
* parses the command line arguments and mixes in flavour files
* checks for any misconfiguration and throws an error when such an event
* forks a host process that will restart our application in event of errors or planned restarts
* spawns a child process that will run our application
* creates a communication channel between processes
* loads the given module using require

Next the spawned core BaseController class:
* starts the logging system
* starts services - services are nodejs modules that create servers like http, websocket, etc. 
* loads handlers - handlers can be called by services to perform computation tasks
* initializes the main timeout

If you run the application using `node-service` it will be daemonized and detached from the console. You can then safely disconnect from the terminal, the application will keep running until you stop it.

Installation
--------------

Couldn't be easier than this:

    npm install -g basecontroller

Developing your own Controller
--------------------------------

Please check out the [basecontroller-core](https://github.com/AgoraTech/node-basecontroller-core) documentation.

Development Usage
-------------------

You can run a basecontroller application from command line - this allows you to debug 

    node-init --config=your/config/location.js --flavour=relative_to_config/inifile.ini --no-logfile --loglevel=9 --no-your-app-something-you-dont-need --your-app-something-you-need=is_something

Standard usage:
* --config=**file** tell where your application default configuration is
* --flavour=**relative_file** provide any ini style configuration overlays
* --logfile=**file** set log file location (--no-logfile will output log to stdout)
* --loglevel=**number** set log level

You can use any other directive that is set in your config.

Production Usage
------------------

Using flavours and .node-service.d files you can simply run your software:
    
    node-service my start

And stop it:
    
    node-service my stop

INI flavour files
-------------------

Flavours are just simple ini files that you can use to manipulate the config file. The configuration can be used to create a sophisticated configurations with programmable logic.

For more information check out the [flatconfig](https://github.com/MichalCz/node-flat-config) module.

License
---------

BaseController is released on the BSD 2-clause license. The product is not suitable for consumer use.

You can get the license in "license.txt" file available in this repository.
