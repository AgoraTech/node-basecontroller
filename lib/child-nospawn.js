"use strict";

var IPC = require('basecontroller-libs').IPC,
    util = require('util'),
    EventEmitter = require('events').EventEmitter;

var Inner = function(outer) {
    EventEmitter.call(this);

    this._outer = outer;
};

util.inherits(Inner, EventEmitter);

Inner.prototype.send = function(msg) {
    this._outer.emit('message', msg);
};

var Child = function(ctrl) {
    EventEmitter.call(this);

    this._inner = new Inner(this);

    
    var Controller = require(ctrl);
    
    console.log('req', ctrl, Controller);
    this.controller = new Controller();
    this.controller.registerIPC(new IPC(), this._inner);
};
util.inherits(Child, EventEmitter);

Child.prototype.kill = function() {};

Child.prototype.send = function(msg) {
    this._inner.emit('message', msg);
};

module.exports = Child;

